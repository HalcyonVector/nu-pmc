# app.js Decomposition Plan

## Current state

- **685KB**, ~13,300 lines, ~74 render functions, ~55 screens
- Global `APP` object literal + 49 external function assignments
- 5 of ~55 screens migrated to Alpine.js components (profile, petty-cash, pending-users, clients, notifications)
- Migration pattern established: component JS in `public/js/components/`, template HTML in `public/templates/`, mounted via `Components.mount()`

## Strategy: module-aligned batches

Migrate in batches grouped by module, prioritized by change frequency and v7 dependency. Each batch is independently shippable — the render map in app.js delegates to either legacy inline or Alpine component seamlessly.

### Batch order

| Priority | Module | Screens | Lines (est.) | Rationale |
|----------|--------|---------|-------------|-----------|
| 1 | Finance | budget, budgetTree, payments, paymentsFin, PI, directPayments, GSTStatement, BOQMapping, BOQVersions, clientBOQ, tallyExport | ~2,500 | v7 recurring payments lands here |
| 2 | Workflow/Schedule | schedule, scheduleView, lookaheadWorkspace, scheduleQuick, scheduleCompliance, gantt, tasks | ~1,800 | High complexity, frequently touched |
| 3 | Site/Field | photos, photoTagReview, materials, materialsSite, labour, labourQuick, queriesSite, forms | ~1,200 | Relatively self-contained |
| 4 | Vendor/Procurement | vendors, vendorsMaster, financeClearance, GRN | ~800 | v7 external consultants lands here |
| 5 | Design/Documents | drawings, register, documents, submittals | ~600 | Stable, lower churn |
| 6 | Reporting | dashboard variants, dailyReports, weeklyReports, weeklySignoff, weeklyHealth | ~1,500 | Read-only screens, lowest risk |
| 7 | Admin/System | users, accountSetup, navEditor, delegations, governance, AISettings, errorsLog | ~800 | Rarely changed |
| 8 | Other | issues, meetings, visits, changes, flags, NCR, claims, comms, measurements | ~1,500 | Mixed modules, do last |

### Per-screen migration checklist

1. Create `public/js/components/<name>.js` — register on `window.Components['<name>']`
2. Create `public/templates/<name>.html` — Alpine directives, no inline JS
3. Move render function body from app.js into component `init()` + methods
4. Replace `API.call()` with fetch wrapper inside component
5. Replace `el.innerHTML = ...` with reactive Alpine data binding
6. Update render map entry in app.js: `'<tab>': () => Components.mount('content-area', '<name>')`
7. Delete the old render function from app.js
8. Test: role-gating, data loading, modal interactions, back-navigation

### Shared concerns (extract before batch 1)

- `API.call()` → standalone `api.js` utility (already used by components)
- `UI.toast()` / `UI.confirm()` → standalone `ui.js` utility
- `csrfHeaders()` → shared helper
- Session/user state (`APP.user`, `APP.projects`) → Alpine store or shared module

### Rules

- No batch larger than 3,000 lines removed from app.js
- Each batch must pass the existing E2E test suite before merging
- Modal callbacks that still call `APP.*` methods are acceptable during migration (shim, don't block)
- No new render functions added to app.js — all new screens go directly to Alpine components

### Success metric

app.js under 200KB (currently 685KB). Final target: app.js is only the render map, navigation, and session bootstrap (~2,000 lines).
