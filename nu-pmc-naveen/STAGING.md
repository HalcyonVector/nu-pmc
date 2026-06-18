# nu PMC v4 — Staging Deploy Guide

One-command deploy and verification for the NU Associates staging server.

---

## What you're deploying

nu PMC v4 — Express + MariaDB app with PWA frontend. All code lives in the tarball. No external services needed besides MariaDB, Node 18+, and disk for file uploads.

---

## Prerequisites (one-time setup)

On the staging box:

```bash
# 1. MariaDB 10.11+ running, socket at /var/run/mysqld/mysqld.sock
sudo systemctl status mariadb

# 2. Node 18+ (check with: node -v)
# 3. App user — create if not present
sudo useradd -m -s /bin/bash nuapp || true

# 4. DB user + empty database
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS nu_pmc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'nu_app'@'localhost' IDENTIFIED BY 'CHANGE-ME-STRONG-PASSWORD';
GRANT ALL PRIVILEGES ON nu_pmc.* TO 'nu_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

---

## Deploy the tarball

```bash
# Unpack
tar -xzf nu-pmc-v4.tar.gz -C /opt/
sudo chown -R nuapp:nuapp /opt/nu-pmc

# Install node deps
cd /opt/nu-pmc
sudo -u nuapp npm install --production

# Environment file — copy and edit
cp .env.example .env
# Edit .env with real values:
#   DB_PASSWORD=<the strong password you set above>
#   SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
#   NODE_ENV=staging
#   PORT=3100
```

---

## Seed the database

```bash
cd /opt/nu-pmc
# Point seed-full.sh at staging DB
export DB_SOCKET=/var/run/mysqld/mysqld.sock
export DB_USER=nu_app
export DB_PASS='<the strong password>'
export DB_NAME=nu_pmc

bash scripts/seed-full.sh
```

**Expected output:**
```
✓ DB reachable
✓ database nu_pmc ensured
✓ schema already present OR migrations applied cleanly
✓ users: 37
━━━ seed complete — counts ━━━
projects        2
users          37
assignments    21
vendors         2
engagements     2
payment_requests 7
issues          7
drawings       13
drawing_versions 13
grns            3
daily_reports   4
change_notices  1
audit_log       0
```

**This seed is idempotent.** You can safely re-run it; it deletes + reinserts the PV90/TEST2 seeded data by unique markers. It does NOT touch any non-seeded data (real production projects, users, etc.).

---

## Start the server

Via systemd (recommended):

```bash
# /etc/systemd/system/nu-pmc.service
[Unit]
Description=nu PMC v4
After=mariadb.service

[Service]
Type=simple
User=nuapp
WorkingDirectory=/opt/nu-pmc
EnvironmentFile=/opt/nu-pmc/.env
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nu-pmc
sudo systemctl status nu-pmc
```

Or one-shot for testing:

```bash
cd /opt/nu-pmc && sudo -u nuapp node server.js
```

---

## Verify

One command proves the box is healthy:

```bash
cd /opt/nu-pmc
bash scripts/verify.sh
```

**Expected output:**
```
✓ MariaDB up
✓ seed OK
✓ node up on 3100
━━━ running tests ━━━
  l1_read_smoke                 ✓
  l2_role_gates                 ✓
  l3a_illegal                   ✓
  l3b_audit                     ✓
  l3c_invariants                ✓
  l4a_traversal                 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY SUMMARY: 6 pass, 0 fail
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Exit code = number of failing suites. Zero means all green.

If any suite fails, see the suite's individual output by running it directly:
```bash
python3 tests/verify/l4a_traversal.py
```

---

## What each L-level test proves

| Suite | Covers |
|---|---|
| **l1_read_smoke** | Every role can log in, /auth/me works, /nav/me returns ≥1 tab. Catches login breakage, missing nav config for a role. |
| **l2_role_gates** | Role write-gate matrix: PMC can approve PRs, site manager can't. Finance admin can't approve at PMC stage. Audit can't write. IT Admin can't edit own role (Sprint 4 Item 2 guard). |
| **l3a_illegal** | Illegal state transitions are rejected: GRN approve on rejected state, issue resolve on closed state, drawing approve on superseded. |
| **l3b_audit** | Every audited state transition writes an audit_log row with correct actor + verb + from/to. |
| **l3c_invariants** | Cross-entity invariants hold: PR against inactive vendor engagement is rejected, GRN against unapproved engagement is rejected, PR overrun blocked. |
| **l4a_traversal** | Cross-project authorization: site_manager assigned only to PV90 cannot act on TEST2 via URL tampering. 48 attacks, 0 leaks expected. |

---

## Field testing

After `verify.sh` shows all green, the app is **code-safe** to stage.

Next step: real-device field testing per `FIELD_TEST_CHECKLIST.md` (also in this tarball). Anjaneya / Murugesan / Rajani walk through the checklist on their actual work phones, document any UX issues that sandboxed tests can't catch (daylight visibility, gloved taps, offline behaviour, etc.).

Do NOT cut over real users until:
1. `verify.sh` shows 6/6 pass on staging
2. At least two field testers have walked their role-specific checklist
3. All field-surfaced issues classified as either "fix before prod" or "post-prod polish"

---

## Rollback

If staging goes wrong:

```bash
sudo systemctl stop nu-pmc

# Reset the DB to a clean re-seed
mysql -u nu_app -p nu_pmc <<SQL
-- Drop seeded data only (not production); or drop+recreate DB if this is pure staging
DROP DATABASE nu_pmc; CREATE DATABASE nu_pmc;
SQL

# Re-apply migrations + seed
bash scripts/seed-full.sh
sudo systemctl start nu-pmc
```

---

## Known sandbox caveats (Claude's staging notes)

The verify suite and seed were developed in an ephemeral gVisor sandbox where MariaDB was torn down every few minutes by the orchestrator. This means:

- `seed-full.sh` was verified 3 consecutive clean runs in sandbox
- Individual test suites (l3a, l3c, l4a) were verified end-to-end earlier in development
- `verify.sh` as an integrated cold→green run was NOT proven in sandbox due to the DB lifetime issue
- Expect the first staging run to possibly surface 1–2 additional issues that the sandbox couldn't catch

If a test suite fails on first staging run, debug it directly — most likely cause is a schema detail not captured by this seed (the seed script was corrected 3 times during development as it hit column/enum mismatches that weren't visible until the seed actually ran).
