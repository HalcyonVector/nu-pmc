# nu-pmc — Project Memory

## Deployment Facts (REMEMBER — do not re-ask/re-derive)
- **App runs on PORT 5100** (set in `.env`). NOT 3000, NOT 3100. Always target `http://localhost:5100`. The `post-deploy-smoke.sh` default (3000) and `ecosystem.config.js` (3100) are both wrong for this server.
- **Users are ROLE accounts ONLY.** There is NO user named "naveen" or "anjaneya". The real accounts are the roles: principal, design_principal, pmc_head, design_head, services_head, team_lead, jr_architect, jr_engineer, detailing, services_engineer, coordinator, site_manager, senior_site_manager, finance_admin, trainee, audit, it_admin. `post-deploy-smoke.sh` hardcodes `naveen`/`anjaneya` logins that DO NOT EXIST — its auth-dependent checks fail on a stale fixture, not an app fault. Ignore those specific failures.
- Server: EC2 (ap-south-2), run via pm2 as `nu-pmc`. DB is RDS `database-2.c74oaeo42yfo.ap-south-2.rds.amazonaws.com`, database `nu_pmc`. Standalone scripts must load `.env` (dotenv) or be run after `set -a; source .env; set +a`.
- **DO NOT DELETE `nu-pmc-install-<date>.sql` at repo root** (e.g. `nu-pmc-install-20260502.sql`). It looks like a stale snapshot but 3 tests parse it as a fixture: `tests/d11-notification-triggers-naming.test.js`, `tests/matrix-room-structure.test.js`, `tests/v6_02-audit-decisions.test.js`. Deleting it fails CI, which blocks the auto-deploy gate in `.github/workflows/deploy.yml`. When checking if a file is safe to delete, grep the WHOLE repo including `tests/`, not just deploy/config files.

## Pre-Production Checklist (MUST do before go-live)

### Environment variables to set in production .env
```
NODE_ENV=production          # disables all dev/test auth bypass routes
FORCE_HTTPS=1                # marks session cookies as Secure
```

### Why these matter
- `NODE_ENV=production` — disables `/api/auth/dev-login`, `/api/auth/dev-escape`, `/api/auth/dev-switch`, `/api/auth/dev-force-logout` (these allow any user to impersonate any account without credentials). Also disables the `X-Test-User-Id` header auth bypass used in tests.
- `FORCE_HTTPS=1` — sets the `Secure` flag on session cookies so they aren't transmitted over plain HTTP. Also required for the SameSite=Strict cookie to work correctly in cross-origin setups.

### WhatsApp / Notifications (not yet set up)
To enable WhatsApp notifications, add to .env:
```
NOTIFICATIONS=enabled
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # your Twilio WhatsApp sender number
```
Then test the webhook by sending a message from a registered user's phone number.

### Hardcoded dev credential to remove before production
- `modules/auth/routes/auth.js` lines 99-100: `DEV_PASSWORD = 'Start@123'` — remove or move to env var (only active when NODE_ENV=development, but should not be in source).

---

## Schema Migration Notes
- `user_leave_requests` table and `deputy_overridden_at` column are auto-migrated on server startup (see server.js migration block). No manual SQL needed.

## Known Architecture Decisions
- Connection pool: 20 connections, queue limit 50. Fine for 30-50 users.
- `/api/pending/me` has a 30-second per-user in-memory cache to prevent pool exhaustion under concurrent load.
- `NOTIFICATIONS=disabled` in dev — all notification triggers are no-ops until Twilio is configured.

## Testing Notes
- Use `APP._devSwitch(userId)` in browser console to switch roles during testing.
- File uploads (drawings, schedule, payment invoice, photos) were NOT tested programmatically — manual testing required.
- Dev routes bypass CSRF — always retry once after a session switch (first POST reissues CSRF token).
