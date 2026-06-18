# nu PMC — Deploy Guide for Guru
**Version:** 22 Apr 2026
**Target:** Production VPS (Ubuntu 22.04+ / 24.04)

---

## What's in this zip

- `source/` — full application source code
- `source/schema.sql` — base database schema (88 tables)
- `source/migrations/` — 13 migration files to apply in order
- `source/tools/seed-pv90-rich.sql` — PV 90 test data (run AFTER schema+migrations)
- `source/pv90-loaded.sql` — full database dump with PV 90 loaded (alternative to schema+migrations+seed)
- `source/deploy/GURU-AWS-DEPLOY.md` — full AWS deploy guide (existing document)
- `source/deploy/nginx.conf` — nginx reverse proxy config
- `source/.env.example` — environment variable template

## What's included in this build (vs previous)

UI fixes landed in this build:
- iOS HIG / Material Design compliance — all touch targets ≥ 44px
- WCAG 2.1 AA contrast fixes (muted2, steel, topbar project name)
- `:focus-visible` keyboard accessibility rings
- `prefers-reduced-motion` support
- `aria-label` on all icon-only buttons
- Topbar breadcrumb — shows user name + role + project
- Dashboard action cards now open triage modal instead of jumping to tab
- Accordion bucket header explains navigation ("N sections — tap to expand")
- Badge clickability grammar fixed (badges never interactive)
- Setup banner / checklist CSS now defined

---

## Quick deploy (VPS)

```bash
# 1. System dependencies
sudo apt update && sudo apt install -y nodejs npm mysql-server nginx

# 2. Database
mysql -u root -p < source/schema.sql
for m in source/migrations/*.sql; do
  mysql -u root -p nu_pmc < "$m"
done
mysql -u root -p nu_pmc < source/tools/seed-pv90-rich.sql

# OR — if you prefer a single dump:
mysql -u root -p < source/pv90-loaded.sql

# 3. Application
cd source
cp .env.example .env
# Edit .env with production secrets
npm install --production
npm start
# (use pm2 or systemd for process management)

# 4. Nginx
sudo cp source/deploy/nginx.conf /etc/nginx/sites-available/nu-pmc
sudo ln -s /etc/nginx/sites-available/nu-pmc /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Test users (for validation)

All have password `TestPass1`:
- `test_principal`
- `test_pmc_head`
- `test_design_head`
- `test_services_head`
- `test_site_manager`
- `test_finance_admin`
- + 11 others (one per role)

Plus existing nu staff: `naveen`, `ajay`, `murugesan`, `rajani`, `srinath`, `anjaneya` (passwords set in `schema.sql` seed — default `Welcome@123`, force change on first login).

## Environment variables

See `.env.example`. Mandatory values before first run:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SESSION_SECRET` (32+ random chars)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE` (WhatsApp)
- `ANTHROPIC_API_KEY` (AI triggers)

## Known limitations

- No CI/CD — deploy is manual
- File storage is local filesystem (not S3) — configure backup
- No horizontal scaling yet (single server)

## Post-deploy verification

Log in as `test_principal` and select PV 90 — you should see:
- 10 scheduled tasks (Civil/Electrical/HVAC)
- 3 approved vendor engagements
- 4 open issues (1 RFI, 1 design, 1 safety, 1 quality)
- 3 GRNs pending review
- 3 payment requests in various states
- Setup checklist banner showing project readiness

If any of the above is missing, the seed did not apply cleanly — check MySQL error logs.
