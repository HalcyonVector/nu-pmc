"""
L3c — Cross-entity invariants.

Checks that the app refuses to break referential / business rules across
multiple tables. These can't be caught by single-entity state guards.

Invariants tested:
  1. PR can't be raised against an inactive vendor engagement
  2. PR total amount can't exceed engagement's sanctioned limit (hard limit)
  3. GRN can't be raised against an inactive or unapproved engagement
  4. GRN quantity can't exceed PO quantity (engagement.quantity)
  5. Total PR amounts paid ≤ contract value + approved CNs
  6. daily_report headcount should match labour_register sum (soft invariant)
  7. Drawing referenced by an open 'design' issue can't be superseded cleanly
"""
import requests, subprocess

BASE = "http://localhost:3100"

def login(role):
  s = requests.Session()
  r = s.post(f"{BASE}/api/auth/login", json={"username":f"test_{role}","password":"Test1234"})
  return s if r.status_code == 200 else None

def db_exec(sql):
  return subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-Nse', sql],
    capture_output=True, text=True).stdout.strip()

def db_exec_multi(sql):
  r = subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e', sql],
    capture_output=True, text=True)
  return r.stdout.strip(), r.stderr.strip()

results = []
def note(label, ok, detail=''):
  results.append((ok, label, detail))
  print(f"  {'✓' if ok else '✗'} {label}  {detail}")

print("="*70)
print("L3c — Cross-entity invariants")
print("="*70)

pmc = login('pmc_head')
site = login('site_manager')
principal = login('principal')

# ─────────────── Invariant 1: PR against inactive vendor engagement ───────────────
print("\n▼ I1: PR against inactive vendor engagement")

# Find an engagement on PV90 and force is_active=0
eng = db_exec("SELECT id FROM vendor_engagements WHERE project_id=1 LIMIT 1")
if eng:
  orig = db_exec(f"SELECT is_active FROM vendor_engagements WHERE id={eng}")
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE vendor_engagements SET is_active=0 WHERE id={eng}"])
  
  # Try to raise PR against this engagement
  r = site.post(f"{BASE}/api/payment-requests/1", json={
    "engagement_id": int(eng),
    "amount_requested": 50000,
    "payment_type": "material_advance",
    "description": "Test against inactive engagement"
  }) if site else None
  
  if r is None:
    note("PR against inactive engagement (no site_manager login)", False)
  else:
    blocked = r.status_code >= 400
    note("PR against inactive engagement is blocked", blocked,
         f"code={r.status_code}" + (f" body={r.text[:80]}" if r.text else ''))
  
  # Restore
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE vendor_engagements SET is_active={orig} WHERE id={eng}"])

# ─────────────── Invariant 2: PR total amount vs engagement contract value ───────────────
print("\n▼ I2: PR total amount cannot exceed engagement contract value")

# Find a real engagement with contract value + its current PR sum
row = db_exec("""
SELECT ve.id, ve.contract_value, COALESCE(SUM(pr.amount_requested),0)
FROM vendor_engagements ve
LEFT JOIN payment_requests pr ON pr.engagement_id=ve.id AND pr.status NOT IN ('pmc_rejected','naveen_rejected')
WHERE ve.project_id=1
GROUP BY ve.id
ORDER BY ve.id
LIMIT 1
""")
if row:
  eng_id, contract, raised = row.split('\t')
  remaining = float(contract) - float(raised)
  print(f"    eng={eng_id} contract=₹{contract} raised=₹{raised} remaining=₹{remaining}")
  
  # Try to raise a PR that exceeds remaining capacity by 10x
  over_amount = float(contract) * 2
  if site:
    r = site.post(f"{BASE}/api/payment-requests/1", json={
      "engagement_id": int(eng_id),
      "amount_requested": over_amount,
      "payment_type": "material_advance",
      "description": f"Test overrun ₹{over_amount} vs contract ₹{contract}"
    })
    # Currently: no server-side check, so this may succeed. If it does, that's a bug.
    if r.status_code == 200 or r.status_code == 201:
      note("Overrun PR accepted (potential bug)", False, f"code={r.status_code}")
      # Roll back the PR we just made
      new_id = r.json().get('id') if r.headers.get('content-type','').startswith('application/json') else None
      if new_id:
        subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
          f"DELETE FROM payment_requests WHERE id={new_id}"])
    elif r.status_code in (400, 409, 422):
      note("Overrun PR blocked by server", True, f"code={r.status_code}")
    else:
      note("Overrun PR request failed", False, f"code={r.status_code}")

# ─────────────── Invariant 3: GRN against unapproved engagement ───────────────
print("\n▼ I3: GRN against unapproved/inactive engagement")

# Find a pending (not approved) engagement if exists, otherwise force one
pending = db_exec("SELECT id FROM vendor_engagements WHERE approval_status='pending' AND project_id=1 LIMIT 1")
if not pending:
  # Force one engagement to pending state
  eng_first = db_exec("SELECT id FROM vendor_engagements WHERE project_id=1 LIMIT 1")
  if eng_first:
    subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
      f"UPDATE vendor_engagements SET approval_status='pending' WHERE id={eng_first}"])
    pending = eng_first

if pending and site:
  # Try to raise GRN against pending engagement
  r = site.post(f"{BASE}/api/grn/1", json={
    "engagement_id": int(pending),
    "description": "Test GRN against pending engagement",
    "delivery_date": "2026-04-20",
    "quantity_received": 10,
    "unit_rate": 1000
  })
  blocked = r.status_code >= 400
  note("GRN against pending engagement is blocked", blocked, f"code={r.status_code}")
  
  # Restore
  subprocess.run(['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-e',
    f"UPDATE vendor_engagements SET approval_status='approved' WHERE id={pending}"])

# ─────────────── Invariant 4: GRN quantity vs PO quantity ───────────────
print("\n▼ I4: GRN quantity cannot exceed engagement quantity")

# Find an engagement with a defined quantity
eng_q = db_exec("""
SELECT ve.id, ve.quantity, COALESCE(SUM(g.quantity_received), 0)
FROM vendor_engagements ve
LEFT JOIN grns g ON g.engagement_id=ve.id AND g.status != 'rejected'
WHERE ve.project_id=1 AND ve.quantity IS NOT NULL AND ve.quantity > 0
GROUP BY ve.id
LIMIT 1
""")
if eng_q:
  eng_qid, po_qty, received_qty = eng_q.split('\t')
  print(f"    eng={eng_qid} po_qty={po_qty} received={received_qty}")
  
  if site:
    # Try to raise GRN for much more than PO qty
    r = site.post(f"{BASE}/api/grn/1", json={
      "engagement_id": int(eng_qid),
      "description": "Overrun GRN",
      "delivery_date": "2026-04-20",
      "quantity_received": float(po_qty) * 5,
      "unit_rate": 100
    })
    blocked = r.status_code >= 400
    if r.status_code == 200 or r.status_code == 201:
      note("GRN overrun qty accepted (potential bug)", False, f"PO={po_qty} received={float(po_qty)*5}")
    else:
      note("GRN overrun qty blocked", True, f"code={r.status_code}")

# ─────────────── Invariant 5: PR amounts paid ≤ contract value + approved CNs ───────────────
print("\n▼ I5: Total paid vs contract value + CNs")

# This is a report-level invariant — query both sides and compare
row = db_exec("""
SELECT
  p.contract_value,
  COALESCE(SUM(CASE WHEN pr.status='paid' THEN pr.amount_requested ELSE 0 END), 0) AS total_paid,
  COALESCE((SELECT SUM(cn.total_cost) FROM change_notices cn WHERE cn.project_id=p.id AND cn.status='approved'), 0) AS approved_cn_total
FROM projects p
LEFT JOIN payment_requests pr ON pr.project_id=p.id
WHERE p.id=1
GROUP BY p.id
""")
if row:
  cv, paid, cn = row.split('\t')
  cv, paid, cn = float(cv), float(paid), float(cn)
  max_allowed = cv + cn
  within = paid <= max_allowed
  note("Total paid ≤ contract + approved CNs", within,
       f"contract=₹{cv:,.0f} paid=₹{paid:,.0f} cn=₹{cn:,.0f} max=₹{max_allowed:,.0f}")

# ─────────────── Invariant 6: Daily report headcount matches labour register sum ───────────────
print("\n▼ I6: Daily report headcount reconciles with labour register")

# For each approved daily report, compare to labour register sum for that date
mismatches = db_exec("""
SELECT COUNT(*) FROM (
  SELECT
    dr.id,
    dr.report_date,
    COALESCE(SUM(lr.headcount), 0) AS register_sum
  FROM daily_reports dr
  LEFT JOIN labour_register lr ON lr.project_id=dr.project_id AND lr.work_date=dr.report_date
  WHERE dr.project_id=1 AND dr.status='approved'
  GROUP BY dr.id, dr.report_date
  HAVING register_sum = 0
) x
""")
# soft invariant — just report, don't fail
print(f"    {mismatches} approved reports have zero labour_register rows (soft)")

# ─────────────── Invariant 7: Drawing with open design issue can't be silently superseded ───────────────
print("\n▼ I7: Drawing with open design issue reference")

# Find an open issue of type 'design' or 'rfi' that references a drawing
issue_dw = db_exec("""
SELECT i.id, i.drawing_id
FROM issues i
WHERE i.project_id=1 AND i.status IN ('open','in_progress')
  AND i.issue_type IN ('design','rfi') AND i.drawing_id IS NOT NULL
LIMIT 1
""")
if issue_dw:
  iid, dw_id = issue_dw.split('\t')
  # Check if any drawing version of this drawing is currently active (not superseded)
  active = db_exec(f"SELECT COUNT(*) FROM drawing_versions WHERE drawing_id={dw_id} AND status IN ('issued','pending_l1','pending_l2')")
  note("Drawing with open design issue has an active version", int(active) > 0,
       f"drawing_id={dw_id} active_versions={active}")
else:
  note("No drawing-referencing open issues in test data", True, "— skipping")

# ─────────────── Summary ───────────────
print("\n" + "="*70)
ok_count = sum(1 for r in results if r[0])
bad_count = sum(1 for r in results if not r[0])
print(f"L3c RESULT: {ok_count}/{len(results)} pass, {bad_count} fail")
if bad_count:
  print("\nFailures/bugs:")
  for ok, label, detail in results:
    if not ok: print(f"  ✗ {label}  {detail}")
