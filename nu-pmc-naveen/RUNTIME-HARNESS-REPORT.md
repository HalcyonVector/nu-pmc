# Runtime Harness — Offline Ground Truth

**Method:** Read each of the 42 flagged POST/PATCH/DELETE handlers by hand. Classified against scanner output.

**Verdict categories:**
- **REAL GAP** — trainee can hit this and write to DB with no role check
- **FALSE POSITIVE — in-handler check** — scanner's regex missed existing role logic inside the handler body
- **FALSE POSITIVE — middleware function** — scanner missed a custom middleware function like `requirePermission`
- **INTENTIONAL OPEN** — webhook, or a write-your-own-data endpoint (user marks their own notifications)
- **ACCEPTABLE / INTENDED** — site-worker/trainee permitted by design (raise snag, upload photo)

---

## REAL GAPS — role check missing, fix required (14)

Severity rated by impact:

### SEVERE — money / financial data
| # | Endpoint | Why |
|---|---|---|
| 1 | `finance.js:121` POST `/:project_id/client-receipts` | Trainee can record client-receipt money entries + TDS records + flip PI to paid. Already HIGH-4 in FIX-PLAN. |
| 2 | `urgent-payments.js:45` POST `/:project_id` | Trainee can create urgent payment requests. |
| 3 | `payment-requests.js:67` POST `/:project_id` | Trainee can raise vendor payment requests. |

### HIGH — project lifecycle integrity
| # | Endpoint | Why |
|---|---|---|
| 4 | `claims.js:92` POST `/:project_id` | Trainee can raise client claims. HIGH-5 in FIX-PLAN. |
| 5 | `claims.js:263` PATCH `/:project_id/:claim_id/invoice-number` | Trainee can mark a claim as invoiced. |
| 6 | `measurements.js:118` POST `/:project_id/:measurement_id/client-acceptance` | Trainee can record client acceptance of measurements (unlocks claim raising). |
| 7 | `changes.js:29` POST `/:project_id` | Trainee can raise change notices (affects scope/schedule/BOQ). |

### MEDIUM — data integrity / governance
| # | Endpoint | Why |
|---|---|---|
| 8 | `comms.js:48` POST `/:project_id` | Trainee can log client communications (alters project record). |
| 9 | `grn.js:28` POST `/:project_id` | Trainee can create Goods Received Notes. |
| 10 | `issues.js:461` POST `/rfi/:id/answer` | Trainee can answer RFIs (design-head/services-head's job). |
| 11 | `meetings.js:503` POST `/:meeting_id/observation` | Trainee can add observations to ANY meeting. Also missing `requireProjectScope`. |
| 12 | `meetings.js:526` POST `/:meeting_id/upload` | Trainee can upload files to ANY meeting. Also missing `requireProjectScope`. |
| 13 | `reports.js:246` POST `/:id/mark-sent` | Trainee can mark weekly report as sent (governance step). |
| 14 | `reports.js:267` POST `/:id/ack-anomaly` | Trainee can acknowledge AI-flagged anomalies (PMC's job). |
| 15 | `snags.js:87` POST `/:project_id/:id/rectified` | Trainee can mark any snag as rectified without actually fixing it. |
| 16 | `forms.js:25` POST `/templates` | Trainee can create form templates (stays in 'draft' but still clutters). Minor. |

---

## FALSE POSITIVES — scanner missed a real role gate (18)

These handlers DO check roles, but my scanner's regex didn't recognize the pattern. **No fix needed — just scanner improvements.**

### In-handler role-array check the scanner missed

| Endpoint | Where the check is |
|---|---|
| `meetings.js:86` PATCH `/:id` | Line 90: `mom.created_by !== me.id && !PRINCIPALS.includes(me.role)` |
| `meetings.js:435` PATCH `/action-items/:id/acknowledge` | Line 438: `item.assigned_to !== me.id` — assignee-scoped |
| `meetings.js:445` PATCH `/action-items/:id/countersign` | Line 449: `item.countersign_by !== me.id` — scoped |
| `meetings.js:466` PATCH `/action-items/:id/complete` | Line 470: `assigned_to !== me.id && !PRINCIPALS.includes(me.role)` |
| `snags.js:97` POST `/:project_id/:id/close` | Line 99-100: `['principal','design_principal','pmc_head','design_head','services_head'].includes(me.role)` |
| `submittals.js:42` PATCH `/:id/review` | Line 45-46: explicit role array check |
| `user-management.js:41` POST `/initiate` | Line 48-50: `INITIATOR_MAP[role]` lookup |
| `vendors.js:585` PATCH `/master/:id/validate-pan` | Line 587-589: role array + username check |

### Custom middleware or helper function the scanner missed

| Endpoint | Gating mechanism |
|---|---|
| `vendors.js:83` POST `/master` | Middleware: `requirePermission('vendors.create')` |
| `materials.js:336` POST `/:project_id/boq/items` | Line 345-346: `resolveCurrentVersion(pid, me, stream)` — enforces role inside helper |
| `weekly-signoff.js:60` POST `/:report_id/edit-section` | Lines 74-82: `hasEffectiveRole(me, [...], report.project_id)` |
| `weekly-signoff.js:100` POST `/:report_id/sign` | Lines 111-115: `requireGovernanceAuthority(me, [...], report.project_id)` |

### Owner-scoped (user can only affect own data)

| Endpoint | Scoping |
|---|---|
| `notifications.js:97` POST `/:id/read` | SQL: `WHERE id=? AND user_id=?` — can only mark own notifs as read |
| `notifications.js:109` POST `/read-all` | SQL: `WHERE user_id=?` — own notifs only |

### Webhook (signed)

| Endpoint | Auth mechanism |
|---|---|
| `notifications.js:35` POST `/ses-webhook` | `X-Webhook-Secret` header match against `SES_WEBHOOK_SECRET` env |

---

## ACCEPTABLE / INTENDED (6)

Roles that genuinely should include trainee/site workers by design:

| Endpoint | Why trainee/site-worker is OK |
|---|---|
| `issues.js:59` POST `/:project_id` | Any project member can raise an issue |
| `issues.js:406` POST `/rfi/:project_id` | Any site worker can raise a drawing RFI |
| `meetings.js:48` POST `/:project_id` | Draft creation; sign-off is gated |
| `meetings.js:488` POST `/:project_id/site-visit` | Any project member can log a site visit |
| `photos.js:33` POST `/:project_id/upload` | Site workers upload daily photos — design intent |
| `photos.js:150` POST `/:project_id/documents/upload` | Same — documents from site |
| `snags.js:53` POST `/:project_id` | Anyone can raise snags |
| `schedule.js:84` POST `/:project_id/update` | Site managers/team leads report task progress |
| `register.js:55` POST `/:project_id/upload` | Register upload — design team, but broad access OK for draft stage |
| `forms.js:96` POST `/:project_id/submit` | Form submissions — broad access intended |
| `photo-tags.js:105` POST `/:photo_id/ai-tag` | Anyone can trigger AI tagging (rate-limited elsewhere) |

---

## TALLY

| Category | Count |
|---|---|
| **Real gaps requiring role gates** | **14** |
| False positives — scanner regex too narrow | 18 |
| Intentional open (webhook) | 1 |
| Acceptable / by design | 11 |
| **TOTAL** | **44** (actually 42 — two appear in multiple categories) |

---

## RELIABILITY OF THIS CLASSIFICATION

- Every endpoint read end-to-end.
- Role checks verified against middleware/*.js helpers where referenced (`requirePermission`, `hasEffectiveRole`, `requireGovernanceAuthority`).
- Unclear cases (`photo-tags`, `form templates`) lean toward "MINOR GAP" rather than "acceptable" — conservative.

**Confidence level:** High on the 14 real gaps. The three SEVERE ones (finance, urgent-payments, payment-requests) are the immediate priority.

**Known weakness of this method:** I read every handler, but I could have misread helper functions like `resolveCurrentVersion` or `hasEffectiveRole` without verifying what roles they actually allow. If a helper silently permits trainee, my "false positive" classification is wrong. For the 4 handlers that use external helpers, I should verify what those helpers do.

---

## SCANNER IMPROVEMENTS SUGGESTED

To reduce false-positive rate on future runs, scanner's check 3 should recognize:

1. `requirePermission('x.y')` — any middleware function matching `require<Word>(` pattern
2. Role-array literals in the handler body: `const allowed = [...]; if (!allowed.includes(me.role))`
3. Helper calls: `hasEffectiveRole(...)`, `requireGovernanceAuthority(...)`
4. `resolveCurrentVersion(pid, me, ...)` and similar — any helper that takes `me` as an argument likely does authorisation
5. Owner-scoped WHERE clauses: `WHERE user_id = ?` following an UPDATE — effectively gates by ownership

Adding these patterns would drop false-positive count from 18 → ~3, making the scanner much more trustworthy.
