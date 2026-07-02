# 🏗️ nu associates — PMC

**Project Management & Control** platform for architecture & construction
delivery — projects, drawings, BOQ, vendors, payments, meetings, site reports,
measurements and handover, all driven by a database-configured navigation and a
150-action permission matrix. Built as a lightweight progressive web app on
Node.js + MySQL, with WhatsApp notifications and one-command deployment.

---

## 🎯 Features

### Core Modules
- **Projects & Setup** — project lifecycle, PMC/team assignments, scope, SLAs, setup checklists and closure/handover sign-off
- **Design & Services** — drawings register with versioning, submittals, RFIs/queries, and AI-assisted drawing sanity checks
- **BOQ & Budget** — client & vendor BOQs, cost-head budgets, threshold alerts, material requests and approvals
- **Finance** — vendor engagements, payments (batch, urgent/adhoc, ICICI relay, petty cash), client receipts, claims, proforma invoices, GST & TDS
- **Site** — daily reports, check-ins, labour register & compliance, photos with review, GRNs, snags and measurements
- **Meetings & MOMs** — minutes with versioned reissue windows, action items and client acknowledgement
- **Workflow & Approvals** — configurable multi-signer sign-offs, change notices, NCRs and state machines
- **Governance** — role-based nav, permission matrix, notification triggers and audit logging

### Platform
- **Role-driven UI** — 17 roles; every tab and action is gated by DB config (`role_nav` + `role_permissions`), no code changes to re-scope a role
- **PWA** — installable, offline-aware service worker, single-file vanilla-JS front end with Alpine.js components
- **Notifications** — WhatsApp (Twilio) and email digests; optional Matrix integration
- **Auditability** — every privileged action recorded; must-change-password on first login

---

## 🛠️ Tech Stack

| Component | Technology | Details |
|-----------|-----------|---------|
| **Runtime** | Node.js 20 + Express | Modular route architecture under `modules/*/routes` |
| **Database** | MySQL 8 (AWS RDS) | `mysql2` pool; schema in `schema.sql`, config seeds + governance sheets |
| **Frontend** | Vanilla JS + Alpine.js | Single-file `public/js/app.js` + Alpine components; PWA service worker |
| **Auth/Session** | express-session + bcryptjs | Sessions persisted in MySQL (`express-mysql-session`); CSRF + helmet |
| **Validation** | Zod | Request schemas in `services/schemas.js` |
| **Files** | multer + sharp + pdfkit + exceljs | Uploads, image processing, PDF & Excel generation |
| **Notifications** | Twilio (WhatsApp) + nodemailer | Optional Matrix adapter for internal comms |
| **Process/Proxy** | pm2 + nginx | Single fork instance behind nginx; auto-deploy via GitHub Actions |

---

## 📋 Prerequisites
- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **MySQL 8** — local instance or an AWS RDS endpoint
- **pm2** (production) — `npm install -g pm2`
- A configured **`.env`** (copy from `.env.example`)

---

## 🚀 Quick Start

### Option 1: One-command server setup ⭐
On a fresh Ubuntu box with `.env` filled in:
```bash
cp .env.example .env      # then edit DB creds, PORT, etc.
bash setup.sh             # installs deps, loads schema + config, starts pm2, configures nginx
```

### Option 2: Local development
```bash
npm install
cp .env.example .env      # point DB_* at your local MySQL, set PORT=5100
mysql -u root -p nu_pmc < schema.sql
mysql -u root -p nu_pmc < seed-config.sql
node scripts/load-governance-sheets.js   # REQUIRED: loads the permission matrix
npm run dev               # nodemon on http://localhost:5100
```

> The app listens on **PORT 5100** by default (set in `.env`). Log in with a
> role account (e.g. `principal`) — initial password `Start@123`, changed on
> first login.

---

## 📖 Detailed Setup Instructions

### Production (EC2 + RDS)
```bash
# 1. Clone and enter
git clone <repo-url> nu-pmc && cd nu-pmc

# 2. Configure environment
cp .env.example .env
#    Set: DB_HOST (RDS endpoint), DB_USER, DB_PASSWORD, DB_NAME, PORT=5100,
#         NODE_ENV=production, FORCE_HTTPS=1, and Twilio vars if using WhatsApp.

# 3. Provision the database (schema + config + governance matrix)
bash setup.sh
#    or manually:
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < schema.sql
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < seed-config.sql
node scripts/load-governance-sheets.js

# 4. Verify completeness (tables, columns, config, features)
node scripts/verify-and-provision.js          # report only
node scripts/verify-and-provision.js --apply    # apply anything missing

# 5. Start under pm2
pm2 start ecosystem.config.js --env production
pm2 save
```

### Local (Windows / macOS / Linux)
```bash
npm install
cp .env.example .env         # DB_* -> local MySQL, PORT=5100, NODE_ENV=development
mysql -u root -p nu_pmc < schema.sql
mysql -u root -p nu_pmc < seed-config.sql
node scripts/load-governance-sheets.js
npm run dev
```

---

## 📁 Project Structure
```
nu-pmc/
├── server.js                  # Express entry point (loads .env, mounts modules, runs startup migrations)
├── package.json               # Scripts + dependencies
├── ecosystem.config.js        # pm2 process config
├── setup.sh                   # One-command deploy (db + nginx + pm2)
├── Dockerfile / docker-compose.yml
│
├── schema.sql                 # Full table structure (source of truth)
├── seed-config.sql            # Baseline config (role_nav, workflows, toggles…)
├── seed-firm.sql              # Optional firm-specific data (entities, thresholds)
├── dev-seed.sql               # Local dev user
├── nu-pmc-seed-example.sql    # Example role users
│
├── middleware/                # auth, csrf, db pool, validation, guards
├── modules/                   # Feature modules, each with routes/ + tests/ + contract.js
│   ├── auth/  onboarding/  design-services/  finance/
│   ├── site/  workflow/  reporting/  readiness-gate/  system/
├── services/                  # Cross-cutting logic (notifications, schemas, state machines…)
├── scripts/                   # Operational + provisioning scripts (see below)
├── migrations/                # Idempotent SQL migrations
├── governance_sheets/         # Permission matrix + workflow definitions (loaded into DB)
├── public/                    # PWA front end (app.js, Alpine components, sw.js, css)
│
├── handover/                  # Handover pack: employee guide, credentials, runbooks
├── docs/                      # Architecture & schema docs
└── .github/workflows/         # CI + auto-deploy to EC2
```

---

## 🔐 Roles & Access

Access is **100% data-driven** — no role logic is hardcoded in the UI.

| Layer | Table | Purpose |
|-------|-------|---------|
| Navigation | `role_nav` | Which tabs/buckets each role sees |
| Permissions | `role_permissions` | 150+ actions × 17 roles (loaded from `governance_sheets`) |
| Workflows | `signoff_workflows`, `approval_type_config` | Multi-signer approval definitions |

**Roles:** principal, design_principal, pmc_head, design_head, services_head,
team_lead, jr_architect, jr_engineer, detailing, services_engineer,
coordinator, site_manager, senior_site_manager, finance_admin, trainee, audit,
it_admin.

All accounts start with password **`Start@123`** and are forced to change it on
first login. See `handover/USER-CREDENTIALS.txt`.

---

## 🖥️ Deployment

### EC2 + pm2 + nginx
The app runs as a single pm2 fork (`nu-pmc`) on **port 5100**, behind nginx.
`setup.sh` wires nginx and (optionally) a Let's Encrypt certificate.

### Auto-deploy (GitHub Actions)
`.github/workflows/deploy.yml` runs on every push to `main`:

| Job | Action |
|-----|--------|
| `test` | Runs the jest suite + module-boundary check (gate) |
| `deploy` | If tests pass, SSHes to EC2 → `git pull` → `npm install` → `pm2 restart` |

> Deploy is gated on the test job. Requires the `EC2_HOST` and `EC2_SSH_KEY`
> repo secrets.

### Pre-production checklist
Set `NODE_ENV=production` and `FORCE_HTTPS=1` in `.env`, confirm a real admin
login exists, and review `handover/PRE-PRODUCTION-CHECKLIST.md`.

---

## 🔧 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Start** | `npm start` | Run the server (`node server.js`) |
| **Dev** | `npm run dev` | Nodemon with live reload |
| **Load permissions** | `node scripts/load-governance-sheets.js` | Load the permission matrix (required after schema) |
| **Verify + provision** | `node scripts/verify-and-provision.js [--apply]` | Check/apply all migrations, config and features |
| **Schema diff** | `node scripts/schema-diff.js [--apply]` | Column-level drift check vs `schema.sql` |
| **Create admin** | `node scripts/create-admin.js` | Create/reset an admin account |
| **Reset passwords** | `node scripts/set-passwords.js` | Reset role users to the default password |
| **Handover reset** | `node scripts/reset-for-handover.js [--confirm]` | Wipe operational data, keep config + seed users |
| **Health** | `node scripts/vps-health.js` | VPS/DB health probe (cron) |
| **Overdue checker** | `node scripts/overdue-checker.js` | Nightly SLA/auto-lock cron |

---

## 🚨 Troubleshooting

### Issue: `ECONNREFUSED` / `connect ... 3306` when running a script
**Solution:** Standalone scripts need `.env` loaded. Either the script auto-loads it, or run:
```bash
set -a; source .env; set +a
node scripts/<script>.js
```

### Issue: App returns 403 on everything after a fresh install
**Solution:** `role_permissions` is empty. Load the matrix:
```bash
node scripts/load-governance-sheets.js
```

### Issue: Can't reach the app on port 3000/3100
**Solution:** It runs on **5100** (`PORT` in `.env`). Target `http://localhost:5100`.

### Issue: Login fails for a role account
**Solution:** Initial password is `Start@123` (forced change on first login). Reset with `node scripts/set-passwords.js` or `node scripts/create-admin.js`.

### Issue: "Unknown column" / missing table at runtime
**Solution:** Run the provisioning check and apply:
```bash
node scripts/verify-and-provision.js --apply
node scripts/schema-diff.js --apply
pm2 restart nu-pmc --update-env
```

---

## 📈 Future Enhancements
- [ ] Regenerate `schema.sql` from migrations to remove residual drift
- [ ] Move standalone scripts' DB config into a shared loader
- [ ] Staging environment for the integration + e2e suites
- [ ] Fine-grained field-level audit diffs
- [ ] In-app notification centre (reduce reliance on WhatsApp)
- [ ] Mobile-optimised site-manager views

---

## 👨‍💻 Maintainers
**NU Associates** — internal PMC platform.
For access or onboarding, contact the IT admin.

---

## 🙋 Support
Operational runbooks and the role-by-role employee guide are in the
[`handover/`](./handover) folder. For deployment questions see `setup.sh` and
`.github/workflows/deploy.yml`.

---

## 📄 License
Proprietary — © NU Associates. Internal use only. Not for redistribution.
