# Matrix Migration — Carve-out Plan

**Decision (May 2026, Naveen):** Drop Twilio WhatsApp integration entirely. Keep wa.me deep-link bridge for vendor-public confirmation flows.

This document is the inventory + per-site replacement map. Code changes happen in phases; this doc is the phase-1 deliverable.

## Decision context

- Matrix is the primary notification substrate (per Matrix Integration Brief §1.1)
- WhatsApp is **not** a per-user fallback tier — once a user is on Matrix, they stay on Matrix (no opt-out, internal or external)
- PWA self-service + PWA web push are the secondary tier (independent of Matrix infrastructure)
- True emergency fallback (Matrix infrastructure outage AND PWA push broken) is handled by ops-team config, not user-facing
- Current code's `NOTIFICATIONS=whatsapp` flag is being retired in favour of `NOTIFICATIONS=matrix` becoming the only supported substrate
- wa.me deep-links (browser → user's own WhatsApp app, no Twilio API call) STAY for: vendor-public confirmation, onboarding token delivery

## Scope summary

| Category | Count | Disposition |
|---|---|---|
| Twilio API caller sites in `modules/` | 19 | Migrate to Matrix |
| Twilio API caller sites in `services/` | 11 | Migrate to Matrix |
| Twilio API caller sites in `scripts/` | 12 | Migrate to Matrix |
| Twilio reply-correlation infrastructure | 1 file (`wa-reply-actions.js`) | Replace with Matrix poll-vote reader |
| Twilio webhook receiver | 1 route (`modules/system/routes/whatsapp.js`) | Delete |
| Twilio service files | 2 (`whatsapp.js`, `whatsapp-interactive.js`) | Delete after callers migrated |
| Twilio middleware | 1 (`twilio-validate.js`) | Delete |
| `buildTwilioRecipient` in wa-link.js | 1 fn | Delete |
| `wa.me` link builders in wa-link.js | 3 fns (`buildLink`, `buildOnboardLink`, `normalisePhone`) | KEEP |
| Tables to drop | `wa_pending_actions`, `wa_send_failures` | Drop after callers gone |
| Tables to keep | (the `_pending_actions` reply-correlation use becomes Matrix poll vote rows, separate schema) | new design |
| Twilio env vars | 4 (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WA_NUMBER`, `WHATSAPP_VERIFY_TOKEN`) | Remove from `.env` |
| `twilio` npm package | 1 | Drop from `package.json` |

## Phasing

**Phase 1 — THIS DOCUMENT.** Inventory + plan. No code changes.

**Phase 2 — Build Matrix inbound side.** Poll-vote reader (Matrix-side equivalent of `wa-reply-actions.js`). Without this, sites that need replies (GRN approval, issue confirm, MOM ack) have no replacement. Phase 3 cannot start until phase 2 is done.

**Phase 3 — Migrate caller sites, one module at a time.** Each WhatsApp call becomes Matrix. Per-module commits with prevent-return tests. Order: simplest first (one-way alerts), correlations last.

**Phase 4 — Delete the substrate.** After all callers migrated and tests pass, delete `whatsapp.js`, `whatsapp-interactive.js`, `wa-reply-actions.js`, the route, the middleware, the tables, the env vars, the npm package.

## Per-site replacement map

### Module: `auth`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/auth/routes/admin-reset.js:170` | `wa.send` to user with temp password | Matrix DM to user via `messaging.notifyUser`. Tier 2: boss reads memorable password aloud over phone. (Decision Event 1) |
| `services/notifications.js:306` (`notifyUserCreated`) | `wa.send` welcome with username/temp pwd | Matrix DM to new user's room |
| `services/notifications.js:316` (`notifyUserActivated`) | `wa.send` activation confirmation | Matrix DM |
| `services/notifications.js:324` (`notifyUserApprovalNeeded`) | `wa.send` to approver (Naveen) | Matrix DM with poll: Approve / Reject |

### Module: `design-services`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/design-services/routes/drawings.js:696` | `waInt.sendButtons` to design head for approval | Matrix poll in `#PVxx-design` room |

### Module: `finance`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/finance/routes/payment-requests.js:260` (urgent payment FYI) | `waInteractive.sendUrgentPaymentFYI` + reply correlation | Matrix message in `#PVxx-finance` with link to PWA |
| `modules/finance/routes/payment-requests.js:264` (correlation row) | `waReply.registerPendingAction` | Matrix poll-vote correlation (phase 2 dependency) |
| `modules/finance/routes/payments.js:631` (self-confirm on ICICI batch) | `wa.send(me.phone, ...)` | Matrix DM to the finance user who completed the batch |
| `modules/finance/routes/payments.js:1027` (UTR to vendor) | `wa.send(payment.vendor_phone, ...)` | Matrix message to vendor's room (if vendor on Matrix); else **wa.me link in PWA for finance to manually share** |
| `modules/finance/routes/payments.js:1047` (urgent UTR → PMC + senior site mgr) | `wa.send(p.phone, ...)` | Matrix message in `#PVxx-finance` and `#PVxx-site` rooms |
| `modules/finance/routes/urgent-payments.js:139` | `waInt.sendWithCTA` to PMC | Matrix message with PWA deep link |
| `modules/finance/routes/urgent-payments.js:150` | `waInt.sendWithCTA` to PMC | Matrix message with PWA deep link |

### Module: `reporting`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/reporting/routes/reports.js:170` | `waInt.sendWithCTA` to PMC for weekly report | Matrix message in `#PVxx-site` room |

### Module: `site`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/site/routes/grn.js:121` | `waInteractive.sendGRNApproval` | Matrix poll in `#PVxx-site` room: "GRN-X — Approve / Mismatch" |
| `modules/site/routes/grn.js:128` (correlation) | `waReply.registerPendingAction` | Matrix poll-vote correlation |
| `modules/site/routes/issues.js:109` | `waInteractive.sendIssueConfirm` | Matrix poll in `#PVxx-site` room |
| `modules/site/routes/issues.js:112` (correlation) | `waReply.registerPendingAction` | Matrix poll-vote correlation |
| `modules/site/routes/issues.js:354` (photo RFI to site mgr) | `wa2.send` with deep-link | Matrix message to site manager's DM with PWA deep link to upload photo |

### Module: `system`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/system/routes/whatsapp.js` (whole file — Twilio webhook receiver) | Receives Twilio inbound webhooks, dispatches to wa-reply-actions | DELETE. Matrix poll votes are read by a scheduled poller, not webhook-driven. |

### Module: `workflow`

| Site | Today | Matrix replacement |
|---|---|---|
| `modules/workflow/routes/changes.js:174` | `waInt.sendCNApprovalAlert` to principal | Matrix poll in principal's DM or `#internal-naveen` |
| `modules/workflow/routes/meetings.js:282` | `waInteractive.sendMOMClientAck` | Matrix poll if client on Matrix; else wa.me deep-link to confirm form in PWA |
| `modules/workflow/routes/meetings.js:286` (correlation) | `waReply.registerPendingAction` | Matrix poll-vote correlation |

### Services: `services/`

| Site | Today | Matrix replacement |
|---|---|---|
| `services/notifications.js:274` (vendor defect) | `wa.send(vendorPhone, ...)` | Matrix message to vendor's room (if on Matrix); else queue formal email via §4 mailto: pattern |
| `services/notifications.js:283` (payment confirmed → vendor) | `wa.send(vendorPhone, ...)` | Matrix message to vendor's room |
| `services/notifications.js:292` (PI raised → client) | `wa.send(clientPhone, ...)` | §4 formal email via mailto: pattern (this is client-facing formal billing) |
| `services/notifications.js:337` (catchall) | `wa.send(phone, msg)` | Matrix `notifyUser` |
| `services/budget-check.js:163, 251` (sendBudgetHardBlock) | `waInt.sendBudgetHardBlock` | Matrix message in `#PVxx-finance` room |
| `services/daily-digest.js:49` (7AM site mgr digest) | `wa.send(assign.phone, ...)` | Matrix DM to site manager (per brief §3.9 — daily digest schedule) |
| `services/wa-reply-actions.js` (whole file) | Twilio reply correlation | DELETE. Replace with Matrix poll-vote reader (phase 2 work). |
| `services/whatsapp.js` (whole file) | Twilio API wrapper | DELETE after callers migrated |
| `services/whatsapp-interactive.js` (whole file) | Twilio Content API buttons | DELETE after callers migrated |

### Scripts: `scripts/`

| Site | Today | Matrix replacement |
|---|---|---|
| `scripts/overdue-checker.js:224` (daily-report missing) | `wa.send` to manager | Matrix DM |
| `scripts/overdue-checker.js:267` (overdue alert) | `wa.send` | Matrix DM |
| `scripts/overdue-checker.js:301` (GRN pending) | `waInt.sendGRNPendingAlert` | Matrix message in `#PVxx-site` |
| `scripts/overdue-checker.js:496` (PMC alert) | `wa.send(pmc.phone, ...)` | Matrix DM |
| `scripts/overdue-checker.js:527` (overdue) | `wa.send` | Matrix DM |
| `scripts/overdue-checker.js:555` (PMC alert) | `wa.send` | Matrix DM |
| `scripts/overdue-checker.js:645` (payment batch ready) | `waInt.sendPaymentBatchReady` | Matrix poll in `#PVxx-finance` room |
| `scripts/overdue-checker.js:660` (PMC alert) | `wa.send` | Matrix DM |
| `scripts/overdue-checker.js:717` (interactive buttons) | `waInt.sendButtons` | Matrix poll |
| `scripts/overdue-checker.js:748` (location request) | `waInt.sendLocationRequest` | Matrix message asking user to share location via PWA (no native Matrix location request — PWA handles geo) |
| `scripts/overdue-checker.js:851, 859` (RFI photo overdue) | `wa2.send(rfi.site_phone, ...)` | Matrix DM to site manager |
| `scripts/schedule-health-checker.js:213` (schedule drift) | `waInt.sendScheduleDriftAlert` | Matrix message in `#PVxx-site` room |
| `scripts/vps-health.js:127` (VPS alert) | `wa.send(ALERT_PHONE, ...)` | Matrix message to `#system-health` room (per brief §10) |

### KEEP — wa.me deep-link bridge (NOT Twilio)

These are NOT Twilio API calls. They generate `https://wa.me/...` URLs that open the user's own WhatsApp app on tap. No Twilio account needed. KEEP.

| Site | Purpose |
|---|---|
| `services/wa-link.js:73` (`buildLink`) | Generic wa.me URL generator |
| `services/wa-link.js:91` (`buildOnboardLink`) | Vendor-onboarding token wa.me URL |
| `services/wa-link.js:14` (`normalisePhone`) | Phone format helper used by both keep and remove paths |
| `modules/auth/routes/users.js:13` (uses `waLink`) | Some user flow generates a wa.me URL |
| `modules/onboarding/routes/vendors.js:50, 764` (`waLink.buildOnboardLink`) | Vendor onboarding |
| `services/vendor-onboarding.js` (whole file) | Token issuance/lookup/consume — KEEP |
| `modules/onboarding/routes/vendor-public.js` (whole route) | Public HTML confirm page reachable via wa.me link — KEEP |

`buildTwilioRecipient(raw)` in `wa-link.js:121` — REMOVE. Used only by `services/whatsapp.js` and `services/whatsapp-interactive.js` (both being deleted).

## Database changes

| Table | Disposition | Notes |
|---|---|---|
| `wa_pending_actions` | DROP after migration | Reply-correlation rows replaced by Matrix poll-vote row. Approval-shape rows replaced by unified `approvals` table (already done). |
| `wa_send_failures` | DROP | Twilio-specific failure log. Matrix has its own outbox/retry. |
| `comms_log` | KEEP, repurpose | Generic "we sent something" log. Matrix uses it; just stop writing Twilio-specific entries. |

## Env vars

| Var | Disposition |
|---|---|
| `TWILIO_ACCOUNT_SID` | REMOVE from `.env`, `.env.example` |
| `TWILIO_AUTH_TOKEN` | REMOVE |
| `TWILIO_WA_NUMBER` | REMOVE |
| `WHATSAPP_VERIFY_TOKEN` | REMOVE |
| `NOTIFICATIONS` | KEEP but only `matrix` is supported. Document that `whatsapp` and `both` are retired values. |
| `MATRIX_HOMESERVER` | KEEP |
| `MATRIX_BOT_TOKEN` | KEEP |
| `MATRIX_BOT_USER_ID` | KEEP |

## npm packages

| Package | Disposition |
|---|---|
| `twilio` | REMOVE from `package.json` after callers migrated |

## Tests to delete

After Phase 4:

- `tests/wa-link.test.js` — KEEP (covers wa.me link generation, which stays)
- `tests/wa-link.test.js` Twilio-recipient tests — REMOVE the `buildTwilioRecipient` test cases
- `tests/wa-log-pii.test.js` — DELETE (Twilio PII redaction concern goes away)
- `tests/wa-sendtemplate-guard.test.js` — DELETE (Twilio sendTemplate goes away)
- `tests/dispatch-substrate-lint.test.js` — REWRITE (now lints "no Matrix-bypass" instead of "no Twilio-bypass")
- `tests/users-lookup-allowlist.test.js` — KEEP (B14, unrelated)
- All other `tests/*.test.js` referencing `services/whatsapp` or `services/whatsapp-interactive` or `services/wa-reply-actions` — review and remove WA-specific assertions

## What's blocked on what

- **Phase 3 cannot start** until phase 2 (Matrix inbound poll reader) is done — otherwise sites needing replies (GRN approve, issue confirm, MOM ack) have no replacement.
- **Phase 4 cannot start** until phase 3 is fully done across all 44 sites.
- **Twilio account / phone number can be released** after phase 4.

## Decisions on prior open questions (May 2026, Naveen)

1. **Vendors not on Matrix → use the EMS-managed Matrix WhatsApp Bridge** (`mautrix-whatsapp`). Vendor sees regular WhatsApp messages on their phone; bridge translates to/from our Matrix room. No special "vendor not on Matrix" code branch — same call path. Operational chore: bridge phone must open WhatsApp once every 14 days to keep linked-device session alive.
2. **Client formal billing (PI raised, weekly report, CN)** → tap-to-email via mailto: deep link per brief §4. PWA generates PDF, posts to user's Matrix room with pre-filled mailto: link. User taps, native mail client opens, they hit Send. Email comes from their nu Associates address.
3. **Site manager location requests** (`scripts/overdue-checker.js:748`) → DROP for now. Matrix supports user-initiated live-location share (MSC3672) but no bot-can-request-location API. PWA browser geolocation is the cleaner future path; don't migrate the existing call, delete it.
4. **VPS health alerts when Matrix is down** → small standalone SMTP-direct helper. Server sends one email to `EMERGENCY_ALERT_TO` env var via `EMERGENCY_SMTP_*` credentials. Used ONLY by `scripts/vps-health.js` and as fallback when Matrix outbox is provably broken. Deliberately separate from notification substrate so failure modes don't share. Not user-facing — fire-alarm-only. (The "from a real person" rule from §4 applies to formal vendor/client docs, not to system-fire alerts.)

## Room structure — final (May 2026)

**This supersedes brief §7.1 and §10.4.** Brief v2 is stale on the room model; the next brief revision (v3) needs to incorporate the structure below. Until v3 is written, this section is the authoritative reference.

### Organisation-wide rooms — created once

| Room | Members | Encryption |
|---|---|---|
| `#internal-naveen` | Naveen only | OFF (bot posts personal digest) |
| `#internal-finance` | Finance team only | OFF (bot posts payment alerts) |
| `#system-health` | Admin + Guru only | OFF (canary + bot health) |

`#system-health` is **a single organisation-wide room — NOT replicated per project**. The 6AM canary tests the entire Matrix pipeline once and posts one result. Naveen sees the daily green summary. If the summary stops appearing, that itself is the alert (silence = failure, per brief §10.4).

### Per-project rooms — created for each new project

| Room | Members | Encryption |
|---|---|---|
| `#PV{n}-coordination` | Internal team + vendors on the project | OFF (bot posts here; bridged WhatsApp vendors see messages) |
| `#PV{n}-internal` | Internal team only (no vendors) | OFF (bot posts; sensitive internal discussion still happens here in clear text on this project's bot rooms) |
| `#PV{n}-finance` | Finance, Naveen, Principal | OFF (bot posts payment requests, batch approvals, UTR confirmations) |

### Room count at scale

- 2 projects: 3 org rooms + 6 project rooms = **9 rooms**
- 4 projects: 3 + 12 = **15 rooms**
- 10 projects: 3 + 30 = **33 rooms**

This is well within EMS capacity. Naming convention is strict (`#PV{n}-{type}`) — provisioning script enforces it; no free-form room names.

### Schema impact

The `matrix_rooms.room_type` enum currently in `migrations/v5.23-matrix-substrate.sql` lists: `'site','finance','design','general','internal_naveen','internal_finance','system_health'`. This needs updating to: `'coordination','internal','finance','internal_naveen','internal_finance','system_health'`. A migration `v5.28-matrix-rooms-retypeenum.sql` will rename in-place; no production rows yet exist on the old enum so it's a free rename.

### What's gone from brief §7.1

- `#PV90-site` — folded into `#PV90-coordination` (was internal-team + bot; now internal + vendors + bot)
- `#PV90-design` — folded into `#PV90-internal` (single internal room covers all streams)
- `#PV90-general` — DROPPED. The brief had this as the encrypted human-only discussion room. With Element X for personal team chat happening anyway, a duplicate "human discussion" room per project is redundant. Discussion goes in `#PV90-internal`.

### Vendors on the project

Vendors are added to `#PV90-coordination` via the EMS WhatsApp bridge (Q1 decision). They see bot posts about deliveries, payments, GRN status as regular WhatsApp messages. They reply in WhatsApp; the bridge translates to a Matrix message in the same room.

## Estimate

- Phase 2 (Matrix poll reader + correlation system): ~1 session
- Phase 3 (44 site migrations across ~10 files + scripts): 3-4 sessions
- Phase 4 (delete substrate + tests + env + npm): ~1 session

Total: 5-6 sessions of focused work.
