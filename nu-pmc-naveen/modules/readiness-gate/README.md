# M3 — Readiness Gate Module

## What it does
Pure-logic module. Answers one question: **"Is project X ready to go from 'initialising' to 'active'?"**

Before M3, this check was a 7-condition inline `if` chain buried in `routes/projects.js`. It sat in exactly one caller and was invisible elsewhere. Now every caller asks the gate.

## Public API
```js
const ReadinessGate = require('../../modules/readiness-gate/contract');

// 1. Inspect — returns { ready, blockers, completed, status }
const r = await ReadinessGate.functions.checkReadiness(projectId);

// 2. Enforce — throws 409 with blocker list if not ready
await ReadinessGate.functions.assertReady(projectId);

// 3. Activate — flips status to 'active' if ready, idempotent
const r = await ReadinessGate.functions.activateIfReady(projectId);
// r.justActivated === true only on the transition turn
```

## The 7 blockers
Defined in `service.js` as data, not code — one object per blocker with:
- `key` — stable identifier (never changes)
- `column` — DB column on `projects` that must be `1`
- `label` — human-readable for UI / error messages

| Key | DB column | Meaning |
|---|---|---|
| `project_created`   | `checklist_project_created`   | Project record + client + basic metadata saved |
| `design_register`   | `checklist_design_register`   | Design drawing register signed off |
| `services_register` | `checklist_services_register` | MEP drawing register signed off |
| `design_boq`        | `checklist_design_boq`        | Design BOQ uploaded |
| `services_boq`      | `checklist_services_boq`      | MEP BOQ uploaded |
| `schedule`          | `checklist_schedule`          | R0 schedule uploaded and approved |
| `site_manager`      | `checklist_site_manager`      | Site manager assigned |

Adding/removing a blocker = one line in `BLOCKERS` array in `service.js`.

## Tables
Owns none. Reads `projects.checklist_*` and writes `projects.status`.
The checklist columns are owned by M2 Onboarding. M3 is a consumer + state-transition authority.

## Depends on
- `/middleware/db` (shared)
- M2 Onboarding (indirect — M2 sets the flags this module reads)

## Gate status

### M3.1 — Found all existing readiness checks ✓
`grep` output: exactly ONE inline check existed — at `modules/onboarding/routes/projects.js:538`. No other readiness logic scattered elsewhere.

### M3.2 — Module folder created ✓
`ls modules/` shows `auth`, `onboarding`, `readiness-gate`.

### M3.3 — Service written ✓
`service.js`: `BLOCKERS` array + `checkReadiness`, `assertReady`, `activateIfReady`.

### M3.4 — Contract written ✓
`contract.js` v1.0.0 exposes 3 functions + `BLOCKERS` constant. Syntax-checked, loads, types verified.

### M3.5 — Tests added ✓
`tests/contract.test.js`: 20 cases. Contract surface (4), checkReadiness (11 — one per blocker plus edge cases), assertReady (2), activateIfReady (3).

### M3.6 — Tests pass ✓
`npm run test:modules` → **49 passed, 49 total** (M1: 16, M2: 13, M3: 20).

### M3.7 — Legacy caller refactored ✓
`modules/onboarding/routes/projects.js`:
- Removed: 7-condition AND chain (`grep` returns 0 matches for old pattern)
- Added: `ReadinessGate.functions.activateIfReady(project_id)` at line 540
- Syntax OK, tests still pass, boundary lint still clean.

### M3.8 — Boundary lint passes ✓
`npm run lint:boundaries` → 18 files across 3 modules, 0 violations.
Confirms M2's cross-module call into M3 goes through `contract.js` only.

### M3.9 — README ✓
This file.

## Not done (honest gaps)
1. Not all callers that READ checklist columns have been migrated. Other routes still SELECT `p.checklist_*` directly for display. They should use `ReadinessGate.functions.checkReadiness()` to get the UI-friendly blocker list. Low priority — display-only reads don't threaten consistency.
2. No live-DB integration test. All 20 M3 tests use mocked `db.query`. The refactored activation path inside `projects.js` has not been executed against the live DB in this session. The refactor is a drop-in replacement of `if (…)`+`UPDATE` with a function call that issues the same `UPDATE` — low risk but unverified live.
