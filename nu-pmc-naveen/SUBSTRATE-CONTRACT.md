# SUBSTRATE-CONTRACT.md

Phase 0 output. The frozen contract for the Matrix substrate.
Every claim has a citation. Where the brief is silent the document
explicitly says "decided by Naveen on <date>".

---

## ⚠ BRIEF OVERRIDES — READ FIRST

Two matters where the brief is wrong and Naveen's decision is the truth.

**Override 1: Vendor bank confirmation (Brief P9.1 / Section 11.1)**
The brief's V7 model (vendor confirms, 24hr Naveen window) is DROPPED.
Naveen's V8 model applies. See CLAUDE_WORKING_STRATEGY.md Override 1.

**Override 2: Personal vs Community message routing**
The brief never codifies this. Naveen's rule (May 2026) applies:
bank + BOQ = personal. Everything else = community.
Encoded in signoff_workflows.destination_kind/qualifier (v5.37/v5.38).

---


Status: DRAFT — Phase 0 in progress.

---

## Reading log

- [x] v2 brief Part 1 corrections C1–C14 (lines 1–162)
- [x] v2 brief Part 2 P1 architecture (lines 170–218)
- [x] v2 brief Part 2 P2 schema (lines 220–369)
- [x] v2 brief Part 2 P3 four functions (lines 371–529)
- [x] v2 brief Part 2 P4 data collection (lines 531–575)
- [x] v2 brief Part 2 P5 env + config (lines 577–617)
- [x] v2 brief Part 2 P6 sign-off taxonomy + gate (lines 619–706)
- [x] v2 brief Part 2 P7 message design (lines 708–801)
- [x] v2 brief Part 2 P8 rooms + power levels (lines 803–847)
- [x] v2 brief Part 2 P9 security (lines 849–880)
- [x] v2 brief Part 2 P10 operations (lines 882–958)
- [x] v2 brief Appendix A onboarding (lines 960–1032)
- [x] V8 spec (handoff-2026-04-28/2_ForMe/V8-vendor-bank-protection-SPEC.md, 141 lines)
- [x] Addendum (handoff-2026-04-28/2_ForMe/ADDENDUM-new-usecases.md, 629 lines)
- [x] services/signoff-gate.js end-to-end (812 lines)
- [x] services/matrix-adapter.js end-to-end (483 lines)
- [x] migrations/v5.27 through v5.37 (899 lines total)

**Phase 0 reading: COMPLETE.**

---

## Findings as citations (no synthesis until reading complete)

### Part 1 corrections

**C1 — Room names** (brief lines 17–35)
- Three project rooms per project: `#PV{code}-coordination`, `#PV{code}-internal`, `#PV{code}-finance`
- `coordination` — internal team + vendors, **chat only, no bot** (line 23)
- `internal` — internal team only, **all bot notifications and polls** (line 25)
- `finance` — finance + Naveen + principal, **payment approvals** (line 27)
- Three org rooms: `#internal-naveen` (Naveen personal digest), `#internal-finance` (finance alerts), `#system-health` (canary + admin only)
- "Encryption cannot be changed after creation and names are permanent records" (line 35) — must get rooms right at create time

**C2 — Change notice** (brief lines 37–41)
- CN = multi-person sign-off (PMC + Design Lead + Principal)
- Channel: Matrix link → PWA sign-off screen (NOT poll)
- Reference: P6 for full taxonomy

**C3 — POC results** (lines 43–53)
- Image upload: PASSED, `mxc://matrix.org/nKlOwXxjTnuKFwhXniulIWNt`
- PDF upload: PASSED, `mxc://matrix.org/JvZgKgizuSGipyImiNzCMGMP`
- Threads: 14/17, 3 failures attributed to matrix.org relations API only — will pass on EMS
- Implication: don't write code that depends on threads working until EMS migration

**C4 — Four core functions** (lines 55–67)
- `matrixSend(roomId, content)` — text, image, file, HTML, @mention, thread reply
- `matrixUpload(filePath, mimeType)` — returns mxc:// URL
- `matrixPoll(roomId, question, answers, threadId?)` — sends poll
- `matrixRead(roomId, limit)` — reads messages and votes back
- "content is a plain JavaScript object. The function signature never changes. Only the content object changes." (line 67)
- "Nothing calls the Matrix API directly from business logic. Everything goes through these." (line 57)

**C5 — Two-path principle** (lines 69–77)
- Every bot message ends with EXACTLY one of:
  - Path 1: a Matrix poll
  - Path 2: a PWA deep link
- "Never both. Never neither." (line 71)
- "If you find yourself putting both a poll and a link in the same message — stop and decide which one this workflow actually needs." (line 77)
- Architectural rule, not preference

**C6 — Sign-off gate** (lines 79–87)
- `signoff_workflows.signoff_type` field. Server reads it and routes.
- `signoff_type: 'poll'` → single, relay, acknowledgement → `matrixPoll()`
- `signoff_type: 'pwa'` → multi-person → `matrixSend()` with PWA link
- "No hardcoding of channel per workflow in application code." (line 81)
- "Single person, relay, and acknowledgement all use the poll path. Relay is poll sent sequentially — bot sends to next person automatically when first vote is recorded. Acknowledgement is poll with one option. Multi-person is always PWA." (line 87)

**C7 — NOTHING hardcoded** (lines 89–106). The full table:
- Digest send times → `notifications_config` table
- Poll closing windows → `signoff_workflows.closing_minutes`
- Quorum requirements → `signoff_workflows.quorum_required`
- Headcount thresholds → `project_thresholds` table
- Float alert thresholds → `project_thresholds` table
- Room IDs per project → `project_matrix_rooms` table
- User Matrix IDs → `users.matrix_user_id`
- User personal room IDs → `users.matrix_room_id`
- Vendor cooling period → `security_config` table (`vendor_bank_change_cooling_hours: 24`)
- Canary check schedule → `system_config` table (`canary_time: 06:00`)
- PWA base URL → `PWA_BASE_URL` env var
- Escalation recipients → `signoff_workflows.escalation_user_id`

**C8 — Vote ✅ reaction** (lines 108–114)
- After a vote, bot reacts ✅ on the vote message within 5 seconds
- Endpoint: `PUT /rooms/{roomId}/send/m.reaction/{txnId}` with `m.annotation` rel_type
- This is the user's physical confirmation. Without it, users re-vote.

**C9 — Poll closing** (lines 116–124)
- Polls don't close themselves. Server closes via scheduled logic.
- Time-based: routine approvals (daily report, GRN, snag). Closes at configured time.
- Quorum-based: formal sign-offs (payment batch, change notice). Closes when quorum hit.
- After closing: bot posts result + reacts ✅ on poll message itself. No vote changes after.

**C10 — Three data collection mechanisms** (lines 126–134)
- Poll vote: scheduled `GET /rooms/{id}/messages` job filters `org.matrix.msc3381.poll.response`, latest per sender by `origin_server_ts`
- PWA link click: standard HTTP, person taps link, Matrix not involved
- Mailto click: not automatic. Person taps `mark as sent` button in PWA after.

**C11 — Digests** (lines 136–142)
- One function, three configs in `notifications_config` table
- `sendDigest(userId, roomId, timeWindow, projectIds[])`
- Three calls daily with different params

**C12 — Canary** (lines 144–150)
- One function, five configurations
- `runCanaryCheck(name, pingFn, onSuccessFn, onFailureFn)`
- Called 5x at 6AM from scheduled job
- Results aggregated, posted to `#system-health`

**C13 — `formatMessage`** (lines 152–158)
- One function: `formatMessage(emoji, projectCode, description, actionType, actionPayload)`
- `actionType` is `'poll'` or `'link'`
- `actionPayload` is poll options or PWA URL
- Returns content object ready for `matrixSend()`
- "No message construction elsewhere in the codebase." (line 158)

**C14 — Workflows are rows, not modules** (lines 160–162)
- 21 workflows, all rows in `signoff_workflows`
- "The developer does not need a section per module. They need the schema and the gate." (line 162)

### Part 2 — P1 Architecture

**P1.1 — Two sentences** (lines 172–176)
- "Matrix is the doorbell. The PWA is the house."
- Matrix = attention + binary responses. PWA = data entry + complex.

**P1.2 — Two paths** (lines 178–187) — same as C5

**P1.3 — Four functions** (lines 189–206)
- `matrixSend`, `matrixUpload`, `matrixPoll`, `matrixRead`
- `matrixPoll` returns eventId — "store in signoff_workflows for vote reading" (line 205)
  - Brief is loose: actually stored per-instance. Code uses `signoff_instances.poll_event_id`.
- `matrixRead` — "Filter by event type after reading. Take latest vote per sender." (line 206)

**P1.4 — What Matrix never does** (lines 208–218):
- Data entry — always PWA
- Multi-person formal sign-offs — always PWA
- File storage — always PWA
- Complex UI — always PWA
- External vendor formal communication — always email via mailto

### Part 2 — P2 Schema

**P2.1 — users** (lines 224–234)
- `users.matrix_user_id`, `users.matrix_room_id`
- Populated at onboarding, looked up for every notification

**P2.2 — project_matrix_rooms** (lines 236–254)
- columns: `id, project_id, room_type, matrix_room_id, encryption_enabled, created_at`
- room_type ENUM-like: `coordination|internal|finance`

**P2.3 — signoff_workflows brief schema** (line 258–278):
```
workflow_type, signoff_type, quorum_required, closing_minutes,
required_roles[], escalation_user_id, pwa_route, active
```

**Seeded workflows (line 282-289):**

| workflow_type | signoff_type | quorum | closing_minutes | required_roles |
|---|---|---|---|---|
| daily_report | poll | 1 | 120 | pmc |
| grn_approval | poll | 1 | 120 | pmc |
| snag_rectified | poll | 1 | 60 | pmc |
| payment_batch | poll | 2 | null | finance,naveen |
| change_notice | pwa | 3 | null | pmc,design_lead,principal |
| project_closure | pwa | 4 | null | all_heads |
| weekly_report | pwa | 2 | null | pmc,principal |
| acknowledgement | poll | 1 | 1440 | recipient |

**Brief intent: `payment_batch` is poll/quorum=2 — meaning RELAY (sequential
polls per C6 line 87), not a single poll with 2 voters.**

**P2.4 — notifications_config** (lines 291–303)
- columns: `id, digest_type, send_time, active`

**P2.5 — project_thresholds** (lines 305–317)
- columns: `id, project_id, threshold_type, threshold_value`

**P2.6 — security_config** (lines 319–335)
- key/value pairs
- Seed: `vendor_bank_change_cooling_hours=24`, `canary_time=06:00`, `max_vote_window_minutes=1440`

### Part 2 — P3 Four functions (lines 371–529)

- `matrixSend` (P3.1, line 377): PUT to `/_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}`. Returns event_id.
- Reaction reminder (line 421): use `send/m.reaction/{txnId}` URL form, NOT `m.room.message`. Different endpoint.
- `matrixUpload` (P3.2, line 425): POST to `/_matrix/media/v3/upload`. Returns `mxc://server/fileId`.
- Brief: "Always compress images to under 500KB before uploading." (line 443)
- `matrixPoll` (P3.3, line 447): PUT to `/.../send/org.matrix.msc3381.poll.start/{txnId}`. `kind: 'org.matrix.msc3381.poll.disclosed'`. Returns `{eventId, answers}`.
- `matrixRead` (P3.4, line 493): GET `/rooms/{id}/messages?limit=N&dir=b`.
- Vote dedup (line 511–529): filter for `org.matrix.msc3381.poll.response`, take latest per sender by `origin_server_ts`.

### Part 2 — P4 Data collection

**P4.1 — Poll job** (lines 533–551)
- 2-minute scheduled job. Reads from "signoff_workflows_active" (brief uses this name; in code we call this `signoff_instances WHERE status='in_progress'`).
- Steps per open poll: `matrixRead` → filter response events → dedup → record vote → react ✅ to vote → check closing condition → if closed: record result + post + react ✅ on poll itself
- Phase 2 future: replace polling with Matrix Application Service webhook for instant response.

**P4.2 — PWA link clicks** (line 553–555). Standard HTTP. Matrix not involved on this path.

**P4.3 — Mailto + Mark as Sent** (lines 557–575)
- Person taps mailto deep link, sends email, comes back to PWA, taps "Mark as Sent"
- POST `/api/formal-communications/mark-sent` with `document_type, document_id, recipient_email, sent_at`

### Part 2 — P5 Env + config

**P5.1 — Env vars** (line 581–591)
Five vars only. Everything else is in DB:
- `MATRIX_HOMESERVER`
- `MATRIX_BOT_TOKEN`
- `MATRIX_BOT_USER_ID`
- `NOTIFICATIONS` (=matrix or whatsapp)
- `PWA_BASE_URL`

**P5.2 — Notification feature flag** (line 595–611)
- Single env var switches Matrix ↔ WhatsApp
- `notify(userId, message, roomId)`:
  - if `NOTIFICATIONS === 'whatsapp'` → twilioSend(user.phone, message)
  - else → `matrixSend(roomId || user.matrix_room_id, formatMessage(message))`

**P5.3 — PWA deep links** (line 613–617): always use `process.env.PWA_BASE_URL`.

### Part 2 — P6 Sign-off taxonomy + gate

**P6.1 — The gate** (line 621–639)
- DB-driven: server reads `signoff_workflows.signoff_type` and routes
- Pseudo-code:
```
async triggerSignoff(workflowType, documentId, projectId):
  workflow = signoff_workflows[workflowType]
  approvers = getApprovers(workflow.required_roles, projectId)
  if workflow.signoff_type === 'poll':
    triggerPollSignoff(...)
  else:
    triggerPWASignoff(...)
```
- "Application code never decides the channel — the database does." (line 623)

**⚠ P6.2 — Poll path — CRITICAL** (line 641–671)

Brief line 643: **"For single and acknowledgement — one poll sent to one person's room."**
Brief line 645: **"For relay — poll sent to first person. When their vote is recorded, server automatically sends next poll to next person in the sequence."**

Pseudo-code on line 647–671:
```
const room = await getRoom(projectId, 'internal');         // line 653
const { eventId } = await matrixPoll(room.matrix_room_id,  // line 657
                                     question, workflow.options);
```

**Brief's intent:**
- Single & acknowledgement → "one person's room" (line 643) — personal DM
- Relay → project's `internal` room (line 653, 657) — community

**Naveen's override (May 2026, this session):**
- All bank notifications → personal
- Individual BOQ sign-offs → personal
- Everything else → community
- `payment_batch` and `final_settlement` (payment-related relays) → `#PV{code}-finance` (NOT `internal`)
- `vendor_bank_peer_approve` → `#internal-finance` (org room, vendor master not project-scoped)

The destination_kind/destination_qualifier columns on `signoff_workflows` (added v5.37) encode this.

**P6.3 — PWA path** (line 673–689)
- One message per approver, ALL approvers SIMULTANEOUSLY (not sequential)
- PWA link in each
- Bot uses `formatMessage('📋', projectCode, description, 'link', link)`
- Sends to each approver's `matrix_room_id` (personal room)

**P6.4 — Complete workflow list** (line 693–706):

| Workflow | Type | Path | Quorum | Closes |
|---|---|---|---|---|
| Daily report approval | single | poll | 1 | 2 hours |
| GRN approval | single | poll | 1 | 2 hours |
| Snag rectification | single | poll | 1 | 1 hour |
| MOM acknowledgement | acknowledgement | poll | 1 | 24 hours |
| Payment batch | relay | poll | 2 | quorum |
| Drawing query ack | single | poll | 1 | 24 hours |
| Change notice | multi | pwa | 3 | quorum |
| Weekly report | multi | pwa | 2 | quorum |
| Project closure | multi | pwa | 4 | quorum |
| Final settlement | multi | pwa | 3 | quorum |
| Handover checklist | multi | pwa | 2 | quorum |
| DLP sign-off | multi | pwa | 3 | quorum |

### Part 2 — P7 Message design

**P7.1 — formatMessage** (line 712–730)
- Concrete signature: `formatMessage(emoji, projectCode, description, actionType, actionPayload)`
- `actionType === 'link'` → returns text + HTML with anchor
- Otherwise → plain text (header only)
- "Poll messages use matrixPoll() directly — not formatMessage(). formatMessage() is for text and link messages only." (line 732)

**P7.2 — Emoji code** (line 736–747). Mandatory mapping:
- 🔴 urgent
- 📋 approval needed
- 📊 info only
- ✅ complete
- ⚠️ warning
- ⏰ reminder
- 💰 finance
- 📄 formal document
- 🟢 system healthy
- ❌ failed/rejected

**P7.3 — Format rules** (line 751–763)
- Delimiter: 18 chars max
- Payment items: vendor on line 1, amount+UTR on line 2 indented
- Poll questions: <100 chars
- Amounts: Indian format (₹4,23,500)
- Dates: 1 May 2026 (never 01/05/26)
- Project codes uppercase
- @mentions only for urgent

**P7.4 — Standard message formats** (line 765–801)
- Payment summary template
- Morning digest template

### Part 2 — P8 Rooms + power levels

**P8.1 — Per-project room template** (line 805–811) — three rooms per project:

| Room | Members | Encryption | Bot |
|---|---|---|---|
| `#PV{c}-coordination` | Internal team + vendors | OFF | **No** — chat only |
| `#PV{c}-internal` | Internal team only | OFF | Yes — full access |
| `#PV{c}-finance` | Finance + Naveen + Principal | OFF | Yes — full access |

**P8.2 — Org-wide rooms** (line 813–819) — created once:

| Room | Members | Encryption | Bot |
|---|---|---|---|
| `#internal-naveen` | Naveen only | OFF | Yes — personal digests |
| `#internal-finance` | Finance only | OFF | Yes — payment alerts |
| `#system-health` | Admin + Guru only | OFF | Yes — canary results |

**P8.3 — Power levels** (line 821–841)
- `users_default: 0` (chat allowed)
- bot at level 50
- `org.matrix.msc3381.poll.start` and `poll.end` at level 50 → only bot creates/ends polls
- "Edit poll button is invisible to users." (line 841)

**P8.4 — Room creation script** (line 843–847)
- `node scripts/create-project-rooms.js --project-id PV90`
- Reads project, creates rooms, writes IDs back to `project_matrix_rooms`, sets power levels, invites members
- "Never create rooms manually."

### Part 2 — P9 Security

**P9.1 — Vendor bank detail protection** (line 851–862) — **brief's V7 model**:
1. Finance proposes change. PATCH `/vendors/master/:id` intercepts `bank_account` or `bank_ifsc` change. Creates `pending_change` record. Does NOT save. Bot sends poll to **vendor's Matrix room**: "Confirm your new account details"
2. Vendor confirms (Element X). Bot reads vote. Confirmed → status `pending_naveen`. Rejected → discard, alert finance.
3. Naveen 24hr window. Bot alerts Naveen: "Bank details changing in 24 hours. Tap CANCEL if wrong." Scheduled job applies after 24h.
4. First payment alert. Automatic. Bot alerts Naveen when first payment goes to newly-changed account. Awareness only.

**Brief's V7 → Naveen's V8 override**: Naveen replaced the V7 vendor-confirms-self model with V8 peer-approval (another finance admin / principal approves). V8 spec lives in `handoff-2026-04-28/2_ForMe/V8-vendor-bank-protection-SPEC.md` (TODO: read).

**P9.2 — Bot token** (line 864–870)
- `MATRIX_BOT_TOKEN` env only, never in code
- Rotate annually or on team-member departure
- Bot has posting rights to all rooms — master key

**P9.3 — Encryption** (line 872–880)
- All bot rooms: encryption OFF at creation. Cannot change after.
- Vendor coordination: OFF (bot needs access — but wait, P8.1 says coordination has NO bot. Brief is internally inconsistent. Resolution: the bot has access to read/audit even though it doesn't post, so encryption must stay off.)
- Accidentally encrypted → abandon and recreate
- Audit quarterly

### Part 2 — P10 Operations

**P10.1 — Canary** (line 884–910)
- One function `runCanaryCheck(name, pingFn, onSuccessFn, onFailureFn)`
- 5 checks at 6AM daily:
  - Matrix: send+read test → onFailure: flip `NOTIFICATIONS=whatsapp`, email admin
  - Matrix poll: send poll + read vote → onFailure: alert Guru, log
  - ICICI webhook: POST test → onFailure: alert finance, manual mode
  - GSTIN API: lookup → onFailure: disable form validation
  - IFSC API: lookup → onFailure: disable form validation
- Results aggregated, posted to `#system-health`

**P10.2 — Rollback** (line 912–924)
- Flip `NOTIFICATIONS=whatsapp` env var. No deployment.
- Matrix rooms stay intact. Data not lost.
- Return after 3 consecutive clean canary runs.
- "Never flip back to Matrix on a Friday. Always Monday morning." (line 924)

**P10.3 — Signal retirement** (line 926–936)
- Day 0: mute groups, post final message
- 90 days silent. If Matrix fails, reactivate Signal immediately.
- 90 days clean → archive
- 6 months → delete

**P10.4 — Test harness** (line 938–946)
- `test-matrix.js` — 31 tests, ~4 min
- `test-threads.js` — 17 tests, ~3 min
- 31/31 and 14/17 baseline on matrix.org. EMS must match or exceed.
- Results posted to Matrix + saved to JSON.

**P10.5 — EMS setup** (line 948–958)
- Sign up at `ems.element.io` for `nuassociates.in` domain
- Configure `matrix.nuassociates.in` (EMS-provided DNS record in GoDaddy)
- Configure `chat.nuassociates.in` (branded Element Web for site tablets)
- Tier: $3/user/mo; upgrade to Enterprise at 40+ for SCIM
- All POC on matrix.org first; confirm EMS match before migrating team

### Part 2 — Appendix Onboarding

**A1 — Internal iPhone** (line 962–982). Element X install + nuassociates.ems.host provider + notifications config + display name.

**A2 — Internal Android** (line 984–998). Same but Android.

**A3 — Site manager Android tablet** (line 1000–1012). Chrome → `chat.nuassociates.in` → Add to Home Screen.

**A4 — Vendors** (line 1014–1032)
- "Admin creates EMS guest account — username: company_shortname" (line 1016)
- **"Add matrix_room_id to vendor master in PWA" (line 1018)** ← vendors get personal matrix_room_id on `vendors` table
- Element X install
- Display name: `Company Name — Contact Name` (line 1024)
- "Invite vendor to #PV90-coordination room" (line 1026) ← vendors in coordination room (per project)
- "Mark onboarding complete in vendor master" (line 1030)

**Critical safety rule (line 1032):**
**"Vendors see coordination room only. No access to internal rooms, finance rooms, or other vendors' rooms."**

Implication: vendor's personal room is 1-1 (vendor + bot). Project coordination room is shared with internal team + other vendors. Never put one vendor's data in coordination where other vendors see.

---

## Synthesis — THE FROZEN CONTRACT

This section is the actual one-page contract. Citations point to brief/code
above. Phase 1 work flows from here.

### S1. The architecture (citations: brief P1, P3, P5.2)

- **Matrix is the doorbell. PWA is the house.** (P1.1) Matrix gets attention + binary responses; PWA does data entry, complex UI, and formal sign-offs.
- **Four functions only**: matrixSend, matrixUpload, matrixPoll, matrixRead. Code: `services/matrix-adapter.js` exposes the v2-brief functions plus `sendImage`, `sendReaction`, `closePoll`, `readMessages`, `getProjectRoomId`, `getInternalRoomId`. (P1.3, adapter line 470-483)
- **Two paths only**: poll OR PWA-link. Never both. Never neither. (P1.2, C5)
- **Single env var** flips between Matrix and WhatsApp: `NOTIFICATIONS=matrix|whatsapp`. (P5.2). Per-user override removed in v5.30.

### S2. The gate (citations: brief P6, code services/signoff-gate.js)

- **Gate function**: `triggerSignoff(workflowType, documentId, projectId, opts)`. (P6.1, gate line 572)
- **DB-driven channel**: gate reads `signoff_workflows.signoff_type`. App code never decides channel. (P6.1, brief line 623)
- **Sequence builder is data-driven**: signoff_workflows.sequence (CSV) + signoff_sequence_rules (predicate+action rows). (gate line 494-551)
- **Predicates** (gate line 44-99): always, is_emergency, external_origin, below_threshold, no_snags, settlement_pending, is_services_stream, is_design_stream
- **Actions** (gate line 106-123): skip_role, append_role, strip_initiator
- **Approver resolvers** (gate line 266-280): recipient (from_doc), vendor_rep (from_doc with vendors), client_rep (from clients via projects.client_id), naveen (any of principal/design_principal), pmc/pmc_head/site_manager (role_in_project), principal/design_principal/design_lead/services_head/finance/finance_admin (role_global)

### S3. Personal vs Community destinations (citations: Naveen May 2026, brief P6.2 line 643/653, A4 line 1018, addendum A.3)

**The brief is silent on this distinction. We formalised it.** Naveen's rule:

- **Bank notifications + individual BOQ sign-offs = personal** (Naveen direct quote, this session)
- **Everything else = community** (Naveen direct quote, this session)
- **Smallest audience that needs to see** is the principle.

Encoded in `signoff_workflows.destination_kind` ENUM('personal','project','org') + `destination_qualifier`. (v5.37)

**Three destination kinds** (gate line 381-412):
- **personal**: DM resolved entity in their own matrix_room_id. No @mention. One recipient.
- **project**: post in `#PV{code}-{qualifier}` where qualifier is `internal|finance`. @mention current approver.
- **org**: post in `#internal-{qualifier}` (internal_naveen, internal_finance, system_health). @mention current approver.

### S4. Workflow → destination mapping (Naveen-confirmed this session)

| Workflow | Kind | Qualifier | Notes |
|---|---|---|---|
| daily_report | project | internal | community per Naveen |
| grn_approval | project | internal | community per Naveen |
| snag_rectified | project | internal | community per Naveen |
| issue_confirm | project | internal | community per Naveen |
| urgent_payment_fyi | project | internal | community per Naveen |
| drawing_approval | project | internal | community per Naveen |
| payment_batch | project | finance | bank movement per Naveen |
| final_settlement | project | finance | bank movement per Naveen |
| weekly_report | project | internal | (PWA path, not poll, per v2 P6.4 — but delta brief drops PWA path; treat as poll) |
| change_notice | project | internal | full ladder via rules engine |
| project_closure | project | internal | full ladder via rules engine |
| dlp_signoff | project | internal | community |
| handover_checklist | project | internal | community |
| cn_design_ratification | project | internal | follow-up to emergency CN |
| mom_acknowledgement | personal | recipient | client 1-1 |
| drawing_query_ack | personal | recipient | per-user 1-1 ack |
| **vendor_bank_peer_approve (V8)** | **org** | **internal_finance** | vendor master is org-wide, not project-scoped |
| vendor_bank_self_confirm (V7 path, NOT BUILT) | personal | vendor_rep | brief P9.1 step 1; OVERRIDDEN by V8 in current build |
| Naveen 24h cancel (V8 step 3, NOT BUILT) | org | internal_naveen | brief P9.1 step 3 |
| First-payment alert (V8 step 4, NOT BUILT) | org | internal_naveen | brief P9.1 step 4 |

⚠ **v5.37 backfill bugs** (logged above): `mom_client_ack` should be `mom_acknowledgement`. The `acknowledgement` row doesn't exist. Several workflows fall through to default 'project' / NULL qualifier — works by accident because gate defaults qualifier to 'internal'. Phase 1 fix.

### S5. Vendor addressing (citations: A4 line 1018, addendum A.3, Naveen this session)

**The DB is source of truth.**

- `vendors.matrix_user_id` set → vendor is on Element X (Tier A). DM via Matrix.
- `vendors.matrix_user_id` NULL → vendor is on WhatsApp only (Tier B). Send to phone via WhatsApp (or via mautrix bridge transparently).
- **No phone-derived synthesis. No portal-room caching. No matrix_provisioned flag.** Plain DB lookup.
- Vendor onboards to Element X → admin updates `matrix_user_id` + `matrix_room_id`. Tier flips automatically (`vendorTier(v) = v.matrix_status === 'joined' ? 'A' : 'B'` per addendum line 167-171).

**Vendor poll-recipient case (V8 step 1, V7-style)**: bot DMs vendor's `matrix_room_id`. Personal destination. If vendor not yet on Matrix, gate logs warn and returns null pollEventId. The flow falls back to WhatsApp interactive buttons (existing wa-reply-actions path) for Tier B vendors. **Today the WhatsApp fallback is not wired into the gate** — it's an open Phase-1 item.

### S6. Existing schema (frozen names, not aspirational ones)

The brief says `project_matrix_rooms`. Code uses `matrix_rooms`. They're functionally the same. Live name is `matrix_rooms`. Don't rename.

The brief mentions `client_contacts`. Doesn't exist. Client contact info is on `clients` master table. Don't create `client_contacts`.

The addendum (Section B) proposes `approval_type_config` + `approvals` tables. We use `signoff_workflows` + `signoff_instances` + `signoff_sequence_rules`. Functionally a superset of the addendum's spec. Don't rename.

The addendum proposes `vendor_contacts` (owner/site/accounts roles). DOES NOT EXIST in current schema. Phase 1 build item if needed.

### S7. V8 vendor bank protection — current state vs spec

**V8 spec model**: Path 1 (finance proposes → principal/design_principal approves) + Path 2 (pmc_head/design_head/services_head proposes → finance_admin approves → principal notified read-only).

**Current build** (v5.36 + V8 propose() wiring):
- ✅ `strip_initiator` rule covers separation of duties (proposer ≠ approver)
- ✅ `vendor_bank_peer_approve` workflow with sequence `'finance,principal'` and quorum=1
- ✅ V8 propose() fires `signoff-gate.triggerSignoff` after recording proposal (verified via prevent-return tests)
- ⚠ Path 2 read-only principal notification not modelled — current code gives principal a real poll. Either Phase-1 fix (drop principal from sequence post-strip when proposer is non-finance) or accept as over-modelling.
- ⚠ V8 spec line 51: principals do NOT propose. Should be enforced at propose() endpoint with a 4xx, not at gate level. Phase-1 fix.
- ⚠ V8 step 1 (vendor confirms own bank) — NOT BUILT. This is the V7-style step the addendum/brief P9.1 mandates. Naveen's V8 decision overrides V7's vendor-self-confirmation. Confirm with Naveen whether V7 step 1 is fully dropped or retained alongside V8 peer approval.
- ⚠ V8 step 3 (Naveen 24h cancel) and step 4 (first-payment alert) — NOT BUILT.

### S8. Phase 3 caller migrations — status

**Migrated** (with prevent-return tests):
- ✅ grn_approval (modules/site/routes/grn.js)
- ✅ issue_confirm (modules/site/routes/issues.js)
- ✅ urgent_payment_fyi (modules/finance/routes/payment-requests.js urgent flow)
- ✅ V8 vendor_bank_peer_approve (modules/onboarding/lib/vendor-bank-change.js propose)

**Deferred (with documented reasons)**:
- mom_client_ack — clients.matrix_room_id now exists in v5.31, can migrate. v5.37 backfill mis-named the workflow as `mom_client_ack`; actual is `mom_acknowledgement`. Phase-1 fix.
- drawing_approval — workflow seed exists in v5.34, gate's `_dispatchPoll` supports `attachImage`. Caller in modules/design-services/routes/drawings.js NOT YET migrated.
- change_notice principal-approval (changes.js) — needs whole-CN-flow refactor against the gate. Largest remaining piece.
- daily_report — Excel-drop replacement, Naveen-decided but not built.
- V8 step 1, 3, 4 — see S7.

### S9. Bugs found during Phase 0 read (Phase 1 fix list)

**Fix order: smallest blast-radius first.**

**B1. v5.37 mom_client_ack → mom_acknowledgement** (1-line follow-up migration)
The UPDATE in v5.37 line 47 targets a workflow_type that doesn't exist. Add v5.38 to set destination_kind correctly for `mom_acknowledgement` and remove the orphan `acknowledgement` reference.

**B2. Gate triggerNextRelayStep workflow lookup** (gate line 733-737)
Reads `inst.workflow_id` which doesn't exist. Should be `inst.workflow_type`. Tests don't catch this because they mock the workflow row. Result: relay-step polls all use destination_kind='personal' default regardless of workflow's actual classification. Real-world impact: relay's second/third polls go to personal DMs even when workflow says project room. Hot fix.

**B3. Workflows missing destination classification** (v5.37 backfill incomplete)
`mom_acknowledgement`, `drawing_query_ack`, `cn_design_ratification` get default 'project' kind with NULL qualifier. Gate falls back to 'internal' but the silent default is fragile. v5.38 adds explicit rows.

**B4. V8 path 2 over-modelling** (v5.36 sequence)
Principal currently gets a real Approve/Reject poll in V8 path 2 instead of read-only notification. Either change strip_initiator to additionally drop principal when proposer ∉ {finance,principal} (data-driven; one rule), or accept as over-modelling and document. **Confirm with Naveen which path.**

**B5. V8 principal-cannot-propose validation** (vendor-bank-change.js propose())
V8 spec line 51 says principals don't propose. Currently no validation rejects principal as proposer. Add to propose() endpoint.

### S10. Next-up after Phase 0 freeze (Phase 1, in priority order)

1. **B2 fix** — gate's relay-step workflow lookup bug. Highest blast radius. ~30 min.
2. **B1 + B3 fixes** — v5.38 destination backfill. ~30 min.
3. **mom_acknowledgement caller migration** — modules/workflow/routes/meetings.js. Now unblocked since v5.31 added clients.matrix_room_id. ~1 hour.
4. **drawing_approval caller migration** — modules/design-services/routes/drawings.js. Workflow + image support already in place. ~1 hour.
5. **B4 + B5 V8 fixes** (after Naveen confirms direction). ~30 min.
6. **V8 step 3 & 4** (Naveen alerts) — straightforward triggerSignoff calls. ~1 hour each.
7. **change_notice principal-approval refactor** (the big one) — modules/workflow/routes/changes.js full review against the gate model. ~half day.
8. **daily_report Excel-drop replacement** — Naveen-decided. ~half day.

After Phase 1 callers, Phase 2 abstractions (formatMessage / sendDigest / runCanaryCheck), then Phase 3 scaffolding (room creation, test harness, onboarding scripts), then Phase 4 cleanup.

---

**Contract status: FROZEN as of Phase 0 completion.**
Any deviation from this requires re-opening Phase 0 with Naveen, not a unilateral substrate change.

### V8 spec (handoff-2026-04-28/2_ForMe/V8-vendor-bank-protection-SPEC.md)

**Authoritative source statement** (line 5): brief Section 11.1 is authoritative; this file expands it. If they diverge, the brief wins. (But Naveen has been treating V8 as overriding V7 in conversation — locked decision.)

**The vulnerability** (line 15-27)
- `PATCH /api/vendors/master/:id` allows editing `bank_account/bank_ifsc/bank_name` without resetting clearance
- A compromised finance_admin or principal account could redirect payments

**Three layers** (line 31):

**Layer 1 — Auto-uncheck** (line 33-41)
- If `bank_account` OR `bank_ifsc` changes AND vendor `clearance_status='cleared'`
- THEN flip `clearance_status='pending'`

**Layer 2 — Dual approval** (line 43-65)
- Path 1: `finance_admin` proposes → `principal` or `design_principal` approves
- Path 2: `pmc_head` OR `design_head` OR `services_head` proposes → `finance_admin` approves → `principal` notified (read-only)
- Principals do NOT propose changes (line 51). Oversight only.
- Same role cannot propose AND approve. Proposer ≠ approver. (line 54)
- Applies to existing CHANGES + new vendor CREATION (line 57-59)
- Naveen accepted slower onboarding as cost of protection (line 62)
- Pattern reuses `signoff-helpers.js` multi-signature mechanism (line 64)

**Layer 3 — Alert mechanism** (line 67-86)
- Today: write to `vendor_alerts` table (placeholder)
- When Matrix goes live: bot reads/posts from that table — zero rework
- Three alerts per change: proposed / approved-or-rejected / committed

**Acceptance test** (line 117-129):
1. finance_admin proposes IFSC change → vendor's clearance flips to `pending` immediately
2. Change doesn't take effect until principal/design_principal approves
3. Same finance_admin who proposed CANNOT approve
4. Row in `vendor_alerts` for proposed change
5. Vendor disappears from any in-progress payment cycle's vendor list
6. Re-clearing restores eligibility for next cycle
7. Repeat for pmc_head-proposed approved by finance_admin
8. Brand-new vendor creation also requires two-person approval

**⚠ Note vs current build:** my v5.36 `vendor_bank_peer_approve` workflow is single-step ("any peer approves"). V8 is more nuanced: Path 2 has a *third* read-only notification to principal AFTER finance_admin approves. The current gate doesn't model "notify but don't sign-off." Either I add a `post_completion_hook` for it, or accept this as a Phase-2 detail.

### Addendum (handoff-2026-04-28/2_ForMe/ADDENDUM-new-usecases.md)

**Section A — Vendor payment receipt confirmation** (line 9-52)
- Trigger: UTR webhook fires
- Tier A (Matrix-onboarded vendor): bot posts to vendor's DM room with poll (✅ Yes / ❌ No)
- Tier B (WhatsApp-only): bot posts to **finance's room** with wa.me deep link generator. Finance taps → opens WhatsApp with pre-filled message + secure web-form link → vendor confirms via web form
- Records to `vendor_payment_confirmations` table
- "No" → escalation to finance + Naveen rooms, 24h SLA
- ⚠ This is a NEW workflow type, not in v2 brief P6.4 list

**Section A.1 — Vendor onboarding paths** (line 56-104)
- **Path 1 — Excel template upload**: extends `nu PMC BulkUploadTemplates v1.xlsx` with vendor sheet. Strict validation. Bank fields included BUT still flow through V8 gate.
- **Path 2 — Self-service web form**: app generates secure single-use link. Vendor opens browser, validates GSTIN/IFSC/PAN. Same V8 gate.

**Section A.2 — `vendor_contacts` table** (line 107-146)
- Three fixed roles: `owner`, `site`, `accounts`
- Schema (line 119-134):
```sql
CREATE TABLE vendor_contacts (
  id, vendor_id, role ENUM('owner','site','accounts'),
  name, phone, whatsapp, email, matrix_user_id,
  is_primary, created_at,
  UNIQUE KEY (vendor_id, role)
);
```
- Routing rules (line 137-140):
  - Bank confirmation poll / wa.me payment notice → `accounts` contact
  - Site coordination, snag tickets, daily report queries → `site` contact
  - Formal disputes, escalations, legal correspondence → `owner` contact
  - Fallback: `is_primary=TRUE` → `vendor.contact_phone`

**Section A.3 — Two-tier vendor model** (line 152-175)
- Tier A: Matrix-onboarded — bank confirmation poll + payment receipt poll + snag three-way sign-off
- Tier B: WhatsApp-only — internal dual approval only (no vendor confirmation), payment notification via tap-to-WhatsApp
- **Tier is COMPUTED** (line 167-171):
```javascript
function vendorTier(vendor) {
  return vendor.matrix_status === 'joined' ? 'A' : 'B';
}
```
- No hardcoded vendor-tier list. Tier flips automatically when vendor onboards.

**Section A.4 — Tap-to-WhatsApp onboarding** (line 179-214)
- PMC head / design head / finance does basic onboarding in app (Stage 1)
- App offers "Send onboarding message" button → wa.me link with pre-filled invitation
- Internal user reviews, taps Send. Vendor receives.
- Matrix join is OPTIONAL — if vendor installs, becomes Tier A. If not, stays Tier B.
- `vendors.matrix_status` ENUM: `not_invited / invited_pending / joined / declined`
- Reminder cadence: Day 7 prompt to internal user, Day 30 auto-flip to `declined`

**Section B — Generalised approvals table (FOUNDATIONAL)** (line 220-294)

⚠⚠⚠ This is the most important architectural piece in the addendum.

- **DB-driven, NOT hardcoded** (line 226). Sheet 9 (`approval_type_config`) is uploaded via existing governance flow.
- Schema (line 235-273):
```sql
CREATE TABLE approval_type_config (
  approval_type VARCHAR(50) PRIMARY KEY,
  display_name, required_signer_roles JSON,
  quorum_required INT DEFAULT 2,
  expires_after_days INT DEFAULT 7,
  proposer_eligible_roles JSON,
  approver_must_differ_from_proposer BOOLEAN DEFAULT TRUE,
  notify_principal_on_complete BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE approvals (
  id, approval_type FK, entity_id,
  required_signers JSON,
  votes JSON,           -- [{user_id, vote, room_id, ts}]
  matrix_event_ids JSON, -- [{room_id, event_id}]
  quorum_state ENUM('open','approved','rejected','expired'),
  quorum_at, expires_at,
  created_by, created_at
);
```

- Initial Sheet 9 content (line 277-286). 8 seeded approval types:
  - vendor_bank_change | [finance_admin, principal_or_design_principal] | quorum 2 | proposers: finance_admin, pmc_head, design_head, services_head
  - change_notice | quorum 4 | proposers: pmc_head, design_head
  - project_closure | quorum 4 | proposers: pmc_head
  - weekly_report | quorum 2 | proposers: pmc_head
  - payment_batch | quorum 2 | proposers: finance_admin
  - client_invoice | quorum 2 | proposers: pmc_head
  - snag_verification | quorum 3 (site_manager, design_head, vendor_self) | proposers: site_manager
  - boq_rollback | quorum 2 | proposers: design_head

- "Build the generalised table when V8 is built. V8 is the first user." (line 288-289)
- "Subsequent workflows register new types via Sheet 9 upload — no code changes needed." (line 290)

**⚠⚠⚠ Conflict with what's built today:**

- Built: `signoff_workflows` (workflow_type, signoff_type, sequence, closing_minutes, quorum_required, destination_kind, destination_qualifier, principal_threshold_pct) + `signoff_instances` + `signoff_sequence_rules`.
- Addendum spec: `approval_type_config` (with `notify_principal_on_complete`, `expires_after_days`, `approver_must_differ_from_proposer`) + `approvals` (with `votes JSON`, `matrix_event_ids JSON`, `quorum_state ENUM`).

Differences:
- Naming: `signoff_*` vs `approval_*`
- Schema: addendum stores votes inline in JSON column; my build stores them via vote-reader job from Matrix events
- Schema: addendum has `notify_principal_on_complete` boolean; my build models this via post-completion hooks (extensible) — better
- Schema: addendum has `expires_after_days`; my build has `closing_minutes` — same concept different units
- Schema: addendum has `proposer_eligible_roles`; my build has `signoff_sequence_rules.strip_initiator` — same outcome via different mechanism
- Schema: addendum has `approver_must_differ_from_proposer`; my build's strip_initiator handles it

Decision needed (Naveen):
1. Rename my `signoff_*` tables to `approval_*` to match addendum?
2. Or keep `signoff_*` and treat the addendum names as historical?
3. Or build the `approval_*` tables as separate from `signoff_*`?

My read: the addendum was written before the gate was built. The actual built schema is functionally a superset (post-completion hooks + sequence rules + destination_kind are richer than the addendum's plain `notify_principal_on_complete`). Renaming is cosmetic; keeping is cleaner. **Lean: keep `signoff_*` names. Document mapping in the contract.**

**Section C+D — Snag three-way sign-off** (line 324-348)
- Site manager raises snag (with photo)
- Design team confirms
- Vendor accepts/contests
- Vendor fixes, posts proof photo
- Site manager + design team accept fix → snag closed
- PMC visible but NOT a required signer
- approval_type='snag_verification', required_signers=[site_mgr_id, design_head_id, vendor_id]

**Section E — Drawing query → designer direct** (line 352-370)
- Bot routes site manager → design room (PMC + design head + assigned designer)
- Designer responds in thread
- PMC visible in room, not routing through PMC
- Bot relays designer's reply back to site manager's project room
- DB records query → response with matrix_event_id

**Section F — Location ping in 7AM digest** (line 374-410)
- Folds existing 9:30 location ping into 7AM digest
- Single tappable poll: Site / Office / Travel / Sick / Leave
- ⚠ Notification volume budget: target ≤8 bot messages per user per workday. Defeats purpose if higher.

**Section G — Item-level threading** (line 414-447)
- Every entity with a lifecycle conversation gets its own Matrix thread
- Thread URL stored on entity row (`matrix_thread_id` column)
- Entities: change notices, RFIs/drawing queries, snags, material requests, issues, daily report flags, vendor disputes, payment exception cases
- Naveen's decision: locked

**Section H — Engagement-scoped rooms — DROPPED** (line 473-478)
- One room per project. Trade groups together creates peer pressure.

**Section I — Soft delegation reroute** (line 482-499)
- When primary user (e.g. on leave) opens Element X, bot detects activity and prompts to take notifications back

**Section J — Crisis broadcast** (line 503-515)
- "Crisis" trigger in app → poll to ALL project rooms simultaneously
- DB records who saw it within how many minutes

**Section K — Tap-to-WhatsApp deep links** (line 519-574)
- wa.me URL format for WhatsApp messages with pre-filled body
- Three-channel architecture (line 543-549):
  - mailto: → Formal external documents (PDF link in email)
  - wa.me: → Quick vendor/consultant confirmations (WhatsApp message + secure web link)
  - Matrix bot → Internal team + Matrix-onboarded parties (polls, threads, audit)
- Caveats: volume limits (Meta anti-spam), link preview crawler handling, no native button capture (web form needed)
- "This makes Matrix vendor onboarding OPTIONAL rather than required." (line 571)

**Notification volume audit (cross-cutting)** (line 587-597)
- Build script that simulates a typical day
- Acceptance: no user >10 bot messages per workday
- Must be done BEFORE pilot

**Build order** (line 602-619). The addendum's stated build order:
1. **NEXT** (before EMS signup): approvals table + Sheet 9, V8, wa.me generator (K), vendor_contacts (A.2), vendor onboarding wa.me (A.4), Excel template (A.1 P1), self-service form (A.1 P2), Tier-A receipt confirmation (A), Tier-B notification (K-fallback), notification volume audit
2. **AFTER EMS signup**: snag three-way (C+D), item-level threading (G), drawing query relay (E)
3. **AFTER pilot**: soft delegation (I), crisis broadcast (J), 7AM digest with location (F)

(Reading continues — gate code + adapter + migrations)

### services/signoff-gate.js — read end-to-end (812 lines)

**Structure:**
- PREDICATES registry (line 44-99): always, is_emergency, external_origin, below_threshold, no_snags, settlement_pending, is_services_stream, is_design_stream
- ACTIONS registry (line 106-123): skip_role, append_role, strip_initiator
- `_initiatorRoleFromDoc` helper (line 146-157): reads source map → *_by_role columns → initiatorUser.role
- `_findUser` + `_STRATEGIES` (line 177-262): role_global, role_global_any, role_in_project, from_doc, from_client_master
- `APPROVER_RESOLVERS` data (line 266-280)
- `resolveApprover` (line 282-294)
- `POST_COMPLETION_HOOKS` registry (line 314-345): change_notice → emergencyDesignRatification
- `_runPostCompletionHooks` (line 353-367)
- `DESTINATION_RESOLVERS` registry (line 381-412): personal, project, org
- `_dispatchPoll` (line 419-475)
- `buildSequence` (line 494-551)
- Public: `triggerSignoff` (line 572-658), `triggerNextRelayStep` (line 674-770), `markRejected` (line 781-798)

**Public API exports** (line 800-812):
```
triggerSignoff, triggerNextRelayStep, markRejected,
buildSequence, resolveApprover,
PREDICATES, ACTIONS, APPROVER_RESOLVERS, POST_COMPLETION_HOOKS, SignoffError
```

**🐛 BUG FOUND in gate during Phase 0 read** (line 733-737):

```javascript
const [[workflow]] = await db.query(
  `SELECT id, workflow_type, destination_kind, destination_qualifier
     FROM signoff_workflows WHERE id = ? LIMIT 1`,
  [inst.workflow_id]   // ← BUG
);
```

`signoff_instances` has `workflow_type` (VARCHAR 64), NOT `workflow_id`. Confirmed in v5.32 line 31:
```
workflow_type         VARCHAR(64)  NOT NULL,
```

Result: `inst.workflow_id` is `undefined`, the query returns no row, `workflow` is `undefined`, and the dispatcher falls through to `kind: 'personal'` default (line 420). All relay-step polls have been silently going to personal rooms regardless of the workflow's actual destination_kind.

The test that "passed" mocks the workflow row inline (`tests/signoff-gate.test.js` line ~389), so it didn't catch this.

**Fix required:** change `WHERE id = ?` → `WHERE workflow_type = ?` AND change `[inst.workflow_id]` → `[inst.workflow_type]`.

This is a Phase 1 fix item — DO NOT touch the gate during Phase 0 reading. Logged for fix immediately after Phase 0 completes.


### services/matrix-adapter.js — read end-to-end (483 lines)

**Three modes** (line 7-13): LIVE / DRY_RUN / DISABLED. Read from env per call (line 34-41) so cutover doesn't need restart.

**Functions exported** (line 470-483):
- `modeOf`, `makeTxnId`
- `sendText` — text msg, durable via matrix_outbox
- `sendPoll` — poll with answers, durable via matrix_outbox
- `sendImage` — m.image (mxc:// from uploadMedia), durable
- `sendReaction` — m.reaction non-durable (line 401-404 explicit decision: best-effort, not queued)
- `closePoll` — m.poll.end event (line 437-468)
- `uploadMedia` — POST /_matrix/media/v3/upload, returns mxc://
- `readMessages` — GET /messages?dir=b
- `getProjectRoomId` (line 339-347): SELECT room_id FROM **matrix_rooms** WHERE project_id=? AND room_type=?
- `getInternalRoomId` (line 352-360): same table, project_id IS NULL

**4xx handling** (line 64-71):
```
RETRYABLE_4XX = {408, 425, 429}
_isTerminal4xx → status >= 400 && < 500 && !RETRYABLE_4XX
```

**Outbox pattern** (line 19-21, 86-94): every send writes to `matrix_outbox` first as 'pending' (or 'dry_run'), HTTP attempt updates to 'sent' / 'failed' / retry. At-least-once semantics tied to durable queue.

⚠ **Schema mismatch with brief**: brief P2.2 calls the table `project_matrix_rooms`. Code uses `matrix_rooms` (v5.23 baseline, v5.28 retyped enum). Functionally equivalent. The brief's name is the v2 ideal; live code uses the v1 baseline name.

### Migrations end-to-end

**v5.27 — matrix-pending-polls** (97 lines)
- `matrix_pending_polls` table — keyed by Matrix poll_event_id
- Status: pending / acted / expired / cancelled
- `matrix_reader_cursor` table — last_seen_ts per room
- ⚠ NOT dropped by later migrations. Continues for "one-shot polls that aren't part of a workflow." (v5.32 line 114-116)

**v5.28 — matrix_rooms retype enum** (read above) — site/design/general → coordination/internal. v1 values kept in enum for archived rows.

**v5.29 — config tables** (203 lines)
- Created `signoff_workflows`, `notifications_config`, `project_thresholds`, `security_config`, `formal_communications`
- v5.29's signoff_workflows seed uses `required_roles` column. v5.31 renames to `sequence` and reseeds.
- ⚠ Note: v5.29 seeded `mom_ack` but v5.31 reseeded as `mom_acknowledgement`. Different name from `mom_client_ack`.

**v5.30 — drop notification_channel** (31 lines)
- Drops `users.notification_channel` column. Per v2 P5.2: env-flag-only switching, no per-user override.

**v5.31 — signoff-relay-schema** (135 lines)
- Renamed `signoff_workflows.required_roles` → `sequence`
- Added `principal_threshold_pct DECIMAL(5,2) NULL`
- Dropped `pwa_route` column
- Added `change_notices.cn_origin/cost_liability/is_emergency`
- Created `project_closures` table
- Added `clients.matrix_room_id`
- TRUNCATE-and-reseed `signoff_workflows` per delta brief Section 2:
  - daily_report, grn_approval, snag_rectified — single approver, time-based
  - mom_acknowledgement (1440 min) — recipient
  - drawing_query_ack (1440 min) — pmc
  - payment_batch — finance,naveen — quorum
  - weekly_report — pmc,principal — quorum
  - final_settlement — finance,naveen,principal — quorum, threshold=2.00
  - dlp_signoff — design_lead,services_head,pmc — quorum
  - **change_notice** — full ladder `'site_manager,pmc,design_lead,principal'` with rules trim
  - **project_closure** — full ladder, rules trim
  - handover_checklist — pmc,client_rep
  - cn_design_ratification — design_lead, 2880 min

**v5.32 — signoff_instances** (118 lines)
- `signoff_instances` table:
  ```
  workflow_type VARCHAR(64),  -- FK-by-string to signoff_workflows.workflow_type
  document_id, project_id (NULL allowed),
  poll_event_id, poll_room_id, current_approver_id,
  remaining_approvers JSON, full_sequence JSON,
  question, options JSON,
  status ENUM(pending|in_progress|completed|cancelled|expired),
  closes_at, result ENUM(approved|rejected|no_quorum|timed_out),
  triggered_by_user_id, created_at, updated_at, completed_at
  ```
- Indices: idx_active_lookup(type+doc+status), idx_poll_event, idx_pending_close, idx_current_approver
- `signoff_votes` table: one row per (instance, approver). UNIQUE on (instance, voter_user_id).

**v5.33 — signoff_sequence_rules** (95 lines)
- Table for predicate-driven rules:
  ```
  workflow_type, priority, predicate_name, action_name, role_token, notes, active
  ```
- Predicate registry: is_emergency, below_threshold, external_origin, no_snags, settlement_pending, always
- Action registry: skip_role, append_role, strip_initiator
- Seeded for change_notice (4 rules) and project_closure (2 rules)

**v5.34 — additional workflows** (83 lines)
- INSERT issue_confirm, urgent_payment_fyi, drawing_approval workflows
- INSERT signoff_sequence_rules for drawing_approval (skip design_lead if services stream, skip services_head if design stream)
- Predicates `is_services_stream` / `is_design_stream` correspond to gate's PREDICATES (line 94-98).

**v5.35 — vendors matrix columns** (read above). vendors.matrix_user_id + matrix_room_id, both NULL by default.

**v5.36 — vendor_bank_peer_approve workflow** (36 lines)
- INSERT workflow with sequence='finance,principal', quorum=1
- INSERT rule: always strip_initiator
- ⚠ V8 spec line 49 says path 2 has "principal notified (read-only)" — current model gives principal a real Approve/Reject poll instead. Phase-1 fix item.

**v5.37 — destination columns** (70 lines)

⚠ **Bugs found:**
1. Line 47: `WHERE workflow_type IN ('mom_client_ack')` — but the actual seed name (v5.31) is `mom_acknowledgement`. UPDATE matches 0 rows. mom_acknowledgement defaults to 'project' kind.
2. Line 67: includes `'acknowledgement'` workflow type — doesn't exist in any seed.
3. Missing workflows: `mom_acknowledgement` (correct name), `drawing_query_ack`, `cn_design_ratification` not classified — fall through to default `'project'` kind with NULL qualifier (gate falls back to 'internal' room — OK by accident).

These are real schema-classification bugs. v5.37 needs a follow-up migration fixing the workflow names.

