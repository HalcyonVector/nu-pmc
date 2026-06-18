# nu PMC V5 — Ship Readiness Report

**Date:** 2026-04-26
**Verification:** jest 17/17 (613 passing) · matrix harness 0/5916 findings · E2E 12/12
**Verdict:** SHIP-READY

This document catalogues every bug found during the six-compartment hardening
audit, what was fixed in this cycle, and what is intentionally deferred. Items
are grouped by compartment and by abstract pattern (atomicity, scope, audit,
state-guard, etc.) so a future maintainer can scan by concern, not by file.

---

## Migrations applied this cycle

- **v5.13** — `client_claims` UNIQUE on `invoice_number` (compartment 2 race fix B12).
- **v5.14** — `submittals` UNIQUE on `(project_id, submittal_number)` (compartment 6 race fix S3). Run the dup-detection query in the migration header before applying in production.

---

## Compartment 1 — Login / auth bootstrap (closed)

10 P1s fixed in earlier sessions. One P1 deferred:

- **Bug 21** — `on_hold` projects accept writes via certain endpoints (only `closed` is currently blocked). Defer to V10 — requires a sweep of every write to add a second status check.

---

## Compartment 2 — Project Setup / Onboarding (31 fixes)

Tier 1 (money/correctness): B12 invoice race + UNIQUE, B13 Tally XML escape, B15 path traversal, B16 server path leak, B36 vendor bank re-clearance, B42 PAN gating.

Tier 2 (transactions): B4 stub-client+project, B22 BOQ version+items batch, B35 vendor /clear corrections, B39 contract revise history+update, B41 fee-schedule revise.

Tier 3 (uncontrolled writes documents.js): B48–B56 — POST scope, role allowlist DOC_UPLOAD_ROLES, audit, file/version scope, Content-Disposition header injection, link route scope+consistency, audit, helper resolveEntityProjectId.

Tier 4 (scope leaks): B1 status filter, B2 SUM cross-product, B32 checklist scope, B37 vendor engagements scope.

Tier 5/6 (audit + allowlist): B5, B7, B10, B11, B24, B25, B33, B40.

### Compartment 2 — DEFERRED (22 P2/P3)

Catalogued by abstract pattern:

**Audit gaps (8):** B3, B6, B8, B9, B14, B17, B27, B30 — non-money mutations missing audit.log calls. Pattern: add `audit.log({...})` after the UPDATE/INSERT.

**Scope-leak edge cases (5):** B18, B19, B23, B26, B43 — defensive-only leaks where role gate already restricts access but project membership is not double-checked.

**Validation tightening (4):** B20, B21, B28, B31 — input validators that accept slightly more than the schema documents.

**Atomicity edge cases (3):** B29, B34, B47 — non-money INSERT-then-UPDATE pairs where failure window is small and rerunnable.

**Cleanup / stylistic (2):** B38, B44, B45, B46, B57 — generic-catch antipatterns, comment drift, unused parameters.

---

## Compartment 3 — Site (8 P1 fixes + audit batch)

**Atomicity (5):** S20 snag issue_number race, S22 snag-from-photo race, S23 snag-signoff transactional, S39 handover closure-signoff transactional, S50 photo-tag UPDATE+INSERT transactional.

**Sensitive scope leaks (3):** S40 labour wages_paid GET, S44 photos GET, S47 photos /documents GET.

**Audit batch added (mechanical, ~17):** S3 issue.create, S4 issue.confirm, S5 issue.rfi_respond, S7 issue.photo_rfi.create, S10 issue.rfi.create, S11 issue.rfi.assign + scope, S13 issue.rfi.answer + scope, S14 issue.rfi.close, S17 issue.ncr.create, S19 issue.ncr.resolve, S33 form_submission.create, S36 grn.create, S38 grn.approve, S41/S42/S43 labour audits, S45 photo.upload, S48 document.upload_via_photos, S51 photo_tag.set.

### Compartment 3 — DEFERRED (~17 P2/P3)

**Scope leaks (8):** S1 issues GET, S8 issues photos GET, S9 issues rfi GET, S15 issues ncr GET, S27 daily-reports list, S34 forms submissions GET, S35 grn list — all P2 defensive only since role gates restrict the audience.

**Validation tightening (2):** S25, S26 — daily-reports inline `me.projects.some(p => p.id === projectId)` strict equality. Defensive only — verified by E2E that session uses numbers.

**Cleanup (~7):** S6, S12, S16, S18, S28, S29, S30, S31, S32, S37, S52, S53 — generic-catch antipatterns, missing role gates on firm-wide-only routes.

**Reclassified as not-bugs:** S46, S49, S54 — `project_photos` references work via backward-compat VIEW from v5.8 migration. S21 — photo-insert intentionally best-effort.

---

## Compartment 4 — Design Services (16 P1 fixes — most pre-compaction)

**Atomicity (1):** D3 drawings reject — wrap status UPDATE + restore-previous UPDATE in tx so a mid-flight failure doesn't leave drawing with no current version.

**Scope leaks (5):** D5 drawings flag, D6 drawings view (sequential ID enumeration), R1 register list, SC1 schedule list, SC2 schedule lookahead, SC7 schedule versions.

**Audit (mechanical):** D4 drawing.flag, M1 material_request.create, M2 material_request.status_change, R2 drawing_register.upload, R4 drawing_register.add, R5 drawing_register.sign_off, R6 drawing_register.delete, SC4 schedule.upload, SC5 schedule.drift_acknowledge, SC6 task_progress.update, plus task_update.create and task_validation.set on the regular update/validate routes.

### Compartment 4 — DEFERRED (3 P2)

- **D2** — `drawing_register` UPDATE outside the version status UPDATE tx in the approve flow.
- **SC3** — schedule upload: task INSERT loop not in same tx as version INSERT. Idempotent on re-upload.
- **CO1** — `promoteScheduleVersion` two UPDATEs not wrapped. Now accepts an optional `conn` (partial fix W1) but callers without a tx still see old behaviour.

**Reclassified as not-bug:** D1 — jr_architect viewing WIP design drawings is intentional (they need drafts to detail).

---

## Compartment 5 — Detail team onboarding / users (1 P1 fix)

- **U1 (P1)** — POST /api/users no longer returns `Default password: ${initPassword}` in the JSON response. Instead: phone present → WhatsApp the user; phone absent → require explicit `?reveal_password=1` query param to surface the password once. Audit log records the create regardless.

### Compartment 5 — DEFERRED (2 P2/P3)

- **U3** — PATCH /:id/deactivate has no cascade for deputy/managed_by references. Acceptable; system handles dangling deputy_id elsewhere via the `deputy_until` time bound and the cycle check in PATCH /:id/deputy.
- **U5** — bulk-upload accepts file before role check. Defensive only — `requireAuth` gates and `can('users.bulk_upload')` is checked before parse.

**Reclassified as not-bug:** U2 — bulk-upload returns `temp_passwords` array by design. Naveen distributes credentials manually since uploaded users may not have phone numbers yet.

---

## Compartment 6 — Workflow / site feedback (3 P1 fixes)

**Atomicity (2):**
- **W1** — approvals POST /:id/approve schedule_change branch was 3 separate writes (approval status, then promoteScheduleVersion's two UPDATEs). Now wrapped: tx around approval UPDATE + (conditionally) promoteScheduleVersion(conn). Side-effects (notifications, checklist flag, weekly-report fetch) happen after commit.
- **S3** — submittals POST: SUB-NNN race + missing UNIQUE = silent duplicate numbers. Migration v5.14 adds UNIQUE; route wrapped in insertWithRetry; audit added.

**State guard (1):**
- **W2** — approvals POST /:id/reject: state guard added (mirrors approve). Re-rejecting an already-actioned request now returns 400 instead of silently overwriting status.

### Compartment 6 — DEFERRED (~11 P2/P3)

**Scope leaks (4):** M1 meetings list, M8 meetings /documents (sequential meeting_id), S1 submittals list, W3 approvals POST / (any auth user can create approval requests — spam vector, no privilege escalation).

**Audit gaps (~7):** M2 meeting.create, M4 meeting.draft_edit, M5 site_visit.create, M6 observation.add, M7 meeting.upload, M9 action_item.create, M10 action_item state changes (acknowledge/countersign/complete), S4 submittal.review.

**Reclassified as not-bug:** W4 — changes POST /:id/approve has no `requireProjectScope`, but stream-based gates (line 219) catch mismatched heads.

---

## Tooling fixes this cycle

- **`tools/extract-route-gates.js`** — added `PER_FILE_ROLE_SETS` override for `documents.js` so the matrix harness sees the new `DOC_UPLOAD_ROLES` allowlist (compartment 2 fix B48). Without this, the matrix reported 4 false negatives on jr_architect/detailing because the static analyzer couldn't resolve the local constant.

---

## Cross-cutting patterns that emerged

Three patterns showed up repeatedly across compartments. Worth knowing for future audits:

1. **`SELECT MAX/COUNT → INSERT` without UNIQUE constraint** — appeared in compartment 3 (snag, snag-from-photo) and compartment 6 (submittals). Fix is always: add UNIQUE constraint via migration, wrap in `insertWithRetry`. Compartment 2 (B12 invoice_sequence) was the same pattern. Standard fix template now well-established.

2. **Multi-statement state changes not wrapped in tx** — appeared everywhere. The `db.tx(async (conn) => ...)` helper exists; the pattern is just remembering to use it. Photo-tags UPDATE+INSERT, snag signoff INSERT+UPDATE, handover closure signoff INSERT+UPDATE, drawing reject UPDATE+UPDATE, schedule promote UPDATE+UPDATE, approval+promote chain. All same fix.

3. **`requireProjectScope` missing on GET routes** — appeared in compartment 3 (most issues GETs), compartment 4 (drawings view, register list, schedule list/lookahead/versions), compartment 6 (meetings list, submittals list). Most are P2 defensive-only because role gates already restrict the audience, but the fully-correct pattern is `requireAuth + requireProjectScope()` or `requireScopeFromEntity('table')` on every project-data GET.

---

## Files changed this cycle

```
migrations/v5.13-compartment2-fixes.sql       (created earlier)
migrations/v5.14-submittals-unique.sql        (NEW)
schema.sql                                     (UNIQUE on submittals)
tests/setup.js                                 (db.tx mock added)
tools/extract-route-gates.js                   (PER_FILE_ROLE_SETS extended)
tools/route-gates.json                         (regenerated)

modules/onboarding/routes/{projects,clients,client-boq,project-setup,vendors,documents}.js
modules/site/routes/{issues,handover,photo-tags,labour,photos,grn,forms}.js
modules/design-services/routes/{drawings,materials,register,schedule}.js
modules/design-services/contract.js            (promoteScheduleVersion accepts conn)
modules/auth/routes/users.js                   (U1 password leak fix)
modules/workflow/routes/{approvals,submittals}.js
```

---

## Pre-deploy checklist

1. Apply v5.13 migration. Pre-flight: confirm no duplicate `client_claims.invoice_number` exist.
2. Apply v5.14 migration. Pre-flight query in the migration header — fix duplicates manually before applying.
3. Restart server — no cache or session changes required.
4. Audit log will start receiving the new actions (issue.create, grn.create, photo.upload, schedule.upload, submittal.create, etc.). Confirm log retention policy is sized for the increased volume (~3-5x baseline writes).
5. Frontend changes needed for U1: callers of POST /api/users that previously displayed `message` containing the password should switch to either reading `temp_password` from the response (when `?reveal_password=1` was passed) or instructing the user to check WhatsApp.

Verification gates to re-run after deploy:
- `bash tools/run-matrix-harness.sh` — expect 0 findings, 5916 checks.
- `bash tools/run-e2e.sh` — expect 12/12.
- `NODE_ENV=test npx jest --silent` — expect 17/17 suites, 613 tests.
