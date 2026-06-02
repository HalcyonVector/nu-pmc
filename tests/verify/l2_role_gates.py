"""
L2 — Role write-gate matrix.

For representative write endpoints, verify:
  - Roles that SHOULD be able to write succeed (2xx)
  - Roles that SHOULD NOT be able to write are blocked (4xx, typically 403)

Doesn't test cross-project traversal — that's L4a. Here we only check
that same-project writes respect role boundaries.
"""
import requests
import subprocess

BASE = "http://localhost:3100"

def login(role):
  s = requests.Session()
  r = s.post(f"{BASE}/api/auth/login",
             json={"username": f"test_{role}", "password": "Test1234"},
             timeout=5)
  return s if r.status_code == 200 else None

def db_exec(sql):
  return subprocess.run(
    ['mysql','--socket=/tmp/mysql.sock','-uroot','nu_pmc','-Nse', sql],
    capture_output=True, text=True).stdout.strip()

# Fetch IDs we'll use
pid = int(db_exec("SELECT id FROM projects WHERE code='PV90'"))
pr_pending = int(db_exec(
  f"SELECT id FROM payment_requests WHERE project_id={pid} AND status='pending_pmc' LIMIT 1"
))

# Each test: (role, method, path, body, expected_status_category)
# category: 'write_ok' = should 2xx, 'blocked' = should 4xx.
TESTS = [
  # PR batch-approve at PMC stage
  ('pmc_head',            'POST', f'/api/payment-requests/{pid}/batch-approve',
    {'ids': [pr_pending]}, 'write_ok'),
  ('site_manager',        'POST', f'/api/payment-requests/{pid}/batch-approve',
    {'ids': [pr_pending]}, 'blocked'),
  ('finance_admin',       'POST', f'/api/payment-requests/{pid}/batch-approve',
    {'ids': [pr_pending]}, 'blocked'),
  ('jr_architect',        'POST', f'/api/payment-requests/{pid}/batch-approve',
    {'ids': [pr_pending]}, 'blocked'),

  # Audit is read-only — blocked on any write
  ('audit',               'POST', f'/api/payment-requests/{pid}/batch-approve',
    {'ids': [pr_pending]}, 'blocked'),

  # IT Admin propose nav change for a non-self role
  ('it_admin',            'POST', '/api/nav-admin/propose',
    {'role': 'trainee', 'items': [{'bucket':'home','tab_key':'dashboard','sort_order':1}],
     'note':'L2 test'}, 'write_ok'),
  # IT Admin propose for SELF — blocked by Sprint 4 Item 2 guard
  ('it_admin',            'POST', '/api/nav-admin/propose',
    {'role': 'it_admin', 'items': [{'bucket':'home','tab_key':'dashboard','sort_order':1}],
     'note':'self-lockout test'}, 'blocked'),
]

pass_count = 0
fail_count = 0
failures = []

for role, method, path, body, expected in TESTS:
  s = login(role)
  if not s:
    fail_count += 1
    failures.append(f"[{role}] cannot log in")
    continue
  r = s.request(method, f"{BASE}{path}", json=body, timeout=5)
  is_write_ok = r.status_code in (200, 201)
  is_blocked = r.status_code in (400, 403, 409, 422)

  if expected == 'write_ok' and is_write_ok:
    pass_count += 1
  elif expected == 'blocked' and is_blocked:
    pass_count += 1
  else:
    fail_count += 1
    failures.append(f"[{role}] {method} {path} expected={expected} got={r.status_code}")

print(f"L2 RESULT: {pass_count}/{len(TESTS)} pass, {fail_count} fail")
if failures:
  for f in failures:
    print(f"  ✗ {f}")
