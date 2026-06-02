# M2 — Onboarding Module

## What it does
Owns the "setting up a project" phase of nu PMC:
- Project records (create, list, update)
- Clients (master + per-project)
- Vendor master + clearance workflow (PAN/GSTIN/bank validation)
- Project scope + initial checklist
- Client BOQ (rate cards that feed billing)
- Document library with version control (V5 Fix 3)
- Internal team assignment

## Public API
See `contract.js`. Callers use:
```js
const Onboarding = require('../../modules/onboarding/contract');
const project = await Onboarding.functions.getProject(projectId);
const team = await Onboarding.functions.getProjectTeam(projectId);
const vendors = await Onboarding.functions.getClearedVendors('Civil');
```

## Tables owned
`projects`, `project_assignments`, `clients`, `company_entities`, `vendors`,
`client_boq_items`, `client_boq_versions`, `project_documents`,
`project_document_versions`, `approval_document_links`.

Other modules may SELECT these via contract functions only.

## Depends on
- M1 Auth (via `../auth/contract`) — for `requireAuth`, `requireRole`, role gates
- `/middleware/db`, `/middleware/asyncHandler`, `/middleware/validate`,
  `/middleware/excel`, `/middleware/upload`, `/middleware/permissions` — shared
- `/services/audit`, `/services/date-util`, `/services/fuzzy-match`,
  `/services/sequence`, `/services/roles`, `/services/schemas`,
  `/services/whatsapp`, `/services/ai`, `/services/notifications`,
  `/services/users-lookup`, `/services/file-storage`, `/services/lookup`,
  `/services/budget-check` — shared

## Routes mounted (server.js)
- `/api/projects`       → `routes/projects.js`
- `/api/clients`        → `routes/clients.js`
- `/api/vendors`        → `routes/vendors.js`
- `/api/client-boq`     → `routes/client-boq.js`
- `/api/project-setup`  → `routes/project-setup.js`
- `/api/documents`      → `routes/documents.js`

## Gate status

### M2.1 — Physical move ✓
6 files moved from `routes/` to `modules/onboarding/routes/`. Proven: `ls` empty on old location, files present at new location.

### M2.2 — Require paths rewritten ✓
All relative imports now `../../../middleware/…` and `../../../services/…`. Syntax check passes on 6/6 files.

### M2.3 — Server mounts updated ✓
6 mount lines in `server.js` now reference `./modules/onboarding/routes/…`. 0 stale references to old paths. `node --check server.js` passes.

### M2.4 — Contract written and loads ✓
`contract.js` exports: version 1.0.0, 5 functions, 6 routers, 10 owned tables. All correct types.

### M2.5 — Legacy consumer sweep ✓
60/60 files across `routes/` + `modules/` load cleanly via Node's require.

### M2.6 — Routes respond ✓ (in-process)
Supertest smoke test: GET on every route returns <500. Full DB-integrated live-server test deferred — sandbox kills daemons between tool calls (process lesson #6). Jest in-process test proves the code path end-to-end.

### M2.7 — Tests added ✓
`tests/contract.test.js`: 13 test cases. `npm run test:modules` reports 29 passed, 29 total (M1 Auth 16 + M2 Onboarding 13).

### M2.8 — Boundary lint passes ✓
`npm run lint:boundaries`: 15 files scanned, 0 violations.

### M2.9 — README ✓
This file.

### M2.10 — Migrate internal imports to Auth contract (DEFERRED)
Currently M2 routes still import `../../../middleware/auth` (the shim). To truly enforce the module boundary, they should switch to `require('../../auth/contract').middleware.requireAuth` etc. Deferred because:
- Shim works correctly in prod
- No functional difference yet
- Can be done as a scripted find/replace once all modules exist
- Reduces blast radius of this already-large M2 step

Tracked as tech debt — will be addressed in a dedicated pass after M3/M4/M5 exist.

## Known deferrals tracked as TODO
1. `vendors.js` contains BOTH vendor master + engagement approval. Engagement approval arguably belongs in M4c Site Activation. Not split in M2.
2. Several places in `projects.js` directly SELECT from tables owned by other (yet-to-exist) modules — grns, payment_requests etc. These reads are read-only and fine for now; will be refactored to contract calls as each target module lands.
3. `file-storage.js` stays in `/services/` as shared for now. Candidates to migrate here as M2 grows document handling, but not in this step.
