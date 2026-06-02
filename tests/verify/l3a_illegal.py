"""
L3a — Illegal state transitions.

Strategy: for each state machine, set a record to some state, then try every
invalid transition via API. Expected: 400/422/409 (business rule rejection)
or 403 (auth), NOT 200 (allows illegal).

Three failure modes this catches:
  1. "Double-approval" — already approved record gets approved again silently
  2. "Skip a stage" — pending_pmc → paid without going through naveen_approved
  3. "Resurrection" — closed/paid records getting resuscitated
"""
import requests, subprocess, json, time

BASE = "http://localhost:3100"

def login(role):
  s = requests.Session()
  r = s.post(f"{BASE}/api/auth/login", json={"username":f"test_{role}","password":"Test1234"})
  if r.status_code != 200: return None
  return s

def db_exec(sql):
  return subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-Nse', sql],
    capture_output=True, text=True).stdout.strip()

def db_set_status(table, rid, status):
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE {table} SET status='{status}' WHERE id={rid}"], capture_output=True)

results = []

def assert_rejected(label, response, allow_codes=(400,403,409,422)):
  code = response.status_code if hasattr(response, 'status_code') else response
  ok = code in allow_codes
  results.append((ok, label, f"got {code}"))
  print(f"  {'✓' if ok else '✗'} {label}  (got {code})")
  return ok

def assert_ok(label, response):
  code = response.status_code if hasattr(response, 'status_code') else response
  ok = code in (200, 201)
  results.append((ok, label, f"got {code}"))
  print(f"  {'✓' if ok else '✗'} {label}  (got {code})")

print("=" * 70)
print("L3a — Illegal state transitions")
print("=" * 70)

# ─────────────── PAYMENT REQUEST state machine ───────────────
print("\n▼ Payment Request (PR) state machine")
pmc = login('pmc_head')
principal = login('principal')
finance = login('finance_admin')

if not (pmc and principal and finance):
  print("  LOGIN FAILED — cannot proceed"); 
else:
  # Use PR 4 as the test victim
  PR = 4
  
  # Setup: force PR-4 to paid state, then try to "re-approve" it
  db_set_status('payment_requests', PR, 'paid')
  r = pmc.post(f"{BASE}/api/payment-requests/1/batch-approve", json={"ids":[PR]})
  assert_rejected("PMC approve a PAID PR is rejected or no-op", r)
  # Check DB: status should still be paid, not pmc_approved
  status = db_exec(f"SELECT status FROM payment_requests WHERE id={PR}")
  results.append((status=='paid', f"PR-{PR} remains paid after illegal re-approve", f"status={status}"))
  print(f"  {'✓' if status=='paid' else '✗'} PR-{PR} remains paid (status={status})")
  
  # Setup: pending_pmc → try to go directly to naveen_approved (skip a stage)
  db_set_status('payment_requests', PR, 'pending_pmc')
  r = principal.post(f"{BASE}/api/payments/1/batch-approve", json={})  # principal endpoint
  # This endpoint approves pmc_approved → naveen_approved. PR-4 is pending_pmc, should NOT be picked up
  status = db_exec(f"SELECT status FROM payment_requests WHERE id={PR}")
  results.append((status=='pending_pmc', f"PR-{PR} stays pending_pmc (not naveen_approved)", f"status={status}"))
  print(f"  {'✓' if status=='pending_pmc' else '✗'} PR-{PR} stays pending_pmc after Principal batch — correct skip prevention")
  
  # Setup: try PR approval as a finance admin (should 403)
  db_set_status('payment_requests', PR, 'pending_pmc')
  r = finance.post(f"{BASE}/api/payment-requests/1/batch-approve", json={"ids":[PR]})
  assert_rejected("Finance approve at PMC stage (wrong role)", r)
  
  # Reset PR-4 for next tests
  db_set_status('payment_requests', PR, 'pending_pmc')

# ─────────────── GRN state machine ───────────────
print("\n▼ GRN state machine")
if pmc:
  GRN = 8
  
  # Setup: GRN-8 is approved already — try to approve again
  db_set_status('grns', GRN, 'approved')
  r = pmc.patch(f"{BASE}/api/grn/{GRN}/approve")
  # Some endpoints are idempotent (return 200 + message "already approved"), others reject
  if r.status_code in (400, 409, 422):
    assert_rejected("GRN already-approved explicitly blocked", r)
  else:
    # Check if approved_at was updated (shouldn't be)
    before_at = db_exec(f"SELECT approved_at FROM grns WHERE id={GRN}")
    time.sleep(1)
    pmc.patch(f"{BASE}/api/grn/{GRN}/approve")
    after_at = db_exec(f"SELECT approved_at FROM grns WHERE id={GRN}")
    same = before_at == after_at
    results.append((same, "GRN double-approve is idempotent (approved_at unchanged)", f"before={before_at[:19]} after={after_at[:19]}"))
    print(f"  {'✓' if same else '✗'} GRN double-approve is idempotent (before≈after)")
  
  # Setup: GRN-8 is rejected — try to approve
  db_set_status('grns', GRN, 'rejected')
  r = pmc.patch(f"{BASE}/api/grn/{GRN}/approve")
  status = db_exec(f"SELECT status FROM grns WHERE id={GRN}")
  results.append((status=='rejected' or r.status_code >= 400,
                  "GRN rejected → approve stays rejected OR gets explicit 4xx",
                  f"status={status} code={r.status_code}"))
  print(f"  {'✓' if status=='rejected' or r.status_code >= 400 else '✗'} GRN rejected cannot be silently approved (status={status} code={r.status_code})")
  
  # Reset
  db_set_status('grns', GRN, 'pending')

# ─────────────── Drawing version state machine ───────────────
print("\n▼ Drawing version state machine")
services = login('services_head')
if services:
  DV = 8  # E-502
  
  # Setup: force to 'issued', try to approve again
  db_set_status('drawing_versions', DV, 'issued')
  r = services.post(f"{BASE}/api/drawings/version/{DV}/approve")
  # Code reads: if status in ['issued','superseded'], return success with 'already' message
  # That's idempotent (200) not illegal — accept that
  body = r.json() if r.status_code == 200 else {}
  idempotent = r.status_code == 200 and ('already' in body.get('message','').lower())
  explicitly_rejected = r.status_code in (400, 409, 422)
  results.append((idempotent or explicitly_rejected,
                  "Drawing already-issued is idempotent OR explicitly rejected",
                  f"code={r.status_code} msg={body.get('message','-')[:40]}"))
  print(f"  {'✓' if idempotent or explicitly_rejected else '✗'} Drawing re-approve after issued is guarded (code={r.status_code})")
  
  # Setup: superseded drawing — try to approve
  db_set_status('drawing_versions', DV, 'superseded')
  r = services.post(f"{BASE}/api/drawings/version/{DV}/approve")
  status = db_exec(f"SELECT status FROM drawing_versions WHERE id={DV}")
  results.append((status=='superseded',
                  "Superseded drawing cannot be re-approved",
                  f"status stayed {status}"))
  print(f"  {'✓' if status=='superseded' else '✗'} Superseded drawing rejected (status={status})")
  
  # Setup: rejected drawing — try to approve
  db_set_status('drawing_versions', DV, 'rejected')
  r = services.post(f"{BASE}/api/drawings/version/{DV}/approve")
  status = db_exec(f"SELECT status FROM drawing_versions WHERE id={DV}")
  # rejected drawings — current behavior unknown, log it
  results.append((status=='rejected' or r.status_code >= 400,
                  "Rejected drawing approve should not silently succeed",
                  f"status={status} code={r.status_code}"))
  print(f"  {'✓' if status=='rejected' or r.status_code >= 400 else '✗'} Rejected drawing cannot re-enter workflow (status={status} code={r.status_code})")
  
  db_set_status('drawing_versions', DV, 'issued')

# ─────────────── Issue state machine ───────────────
print("\n▼ Issue state machine")
if pmc:
  ISS = 3  # ISS-003
  
  # Setup: try to CLOSE an open issue (must be resolved first)
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE issues SET status='open', resolved_by=NULL, closed_by=NULL WHERE id={ISS}"])
  r = pmc.patch(f"{BASE}/api/issues/{ISS}/close")
  assert_rejected("Close an open issue (not resolved) is blocked", r)
  
  # Setup: try to REOPEN an open issue
  r = pmc.patch(f"{BASE}/api/issues/{ISS}/reopen", json={"reason":"test reopen of open issue"})
  assert_rejected("Reopen an open issue (not closed) is blocked", r)
  
  # Setup: try to resolve a CLOSED issue
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE issues SET status='closed' WHERE id={ISS}"])
  services_ = login('services_head')
  if services_:
    r = services_.patch(f"{BASE}/api/issues/{ISS}/resolve", json={"resolution_note":"test"})
    # Code reads: only checks assigned_to or role; doesn't check status!
    # If it succeeds, that's a bug
    status = db_exec(f"SELECT status FROM issues WHERE id={ISS}")
    bug = (status == 'resolved' and r.status_code == 200)
    results.append((not bug,
                    "Resolving a CLOSED issue is blocked",
                    f"status={status} code={r.status_code}"))
    if bug:
      print(f"  ✗ BUG: Resolving a closed issue silently succeeded (status={status})")
    else:
      print(f"  ✓ Resolving closed issue blocked (status={status})")
  
  # Reset
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE issues SET status='open', resolved_by=NULL, resolved_at=NULL, closed_by=NULL, closed_at=NULL WHERE id={ISS}"])

# ─────────────── Daily Report state machine ───────────────
print("\n▼ Daily Report state machine")
if pmc:
  # Get an approved daily report
  dr_id = db_exec("SELECT id FROM daily_reports WHERE project_id=1 AND status='approved' ORDER BY id DESC LIMIT 1")
  if dr_id:
    # Try to flag an already-approved report
    r = pmc.post(f"{BASE}/api/daily-reports/{dr_id}/flag", json={"reason":"test flag of approved report"})
    assert_rejected("Flag an already-approved daily report is blocked", r)
  
  # Try to approve an already-approved report
  if dr_id:
    r = pmc.post(f"{BASE}/api/daily-reports/{dr_id}/approve")
    assert_rejected("Approve an already-approved daily report is blocked", r)

# ─────────────── Summary ───────────────
print("\n" + "=" * 70)
passed = sum(1 for r in results if r[0])
failed = sum(1 for r in results if not r[0])
print(f"L3a RESULT: {passed}/{len(results)} pass, {failed} fail")
if failed:
  print("\nFailures:")
  for ok, label, detail in results:
    if not ok: print(f"  ✗ {label}  {detail}")
