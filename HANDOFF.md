# nu PMC v4 — Handoff Document

**Last updated:** 2026-04-22
**Prior version:** `HANDOFF_2026-04-20.md` (preserved in repo)

> ⚠️ **This document covers the pre-Matrix v4 baseline only.**
> For current session context start with these files in order:
> 1. `CLAUDE_WORKING_STRATEGY.md` — working rules, two brief overrides, phase state
> 2. `SUBSTRATE-CONTRACT.md` — frozen Matrix substrate contract with file+line citations
> 3. `START-HERE.md` — fresh install instructions (single install SQL through v5.41)
>
> The architectural invariants in sections 2–4 below remain accurate.
> Sections 7–11 describe the v4 layout; the v5 module structure is in `modules/`.

---

## 1. What this app is

`nu PMC` is a Project Management Console built for **NU Associates LLP** (Bengaluru,
architecture + engineering + PMC). It runs as a Progressive Web App backed by an
Express + MariaDB server.

- **15 roles** — principal, design_principal, pmc_head, design_head, services_head,
  team_lead, jr_architect, detailing, site_manager, senior_site_manager,
  finance_admin, coordinator, trainee, audit, it_admin
- **324 routes** across 56 route files
- **91 DB tables** + governance tables added in v4.6
- **One active site:** PV 90 Production Line (TLD MAINI GSE, Nelamangala),
  23 Mar–25 May 2026

---

## 2. Current architectural invariants (DO NOT BREAK)

### 2.1 Permissions — single boss, DB-driven

`middleware/permissions.js` reads from the `role_permissions` DB table. There is
**no hardcoded fallback**. If the table is empty or unreachable, `requirePermission()`
returns 503 `PERMISSIONS_UNAVAILABLE`. If an action isn't in the table,
`requirePermission()` returns 403.

The table is populated from `governance_sheets/01_Role_Permission_Matrix.xlsx`
via `scripts/load-governance-sheets.js` (run automatically by `seed-full.sh`).
Principal can re-upload a modified sheet via `POST /api/governance/upload`.

**Single source of truth principle:** there is exactly one place where a permission
is defined — the sheet. No code-level constants. No legacy PERMISSIONS object.
Divergence is structurally impossible.

### 2.2 The 8 governance sheets

| # | Sheet | Drives | DB table |
|---|---|---|---|
| 01 | Role Permission Matrix | Who can do what | `role_permissions` |
| 02 | Workflow Status Transitions | Legal state changes per object | `workflow_transitions` |
| 03 | Notification Trigger Map | Who gets WA/email for what event | `notification_triggers` |
| 04 | SLA & Escalation Table | Days before escalation | `project_slas` (defaults) |
| 05 | Document Visibility Map | Which tabs each role sees | `role_nav` (reference) |
| 06 | Audit Event Registry | Actions written to audit_log | reference only |
| 07 | Sequence Number Registry | Prefix/pad/scope per entity | reference only |
| 08 | Open Permission Gaps | Scanner-flagged ungated routes | reference only |

Sheets 1–3 are live; 4–8 are reference documentation.

### 2.3 Role gates vs permission checks

Two distinct gate mechanisms exist and serve different purposes:

- **`requireRole(...)`** — structural gates based on role membership. Used for
  broad categorical access (e.g. "this route is for PMC + Principal only").
  Lives in `middleware/auth.js`. Unchanged by DB permissions.
- **`requirePermission('action.key')`** — business-rule gates based on the DB
  permissions matrix. Used when the answer depends on a line in the sheet.

Both are used. Don't replace one with the other without understanding why.

### 2.4 Audit role

Audit role bypasses all role gates for GET requests only (per `isAuditGet()` in
`middleware/auth.js`). Writes are blocked globally at the API middleware level
(`blockAuditWrites`). This is by design — audit is a read-only observer.

### 2.5 Trainee guard

`middleware/trainee-guard.js` explicitly allow-lists the API paths trainees can
write to: `/api/reports`, `/api/photos`, `/api/issues`, `/api/auth`, `/api/lessons`,
plus the two specific site-visit endpoints under `/api/meetings`
(`POST /api/meetings/:project_id/site-visit` and `POST /api/meetings/:meeting_id/observation`).
Anything else returns 403. The governance sheet
must agree with this list — edits to one without the other create drift.

(V5 changes: `/api/visits` and `/api/queries` were folded into `/api/issues`
and the meetings module respectively.)

### 2.6 Password reset

Uses `managed_by` foreign key, not role. Principal and IT Admin can reset anyone.
Every other role can only reset users where `users.managed_by = caller.id`.
Fixed this session — see `routes/admin-reset.js`.

---

## 3. Test hierarchy (L1–L5)

Established in `HANDOFF_2026-04-20.md`. All still apply.

| Level | Description | Status as of 2026-04-22 |
|---|---|---|
| L1 | Read-only click on GET routes | 10/10 (lightweight endpoints) |
| L2 | Write paths + role gates | 30/30 |
| L3a | Illegal state transitions | Passing; surfaced and fixed a bug |
| L3b | Audit trail completeness | 2/2 |
| L3c | Cross-entity invariants | Passing |
| L4a | Authorization traversal | 11/11 |
| L5d | Real mobile hardware | Cannot run in sandbox — Praveen/Murugesan on actual phones |

Full kitchen-sink run: **60 passed, 0 failed** against PV 90 seed data.

Test harness: `scripts/test-kitchen-sink.js` (uses X-Test-User-Id header bypass,
never hits login rate limiter).

---

## 4. What was built in the 2026-04-22 session

1. **Governance Excel sheets (8 total)** built from verified codebase state
   (every claim backed by a grep or file-read, no assumptions).
2. **DB tables** `role_permissions`, `workflow_transitions`, `notification_triggers`,
   `governance_uploads` via `migrations/v4.6-governance-tables.sql`.
3. **Nav migration** `migrations/v4.7-governance-nav.sql` — governance tab for
   principals in the More bucket.
4. **Governance admin route** `routes/governance.js` — 6 endpoints, all
   `requirePrincipal` gated (status, reload, upload, permissions, workflows,
   notifications).
5. **DB-backed middleware** `middleware/permissions.js` rewritten to read from
   DB with NO legacy fallback. Fails loud (503) if DB table unreachable.
6. **Frontend governance panel** in `public/js/app.js` — stat cards, per-sheet
   upload button, view permissions/workflows modals, force-reload button.
7. **Password reset fix** `routes/admin-reset.js` — now uses `managed_by` not role.
8. **Claims invoice state guard** `routes/claims.js:263` — invoice-number PATCH
   now requires `status='approved'` before writing; returns 409
   `INVALID_STATE_TRANSITION` otherwise.
9. **Sheet loader script** `scripts/load-governance-sheets.js` — idempotent.
10. **Seed script updated** `scripts/seed-full.sh` — now applies v4.5/v4.6/v4.7
    and calls the sheet loader.

---

## 5. Known open gaps (from Sheet 8 — 13 routes)

Scanner output from `tools/pre-delivery-check.js --check=3`. Each classified:

- **Acceptable (9):** `issues.js:59, 406` (trainees can raise issues by design),
  `photos.js:33` (trainee can upload photos), `meetings.js:435, 445, 488`
  (owner-scoped), `snags.js:53` (trainee guard blocks), `schedule.js:84`
  (trainee guard blocks).
- **Decide (2):** `forms.js:96` (broad form submission — intended?),
  `photo-tags.js:105` (AI tagging permission?).
- **Fix needed (2):** `photos.js:150` (documents upload — restrict to non-trainee?),
  `register.js:55` (drawing register upload — restrict to design team?).

Nothing security-critical. All surfaced by the scanner, classified in Sheet 8.

---

## 6. Memory rules (apply on every turn)

These are Claude's operating rules. All 23 apply. The most important for this
codebase:

### Rule 23 — VERIFY BEFORE CLAIMING (NON-NEGOTIABLE)

Any claim about state — codebase, process, file, log, DB, permissions,
behaviour — requires a tool call that session. Cannot verify → say so. Every
claim must show the tool call that supports it. Prior summaries are context not
ground truth. Signal: claim without tool call in last 2 steps → stop and verify.
Covers documents, counts, "works", "fixed", "clean". Stale logs, wrong
classifications, false parse-clean — all same failure. **Written by Naveen
after repeated failures.**

### Other critical rules

- **Rule 14** — No fat code. Extract helpers before writing, not after.
- **Rule 16** — Pre-delivery checklist: grep every function, table, route before
  claiming done. Parse-clean alone is false confidence.
- **Rule 21** — Process lessons v4:
  1. Playwright E2E exists before a feature is called done.
  2. Never INSERT IGNORE in dev seed — plain INSERT first, fail loud.
  3. SHOW COLUMNS before any SQL.
  4. Check package.json before glue code.
  5. Run runtime tests once, don't re-prove.
  6. Don't fight sandboxes that tear down daemons — document and move on.
  7. Ship-ready = checklist agreed upfront.
- **Rule 22** — Comms lessons v4:
  8. No "Continue?" / "Next turn:" padding.
  9. Every status claim carries "proven how".
  10. Stop on first surprise — reproduce before defending prior work.

---

## 7. Codebase layout

```
/home/claude/work/                 (the nu PMC repo)
├── server.js                      (Express entry, 324 routes mounted)
├── schema.sql                     (91 tables, 2400 lines)
├── Dockerfile                     (multi-stage, Alpine, non-root)
├── docker-compose.yml             (db + seed + app + adminer)
├── middleware/
│   ├── auth.js                    (requireRole, requirePMC, requirePrincipal)
│   ├── permissions.js             (DB-backed requirePermission — single-boss)
│   ├── trainee-guard.js           (allow-list writes)
│   ├── project-scope.js           (per-project access)
│   └── db.js                      (mysql2 pool)
├── routes/                        (56 files)
│   ├── governance.js              (NEW — sheet upload + permission reload)
│   ├── admin-reset.js             (managed_by password reset)
│   ├── claims.js                  (state-machine guarded)
│   └── ...
├── migrations/
│   ├── v4.6-governance-tables.sql (NEW — 4 tables)
│   └── v4.7-governance-nav.sql    (NEW — governance tab)
├── governance_sheets/             (NEW — the 8 Excel files)
├── scripts/
│   ├── seed-full.sh               (one-command seed)
│   ├── load-governance-sheets.js  (NEW — idempotent sheet loader)
│   └── test-kitchen-sink.js       (NEW — L1-L4a harness)
└── public/
    └── js/app.js                  (frontend; renderGovernance added)
```

---

## 8. How to run locally (one command)

```bash
cp .env.docker.example .env
# Edit .env: set DB_ROOT_PASSWORD, DB_PASSWORD, SESSION_SECRET (openssl rand -hex 32)
docker compose up -d db
docker compose --profile seed run --rm seed
docker compose up -d app
# App now on http://localhost:3100
```

Subsequent runs: `docker compose up -d`. Stop: `docker compose down`.
Reset DB: `docker compose down -v`.

Verify tests pass: `docker compose exec app node scripts/test-kitchen-sink.js`
(requires PV 90 seed data to be loaded).

---

## 9. Deploying to AWS (or any cloud)

Same Docker image. Two options:

**A) EC2 with docker-compose** (simplest):
1. Provision t3.small or larger (2 GB RAM minimum).
2. Install Docker + docker compose plugin.
3. `scp` the tarball to `/opt/nu-pmc`, `tar xzf`, `cp .env.example .env`, edit.
4. `docker compose up -d db && docker compose --profile seed run --rm seed && docker compose up -d app`
5. Point a domain + TLS at port 3100. nginx config in `deploy/nginx.conf`.

**B) ECS Fargate** (more ops overhead, no host to manage):
1. Push image to ECR: `docker build -t nu-pmc . && docker push`.
2. RDS for MariaDB (or Aurora MySQL).
3. ECS task definition uses the same env vars as `.env`.
4. ALB in front of the task for TLS.

For staging, option A is faster. For long-term production, option B is steadier.

---

## 10. What to do first in a new session

1. Read this handoff.
2. Run `ls -la governance_sheets/` — confirm all 8 sheets present.
3. Run `cat HANDOFF.md | head -40` to re-anchor on current state.
4. If the user asks you to "verify" anything, your first tool call is a grep or
   file read. If you can't verify in-session, say so.
5. Never invent state. Never paraphrase a claim without a tool call to back it.

---

## 11. Pending work (carry-forward)

- **v6 backlog item:** `managed_by` dropdown when adding users in the user
  management UI (frontend-only, ~30 min).
- **Sheets 4–8 wiring:** SLAs, visibility, audit events, sequences, open gaps
  are reference-only. Wire them into live behaviour in v5.
- **L5d testing:** real devices — Praveen and Murugesan at the PV 90 site.
  Cannot be done from a sandbox.
- **Sheet editing UX:** right now the Governance panel only accepts full-file
  re-upload. A per-row in-app editor is a future enhancement.
