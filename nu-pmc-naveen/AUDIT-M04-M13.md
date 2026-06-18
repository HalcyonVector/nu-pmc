# M04–M13 Audit — Running Bug Journal

Each finding has:
- **ID** (module code + number)
- **Severity** (CRIT / HIGH / MED / LOW / NOTE)
- **Category** (security / broken / dead-code / data / UX / governance)
- **Module** (M04 ... M13)
- **Location** (file:line)
- **What's wrong**
- **Impact**

Solutions + self-debate will follow at the end.

---

## CROSS-MODULE FINDINGS (affect multiple modules)

### XM-01 — 6 duplicate APP function declarations (dead code)
**Severity:** MED · **Category:** dead-code
- `APP.renderGSTStatement` (×2) — M12
- `APP.renderBudgetTree` (×2) — M12
- `APP.rejectUser` (×2) — M01
- `APP.loadGSTStatement` (×2) — M12
- `APP.downloadGSTStatement` (×2) — M12
- `APP.approveUser` (×2) — M01
**Impact:** Last-declared wins (JS hoisting doesn't apply to assignments), so earlier copies are pure dead code. No user-visible bug today — but maintenance risk: editing the first copy has no effect.

### XM-02 — 8 render-map tabs unreachable from ANY role's sidebar
**Severity:** MED · **Category:** UX / dead-code
- `documents`, `gantt`, `monthly`, `project_detail`, `requests`, `schedule`, `pct_complete`, `user_id`
**Note:** Last two look like field-name false positives from my regex (not actual tab names). Real orphans: `documents`, `gantt`, `monthly`, `project_detail`, `requests`, `schedule`.
**Impact:** Render functions exist and run but can never be triggered. Either dead code or pending features not wired yet.

### XM-03 — 10 orphan APP functions (declared, never called)
**Severity:** LOW · **Category:** dead-code / v4-pending
- `checkClientDuplicate`, `checkVendorDuplicate`, `checkSimilarQueries`
- `draftCNText`, `getWeatherForReport`, `loadFeeSchedule`
- `lookupPAN`, `readInvoice`, `suggestHSN`
- `expandVendor` (just-kept for future mobilisation UI)
**Impact:** No user-visible bug. All look like v4 AI-helper features with code written but not wired.

### XM-04 — 4 dead schema columns on `boq_items`
**Severity:** LOW · **Category:** data / dead-column
- `bank_verified`, `bank_verification_sent_at`, `vendor_confirmed_at`, `payment_eligible`
**Impact:** Schema column present, never populated or read. Safe to leave; remove in cleanup sweep.

### XM-05 — 30+ ungated sensitive GET endpoints across modules
**Severity:** HIGH · **Category:** security
Files with one or more GETs that lack middleware role gate AND have no in-handler check:
- `auth.js`:1 (`/me` — but this is the session check, intentional)
- `changes.js`:1, `dashboard.js`:1, `delegations.js`:3
- `drawings.js`:1, `forms.js`:3, `gantt.js`:1, `grn.js`:1
- `issues.js`:4, `labour.js`:1, `lookup.js`:3
- `meetings.js`:3, `photo-tags.js`:2, `photos.js`:2
- `pmc-deputy.js`:1, `project-setup.js`:2, `projects.js`:1
- `register.js`:2, `schedule.js`:3, `snags.js`:1
- `submittals.js`:1, `urgent-payments.js`:1
- `weekly-health.js`:1, `weekly-signoff.js`:1

**Impact:** An authenticated user can read these via URL even if their sidebar doesn't link to the tab. Sidebar filter is cosmetic for these endpoints.
**Need to check per endpoint:** some are intentionally open (project metadata that everyone on project needs); others are genuine leaks.

### XM-06 — 7 files have in-handler role checks not using middleware
**Severity:** HIGH · **Category:** security / audit-bypass
- `client-boq.js` (2 sites) — rate/HSN patch endpoints
- `clients.js` (8 sites) — all gated, but in-handler
- `comms.js` (1 site)
- `measurements.js` (5 sites)
- `users.js` (1 site)
**Impact:** These are actually gated. BUT — audit role's bypass only works for `requireRole` middleware, not in-handler checks. So audit user would 403 on these read endpoints even though they should see them. Violates the "audit can read everything" principle.


---

## M04 — BOQ MAPPING

### M04-01 — `showAssignBOQ` passes vendor_id as engagement_id (CRIT)
**Severity:** CRIT · **Category:** broken
- My new engagement card (line 2455): `onclick="APP.showAssignBOQ(${pid},${e.vendor_id})"`
- `submitBOQAssign(pid, vendorId)` calls `API.assignBOQ(pid, vendorId, data)`
- `API.assignBOQ: (pid, eid, d) => ...{ engagement_id: eid ...}` — names second arg `eid`
- Backend POST /boq-mapping/:pid expects `engagement_id`, fails FK or corrupts mapping
**Impact:** Every BOQ Map click from a card either 404s or creates wrong mapping. Feature unusable.

### M04-02 — `our_cost_rate` collected in UI but never sent to backend (HIGH)
**Severity:** HIGH · **Category:** broken
- `showAssignBOQ` modal: "Our Cost Rate" input field `id="boq-rate"`
- `submitBOQAssign`: reads `our_cost_rate` from input
- `API.assignBOQ`: drops it. Only sends `engagement_id + boq_item_ids + notes`
- Backend table `vendor_boq_mapping` has no `our_cost_rate` column
- Backend table `vendor_boq_items` HAS `our_cost_rate` column but nothing writes to it
**Impact:** User enters a rate; it goes nowhere. Silent data loss.

### M04-03 — `vendor_boq_items` is a dead table (HIGH)
**Severity:** HIGH · **Category:** data / dead-table
- Referenced in SELECT by budget.js (5 sites), payments.js (2 sites), budget-check.js (3 sites)
- No INSERT anywhere in the codebase
- Always returns empty, making budget-check and payment-rate calculations always miss vendor cost data
**Impact:** Budget variance calculations ignore actual vendor cost rates; payment validation cannot use vendor contract rates. Data model incomplete.

### M04-04 — boq-mapping role gate is PMC-only, excludes heads (MED)
**Severity:** MED · **Category:** governance
- All 4 routes gated to `requirePMC` = [principal, design_principal, pmc_head]
- Design_head and services_head cannot view/create BOQ mappings for their stream
- But our earlier M01 discussion said "BOQ Map visible to heads + PMC + principals"
- `boq_mapping` tab IS in their ROLE_TABS, but backend 403s
**Impact:** Heads see tab, tap it, get "Insufficient permissions" or empty data.

### M04-05 — AI fallback keyword-match returns confidence 0.6 uniformly (LOW)
**Severity:** LOW · **Category:** UX
- In boq-mapping.js line 101-110, when AI is unavailable, fallback suggests with hardcoded `confidence: 0.6`
- UI renders "60% confidence" for every fallback match — misleading since it's not actually computed
**Impact:** Low-trust signal dressed up as medium-trust.

### M04-06 — `showManualBOQMap` pulls client BOQ items via `data.boq_items` from /boq-mapping endpoint (NOTE)
**Severity:** NOTE · **Category:** data-shape
- `showManualBOQMap` at app.js:6227 filters `data.boq_items.filter(b => !b.is_section)` — looking for client BOQ items
- Backend `GET /boq-mapping/:pid` returns `boq_items` from `boq_items` table filtered `is_section=0` ✓
- So: uses internal BOQ items (materials BOQ), not client BOQ items (client_boq_items). The mapping concept per schema (vendor_boq_mapping) maps vendor engagements to client BOQ items.
- Schema comment says: `boq_item_id INT UNSIGNED NOT NULL, -- client BOQ item` — but code uses internal `boq_items.id`
**Impact:** Mapping is saved against internal BOQ IDs, not client BOQ. If both tables have overlapping IDs, mapping works for internal but not client billing.

---

## M05 — SCHEDULE

### M05-01 — `POST /:pid/update` has no role gate (HIGH)
**Severity:** HIGH · **Category:** security
- Line 84: `router.post('/:project_id/update', requireAuth, validators.taskUpdate, ...)`
- No middleware role check, no in-handler check
- traineeGuard blocks trainees by method (only GET allowed for trainees per blocked path list, but `/api/schedule` isn't in trainee's blocked list)
**Impact:** A coordinator, team_lead, jr_architect, detailing_head — anyone authenticated except trainee — can post fake task progress. The regression check fires only on backward movement; forward-progress fraud possible.
**Who should?** Site managers, PMC, principals (matches the in-handler check in the PATCH variant at line 287).

### M05-02 — Two endpoints do the same thing; PATCH has in-handler role check, POST has none (MED)
**Severity:** MED · **Category:** broken / drift
- `POST /:pid/update` (body carries task_id) — no role gate
- `PATCH /:pid/tasks/:task_id/progress` (task_id in path) — in-handler role check
- Both INSERT task_updates, both do regression check — near-duplicate code
**Impact:** The same operation has two security postures. Code drift risk.

### M05-03 — Schedule GETs ungated (auth-only). Trainees can read project schedules (LOW)
**Severity:** LOW · **Category:** security
- `/:pid`, `/:pid/lookahead`, `/:pid/versions` all `requireAuth` only
- Trainees can see what every project is doing. Is that intentional?
**Impact:** If schedule content is considered internal-only, this is a leak. If it's operationally-necessary visibility (trainees shadowing PMC work), it's fine.

### M05-04 — `renderSchedule` uses `APP.user.projects?.[0]?.id`, ignores state.selectedProject (LOW)
**Severity:** LOW · **Category:** broken / UX
- Line 545: `const pid = APP.user.projects?.[0]?.id`
- If site manager has multiple projects assigned, they can only see schedule for the FIRST one
- If principal/head selects a project via switcher, schedule still shows first project in their list (which is empty since they have no projects assigned array — and they'd see "No project assigned")
**Impact:** Principals can't see project-specific schedules from this renderer. Site managers with multiple projects can't switch.

### M05-05 — `gantt` and `monthly` tabs in render map but no role sees them (dead)
**Severity:** LOW · **Category:** dead-code
- Mentioned in cross-module XM-02
- `renderGantt`, `renderMonthly` functions exist, never reachable via sidebar
**Impact:** Dead features.

### M05-06 — `validate` endpoint has typo risk — status param not in whitelist (NOTE)
**Severity:** NOTE · **Category:** safe-but-watch
- Line 128-131: `if (!['validated', 'rejected'].includes(status))` — whitelist is correct
- No issue, just noting the pattern.


---

## M06 — DRAWINGS + REGISTER

### M06-01 — GET /view/:version_id no role gate (MED)
**Severity:** MED · **Category:** security
- `routes/drawings.js:521` — streams drawing file by version_id; any authenticated user
- Trainees, coordinators, etc. can open any drawing across projects by guessing version IDs
**Impact:** Drawings leak across project boundaries. Design IP exposure.

### M06-02 — GET /:project_id/:drawing_id/history no role gate (LOW)
**Severity:** LOW · **Category:** security
- `routes/drawings.js:69` — shows revision history including who flagged what
- Auth-only; same cross-project issue as above

### M06-03 — GET /register/:project_id no role gate (MED)
**Severity:** MED · **Category:** security
- `routes/register.js:25` — full drawing register for the project, all categories, all status
- Auth-only
**Impact:** Any user can read another project's drawing register; shows all pending drawings by stream.

### M06-04 — `POST /version/:id/approve` uses `canApproveDrawing(me, dv)` in-handler (OK)
**Severity:** NOTE · **Category:** safe
- Helper returns false for audit role (I fixed it in the audit-role arc)
- Non-middleware but correctly gated. No action needed.

### M06-05 — `/register` bulk-upload role permissive? (check)
**Severity:** NOTE · **Category:** pending
- `POST /register/:pid/upload` — not inspected deeply this pass. Backend upload allowed roles not verified.
- Needs second pass for audit completeness.

### M06-06 — Drawing upload allows cross-stream via category trick (NOTE)
**Severity:** NOTE · **Category:** security-minor
- Stream is derived from category name: "Architectural"→design, else→services
- A design_head could upload an "Electrical" drawing which is categorised as services; they would 403 on upload check. Good.
- A services_head uploading an "Architectural" drawing would 403. Good.
- BUT — category is a free string. If user types "Civil Drawing" instead of exactly "Civil", the `designCats.includes` exact-match fails and it becomes services-stream.
**Impact:** UI-level risk if category dropdown is open-ended.


---

## M07 — GRN

### M07-01 — GET /grn/:pid no role gate (LOW)
**Severity:** LOW · **Category:** security
- `routes/grn.js:16` — auth-only
- Lists all GRNs for project, visible to anyone authenticated
**Impact:** Cross-project GRN visibility via URL. Ad-hoc purchase leakage risk is low; purchase order values visible.

### M07-02 — POST /grn/:pid no role gate (MED)
**Severity:** MED · **Category:** security
- Line 29: auth-only, no handler role check
- Anyone authenticated can raise a GRN. Even design_head, coordinator, trainee.
- Should be: site_manager, senior_site_manager, PMC, principals
**Impact:** Fake GRN creation possible. Note — GRN triggers approval workflow and budget burn, but approval gate catches it upstream of actual spend.

### M07-03 — PATCH /:id/approve in-handler role check (NOTE)
**Severity:** NOTE · **Category:** safe
- Correctly allows senior_site_manager (with 5% threshold), pmc_head, principals
- 5% threshold enforcement looks correct
- Audit bypass not relevant (write operation blocked by blockAuditWrites globally)

### M07-04 — GET /:id/flag-nonconformance/preview no role gate (LOW)
**Severity:** LOW · **Category:** security
- Auth-only, reveals GRN internals

### M07-05 — PATCH /:id/flag-nonconformance auth-only handler (MED)
**Severity:** MED · **Category:** security
- Line 233: no role check
- Anyone authenticated can flag non-conformance, which has downstream implications for vendor reputation
- Should be: site_manager and up


---

## M08 — ISSUES / RFI / NCR

### M08-01 — GET /issues/:pid and /rfi/:pid and /ncr/:pid no role gate (LOW)
**Severity:** LOW · **Category:** security
- 3 list endpoints auth-only
- Cross-project issue visibility via URL
**Impact:** Issues table exposes commentary and names; minor leak.

### M08-02 — POST /issues/:pid no role gate (MED)
**Severity:** MED · **Category:** security
- Line 58: auth-only
- Any authenticated user can raise an issue against any project
- Safety issues route to PMC, design issues to design heads
- Trainees raising ISS-nnn on projects they're not assigned = noise + potential harassment

### M08-03 — GET /:id/photos no role gate (LOW)
**Severity:** LOW · **Category:** security
- Line 276: auth-only, list of photos attached to any issue
- Cross-project photo leak

### M08-04 — POST /photo-rfi no role gate in middleware, in-handler check (MED)
**Severity:** MED · **Category:** security
- Any authenticated user can raise a photo-RFI which gets auto-routed to a head
- No raise-role restriction

### M08-05 — PATCH /:id/resolve in-handler role check (NOTE)
**Severity:** NOTE · **Category:** safe
- Allows assignee OR 7 roles listed in-handler
- Correct pattern, not a gap

### M08-06 — RFI endpoints POST /rfi/:pid and /close/assign/answer auth-only (MED)
**Severity:** MED · **Category:** security / governance
- Line 331 `POST /rfi/:pid` — auth only, anyone can raise
- Line 386 `POST /rfi/:id/answer` — auth only, anyone can answer an RFI (should be head/principal on the stream)
- Line 397 `POST /rfi/:id/close` — auth only, anyone can close
**Impact:** Design governance breaks. Trainees can "answer" RFIs, closing them with nonsense. Bugs trail/legal implications for drawing queries.

### M08-07 — NCR creation requires PMC (OK)
**Severity:** NOTE · **Category:** safe
- `POST /ncr/:pid` has `requirePMC` middleware — correct
- `PATCH /ncr/:id/resolve` has `requirePMC` — correct


---

## M09 — MEETINGS / MoMs

### M09-01 — GET /meetings/:pid, /:id/action-items, /:meeting_id/documents no role gate (LOW)
**Severity:** LOW · **Category:** security
- Three GETs auth-only
- Client meeting details cross-project leak

### M09-02 — POST /:pid create MOM no role gate (MED)
**Severity:** MED · **Category:** security
- Line 48: auth-only
- Any authenticated user can create a draft MOM on any project
- Downstream protection: only PMC+ can approve/issue-to-client — catches before client notification
- But drafts clutter project feeds and can be forged
**Impact:** Governance pollution. Recommend restricting raise to site+PMC+heads+principals.

### M09-03 — PATCH /:id edit draft — in-handler check (NOTE)
**Severity:** NOTE · **Category:** safe
- Allows author OR principal only — correct

### M09-04 — POST /:pid/site-visit no role gate (MED)
**Severity:** MED · **Category:** security
- Line 488: auth-only
- Anyone can log a site visit on any project
- Same as M09-02 — restrict to site managers + PMC + heads + principals

### M09-05 — Observation POST no role gate (MED)
**Severity:** MED · **Category:** security
- Line 503: auth-only
- Anyone can add observations (which become action items) to any meeting

### M09-06 — Action item complete/acknowledge/countersign auth-only (NOTE)
**Severity:** NOTE · **Category:** safe
- These are assignee-scoped by design (whoever the action item is for)
- Role-free on purpose. The action item already carries the assignee_id — handler should verify me.id == assignee_id. Let me spot-check:


---

## M10 — PAYMENTS

### M10-01 — POST /utr-webhook — webhook secret requirement (NOTE)
**Severity:** NOTE · **Category:** safe
- Line 758: verifies X-Webhook-Secret header or ?secret= query against ICICI_WEBHOOK_SECRET env var
- Hard-refuses (503) if env var not set — correct fail-closed behaviour
- UTR webhook is the one legitimate unauthenticated endpoint
- WATCH: webhook secret can be exposed via ?secret= URL query — gets logged in access logs. Recommend header-only.

### M10-02 — /confirm-payment has in-handler role check (NOTE)
**Severity:** NOTE · **Category:** safe
- Line 445: finance_admin + principals only — correct
- But in-handler pattern (doesn't use requireFinance middleware). Should migrate for consistency.

### M10-03 — /pre-upload-check has in-handler role check (NOTE)
**Severity:** NOTE · **Category:** safe
- Line 668: finance_admin + principals only — correct
- Same pattern drift as M10-02

### M10-04 — Payment history GET at payments.js:509 uses `requireAuth` then in-handler filter (NOTE)
**Severity:** NOTE · **Category:** review
- Probably filters by role to show only what user should see — need deeper inspection

### M10-05 — batch-approve on payments.js (Principal only) vs payment-requests.js (PMC) (MED)
**Severity:** MED · **Category:** governance / drift
- `payments.js:638` POST /batch-approve uses `requirePrincipal`
- `payment-requests.js:574` POST /batch-approve uses `requirePMC`
- Two endpoints with similar names but different role gates — confusing, risk of pointing to wrong one from UI

### M10-06 — Payments already correctly mapped to vendor clearance + engagement approval gates (done in M01/M03)
**Severity:** NOTE · **Category:** safe
- M01 vendor clearance gate + M03 engagement approval gate both live in POST /payment-requests/:pid
- Correct defence-in-depth


---

## M11 — REPORTS

### M11-01 — DUPLICATE route `POST /:project_id/approve-all` (HIGH)
**Severity:** HIGH · **Category:** broken / drift
- `reports.js:281` first registration (not using asyncHandler)
- `reports.js:396` second registration (using asyncHandler)
- Express registers BOTH handlers but only the FIRST matches
- So line 396 is effectively dead code
- But the naming collision suggests someone intended to replace the earlier one but forgot to delete it
**Impact:** Maintenance confusion. Editing the second has no effect. Remove or rename one.

### M11-02 — `/:id/mark-sent` auth-only (LOW)
**Severity:** LOW · **Category:** security
- Any authenticated user can mark a report as "sent to client"
- Status transition is state-machine-guarded so only specific status→sent transitions allowed
- But no role restriction — trainee could mark any report sent
- Should be PMC or site manager who physically sent the report

### M11-03 — `/:id/ack-anomaly` auth-only (LOW)
**Severity:** LOW · **Category:** security
- Anyone can acknowledge an anomaly flag
- Should be PMC or principal

### M11-04 — Reports reading properly gated with REPORT_READER_ROLES (NOTE)
**Severity:** NOTE · **Category:** safe
- Done in Phase 6 (M01 audit closure)
- Confirmed working


---

## M12 — FINANCE

### M12-01 — POST /finance/:pid/client-receipts auth-only (HIGH)
**Severity:** HIGH · **Category:** security / money
- `finance.js:122` no role gate
- Records money coming in from client — TDS deducted, net received, UTR
- Anyone authenticated can insert fake client receipts into the ledger
**Impact:** Direct fraud path. Fake receipts inflate cash inflow, downstream GST and tally reports corrupt.
**Should be:** finance_admin + principals

### M12-02 — POST /claims/:pid auth-only (HIGH)
**Severity:** HIGH · **Category:** security / governance
- `claims.js:92` no role gate for raising client claim (the basis for RA bill to client)
- Any authenticated user can raise a draft claim
- Does check measurement.status = 'client_accepted' first, which helps
- Two downstream sign-offs (PMC + R/S) catch fraud before approval
- But draft creation itself is unrestricted; pollution risk

### M12-03 — /claims/:id/approve uses in-handler principal check (NOTE)
**Severity:** NOTE · **Category:** drift
- Line 194: in-handler check instead of requirePrincipal middleware
- Correct effect, inconsistent with codebase pattern

### M12-04 — client-boq.js rate/hsn PATCH uses in-handler check (MED)
**Severity:** MED · **Category:** security / audit-bypass
- Lines 127, 143: CLIENT_RATE_ROLES.includes(me.role) check in-handler
- Correct effect, but audit bypass can't reach it
- Audit user would 403 even on legitimate read (though these are PATCH so audit blocked anyway)
- Hidden issue: if audit needs to preview rates, it fails

### M12-05 — advance-recovery PATCH/GET gates already done (OK, Phase 6)
**Severity:** NOTE · **Category:** safe
- Confirmed in earlier pass


---

## M13 — WHATSAPP

### M13-01 — /send-otp has NO rate limit (HIGH)
**Severity:** HIGH · **Category:** security / abuse
- Line 61: no rate limiter
- Attacker can spam `POST /send-otp { username: "naveen" }` — user gets bombarded with OTP WhatsApp messages
- Twilio bills per message; cost abuse vector
- OTP DB row is OVERWRITTEN on each call (ON DUPLICATE KEY UPDATE), so legitimate OTP can be replaced with attacker-known one
**Impact:** DoS of legitimate user; OTP hijack via race condition.
**Mitigation:** Rate limit to 3 sends per username per 10 minutes.

### M13-02 — /send-otp responds "success" regardless of username existence (NOTE)
**Severity:** NOTE · **Category:** safe-but-tricky
- Good: prevents username enumeration
- But creates UX issue: user types wrong username, gets "OTP sent" but nothing arrives
- Trade-off documented and acceptable

### M13-03 — /webhook validated by signature (NOTE)
**Severity:** NOTE · **Category:** safe
- `validateTwilioSignature` middleware in place
- No bypass found

### M13-04 — /status-callback validated by signature (NOTE)
**Severity:** NOTE · **Category:** safe
- Same mechanism as webhook

### M13-05 — OTP secret leak via console.log when template SID missing (LOW)
**Severity:** LOW · **Category:** security
- Line 91: `console.log('[OTP] ${user.full_name}: ${otp}')` when no Twilio template
- In production logs OTPs in plaintext if TWILIO_TMPL_OTP env var missing
- Startup should fail-fast if template SID missing rather than silently fall through

### M13-06 — OTP length / entropy — 6 digits (NOTE)
**Severity:** NOTE · **Category:** safe-ish
- 6-digit OTP = 1M space; with 10-min expiry and no rate limit on /verify-otp, brute force is feasible
- Combined with M13-01: no send-side rate limit means verify-side brute force not directly possible (you need the DB hash), so it's actually OK
- BUT — no verify-side rate limit means an attacker knowing the user can try 900K OTPs in 10 minutes

### M13-07 — /verify-otp has NO rate limit on guesses (MED)
**Severity:** MED · **Category:** security
- Line 101: no rate limiter
- Attacker can try OTPs in rapid succession
- At 1 req/ms over 10 minutes = 600K attempts, ~60% chance of hitting a random 6-digit OTP
**Mitigation:** 5 failed attempts → lock user for 15 min

