# nu PMC Phase 2-6 — Resume Brief
# Last updated: 2026-04-25 02:00 UTC

## State at this checkpoint

### Phases — completion status

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — SQL correctness sieve | ✓ CLOSED CLEAN | 34 bugs fixed, 60/60 live-DB checks pass |
| Phase 2a — Endpoint behavior (positive path) | ✓ CLOSED CLEAN | 322/322 tests pass, 8 bugs fixed |
| Phase 2a-FULL — Read matrix (127 GETs × 17 roles) | ✓ CLOSED CLEAN | 0 findings after audit-carve-out fix |
| Phase 2b-FULL — Write matrix (208 writes × 17 roles) | **PARTIAL (auth module green)** | 5 bugs fixed, infra hardened, 7 modules pending |
| Phase 3 — Role/gate audit | Largely covered by 2a/2b-full | Final consolidation pending |
| Phase 4 — GUI link correctness | Not started | |
| Phase 5 — Edge cases with user | Not started | |
| Phase 6 — CI harness packaging | Not started | |

### Cumulative bug count: **49 fixed**

| # | Where | Class |
|---|---|---|
| 1-34 | Phase 1 SQL sieve | column/table mismatches, alias bugs |
| 35-42 | Phase 2a positive path | inner-vs-outer gate, alias mismatches |
| 43 | finance/advance-recovery POST | missing body validation, 500 on null |
| 44 | reporting/draft POST | missing body validation, 500 |
| 45 | reporting/mom-items POST | items not iterable, 500 |
| 46 | trainee-guard.js | path prefixes wrong (mounted /api but checked /api/); guard was effectively no-op in V4 |
| 47 | onboarding/vendors.js POST /master | requirePermission action mismatch ('vendors.create' vs seeded 'admin.vendor.create') |
| 48 | onboarding/vendors.js validate-pan | role string 'finance' (invalid) instead of 'finance_admin'; finance_admin couldn't validate PANs |
| 49 | migrations/v4.5-resilience-tables.sql | DELIMITER + CREATE PROCEDURE pattern silently no-ops in stdin-piped mysql clients; rewritten with plain DDL + CREATE TABLE IF NOT EXISTS |

### Tools built and stable

- `/home/claude/work/tools/extract-route-gates.js` — AST extractor for declared role gates per route. Handles requireRole, predicate middlewares, MemberExpression imports, per-route inner-narrows overrides, and trainee-guard simulation post-mount.
- `/home/claude/work/tools/matrix-runner.js` — In-process HTTP matrix runner using X-Test-User-Id header auth (no cookie-login needed). Classifies each (route, role) result as TRUE-POS / TRUE-NEG / FALSE-POS / FALSE-NEG / ERROR-500 / INCONCLUSIVE-404 / INCONCLUSIVE-BODY / UNAUTH.
- `/home/claude/work/tools/run-matrix-harness.sh` — Bootstrap shell. Brings up mysqld with tuned flags (innodb-buffer-pool 64M, skip-name-resolve, skip-log-bin, flush=0), loads schema + migrations + fixture, boots app, runs matrix.
- `/home/claude/work/tools/harness-fixture.sql` — 17 test users (1 per role) + 3 projects + sacrificial id=9099 rows for users/vendors/engagements/snags/issues/payment_requests.

### Per-route allowed-roles overrides in extractor

Documented inner-narrowing routes where declared gate is broader than actual handler role check (these are NOT bugs, they're intentional):

- `GET /api/user-management/pending` — principal+design_principal+audit
- `POST /api/user-management/initiate` — principal+design_principal
- `PATCH /api/users/:id/deactivate` — principal+design_principal
- `PATCH /api/users/:id/deputy` — principal+design_principal
- `POST /api/admin-reset/reset/:userId` — principal+design_principal
- `POST /api/admin-reset/send-wa/:userId` — principal+design_principal
- `POST /api/users/bulk-upload` — principal+design_principal+pmc_head
- `POST /api/vendors/master` — 6 roles per admin.vendor.create permission seed
- `PATCH /api/vendors/master/:id/validate-pan` — principal+design_principal+finance_admin (after bug 48 fix)
- `POST /api/daily-reports/:project_id/submit` — site_manager+senior_site_manager
- `POST /api/drawings/version/:version_id/approve` — design stream: 5 roles
- `POST /api/drawings/version/:version_id/reject` — same set
- `POST /api/drawings/version/:version_id/flag` — 5 roles per canFlagDrawing
- `PATCH /api/payment-requests/:id/confirm-payment` — finance_admin+principal+design_principal
- `POST /api/daily-reports/:id/approve` — APPROVER_ROLES (pmc_head+principal+design_principal)
- `POST /api/daily-reports/:project_id/batch-approve` — APPROVER_ROLES
- `POST /api/daily-reports/:id/flag` — APPROVER_ROLES
- `POST /api/payments/pre-upload-check` — finance_admin+principal+design_principal
- `PATCH /api/issues/:id/close` — pmc_head+principal+design_principal
- `PATCH /api/issues/:id/reopen` — pmc_head+principal+design_principal

## Resume protocol for next session

### Immediate (single tool call should suffice)
Run auth matrix to confirm bug 49 fix:
```bash
pkill -9 mysqld 2>/dev/null; pkill -9 -f "node server" 2>/dev/null; sleep 1
rm -f /tmp/mysql-nu/mysql.sock /tmp/mysql-nu/mysqld.pid /tmp/mysql-nu/data/aria_log_control
rm -f /home/claude/work/tools/matrix-results.json
MATRIX_MODULES=auth bash /home/claude/work/tools/run-matrix-harness.sh > /home/claude/work/tools/last-run.log 2>&1
```
Expected: 0 ERROR-500 (since wa_send_failures table now creates correctly).

### Then iterate per module, applying same triage discipline:
- system, onboarding, site, design-services, workflow, finance, reporting
- For each FALSE-NEG class: check if real bug or inner-narrowing → either fix code or add per-route override
- For each ERROR-500: triage and fix (likely missing body validation or null guards)
- For each FALSE-POS: real leak — fix immediately

### Then Phases 3-6:
- Phase 3: read all matrix-results.json runs side-by-side and produce role × action coverage table
- Phase 4: extract all `<a href>`/`fetch()`/`router.push()` from frontend, match against routes.json
- Phase 5: present user-driven edge cases — concurrent edits, timezone/IST, NULL handling, deleted-user references
- Phase 6: package as `make verify` target with exit 0 = ship-ready

## Discipline locked in
- "Continue till all phases" — no asking, no pausing, no irritating the user with click-to-continue prompts
- Fix inner-vs-outer gate mismatches automatically (option A pattern)
- Every claim backed by tool output that ran in the same session
- Full-face progress table at the end of each turn

## Final output (when Phase 6 closes)
- Bug ledger
- Coverage ledger
- CI harness packaged
- Flagged-for-review list (semantic questions)
- Known gaps (fixture-dependent INCONCLUSIVEs)
- "V5 ship status" verdict
