# FIX-PLAN.md — Review & Approval Document
**Scope:** All 64 findings from AUDIT-M04-M13 audit
**Instructions for Naveen:** For each finding, mark one of `[APPROVE]` / `[MODIFY: …]` / `[DEFER]` in front of the ID. Return the file and I'll execute only approved items in the batch sequence at the bottom.

---

## How to read each entry

Each finding has 4 lines:

- **Fix:** The actual change proposed
- **Callers:** Who depends on current behavior (answers "will I break something upstream?")
- **Blast:** What breaks if the fix itself is wrong (answers "how bad if I'm wrong?")
- **Rollback:** How to undo cleanly

Severity drives depth — CRIT/HIGH get full treatment, LOW/NOTE get compact entries.

---

# 🔴 CRITICAL (1 finding)

## CRIT-1 — `showAssignBOQ` passed vendor_id as engagement_id (M04-01)
**Status:** ALREADY FIXED in-flight during audit. `showAssignBOQ(pid, engagementId, vendorId)` now takes both; `submitBOQAssign` passes `engagementId` to `API.assignBOQ`.

- **Fix:** Done
- **Callers:** Only one caller (engagement card button); updated.
- **Blast:** N/A — fix already parses clean, behavior unchanged for all other flows
- **Rollback:** Revert the 2 string edits in public/js/app.js

**[ ] APPROVE as-done / [ ] MODIFY / [ ] DEFER (rollback)**

---

# 🟠 HIGH (7 findings)

## HIGH-1 — `our_cost_rate` UI field dropped before backend (M04-02)
- **Fix:** Two changes — (a) extend `POST /boq-mapping/:pid` to accept `our_cost_rate` in body and insert a parallel row in `vendor_boq_items`; (b) update `API.assignBOQ` to forward the field.
- **Callers:** Only the BOQ-assign modal calls `API.assignBOQ`. No other caller. Budget-check queries `SELECT` from `vendor_boq_items` but don't care if it's empty (returns 0) — they'll start returning real data after this, which is correct.
- **Blast:** If `vendor_boq_items` insert fails while `vendor_boq_mapping` succeeded, we have half-mapped state. Fix with transaction wrapping both inserts.
- **Rollback:** Revert route file + api.js. `vendor_boq_items` rows leftover are inert (budget check tolerates their presence).

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## HIGH-2 — `vendor_boq_items` is dead (no INSERTs) (M04-03)
- **Fix:** Solved by HIGH-1 going forward. For historical data: `migrations/v3.1-m04-backfill-vendor-boq-rates.sql` that derives `our_cost_rate` from the most recent `payment_requests.unit_rate` for each (engagement, boq_item) pair.
- **Callers:** `budget.js` (5 SELECTs), `payments.js` (2 SELECTs), `services/budget-check.js` (3 SELECTs) — all currently work with empty table. After backfill they'll return non-zero — budget variance calculations start being meaningful.
- **Blast:** If backfill derives wrong rates (e.g. payment_request has advance amount not unit rate), budget calculations get noisy. Mitigation: only backfill from payment types that carry true unit rates (`running_account_bill`, `final_bill`) — not advances.
- **Rollback:** `DELETE FROM vendor_boq_items WHERE entered_by IS NULL` (backfill rows flagged via `entered_by=NULL` or a dedicated `source='backfill'` marker column — add to migration).

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER — recommend review carefully; backfill is irreversible without marker column**

## HIGH-3 — 30+ ungated GET endpoints (XM-05 consolidated)
Full list at bottom of this section. Proposed gates:

| Endpoint group | Proposed gate |
|---|---|
| Drawings (`view/:version_id`, `:drawing_id/history`) | `STREAM_HEADS_OR_PRINCIPAL + pmc_head + site_managers + finance` — full project team |
| Register (`/:pid`, `/:pid/template`) | Same — project team |
| Schedule (`/:pid`, `/lookahead`, `/versions`) | Project team |
| GRN (`/:pid`, `/flag-nonconformance/preview`) | Project team |
| Issues/RFI/NCR (`/:pid`, `/:id/photos`, `/rfi/:pid`, `/ncr/:pid`) | Project team |
| Meetings (`/:pid`, `/:id/action-items`, `/:meeting_id/documents`) | Project team |
| Photos (`/:pid`, `/:pid/documents`, `/photo-tags/:photo_id/history`) | Project team |
| Labour (`/:pid`) | PMC + heads + principals + finance (payroll-adjacent) |
| Snags / Submittals / Urgent-payments | Project team |
| Weekly-health / Weekly-signoff | PMC + heads + principals + audit |
| Changes / Delegations | Project team (already scoped by user in handler for delegations) |
| Pmc-deputy | PMC + principals |
| Project-setup (`scope`, `entities`) | PMC + heads + principals + audit |
| Projects (`/:id`) | Project team |
| Dashboard (`/`) | Everyone authenticated (already so, keep) |
| Forms templates | Everyone (read-only downloads) |
| Lookup (GSTIN/weather/suppliers) | Everyone — utility endpoints |

Proposed new roles constants to add to `services/roles.js`:
- `PROJECT_TEAM_ROLES` = PRINCIPALS ∪ PMC_HEAD ∪ STREAM_HEADS ∪ SITE_MANAGERS ∪ FINANCE + coordinator + jr_architect + services_engineer + team_lead — i.e. everyone except trainee and audit (audit uses its own bypass).

- **Fix:** Mechanical — add `requireRole(...PROJECT_TEAM_ROLES)` to each GET per the table.
- **Callers:** The browser calls these URLs. If the role doesn't match, 403 instead of the data. For every endpoint, I should verify the current role set that actually uses it — by searching for the API.* wrapper in app.js and cross-referencing ROLE_TABS.
- **Blast:** If I gate too tight, legitimate users see "Not authorised" on tabs they expect to work. If I gate too loose, the security work is wasted. Mitigation: for each endpoint, scan the UI caller and verify the intended role set.
- **Rollback:** Per-endpoint revert is trivial — remove the middleware. No data change.

**Per-endpoint list (30 endpoints):**

```
drawings.js:  GET /view/:version_id              → PROJECT_TEAM_ROLES
              GET /:drawing_id/history          → PROJECT_TEAM_ROLES
register.js:  GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:project_id/template         → PROJECT_TEAM_ROLES
schedule.js:  GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:project_id/lookahead        → PROJECT_TEAM_ROLES
              GET /:project_id/versions         → PROJECT_TEAM_ROLES
grn.js:       GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:id/flag-nonconformance/preview → PMC_PRINCIPAL
issues.js:    GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:id/photos                   → PROJECT_TEAM_ROLES
              GET /rfi/:project_id              → PROJECT_TEAM_ROLES
              GET /ncr/:project_id              → PROJECT_TEAM_ROLES
meetings.js:  GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:id/action-items             → PROJECT_TEAM_ROLES
              GET /:meeting_id/documents        → PROJECT_TEAM_ROLES
photos.js:    GET /:project_id                   → PROJECT_TEAM_ROLES
              GET /:project_id/documents        → PROJECT_TEAM_ROLES
photo-tags.js:GET /:photo_id/history            → PROJECT_TEAM_ROLES
              GET /disputes/:project_id         → PMC_PRINCIPAL
labour.js:    GET /:project_id                   → FINANCE_ROLES ∪ PMC_PRINCIPAL
snags.js:     GET /:project_id                   → PROJECT_TEAM_ROLES
submittals.js:GET /:project_id                   → PROJECT_TEAM_ROLES
urgent-payments.js: GET /:project_id             → PMC_PRINCIPAL + FINANCE_ROLES
weekly-health.js: GET /schedule                  → PMC_PRINCIPAL + PRINCIPALS
weekly-signoff.js: GET /:report_id               → PMC_PRINCIPAL + PRINCIPALS
changes.js:   GET /:project_id                   → PROJECT_TEAM_ROLES
project-setup.js: GET /:id/scope                 → PMC_PRINCIPAL
              GET /entities                     → PMC_PRINCIPAL
projects.js:  GET /:id                           → PROJECT_TEAM_ROLES
pmc-deputy.js:GET /status                        → PMC_PRINCIPAL
```

**Skipped (keep open):** `auth.js GET /me`, `dashboard.js GET /`, `delegations.js GET /effective`, `forms.js GET /templates`, `lookup.js GET /*`.

**[ ] APPROVE full / [ ] APPROVE per-endpoint (mark individuals below) / [ ] MODIFY / [ ] DEFER**

## HIGH-4 — `POST /finance/:pid/client-receipts` auth-only (M12-01)
- **Fix:** Add `requireRole(...FINANCE_ROLES)` (finance_admin + PMC + principals) to the route.
- **Callers:** Frontend calls `API.recordReceipt` from finance tab. Finance tab is visible to finance_admin + principals. No other caller.
- **Blast:** If I accidentally exclude a legitimate user, they see 403. Worst case, PMC can't log a receipt — easy to add back.
- **Rollback:** Remove middleware — 1 line revert.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## HIGH-5 — `POST /claims/:pid` auth-only (M12-02)
- **Fix:** Add `requireRole(...CLAIM_REVIEWERS)` — principals + PMC head + stream heads.
- **Callers:** Frontend calls from claims UI. Claims tab restricted to these roles. Good match.
- **Blast:** Claim raise fails for anyone else. Downstream sign-off chain is unaffected.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## HIGH-6 — ✅ BUILT 2026-04-21 — Password reset flow: principal + direct manager reset (M13-01 revised)
**Decision (Naveen, 2026-04-21):**
No OTP. No self-service. User calls their boss or Naveen/Ajay. The person they call opens Users tab, finds them, sets a temp password, optionally sends it to the user's WhatsApp. User must change on first login.

- **Fix (4 parts):**
  1. **DELETE** `POST /whatsapp/send-otp` and `POST /whatsapp/verify-otp` entirely
  2. **DELETE** "Forgot Password" link from login screen + `APP.showForgotPassword`, `APP.sendOTP`, `APP.verifyOTP` frontend functions
  3. **ADD** `POST /api/users/:id/reset-password` — gated by new helper `canResetPasswordOf(me, target)`:
     - `me.role ∈ ['principal','design_principal']` → can reset anyone
     - `me.id === target.managed_by` → can reset their own direct reports only
     - Anyone else → 403
     - Returns the plaintext temp password once in the response. Flags `force_password_change=1`.
  4. **ADD** in Users tab: "🔑 Reset" button per user card — shown only when `canResetPasswordOf` applies to the viewer. Modal: enter temp password + "Send via WhatsApp" checkbox. If ticked, sends via Twilio.
- **Callers:**
  - `/send-otp` → called only from `APP.sendOTP` → safe to delete
  - `/verify-otp` → called only from `APP.verifyOTP` → safe to delete
  - `APP.showForgotPassword` → 1 caller in `index.html` login button → delete both
  - `managed_by` column already exists on `users` table — confirmed in payroll/users work
- **Blast:** Self-service reset gone (acceptable — app is new, likely never used). Managers can only see the Reset button for their own reports — principals see it for everyone.
- **Rollback:** Revert the 4 deletions and 2 additions.
- **Security note:** Plaintext temp password returned in API response shown once in UI, never stored. WhatsApp send passes it frontend → backend → Twilio in one request. No plaintext persisted anywhere.
- **M13-05 cleanup bundled:** `console.log(otp)` fallback deleted with the endpoint.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## HIGH-7 — ~~Duplicate `POST /:project_id/approve-all` in reports.js~~ (M11-01) — FALSE POSITIVE

**Verdict: Not a bug. No action needed.**

The original audit ran `grep -c "approve-all" routes/reports.js` which returned 2 — but that counted the **comment line** (line 372) and the **route registration** (line 373). There is only one `router.post('/:project_id/approve-all')` registration in the file. Confirmed by `grep -c "router\.post.*approve-all"` → 1.

This was sloppy audit work. Checklist #21 point 3 ("grep every route path, not the URL string") would have caught it immediately.

**Decision: CLOSED — no fix needed.**

---

# 🟡 MEDIUM (17 findings)

## Cluster A — POST endpoints accepting raises from any authenticated user

### MED-A1 / M05-01 — `POST /schedule/:pid/update` no role gate
- **Fix:** Add `requireRole(R.SITE_MANAGER, R.SENIOR_SITE_MANAGER, R.PMC_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL)` — matches the in-handler check already in the PATCH variant.
- **Callers:** `API.updateTask` from site manager's daily-update flow. All site managers already in the list.
- **Blast:** Non-site-manager can no longer post fake progress. Legitimate PMC can still.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A2 / M05-02 — Duplicate POST + PATCH do same thing
- **Fix:** Deprecate `POST /schedule/:pid/update` in favor of `PATCH /schedule/:pid/tasks/:task_id/progress`. Add a deprecation comment + keep POST working for backward compat for one release cycle, logging a warning.
- **Callers:** Frontend uses PATCH now — verified with grep. POST is legacy (if even called).
- **Blast:** If some caller still uses POST, warn + serve. No breakage.
- **Rollback:** N/A (deprecation notice only).

**[ ] APPROVE / [ ] MODIFY (delete POST entirely) / [ ] DEFER**

### MED-A3 / M07-02 — `POST /grn/:pid` no role gate
- **Fix:** Add `requireRole(R.SITE_MANAGER, R.SENIOR_SITE_MANAGER, R.PMC_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL)`.
- **Callers:** Site manager raises GRN on delivery. All included.
- **Blast:** Design heads can no longer raise GRN (by design — it's a site operation).
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A4 / M07-05 — `PATCH /grn/:id/flag-nonconformance` auth-only
- **Fix:** Add `requireRole(R.PMC_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL, R.DESIGN_HEAD, R.SERVICES_HEAD)` — heads + PMC + principals.
- **Callers:** PMC or head reviews delivery for quality issues.
- **Blast:** Site managers can't flag NC directly — must go through PMC. This is reasonable: flagging has vendor-reputation consequence.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY (include senior_site_manager) / [ ] DEFER**

### MED-A5 / M08-02 — `POST /issues/:pid` no role gate
- **Fix:** Add `requireRole(...PROJECT_TEAM_ROLES)` — anyone on project team can raise issue.
- **Callers:** Broad — design, PMC, site managers all raise issues.
- **Blast:** Only trainees + audit blocked. Audit is blocked by write-guard anyway.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A6 / M08-04 — `POST /photo-rfi` no role gate
- **Fix:** Add `requireRole(...PROJECT_TEAM_ROLES)`.
- **Callers:** Site managers + design/PMC raise photo-RFIs.
- **Blast:** Same as MED-A5.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A7 / M08-06 — RFI endpoints auth-only (create + answer + close)
- **Fix:** Three endpoints, different gates:
  - `POST /rfi/:pid` (create) → `requireRole(...PROJECT_TEAM_ROLES)`
  - `POST /rfi/:id/answer` → `requireRole(...STREAM_HEADS_OR_PRINCIPAL)` — only heads/principals answer drawing queries
  - `POST /rfi/:id/close` → `requireRole(...STREAM_HEADS_OR_PRINCIPAL)` — same
  - `POST /rfi/:id/assign` → already has in-handler check, leave alone
- **Callers:** Design flow. Heads answer, everyone creates.
- **Blast:** Trainees can't close an RFI (good — governance). PMC head can't directly answer (PMC routes to stream heads — correct).
- **Rollback:** Remove middleware per endpoint.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A8 / M09-02 — `POST /meetings/:pid` (MOM create) auth-only
- **Fix:** Add `requireRole(R.SITE_MANAGER, R.SENIOR_SITE_MANAGER, R.PMC_HEAD, R.PRINCIPAL, R.DESIGN_PRINCIPAL, R.DESIGN_HEAD, R.SERVICES_HEAD)`.
- **Callers:** Anyone senior enough to attend a client meeting should be able to draft MOM.
- **Blast:** Trainees/coordinators can't draft. Reasonable.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A9 / M09-04 — `POST /site-visit` auth-only
- **Fix:** Same roles as MED-A8.
- **Callers:** Same — site visits logged by PMC/site managers/heads.
- **Blast:** Same.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-A10 / M09-05 — `POST /:meeting_id/observation` auth-only
- **Fix:** Same roles as MED-A8.
- **Callers:** Attendees of site visit.
- **Blast:** Same.
- **Rollback:** Remove middleware.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## Cluster B — In-handler role checks (audit-bypass incompatible)

### MED-B1 / M12-03 — `/claims/:id/approve` in-handler principal check
- **Fix:** Replace in-handler check with `requirePrincipal` middleware.
- **Callers:** None affected — same roles allowed.
- **Blast:** None. Pure refactor.
- **Rollback:** Restore in-handler check.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-B2 / M12-04 — client-boq rate/HSN PATCH in-handler check
- **Fix:** Replace in-handler `CLIENT_RATE_ROLES.includes(me.role)` with `requireRole(...CLIENT_RATE_ROLES)`. NOTE: these are PATCH so audit is blocked by write-guard regardless — this is consistency cleanup.
- **Callers:** Same roles.
- **Blast:** None.
- **Rollback:** Restore in-handler check.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-B3 / XM-06 measurements.js (5 sites)
- **Fix:** Replace 5× `if (!RATE_ROLES.includes(me.role)) return 403` with route-level `requireRole(...CLAIM_REVIEWERS)`.
- **Callers:** Same roles.
- **Blast:** None.
- **Rollback:** Restore in-handler checks.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-B4 / XM-06 clients.js (8 sites)
- **Fix:** Replace 8× `if (!can(me.role, 'clients.*'))` with middleware. Add `requireCan('clients.create')` etc. helpers if not present, or convert to `requireRole(...appropriate role list)`.
- **Callers:** Same.
- **Blast:** `can()` uses a permission matrix that's more granular than role lists. Refactoring to middleware requires preserving that granularity. I might need to add `requireCan` helper.
- **Rollback:** Restore.

**[ ] APPROVE / [ ] MODIFY (add requireCan helper instead) / [ ] DEFER**

### MED-B5 / XM-06 comms.js, users.js
- **Fix:** Convert single sites each to middleware.
- **Callers:** Same roles.
- **Blast:** None.
- **Rollback:** Restore.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

## Cluster C — Structural drift

### MED-C1 / M04-04 — boq-mapping role gate excludes heads
- **Fix:** Widen all 4 routes in `routes/boq-mapping.js` from `requirePMC` to `requireRole(...CLAIM_REVIEWERS)` (principals + PMC + stream heads).
- **Callers:** Frontend renderBOQMapping tab visible to heads; backend was 403-ing them.
- **Blast:** Heads can now view/create/delete BOQ mappings on their stream (as designed).
- **Rollback:** Restore requirePMC.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-C2 / M05-04 — `renderSchedule` uses `APP.user.projects[0]`, ignores selectedProject
- **Fix:** Change `const pid = APP.user.projects?.[0]?.id` to `const pid = APP.state.selectedProject || APP.user.projects?.[0]?.id`.
- **Callers:** Schedule tab only.
- **Blast:** If user hasn't selected a project AND has no projects[0], pid is undefined — already handled by the "No project assigned" empty state.
- **Rollback:** Revert the line.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-C3 / M10-05 — Two `batch-approve` endpoints with different role gates
- **Fix:** Rename the payments.js one to `bulk-approve-utrs` (that's what it actually does) to disambiguate.
- **Callers:** Need to find the UI caller and update to new URL.
- **Blast:** If frontend still calls old URL, 404. Mitigation: grep first, update atomically.
- **Rollback:** Restore the old name.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-C4 / M06-01 — `GET /drawings/view/:version_id` no role gate
- **Fix:** Add `requireRole(...PROJECT_TEAM_ROLES)`. Could also look up the drawing → project → membership check; simpler to gate to project-team roles and rely on sidebar filter.
- **Callers:** Drawing viewer links; all authenticated users currently. No function signature change.
- **Blast:** If I include a role that shouldn't view drawings, they get 403 — easy to spot, easy to widen. If I exclude a role that should (e.g. finance_admin reviewing drawing context for a claim), they 403 — fixable by adding role.
- **Rollback:** Remove the middleware argument.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

### MED-C5 / M06-03 — `GET /register/:project_id` no role gate
- **Fix:** Add `requireRole(...PROJECT_TEAM_ROLES)` — same pattern as MED-C4.
- **Callers:** Register tab fetcher (only visible to design_head/services_head/principals per ROLE_TABS). Other roles don't see the tab but can URL-fetch.
- **Blast:** Same as above.
- **Rollback:** Remove middleware arg.

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

---

# 🔵 LOW (13 findings)

Compact treatment — mostly role-gate additions following the pattern established in HIGH-3.

| ID | Finding | Proposed Fix | Decision |
|---|---|---|---|
| **M04-05** | AI fallback uses hardcoded 0.6 confidence | Compute from keyword-match ratio (matched words / total words), clamp 0.3–0.7 | [ ] |
| **M04-06** | Mapping uses internal BOQ IDs not client | Rename `boq_item_id` comment in schema to clarify; document intent; no code change needed | [ ] |
| **M05-03** | Schedule GETs ungated | Covered in HIGH-3 — add to PROJECT_TEAM_ROLES bundle | [ ] |
| **M05-05** | gantt/monthly tabs dead | Delete `renderGantt`, `renderMonthly`, remove from render map | [ ] |
| **M06-02** | Drawing history no gate | Covered in HIGH-3 | [ ] |
| **M07-01** | GRN GET no gate | Covered in HIGH-3 | [ ] |
| **M07-04** | GRN NC preview no gate | Covered in HIGH-3 | [ ] |
| **M08-01** | Issue GETs no gate | Covered in HIGH-3 | [ ] |
| **M08-03** | Issue photos no gate | Covered in HIGH-3 | [ ] |
| **M09-01** | Meetings GETs no gate | Covered in HIGH-3 | [ ] |
| **M11-02** | `/mark-sent` auth-only | Add `requireRole(...PMC_PRINCIPAL, R.SITE_MANAGER, R.SENIOR_SITE_MANAGER)` — who physically sends the report | [ ] |
| **M11-03** | `/ack-anomaly` auth-only | Add `requireRole(...PMC_PRINCIPAL)` | [ ] |
| **M13-05** | OTP in console.log if template missing | Replace fallback `console.log` with `throw new Error('TWILIO_TMPL_OTP not set')` to fail-fast | [ ] |
| **M13-07** | `/verify-otp` no rate limit | Add express-rate-limit: 5 attempts per username per 15 min | [ ] |

**[ ] APPROVE full bundle / [ ] APPROVE selectively (mark above) / [ ] DEFER bundle**

---

# ⚪ NOTE (26 findings) — documentation / cleanup only

These are safe patterns already working, minor consistency drift, or require deeper inspection before action. Default recommendation: **DEFER to v4 cleanup pass** unless you want specific items addressed now.

| ID | Finding | Recommendation |
|---|---|---|
| **XM-01** | 6 duplicate APP function declarations | Batch-delete earlier copies (safe — later declaration wins in JS) |
| **XM-02** | 6 render-map orphans (documents, gantt, monthly, project_detail, requests, schedule) | Delete dead renderers + remove from render map |
| **XM-03** | 10 orphan APP functions (lookupPAN, readInvoice, etc.) | v4 cleanup — leave for now (AI features pending wire-up) |
| **XM-04** | 4 dead schema columns on boq_items (bank_verified etc.) | v4 migration — drop columns once certain they're unused |
| **M05-06** | `validate` status whitelist — no bug | Document only — pattern is correct |
| **M06-04** | `canApproveDrawing(me, dv)` in-handler | Safe — helper returns false for audit. No action. |
| **M06-05** | `/register` bulk-upload role permissive? | **Re-audit needed** — I flagged as pending inspection. Should be a separate check, not a fix. |
| **M06-06** | Drawing upload stream-derivation from category string | UI-level risk only — if category is a locked dropdown, this is safe. Verify dropdown locks values. |
| **M07-03** | GRN approve in-handler check (senior/PMC/principal + 5% threshold) | Safe — pattern works. Optional: migrate to middleware. |
| **M08-05** | Issue `/resolve` in-handler check (assignee OR 7 roles) | Safe — correct pattern. |
| **M08-07** | NCR create uses `requirePMC` | Safe — confirmed. |
| **M09-03** | MOM edit draft in-handler (author OR principal) | Safe — pattern is correct. |
| **M09-06** | Action item complete/ack/countersign auth-only but assignee-scoped | Safe — each handler verifies `item.assigned_to === me.id`. |
| **M10-01** | UTR webhook secret leaks via `?secret=` query string | **Security-minor** — query strings get logged. Recommend: header-only. Low-risk but trivially fixable. Adding as LOW: M10-01-fix. |
| **M10-02** | `/confirm-payment` in-handler check (finance + principals) | Safe — pattern works. Optional: migrate to `requireFinance`. |
| **M10-03** | `/pre-upload-check` in-handler check | Same as M10-02. |
| **M10-04** | Payment history GET `requireAuth` with role-based filter | Safe — filter is in-handler but present. Would need deeper trace to confirm all paths filter. |
| **M10-06** | M01 + M03 gates in payment-requests | Safe — confirmed working. No action. |
| **M11-04** | Reports reading gated REPORT_READER_ROLES | Safe — Phase 6 confirmed. No action. |
| **M12-05** | advance-recovery gates | Safe — Phase 6 confirmed. No action. |
| **M13-02** | `/send-otp` says success regardless | Intentional — anti-enumeration. Keep as-is. |
| **M13-03** | `/webhook` Twilio signature validated | Safe — confirmed. |
| **M13-04** | `/status-callback` Twilio signature validated | Safe — confirmed. |
| **M13-06** | 6-digit OTP entropy | Safe-ish — combined with HIGH-6 + M13-07 rate limits, brute force blocked. Keep length. |

**Actionable items within NOTE:**
- **XM-01** — 6 duplicate APP function declarations → **APPROVE safe batch delete**
- **XM-02** — 6 render-map orphans → **APPROVE safe batch delete**
- **M10-01** (promoted from NOTE to LOW) — header-only webhook secret → include in Batch E
- **M06-05** — re-audit `/register` bulk-upload role → include in Batch B

**[ ] APPROVE XM-01 delete / [ ] APPROVE XM-02 delete / [ ] APPROVE M10-01 header-only / [ ] APPROVE M06-05 re-audit / [ ] DEFER remaining NOTE items to v4**

---

# 🛡️ SECURITY HARDENING (5 items — external attack protection)

**Context:** Added after threat-model review. The 64 audit findings cover correctness and access control. These 5 items cover the *attack paths an outsider might use* — primarily phishing and session hijack. These are not "bugs" that exist; they are defensive layers currently missing.

Priority order (highest impact first):

---

## HARD-1 — Fix the 9 XSS bugs (SYS-007 to SYS-015)

**Threat addressed:** Session hijack via malicious vendor/issue names. An attacker who gets write access to any of `vendor_name`, `drawing notes`, `rejection reasons`, `BOQ item names`, `full_name`, `bank_ifsc`, `p.reason` can inject HTML/JS. That JS runs in every other viewer's browser with their session. SameSite cookie stops cookie theft, but not: triggering action-as-victim (approve PR, change bank account), reading DOM secrets, screenshotting UI.

**Fix pattern (mechanical, 9 sites):**
Wrap each unescaped interpolation with `UI.escapeText()` or `UI.escapeAttr()`:
- `d.notes` → `UI.escapeText(d.notes)` at app.js:932
- `d.reason` → `UI.escapeText(d.reason)` at app.js:1300, 1317
- `a.project_name`, `a.raised_by_name` → `UI.escapeText(...)` at app.js:1958
- `i.trade`, `i.item_name`, `i.unit` → `UI.escapeText(...)` at app.js:2659
- `u.full_name` → `UI.escapeText(u.full_name)` at app.js:2953
- `s.vendor_name` → `UI.escapeText(s.vendor_name)` at app.js:3228
- `v.bank_ifsc` → `UI.escapeText(v.bank_ifsc)` at app.js:4985
- `p.reason` → `UI.escapeText(p.reason)` at app.js:5380

**Pre-work checklist applied:**
- grep `UI.escapeText` — confirmed in `public/js/ui.js:143`, already imported everywhere that uses it ✓
- grep each exact line — all 9 confirmed unescaped ✓
- No new function needed, no new route, no schema change

**Callers impacted:** None — pure cosmetic rendering, no API change
**Blast radius:** Zero — escaping a string that was safe stays safe; escaping one that was unsafe becomes safe
**Rollback:** Remove the `UI.escapeText()` wrappers

**Effort:** ~20 minutes

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

---

## HARD-2 — Account lockout after repeated failed logins

**Threat addressed:** Password guessing attacks. Today an attacker can try passwords forever. With your 60-entry blocklist and 8-char minimum, brute-forcing a weak password takes ~10,000 tries — well within a day if nothing stops them.

**Fix:**

1. **New migration:** add columns to `users` table
   - `failed_login_count INT UNSIGNED NOT NULL DEFAULT 0`
   - `locked_until DATETIME NULL`

2. **Modify `/auth/login`:**
   - After `bcrypt.compare()` returns false → `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id=?`
   - If `failed_login_count >= 5` → `UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)`
   - Before bcrypt check, if `locked_until > NOW()` → return 401 "Account temporarily locked — try again in X minutes"
   - On successful login → `UPDATE users SET failed_login_count = 0, locked_until = NULL`
   - Audit log each lock event
   - Notify principals via WhatsApp when any account locks (detection layer)

3. **Frontend:** show countdown when locked

**Pre-work checklist:**
- Existing `users` table has schema space — `force_password_change` already added similarly ✓
- `audit.log()` already available ✓
- `notif.notify()` available for principal alert ✓
- No collision with session timeouts (8h session separate from 15min lockout)

**Callers impacted:** `/auth/login` modified; no API contract change
**Blast radius:** If lockout logic wrong, legitimate user locked — unlock path needed. Fallback: IT admin / principal manually clears `locked_until` via DB or via reset flow.
**Edge cases considered:**
- User mistypes 5 times → lockout for 15 min. Acceptable friction.
- Attacker tries different accounts → only target gets locked; attacker can't DoS multiple users at once from same IP because IP isn't the key
- What if attacker spams locks to DoS specific principal? → principals get WhatsApp alert, can investigate
- Lock during password reset flow? → lockout only on `/login`, not `/verify-otp`; reset still works

**Rollback:** single migration rollback + `git revert` on auth.js

**Effort:** ~1.5 hours

**[ ] APPROVE / [ ] MODIFY (change threshold/duration) / [ ] DEFER**

---

## HARD-3 — Alert on vendor bank account change

**Threat addressed:** Silent bank-account swap is the single most valuable attack. Attacker with finance/principal session edits a vendor's `bank_account`/`bank_ifsc` — next legitimate payment goes to attacker. Today this happens with zero notification to anyone.

**Fix:**

1. **Modify `PATCH /vendors/master/:id/clear` and `PATCH /vendors/master/:id`** (the endpoints that can change bank details):
   - Before UPDATE, SELECT current `bank_account`, `bank_ifsc`
   - After UPDATE, if either field changed → trigger alert

2. **Alert flow:**
   - WhatsApp to both principals: `"⚠ Vendor [name] bank details changed by [actor]. Old: [last4] New: [last4]. If unexpected, reply STOP to freeze vendor."`
   - Audit log `vendor.bank_change` with old + new values (audit log already exists, just add action type)

3. **Optional extension (deferred):** "reply STOP" WhatsApp webhook to instantly set `clearance_status='rejected'` — stops PRs against compromised vendor pending investigation. Not in this scope; flag for v4.

**Pre-work checklist:**
- `PATCH /vendors/master/:id/clear` already exists at `vendors.js:132` ✓
- `notifications.notify()` helper exists ✓
- `audit.log()` exists ✓
- Principals list via `users.principals()` helper ✓
- Current handler doesn't SELECT old values before UPDATE — needs modification

**Callers impacted:** None — user-facing behavior unchanged; only adds notification side-effect
**Blast radius:** If alert spam annoying, principals can mute. If alert fails to fire, silent miss — mitigated because bank changes are rare.
**Edge cases:**
- Bulk upload changes many vendors at once → one alert per vendor. Could be noisy. Throttle: if >3 changes in 60 sec, send one summary alert.
- Legitimate correction during finance clearance → still alerts. Noise but safe.
- What if WhatsApp service down? → Alert queued via notifications table. Delivery not blocking.

**Rollback:** `git revert`, no schema change

**Effort:** ~1 hour

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

---

## HARD-4 — Alert on new-IP login

**Threat addressed:** Phishing detection. If Naveen's password is phished and attacker logs in from a new location, Naveen gets a WhatsApp "Your account just logged in from Delhi — was this you?" alert. Gives him a window to respond before attacker does damage.

**Fix:**

1. **New migration:** table `login_history`
   - `id`, `user_id`, `ip_address`, `user_agent`, `logged_in_at`
   - Index on `(user_id, logged_in_at DESC)`

2. **Modify `/auth/login` (after successful bcrypt):**
   - SELECT distinct IPs from `login_history` for this user in last 30 days
   - If `req.ip` is NOT in that set → "new IP"
   - INSERT new `login_history` row
   - If new IP → WhatsApp to user: `"New login detected from IP [ip] at [time]. If this wasn't you, reply HELP."`
   - (No gate — we don't block; we alert. Blocking would be too friction-heavy.)

3. **Retention:** cron job deletes login_history rows older than 90 days

**Pre-work checklist:**
- `req.ip` works with Express (trust-proxy setting needed if behind NGINX — confirm before deploy)
- `users.phone` exists for WhatsApp send ✓
- `notifications.notify()` helper exists ✓
- New table — no collision

**Callers impacted:** None — user-facing behavior unchanged
**Blast radius:**
- False positive: user on hotel wifi → alert on every new city. Acceptable — users can learn to ignore or confirm.
- False negative: attacker on same IP as user (rare, but possible with ISP sharing) → no alert. Acceptable given baseline.
- If `req.ip` returns proxy IP not real client IP (NGINX/Cloudflare misconfig), all logins look "same IP" → no alerts fire. Pre-deploy verification needed.

**Rollback:** `DROP TABLE login_history`, `git revert`

**Effort:** ~1.5 hours

**[ ] APPROVE / [ ] MODIFY / [ ] DEFER**

---

## HARD-5 — 2FA for principals and finance_admin

**Threat addressed:** Phishing defense. Even if Naveen's/Ajay's/Udupa's password is phished, attacker still can't log in without the 6-digit code from their authenticator app. This is the highest-value single control against external attack.

**Fix:**

1. **New migration:** add columns to `users`
   - `totp_secret VARCHAR(64) NULL`
   - `totp_enabled TINYINT(1) NOT NULL DEFAULT 0`

2. **Install:** `speakeasy` library (Node.js TOTP — industry standard) and `qrcode` for QR generation

3. **New endpoints:**
   - `POST /api/auth/2fa/setup` — generates secret, returns QR code URL (user scans with Google Authenticator / Authy)
   - `POST /api/auth/2fa/confirm` — user enters first TOTP code; if valid, marks `totp_enabled=1`
   - `POST /api/auth/2fa/disable` — requires current TOTP + password

4. **Modify `/auth/login`:**
   - After bcrypt passes, check `totp_enabled`
   - If enabled → return `{ require_2fa: true }` (don't set session yet)
   - Frontend prompts for 6-digit code → `POST /api/auth/2fa/verify` with code + username
   - Backend: TOTP validate → IF ok, NOW set session

5. **Enforcement:** Make 2FA **mandatory** for principals and finance_admin, optional for others:
   - First login after deploy → principal/finance is forced to set up 2FA before accessing anything
   - Others can set up voluntarily

6. **Backup codes:** When 2FA enabled, generate 8 one-time backup codes user prints/saves. Used if authenticator lost.

**Pre-work checklist:**
- `speakeasy` — add to package.json
- `qrcode` — add to package.json
- Existing login flow — breaks into two steps, need new state machine
- Session fixation fix (SYS-021) should be done in same batch — both touch login handler
- Frontend: new 2FA setup screen, 2FA verify screen

**Callers impacted:** All principal + finance_admin login paths. Every login becomes 2-step for them. Big UX change for 4 people (you, Ajay, Udupa, and any future finance admin).

**Blast radius:**
- If TOTP clock drift off, legitimate codes rejected — `speakeasy` allows ±1 window by default, handled
- If backup codes lost AND authenticator lost → only rescue is IT admin (or principal) direct-resetting their record via SSH + DB update. Document this.
- If 2FA endpoint broken, users locked out. Rollback = disable 2FA flag for all users: `UPDATE users SET totp_enabled=0`

**Edge cases:**
- User buys new phone, loses authenticator app → uses backup code, re-enrolls
- User loses backup codes AND phone → locked out, needs emergency override (principal does it via IT admin flow or DB)
- Two-principal scenario (you + Ajay both lose 2FA) → break-glass is SSH access to server. Not pretty but rare.

**Rollback:** `UPDATE users SET totp_enabled=0` + disable new endpoints via feature flag. Schema column can stay (unused).

**Effort:** ~6 hours (biggest item)
**Coverage:** ~4 users mandatory (principals + finance), others optional

**[ ] APPROVE / [ ] MODIFY (e.g., make optional even for principals) / [ ] DEFER (risky in isolation — consider only after HARD-1 to HARD-4 done)**

---

## Summary of hardening items

| Item | Threat | Effort | Priority |
|---|---|---|---|
| HARD-1 XSS fixes | Session hijack vector | 20 min | Do first |
| HARD-2 Account lockout | Password guessing | 1.5 hrs | Do second |
| HARD-3 Bank change alert | Silent vendor swap | 1 hr | Do third |
| HARD-4 New-IP alert | Phishing detection | 1.5 hrs | Do fourth |
| HARD-5 2FA | Phishing prevention | 6 hrs | Do fifth (biggest, highest coverage) |

**Total effort:** ~10 hours across all 5
**Order:** 1 → 2 → 3 → 4 → 5 (each builds independently, can stop after any)

After all 5: the realistic external attack surface shrinks from "phish a password" to "phish a password AND physically steal a phone AND bypass WhatsApp alerts". Material uplift.

---


Once you approve items, I execute in this order:

**Batch A — Safe cleanup (parallel-safe, 15 min)**
- CRIT-1 (already done)
- XM-01 delete duplicate declarations
- HIGH-7 delete duplicate route (after diff review)
- XM-02 delete dead render-map entries

**Batch B — Role gate additions (60-90 min)**
- HIGH-3 (30 endpoints)
- MED-A1..A10 (10 endpoints)
- MED-B1..B5 (refactor ~15 sites)
- MED-C1
- HIGH-4, HIGH-5
- LOW bundle M11-02, M11-03

**Batch C — Frontend fixes (15 min)**
- MED-C2 schedule pid fix
- M04-05 confidence computation

**Batch D — Rate limiting (30 min)**
- HIGH-6 send-otp limiter
- M13-07 verify-otp limiter
- M13-05 fail-fast on missing template

**Batch E — Schema + migration (60-90 min, RISKY)**
- HIGH-1 our_cost_rate wire-through
- HIGH-2 backfill migration with marker column
- MED-C3 rename batch-approve endpoint

**After each batch:**
- 148-file parse sweep
- Role-gate rescanner
- Login simulation (16 roles)
- Audit-role write-block tests
- Tab coverage matrix

**Final:** Full migration deploy order + manual smoke test instructions.

---

# BATCH EXECUTION PLAN (updated with hardening)

Batches ship independently. Verification gates between each — 148-file parse sweep, role-gate rescanner, login simulation, audit-role write-block test, tab coverage matrix.

**Batch A — Safe cleanups (30 min)**
- XM-01 delete 6 duplicate function declarations
- XM-02 delete 6 render-map orphans
- HIGH-7 delete duplicate approve-all route

**Batch B — Role gate additions (2-3 hours)**
- HIGH-3 (30 endpoints)
- MED-A1..A10 (10 endpoints)
- MED-C1, MED-C4, MED-C5
- HIGH-4, HIGH-5
- LOW bundle M11-02, M11-03

**Batch C — Frontend fixes (15 min)**
- MED-C2 schedule pid fix
- M04-05 confidence computation

**Batch D — Password reset redesign (3 hours)**
- HIGH-6 (now includes IT admin role + boss-triggered OTP)

**Batch E — Schema + logic (60-90 min, RISKY)**
- HIGH-1 our_cost_rate wire-through
- HIGH-2 backfill migration
- MED-C3 rename batch-approve endpoint

**Batch F — Security hardening (10 hours total, ordered)**
- HARD-1 XSS fixes (20 min) — do first, highest risk-to-effort
- HARD-2 Account lockout (1.5 hrs)
- HARD-3 Bank-change alert (1 hr)
- HARD-4 New-IP alert (1.5 hrs)
- HARD-5 2FA for principals/finance (6 hrs) — do last, biggest change

Each hardening item deployable independently. Can stop after any.

**After every batch:**
- 148-file parse sweep
- Role-gate rescanner
- Login simulation (all 16 roles, now 17 with it_admin)
- Audit-role write-block tests
- Tab coverage matrix
- Checklist #21 — grep functions/tables/routes, walk full path mentally

---



Please mark decisions on:

1. **HIGH-1** (our_cost_rate) — approve / modify / defer
2. **HIGH-2** (backfill migration) — approve / modify / defer (has irreversibility concern)
3. **HIGH-3** (30 endpoints) — approve full / selective / defer
4. **HIGH-4** (client-receipts gate) — approve / modify / defer
5. **HIGH-5** (claims gate) — approve / modify / defer
6. **HIGH-6** (password reset redesign + IT admin role) — approve / modify / defer
7. **HIGH-7** (duplicate route delete) — approve / defer
8. **MED-A1 through A10** (10 raise-side role gates) — approve bundle / selective / defer
9. **MED-B1 through B5** (5 in-handler → middleware refactors) — approve bundle / defer
10. **MED-C1 through C5** (structural drift — 5 items including drawing view + register gates) — approve / defer each
11. **LOW bundle** (13 items) — approve bundle / selective / defer
12. **NOTE: XM-01, XM-02 cleanups** — approve / defer
13. **HARD-1** (XSS fixes, 9 sites) — approve / defer
14. **HARD-2** (account lockout) — approve / modify threshold / defer
15. **HARD-3** (vendor bank change alert) — approve / defer
16. **HARD-4** (new-IP login alert) — approve / defer
17. **HARD-5** (2FA for principals + finance_admin) — approve / modify (e.g. optional even for principals) / defer

Once returned, I execute only what's approved, in the batch sequence above, with verification gates between batches.

**Shortcuts if you trust my judgement:**
- "Approve all HIGH + CRIT" — that's the baseline safety
- "Approve all HARD" — external attack hardening
- "Approve all MED Cluster A" — the 10 raise-side gates
- "Approve all LOW + NOTE cleanups" — tidy-up
- "Defer everything else" — for later

You can decide at whatever level of detail suits you.
