# nu PMC V5 — Pass 2 Cross-Module Rewrite Findings

**Started:** 24 April 2026
**Scope:** Pattern 2/4/5 — projects, vendors, drawings cluster rewrites

Append-as-I-go log. Format: one bullet per finding at the moment I notice it.

## Findings

- **Transaction context mismatch for checklist writes.** `materials.js` L142/144 uses `conn.query` (inside a `db.transaction()` callback), not `db.query`. My new `Onboarding.functions.setChecklistFlag` uses the module-level `db`, so calling it from inside a transaction callback would bypass the transaction — the UPDATE would commit independently and wouldn't roll back if the outer TX aborts. **Options:** (a) accept an optional `conn` parameter on the helper; (b) leave these two sites as-is (since they need transaction semantics) and rewrite only the non-transactional sites; (c) refactor the calling code to not need the TX here (if the UPDATE is idempotent, it could run outside). Going with (a) — add optional `conn` param to the helper so it becomes transaction-aware.

- **acc-summary.js does 2 round-trips to `projects` for the same project_id.** L113 fetches `status`, L136 fetches `contract_value` — both for the same `pid`, in the same HTTP request handler. One `getProject(pid)` call covers both. Action: fetch once at top of handler, reuse below. Noting this as perf opportunity; the fix is mechanical and I'll do it inline rather than defer, since it fits inside the same rewrite.

- **readiness-gate/service.js: 2 sites intentionally bespoke.** L40 `SELECT id, status, ${cols} FROM projects` uses dynamic column list built from `BLOCKERS` config. L95 `UPDATE projects SET status = 'active'` is a single-caller state write. Designing helpers for these means either (a) a `getProject` that returns every column always (leaks table shape to all callers) or (b) a one-caller `activateProject` that carries no reuse. Neither is a good trade. **Decision: leave both sites as-is; tag for residue list.**

- **payment-requests.js L537 `UPDATE projects SET payment_approval_threshold`** — this is a principal-level admin write, single caller. Could go through a `setProjectThreshold(pid, amount)` helper but again: one caller, no reuse. **Decision: leave for residue.**

- **grn.js L101 had a redundant projects JOIN.** Query selected `p.id AS project_id` but `ve.project_id` already carries that value — the JOIN did nothing except cross the module boundary. Dropped the JOIN entirely, no helper needed. Pure win. Suggests there may be more redundant-JOIN sites in the remaining count; worth a grep for `p.id AS project_id` specifically.

- **I broke a JOIN mid-rewrite in gst-statement.js and had to revert.** Tried to replace `LEFT JOIN clients c ON p.client_id = c.id` with `LEFT JOIN clients c ON cr.client_id = c.id` — but `client_receipts` has no `client_id` column; the client comes via project. Reverted. The receipts query still has `LEFT JOIN projects p` purely to bridge to clients. To fully remove, clients access would need restructuring (either add `client_id` to `client_receipts` at schema level, or move the clients fetch to a helper). Tagging for Pass 3. **Process lesson: when dropping a JOIN, check *all* downstream JOINs that may depend on its aliases.**

- **payments.js webhook L863-870:** bank-account reverse lookup on `vendor.bank_account` with bespoke WHERE filter. Rewriting would require a `getVendorByBankAccount(account)` helper. Single caller, low reuse. Residue.

- **payments.js L779-790:** duplicate-payment-detection query with a vendor_engagement self-subquery (`vendor_engagements` referenced twice in correlated subquery). Can't cleanly map to bulk helpers — the logic IS the query. Residue.

- **payments.js L21-29:** active engagements with payment aggregation. Mixes vendor_engagements (cross-module read) with vendor_payments (same-module). Either add `listActiveEngagementsForProject(projectId)` helper (new) or accept the residue. Deferring — one caller, low reuse.

- **Near-miss in boq-mapping rewrite.** My first attempt replaced a per-engagement `LIMIT 3` correlated subquery with a single query using `LIMIT ${count * 3}` — which is a global limit, not per-group. Would have silently returned wrong previews in edge cases. Caught it on review before committing. Reverted to a per-engagement query loop (N+1 on small N) matching original semantics. **Process lesson: when "optimizing" a SELECT subquery into a single bulk query, check whether the subquery's limit/aggregate was per-row or global. They're not interchangeable.**

- **Second redundant JOIN found in budget.js subquery L44.** `JOIN vendors v ON ve.vendor_id = v.id` was never referenced in the subquery's WHERE or SELECT. Dead code. Dropped, no replacement needed. Two redundant JOINs in two files now (grn.js was first). Suggests a dedicated sweep for dead JOINs could be worthwhile as a separate micro-task.

- **pending.js L195 vendor clearance lookup:** bespoke filter on `vendors.clearance_status = 'pending'`. Needs either `listPendingClearanceVendors()` helper (new, one caller) or stays as residue. Same shape concern as `acc-summary` count-engagements query. Residue.

- **acc-summary L131 count engagements:** `SELECT COUNT(*) FROM vendor_engagements WHERE project_id=? AND is_active=1`. One caller, trivial query. Residue.

- **dashboard.js INNER JOIN → explicit NULL filter.** Original `JOIN drawing_versions dv ON dq.drawing_version_id = dv.id` implicitly excluded issues with null drawing_version_id (INNER JOIN semantics). After removing the JOIN in favor of bulk hydrate, I added `AND drawing_version_id IS NOT NULL` to preserve the original result set. Behavior is equivalent; mechanism changed. Flagging because anyone reading the rewrite without the original context might wonder why the explicit filter is there.

---

## Post-hoc LIVE-DB verification (2026-04-24 session)

Set up MariaDB 10.11 on a unix socket in the sandbox. Single-bash-call pattern: start daemon, load schema, run query, kill daemon — daemon lives only inside one shell invocation, avoiding the teardown issue documented in process lesson v4 #6. Proved to work. **This is the sandbox alternative we'd established and I'd forgotten to use.**

### VERIFIED CORRECT (live SQL against real schema + seed data):
- `countDrawingVersions(projectId, statuses)` — returns 3 for mixed statuses, 1 for 'issued' alone. ✓
- `countDrawingVersions(..., stream)` — filters by stream correctly, returns 2 for design pending. ✓
- `getDrawingContextByVersionIds([100, 102])` — returns correct drawing_number and stream for each version_id. ✓

### REAL BUG FOUND:
- **boq-mapping per-engagement preview query is NOT equivalent to original.** My rewrite uses `SELECT GROUP_CONCAT(bi.item_name) FROM (SELECT boq_item_id FROM vendor_boq_mapping WHERE engagement_id=? LIMIT 3) sub JOIN boq_items bi` — this returns **only 3 items**. The original `SELECT GROUP_CONCAT(bi2.item_name) FROM vendor_boq_mapping vbm2 JOIN boq_items bi2 ... WHERE vbm2.engagement_id=ve.id LIMIT 3` returned **ALL items** because LIMIT 3 applied to the outer SELECT which only ever produced 1 aggregated row. The original LIMIT was a no-op. My "fix" silently changed user-visible behavior. FIXED: boq-mapping.js now concatenates all items, matching original behavior.

- **`total_budget` column does not exist on `projects` table.** Both `getProject` and `getProjectsByIds` in Onboarding contract SELECTed `total_budget` — SQL would fail with "Unknown column 'total_budget'" on every single call. That's 29 call sites that would crash in production. FIXED: removed from both SELECTs. `budget.js` L156+L164 reads `project.total_budget` for a project-budget ceiling guard; since `total_budget` never returned a value (column doesn't exist), that guard has been dead code and continues to be dead code until someone decides whether to map it to `contract_value` or add the column. **Raising as a product decision, not a silent fix.**

- **`setChecklistFlag` whitelist had 2 phantom columns** (`checklist_client_boq`, `checklist_fee_schedule`) — neither exists on the table. No caller uses them today, so no runtime harm, but the whitelist was inaccurate. FIXED: trimmed to 5 real columns.

### REAL BUG FOUND (earlier):

### STILL UNVERIFIED (need follow-up live tests):
- gst-statement.js ORDER BY payment_date + JS secondary sort (ORDER could differ on same-day DATETIME ties)
- All vendor/engagement hydration sites (vendors.*, vendor_engagements.* column names are assumed, not checked)
- All project hydration sites — `getProject` returns specific columns; assumed those columns exist
- Every setChecklistFlag target column (whitelist assumes columns like `checklist_design_boq` exist on projects table)

### Suspicious observed behavior — payments history denies finance_admin
`modules/finance/routes/payments.js` L557–562. The `GET /api/payments/:project_id/history` route declares `requireRole('principal','design_principal','pmc_head','finance_admin')` at L558, then inside the handler at L562 checks `canSeeAmounts = ['principal','design_principal','pmc_head'].includes(me.role)` and returns 403 "Not authorised" if false.

Net effect: finance_admin passes the route gate and then is rejected by an inline check. The reason naming (`canSeeAmounts`) suggests a ₹-visibility restriction, but finance_admin is precisely the role that disburses payments via ICICI bulk — they need to see amounts.

Two interpretations:
1. **Bug:** The inner check should not reject finance_admin; either add them to `canSeeAmounts` list or remove the check.
2. **Deliberate separation-of-duties:** finance_admin can see other payment routes but not the aggregate history view. Keep as-is.

Flagged for user review — not fixing this turn.

### Pre-existing bug #3 — drawings.js L289 SELECT question
`drawings.js` rfi_response branch executes `SELECT question, description FROM issues WHERE id = ?`. The `issues` table has no `question` column (verified via DESCRIBE against live schema). MariaDB rejects with `ERROR 1054: Unknown column 'question' in 'SELECT'`. The code is wrapped in `try/catch` which swallows the error, so the `rfiCheck = await ai.analyseRFIResponse(...)` call receives `undefined` silently — AI check on RFI response drawings never runs.

Not part of cluster-4 refactor scope. Tagged for separate fix pass — one-line query change to drop the non-existent column. Caught during schema verification before helper design.

### Near-miss — audit script silent failure (2026-04-24)

I wrote Layer 3 test seed INSERTs with `query "..." > /dev/null 2>&1 || true` — same swallow-errors pattern that hid the real bugs in mocked tests. The INSERTs failed because I omitted NOT NULL columns (`stream`, `uploaded_by` on boq_versions; `unit` on boq_items). The swallow meant the test block ran against an empty table and the assertion saw NULL instead of 5 items. I interpreted it as "behavior check fails — need to reconsider boq-mapping fix," but the real story was "my fixture setup is broken."

**Process lesson:** `|| true` in any test harness hides exactly the class of bug the harness is meant to catch. Any future INSERTs in audit/test scripts must either (a) have all NOT NULL columns provided and surface errors to stdout, or (b) be wrapped in a heredoc that I check for error output.

Fixed: Layer 3 now uses `mysql <<'BOQSEED' 2>&1 | grep -iE "error|warn"` pattern and all required columns are present.

- **pending.js L92 drawings-overdue query:** specialized SELECT with stream + status + age filter + ORDER BY age DESC + LIMIT 50. Doesn't fit the COUNT helpers added this turn and doesn't fit `getDrawings` (which returns all drawings, not status-filtered). Single caller. Residue.

- **Near-miss: countDrawingVersionsMulti semantics for null vs empty array.** My first draft treated `null` and `[]` identically (both → 0). But in the caller (needs-you.js), `projectIds = null` means "no scope filter, firm-wide count" while `projectIds = []` means "scoped to no projects = trivially 0". Different semantics. Caught when porting design_head/services_head handlers — firm-wide drawing count would have silently been 0 for everyone. Fixed the helper and added a test for the null case. **Process lesson: when replacing a scaffold utility like countWithScope, preserve its exact input semantics (null != empty array).**

- **payment-requests.js rs_override — pre-existing `v.stream` bug preserved by my refactor, now fixed.** Original SELECT was `SELECT v.stream FROM vendor_engagements ve JOIN vendors v ON ve.vendor_id=v.id WHERE ve.id=?`. MariaDB rejects with `ERROR 1054: Unknown column 'v.stream'` — vendors table has no stream column. My refactor faithfully preserved the broken access by calling `getVendorsByIds` and reading `.stream` off the row. In practice `rsOverride = 1` was the result in every case because `requirePrincipal` middleware means `me.role !== 'design_head' && me.role !== 'services_head'` — so the accidentally-always-null stream never changed outcome. Still a latent defect. **Fix:** derive stream from `vendor.trade` via civil/structural/finishes → design, electrical/hvac/plumbing/fire/it/mep → services. Live-DB test added (Pattern 10). Whether the stream-derived logic is actually desired or should be removed pending state-machine design is a product question — but the code is now not relying on a column that doesn't exist.

- **Third pre-existing bug: `DS.getCurrentScheduleSummary` queried `st.status` on schedule_tasks.** No such column — schema has no status field on schedule_tasks. ERROR 1054 at runtime. The helper would crash every time it was called. Found when extending the live-DB audit harness with Cluster 4 fixtures. **Fix:** derive status from each task's latest task_update.pct_complete — pct=100 → completed, 1-99 → in_progress, no updates → not started. `on_hold` cannot be derived without a status source (reported as 0 with a code comment noting this). Live-DB tests added confirming derived-completed=1 and derived-in-progress=1 on the seed fixture.

## Cluster 4 progress (schedule_versions)

- project-setup.js L68: replaced with `hasCurrentScheduleVersion` (1 site)
- approvals.js L84-88: replaced with `promoteScheduleVersion` (3 sites — compound transaction)
- New helpers in DS contract: `getCurrentScheduleVersion`, `hasCurrentScheduleVersion`, `promoteScheduleVersion`
- Fixed bug in pre-existing `getCurrentScheduleSummary`

## Live-DB audit status (final for this session)

Harness: `/home/claude/work/tools/live-db-audit.sh`. Single-bash-call pattern per memory rule #29.
**32/32 checks passing.** Covers all 12 contract helpers (Layer 1) + all 9 rewrite patterns + the vendor-stream fix (Layer 2).
Unit tests: 235/235 still green.

### What this audit proves
- Every helper's SQL runs against real MariaDB with the actual production schema
- Every JOIN→helper rewrite pattern produces the same output the original JOIN produced
- The two bugs surfaced during audit (`boq-mapping LIMIT`, `vendor.stream`) were the ONLY discrepancies found

### What this audit does NOT prove
- Individual callsite correctness in ~80 files — we proved the PATTERNS are equivalent, not that every file applied the pattern correctly. Spot-checks would need to sample these.
- The gst-statement JS-side secondary sort order correctness under DATETIME ties
- Endpoint behavior (HTTP requests returning JSON) — audit is at SQL layer only, not HTTP
