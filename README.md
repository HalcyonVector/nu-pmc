# nu PMC

**nu associates — Project Management & Control**

A role-based PWA for architecture firms to manage the full project lifecycle: onboarding, design & services coordination, site operations, finance, approvals, and reporting. Built on Node.js + MySQL with real-time notifications via Matrix.

---

## Table of Contents

- [Architecture](#architecture)
- [Roles](#roles)
- [Prerequisites](#prerequisites)
- [Local Setup (without Docker)](#local-setup-without-docker)
- [Local Setup (with Docker)](#local-setup-with-docker)
- [Environment Variables](#environment-variables)
- [Deploying to EC2](#deploying-to-ec2)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Known Issues](#known-issues)

---

## Architecture

```
Express (server.js)
├── modules/
│   ├── auth              — login, sessions, user management
│   ├── onboarding        — projects, clients, vendor master, client BOQ
│   ├── readiness-gate    — project activation gate (initialising → active)
│   ├── design-services   — drawings, register, schedule, BOQ
│   ├── site              — daily reports, GRN, issues, photos, snags
│   ├── finance           — vendor payments, budget, client billing, GST/TDS
│   ├── workflow          — meetings, change notices, approvals, submittals
│   ├── reporting         — dashboard, pending, needs-you, Gantt
│   └── system            — nav config, notifications, WhatsApp, AI triggers
├── middleware/           — auth, permissions, CSRF, rate-limit, upload
├── services/             — Matrix adapter, email, WhatsApp, state machines
└── public/               — PWA frontend (vanilla JS + CSS)
```

Database: MySQL 8.0 / MariaDB 10.11, utf8mb4, timezone +05:30.
Notifications: Matrix homeserver (real-time) + Twilio WhatsApp + AWS SES email.
AI: Anthropic Claude (lessons retrospective, photo tagging, AI triggers).

---

## Roles

17 roles with role-based nav and per-action permissions:

| Role | Description |
|------|-------------|
| `principal` | Firm principal — full access |
| `design_principal` | Design lead |
| `pmc_head` | PMC project head |
| `design_head` | Design department head |
| `services_head` | Services department head |
| `detailing_head` | Detailing department head |
| `site_manager` / `senior_site_manager` | On-site management |
| `coordinator` | Project coordinator |
| `team_lead` | Team lead |
| `jr_architect` | Junior architect |
| `detailing` | Detailing team |
| `services_engineer` | Services engineer |
| `finance_admin` | Finance & billing |
| `trainee` | Trainee (read-only, limited scope) |
| `audit` | Auditor (read-only, full visibility) |
| `it_admin` | IT admin — user & nav management |

---

## Prerequisites

- Node.js 20+
- MySQL 8.0+ or MariaDB 10.11+
- npm 9+
- (Optional) Docker + Docker Compose v2 for containerised setup
- (Optional) PM2 for production process management: `npm install -g pm2`

---

## Local Setup (without Docker)

### 1. Install dependencies

```bash
cd nu-pmc
npm install
```

### 2. Create the database

```bash
mysql -u root -p -e "CREATE DATABASE nu_pmc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. Load schema and seed data

```bash
# Full schema + all migrations in one file
mysql -u root -p nu_pmc < nu-pmc-install-20260502.sql

# Optional: apply any pending patches
mysql -u root -p nu_pmc < patch-schema-2026-05-09.sql

# Optional: load example seed users (passwords: Welcome@123)
mysql -u root -p nu_pmc < nu-pmc-seed-example.sql
```

> If you see "duplicate column" errors during the SQL load, these are safe to ignore — they come from migration columns that already exist.

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum required values for local development:

```
NODE_ENV=development
PORT=5100
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<your mysql password>
DB_NAME=nu_pmc
SESSION_SECRET=<any random 32+ character string>
PWA_BASE_URL=http://localhost:5100
APP_URL=http://localhost:5100
NOTIFICATIONS=disabled
```

See [Environment Variables](#environment-variables) for the full list.

### 5. Start the app

```bash
# Development (with auto-reload via nodemon)
npm run dev

# Or plain Node
npm start
```

Open: http://localhost:5100

### 6. Log in

After loading `nu-pmc-seed-example.sql`, these users are available (password: `Welcome@123`):

- `principal` — principal
- `design_principal` — design_principal
- `admin1` — it_admin (password: `Welcome@123`)

First login as `admin1` and go to **Settings → Account Setup** to set company details.

### Dev role switcher

When `NODE_ENV=development`, a special user lets you switch between any role without creating separate accounts:

- Username: `user1` / Password: `Start@123`
- After login, a role picker appears — select any role to browse as that user

To disable, set `NODE_ENV=production` in `.env` and restart.

---

## Local Setup (with Docker)

Runs the app + database in containers. No local MySQL required.

### First-time setup

```bash
cp .env.docker.example .env
# Edit .env — set DB_ROOT_PASSWORD, DB_PASSWORD, SESSION_SECRET to real values

docker compose up -d db
sleep 30  # wait for DB to become healthy
docker compose --profile seed run --rm seed  # applies schema + seed data
docker compose up -d app
```

Verify:
```bash
docker compose ps     # both db and app should show "healthy"
curl http://localhost:3100/
```

### Daily ops

```bash
docker compose up -d db app    # start
docker compose down            # stop (data persists)
docker compose down -v         # stop and wipe all data
docker compose logs -f app     # tail logs
docker compose restart app     # restart app only
```

### Optional DB UI (Adminer)

```bash
docker compose --profile debug up -d adminer
# Open http://localhost:8080
# Server: db | User: nu_app | Password: from .env | DB: nu_pmc
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | `5100` | App port |
| `NODE_ENV` | Yes | — | `development` or `production` |
| `SESSION_SECRET` | Yes | — | Random 32+ character string |
| `DB_HOST` | Yes | `localhost` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | Yes | — | MySQL user |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | `nu_pmc` | Database name |
| `PWA_BASE_URL` | Yes | — | Full URL the app is served from |
| `NOTIFICATIONS` | No | `disabled` | `disabled`, `matrix`, or `all` |
| `MATRIX_HOMESERVER` | If notifications | — | e.g. `https://nuassociates.ems.host` |
| `MATRIX_BOT_TOKEN` | If notifications | — | Matrix bot access token |
| `MATRIX_BOT_USER_ID` | If notifications | — | e.g. `@nu_pmc_bot:server.com` |
| `AI_PROVIDER` | No | `anthropic` | AI provider |
| `ANTHROPIC_API_KEY` | For AI features | — | Anthropic API key |
| `EMAIL_PROVIDER` | No | `ses` | `ses` or `smtp` |
| `AWS_ACCESS_KEY_ID` | If email=ses | — | AWS SES credentials |
| `AWS_SECRET_ACCESS_KEY` | If email=ses | — | AWS SES credentials |
| `TWILIO_ACCOUNT_SID` | For WhatsApp | — | Twilio credentials |
| `TWILIO_AUTH_TOKEN` | For WhatsApp | — | Twilio credentials |
| `TWILIO_WA_NUMBER` | For WhatsApp | — | WhatsApp sender number |

Full list with all optional keys: see `.env.example`.

---

## Deploying to EC2

The production server runs Node directly via PM2 (not Docker). The app is on port 5100, fronted by nginx.

### First-time deploy

Follow the full guide in `deploy/GURU-AWS-DEPLOY.md`.

### Pushing a code update

On your local machine:

```bash
# Exclude node_modules and .git to keep the archive small
zip -r nu-pmc-updated.zip . -x "node_modules/*" ".git/*" "logs/*" "uploads/*"

# Copy to server (replace key and username as needed — try ubuntu or ec2-user)
scp -i your-key.pem nu-pmc-updated.zip ubuntu@<EC2_IP>:/tmp/
```

On the server:

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>

# Check where the app lives
pm2 list

# Backup current version
cp -r /opt/nu-pmc /opt/nu-pmc-backup-$(date +%Y%m%d)

# Extract update — -x .env preserves production secrets
cd /opt/nu-pmc
unzip -o /tmp/nu-pmc-updated.zip -x ".env"

# Reinstall in case package.json changed
npm install --production

# Restart
pm2 restart nu-pmc

# Watch logs for 30 seconds to confirm clean start
pm2 logs nu-pmc --lines 40
```

### nginx reverse proxy

Config is in `deploy/nginx.conf`. After changes:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Useful PM2 commands

```bash
pm2 list                        # status of all processes
pm2 logs nu-pmc --lines 50     # recent logs
pm2 restart nu-pmc             # graceful restart
pm2 stop nu-pmc                # stop without removing
pm2 startup                    # configure PM2 to start on boot
pm2 save                       # save process list for startup
```

---

## Running Tests

### Module unit tests

```bash
npm test
# or just the module tests
npm run test:modules
```

### Module boundary lint

```bash
npm run lint:boundaries
```

### E2E tests (Playwright)

Runs real browser clicks against a live server. Set up once:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Run:

```bash
cd tests/e2e
npx playwright test
```

Spec files:

| File | Covers |
|------|--------|
| `01-destructive-safety.spec.js` | Destructive actions require confirmation |
| `02-role-gates.spec.js` | Routes blocked for unauthorised roles |
| `03-happy-paths.spec.js` | Core user journeys end-to-end |
| `04-ui-wiring.spec.js` | Buttons/forms correctly wired to API |
| `05-preview-before-send.spec.js` | Preview modal before sends/approvals |
| `06-audit-log.spec.js` | Audit trail for key actions |
| `07-semantic-click-inference.spec.js` | Semantic action routing |
| `08-v5-critical-paths.spec.js` | V5 regression suite |

---

## Project Structure

```
nu-pmc/
├── server.js                  # Entry point
├── ecosystem.config.js        # PM2 config
├── docker-compose.yml         # Docker Compose full stack
├── Dockerfile                 # Multi-stage production image
├── .env.example               # Environment variable template
│
├── modules/                   # Feature modules (each has contract.js + routes + tests)
│   ├── auth/
│   ├── design-services/
│   ├── finance/
│   ├── onboarding/
│   ├── readiness-gate/
│   ├── reporting/
│   ├── site/
│   ├── system/
│   └── workflow/
│
├── middleware/                # Express middleware (auth, permissions, CSRF, upload…)
├── services/                  # Shared services (Matrix, WhatsApp, email, state machines…)
├── public/                    # PWA frontend — HTML, JS, CSS
├── governance_sheets/         # Excel sheets that drive role_permissions in DB
├── scripts/                   # One-off scripts, seed helpers, verify scripts
├── tests/
│   └── e2e/                  # Playwright E2E specs
│
├── nu-pmc-install-20260502.sql  # Complete schema + all migrations (use this for fresh installs)
├── nu-pmc-seed-example.sql      # Example users and placeholder data
├── patch-schema-*.sql           # Incremental patches (already included in install SQL above)
│
└── deploy/
    ├── GURU-AWS-DEPLOY.md    # Full AWS EC2 setup guide
    └── nginx.conf            # nginx reverse proxy config
```

--
- **`.env` must not be committed** — `.env.example` is the safe template to commit. The actual `.env` is gitignored and must be created manually on each environment with real secrets. Never reuse development credentials in production.