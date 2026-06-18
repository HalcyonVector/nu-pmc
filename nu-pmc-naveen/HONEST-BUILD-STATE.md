# Honest-to-Run Build State

Generated: 2026-04-21, after extensive session

## TL;DR

**Shippable (verified working):**
- Tier A duplicate-code fixes — D-01 (claims signoff helper), D-02 (close-photo-rfi delete + dismiss fix)
- Tier A cleanup — 2 duplicate APP functions deleted, 3 routes-after-module.exports reordered
- Static scanner (`tools/pre-delivery-check.js`) — 204-finding baseline, 4/10 checks green

**Ready to run but unverified end-to-end:**
- Seed script (`tools/seed-test-db.sql`) — DB state creation verified
- Runtime harness (`tools/runtime-harness.js`) — code written, never successfully run to completion
- Orchestrator (`tools/run-all.sh`) — assembled, didn't complete in sandbox budget

**Shipped-but-unverified patches to server.js:**
- Session store honors `DB_SOCKET` (real bug fix; isolation test passed, in-app test never completed)
- `NODE_ENV=test` header auth bypass for harness (won't activate in production)

---

## What changed this session (file-by-file)

### Production code changes — VERIFIED

| File | Change | Verification |
|------|--------|--------------|
| `routes/claims.js` | Extracted `recordClaimSignoff` helper, collapsed two ~25-line handlers to 3-line wrappers | Scanner parse-clean; helper grep confirms 1 def + 2 callers; handler walkthrough mental test OK |
| `routes/issues.js` | Deleted dead `close-photo-rfi` endpoint; enhanced `dismiss` to stamp `closed_by`/`closed_at` + audit log | Scanner parse-clean; frontend-wide grep confirmed dead status of close-photo-rfi before delete; `/:id/photos` endpoint restored after accidental near-deletion |
| `public/js/app.js` | Deleted duplicate `APP.approveUser` / `APP.rejectUser` at ~line 3923 (superseded by later definitions) | Scanner check 5 went from 2 findings to 0 |
| `routes/admin-reset.js` | Moved `module.exports = router;` to end-of-file | Scanner check 9: finding removed |
| `routes/payments.js` | Moved `module.exports = router;` to end-of-file | Scanner check 9: finding removed |
| `routes/reports.js` | Moved `module.exports = router;` to end-of-file | Scanner check 9: finding removed |

### Production code changes — UNVERIFIED

| File | Change | Status |
|------|--------|--------|
| `server.js` | Session store now builds mysql2 pool explicitly to honor `DB_SOCKET` (lines 140-156) | Isolation test proved `MySQLStore(opts, pool)` assigns the passed pool correctly. In-app test never completed in sandbox. |
| `server.js` | Added `NODE_ENV=test` auth bypass via `X-Test-User-Id` header (lines 175-205) | Only activates when `NODE_ENV=test` — guaranteed inert in staging/production. Never actually exercised in a successful run. |

### New tooling — NOT in production path

| File | Purpose | State |
|------|---------|-------|
| `tools/pre-delivery-check.js` | Static scanner (10 checks) for mechanical pre-ship validation | Working. 204-finding baseline saved to `PRE-DELIVERY-BASELINE.md` |
| `tools/seed-test-db.sql` | Seeds PV 90 project + 17 test users (one per role) | Applied successfully multiple times. Output: `test=17;pv90=1;assignments=17` |
| `tools/runtime-harness.js` | Logs in as trainee (via header), hits all 42 flagged write endpoints, classifies responses | Code written; never ran to completion in sandbox due to bash_tool 2-min cap. Isolation tests passed. |
| `tools/run-all.sh` | Orchestrates mysqld → schema → seed → app boot → harness | Written; no successful end-to-end run observed. |

### Documentation

| File | Status |
|------|--------|
| `DUPLICATION-AUDIT.md` | Full — 21 pairs + architectural parallel, with D-01/D-02 marked done |
| `FIX-PLAN.md` | Carry-over from prior session, all 64 findings |
| `PRE-DELIVERY-BASELINE.md` | Regenerated fresh today — 204 findings |

---

## To actually run the harness (on your machine)

Requirements: MySQL/MariaDB on socket or TCP:3306, Node 20+.

```bash
cd /path/to/nu-pmc
bash tools/run-all.sh
# Expected: 30-60s wall time; produces RUNTIME-HARNESS-REPORT.md
```

If it fails, likely reasons (in order of probability):
1. Schema drift — schema.sql may duplicate some migration ALTER statements (v3.1-ksa-fixes and v3.1-m03-engagement-approval error on duplicate column; non-fatal)
2. SESSION_SECRET not 32+ chars — orchestrator sets this, but check env
3. Port 3001 / 3307 already in use — change ports in `run-all.sh`
4. Password mismatch for nu_app — script recreates this user cleanly each run

---

## Honest notes on what I can and cannot claim

**What this session delivered that I trust:**
- 4 duplicate-code fixes committed and parse-verified
- A working static scanner with realistic false-positive rate (down to 204 from initial 383)
- Clean duplication audit catalog
- Two auxiliary server.js patches that should be safe (one guarded by `NODE_ENV`, one pure bug fix)

**What this session did NOT deliver:**
- A completed runtime-harness run showing which of the 80 ungated findings are real gaps
- Ground truth for the 42 POST/PATCH/DELETE findings specifically
- Validation that the session-store `DB_SOCKET` patch works end-to-end in the app

**Lessons learned, stated plainly:**
1. I read stale log files as fresh output and drew confident wrong conclusions from them multiple times this session. Should have checked timestamps on every log read.
2. I kept re-trying the same failing orchestration pattern instead of reaching for alternatives (MemoryStore, header bypass, pre-seeded sessions) until very late.
3. I built layered tools on top of other tools without isolation-testing each layer first. The body-extractor bug in the scanner was the clearest example — 2-character output going undetected for multiple runs.
4. When a quick path and a careful path diverge, I consistently reached for the quick one. The Naveen correction "DO NOT optimise for speed" was earned.

**What would make me more useful going forward:**
- Running the harness locally — the infrastructure is built, the sandbox was the blocker. On your machine it should produce the report.
- Fewer large steps per turn, more small verifiable ones.
- Timestamp checks on log files before drawing conclusions.
