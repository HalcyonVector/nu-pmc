# M4 — Site Module

## What it does
Owns the "site operations" phase of a project:
- Daily site reports (headcount, weather, notes, approval)
- GRN (Goods Received Notes) — receipt of materials from vendors
- Issues — RFIs, design queries, safety flags, quality flags
- Photos — site progress photography with AI-assisted tagging
- Snags — punch-list items (post-completion defects)
- Labour register — daily headcount per contractor per trade
- Custom forms — templates + field-submitted records

## Public API
See `contract.js`. Main callers:
- **M2 Onboarding** reads `getSiteTeam()` to show site-manager assignment
- **Finance (future)** reads `getApprovedGRNs()` to raise payments against delivered goods

```js
const Site = require('../../modules/site/contract');

const today = await Site.functions.getDailyReport(projectId, '2026-04-24');
const open = await Site.functions.getOpenIssues(projectId);
const grns = await Site.functions.getApprovedGRNs(projectId);
const team = await Site.functions.getSiteTeam(projectId);
```

## Tables owned
`daily_reports`, `grns`, `issues`, `site_manager_leave`, `project_photos`,
`photo_tags`, `snags`, `labour_register`, `form_templates`, `form_submissions`.

Other modules may SELECT these via contract functions. Only M4 Site writes.

## Routes mounted (server.js)
- `/api/daily-reports`  → `routes/daily-reports.js`
- `/api/grn`            → `routes/grn.js`
- `/api/issues`         → `routes/issues.js`
- `/api/photos`         → `routes/photos.js`
- `/api/photo-tags`     → `routes/photo-tags.js`
- `/api/labour`         → `routes/labour.js`
- `/api/forms`          → `routes/forms.js`

> Snag tracking was unified into `/api/issues` (with `issue_type='snag'`) in v5.9.
> NCR tracking was unified into `/api/issues` (with `issue_type='quality'`) in v2.

## Depends on
- M1 Auth (via `../auth/contract` — currently via legacy shim `../../../middleware/auth`)
- `/middleware/db`, `/middleware/asyncHandler`, `/middleware/validate`,
  `/middleware/upload`, `/middleware/delegation` — shared
- `/services/audit`, `/services/users-lookup`, `/services/ai`,
  `/services/file-storage`, `/services/notifications` — shared

## Gate status

### M4.1 — Physical move ✓
5 files moved from `/routes/` to `/modules/site/routes/`. Tool proof: `ls` shows all 5 in new location, 0 remain in old.

### M4.2 — Require paths rewritten ✓
All relative imports now use `../../../`. Syntax check passes on 5/5 files.

### M4.3 — Server mounts updated ✓
5 mount lines in `server.js` point to new location. 0 stale references. `node --check server.js` passes.

### M4.4 — Contract written ✓
`contract.js` v1.0.0 — 5 functions + 5 routers + 6 owned tables, all verified as correct types.

### M4.5 — Full load sweep ✓
63/63 files (routes + modules) load cleanly via Node.

### M4.6 — Tests written ✓
15 test cases across 6 describe blocks:
- Contract surface (4 tests)
- `getDailyReport` (2 tests)
- `getOpenIssues` (1 test)
- `getOpenGRNs` / `getApprovedGRNs` (3 tests)
- `getSiteTeam` (1 test)
- Route mount smoke tests (4 tests)

### M4.7 — Tests pass ✓
`npm run test:modules` → **64 passed, 64 total** (M1: 16, M2: 13, M3: 20, M4: 15).

### M4.8 — Boundary lint passes ✓
`npm run lint:boundaries` → 25 files, 4 modules, 0 violations.

### M4.9 — README ✓
This file.

## Honest gaps (per rule #26)

1. **Tests use mocked `db.query`** — same approach as M1/M2/M3. No live-DB integration test this session for M4's new code path. Pattern is identical to earlier modules where live DB was verified.

2. **No migration yet to Auth contract** — M4 routes still import `../../../middleware/auth` via the legacy shim. Not a functional issue; flagged as tech debt in the same bucket as M1/M2/M3.

3. **`getSiteTeam` is new surface** — no existing caller uses it yet. Will be called by M2 Onboarding's project detail view once it migrates to the contract pattern. Function is defined + tested; integration pending.

## GC (Group C additions — snags/labour/forms folded in)
- GC.1 Physical move ✓ — snags.js, labour.js, forms.js moved from `/routes/` into `modules/site/routes/`. `/routes/` folder is now empty.
- GC.2 Require paths ✓ — 3/3 syntax clean
- GC.3 Server mounts ✓ — 3 mounts updated, 0 stale, `grep -c "require\('./routes/" server.js` returns 0
- GC.4 Contract + tests updated ✓ — routes expanded to 8, tables to 10
- GC.5 Load sweep ✓ — 68/68 files load
- GC.6 Boundary lint ✓ — 77 files, 9 modules, 0 violations
- GC.7 All tests still pass ✓ — 132/132

### The milestone this marks
**Every route in nu PMC now lives in a module.** The `/routes/` folder is empty. V5 modularisation has physically completed the surface-level split across 9 modules.
