# M6 — Reporting Module

## What it does
Aggregates and presents data drawn from other modules. Owns very little state of its own — mostly reads.

- **Dashboard** (`dashboard.js`) — role-aware home screen tiles
- **Accordion summary** (`acc-summary.js`) — tab-level badge counts + previews
- **Needs You** (`needs-you.js`) — items pending current user's action
- **Pending tab** (`pending.js`) — blocked items + items routed to you
- **Gantt** (`gantt.js`) — chart data for schedule visualisation
- **Reports** (`reports.js`) — ad-hoc reports endpoint
- **Weekly Health** (`weekly-health.js`) — Monday Morning Health Report
- **Weekly Sign-off** (`weekly-signoff.js`) — weekly sign-off workflow

## Public API
```js
const Reporting = require('../../modules/reporting/contract');

const count = await Reporting.functions.getNeedsYouCount(userId, role);
const health = await Reporting.functions.getWeeklyHealthSummary(projectId, weekStart);
```

## Tables owned
`weekly_health_reports`, `weekly_signoffs`. Everything else is read.

## Routes mounted
- `/api/reports`, `/api/weekly-health`, `/api/weekly-signoff`, `/api/dashboard`,
  `/api/acc-summary`, `/api/needs-you`, `/api/pending`, `/api/gantt`

## Gate status

### M6.1 — Physical move ✓
8 files moved from `/routes/` to `/modules/reporting/routes/`.

### M6.2 — Require paths rewritten ✓
All `../../../`. 8/8 syntax clean.

### M6.3 — Server mounts updated ✓
8 mounts point to new location. 0 stale. `node --check server.js` passes.

### M6.4 — Contract written ✓
`contract.js` v1.0.0 — 2 functions + 8 routers + 2 owned tables.

### M6.5 — Load sweep ✓
66/66 files load cleanly across routes/ + modules/.

### M6.6 — Tests written ✓
12 test cases across 3 describe blocks.

### M6.7 — Tests pass ✓
`npm run test:modules` → 104 passed, 104 total (all modules).

### M6.8 — Boundary lint passes ✓
61 files across 7 modules, 0 violations.

### M6.9 — README ✓
This file.

## Honest gaps
1. **Function contracts are thin.** `getNeedsYouCount` currently returns a placeholder `{count: 0}` — the real count calculation still lives in `needs-you.js` as a route handler. Needs a refactor of the route-handler logic into a reusable service. Tracked as tech debt.
2. **Most cross-module reads still go direct to tables** (pattern from M4/M5). Refactor to use other modules' contracts is follow-on work.
3. Tests are mocked-db. Same pattern as all prior modules.
