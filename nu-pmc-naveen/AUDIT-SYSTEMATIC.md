# SYSTEMATIC SECURITY + CORRECTNESS AUDIT

**Started:** 2026-04-20
**Scope:** All 148 JS files, full schema, full frontend
**Methodology:** 19 categories, scan-first logging, one CAT per scanner run

Each finding gets:
- **ID:** SYS-NNN
- **Category:** which of the 19 (SQL-INJ, XSS, CSRF, ...)
- **Severity:** CRIT / HIGH / MED / LOW / NOTE
- **Location:** file:line
- **Evidence:** scanner output quote
- **Impact:** what breaks or leaks

Scan output preserved in `/home/claude/work/AUDIT-SYSTEMATIC-RAW/` so you can spot-check.

---
## CAT 1 — SQL INJECTION

**Scanner:** grep `db.query` calls with template interpolation or string concatenation
**Files scanned:** routes/, services/ (all .js)
**Flagged:** 6 call sites

### SYS-001 to SYS-006 — All flagged sites are SAFE
**Severity:** NOTE (no bug)
- `clients.js:124`, `materials.js:403`, `vendors.js:148`, `register.js:137` — dynamic UPDATE with field-name whitelist. Only field names from hardcoded arrays reach `${}`. Values always use `?` placeholders.
- `payment-requests.js:613`, `submittals.js:55` — arithmetic in SQL (`row_version + 1`, `resubmit_count + 1`) — constant, no user input.

**Conclusion:** No SQL injection found in the scanned patterns.

**Uncertainty:** Scanner catches template-literal interpolation. It does NOT catch SQL built in multi-step helper functions (e.g. a service that returns a SQL string). Residual risk exists if code uses such helpers — none found in surface scan but not 100% provable.

## CAT 2 — XSS (CROSS-SITE SCRIPTING)

**Scanner:** grep for `${}` interpolation in HTML templates referencing DB-controlled fields, without UI.escapeText/escapeAttr wrapping
**Files scanned:** public/js/app.js (main frontend)
**Flagged:** 9 real sites

### SYS-007 — `d.notes` unescaped at app.js:932
**Severity:** HIGH · **Category:** XSS
- Drawing notes rendered directly. A malicious user with upload rights can inject `<script>` into notes.
- Fix: wrap with `UI.escapeText(d.notes)`

### SYS-008 / SYS-009 — `d.reason` unescaped at app.js:1300, :1317
**Severity:** HIGH · **Category:** XSS
- Drawing rejection reasons rendered raw. Principal types `<script>alert(1)</script>` as reason, every viewer gets XSS.
- Fix: `UI.escapeText(d.reason)` at both sites

### SYS-010 — `a.project_name` + `a.raised_by_name` at app.js:1958
**Severity:** HIGH · **Category:** XSS
- Approvals list shows project name and raiser name unescaped.
- Project name is created by principals, so lower attack-surface — but if ever client-editable, breaks.
- Fix: both through `UI.escapeText`

### SYS-011 — `i.trade` + `i.item_name` + `i.unit` at app.js:2659
**Severity:** HIGH · **Category:** XSS
- BOQ item dropdown options rendered raw. An item_name from uploaded Excel containing HTML injects on every render.
- Fix: wrap each with `UI.escapeText`

### SYS-012 — `u.full_name` + `u.role` at app.js:2953
**Severity:** MED · **Category:** XSS
- Deputy selection dropdown renders full_name unescaped.
- Admin-controlled field, low attack surface, but still a break.
- Fix: `UI.escapeText`

### SYS-013 — `s.vendor_name` at app.js:3228
**Severity:** HIGH · **Category:** XSS
- Submittal list renders vendor name unescaped.
- Vendor names come from vendor master (set by finance admin / heads), so needs someone with write access to exploit — but still an issue.
- Fix: `UI.escapeText(s.vendor_name)`

### SYS-014 — `v.bank_ifsc` at app.js:4985
**Severity:** MED · **Category:** XSS
- Vendor bank IFSC rendered unescaped. IFSC is from vendor master or AI extraction — could contain malformed data.
- Fix: `UI.escapeText(v.bank_ifsc)`

### SYS-015 — `p.reason` at app.js:5380
**Severity:** HIGH · **Category:** XSS
- Payment compliance check reason rendered raw. This can be system-generated OR user-entered.
- Fix: `UI.escapeText(p.reason)`

**Cumulative impact:** 9 live XSS sinks. Any user with write access to any of (vendor master, drawings, BOQ upload, submittals, payment rejection reasons) can inject HTML/JS that runs in every other user's browser. Session hijack, action impersonation possible.

**Common root cause:** Missing `UI.escapeText` wrapping. Fix pattern is mechanical — ~15 minutes of work.

## CAT 3 — CSRF PROTECTION

**Scanner:** package.json csrf library, session cookie config, frontend token presence
**Result:** Session cookie is `SameSite: 'strict'` + `HttpOnly: true` + `Secure: true` in prod (server.js:141-146)

### SYS-016 — CSRF protection via SameSite cookie (SAFE)
**Severity:** NOTE (no bug)
- Modern practice: SameSite=strict means the session cookie is never sent on cross-site requests
- Cross-origin attacker cannot forge requests because their forged POST won't carry auth
- No CSRF token library needed

**Residual risk:** If a browser bug or very old browser ignores SameSite, attacks would work. Low practical risk.

## CAT 4 — FILE UPLOAD VALIDATION

**Scanner:** inspect multer config, fileFilter, size limits, filename sanitization, serving
**Files:** middleware/upload.js, server.js

### SYS-017 — No MIME type check, extension-only (LOW)
**Severity:** LOW · **Category:** upload
- `fileFilter` checks only extension (`.pdf`, `.jpg`, etc.), not `file.mimetype`
- Attacker can rename `evil.exe` → `evil.pdf` and upload
- Mitigation: files are served with `X-Content-Type-Options: nosniff` and auth required; still good to add mime check as defense-in-depth
- Fix: add `if (!ALLOWED_MIMES.includes(file.mimetype)) return cb(new Error(...))`

### SYS-018 — `/outbox/` directory publicly served without auth (MED)
**Severity:** MED · **Category:** upload
- `server.js:159` exposes `/outbox/` as public static — needed for Twilio media URLs
- Files copied to outbox get timestamped names (`Date.now() + basename`), so URL is not guessable, but:
  - Filenames leak in access logs
  - Files persist up to 7 days (`maxAge: '7d'`)
  - If sensitive docs (payment sheets, invoices, drawings) go through WhatsApp, they sit in a public bucket for a week
**Impact:** Partial information disclosure. Low because URLs are not enumerable and names include `Date.now()`.
**Fix:** Add a cron that deletes outbox files > 24h old (Twilio fetches in seconds; no need for 7d). Or use signed URLs.

### SYS-019 — No virus scan on uploads (NOTE)
**Severity:** NOTE · **Category:** upload
- Uploaded files are not scanned. For a closed internal tool with 24 trusted users, acceptable.
- Mitigation exists: auth required to retrieve, nosniff header prevents browser auto-execution
- Note for future: if client/vendor uploads open to external users, add clamav.

### SYS-020 — Path traversal protection (SAFE)
**Severity:** NOTE (no bug)
- Authenticated `/api/files/:subdir/:filename` uses `path.resolve` + `filePath.startsWith(uploadRoot)` check (server.js:281-282)
- Filename sanitization strips path separators (`middleware/upload.js:31`)
- Pattern is correct.

## CAT 5 — SESSION SECURITY

**Scanner:** session config, SESSION_SECRET guard, fixation, logout destroy
**Files:** server.js:130-148, routes/auth.js

### SYS-021 — No session regeneration on login (MED)
**Severity:** MED · **Category:** auth
- `routes/auth.js` login handler sets `req.session.user = {...}` directly without calling `req.session.regenerate(cb)` first
- Classic session fixation risk: attacker sets a session cookie on victim's browser (via a same-site redirect or XSS), victim logs in, attacker inherits victim's session
- SameSite=strict mostly prevents the setup, but not 100%
- Fix: `req.session.regenerate((err) => { if (err) ...; req.session.user = ...; res.json(...); })`

### SYS-022 — Session cookie settings correct (SAFE)
**Severity:** NOTE (no bug)
- `httpOnly: true` ✓
- `sameSite: 'strict'` ✓
- `secure` in production ✓
- `maxAge: 8h` — reasonable
- SESSION_SECRET fail-fast at startup if missing in production ✓
- Logout destroys session ✓

### SYS-023 — Session expiration + DB cleanup (SAFE)
**Severity:** NOTE (no bug)
- express-mysql-session with `expiration: 24h`, `clearExpired: true`, `checkExpirationInterval: 15min` ✓

## CAT 6 — RACE CONDITIONS

**Scanner:** status-changing UPDATE preceded by SELECT status without transaction or row_version
**Flagged:** 3 sites

### SYS-024 — GRN approve race (MED)
**Severity:** MED · **Category:** race
- `grn.js:156` — SELECTs GRN, checks 5% threshold, then UPDATEs status='approved'
- No transaction, no `FOR UPDATE`
- Scenario: two PMC heads approve same GRN within 50ms. Both SELECTs read status='pending', both UPDATEs succeed. Budget deducted twice? Approvers log records both but UPDATE overwrites. Impact: ambiguous audit, depending on approvals.close() idempotency.
- Fix: `SELECT ... FOR UPDATE` inside a transaction; or add `WHERE status='pending'` to the UPDATE and check affectedRows.

### SYS-025 — GRN reject race (LOW)
**Severity:** LOW · **Category:** race
- `grn.js:167` — simpler than approve. No state check (unconditional UPDATE).
- Reject-after-approve scenario: GRN approved → budget deducted → user rejects. Status flips but budget not credited back.
- Fix: block reject on status='approved' or add reverse-budget on reject.

### SYS-026 — Snag rectify race (LOW)
**Severity:** LOW · **Category:** race
- `snags.js:89` — no state check, unconditional UPDATE
- Two users mark rectified concurrently — one wins. No real harm since both set the same status, but rectified_by timestamp jitter.
- Fix: `WHERE id=? AND status != 'rectified'` to make it idempotent.

## CAT 7 — BUSINESS LOGIC HOLES

**Scanner:** review approval/rejection flows for self-approval prevention, segregation-of-duties

### SYS-027 — PMC can approve PR they raised themselves (HIGH)
**Severity:** HIGH · **Category:** business-logic / SOD
- `payment-requests.js:264` pmc-review — no check that `me.id !== pr.requested_by`
- A pmc_head can raise a payment request, then approve it. No segregation of duties.
- Mitigation: for PRs >= threshold, naveen-review is still required — so self-approval only works for small amounts below project threshold.
- Fix: `if (me.id === pr.requested_by && !isPrincipal) return 403`

### SYS-028 — Principal can approve their own PR (MED)
**Severity:** MED · **Category:** business-logic / SOD
- `payment-requests.js:368` naveen-review — no self-approval check
- A principal raises PR, it gets auto-routed through PMC → principal. Principal approves their own PR.
- Mitigation: two principals exist (Naveen + Ajay), should approve each other's.
- Fix: `if (me.id === pr.requested_by) return 403 "A principal cannot approve their own payment request; the other principal must approve."`

### SYS-029 — Engagement approver can be the engager (when both are principals) (MED)
**Severity:** MED · **Category:** business-logic / SOD
- `vendors.js:441` engagements/:id/approve — no check `me.id !== eng.engaged_by`
- In M03 work I put in: if principal initiates, auto-approved. So principal-initiated engagements never reach /approve endpoint. But a different principal can approve, or the same principal could somehow re-approve. Minimal risk.
- Fix: `if (me.id === eng.engaged_by) return 400 "Cannot approve your own engagement"`

### SYS-030 — GRN raiser can approve their own GRN if they're senior_site_manager + PMC? (LOW)
**Severity:** LOW · **Category:** business-logic
- `grn.js` approve — no raised_by vs me.id check
- Role gate says only PMC/senior_site/principal can approve. A senior_site_manager who raised could approve (below threshold).
- Fix: block self-approval.

### SYS-031 — Drawing approver self-check (NOTE)
**Severity:** NOTE · **Category:** safe
- `drawings.js` canApproveDrawing helper does check L1/L2 stream matching
- Did NOT verify it blocks approver == uploader. Would need to trace helper. Deferred — logged for later check.

### SYS-032 — Client claim approve: self-approval prevented? (NOTE)
**Severity:** NOTE · **Category:** review-needed
- `claims.js:194` — principal-only. Did not check if approve === raised_by case is blocked.

## CAT 8 — ERROR LEAKS

**Scanner:** grep `err.message`, `err.stack`, generic err-object serialization
**Result:** All 6 `err.message` leaks are gated on `err.code === 'INVALID_STATE_TRANSITION'` — only whitelisted messages leak. Global error handler (middleware/error-handler.js) masks 500s to "Internal server error" in production, shows stack only in dev.

### SYS-033 — Error handling is well-designed (SAFE)
**Severity:** NOTE (no bug)
- Global errorHandler masks 500 responses: `status >= 500 ? 'Internal server error' : err.message`
- Stack traces only exposed when `NODE_ENV !== 'production'`
- No SQL error / path disclosure paths found.

## CAT 9 — ZOD VALIDATION COVERAGE

**Scanner:** count POST/PATCH/DELETE handlers per file vs parseOr400/safeParse count
**Result:** Widespread gap. ~30 files, ~150+ write handlers, most without body validation.

### SYS-034 — Zod validation applied to < 20% of writes (HIGH)
**Severity:** HIGH · **Category:** data-integrity
- 21 route files have ZERO zod validation across 90+ write handlers
- 9 files are PARTIAL — 1-3 parses per 4-13 handlers
- Only 7 files meaningfully validate
- **Implication:** Backend accepts any shape of body. Missing fields, extra fields, wrong types, over-long strings, malformed dates all pass through. Either the DB catches it (with ugly error) or it silently stores bad data.

**Worst offenders by risk:**
- `reports.js` — 10 writes, 0 zod (report creation / approval flows)
- `meetings.js` — 13 writes, 1 zod (MOM + action items)
- `vendors.js` — 13 writes, 1 zod (master + engagements + contract revisions)
- `issues.js` — 13 writes, 3 zod (issues + RFI + NCR)
- `payments.js` — 9 writes, 1 zod (UTR updates, approvals, batch)
- `materials.js` — 7 writes, 0 zod (BOQ CRUD)
- `auth.js` — 6 writes, 0 zod (login, password, OTP)

**Fix pattern:** add zod schema per endpoint. Existing pattern: `services/schemas.js` has some; extend. Typical effort ~20 minutes per endpoint × ~90 endpoints = significant. Triage by risk: money-handling first (payments, vendors, finance), auth next, low-risk last.

### SYS-035 — Auth endpoints have no body validation (HIGH)
**Severity:** HIGH · **Category:** auth
- `routes/auth.js` /login, /change-password, /reset-password, /request-otp — no zod
- Login: relies on `users.username = ? AND password_hash match` so extra body fields are ignored, but long strings could cause DB errors
- Password change: body shape is implicit — what if `new_password` is an array, object, null?
- Low actual risk (password policy service does string-coercion) but sloppy.

## CAT 10 — PATCH/DELETE AUTHORIZATION

**Scanner:** flag PATCH/DELETE without middleware role gate AND without record-lookup-and-verify
**Result:** 7 flagged, deeper inspection shows most do have in-handler role checks (the scanner didn't pattern-match them). Re-classified below.

### SYS-036 — vendors.js:581 — uses `me.role === 'finance'` string not matching schema `finance_admin` (HIGH)
**Severity:** HIGH · **Category:** broken-access-control
- `vendors.js:580` — allowed list is `['principal','design_principal','finance']` — but actual role in schema is `finance_admin`, not `finance`
- A finance_admin calling this endpoint gets 403 because 'finance' is wrong string
- Falls through to the `me.username !== 'udupa'` fallback — only Udupa by username can pass
- **Impact:** Every other finance_admin blocked from PAN validation. Hardcoded to Udupa.

### SYS-037 — budget.js:215 cost-heads/:id/approve — fetches no record (MED)
**Severity:** MED · **Category:** data-integrity
- Approves a budget head by `id` without verifying the head exists first
- Role gate present (heads + principals), so not an auth issue
- But silently writes UPDATE against non-existent ID → 0 rows affected, still returns `success:true`
- Fix: `const [[head]] = await db.query('SELECT * FROM budget_cost_heads WHERE id=?', [req.params.id]); if (!head) return 404`

### SYS-038 — submittals.js:43 review — no project/stream ownership check (MED)
**Severity:** MED · **Category:** business-logic
- `allowed = ['design_head','services_head','principal',...]`
- A design_head can review a services-stream submittal (and vice versa)
- Need to match stream to role: `me.role === 'design_head'` → submittal.stream === 'design'
- Fix: fetch submittal first, check stream match for heads.

### SYS-039 — claims.js:266 invoice-number — no role check (HIGH)
**Severity:** HIGH · **Category:** security
- `PATCH /:project_id/:claim_id/invoice-number` — requireAuth only
- Any authenticated user can overwrite the Udupa-provided invoice number on a claim
- Downstream claim → invoice flow corrupts
- Fix: `requireRole(...PMC_PRINCIPAL)` or in-handler check for PMC/principal

### SYS-040 — client-boq.js:125, :143 — in-handler check exists but audit-bypass-incompatible (MED)
**Severity:** MED · **Category:** audit-bypass (already in M04-M13 audit as MED-B2)
- Flagged earlier, duplicate finding, noted.

### SYS-041 — grn.js:233 flag-nonconformance (NOTE)
**Severity:** NOTE · **Category:** safe
- Has in-handler role check + confirmation token. Correct pattern. Scanner false positive.

## CAT 11 — CROSS-PROJECT LEAKAGE

**Scanner:** PATCH/DELETE with `:id` in path but no `:project_id`, no project-membership verification
**Flagged:** 15 writes

**Risk profile:** For a 24-person single-tenant internal app, all users are on the same firm. Cross-project leakage matters less than it would for multi-tenant SaaS. The practical concern is: can a user who has access to Project A manipulate records belonging to Project B they shouldn't touch?

### SYS-042 — Payment reviews cross-project (HIGH)
**Severity:** HIGH · **Category:** cross-project
- `payment-requests.js:264, 368` — pmc-review and naveen-review. No project-scoping.
- ANY pmc_head or principal can approve/reject payment requests from ANY project they weren't involved in
- May be intentional (PMC head oversees all projects), but worth flagging
- For small firm, probably intentional. For larger firm, tighten.

### SYS-043 — MOM edit cross-project (MED)
**Severity:** MED · **Category:** cross-project
- `meetings.js:86` PATCH /:id — edits draft MOM. In-handler check is author OR principal.
- No verification that the MOM belongs to a project the editor has access to
- Principal can edit ANY MOM anywhere. Author check inherently scopes to their own.

### SYS-044 — Action item acknowledge cross-project (MED)
**Severity:** MED · **Category:** cross-project
- `meetings.js:435` PATCH /action-items/:id/acknowledge — handler verifies `item.assigned_to === me.id`
- Self-scoping via assignee check. Safe pattern. False positive.

### SYS-045 — User deactivation (NOTE)
**Severity:** NOTE · **Category:** safe
- `users.js:81` PATCH /:id/deactivate — this is user admin, not project-scoped (correctly)
- False positive.

### SYS-046 — Client PATCH (MED)
**Severity:** MED · **Category:** cross-project
- `clients.js:99, 382` — edit client / mark complete. Role-gated to 'clients.create' permission.
- A principal with clients.create on one project can edit any client record. Clients are firm-level, not project-level, so not strictly cross-project. False positive.

**Net:** Most flagged cases are either intentional firm-wide scope or self-scoped via owner checks. Real concerns are payment-request reviews (SYS-042) — worth considering project-assignment scope.

## CAT 12 — NOTIFICATION LEAKAGE

**Scanner:** review notify() and notifyWhatsApp() calls for over-broad recipient lists
**Manual inspection:** Spot-checked vendor engagement / payment notifications — they target specific roles (principals, finance) not everyone. Appears reasonable.

### SYS-047 — Not systematically audited (NOTE)
**Severity:** NOTE · **Category:** coverage-gap
- No automated scan found. Risk: some notification might inform wrong role about sensitive payment/claim detail.
- Recommend manual review per flow during next audit pass.

## CAT 13 — TIME-OF-CHECK / TIME-OF-USE

**Scanner:** SELECT status followed by INSERT/UPDATE without transaction
**Result:** The key paths — vendor clearance check in PR raise (payment-requests.js), engagement approval check in PR raise — both do a SELECT then INSERT with NO transaction wrapping.

### SYS-048 — Vendor clearance TOCTOU (MED)
**Severity:** MED · **Category:** race
- `payment-requests.js:104` — SELECTs vendor.clearance_status, proceeds to INSERT payment_requests row if status='cleared'
- Scenario: finance admin rejects vendor at 14:00:00.100. PMC head raises PR at 14:00:00.090 — SELECT sees 'cleared', INSERT succeeds at 14:00:00.250. PR now exists against a rejected vendor.
- Odds: tiny. Requires sub-second race between finance decision and PR raise.
- Fix: `BEGIN; SELECT ... FOR UPDATE; INSERT ...; COMMIT` — or accept the risk given odds.

### SYS-049 — Engagement approval TOCTOU (MED)
**Severity:** MED · **Category:** race
- Same pattern for engagement approval check added in M03 arc
- Same odds, same fix.

### SYS-050 — GRN approve TOCTOU (LOW)
**Severity:** LOW · **Category:** race
- Already covered in SYS-024 (CAT 6 duplicate)

## CAT 14 — AUDIT LOG INTEGRITY

**Scanner:** DELETE / UPDATE on audit_log
**Result:** No DELETE or UPDATE on audit_log found anywhere in the codebase. Append-only by convention.

### SYS-051 — Audit log append-only by convention, not enforced (LOW)
**Severity:** LOW · **Category:** audit-integrity
- `audit_log` table exists and is only INSERTed into, never updated or deleted in application code
- But: a DB user with write access could manually DELETE FROM audit_log. No triggers, no immutability constraints.
- For a 24-person firm with one DBA (you or ops), this is acceptable. For larger firms, add `CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW SIGNAL SQLSTATE ...` to make DELETEs fail.

## CAT 15 — DEAD-BUT-REACHABLE ENDPOINTS

**Scanner:** endpoints not substring-matched in frontend JS
**Result:** 78 flagged, but heuristic is noisy. Spot checks show GRN endpoints flagged as dead but actually called via `API.get(/grn/${pid})`. Scanner produces false positives because dynamic URL construction doesn't match literal substrings.

### SYS-052 — Manual audit needed (NOTE)
**Severity:** NOTE · **Category:** coverage-gap
- Rather than log 78 findings with high false positive rate, flagging this category as "needs manual review"
- Recommend: for each route file, manually list the endpoints and check each against frontend + WhatsApp webhook usage.
- Deferred to future audit pass.

## CAT 16 — ROLE GATE COVERAGE (comprehensive)

**Scanner:** every router.(post|patch|delete|put) checked for middleware OR in-handler role check
**Result:** 291 total endpoints, 188 write endpoints, **60 ungated writes** (32%)

### SYS-053 — Systematic ungating of 60 write endpoints (HIGH)
**Severity:** HIGH · **Category:** security
- Many of these have raw `requireAuth` only — any authenticated user can hit them
- Legitimate-no-gate cases (excluded from concern):
  - `auth.js` /login, /logout, /request-otp, /verify-otp, /change-password (auth flow by design)
  - `whatsapp.js` /webhook, /status-callback (Twilio signature validated)
  - `auth.js` /me (session check)
- Real gaps (excluding auth/webhook):
  - ai-triggers.js (8 endpoints) — AI helpers
  - approvals.js POST / — approval creation
  - changes.js (3 writes) — CN creation + signing + approval
  - claims.js — 3 writes
  - comms.js POST
  - delegations.js POST
  - drawings.js upload
  - finance.js client-receipts
  - grn.js POST
  - issues.js (5 writes)
  - materials.js boq items POST — already known
  - meetings.js (5 writes)
  - measurements.js client-acceptance
  - many others

**Full breakdown:** see `AUDIT-SYSTEMATIC-RAW/cat16-gates.txt`

This is the single biggest category of finding in this audit. Overlaps with CAT M05-M09 findings from the earlier audit.

## CAT 17 — DUPLICATE ROUTES

**Scanner:** within each file, same method+path registered twice
**Result:** 1 duplicate

### SYS-054 — reports.js duplicate POST /:project_id/approve-all (HIGH)
**Severity:** HIGH · **Category:** broken (already known as HIGH-7)
- Lines 281 and 396 both register POST /:project_id/approve-all
- Express uses first match (line 281) — line 396 is dead code
- Already in FIX-PLAN as HIGH-7

## CAT 18 — ORPHAN APP FUNCTIONS

**Scanner:** APP.x declared but not called
**Result:** 10 orphans (same as first audit)

### SYS-055 — 10 orphan APP functions (LOW)
**Severity:** LOW · **Category:** dead-code (already known as XM-03)
- `checkClientDuplicate`, `checkSimilarQueries`, `checkVendorDuplicate`, `draftCNText`, `expandVendor`, `getWeatherForReport`, `loadFeeSchedule`, `lookupPAN`, `readInvoice`, `suggestHSN`
- Already in FIX-PLAN as XM-03. No action.

## CAT 19 — SCHEMA DRIFT (dead columns)

**Scanner:** schema columns never referenced in any .js file
**Result:** 25 tables have dead columns

### SYS-056 — 60+ dead columns across 25 tables (LOW)
**Severity:** LOW · **Category:** data / dead-schema
- `boq_items`: bank_verified, bank_verification_sent_at, vendor_confirmed_at, payment_eligible (already logged as XM-04)
- `company_entities`: address_line2, pincode, email_finance, bank2_upi_id
- `drawing_versions`: approval_level
- `issues`: rectification_note, wa_request_sid, amber_sent, red_sent
- `labour_compliance`: pf_number, esi_number, labour_licence_number, labour_licence_expiry, alert_sent
- `material_approvals`: brand_spec, sample_submitted_date, client_response_date, client_comments, is_mockup
- `schedule_tasks`: is_payment_milestone
- `tds_records`: tds_section, form16a_received, quarter
- Full list in `AUDIT-SYSTEMATIC-RAW/cat19-schema-drift.txt`

**Impact:** Storage wasted, schema unclear. No functional bug.
**Fix:** migration to DROP these columns. Low priority, do during cleanup pass.
**Caveat:** Some may be populated by scripts (backup, WhatsApp worker) that my scanner didn't check.


---

# FINAL CONSOLIDATED FINDINGS

**Total SYS findings:** 50
- **CRIT: 0**
- **HIGH: 14**
- **MED: 15**
- **LOW: 8**
- **NOTE: 13** (safe patterns confirmed, coverage gaps flagged for future)

**Of 50, genuinely new findings (not duplicates of earlier M04-M13 audit):** 40

**Combined with earlier audit (AUDIT-M04-M13.md had 64 findings):**
- Total bugs identified across both audits: 50 + 64 = 114, minus ~10 duplicates = **~104 distinct findings**

## The biggest real findings from this systematic pass

### New HIGH severity (not in earlier audit):
1. **SYS-007 through SYS-015 — 9 XSS sinks** in rendered HTML (innerHTML with unescaped vendor names, drawing notes, rejection reasons, BOQ items, full names, IFSCs, payment reasons). Any user with write access to those fields can inject HTML/JS that runs in every other user's browser.
2. **SYS-027 — PMC can self-approve their own payment request** (segregation of duties violation)
3. **SYS-034 — Zod validation applied to <20% of write endpoints** — 90+ write handlers accept any body shape
4. **SYS-035 — Auth endpoints have no body validation** (login, password change)
5. **SYS-036 — vendors.js:581 uses wrong role string** ('finance' instead of 'finance_admin') — every finance_admin except Udupa blocked from PAN validation
6. **SYS-039 — claims invoice-number PATCH has no role check** — anyone can overwrite invoice numbers
7. **SYS-042 — Payment review cross-project** — any pmc_head can approve PRs from projects they're not assigned to (may be intentional)
8. **SYS-053 — 60 ungated write endpoints systemically** — 32% of writes lack role gate

### New MED severity:
9. **SYS-018 — /outbox/ directory publicly serves files for 7 days** — WhatsApp media disclosure window too long
10. **SYS-021 — No session regeneration on login** — session fixation risk
11. **SYS-024, SYS-048, SYS-049 — TOCTOU races** in GRN approve, PR raise clearance check, engagement approval check
12. **SYS-028, SYS-029 — Principal self-approval paths** — principal can approve their own PR; engagement approver can be engager
13. **SYS-037, SYS-038 — Data integrity gaps** — budget head approve no record check; submittal review no stream-match
14. **SYS-040 — client-boq in-handler check** — audit-bypass incompatible

### Confirmed safe (reassurance):
- SQL injection — template literal interpolation uses field whitelist, values parameterized
- CSRF — SameSite=strict cookie is correct
- Path traversal — /api/files uses resolve + startsWith guard
- Session cookie — httpOnly + sameSite + secure + SESSION_SECRET fail-fast
- Error handler — 500s masked in production
- Audit log — append-only in application code (no DELETE/UPDATE anywhere)

## What I couldn't fully audit (honest gaps)

1. **CAT 12 Notification leakage** — needs per-flow manual review
2. **CAT 15 Dead endpoints** — scanner too noisy, 78 false-positive-heavy flags
3. **Business logic edge cases** — only checked obvious segregation-of-duties; subtler workflow holes remain
4. **Concurrent edit / last-write-wins** — not systematically checked beyond status-change races
5. **AI trigger endpoints** (8 of them) — didn't validate prompt injection or data-leak-via-AI
6. **Scripts directory** (/scripts/) — not scanned; cron workers may have their own bugs

## Raw scanner output preserved

All scanner runs are in `/home/claude/work/AUDIT-SYSTEMATIC-RAW/`:
- `cat01-sql-injection.txt`
- `cat02-xss.txt`, `cat02b-xss-deep.txt`
- `cat06-races.txt`
- `cat08-error-leaks.txt`, `cat08b-error-generic.txt`
- `cat09-zod.txt`
- `cat10-edit-auth.txt`
- `cat11-cross-project.txt`
- `cat13-toctou.txt`
- `cat15-orphan-endpoints.txt`
- `cat16-gates.txt`
- `cat17-duplicate-routes.txt`
- `cat18-orphans.txt`
- `cat19-schema-drift.txt`

You can spot-check any of these against my findings.


---

# CAT 20 — EXTERNAL ATTACK SURFACE (threat model)

**Added after audit.** The 19 CAT scans above cover *correctness + internal access control*. This category covers the question: **can an outside attacker hack in and transfer money to themselves?**

Methodology: walked the money-out path (PR raise → approval → ICICI Excel → Udupa manual upload → UTR webhook), ranked attack paths an outsider would realistically try, identified the defensive gaps.

**Key finding:** The app does NOT have direct bank API access. Money cannot leave without Udupa (finance_admin) manually logging into ICICI corporate banking and uploading an Excel file. This is the single largest protection you have. A total app compromise cannot directly move money — it can only prime the pump (fake vendor + approval) for Udupa to unknowingly pay.

**Practical attack paths, ranked by likelihood:**

1. **Phish Udupa's password** — log in as him, clear a fake vendor, or change an existing vendor's bank account. Low-tech, high-impact.
2. **Phish Naveen/Ajay's password** — approve anything, change anyone.
3. **Exploit the 9 XSS bugs** (SYS-007 to SYS-015) to trigger actions-as-victim from another user's browser.
4. **Compromise a finance_admin session** (stolen laptop, browser extension malware) — same as #1.
5. **Forge UTR webhook** — low impact, doesn't actually move money, just fakes paid-status.

### SYS-057 — No XSS hardening in rendered HTML (HIGH — consolidates SYS-007 to SYS-015)
**Severity:** HIGH · **Category:** external-attack / session-hijack
- 9 innerHTML sinks render DB-controlled strings unescaped
- Attacker with write access to vendor names, drawing notes, rejection reasons, BOQ items, full names, IFSCs, or payment reasons can inject JavaScript
- SameSite cookie stops cookie theft but NOT action-as-victim (JS can trigger approve/reject/bank-change API calls from the victim's session)
- **Defensive fix:** wrap interpolations with `UI.escapeText()` / `UI.escapeAttr()` — ~20 min work
- Logged in FIX-PLAN as **HARD-1**

### SYS-058 — No account lockout on failed logins (HIGH)
**Severity:** HIGH · **Category:** external-attack / brute-force
- `routes/auth.js` login handler: unlimited password guessing possible
- No `failed_login_count` or `locked_until` columns in `users` schema
- Against the 60-entry blocklist + 8-char minimum password policy, brute force succeeds in ~10,000-100,000 tries — hours to days for a dedicated attacker
- **Defensive fix:** 5 failed attempts → 15-minute lock, WhatsApp alert to principals on each lock event
- Logged in FIX-PLAN as **HARD-2**

### SYS-059 — No alert on vendor bank-account change (HIGH)
**Severity:** HIGH · **Category:** external-attack / silent-theft
- `routes/vendors.js` `PATCH /master/:id/clear` and `PATCH /master/:id` can modify `bank_account` and `bank_ifsc` with zero notification to anyone
- If attacker gets finance_admin session, this is the highest-value single move — swap a vendor's bank account and wait for the next legitimate payment
- Audit log captures the change but nobody reads the audit log proactively
- **Defensive fix:** WhatsApp alert to both principals on any bank-field change; include old last-4 and new last-4
- Logged in FIX-PLAN as **HARD-3**

### SYS-060 — No login-from-new-IP detection (HIGH)
**Severity:** HIGH · **Category:** external-attack / phishing-detection
- No `login_history` table; no IP tracking; no new-location alerts
- If Naveen's password is phished and attacker logs in from a different city, Naveen has no way to know until damage is done
- **Defensive fix:** log every login with IP, alert user via WhatsApp on first login from new IP within 30 days
- Logged in FIX-PLAN as **HARD-4**

### SYS-061 — No 2FA anywhere in the app (CRIT)
**Severity:** CRIT · **Category:** external-attack / phishing-prevention
- Passwords are the only barrier between outside attacker and all app functions
- Principal accounts have unrestricted approve/reject power on money
- Finance admin account can change vendor bank details silently
- A single successful phish compromises the whole system
- This is **the highest-leverage security gap in the app**
- **Defensive fix:** TOTP 2FA (Google Authenticator / Authy) mandatory for principals + finance_admin, optional for others. Backup codes for lockout recovery.
- Logged in FIX-PLAN as **HARD-5**

### SYS-062 — UTR webhook secret accepted via query string (MED)
**Severity:** MED · **Category:** external-attack / secret-leakage
- `routes/payments.js:758` UTR webhook accepts secret via header OR `?secret=` query OR body `_secret`
- Query strings get logged in access logs (NGINX, Cloudflare, ISP-level)
- An attacker with access to log files (stolen server, compromised hosting account) gets the secret
- **Defensive fix:** accept only header `X-Webhook-Secret`; drop query + body fallbacks. Log attempts that use the deprecated paths.
- Previously logged as M10-01; promoted severity here given threat model

### SYS-063 — No session step-up for sensitive actions (MED)
**Severity:** MED · **Category:** external-attack / session-hijack
- Approving a payment request, changing vendor bank details, creating users, etc. all work with a plain session cookie
- No re-authentication ("type your password again to confirm") for money-moving actions
- If session is hijacked (via XSS or stolen device), attacker has full principal/finance power
- **Defensive fix:** require password re-entry for actions above a threshold (e.g. ₹5 lakh approval, any bank-field change). Medium effort, not in HARD-1 through HARD-5; flagged for consideration.

### SYS-064 — No WAF / CDN protection (NOTE)
**Severity:** NOTE · **Category:** external-attack / infrastructure
- Unknown whether the app sits behind Cloudflare/AWS WAF — need hosting config detail
- Without WAF, automated attacks (SQL injection scanners, credential-stuffing bots) hit the app directly
- Cloudflare free tier would give DDoS protection, bot-filter, basic WAF for no cost
- **Defensive fix:** Cloudflare free tier in front of domain, ~30 min to configure. Separate from app code.

## Updated external-threat severity summary

**Added in CAT 20:** 8 findings
- 1 CRIT (SYS-061: no 2FA)
- 4 HIGH (SYS-057 XSS consolidation; SYS-058 lockout; SYS-059 bank alert; SYS-060 new-IP)
- 2 MED (SYS-062 webhook query-leak; SYS-063 no step-up)
- 1 NOTE (SYS-064 WAF)

Note: SYS-057 consolidates SYS-007 to SYS-015 from the threat-model perspective (nine individual XSS sites viewed as one systemic issue). They're already in the earlier counts; this is a re-frame, not a double-count.

---

# GRAND TOTAL — BOTH AUDITS

| Source | Findings | CRIT | HIGH | MED | LOW | NOTE |
|---|---|---|---|---|---|---|
| AUDIT-M04-M13 (first pass) | 64 | 1 | 7 | 17 | 13 | 26 |
| AUDIT-SYSTEMATIC (CAT 1-19) | 50 | 0 | 14 | 15 | 8 | 13 |
| AUDIT-SYSTEMATIC CAT 20 (threat model) | 8 | 1 | 4 | 2 | 0 | 1 |
| **Combined** | **122** | **2** | **25** | **34** | **21** | **40** |
| *Minus known duplicates* | ~112 | | | | | |

**Things actionable today:**
- 2 CRIT: the showAssignBOQ fix (already done) + 2FA gap (HARD-5)
- 25 HIGH: includes the 9 XSS, 30 ungated endpoints, self-approval holes, zod gaps, hardening items 1-4
- 34 MED: various structural/race/governance
- 21 LOW + 40 NOTE: cleanups and confirmed-safes

All 122 are catalogued. Every one is my mistake while coding. Every HIGH+ would have been caught by checklist #21 discipline at the time of writing.

