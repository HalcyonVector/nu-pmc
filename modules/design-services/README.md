# design-services Module

## What it does
The drawing + schedule + BOQ core of nu PMC. Serves both design and services streams (distinguished by a `stream` column on tables, not by folder — see earlier V5 architecture discussion).

- **Drawings** (`routes/drawings.js`) — upload, version, review, approve, flag
- **Drawing register** (`routes/register.js`) — expected drawings + sign-off state
- **Schedule** (`routes/schedule.js`) — R0 baseline + revisions + task updates
- **Materials / BOQ** (`routes/materials.js`) — internal BOQ per stream + material requests

## Public API
```js
const DS = require('../../modules/design-services/contract');

const drawings = await DS.functions.getDrawings(projectId, 'design');
const register = await DS.functions.getDrawingRegister(projectId);
const tasks    = await DS.functions.getScheduleTasks(projectId);
const boq      = await DS.functions.getCurrentBOQ(projectId, 'services');
```

## Tables owned (11)
`drawings`, `drawing_versions`, `drawing_register`, `drawing_ai_checks`,
`schedule_versions`, `schedule_tasks`, `task_updates`, `task_validations`,
`boq_versions`, `boq_items`, `material_requests`.

## Routes mounted
- `/api/drawings`  → `routes/drawings.js`
- `/api/register`  → `routes/register.js`
- `/api/schedule`  → `routes/schedule.js`
- `/api/materials` → `routes/materials.js`

## Depends on
- M1 Auth (via legacy shim) — role gates
- M2 Onboarding — reads `projects`, `clients` indirectly (currently via direct SELECT)
- M4 Site — reads `issues` in drawings approval flow (direct SELECT)
- Shared middleware and services (`db`, `asyncHandler`, `audit`, `notifications`, etc.)

## Gate status
- GA.1 Physical move ✓ — 4 files moved, 0 left in `/routes/`
- GA.2 Require paths rewritten ✓ — 4/4 syntax clean
- GA.3 Server mounts updated ✓ — 4 mounts, 0 stale, `node --check server.js` passes
- GA.4 Contract ✓ — v1.0.0, 4 functions + 4 routers, all correct types
- GA.5 Load sweep ✓ — 67/67 files load cleanly
- GA.6 Tests written ✓ — 14 cases across 5 describe blocks
- GA.7 Tests pass ✓ — `npm run test:modules` → **118 passed, 118 total**
- GA.8 Boundary lint passes ✓ — 67 files across 8 modules, 0 violations
- GA.9 README ✓ — this file

## Honest gaps
1. **Biggest file in the app (drawings.js, 627 lines) now lives here.** The stream-scoping edit discussed earlier (`req.scope.stream` respect) was NOT applied — role-based scoping continues as before. If design-services is ever split into separate M4a+M4b modules, that edit becomes necessary. Today it's not.
2. Tests use mocked `db.query` — pattern matches all prior modules.
3. Cross-module reads still direct (users, issues, projects). Tech debt.
4. Legacy `middleware/auth` shim still in use.
