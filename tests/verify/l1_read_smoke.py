"""
L1 — Read-only smoke.

For each seeded role, log in, fetch /api/auth/me + /api/nav/me, and assert
that the nav has at least one tab. Catches: login broken, nav config
missing for a role, JSON serialization errors on auth/nav/me.

Fast API-only — no browser. Runs in a few seconds.
"""
import requests

BASE = "http://localhost:3100"
ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'finance_admin','senior_site_manager','site_manager','team_lead',
  'jr_architect','services_engineer','coordinator','detailing','trainee',
  'audit','it_admin',
]

pass_count = 0
fail_count = 0
failures = []

for role in ROLES:
  s = requests.Session()
  try:
    r = s.post(f"{BASE}/api/auth/login",
               json={"username": f"test_{role}", "password": "Test1234"},
               timeout=5)
    if r.status_code != 200:
      fail_count += 1
      failures.append(f"{role}: login {r.status_code}")
      continue

    me = s.get(f"{BASE}/api/auth/me", timeout=5)
    if me.status_code != 200:
      fail_count += 1
      failures.append(f"{role}: auth/me {me.status_code}")
      continue

    nav = s.get(f"{BASE}/api/nav/me", timeout=5)
    if nav.status_code != 200:
      fail_count += 1
      failures.append(f"{role}: nav/me {nav.status_code}")
      continue
    nav_body = nav.json()
    tabs = nav_body.get('tabs') or nav_body.get('items') or []
    if not tabs:
      fail_count += 1
      failures.append(f"{role}: empty nav")
      continue

    pass_count += 1
  except Exception as e:
    fail_count += 1
    failures.append(f"{role}: exception {e}")

print(f"L1 RESULT: {pass_count}/{len(ROLES)} pass, {fail_count} fail")
if failures:
  for f in failures:
    print(f"  ✗ {f}")
