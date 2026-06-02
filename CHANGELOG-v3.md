# nu PMC — v3 Changelog

**Date:** April 19, 2026
**For:** Guru (deployment)
**Supersedes:** v2

---

## High-level summary

v3 is a **correctness, observability, and maintainability** release. No new
product features. Every change makes existing flows safer or makes future
changes cheaper. Users won't notice anything different; Guru will find the
code dramatically easier to work in.

Four big themes:
1. **State-machine enforcement** for payment / CN / weekly-report flows
   (prevents race conditions, invalid transitions)
2. **Offline-resilient writes** — PWA queue that actually works
3. **Shared validation schemas** via Zod — one definition, used in 16 endpoints
4. **Alpine.js migration foundation** — incremental path out of the
   6,169-line `app.js` monolith (Guru's long-haul task)

---

## 1. Schema

| Metric | v2 | v3 | Change |
|---|---|---|---|
| Tables | 89 | 84 | −5 (Fold B: visits+MOMs → meetings) |
| Raw `UPDATE ... SET status` for payment/CN/weekly | ~17 sites | 0 | All routed via state machine |

### Schema surgery
- **Fold A**: `queries` + `ncr` tables folded into `issues` (with `issue_type`
  discriminator). Two routers consolidated into one with `/rfi/*` and `/ncr/*`
  endpoint groups.
- **Fold B**: 8 site-visit/MOM tables (`site_visits`, `site_visit_observations`,
  `site_visit_photos`, `site_visit_report_documents`, `moms`, `mom_action_items`,
  `mom_revisions`, `mom_unlock_log`) collapsed into 4 unified tables
  (`meetings`, `meeting_actions`, `meeting_revisions`, `meeting_photos`) with
  `type` enum (`site_visit`, `internal`, `client`, `design_review`, `principal_visit`,
  `statutory`, `other`) and `visibility` enum (`internal`, `client_draft`,
  `sent_to_client`, `acknowledged`). `snags.raised_from` enum simplified from 5
  values to 3.

### Bugs fixed
- **meetings POST** was inserting into `meeting_type` and `attendees` columns
  that were renamed to `type`, `attendees_internal`, `attendees_external`
  during Fold B — route would have failed at runtime on every MOM create.
- **Site-manager `issues_site` tab** was pointing to a render-map key
  `queries_site` that no longer existed after Fold A. Tab was silently broken.
- Documented payment-request state model didn't match runtime code (runtime
  has a `pending_pmc → naveen_approved` fast-path below threshold; docs showed
  `pending_pmc → pmc_approved → naveen_approved`). State machine and docs
  now match reality.

---

## 2. Routes + services

| Metric | v2 (start of session) | v3 |
|---|---|---|
| Route files | 51 | 47 |
| Service files | 14 | 22 |
| Lines of dead code removed | — | ~590 |

### Routes folded / deleted
- `routes/queries.js` (151 lines) — folded into `routes/issues.js`
- `routes/ncr.js` (83 lines) — folded into `routes/issues.js`
- `routes/visits.js` + `routes/moms.js` — replaced by `routes/meetings.js` (570 lines, cleaner)
- `routes/whatsapp-bot.js` (588 lines) — dead code removed; live `sendDailyExcel` extracted to `services/daily-digest.js`

### New service modules
- `services/notifications.js` — canonical notification layer. Replaced 11+
  `notify*` functions defined 2–3× across 3 files with one definition each.
  22 event functions (`notifyDrawingIssued`, `notifyRFIRaised`, etc.).
- `services/users-lookup.js` — `usersByRole`, `principalPhones`, etc.
  18 scattered SQL queries replaced across 13 route files.
- `services/file-storage.js` — `savePhoto()`, `saveDocument()`. 3 direct INSERT
  blocks consolidated.
- `services/payment-status.js` — status constants + transition docs.
- `services/approvals.js` — central pending-approvals dashboard integration.
  `register()` and `close()` helpers, idempotent on refTable+refId. Wired into
  8 approval sites.
- `services/daily-digest.js` — extracted from dead `whatsapp-bot.js`.
- `services/state-machine.js` — generic state-machine factory (90 lines).
- `services/state-machines.js` — concrete machines for payment requests,
  change notices, weekly reports.
- `services/schemas.js` — 16 Zod request schemas with Indian-format
  primitives (IndianAmount, GSTIN, PAN, IFSC, etc.).

### Middleware hardening
- 21 inline role checks migrated to `requireRole(...)` middleware across
  claims, vendors, finance, register, weekly-health, weekly-signoff,
  measurements, issues, forms, comms, client-boq.
- 38 remaining inline role checks are "capability flag" patterns (role
  branches logic, not pure 403 gates) — intentionally left inline.

---

## 3. Zod validation — 16 endpoints

Request bodies on these endpoints are now validated through a shared schema.
Invalid requests get a structured 400 response with per-field error messages.
Indian-format amounts (`"25,00,000"`) are auto-parsed.

| File | Endpoint | Schema |
|---|---|---|
| finance.js | POST /:project_id/client-receipts | ClientReceipt |
| issues.js | POST /rfi/:project_id | RFICreate |
| issues.js | POST /ncr/:project_id | NCRCreate |
| issues.js | POST /:project_id | IssueCreate |
| payment-requests.js | POST /:project_id | PaymentRequestCreate |
| payment-requests.js | PATCH /:id/pmc-review | PaymentReviewPMC |
| payment-requests.js | PATCH /:id/naveen-review | PaymentReviewNaveen |
| grn.js | POST /:project_id | GRNCreate |
| meetings.js | POST /:project_id | MeetingCreate |
| vendors.js | POST /master | VendorMaster |
| claims.js | POST /:project_id | ClaimCreate |
| budget.js | POST /:project_id/custom-head | BudgetCustomHead |
| invoices.js | POST /:project_id/pi | PICreate |
| payments.js | POST /:project_id/raise | VendorPaymentRaise |
| urgent-payments.js | POST /:project_id | UrgentPayment |
| client-boq.js | PATCH /:project_id/items/:item_id/rate | ClientBOQRate |

**Runtime-verified:** Zod schemas tested with 14 valid/invalid cases — all pass.

New dependency: `zod@^3.23.8` added to `package.json`. Guru runs `npm install`
on deploy.

---

## 4. State machines

All status changes for payment requests, change notices, and weekly reports
now go through enforced state machines. **Zero raw `UPDATE ... SET status`
queries** for these tables.

### Guarantees
- Invalid transitions rejected (e.g. `pending_pmc → paid` without approvals)
  → 400 + `code: "INVALID_STATE_TRANSITION"`
- Concurrency guard — if two clicks race to approve, only one succeeds;
  the other gets a clean error (not a silent overwrite)
- Terminal states (`paid`, `approved`, `sent`, `rejected`) are enforced — no
  "un-approving" a paid payment by accident
- Idempotent replay from offline queue — HTTP 409 treated as already-applied success

### Wired sites (18 total)
- payment-requests.js: urgent auto-approve, PMC reject, PMC escalate,
  PMC fast-path, Naveen review, confirm payment, batch approve (loop)
- payments.js: Naveen batch-approve, UTR webhook paid
- changes.js: signatory (draft→pending_approval), approve, reject
- reports.js: approve, mark-sent, batch approve-all, mitigation unblock
- weekly-signoff.js: all-3-signed→pending_approval, principal approve

---

## 5. Offline sync queue

The PWA service worker had a queue but several real bugs that would have
caused data loss in production.

### Fixes in `public/sw.js`
- **Partial-success bug** — old code cleared ENTIRE queue if any one item
  failed. Now each item is deleted individually on success.
- **Infinite retry** — items now track `attempts`, move to `dead_letter`
  store after 5 tries. No more endless hammering on a permanently failing
  request.
- **No distinction between retryable and permanent errors** — 4xx moves to
  dead-letter immediately (don't retry what the server rejected); 5xx and
  network errors retry with counter.
- **Silent multipart failures** — file uploads were being queued via
  `request.text()` which destroys the binary body. Now returns an explicit
  error so the UI can surface "reconnect to upload".
- **Opportunistic replay on activate** catches cases where user came back
  online while SW was idle.

### New client-side helpers
- `public/js/offline-queue.js` — `window.OfflineQueue` API with status
  indicator, panel UI, manual sync, dead-letter viewer.
- `public/js/api.js` — `API.call` surfaces `{queued, offline}` responses
  with a toast automatically.

---

## 6. Alpine.js migration foundation

`public/js/app.js` is still 6,169 lines of hand-rolled innerHTML string
concatenation. v3 lays the groundwork for incremental migration without
breaking existing screens.

### What exists now
- Alpine 3.14.1 wired in `index.html` (Guru fetches via
  `public/js/vendor/README.md` instructions on first deploy)
- `public/js/components/index.js` — mount helper with template caching,
  component registry at `window.Components`
- **3 reference components** fully working:
  - **Profile** (`profile`) — form, conditionals, async actions
  - **Pending users** (`pending-users`) — list, per-item busy state, refresh
  - **Petty cash** (`petty-cash`) — props, money formatting, role-gated actions
- Each legacy function preserved as `APP._loadXLegacy` — if Alpine fails to
  load (bad deploy, CDN down), the old path still works
- **`ALPINE-MIGRATION.md`** — full recipe for Guru: identify inputs,
  create JS, create template, add shim, test, delete legacy. Ordered list
  of remaining screens by difficulty.

### Delegation plan
Guru picks easy screens first (renderDocuments, renderNotifications,
renderRegister, renderClients) and migrates one per PR using the reference
components as templates. ~45 screens total; work continues across multiple
weeks post-v3 ship.

---

## 7. Developer-facing improvements

### Approvals dashboard wired
`routes/approvals.js` was showing only 3 of 11 approval types. Now every
per-domain approve flow (budget cost-heads, change notices, claims, drawings,
forms, GRNs, meetings/MOMs) calls `services/approvals.js` `register()` to
surface on the central dashboard and `close()` when actioned. Payment
requests still use their own state machine (intentional).

### API duplicate cleanup
`public/js/api.js` — 45 lines of literal duplicate function definitions
removed. 228 lines → 222. Zero duplicates.

---

## Deploy steps for Guru

```bash
# 1. Pull v3
git pull

# 2. Install new deps (Zod added)
npm install

# 3. Fetch Alpine.js
curl -fsSL https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js \
  -o public/js/vendor/alpine-3.14.1.min.js

# 4. Run schema.sql against production (check for new tables: meetings*, etc.)
#    IMPORTANT: Fold A/B involved dropping old tables. Back up first.
#    See Fold A/B notes below for exact table changes.

# 5. Run post-deploy smoke test
./scripts/post-deploy-smoke.sh

# 6. Verify /api/approvals shows approvals from all domains (test with a
#    change notice that's all-signed but not yet approved)
```

---

## Rolling back

If something breaks after deploy:

- **Alpine components** — every migrated screen has `APP._loadFooLegacy`.
  If an Alpine component fails, delete the `if (window.Alpine)` guard in
  `APP.loadFoo` and the screen falls back to the original implementation.
- **State machines** — if an unexpected transition blocks a legitimate flow,
  add the transition to `services/state-machines.js`. Don't remove the
  state machine entirely; the concurrency guard alone is valuable.
- **Offline queue** — if users report queued items disappearing, check
  `public/sw.js` `replayQueue()` — should be deleting only on success. Can
  disable queueing entirely by reverting `api.js` changes.
- **Zod** — if a legitimate field gets rejected, check `services/schemas.js`
  and loosen the constraint. Schemas are in one file, easy to patch.

---

## Files that moved / renamed (for code review)

| Old path | New path | Reason |
|---|---|---|
| routes/queries.js | merged into routes/issues.js | Fold A |
| routes/ncr.js | merged into routes/issues.js | Fold A |
| routes/visits.js | merged into routes/meetings.js | Fold B |
| routes/moms.js | merged into routes/meetings.js | Fold B |
| routes/whatsapp-bot.js | deleted (dead); live fn to services/daily-digest.js | cleanup |

---

## Stats

- Routes: 51 → 47 (−4)
- Services: 14 → 22 (+8 consolidating helpers)
- Schema tables: 89 → 84 (−5 from Fold B)
- Zod endpoints: 0 → 16
- State-machine-enforced flows: 0 → 3 (payment, CN, weekly-report)
- Offline queue bugs fixed: 5
- Alpine reference components: 3
- Dead code lines removed: ~590
- Server routers: 65 (unchanged)

All server-side files pass `node --check`. All client-side JS files pass
`node --check`. State machines and Zod schemas pass runtime tests.
