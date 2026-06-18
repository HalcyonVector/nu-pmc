# Working Strategy — nu PMC Build
*Distilled from full chat history. Read before any code work.*

---

## ⚠ WHERE THE BRIEF IS NOT THE TRUTH

Two matters where Naveen's decisions override the brief. The brief is wrong on these. Do not revert to brief behaviour.

### Override 1 — Vendor bank confirmation (Brief Section 11.1 / P9.1)

**Brief says:** 4-step flow. Vendor confirms own bank details. 24hr Naveen window. Change applies after cooling period.

**Naveen's decision (May 2026, this session — FINAL):**
1. Finance proposes → bot polls **vendor's personal Matrix room** to confirm
2. Vendor confirms or rejects in Element X
3. ~~Naveen 24hr window~~ — **DROPPED permanently**
4. First payment to newly-changed account → Naveen FYI alert in `#internal-naveen` (awareness only)

V8 peer approval (finance/principal, strip_initiator) fires AFTER vendor confirms. Same for new vendor creation — bank details require vendor confirm + peer approval before vendor is payable.

**The brief's Section 11.1 does not govern this. Naveen's decision does.**

### Override 2 — Personal vs Community message routing

**Brief:** Never codifies the distinction. Uses both patterns in different sections without naming the split.

**Naveen's decision (May 2026, this session — FINAL):**
- **Personal** = bank notifications + individual BOQ sign-offs. 1-1 to entity's `matrix_room_id`. Only that entity sees it. No @mention.
- **Community** = everything else. Project room or org room. Team sees it. @mention the current approver.
- Rule: pick the **smallest audience** that needs to see the message.

Encoded in `signoff_workflows.destination_kind` + `destination_qualifier` (v5.37/v5.38).

**The brief does not hold on this. Naveen's decision does.**

---

## The one-sentence rule
**Read everything first. Build second. Trust nothing from memory.**

---

## Before writing any code

1. **Read the relevant brief sections verbatim** — not from memory, not from a summary. Actual file, actual lines.
2. **Read the actual code you're about to touch** — end to end, not grep snippets.
3. **Cite file + line for every contract claim.** If you can't cite it, you haven't read it.
4. **State what you're going to build in plain English.** If Naveen doesn't confirm, don't proceed on ambiguous direction.
5. **Only then write code.**

---

## Blast-radius / min-rework prioritisation

Order work by: *if this is wrong-shaped, what has to be redone?*

- **Substrate moving → freeze it first.** Don't build callers against a moving substrate. Every rework of the substrate cascades into every caller.
- **Abstractions before callers.** The abstraction that, if its shape changes, forces the most rework — build that one well, freeze its contract, then callers stop moving under you.
- **Lowest-blast-radius first only when substrate is stable.** When it isn't, stop and freeze before anything else.

The Kolkata rule: if you find yourself routing via Delhi and Mumbai, the abstraction is wrong. Reshape it; don't add a third branch.

---

## DB is the source of truth

From v2 brief C7 (line 91): **"The following are NEVER hardcoded in application code. All live in database or environment variables."**

From v2 brief P2 (line 222): **"All Matrix integration config lives in the database. Nothing hardcoded in application code except the four environment variables listed in P5."**

From v2 brief P6.1 (line 623): **"Application code never decides the channel — the database does."**

**What this means in practice:**
- Room IDs → `matrix_rooms` table
- Workflow sequences, quorum, closing windows → `signoff_workflows` table
- Alert windows (days, hours) → `security_config` table
- Digest schedules → `notifications_config` table
- Thresholds → `project_thresholds` table
- Routing decisions inside hooks → read from DB config, not hardcoded strings

**The five env vars only:**
```
MATRIX_HOMESERVER
MATRIX_BOT_TOKEN
MATRIX_BOT_USER_ID
NOTIFICATIONS
PWA_BASE_URL
```

Everything else lives in DB or is derived from DB lookups.

---

## Abstract, don't multi-path

One function. One registry. One entry per new behaviour.

Pattern used throughout:
- PREDICATES registry — named functions returning bool
- ACTIONS registry — named functions mutating sequence
- APPROVER_RESOLVERS registry — one entry per role token
- DESTINATION_RESOLVERS registry — one entry per destination kind
- POST_COMPLETION_HOOKS registry — one array per workflow

Adding new behaviour = one new entry. Not a new if/else. Not a new branch. Not a new function alongside the existing one.

If you find two code paths doing similar things, that's the signal to abstract — not to add a third path.

---

## Personal vs community messages

**Naveen's rule (May 2026):** Bank notifications and individual BOQ sign-offs are personal (1-1). Everything else is community.

Pick the smallest audience that needs to see the message.

- **Personal** = DM to entity's personal `matrix_room_id`. Only that one entity sees it. No @mention.
- **Project** = post to `#PV{code}-internal` or `#PV{code}-finance`. Team sees it. @mention the current approver.
- **Org** = post to `#internal-naveen`, `#internal-finance`, `#system-health`. @mention where applicable.

Encoded in `signoff_workflows.destination_kind` + `destination_qualifier`. Never hardcoded in code.

---

## Vendor model

**DB is source of truth. No synthesis, no caching, no provisioning flag.**

- `vendors.matrix_user_id` set → vendor on Element X (Tier A) → dispatch via Matrix DM
- `vendors.matrix_user_id` NULL → vendor on WhatsApp only (Tier B) → dispatch via phone

When vendor onboards to Element X, admin updates both columns. Tier flips automatically.

For bank-related polls: route to `vendor_contacts WHERE role='accounts'` first, fall back to vendor master row.

---

## V8 vendor bank flow (Naveen's decision, final)

1. Finance proposes → bot sends poll to **vendor's personal Matrix room** ("Confirm your new account details")
2. Vendor confirms or rejects in Element X
3. ~~Naveen 24hr window~~ — **DROPPED**
4. First payment to newly-changed account → bot alerts Naveen in `#internal-naveen` (awareness only)

V8 peer approval (finance/principal separation of duties) runs AFTER vendor confirms. Proposer cannot self-approve (strip_initiator rule).

New vendor creation also requires the same flow — bank details entered for the first time go through vendor confirmation + peer approval before vendor is payable.

---

## How to respond to Naveen

**Past tense for done things.** ("Ran the tests. 1302 passing.")

**No future-tense commitments.** Delete "I'll now..." and emit the tool call instead. If you find yourself writing "Going to do X", stop and do X.

**"?" or "???" = stop announcing and act, or wait silently.** Not a prompt to explain.

**"Stall master" = you announced and didn't act.** Don't do it again.

**One question per message when on phone.** Pick the most important unknown.

**Phone tail-4 PII.** Phone numbers in logs/audits: last 4 digits only.

---

## The four banned phrases

These signal fake confidence. Delete them before sending:
- "I think"
- "should be fine"
- "essentially done"
- "this likely works"

---

## Test discipline

Every migration has a self-test: introduce a deliberate bug, confirm the test fails, restore, confirm green. No exceptions.

Prevent-return tests pin every caller migration. They exist so a future refactor can't silently revert to the old path.

`1302 passing, 0 failures` is the current baseline. Never leave a session below the baseline you started with.

---

## The phase order (current state)

**Phase 0** — Read every word of brief + code. Freeze the contract in SUBSTRATE-CONTRACT.md. No code until done.

**Phase 1** — Caller migrations against frozen contract. Mechanical once Phase 0 is done.
- Remaining: `mom_acknowledgement`, `drawing_approval`, `change_notice` full refactor, `daily_report` Excel replacement, V8 steps 3+4 Naveen alerts
- Already done: `grn_approval`, `issue_confirm`, `urgent_payment_fyi`, V8 vendor confirm, V8 peer approval, new vendor creation

**Phase 2** — Three brief abstractions: `formatMessage` (C13), `sendDigest` (C11), `runCanaryCheck` (C12). Build after callers, not before.

**Phase 3** — Operational scaffolding: room creation script, test harness (31+17 tests), onboarding scripts, canary cron.

**Phase 4** — Cleanup: drop `matrix_pending_polls`, drop Twilio path, drop dual-write code.

---

## What the contract document is

`SUBSTRATE-CONTRACT.md` in the repo root. Frozen after Phase 0. Contains:
- Every claim about the gate, adapter, or schema with file+line citation
- Naveen's decisions that override or extend the brief
- Known bugs with fix status
- Workflow → destination mapping

If you're about to build something and the contract doesn't cover it: stop, read the brief, update the contract, then build.

---

## Mistakes made repeatedly this session (don't repeat)

1. **Hardcoding room type strings** in hooks and handlers instead of reading from DB
2. **Building before reading** — constructing vendor provisioning, bridge derivation, etc. that contradicted the brief
3. **Announcing instead of doing** — writing "Going to do X" then stalling
4. **Trusting memory** — `workflow_id` vs `workflow_type` bug, missed room model, phantom blocks
5. **Rationalising laziness** — calling hardcoded lookup keys "acceptable" when they violate C7
6. **Not self-testing** — bugs in relay dispatch went undetected because tests mocked the wrong thing
7. **Reshaping the substrate mid-migration** — three rewrites of `_dispatchPoll` in one session

Each of these cost Naveen tokens. The strategy above exists to prevent them.

---

## Session completion — 2 May 2026

All phases complete. Final state: **1328 passing, 0 failures.**

**Zero live WhatsApp sends in application code** outside two justified exceptions:
- `notifications.js` `_notifyByPhone` — external recipient fallback (no Matrix room)
- `notifications.js` `sendOTP` — authentication OTP stays on WhatsApp by design

The two brief overrides are locked in this document and in `SUBSTRATE-CONTRACT.md`. Do not revert to the brief on these matters.
