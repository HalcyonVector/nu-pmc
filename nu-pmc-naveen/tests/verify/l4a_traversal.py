"""
L4a — Authorization traversal.

The attack:
  A user assigned to project A tries to act on resources in project B
  via URL tampering.

Test matrix:
  Users:
    - test_site_manager (project-scoped to PV90 only)
    - test_jr_architect (project-scoped to PV90 only)
    - test_team_lead (project-scoped to PV90 only)
    - test_coordinator (project-scoped to PV90 only)
    - test_trainee (project-scoped to PV90 only)
    - test_detailing (project-scoped to PV90 only)
    - test_services_engineer (project-scoped to PV90 only)
    - test_senior_site_manager (project-scoped to PV90 only)
  Targets:
    - TEST2 PR (id=7) via /api/payment-requests/2/...
    - TEST2 Issue (id=7) via /api/issues/7/...
    - TEST2 Drawing version (id=13) via /api/drawings/version/13/...
    - TEST2 project summary via /api/projects/2
    - TEST2 drawings list via /api/drawings/2

Every test checks:
  - READ path returns 403 or empty results (not TEST2 data)
  - WRITE path returns 403 (no state change)
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

# Confirm target IDs on TEST2
test2_pid = int(db_exec("SELECT id FROM projects WHERE code='TEST2'"))
test2_pr = int(db_exec(f"SELECT id FROM payment_requests WHERE project_id={test2_pid} LIMIT 1"))
test2_issue = int(db_exec(f"SELECT id FROM issues WHERE project_id={test2_pid} LIMIT 1"))
test2_drawing_v = int(db_exec(
  f"SELECT dv.id FROM drawing_versions dv JOIN drawings d ON d.id=dv.drawing_id WHERE d.project_id={test2_pid} LIMIT 1"))

print("=" * 70)
print("L4a — Authorization traversal (cross-project)")
print("=" * 70)
print(f"\nTEST2: project_id={test2_pid}, pr_id={test2_pr}, issue_id={test2_issue}, drawing_v={test2_drawing_v}")
print(f"All scoped-role users assigned to PV90 only — must not reach TEST2.\n")

PROJECT_SCOPED_ROLES = [
  'site_manager','senior_site_manager','team_lead','jr_architect',
  'services_engineer','coordinator','trainee','detailing',
]

results = []
def rec(role, path, method, status, should_block, note=''):
  # Expected: 403 (forbidden) is cleanest. 404 acceptable if record wasn't visible
  # to them anyway (looks the same to the attacker). 401 means session broken.
  # 200/2xx on a blocked resource = SECURITY LEAK.
  allowed = status in (403, 404)
  if status == 401:
    allowed = False
    note = 'UNAUTHENTICATED'
  if status in (200, 201) and should_block:
    allowed = False  # this is a security leak
    note = 'LEAK'
  elif status in (200, 201) and not should_block:
    allowed = True
  results.append((allowed, role, f"{method} {path}", status, note))

print("─" * 70)
print("ATTACK 1: scoped user GETs TEST2 project detail")
print("─" * 70)
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: print(f"  [{role}] login failed"); continue
  r = s.get(f"{BASE}/api/projects/{test2_pid}")
  rec(role, f"/projects/{test2_pid}", "GET", r.status_code, should_block=True)
  mark = '✓' if r.status_code in (403,404) else ('LEAK' if r.status_code in (200,201) else '?')
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}")

print("\n─" * 70)
print("ATTACK 2: scoped user GETs TEST2 drawings list")
print("─" * 70)
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: continue
  r = s.get(f"{BASE}/api/drawings/{test2_pid}")
  # This might return 200 with empty list (that's not a leak) or 200 with TEST2 data (leak)
  body = r.json() if r.status_code == 200 else {}
  leaked = False
  if r.status_code == 200:
    drawings = body.get('drawings') or body.get('items') or []
    leaked = len(drawings) > 0
  rec(role, f"/drawings/{test2_pid}", "GET", r.status_code, should_block=True, note=f"{len(body.get('drawings',[])) if isinstance(body,dict) else 0} drawings")
  mark = '✓' if r.status_code in (403,404) or (r.status_code==200 and not leaked) else 'LEAK'
  cnt = len(body.get('drawings',[])) if isinstance(body,dict) else '?'
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}  drawings_count={cnt}")

print("\n─" * 70)
print("ATTACK 3: scoped user POSTs GRN on TEST2")
print("─" * 70)
# Get TEST2 engagement id
test2_eng = int(db_exec(f"SELECT id FROM vendor_engagements WHERE project_id={test2_pid} LIMIT 1"))
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: continue
  r = s.post(f"{BASE}/api/grn/{test2_pid}", json={
    "engagement_id": test2_eng,
    "description":   "TRAVERSAL ATTACK — this should be blocked",
    "delivery_date": "2026-04-20",
    "quantity_received": 5,
    "unit_rate": 1000
  })
  rec(role, f"/grn/{test2_pid}", "POST", r.status_code, should_block=True)
  mark = '✓' if r.status_code in (403,404) else ('LEAK' if r.status_code in (200,201) else 'OK-other')
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}  {r.text[:60] if r.status_code >= 400 else ''}")

print("\n─" * 70)
print("ATTACK 4: scoped user POSTs payment-request on TEST2")
print("─" * 70)
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: continue
  r = s.post(f"{BASE}/api/payment-requests/{test2_pid}", json={
    "engagement_id": test2_eng,
    "amount_requested": 999999,
    "payment_type":   "material_advance",
    "reason":         "TRAVERSAL ATTACK — this should be blocked",
  })
  rec(role, f"/payment-requests/{test2_pid}", "POST", r.status_code, should_block=True)
  mark = '✓' if r.status_code in (403,404) else ('LEAK' if r.status_code in (200,201) else 'OK-other')
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}")

print("\n─" * 70)
print("ATTACK 5: scoped user PATCHes issue by ID (/api/issues/:id/...)")
print("─" * 70)
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: continue
  # Target TEST2's issue directly by ID
  r = s.patch(f"{BASE}/api/issues/{test2_issue}/resolve", json={"resolution_note":"Traversal test — should block"})
  rec(role, f"/issues/{test2_issue}/resolve", "PATCH", r.status_code, should_block=True)
  mark = '✓' if r.status_code in (403,404,400) else ('LEAK' if r.status_code in (200,201) else '?')
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}")

print("\n─" * 70)
print("ATTACK 6: scoped user POSTs drawing approve by version ID")
print("─" * 70)
for role in PROJECT_SCOPED_ROLES:
  s = login(role)
  if not s: continue
  r = s.post(f"{BASE}/api/drawings/version/{test2_drawing_v}/approve")
  rec(role, f"/drawings/version/{test2_drawing_v}/approve", "POST", r.status_code, should_block=True)
  mark = '✓' if r.status_code in (403,404) else ('LEAK' if r.status_code in (200,201) else '?')
  print(f"  {mark:>4s}  {role:22s} → {r.status_code}")

# ─────────────── Summary ───────────────
print("\n" + "=" * 70)
leaks = [r for r in results if not r[0]]
total = len(results)
print(f"L4a RESULT: {total - len(leaks)}/{total} attacks correctly blocked, {len(leaks)} LEAKS")
if leaks:
  print("\n🚨 SECURITY LEAKS (need IMMEDIATE fix before prod):")
  for ok, role, path, status, note in leaks:
    print(f"  {role:22s}  {path:50s}  code={status}  {note}")
