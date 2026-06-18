# M7 — System Module

## What it does
Cross-cutting system services. Every other module uses at least one piece of this — notifications to WA people, nav configuration to render the UI, AI triggers to enrich content, PMC admin for per-project role assignments.

- **Navigation** (`nav.js`, `nav-admin.js`) — role-aware tab config + IT admin editor
- **Notifications** (`notifications.js`) — in-app notification store
- **WhatsApp** (`whatsapp.js`) — Twilio Business API delivery + receipts
- **Client comms** (`comms.js`) — Client Communication Log
- **AI triggers** (`ai-triggers.js`) — Claude-powered events tied to app actions
- **Governance** (`governance.js`) — permission overrides via governance sheet
- **Delegations** (`delegations.js`) — role delegation authority
- **PMC admin** (`pmc-assignments.js`, `pmc-deputy.js`) — per-project PMC mapping + deputy declarations
- **Project SLAs** (`project-slas.js`) — per-project deadline overrides
- **Lookup** (`lookup.js`) — read-only frontend reference data

## Public API
```js
const System = require('../../modules/system/contract');

const nav = await System.functions.getNavForRole('principal');
const slas = await System.functions.getSLAsForProject(projectId);
const deputy = await System.functions.getActiveDeputy(userId);
```

## Tables owned (13)
`role_nav`, `role_nav_drafts`, `project_slas`, `notifications`, `whatsapp_messages`,
`wa_send_failures`, `failed_emails`, `client_communications`, `delegations`,
`pmc_deputy`, `pmc_project_assignments`, `governance_rules`, `ai_trigger_logs`.

## Routes mounted (12)
- `/api/nav`, `/api/nav-admin`, `/api/project-slas`, `/api/notifications`,
  `/api/whatsapp`, `/api/comms`, `/api/governance`, `/api/delegations`,
  `/api/ai-triggers`, `/api/pmc-assignments`, `/api/pmc-deputy`, `/api/lookup`

## Gate status

### M7.1 — Physical move ✓
12 files moved from `/routes/` to `/modules/system/routes/`.

### M7.2 — Require paths rewritten ✓
All `../../../`. 12/12 syntax clean.

### M7.3 — Server mounts updated ✓
12 mounts point to new location. 0 stale. `node --check server.js` passes.

### M7.4 — Contract written ✓
`contract.js` v1.0.0 — 3 functions + 12 routers + 13 owned tables.

**Bug caught in M7.4:** `whatsapp.js` exports `{ router }` rather than `module.exports = router`. First contract draft mounted the wrapper object as if it were a router. Contract-type check caught it; fixed to `require('./routes/whatsapp').router`.

### M7.5 — Load sweep ✓
66/66 files load cleanly.

### M7.6 — Tests written ✓
11 test cases.

### M7.7 — Tests pass ✓
104 passed, 104 total.

### M7.8 — Boundary lint passes ✓
61 files across 7 modules, 0 violations.

### M7.9 — README ✓
This file.

## Honest gaps
1. Tests mocked-db, same pattern as all prior modules.
2. Cross-module reads still direct SELECT. Refactor to contract calls is tech debt.
3. `notifications` route mount name collides with table name. Not a bug, just naming overlap worth noting.
