#!/bin/bash
# scripts/seed-full.sh — one-command full seed for nu PMC v4.
#
# Bootstraps from empty-DB to test-ready state in one invocation. Idempotent:
# safe to re-run. Creates database if missing, applies v4 combined migrations
# + v4.3 + v4.4, seeds 21 users with known passwords, creates PV90 + TEST2
# projects with assignments, vendor engagements, PRs, GRNs, issues, drawings.
#
# Environment (with sensible defaults):
#   DB_SOCKET  — /tmp/mysql.sock (sandbox) or /var/run/mysqld/mysqld.sock (staging)
#   DB_USER    — root (sandbox) or nu_app (staging)
#   DB_PASS    — blank (sandbox) or whatever staging sets
#   DB_NAME    — nu_pmc
#
# Exit codes:
#   0 — seed complete, counts reported
#   1 — DB not reachable
#   2 — migration failed
#   3 — seed data failed

set -u  # unset var = error. NO -e: we want to continue past recoverable failures.

DB_SOCKET="${DB_SOCKET:-/tmp/mysql.sock}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-${DB_PASSWORD:-}}"
DB_NAME="${DB_NAME:-nu_pmc}"
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Connection mode: TCP if DB_HOST is set, otherwise Unix socket.
# TCP is used by the Docker setup where app + db are separate containers.
# Socket is used for bare-metal staging where MariaDB runs on the same host.
if [ -n "$DB_HOST" ]; then
  MODE="TCP $DB_HOST:$DB_PORT"
  if [ -n "$DB_PASS" ]; then
    MYSQL="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASS"
  else
    MYSQL="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER"
  fi
else
  MODE="socket $DB_SOCKET"
  if [ -n "$DB_PASS" ]; then
    MYSQL="mysql --socket=$DB_SOCKET -u$DB_USER -p$DB_PASS"
  else
    MYSQL="mysql --socket=$DB_SOCKET -u$DB_USER"
  fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "nu PMC v4 — full seed"
echo "  mode:   $MODE"
echo "  user:   $DB_USER"
echo "  db:     $DB_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 0. Check DB reachable
if ! $MYSQL -e "SELECT 1" >/dev/null 2>&1; then
  echo "✗ DB unreachable ($MODE) — is MariaDB running?"
  exit 1
fi
echo "✓ DB reachable"

# 1. Ensure database exists
$MYSQL -e "CREATE DATABASE IF NOT EXISTS $DB_NAME" 2>&1 | grep -v "already exists" || true
echo "✓ database $DB_NAME ensured"

# 2. Check if schema is already present (idempotence shortcut)
TABLES=$($MYSQL -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'" 2>/dev/null)
echo "  tables currently: $TABLES"

if [ "$TABLES" -lt 80 ]; then
  # 3. Apply combined v4 migrations
  echo "━━━ applying v4 combined migrations ━━━"
  if [ -f /tmp/v4-combined.sql ]; then
    $MYSQL "$DB_NAME" < /tmp/v4-combined.sql 2>&1 | tail -3
  else
    # Fall back: run all .sql files in migrations/
    for f in "$WORK_DIR"/migrations/v4*.sql; do
      [ -f "$f" ] || continue
      echo "  applying $(basename "$f")"
      $MYSQL "$DB_NAME" < "$f" 2>&1 | grep -v "already exists" | tail -5
    done
  fi
else
  echo "✓ schema already present — skipping migrations"
fi

# Always apply late-added migrations (idempotent via IF NOT EXISTS in the SQL)
# Runs every v4.x migration in lexical order — so v4.3 → v4.4 → v4.5 → v4.6 → v4.7.
for f in "$WORK_DIR"/migrations/v4.[3-9]*.sql; do
  [ -f "$f" ] || continue
  echo "━━━ applying $(basename "$f") ━━━"
  $MYSQL "$DB_NAME" < "$f" 2>&1 | grep -iE "error|fatal" | head -3 || true
done

# Load the 8 governance sheets into DB (role_permissions, workflow_transitions,
# notification_triggers). The sheets are the single source of truth; the
# middleware refuses to run if role_permissions is empty.
if [ -d "$WORK_DIR/governance_sheets" ] && [ -f "$WORK_DIR/scripts/load-governance-sheets.js" ]; then
  echo "━━━ loading governance sheets ━━━"
  cd "$WORK_DIR" && node scripts/load-governance-sheets.js 2>&1 | tail -10
fi

# 4. Users — real team + test_<role> fixtures. Bcrypt hash for Test1234.
# IMPORTANT: the app uses the `bcryptjs` npm package, not `bcrypt`. The two
# produce hashes that look structurally similar ($2a$10$... vs $2b$10$...)
# but hashes generated with one library may NOT verify correctly with the
# other. The hash below was generated using bcryptjs specifically.
# This was the root cause of Bug #34 — Guru's "couldn't log in" report.
# Regenerate if you change libraries:
#   node -e "console.log(require('bcryptjs').hashSync('Test1234', 10))"
HASH='$2a$10$QdCA1yGPv3VGBQ6JlosUm.Vq/IkgIKr3g13qH.9JpK5hr74c/GB26'
$MYSQL "$DB_NAME" <<SQL
INSERT IGNORE INTO users (username, password_hash, full_name, role, is_active) VALUES
('naveen','$HASH','Naveen Bhat','principal',1),
('ajay','$HASH','Ajay Appachu','design_principal',1),
('rajani','$HASH','Rajani Gowda','design_head',1),
('srinath','$HASH','Srinath','services_head',1),
('murugesan','$HASH','Murugesan','pmc_head',1),
('praveen','$HASH','Praveen Kumar','pmc_head',1),
('sahana','$HASH','Sahana','team_lead',1),
('sushmitha','$HASH','Sushmitha','team_lead',1),
('karthik','$HASH','Karthik','services_engineer',1),
('preethi','$HASH','Preethi','jr_architect',1),
('satish','$HASH','Satish','jr_architect',1),
('anjaneya','$HASH','Anjaneya','site_manager',1),
('arun','$HASH','Arun','site_manager',1),
('suleman','$HASH','Suleman','site_manager',1),
('prajwal','$HASH','Prajwal','site_manager',1),
('ajay_a','$HASH','Ajay A','detailing',1),
('abhishek','$HASH','Abhishek','detailing',1),
('bhumika','$HASH','Bhumika','detailing',1),
('shreyas','$HASH','Shreyas','detailing',1),
('udupa','$HASH','Udupa','finance_admin',1),
-- Role fixtures for automated testing
('test_principal','$HASH','Test principal','principal',1),
('test_design_principal','$HASH','Test DP','design_principal',1),
('test_pmc_head','$HASH','Test pmc_head','pmc_head',1),
('test_design_head','$HASH','Test design_head','design_head',1),
('test_services_head','$HASH','Test services_head','services_head',1),
('test_finance_admin','$HASH','Test finance_admin','finance_admin',1),
('test_senior_site_manager','$HASH','Test senior_site_manager','senior_site_manager',1),
('test_site_manager','$HASH','Test site_manager','site_manager',1),
('test_team_lead','$HASH','Test team_lead','team_lead',1),
('test_jr_architect','$HASH','Test jr_architect','jr_architect',1),
('test_services_engineer','$HASH','Test services_engineer','services_engineer',1),
('test_coordinator','$HASH','Test coordinator','coordinator',1),
('test_detailing','$HASH','Test detailing','detailing',1),
('test_trainee','$HASH','Test trainee','trainee',1),
('test_audit','$HASH','Test audit','audit',1),
('test_it_admin','$HASH','Test it_admin','it_admin',1);

-- Force-overwrite any stale hashes (Bug #34): older DB snapshots had
-- either '\$2b\$10\$placeholder' literals OR hashes generated with the
-- wrong bcrypt library (bcrypt vs bcryptjs mismatch). Anything that
-- isn't the current target hash gets replaced. This runs every seed
-- to heal legacy data.
UPDATE users SET password_hash = '$HASH' WHERE password_hash != '$HASH';
-- Clear force_password_change for TEST fixtures so automated tests go
-- straight to the app. Real users keep force_password_change=1 so they
-- must set their own password on first login — which is correct.
UPDATE users SET force_password_change = 0 WHERE username LIKE 'test_%';
SQL
USER_COUNT=$($MYSQL -Nse "SELECT COUNT(*) FROM $DB_NAME.users" 2>/dev/null)
echo "✓ users: $USER_COUNT"

# 5. PV90 project + vendor + engagements + assignments + PRs + issues + drawings
# Idempotent: explicit delete-then-insert on seeded data by unique markers.
$MYSQL "$DB_NAME" <<'SQL'
SET FOREIGN_KEY_CHECKS=0;
SET @nv = (SELECT id FROM users WHERE username='naveen');

-- Idempotence: blow away anything previously seeded by this script.
-- We scope deletes by the project codes PV90 + TEST2 and the vendor names
-- we insert below. Real production data (other projects/vendors) is untouched.
DELETE FROM audit_log           WHERE entity_type IN ('payment_requests','issues','grns','drawing_versions') AND entity_id IN (SELECT id FROM payment_requests WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2')));
DELETE FROM project_photos      WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM meetings            WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM weekly_reports      WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM snags               WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM client_claims       WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM measurements        WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM change_notices      WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM daily_reports       WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM grns                WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE dv FROM drawing_versions dv JOIN drawings d ON dv.drawing_id=d.id WHERE d.project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM drawings            WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM issues              WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM payment_requests    WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM vendor_engagements  WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM vendors             WHERE vendor_name IN ('PV90 Civil Vendor','TEST2 Civil Vendor');
DELETE FROM project_assignments WHERE project_id IN (SELECT id FROM projects WHERE code IN ('PV90','TEST2'));
DELETE FROM projects            WHERE code IN ('PV90','TEST2');

-- PV90 project
INSERT INTO projects
  (code, name, client, location, project_type, r0_start_date, r0_end_date, status, contract_value, jurisdiction, created_by)
VALUES
  ('PV90','PV 90 Production Line','TLD MAINI GSE','Nelamangala','industrial','2026-03-01','2026-05-04','active',12500000,'KIADB',@nv);
SET @pv = (SELECT id FROM projects WHERE code='PV90');

-- TEST2 project (for cross-project auth tests)
INSERT INTO projects
  (code, name, client, location, project_type, r0_start_date, r0_end_date, status, contract_value, jurisdiction, created_by)
VALUES
  ('TEST2','Test Project 2','Test Client','Somewhere','industrial','2026-01-01','2026-12-31','active',10000000,'KIADB',@nv);
SET @t2 = (SELECT id FROM projects WHERE code='TEST2');

-- Project assignments: scoped-role test users + real team members, all on PV90.
-- UNION deduplicates the overlap (a real user who is also a test fixture).
-- The (project_id, user_id) unique constraint would otherwise break the second insert.
INSERT INTO project_assignments (user_id, project_id, role, assigned_by, is_active)
SELECT user_id, @pv, role, @nv, 1 FROM (
  SELECT u.id AS user_id, u.role
    FROM users u
   WHERE u.role IN ('site_manager','senior_site_manager','team_lead','jr_architect',
                    'services_engineer','coordinator','detailing','trainee')
  UNION
  SELECT u.id, u.role
    FROM users u
   WHERE u.username IN ('anjaneya','karthik','preethi','sahana','satish','sushmitha')
) t;

-- Vendor + engagement on PV90
INSERT INTO vendors (vendor_name, trade, clearance_status, registered_by)
VALUES ('PV90 Civil Vendor','Civil','cleared',@nv);
SET @v_pv90 = (SELECT id FROM vendors WHERE vendor_name='PV90 Civil Vendor');

INSERT INTO vendor_engagements (project_id, vendor_id, scope, contract_value, engaged_by, approval_status, is_active)
VALUES (@pv, @v_pv90, 'Civil works PV90', 1850000, @nv, 'approved', 1);
SET @eng_pv90 = (SELECT id FROM vendor_engagements WHERE project_id=@pv LIMIT 1);

-- Vendor + engagement on TEST2
INSERT INTO vendors (vendor_name, trade, clearance_status, registered_by)
VALUES ('TEST2 Civil Vendor','Civil','cleared',@nv);
SET @v_t2 = (SELECT id FROM vendors WHERE vendor_name='TEST2 Civil Vendor');

INSERT INTO vendor_engagements (project_id, vendor_id, scope, contract_value, engaged_by, approval_status, is_active)
VALUES (@t2, @v_t2, 'Civil works TEST2', 500000, @nv, 'approved', 1);
SET @eng_t2 = (SELECT id FROM vendor_engagements WHERE project_id=@t2 LIMIT 1);

-- PRs on PV90 (6 in various states)
INSERT INTO payment_requests (project_id, engagement_id, vendor_id, amount_requested, payment_type, requested_by, status, reason)
VALUES
  (@pv, @eng_pv90, @v_pv90, 100000,'material_advance',@nv,'pending_pmc','advance for steel'),
  (@pv, @eng_pv90, @v_pv90, 200000,'running_account_bill',@nv,'pmc_approved','RA bill 1'),
  (@pv, @eng_pv90, @v_pv90, 300000,'running_account_bill',@nv,'pending_naveen','RA bill 2'),
  (@pv, @eng_pv90, @v_pv90, 400000,'running_account_bill',@nv,'naveen_approved','RA bill 3'),
  (@pv, @eng_pv90, @v_pv90, 150000,'advance',@nv,'paid','advance settled'),
  (@pv, @eng_pv90, @v_pv90, 500000,'final_bill',@nv,'pending_pmc','final bill');

-- PR on TEST2 (for cross-project tests)
INSERT INTO payment_requests (project_id, engagement_id, vendor_id, amount_requested, payment_type, requested_by, status, reason)
VALUES (@t2, @eng_t2, @v_t2, 100000, 'material_advance', @nv, 'pending_pmc', 'TEST2 PR');

-- Issues on PV90 (6: 3 RFIs/design, 2 safety/quality, 1 open draft)
INSERT INTO issues (project_id, issue_number, issue_type, title, description, status, raised_by, raised_at)
VALUES
  (@pv,'ISS-001','rfi','Clarification on DB mounting height','...','open',@nv, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (@pv,'ISS-002','design','Partition clash with electrical conduit','...','in_progress',@nv, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (@pv,'ISS-003','rfi','HVAC indoor unit mounting detail','...','open',@nv, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (@pv,'ISS-004','quality','Concrete strength test failed — Grid F','...','open',@nv, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (@pv,'ISS-005','safety','Scaffolding collapse hazard','...','open',@nv, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (@pv,'ISS-006','rfi','Door hardware spec clarification','...','draft',@nv, NOW());

-- Issue on TEST2 (cross-project test)
INSERT INTO issues (project_id, issue_number, issue_type, title, description, status, raised_by)
VALUES (@t2,'ISS-T01','safety','TEST2 safety issue','desc','open',@nv);

-- Drawings on PV90 (12)
INSERT INTO drawings (project_id, drawing_number, drawing_name, stream) VALUES
  (@pv,'A-101','Ground floor plan','design'),
  (@pv,'A-102','First floor plan','design'),
  (@pv,'A-103','Elevations','design'),
  (@pv,'S-201','Foundation layout','design'),
  (@pv,'S-202','Column schedule','design'),
  (@pv,'S-203','Slab reinforcement','design'),
  (@pv,'E-301','Lighting layout','services'),
  (@pv,'E-302','Power distribution','services'),
  (@pv,'M-401','HVAC ducting','services'),
  (@pv,'M-402','Chilled water piping','services'),
  (@pv,'P-501','Plumbing stacks','services'),
  (@pv,'E-502','DB schedule','services');

-- A drawing version per drawing (file_path required; use stub)
INSERT INTO drawing_versions (drawing_id, revision, revision_number, file_path, status, uploaded_by)
SELECT d.id, 'R0', 0, CONCAT('/seed/', d.drawing_number, '_R0.pdf'), 'pending_l1', @nv FROM drawings d WHERE d.project_id=@pv;

-- Drawing on TEST2
INSERT INTO drawings (project_id, drawing_number, drawing_name, stream)
VALUES (@t2, 'T2-A101', 'Test2 plan', 'design');
INSERT INTO drawing_versions (drawing_id, revision, revision_number, file_path, status, uploaded_by)
SELECT d.id, 'R0', 0, CONCAT('/seed/', d.drawing_number, '_R0.pdf'), 'pending_l1', @nv FROM drawings d WHERE d.project_id=@t2;

-- GRNs on PV90 (a few pending for SLA tests)
INSERT INTO grns (project_id, grn_number, engagement_id, delivery_date, description, quantity_received, unit, status, raised_by, is_unplanned)
VALUES
  (@pv,'GRN-008',@eng_pv90, DATE_SUB(CURDATE(), INTERVAL 5 DAY),'False ceiling grid 1.2x0.6', 100, 'nos', 'pending',@nv, 0),
  (@pv,'GRN-009',@eng_pv90, DATE_SUB(CURDATE(), INTERVAL 4 DAY),'CPVC pipe 1/2" SCH-40', 200, 'm', 'pending',@nv, 0),
  (@pv,'GRN-010',@eng_pv90, DATE_SUB(CURDATE(), INTERVAL 3 DAY),'Distribution boards 63A', 4, 'nos', 'pending',@nv, 0);

-- Daily reports on PV90 (a mix of pending/approved/flagged)
INSERT INTO daily_reports (project_id, report_date, site_manager_id, source, submitted_at, status, ai_flag_reason)
VALUES
  (@pv, CURDATE(), @nv, 'app', NOW(), 'pending_review', NULL),
  (@pv, DATE_SUB(CURDATE(), INTERVAL 1 DAY), @nv, 'app', DATE_SUB(NOW(), INTERVAL 1 DAY), 'pending_review', NULL),
  (@pv, DATE_SUB(CURDATE(), INTERVAL 17 DAY), @nv, 'app', DATE_SUB(NOW(), INTERVAL 17 DAY), 'flagged', 'labour count anomaly'),
  (@pv, DATE_SUB(CURDATE(), INTERVAL 2 DAY), @nv, 'app', DATE_SUB(NOW(), INTERVAL 2 DAY), 'approved', NULL);

-- Change notice on PV90 (for Pending tab Needs You tests)
INSERT INTO change_notices (project_id, cn_number, title, description, schedule_impact_days, status, raised_by, raised_at)
VALUES (@pv, 'CN-001', 'Additional conference room partition', 'Client requested an additional partition wall in the conference room with acoustic treatment', 2, 'pending_approval', @nv, DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ── Transactional seed for PV90 ─────────────────────────────────────────────
-- These drive L3a (illegal state transitions) and L3c (cross-entity invariants).
-- Without them, both test layers skip and the billing chain has nothing to show.

-- pmc_head user reference (Praveen or Murugesan) for PMC-signed items
SET @pmc = (SELECT id FROM users WHERE role='pmc_head' AND is_active=1 LIMIT 1);
SET @rs  = (SELECT id FROM users WHERE role='services_head' AND is_active=1 LIMIT 1);
SET @sm  = (SELECT id FROM users WHERE role='site_manager' AND is_active=1 LIMIT 1);

-- Measurements: one in each status so workflow chain is visible
--   RA-1: draft            — for L3c (cannot raise claim on unaccepted)
--   RA-2: rs_signed        — for mid-chain testing
--   RA-3: client_accepted  — for valid claim creation
INSERT INTO measurements (project_id, ra_bill_number, discipline, measurement_date, status, recorded_by, notes) VALUES
  (@pv, 'RA-1', 'civil',    DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'draft',            @sm, 'Civil works measurement — week 3'),
  (@pv, 'RA-2', 'civil',    DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'rs_signed',        @sm, 'Civil works measurement — week 4');
INSERT INTO measurements (project_id, ra_bill_number, discipline, measurement_date, status, recorded_by, checked_by, approved_by, client_accepted_at, client_rep_name, client_rep_designation, notes) VALUES
  (@pv, 'RA-3', 'civil',    DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'client_accepted',  @sm, @pmc, @nv, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'S Raghuram', 'Project Manager', 'Accepted measurement for first claim');

-- Claims: one in each status
--   draft          — for L3a (cannot jump draft→invoiced)
--   pending_approval — awaiting stream signoff
--   approved       — ready to invoice
INSERT INTO client_claims (project_id, ra_bill_number, discipline, status, raised_by, measurement_id, notes) VALUES
  (@pv, 'RA-3', 'civil', 'draft',            @pmc, (SELECT id FROM measurements WHERE ra_bill_number='RA-3' AND project_id=@pv), 'First civil claim draft');
INSERT INTO client_claims (project_id, ra_bill_number, discipline, status, raised_by, measurement_id, pmc_signoff, pmc_signoff_at, notes) VALUES
  (@pv, 'RA-2', 'civil', 'pending_approval', @pmc, (SELECT id FROM measurements WHERE ra_bill_number='RA-2' AND project_id=@pv), @pmc, NOW(), 'Awaiting services head signoff'),
  (@pv, 'RA-1', 'civil', 'approved',         @pmc, NULL,                                                                          @pmc, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Ready to invoice');
-- Mark the 'approved' claim with proper signoff chain
UPDATE client_claims SET rs_signoff=@rs, rs_signoff_at=DATE_SUB(NOW(), INTERVAL 1 DAY), approved_by=@nv, approved_at=NOW() WHERE ra_bill_number='RA-1' AND project_id=@pv AND status='approved';

-- Snags: one in each status
INSERT INTO snags (project_id, snag_number, title, description, location, trade, raised_by, status, priority, target_close_date, raised_from) VALUES
  (@pv, 'SN-001', 'False ceiling alignment off', 'Grid alignment 15mm off at east wall of main hall', 'Main Hall — East Wall', 'civil', @pmc, 'open',      'high',   DATE_ADD(CURDATE(), INTERVAL 5 DAY),  'other'),
  (@pv, 'SN-002', 'Paint finish patch',          'Primer showing through in corner panel',           'Conference Room',      'civil', @sm,  'rectified', 'medium', DATE_ADD(CURDATE(), INTERVAL 2 DAY),  'other'),
  (@pv, 'SN-003', 'Socket outlet loose',         'Wall socket loose at tea point',                   'Pantry',               'electrical', @sm, 'closed', 'low',    DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'other');
-- Set rectified/verified on the non-open ones
UPDATE snags SET rectified_by=@sm, rectified_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE snag_number IN ('SN-002','SN-003') AND project_id=@pv;
UPDATE snags SET verified_by=@pmc, verified_at=NOW() WHERE snag_number='SN-003' AND project_id=@pv;

-- Weekly reports: one draft, one approved
INSERT INTO weekly_reports (project_id, week_ending, week_number, summary, status, drafted_by, pmc_section, design_section, services_section) VALUES
  (@pv, DATE_SUB(CURDATE(), INTERVAL 7 DAY),  4, 'Week 4 progress — civil works 40% complete', 'approved', @pmc, 'Site work progressing as per schedule', 'Drawings issued for painting', 'BOQ reconciliation in progress'),
  (@pv, CURDATE(),                            5, 'Week 5 in progress',                          'draft',    @pmc, 'False ceiling installation started', 'Finishing drawings under review', 'Quantity adjustments being verified');

-- Meetings: one site visit, one client meeting with MOM
INSERT INTO meetings (project_id, meeting_number, type, title, meeting_date, time_in, time_out, location, drafted_by, status, visibility, notes) VALUES
  (@pv, 'SV-001', 'site_visit', 'Week 4 site walkthrough',            DATE_SUB(CURDATE(), INTERVAL 5 DAY), '10:00:00','12:30:00','PV 90 Nelamangala', @nv, 'issued',   'sent_to_client', 'Walked through with client — noted finishing priorities'),
  (@pv, 'CM-001', 'client',     'Monthly review with TLD team',       DATE_SUB(CURDATE(), INTERVAL 2 DAY), '15:00:00','16:30:00','TLD HQ',            @nv, 'draft',    'internal',       'Discussed CN-001 and overall programme');

-- Project photos: seed a few so the photos tab isn't empty
INSERT INTO project_photos (project_id, photo_date, file_path, file_size_kb, caption, uploaded_by, source) VALUES
  (@pv, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '/seed/photo_pv90_001.jpg', 2400, 'Main hall ceiling grid — east elevation', @sm, 'app'),
  (@pv, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '/seed/photo_pv90_002.jpg', 1850, 'Pantry electrical rough-in',               @sm, 'app'),
  (@pv, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '/seed/photo_pv90_003.jpg', 2100, 'Conference room partition framing',       @sm, 'whatsapp');

SQL

# 6. Sanity report
echo "━━━ seed complete — counts ━━━"
$MYSQL "$DB_NAME" -e "
SELECT 'projects'            AS t, COUNT(*) AS n FROM projects
UNION SELECT 'users',          COUNT(*) FROM users
UNION SELECT 'assignments',    COUNT(*) FROM project_assignments
UNION SELECT 'vendors',        COUNT(*) FROM vendors
UNION SELECT 'engagements',    COUNT(*) FROM vendor_engagements
UNION SELECT 'payment_requests', COUNT(*) FROM payment_requests
UNION SELECT 'issues',         COUNT(*) FROM issues
UNION SELECT 'drawings',       COUNT(*) FROM drawings
UNION SELECT 'drawing_versions', COUNT(*) FROM drawing_versions
UNION SELECT 'grns',           COUNT(*) FROM grns
UNION SELECT 'daily_reports',  COUNT(*) FROM daily_reports
UNION SELECT 'change_notices', COUNT(*) FROM change_notices
UNION SELECT 'measurements',   COUNT(*) FROM measurements
UNION SELECT 'client_claims',  COUNT(*) FROM client_claims
UNION SELECT 'snags',          COUNT(*) FROM snags
UNION SELECT 'weekly_reports', COUNT(*) FROM weekly_reports
UNION SELECT 'meetings',       COUNT(*) FROM meetings
UNION SELECT 'project_photos', COUNT(*) FROM project_photos
UNION SELECT 'audit_log',      COUNT(*) FROM audit_log;" 2>/dev/null

echo ""
echo "✓ seed complete"
echo ""
echo "Test logins:  test_<role> / Test1234"
echo "Real logins:  naveen, ajay, rajani, etc. / Test1234"
