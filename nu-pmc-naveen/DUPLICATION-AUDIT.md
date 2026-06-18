# Duplication Audit — Routes & Handler Bodies

**Scope:** Pass 2 (route-level semantic) + Pass 5 (handler-body similarity). Catalog only — no fixes.

**Method:**
- Enumerated 319 routes across 55 route files with precise `router.(get|post|patch|delete)` regex
- Normalized handler bodies (stripped comments, strings, whitespace, variable names)
- Computed pairwise `difflib.SequenceMatcher` ratios on bodies ≥300 chars (295 of 319)
- Threshold: ≥70% similarity flagged

**Result:** 21 pairs of handlers with ≥70% body similarity. Plus one architectural parallel (`claims.js` ↔ `measurements.js`) which shows structural duplication without hitting body-similarity threshold.

---

## TIER 1 — True duplicates: one handler is near-verbatim of the other

### D-01 — ✅ FIXED 2026-04-21 — `claims.js` pmc-signoff ↔ rs-signoff (97% identical)
- `POST /api/claims/:project_id/:claim_id/pmc-signoff` — claims.js:140
- `POST /api/claims/:project_id/:claim_id/rs-signoff`  — claims.js:167

Both handlers:
- UPDATE `client_claims` setting one of the two signoff columns
- Check if both signoffs now present → transition status to `pending_approval`
- Register on central Approvals dashboard

The only difference is which column gets updated (`pmc_signoff` vs `rs_signoff`) and which column is checked for "other side signed?" (the opposite one) and the text in the response message.

**Resolution option A (extract):** one handler `doSignoff(which)`. POST endpoints call it with `'pmc'` or `'rs'` arg.

**Resolution option B (parameterize the column):** single handler with `:side` param: `POST /:project_id/:claim_id/:side/signoff` where `:side` ∈ {pmc, rs}.

Self-debate: option A is better. Option B makes URLs ugly and invites typos. Extracting a helper inside claims.js keeps the endpoints stable while collapsing ~50 lines of duplication.

### D-02 — ✅ FIXED 2026-04-21 — `issues.js` close-photo-rfi ↔ dismiss (93% identical)

**Deviation from audit plan:** During verification (checklist #21 point 1 — grep every caller) I found that `close-photo-rfi` had **no caller anywhere** — not in frontend, backend, jobs, or webhooks. Plus it used wrong columns: stamped `resolved_by` / `resolved_at` for a `status='closed'` transition, when the v4.4 migration added `closed_by` / `closed_at` as the correct columns.

**Actual fix applied:**
- **Deleted** `PATCH /api/issues/:id/close-photo-rfi` entirely (dead code + schema-semantic bug)
- **Enhanced** `PATCH /api/issues/:id/dismiss` to stamp `closed_by` + `closed_at` + audit log entry (previously stamped nothing)

Cleaner than helper-extraction: a dead endpoint removed AND a live endpoint made correct.
- `PATCH /api/issues/:id/close-photo-rfi` — issues.js:335
- `PATCH /api/issues/:id/dismiss` — issues.js:356

Both handlers do:
```sql
UPDATE issues SET status='closed' WHERE id=?
```

`close-photo-rfi` also sets `resolved_by` and `resolved_at`; `dismiss` doesn't. That's the entire difference.

Resolution: decide if dismissing should also stamp resolved_by/at (audit trail says yes). Then the two are identical — one must be deleted and the other's URL possibly kept if the semantic matters to the UI. Self-debate: `dismiss` is for rejecting a draft; `close-photo-rfi` is for completing a served photo request. Different user intent, same DB outcome. Keep both URLs but have them call one helper `closeIssue(id, reason)`.

---

## TIER 2 — State-transition twins: same table, near-identical body, different status or column

### D-03 — `daily-reports.js` approve ↔ flag (83% similar)
- `POST /api/daily-reports/:id/approve` — daily-reports.js:205
- `POST /api/daily-reports/:id/flag` — daily-reports.js:258

Same "find report, update status, return" pattern with different target status.

### D-04 — `daily-reports.js` approve ↔ batch-approve (75% similar)
- `POST /api/daily-reports/:id/approve` — daily-reports.js:205
- `POST /api/daily-reports/:project_id/batch-approve` — daily-reports.js:233

Batch version is the single version wrapped in a loop. Classic "singular + plural" duplication. Resolution: batch endpoint calls the singular handler in a transaction.

### D-05 — `daily-reports.js` approve ↔ `issues.js` close (72%)
- `POST /api/daily-reports/:id/approve`  — daily-reports.js:205
- `PATCH /api/issues/:id/close`          — issues.js:214

Both do "load entity, check valid state, permission check, UPDATE status, audit log, respond." Cross-entity pattern — not a fix target but suggests a shared `transitionStatus(table, id, from, to, actor)` helper would clean up half a dozen handlers.

### D-06 — `meetings.js` acknowledge ↔ complete (83%)
- `PATCH /api/meetings/action-items/:id/acknowledge` — meetings.js:435
- `PATCH /api/meetings/action-items/:id/complete`    — meetings.js:466

Both UPDATE `meeting_actions` setting a different timestamp + status. Same shape.

### D-07 — `reports.js` list ↔ weekly/documents list (80%)
- `GET /api/reports/:project_id`              — reports.js:22
- `GET /api/reports/:project_id/weekly/documents` — reports.js:320

Both: fetch project, SELECT list JOIN users, ORDER BY date. Different tables. Classic list-endpoint duplication.

### D-08 — `reports.js` approve ↔ mark-sent (72%)
- `POST /api/reports/:id/approve`    — reports.js:220
- `POST /api/reports/:id/mark-sent`  — reports.js:246

Both are status transitions on `weekly_reports`.

---

## TIER 3 — List-endpoint scaffolding duplicates (same "fetch list joined to users, order by date" pattern)

These aren't true duplicates — they fetch different tables — but they copy/paste the same 15-line scaffold. Extracting a `listByProject(table, joins, orderBy)` helper would collapse ~100 lines. Not a correctness bug; maintenance debt.

| Pair | Similarity |
|---|---|
| `photos.js` main list ↔ documents list | 87% |
| `finance.js` direct-payments ↔ `reports.js` list | 76% |
| `photos.js` documents ↔ `reports.js` mom-items | 76% |
| `grn.js` list ↔ `submittals.js` list | 75% |
| `reports.js` list ↔ `schedule.js` versions | 74% |
| `changes.js` list ↔ `reports.js` list | 74% |
| `finance.js` direct-payments ↔ `reports.js` weekly/documents | 73% |
| `changes.js` list ↔ `schedule.js` versions | 73% |
| `photos.js` documents ↔ `project-setup.js` documents | 72% |
| `photos.js` main ↔ `reports.js` mom-items | 72% |
| `changes.js` list ↔ `grn.js` list | 72% |
| `finance.js` direct-payments ↔ client-receipts | 71% |

**Self-debate:** worth extracting? Pro — would cut ~100 lines, make list endpoints 3-line one-liners. Con — the queries differ in JOIN shape, WHERE filters, columns selected. A generic helper would need so many parameters it becomes harder to read than the copies. Better candidate: extract only the "fetch project + resolve user names" boilerplate, keep the SELECT inline.

---

## TIER 4 — Framework-pattern twins (approve / reject / revoke)

These are structurally the same but semantically different operations on different entities. Not duplicates — consistent application of a pattern. Noted for completeness.

| Pair | Similarity | Verdict |
|---|---|---|
| `budget.js` cost-heads approve ↔ `forms.js` templates approve | 73% | Different entities, standard approve pattern |
| `delegations.js` revoke ↔ `users.js` deactivate | 70% | Both "soft-delete" but on different tables |
| `vendors.js` engagement approve ↔ reject | 79% | Approve/reject twin — candidate for `doDecision(action, reason)` helper |

---

## ARCHITECTURAL PARALLEL (flagged separately)

### P-01 — `claims.js` ↔ `measurements.js` are near-mirror modules

Route maps:
```
claims.js (8 routes)         measurements.js (7 routes)
─────────────────────        ───────────────────────────
GET    /:pid                 GET    /:pid
GET    /:pid/:X/items        GET    /:pid/:X/items
POST   /:pid                 POST   /:pid
POST   /:pid/:X/items        POST   /:pid/:X/items
POST   /:pid/:X/pmc-signoff  ─   (no pmc-signoff)
POST   /:pid/:X/rs-signoff   POST   /:pid/:X/rs-signoff
POST   /:pid/:X/approve      POST   /:pid/:X/client-acceptance
PATCH  /:pid/:X/invoice-num  GET    /:pid/:X/certificate
```

The two modules are implementations of the same lifecycle applied to different entities:
- **measurements** — R/S engineer records → R/S signs off → client accepts → certificate
- **claims** — PMC adjusts measurements to claim → PMC + R/S sign off → principal approves → invoice

Individual handler-body similarities pairwise ≤66% (not above threshold for D-tier) because column names differ. But the architectural shape is identical: "raise draft → attach line items → two-party signoff → final approval."

Handler-body pairs between the two files that scored above 50%:
- `POST /:pid` raise draft: 55%
- `POST /:pid/:X/items` attach items: 66%
- `POST /:pid/:X/rs-signoff`: high structural similarity (both use same `STREAM_HEADS` pattern)

**Resolution candidate:** extract a shared module `services/two-party-signoff.js` that both routers use. Or accept this as the cost of domain-specific route files and leave it. Self-debate: the parallel is so clean it's suspicious — the app may have been built by copy-pasting `measurements.js` to `claims.js`, then diverging. Worth inspecting git history (if available) to confirm intent. If confirmed, the abstraction is warranted.

---

## SUMMARY OF ACTIONABLE DUPLICATES

Ranked by cleanup value:

1. **D-01** — claims.js pmc/rs-signoff (97%) — clearest quick win, extract helper, ~50 lines saved
2. **D-02** — issues.js close-photo-rfi/dismiss (93%) — decide semantics then merge
3. **D-03, D-06** — approve/flag and ack/complete twins — extract `transitionStatus()` helper
4. **D-04** — daily-reports batch-approve wraps singular — refactor to call singular in loop
5. **D-07, D-08** — list + status transitions inside `reports.js` — local cleanup
6. **Tier 3 cluster** — list-endpoint scaffolding — low-value, skip unless doing a rewrite
7. **P-01** — claims/measurements architectural parallel — large refactor, defer to v4

## Self-debate on the audit method

- **Pro:** Normalized + sequence-matched is deterministic and reproducible. Found the 97% claims signoff pair which a human scanner could easily miss across 8 routes.
- **Con:** 70% threshold is a judgment call. Lowered to 60% would add ~30 more pairs, most noise. Raised to 80% would miss the approve/flag twins. 70% was tuned by eyeballing the top results.
- **Not caught:** Handlers that do the same thing but with completely different SQL (e.g. two different ways of computing a running-account total). Pass 5 is syntax-based; semantic equivalence with different code shape passes through undetected. This is the gap that needs pass 3 (semantic duplicates) if you want full coverage.
- **False positives in Tier 3:** most of these are "same scaffolding, different data." Whether to extract or leave in place is a style choice, not a correctness matter. Flagged for completeness.

## Method-level self-check (checklist #21)

1. grep every function written this session — `normalize_body`, `similarity`, `extract_table`, `extract_verbs`, `is_framework_legit`. All scoped to scan scripts, not production code.
2. grep every DB table referenced — N/A (audit script, no DB writes)
3. grep every new route path — N/A (no new routes)
4. Walk full request→response — N/A (audit only)
5. End-to-end walkthrough — the scan results were verified by hand-inspection on top 3 pairs (D-01, D-02, claims/measurements parallel). Confirmed real.
