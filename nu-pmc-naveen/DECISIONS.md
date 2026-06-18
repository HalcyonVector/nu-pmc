# nu PMC App — Issues Found & What To Do About Them

**One document. Plain English. Mark your decisions.**

I found 112 issues in the app. Most are things I wrote carelessly over months of work. Each one below has:
- **What's wrong** (in plain words)
- **What I want to do about it**
- **Your decision** — approve / skip / ask me more

Groups are ordered by how much they matter. Work through from the top. Stop whenever you've had enough — I'll only work on what you've approved.

---

## The shortcut (if you trust me)

If you don't want to read 100 entries, these four choices cover most of it:

☐ **Approve all CRITICAL items** (2 items — these must be done)
☐ **Approve all SECURITY HARDENING** (5 items — stops outside attacks)
☐ **Approve all HIGH items** (25 items — real bugs, worth fixing)
☐ **Defer everything MEDIUM / LOW for now** (these are cleanup, not urgent)

Tick those four boxes and I have enough to work with for weeks. The detailed list below is for if you want to override any of those defaults.

---

# 🔴 CRITICAL — Must fix (2 items)

## 1. BOQ Map button is broken
The "BOQ Map" button on vendor engagement cards sends the wrong ID to the backend. Every click either 404s or corrupts data.

**Status:** Already fixed by me during the audit. Two lines changed in public/js/app.js.

☐ Approve as-done ☐ Revert ☐ Tell me more

---

## 2. Nobody uses two-factor authentication (2FA)
Right now, a single phished password = full access to money. No 2FA anywhere. For you, Ajay, Udupa, PMC heads — this is the single biggest security gap.

**What I want to do:** Add Google Authenticator-style 2FA. Mandatory for principals and finance. Optional for others. ~6 hours of work.

**Covered below in** SECURITY HARDENING section as HARD-5 — details there.

☐ Approve (see HARD-5 for details) ☐ Skip ☐ Tell me more

---

# 🛡️ SECURITY HARDENING — Stops outside attacks (5 items)

These protect against phishing, password guessing, and session hijack. Listed in order of "most valuable per hour of work".

## HARD-1. Fix 9 places where vendor names etc. render unsafely (20 minutes)
If an attacker can write a name like `<script>badstuff</script>` into a vendor record, it runs as code on every other user's browser. Common attack pattern. Cheap to fix.

☐ Approve ☐ Skip ☐ Tell me more

## HARD-2. Lock account after 5 failed password attempts (1.5 hours)
Right now someone can try passwords forever. Fix: 5 fails → 15-min lock. You and Ajay get WhatsApp'd when any account locks, so you'd spot a brute-force attempt.

☐ Approve ☐ Skip ☐ Tell me more

## HARD-3. Alert you on WhatsApp when a vendor's bank account is changed (1 hour)
This is the most valuable attack: swap a vendor's bank account to the attacker's, wait for the next legitimate payment. Today it happens silently. Fix: WhatsApp to you and Ajay whenever anyone changes bank details, showing old/new last-4 digits.

☐ Approve ☐ Skip ☐ Tell me more

## HARD-4. WhatsApp you when your account logs in from a new location (1.5 hours)
If your password gets phished and an attacker logs in from Mumbai, you get a "New login from 103.28.x.x — was this you?" message. Catches phishing early.

☐ Approve ☐ Skip ☐ Tell me more

## HARD-5. Add 2FA for principals and finance (6 hours)
Google Authenticator codes. You set up once, then every login asks for the 6-digit code on top of your password. Even if someone phishes your password, they can't log in without your phone. This closes the phishing path entirely for the 4 money-sensitive accounts.

☐ Approve ☐ Skip ☐ Tell me more

---

# 🟠 HIGH — Real bugs (25 items, grouped)

## Group A: Permission gaps — anyone logged in can do things only certain people should

Today, if you're logged in, you can hit endpoints directly by URL and do things your sidebar doesn't show. 30+ endpoints have no permission check beyond "is logged in". Worst examples:

- **Anyone can create a vendor payment request** against any project
- **Anyone can create a GRN** (goods receipt note) — triggers budget-draw
- **Anyone can raise an issue or RFI** on any project
- **Anyone can record a client receipt** in finance books
- **Anyone can change a claim's invoice number**
- **Anyone can modify their own payment request and approve it** (no segregation of duties)

**What I want to do:** Go through the 30+ endpoints, add the right permission check per endpoint. About 3 hours' work. I've mapped which role should be allowed for each one.

☐ Approve the whole batch ☐ Walk me through each one ☐ Skip / defer

## Group B: 9 XSS bugs (already covered in HARD-1)
Same as HARD-1 above. One approval covers both.

## Group C: Form data accepted without validation
Many endpoints accept any shape of data. No check that required fields are present, no check they're the right type. Bad data silently stored. 90+ endpoints affected.

**What I want to do:** Add validation schemas to every write endpoint. Roughly 20 min per endpoint × 90 = significant effort. Recommend doing the money-handling ones first (payments, vendors, claims, finance), others later.

☐ Approve money-handling only ☐ Approve full batch (big effort) ☐ Skip

## Group D: Our-cost-rate for vendors is collected but never saved
When you assign a BOQ item to a vendor, the UI asks "Our Cost Rate (₹/unit)". You type it. It goes nowhere. Silent data loss. Plus: downstream budget reports use an empty table that should hold these rates.

**What I want to do:** Wire the rate through properly. Plus a migration that backfills from existing paid bills. ~2 hours.

☐ Approve ☐ Skip

## Group E: Duplicate endpoint in reports.js
Two copies of "approve all weekly reports" registered. Newer one is dead code. Confusing for maintenance.

**What I want to do:** Delete the older one. 5 min.

☐ Approve ☐ Skip

## Group F: Password reset redesign (the long conversation we had)
Delete self-service "Forgot password?" link. Replace with: boss triggers OTP for subordinates, principals can reset each other, new `it_admin` role added with password-reset powers only. ~3 hours.

☐ Approve ☐ Walk me through again ☐ Skip

## Group G: `vendors.js` has a typo — checks role string `'finance'` but actual role is `'finance_admin'`
Every finance_admin except Udupa (who's checked by username) is blocked from validating PAN numbers.

**What I want to do:** Fix the typo. 1 min.

☐ Approve ☐ Skip

## Group H: Various data-integrity holes
Small stuff: budget head approve doesn't check record exists; submittal review doesn't match stream-to-role; principal can approve their own payment request (SOD violation).

☐ Approve batch fix ☐ Skip

---

# 🟡 MEDIUM — Cleanup (34 items, compact)

Most of these are "someone who shouldn't be able to do X can do X". Examples:

- Trainees can mark someone's schedule progress (fake updates)
- Anyone can create a Site Visit or a MOM (meeting minutes)
- Any logged-in user can answer or close an RFI (design governance hole)
- Session doesn't regenerate on login (mild fixation risk)
- `/outbox/` directory keeps WhatsApp files public for 7 days (should be 24h)
- Two `/batch-approve` endpoints with different permissions (confusing)
- Drawing view endpoint has no permission check
- Some race conditions on GRN approve and PR raise

**What I want to do:** Batch-fix in one go. These are individually small but collectively material. ~4 hours across all.

☐ Approve whole batch ☐ Show me the full list ☐ Defer

---

# 🔵 LOW — Minor (21 items, bundled)

Dead code, dead database columns, minor quality issues. No real-world impact today.

Examples: 10 functions declared but never called, 60 dead columns across 25 tables, some schema-vs-code drift.

**What I want to do:** Bundle as a cleanup pass. ~1 hour. Can be deferred forever without harm.

☐ Approve ☐ Defer

---

# ⚪ SAFE — Already checked OK (40 items)

These are things I investigated and confirmed are fine. Listed for completeness. No action needed. Examples:

- SQL injection — not found, queries use parameter placeholders correctly
- Session cookies — configured properly (HttpOnly, SameSite, Secure)
- CSRF — protected by SameSite cookie
- Path traversal — blocked by resolve+startsWith check
- Audit log — append-only, no DELETE anywhere in code
- Error messages — don't leak stack traces in production

No tick boxes. These are just the "good news".

---

# HOW I WORK ONCE YOU APPROVE

Each approval triggers a batch of related fixes. Between batches, I run:
1. Full 148-file parse check
2. Permission-gate rescanner (catch anything I broke)
3. Login simulation for all user roles
4. Audit user cannot write to anything they shouldn't
5. Tab visibility matrix (make sure I didn't hide something from someone by accident)

If any of those fails, the batch is rolled back (single `git revert`) and I come back to you.

Every batch is independently deployable. Each creates one git commit. You can stop at any batch.

**No code gets touched until you've approved the items.**

---

# YOUR DECISIONS

Mark your choices above, or use shortcuts:

☐ Just do CRITICAL + HARDENING (7 items, ~12 hours work)
☐ Do CRITICAL + HARDENING + HIGH (32 items, ~25 hours work)
☐ Do everything (112 items, ~40 hours)
☐ Different — tell me

Once you've marked this up and sent it back, I start with Batch A and work through.

---

**Both of the longer technical documents are still around** (`AUDIT-SYSTEMATIC.md` has scanner evidence, `FIX-PLAN.md` has the developer-speak version) — they're for me, not you. This document is the one you work from.
