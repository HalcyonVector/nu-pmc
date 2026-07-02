# nu-pmc — Pre-Production Checklist

Everything to do before go-live, in order. Items marked **BLOCKER** are security-critical.

## 1. Security environment (BLOCKER)

Set in the production `.env`:

```
NODE_ENV=production      # disables dev-login/dev-escape/dev-switch/dev-force-logout
                         # AND the X-Test-User-Id header auth bypass
FORCE_HTTPS=1            # marks session cookies Secure; required for SameSite=Strict
```

Without `NODE_ENV=production` the routes `/api/auth/dev-login`, `/api/auth/dev-escape`,
`/api/auth/dev-switch`, `/api/auth/dev-force-logout` let **anyone impersonate any account
with no credentials**, and the `X-Test-User-Id` header bypasses auth entirely. These are
the header the integration tests use — they must never be reachable in production.

## 2. Remove the hardcoded dev credential (BLOCKER)

`modules/auth/routes/auth.js` (~lines 99-100): `DEV_PASSWORD = 'Start@123'`. Remove it or
move it to an env var. It is only active when `NODE_ENV=development`, but it should not be
in source.

## 3. Use production DB credentials

`.env` currently holds a plaintext DB password used for local dev. In production, use a
separate DB user with a secret-managed password and least-privilege grants (no
CREATE/DROP DATABASE for the app user).

## 4. Run the database migrations / seeds

From `upload-audit/fixes/` (adjust the mysql path/creds as needed), in order:

```
mysql -u <user> -p nu_pmc < 2026-07-01-grn-display-columns-GUARDED.sql
mysql -u <user> -p nu_pmc < 2026-07-01-schema-reconcile.sql
mysql -u <user> -p nu_pmc < 2026-07-01-it-admin-bulk-grants.sql
mysql -u <user> -p nu_pmc < 2026-07-01-direct-payment-type-enum.sql
mysql -u <user> -p nu_pmc < 2026-07-01-handover-template-seed.sql
```

All are idempotent. `handover-template-seed` is the one that was still missing on the
live DB (handover "Initialise Checklist" failed without it). Verify:

```
mysql -u <user> -p nu_pmc -e "SELECT COUNT(*) FROM handover_checklist_template;"   # expect 8
```

## 5. Reconcile the canonical schema (do this)

`schema.sql` is stale vs the deployed DB — missing tables/columns/seeds (this is what
broke handover). Regenerate a canonical schema from a known-good DB and check it in:

```
mysqldump --no-data --routines nu_pmc > schema.sql   # structure only
```

This also unblocks the `tests/integration/helpers/db-test.js` harness, which builds a
fresh `nu_pmc_test` DB from `schema.sql`.

## 6. Run the test suites

```
# unit tests (DB is mocked; integration suites self-skip here)
npm test

# integration tests against a live DB (point at a scratch copy, not prod)
$env:NODE_ENV="test"; $env:TEST_DB_HOST="localhost"; $env:DB_USER="root"; $env:DB_PASSWORD="<pw>"; $env:DB_NAME="nu_pmc_test"
npx jest --config jest.integration.config.js --forceExit `
  tests/integration/uploads tests/integration/uploads-chained tests/integration/sm-ssm-role-gates
```

Expected: all 29 upload points covered (15 assert a 2xx happy path; the rest assert
"never 5xx"), plus the site_manager/senior_site_manager authority gates.

## 7. WhatsApp / notifications (optional)

Only if you want notifications live. Add to `.env`:

```
NOTIFICATIONS=enabled
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Then send a message from a registered user's phone to test the webhook.

## 8. Commit the audit + SM/SSM changes

Not yet committed (working tree):

```
services/roles.js                              # SITE_APPROVERS / SITE_SUBMITTERS
modules/site/routes/grn.js                     # approve/reject -> SITE_APPROVERS
modules/site/routes/issues.js                  # resolve drops plain site_manager
modules/finance/routes/payment-requests.js     # raise -> senior-only
modules/design-services/routes/schedule.js     # send -> SITE_APPROVERS
public/js/app.js                               # hide payment-raise from site_manager
middleware/error-handler.js                    # rejected uploads -> 400 not 500
modules/finance/routes/payments.js             # N3 await
modules/finance/routes/finance.js              # N1 petty-cash validation
modules/finance/routes/invoices.js             # F5 fee-schedule for finance_admin
tests/integration/uploads.integration.test.js
tests/integration/uploads-chained.integration.test.js
tests/integration/sm-ssm-role-gates.integration.test.js
```

(`upload-audit/` is gitignored — the SQL files and reports live there as your record.)
