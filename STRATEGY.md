# STRATEGY.md — How to work on this codebase

This file exists because Claude (me) keeps reshaping the substrate after
building callers against the old shape, every time at the cost of
rework. The strategy below was negotiated with Naveen end-of-session
2026-05-01. Read this BEFORE any non-trivial code work.

---

## Core mantra

**Blast-radius / min-rework.** Every task gets prioritised by:
"if this is wrong-shaped, what has to be redone?" Lowest-cost-to-redo
first only when the substrate is stable. When the substrate is moving,
**freeze it before doing anything else** — that's the only rework
worth preventing.

---

## The four rules

### 1. Read every word before abstracting

Not skim. Not "I remember this section." Not "I recall the gist."
Read the actual text in the actual file. Brief, code, schema, the
specific lines I'm about to touch.

Before any contract claim ("the gate dispatches X" / "the resolver
returns Y") I must have a file path and line number open in front of
me confirming it. If I can't cite it, I haven't read it.

### 2. Don't trust memory

My idea of what the code does is unreliable. The code is authoritative.
The brief is authoritative. My memory is suspect — especially after
context compaction, even within a long session.

Specific failure modes I've already hit:
- Invented `matrix_provisioned` flag that wasn't in any brief
- Built phone-derived bridge user-id when DB-as-source-of-truth was simpler
- Got `_initiatorRoleFromDoc` wrong from half-remembered shape
- Found phantom blocks (drawing_approval rules, attachImage) that exist
  with passing tests but I had no memory of writing
- Missed P6.2 line 653 putting relays in project rooms

If something feels familiar, that's a signal to look it up, not to
rely on the feeling.

### 3. Abstract, don't multi-path

Naveen's "Kolkata via Delhi/Mumbai" rule. Two if/else branches that
do similar things mean the abstraction is wrong. Three means it's
definitely wrong. Re-shape the abstraction; don't add a third branch.

The gate's PREDICATES, ACTIONS, APPROVER_RESOLVERS, DESTINATION_RESOLVERS
registries are the pattern. Adding a new behaviour = one entry in a
registry, not a new function or a new branch.

### 4. Verify before claiming

Past-tense facts ("the test passed", "I read line 653 and it says…")
are fine. Future-tense claims ("this should work", "I think the gate
handles…") are not. If I haven't run the test, I don't say it passed.
If I haven't read the line, I don't claim what it says.

Banned phrases that signal fake confidence:
- "I think"
- "should be fine"
- "essentially done"
- "this likely works"

---

## How to start any session

Before touching code:

1. Read the relevant section(s) of the v2 brief (`/tmp/brief-v2.txt`
   if extracted, else the .docx)
2. Read the relevant code files end-to-end (not grep snippets)
3. Read the relevant migration(s) end-to-end
4. State the contract in plain English with citations
5. THEN write code

The 30-60 minutes of reading is bought back many times over by not
reshaping the substrate three times in one session.

---

## Phase ordering for the Matrix migration work

This is the work plan negotiated 2026-05-01.

### Phase 0 — Freeze the substrate contract (read-only, hours, no code)

Read every word of:
- v2 brief (`/tmp/brief-v2.txt` — 1033 lines)
- V8 override (`handoff-2026-04-28/2_ForMe/V8-vendor-bank-protection-SPEC.md`)
- Addendum (`handoff-2026-04-28/2_ForMe/ADDENDUM-new-usecases.md`)
- `services/signoff-gate.js` end-to-end
- `services/matrix-adapter.js` end-to-end
- All v5.27–v5.37 migrations end-to-end

Output: a one-page contract document (`SUBSTRATE-CONTRACT.md`) saying
"the gate accepts X, returns Y, dispatches per Z" with citations to
brief or code for every claim. Where the brief is silent, the document
explicitly says "we are deciding this — Naveen confirmed X."

Exit: I can name, for every workflow type in P6.4 + V8 + the addendum,
which sequence/destination/predicates apply and what failure modes exist.
No "I'll figure it out at the caller."

### Phase 1 — Caller migrations against frozen contract (days)

Mechanical once Phase 0 is done. In any order — substrate isn't moving
under us. Each caller:
- Replace WhatsApp dispatch with `triggerSignoff(...)`
- Pass `documentRow` for predicates
- Pass `attachImage` if relevant
- Add prevent-return tests
- Self-test with deliberate bug + restore

Callers still pending (as of 2026-05-01):
- `mom_client_ack` (meetings.js)
- `drawing_approval` (drawings.js)
- `change_notice` principal-approval (changes.js — biggest scope)
- V8 step 1 (vendor confirms own bank)
- V8 steps 3 + 4 (Naveen 24h cancel, first-payment alert)
- `daily_report` Excel-drop replacement

### Phase 2 — Three brief abstractions (1 day)

After Phase 1 — abstractions get shaped by real usage, not speculation.
- `formatMessage` (C13) — one function, replaces ad-hoc message formatting
- `sendDigest` (C11) — one function, three configs in notifications_config
- `runCanaryCheck` (C12) — one function, five configs

### Phase 3 — Operational scaffolding (2 days)

- `scripts/create-project-rooms.js` (P8.4)
- Test harness `scripts/test-matrix.js` (31 tests) + `test-threads.js` (P10.4)
- Onboarding scripts (Appendix A1–A4)
- Canary 6AM cron wiring
- EMS configuration on Naveen's side (DNS, account)

### Phase 4 — Cleanup (half day)

After everything green and EMS live:
- Drop `matrix_pending_polls`
- Drop Twilio path (keep canary auto-flip)
- Drop dual-write code

---

## Checkpoint discipline

After each phase: STOP. Show Naveen the inventory/output. Get explicit
confirmation before starting next phase. The highest-value checkpoint
is end-of-Phase-0 — that's where wrong direction hurts most.

---

## Naveen's working style (carry-forward)

- Phone tail-4 PII redaction
- Sandbox guard before any destructive action
- LIST → ABSTRACT → FIX
- One question per phone turn (he's often on phone)
- Past-tense ("done", "ran the tests") is fine
- Future-tense action commitments = delete the sentence, emit the tool call
- "?" or "???" is a one-keystroke prod meaning "stop announcing, do it
  or wait silently"
- "Stall master" = past-tense for "you announced and didn't act"

---

## What this file does NOT replace

- The v2 brief itself
- The actual code
- Reading both before working

It's the meta-rule. The mantra. Not the spec.
