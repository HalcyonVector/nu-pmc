# nu-pmc — Final Verification Report (2026-07-02)

Live Chrome verification pass driving the app as each role via `APP.switchActingRole()`. Everything below was exercised in the running app, not just read in code.

## Flows verified live — all PASS

| # | Flow | Result | Artifact |
|---|------|--------|----------|
| 1 | Handover 5-role closure sign-off | Project transitioned to `completed` | project 5 |
| 2 | Measurements lifecycle: create → RS signoff → client accept | `client_accepted` + cert | measurement 6 |
| 3 | Documents upload + View | 200 PDF served | doc 10, file/9 |
| 4 | Meeting-action "Done" (state machine) | action completed | action 14 |
| 5 | Vendor clearance | vendor cleared | ABC Cement (id 4) |
| 6 | Client completion | `master_complete=1` | Test Client (id 2) |
| 7 | Vendor-engagement bulk upload | "4 engagements created" | project 2 |
| 8 | Clients bulk upload | parsed 3 rows, deduped (0 added / 3 skipped as existing) | — |
| 9 | Urgent payment (adhoc, >₹10k) | "Urgent payment raised ✓" — reason + PAN + invoice accepted | project 2 |
| 10 | MOM issue → reissue | v1 → v2, 2-day window, unlocked | MOM-003 (id 12) |

## Fixes made (this audit)

| Area | File | Fix |
|------|------|-----|
| Meeting actions | `services/state-machines.js` | Allowed `pending→completed` and `overdue→*` transitions (was 400) |
| Documents | `modules/onboarding/routes/documents.js` | Moved `/file/:versionId` above `/:projectId` (route shadowing); fixed `.then(r=>[r])` double-wrap that broke file lookup |
| Handover closure | `modules/site/routes/handover.js` | Added `design_principal` to `CLOSURE_SIGNOFF_ROLES`; changed gates from `requirePMC` to `requireRole(...)` so all closure roles can act |
| Urgent payment | `public/js/app.js` | Send `reason` (was `description`); added GSTIN/PAN fields + engagement vendor picker; client-side ₹10k GST/PAN check |
| Vendor bulk | `modules/onboarding/routes/vendors.js` | Header-tolerant column parser (`pick()`) |
| Documents modal | `public/js/app.js` | Own file input + Upload button + guard |
| Modal hygiene | `public/js/ui.js` | `closeModal()` now clears stale `#modal-content` (prevents duplicate-id collisions across modals) |
| BOQ vendor allocation | `public/js/app.js` | "+ Engage Vendor" / "Bulk Upload" buttons on engagements header |
| Role assignment | `modules/onboarding/routes/projects.js` | `POST /:id/assign-role` endpoint |
| Buttons/CSS | `public/css/app.css` | Filled navy `.btn-sm.navy`; 44px min-height secondary buttons |

## Nav reconciliation

Orphaned features (present in the dispatcher, missing from `role_nav`) are fixed. Consolidated into one idempotent migration:

`migrations/2026-07-02-role-nav-reconciliation.sql`

It supersedes the five individual nav migrations (measurements, handover, hide-work-tab-principals, dedupe-reports, pair-photos). Each statement was verified live this session; the consolidated file is their deterministic union for fresh deploys.

## Non-bugs (earlier suspicions, resolved)

- Modal "not auto-closing" (urgent payment, client complete): **false alarm** — modals close correctly (`closeModal` removes the overlay's `open` class). The stale element merely lingered in hidden DOM; now cleared as a hardening fix.

## Caveats / not done

- **Server not restarted** this session (per your constraint). Backend route fixes were confirmed live earlier. The `ui.js` change is a static asset — a page reload picks it up; service-worker cache bumped to `nu-pmc-v4.55` to force a fresh fetch.
- **Consolidated migration not run** against the live DB (no DB access from the sandbox). It is the idempotent union of already-applied migrations; run once on fresh deploys.
- File uploads for drawings / schedule / photos were verified earlier in the session; invoice upload verified here (urgent payment).

## Pre-production reminders (from CLAUDE.md)

Set `NODE_ENV=production` and `FORCE_HTTPS=1`; remove hardcoded `DEV_PASSWORD` in `modules/auth/routes/auth.js`; configure Twilio env vars to enable WhatsApp notifications.
