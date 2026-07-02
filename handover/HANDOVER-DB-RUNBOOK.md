# Handover DB Runbook

Goal: the server ends up with **every migration, schema object, config and feature present**, and **zero test/operational data** — only the seed role users remain.

Run these on the server, in order.

## 0. Deploy the latest code first
The reset/provision scripts only handle the database. Feature code (route handlers, `app.js`, `ui.js`, the SM/SSM split, handover-role fix, MOM reissue fix, modal fix) lives in the repo.

```
git pull            # or your deploy method
npm ci --only=production
pm2 restart nu-pmc  # picks up code + server.js startup migrations
```

## 1. Verify + provision the DB (guarantee completeness)
Check first — reports what's missing, changes nothing:

```
node scripts/verify-and-provision.js
```

Then provision anything missing (applies all `migrations/*.sql` idempotently, tops up config, loads governance sheets if `role_permissions` is empty):

```
node scripts/verify-and-provision.js --apply
```

Re-run the plain check until it prints **✅ COMPLETE**. This confirms: every declared table exists, all feature-driving config is populated, and this session's Handover/Measurements nav is reachable for the right roles.

## 2. Reset — remove all test/operational data
Dry run — prints the full plan and the exact list of users it would delete:

```
node scripts/reset-for-handover.js
```

Confirm the deletion list is all test/bulk accounts. If the seed-user cutoff isn't 21, set it:

```
SEED_MAX_USER_ID=18 node scripts/reset-for-handover.js
```

Then execute (auto-backs-up to `./backups/` first, aborts if the dump fails):

```
node scripts/reset-for-handover.js --confirm
```

## 3. Final smoke test
- Log in with a seed role account.
- Confirm no leftover projects/clients/vendors/drawings.
- Confirm nav tabs render for each role (Handover, Measurements, etc.).

## Order matters
Provision (step 1) **before** reset (step 2): provisioning may apply config into tables; reset then leaves config intact and only clears operational data. Doing it the other way is also safe, but this order gives the cleanest verification.

## What each script does / does not touch
| | verify-and-provision.js | reset-for-handover.js |
|--|--|--|
| Schema/tables | checks; `--apply` applies migrations | never drops |
| Config (nav, perms, workflows) | checks + tops up | keeps |
| Operational data | ignores | wipes |
| Users | ignores | keeps id ≤ 21, deletes rest |
| Code | ignores (deploy separately) | ignores |
