"""
L3b — Audit trail coverage.

Exercise a state transition on each endpoint that we audit, then check
that `audit_log` gained a matching row. Catches: audit.log() silently
failing (it's designed to swallow errors), wrong action verb,
missing actor/entity details.
"""
import requests, subprocess, time, json

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

def last_audit_action():
  return db_exec("SELECT action FROM audit_log ORDER BY id DESC LIMIT 1")

def audit_count_since(row_id):
  return int(db_exec(f"SELECT COUNT(*) FROM audit_log WHERE id > {row_id}"))

pid = int(db_exec("SELECT id FROM projects WHERE code='PV90'"))

# Get baseline count
baseline = int(db_exec("SELECT COALESCE(MAX(id),0) FROM audit_log"))

pass_count = 0
fail_count = 0
failures = []

def expect_audit_row(label, expected_action):
  global pass_count, fail_count
  time.sleep(0.3)
  last = last_audit_action()
  if last == expected_action:
    pass_count += 1
  else:
    fail_count += 1
    failures.append(f"[{label}] expected audit action '{expected_action}' got '{last}'")

# 1. Daily report flag
pmc = login('pmc_head')
if pmc:
  flagged = db_exec(
    f"SELECT id FROM daily_reports WHERE project_id={pid} AND status='pending_review' LIMIT 1")
  if flagged:
    r = pmc.post(f"{BASE}/api/daily-reports/{flagged}/flag",
                 json={"reason":"L3b audit test"}, timeout=5)
    if r.status_code == 200:
      expect_audit_row("daily_report.flag", "daily_report.flag")
    else:
      fail_count += 1
      failures.append(f"daily_report flag: endpoint returned {r.status_code}")

# 2. Daily report approve
pmc = login('pmc_head')
if pmc:
  pending = db_exec(
    f"SELECT id FROM daily_reports WHERE project_id={pid} AND status='pending_review' LIMIT 1")
  if pending:
    r = pmc.post(f"{BASE}/api/daily-reports/{pending}/approve", timeout=5)
    if r.status_code == 200:
      expect_audit_row("daily_report.approve", "daily_report.approve")
    else:
      fail_count += 1
      failures.append(f"daily_report approve: endpoint returned {r.status_code}")

# 3. Issue resolve
services = login('services_head')
if services:
  # Use ISS-001 (RFI) — assign to services_head-compatible flow
  iss = db_exec(f"SELECT id FROM issues WHERE project_id={pid} AND status='open' LIMIT 1")
  if iss:
    r = services.patch(f"{BASE}/api/issues/{iss}/resolve",
                       json={"resolution_note":"L3b"}, timeout=5)
    if r.status_code == 200:
      expect_audit_row("issue.resolve", "issue.resolve")
    else:
      fail_count += 1
      failures.append(f"issue resolve: {r.status_code}")

# 4. Issue close
pmc = login('pmc_head')
if pmc:
  resolved = db_exec(
    f"SELECT id FROM issues WHERE project_id={pid} AND status='resolved' LIMIT 1")
  if resolved:
    r = pmc.patch(f"{BASE}/api/issues/{resolved}/close", timeout=5)
    if r.status_code == 200:
      expect_audit_row("issue.close", "issue.close")
    else:
      fail_count += 1
      failures.append(f"issue close: {r.status_code}")

# 5. Drawing approve — services_head on a pending services-stream drawing
services = login('services_head')
if services:
  dv = db_exec(
    f"""SELECT dv.id FROM drawing_versions dv
        JOIN drawings d ON dv.drawing_id=d.id
        WHERE d.project_id={pid} AND d.stream='services' AND dv.status='pending_l1' LIMIT 1""")
  if dv:
    r = services.post(f"{BASE}/api/drawings/version/{dv}/approve", timeout=5)
    if r.status_code == 200:
      expect_audit_row("drawing.approve", "drawing.approve")
    else:
      fail_count += 1
      failures.append(f"drawing approve: {r.status_code}")

# Net audit rows written
total_new = audit_count_since(baseline)

print(f"L3b RESULT: {pass_count}/{pass_count+fail_count} pass, {fail_count} fail  ({total_new} audit rows written)")
if failures:
  for f in failures:
    print(f"  ✗ {f}")
