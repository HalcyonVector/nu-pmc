# For Guru — May 2026 Drop Notes

This drop changes the deploy procedure in two ways. Read this before running `setup.sh` or `mysql < ...` against any environment.

## What changed in deployment

### 1. Two SQL files instead of one

The install used to be a single file. It is now two:

```bash
mysql -u nu_app -p nu_pmc < nu-pmc-install-20260502.sql    # schema + migrations + config
mysql -u nu_app -p nu_pmc < nu-pmc-seed-example.sql         # placeholder users + entities
```

The install file no longer contains any real names, GSTINs, bank accounts, or contact details — it is safe to commit to a public repository. Real user and entity data has been moved out and replaced by placeholder seed data in `nu-pmc-seed-example.sql`.

For a production deploy you have two paths:

- **Fresh test environment / staging**: load both files. You get 21 example users (password `Welcome@123` for all except the audit account) and two placeholder entities. Log in as `admin1`, change the password, then go to **Settings → Account Setup** to enter the real company details.
- **Restoring the production database**: load only `nu-pmc-install-20260502.sql`. Real user and entity rows continue to live in `pv90-loaded.sql` (which is gitignored — do not commit it). Apply that one separately if you are restoring the production data set.

### 2. Bank account is now DB-driven

Previously the ICICI debit account number lived in `.env` as `ICICI_DEBIT_ACCOUNT`. The application code no longer reads that env var. Bank details are read at runtime from `company_entities.bank_account_no` via `projects.entity_id`.

Action: remove `ICICI_DEBIT_ACCOUNT` and `NU_BANK_ACCOUNT` from your `.env` if present. They are no longer consumed.

If you set up a fresh environment, log in as a principal and enter the real bank details in **Settings → Account Setup** before any payment workflow runs. The bulk-payment Excel generator returns `500 ENTITY_BANK_MISSING` if the entity for a project has no bank account configured.

### 3. New env vars for the admin script

`scripts/create-admin.js` no longer hardcodes the principal's name, email, or phone. It now reads:

```bash
ADMIN_USERNAME='admin1'
ADMIN_FULL_NAME='Real Name Here'
ADMIN_INITIAL_PASSWORD='<strong password>'
ADMIN_PHONE='919XXXXXXXXX'           # optional
ADMIN_EMAIL='admin@yourcompany.com'  # optional
node scripts/create-admin.js
```

If `ADMIN_USERNAME`, `ADMIN_FULL_NAME`, or `ADMIN_INITIAL_PASSWORD` are missing the script exits with a clear error. No silent defaults.

`setup.sh`'s certbot call also reads `ADMIN_EMAIL` instead of a hardcoded address. Set it before running setup.

## What changed in the repo

This drop is the first one prepared for a private GitHub repository. The cleanup that landed:

- All real names, phone numbers, GSTINs, and bank account numbers removed from committed files. The two files that still hold real data — `pv90-loaded.sql` and `GURU-INSTRUCTIONS.md` — are now in `.gitignore`. They live on the deploy host and are not pushed.
- 31 stale binary files removed from the repo root: 14 QA slide JPEGs, two CapabilityDeck files, six Python build helpers, four UI preview PNGs, two screenshot scripts, and a tabbar prototype HTML page. Plus 19 session working notes (`AUDIT-*.md`, `PRE-DELIVERY-BASELINE.md`, etc.) that have been folded into `CLAUDE_WORKING_STRATEGY.md` and `SUBSTRATE-CONTRACT.md`.
- New files for new behaviour: `nu-pmc-seed-example.sql`, `.github/workflows/test.yml` (CI for tests on push/PR), and `modules/system/routes/company-entities.js` (the Account Setup admin page).
- `.gitignore` updated to exclude: `pv90-loaded.sql`, `GURU-INSTRUCTIONS.md`, `qa_slide-*.jpg`, `tabbar-test*`, `preview.png`, `preview.html`, `test-results/` (Playwright failure artefacts).

## What changed in the schema

Three new migrations since the previous drop:

- **v5.42** — adds an `account_setup` nav entry for principals and design principals. The Account Setup screen lets a principal manage company entities (PROP, LLP, etc.), edit bank details, and add new entities. GSTIN and entity code are immutable once set; everything else is editable. Bank-detail edits show a confirmation modal with the last-4 of the new account number before saving. All writes are audit-logged.
- **v5.43** — adds the `document_attachments` table for incoming Matrix files. The bot's reader job now downloads photos, PDFs, and other files sent in project rooms, dedupes them by `matrix_event_id`, and stores them under `UPLOAD_DIR/matrix-media/<project_code>/`. Videos over 25 MB are rejected with a row recorded so the reader does not retry. Images over 2 MB are compressed via `sharp` on the way in.
- One in-place change — the v5.31 reseed of `signoff_workflows` was already correct against the May 2026 delta brief (no migration needed for the workflow table itself).

## What you do not need to do

- No code change required to bank lookups in production — the data path was already DB-driven via `company_entities`. The change in this drop only removed the dead env-var fallback.
- No re-onboarding of users. The placeholder users in `nu-pmc-seed-example.sql` are for fresh installs only. If you load it on top of a populated database you will get a duplicate-key error on `users.id` because the example file uses fixed IDs starting at 1.

## Tests and CI

`npm test` runs 1,117 tests across 67 suites (41 skipped, 0 failed) with `NODE_ENV=test SESSION_SECRET=any-non-empty-value`. The same command runs on every push and pull request via `.github/workflows/test.yml`. Push the branch and wait for the green check before promoting to production.

## After deploying

1. Run both SQL files (or just the install file if restoring production data).
2. Log in as the principal account.
3. Go to **Settings → Account Setup**. Confirm the bank details, GSTIN, and contact info match what you have on file. Edit if needed.
4. Run a payment workflow end-to-end with the audit account watching the room. Confirm the Excel debit account matches what you set in step 3.

If anything looks wrong, the rollback path is: revert the `.env` to the previous `ICICI_DEBIT_ACCOUNT` value and restart pm2. The application code will continue to work because the env-var fallback path was removed but the DB lookup will fall back gracefully on missing data — except for bulk payment generation, which will refuse to run without the entity bank set. That is intentional.

— end —
