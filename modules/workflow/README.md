# workflow Module

## What it does
Multi-party workflows that span multiple functional areas of a project.

- **Meetings** (`routes/meetings.js`) — unified site visits + MOMs, revisions, action items, photos
- **Change notices** (`routes/changes.js`) — scope / schedule / cost changes with multi-signatory sign-off
- **Approvals dispatcher** (`routes/approvals.js`) — routes approval requests; reads across modules
- **Measurements** (`routes/measurements.js`) — joint measurement & certification
- **Submittals** (`routes/submittals.js`) — numbered register of submissions

## Public API
```js
const Workflow = require('../../modules/workflow/contract');

const m = await Workflow.functions.getMeeting(meetingId, projectId);
const recent = await Workflow.functions.getRecentMeetings(projectId, 5);
const cns = await Workflow.functions.getOpenChangeNotices(projectId);
```

## Tables owned (9)
`meetings`, `meeting_actions`, `meeting_revisions`, `meeting_photos`,
`change_notices`, `change_notice_signatories`,
`measurements`, `measurement_items`, `submittals`.

## Routes mounted
`/api/meetings`, `/api/changes`, `/api/approvals`, `/api/measurements`, `/api/submittals`.

## Depends on
- M1 Auth (legacy shim) — role gates
- M2 Onboarding — reads `projects` (direct SELECT)
- M5 Finance — changes.js reads `budget_cost_heads` (direct SELECT)
- M6 Reporting — approvals.js reads `weekly_reports` (direct SELECT)
- M7 System — approvals.js (legacy wa_pending_actions reads retired; now reads `approvals` table via pendingForUser())
- design-services module — approvals.js reads `schedule_versions` (direct SELECT)

## Gate status
- GB.1 Physical move ✓ — 5 files moved, 0 left
- GB.2 Require paths ✓ — 5/5 syntax clean
- GB.3 Server mounts ✓ — 5 updated, 0 stale, syntax OK
- GB.4 Contract ✓ — v1.0.0, 5 functions + 5 routers, 9 tables
- GB.5 Load sweep ✓ — 68/68 files load
- GB.6 Tests ✓ — 14 cases across 5 describe blocks
- GB.7 Tests pass ✓ — **132/132**
- GB.8 Boundary lint ✓ — 74 files across 9 modules, 0 violations
- GB.9 README ✓

## Honest gaps
1. `approvals.js` is the most cross-module-read-heavy file — it reads tables owned by 5 other modules. Works today via direct SELECT. Future refactor: go through those modules' contracts. Tech debt.
2. Tests mocked-db, same pattern as prior modules.
3. Legacy `middleware/auth` shim still in use.
