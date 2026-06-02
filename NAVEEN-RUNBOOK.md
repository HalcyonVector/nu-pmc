# Naveen's Runbook — nu PMC v4

**For: Naveen Bhat**
Local development and testing workflow. Treat this as your day-to-day reference.

---

## Start here every new day

```bash
cd ~/nu-pmc        # or wherever you unpacked the zip

# If it's the first time on this laptop:
cp .env.docker.example .env
vim .env           # set DB_ROOT_PASSWORD, DB_PASSWORD, SESSION_SECRET

# Every day after that:
docker compose up -d db           # start database
docker compose up -d app          # start app  (DB must be healthy first)

# Open browser
open http://localhost:3100
```

Stop: `docker compose down` (keeps data). Wipe: `docker compose down -v`.

First run only — apply schema + seed:
```bash
docker compose --profile seed run --rm seed
```

---

## Logging in locally

After seed, these users exist with password `Test1234`:

- `naveen` — principal (you)
- `ajay` — design_principal
- `murugesan`, `praveen` — pmc_head
- `test_principal`, `test_pmc_head`, etc. — one per role for testing

---

## Testing a change (your discipline loop)

Every change — new route, new migration, sheet edit, middleware tweak — goes
through this loop before you commit:

```bash
# 1. Parse check the specific file
docker compose exec app node --check routes/your-file.js

# 2. Unit + integration tests
docker compose exec app node scripts/test-kitchen-sink.js
docker compose exec app node scripts/test-workflows.js
docker compose exec app node scripts/verify-single-boss.js

# 3. Full smoke
docker compose exec app bash scripts/post-deploy-smoke.sh

# 4. Only if all four pass: consider the change done.
```

Memory rule 16 (your rule): parse-clean alone is false confidence.

---

## Working with the 8 governance sheets

The 8 sheets are in `governance_sheets/`. They drive real behaviour in the app
via the DB. When you edit one:

### Option A — rebuild from scratch (most honest)

```bash
# The sheets are generated from the code by build_governance.py
# If you change the ACTIONS list in that script:
python3 build_governance.py
# → rewrites governance_sheets/*.xlsx

# Then reload into DB
docker compose --profile seed run --rm seed
# (seed-full.sh runs load-governance-sheets.js)
```

### Option B — edit Excel directly, upload via app

1. Log in as principal at http://localhost:3100
2. Go to More → Governance
3. Click "Upload updated sheet" on Sheet 1 (or 2, 3)
4. Permissions reload automatically
5. Changes visible immediately — no restart needed

### Option C — edit and re-seed (for bulk changes)

1. Edit the sheets in `governance_sheets/`
2. `docker compose exec app node scripts/load-governance-sheets.js`
3. No app restart — middleware reloads on next request

---

## Working with AI-assisted edits (Claude)

**Every new chat starts with:** "Read HANDOFF.md first. Then tell me what the
current architectural invariants are before I ask you to do anything."

That single sentence makes the model ground itself in current state. Without
it, it invents context.

After that, **every time the model claims something about state** (a file
exists, a test passes, a count is N) — **make sure the claim is accompanied by
the tool call that proves it**. That's memory rule 23. If the model writes a
sheet, a test result, or a bug diagnosis and you don't see a grep or a file
read or a query in the same response — push back.

---

## When something's broken

### App won't start
```bash
docker compose logs app --tail 50
```
Most common: `SESSION_SECRET` empty in .env, or DB not healthy yet.

### DB connection errors
```bash
docker compose ps
# db should show "healthy"
docker compose logs db --tail 20
```

### Permissions all denied (every action returns 403)
```bash
docker compose exec app node -e "
  const p = require('./middleware/permissions');
  p.reloadPermissions().then(r => console.log(r));
"
# Expected: { loaded: true, rules: 1575+, actions: 105+ }
# If loaded: false → governance_sheets/ not present or role_permissions empty
```
Fix: `docker compose --profile seed run --rm seed`

### Kitchen sink fails after your change
Most common: a new route you added uses a role key that doesn't exist in the
sheet, OR a state-machine guard you added has the wrong status check. Look at
the specific failure line in the test output.

---

## Reset to a clean slate

Nuclear option — wipe everything and start over:

```bash
docker compose down -v
docker compose up -d db
sleep 30
docker compose --profile seed run --rm seed
docker compose up -d app
```

90 seconds. No data survives.

---

## What's where

- `server.js` — entry point, route mounting
- `middleware/permissions.js` — DB-backed permissions (single boss)
- `middleware/auth.js` — role gates (structural)
- `middleware/trainee-guard.js` — trainee write allow-list
- `routes/governance.js` — 6 admin endpoints for sheet upload
- `scripts/load-governance-sheets.js` — idempotent sheet → DB loader
- `scripts/test-kitchen-sink.js` — L1-L4a test harness (60 tests)
- `public/js/app.js` — frontend (plain JS, no framework)
- `HANDOFF.md` — architectural context (share with every new chat)

---

## Your rules (from your memory)

The three that matter most for this codebase:

**Rule 23 — Verify before claiming.** Every claim requires a tool call that
session. You wrote this after repeated failures where I built from assumption.
Apply it to yourself and enforce it on the AI.

**Rule 16 — Pre-delivery checklist.** grep every function, every table, every
route before claiming done. Parse-clean alone is not a ship signal.

**Rule 13 — One question at a time.** Use the prompt tool, not prose lists.
This applies to AI-to-you and you-to-your-team.
