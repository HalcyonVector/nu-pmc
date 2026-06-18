# M5 — Finance Module

## What it does
Owns the money side of nu PMC.

- **Vendor payments** — request → PMC approve → principal approve → ICICI wiring
- **Budget** — cost heads, allocations, actuals, variance
- **Client billing** — fee schedule, proforma invoices (PDF + Tally Prime XML), claims
- **Statutory** — GST statement, TDS tracking
- **Cash ops** — petty cash, principal direct payments, client receipts
- **BOQ mapping** — client BOQ item ↔ vendor engagement pricing links
- **Urgent payments** — fast-track flag on payment_requests

## Public API
See `contract.js`. Main callers:
- Dashboard (counters of pending approvals)
- Reporting (budget variance, cost head summaries)
- Audit module (specific payment lookup by id)

```js
const Finance = require('../../modules/finance/contract');

const pending = await Finance.functions.getPaymentsPendingApproval(projectId);
const variance = await Finance.functions.getBudgetVariance(projectId);
const receipt = await Finance.functions.getPaymentByRequestId(requestId);
const receipts = await Finance.functions.getClientReceipts(projectId);
```

## Major cross-module read
M5 Finance reads **M4 Site**'s `getApprovedGRNs(projectId)` when raising payments — only approved deliveries are eligible for payment. This is the first real cross-module contract consumer in V5.

That migration (payments.js today reads `grns` table directly → switch to calling `Site.functions.getApprovedGRNs()`) is **tracked as tech debt**, not done in M5. The direct SELECT currently works and is functionally identical. Cleaning it up to go through contract is a separate step.

## Tables owned
`payment_requests`, `vendor_payments`, `budget_cost_heads`, `budget_flags`,
`proforma_invoices`, `fee_schedule`, `client_receipts`, `petty_cash_transactions`,
`vendor_boq_mapping`, `claims_draft`, `claims_submitted`.

Other modules may SELECT these via contract functions only.

## Routes mounted (server.js)
- `/api/payments`          → `routes/payments.js`
- `/api/payment-requests`  → `routes/payment-requests.js`
- `/api/invoices`          → `routes/invoices.js`
- `/api/budget`            → `routes/budget.js`
- `/api/claims`            → `routes/claims.js`
- `/api/finance`           → `routes/finance.js`
- `/api/gst-statement`     → `routes/gst-statement.js`
- `/api/pi`                → `routes/pi-generator.js`
- `/api/urgent-payments`   → `routes/urgent-payments.js`
- `/api/boq-mapping`       → `routes/boq-mapping.js`

## Depends on
- M1 Auth (legacy shim `../../../middleware/auth`)
- M2 Onboarding — reads `projects`, `clients`, `vendors` via contract (currently direct SELECT)
- M4 Site — reads `getApprovedGRNs()` (currently direct SELECT)
- Shared: `/middleware/db`, `/middleware/asyncHandler`, `/middleware/validate`,
  `/middleware/upload`, `/services/audit`, `/services/notifications`,
  `/services/users-lookup`, `/services/budget-check`, `/services/ai`

## Gate status

### M5.1 — Physical move ✓
10 files moved from `/routes/` to `/modules/finance/routes/`. Tool proof: `ls` 10 in new location, 0 in old.

### M5.2 — Require paths rewritten ✓
All `../../../`. Syntax check passes on 10/10 files.

### M5.3 — Server mounts updated ✓
10 mount lines point to new location. 0 stale references. `node --check server.js` passes.

### M5.4 — Contract written ✓
`contract.js` v1.0.0 — 5 functions + 10 routers + 11 owned tables. All correct types.

### M5.5 — Full load sweep ✓
64/64 files (routes + modules) load cleanly.

### M5.6 — Tests written ✓
17 test cases: contract surface (4), 5 function suites (10 tests), 6 route mount smoke tests.

### M5.7 — Tests pass ✓
`npm run test:modules` → **81 passed, 81 total** (M1: 16, M2: 13, M3: 20, M4: 15, M5: 17).

### M5.8 — Boundary lint passes ✓
`npm run lint:boundaries` → 37 files across 5 modules, 0 violations.

### M5.9 — README ✓
This file.

## Honest gaps

1. **Tests use mocked `db.query`** — pattern matches M1-M4. No live-DB integration test in this session for new code path.

2. **Cross-module reads still direct** — `payments.js` still SELECTs from `grns`, `vendors`, `projects`, `engagements` directly. To truly enforce the boundary, these should go through `Site.functions.getApprovedGRNs()`, `Onboarding.functions.getClient()` etc. Currently they don't. Works correctly but violates "each module only accesses its own tables" at the implementation level (while the contract layer is clean). Tech debt.

3. **No migration yet to Auth contract** — routes still import `../../../middleware/auth` via the legacy shim. Same as M1/M2/M3/M4.

4. **11-table ownership is large** — Finance is the biggest module by table count. If any of these tables turn out to have natural sub-boundaries (e.g. petty cash being its own thing), we split later. Not now.
