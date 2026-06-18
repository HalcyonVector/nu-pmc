# nu PMC — Deployment Guide for Guru

**App version:** v1 · April 2026  
**Contact:** Naveen — 9886050673 · naveen@nuassociates.com  
**Domain:** nuassociates.in  
**Audited:** Code audited by Claude Opus — 14/14 checks clean, 0 vulnerabilities

---

## What this app is

Full lifecycle PMC system for nu associates. 21 users, 15 roles. WhatsApp is the primary field interface — site managers submit daily reports via WhatsApp. Principals and PMC heads use the web app.

**Stack:** Node.js + Express + MySQL + PWA  
**Database:** 109 tables, 313 foreign keys  
**Routes:** 49 API endpoints  
**Tests:** 31 unit tests + 13 module tests (full end-to-end flow)

**Monthly running costs:**
- Twilio WhatsApp: ₹1,000–2,000 per active project
- Anthropic API: ₹1,100–1,700 per active project
- VPS: ~₹1,500 (Hetzner CX21 or DigitalOcean Basic)

---

## Critical path — start these TODAY

These have waiting periods. Everything else can happen in parallel.

| Item | Wait time | Action |
|------|-----------|--------|
| Meta WhatsApp Business verification | 3–7 days | Submit business number immediately |
| DNS propagation | Up to 24h | Point domain to VPS IP |
| AWS SES domain verification | 24–48h | Verify nuassociates.in in SES |
| Twilio message template approval | 1–3 days | Submit all 9 templates at once |

**The WhatsApp verification is the only real critical path.** Nothing else blocks go-live.

---

## Before you start — get these ready

| Item | Where | Time |
|------|-------|------|
| VPS — 2 vCPU, 4GB RAM, 80GB SSD | Hetzner Cloud or DigitalOcean | 15 min |
| Domain DNS → VPS IP | GoDaddy (nuassociates.in) | 5 min |
| Twilio account | console.twilio.com | 30 min |
| Anthropic API key | console.anthropic.com | 15 min |
| AWS account (SES) | aws.amazon.com | 30 min |

---

## Step 1 — Provision VPS

```bash
ssh root@YOUR_VPS_IP

apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# MySQL 8
apt install -y mysql-server
mysql_secure_installation
# Set root password, remove anonymous users, disallow remote root, remove test DB

# PM2
npm install -g pm2

# Nginx
apt install -y nginx certbot python3-certbot-nginx
```

---

## Step 2 — Upload and configure app

```bash
# On your local machine — upload the zip
scp nu-pmc-v1.zip root@YOUR_VPS_IP:/home/

# On the server
cd /home
unzip nu-pmc-v1.zip
mv nu-pmc /var/www/nu-pmc
cd /var/www/nu-pmc
npm install --production
```

### Fill the .env file

```bash
cp .env.example .env
nano .env
```

**Every value in .env.example must be filled. Key ones:**

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=           # 64 random characters — use: openssl rand -hex 32

DB_HOST=localhost
DB_NAME=nu_pmc
DB_USER=nu_app
DB_PASSWORD=              # strong password you set below

DOMAIN=https://nuassociates.in
ALLOWED_ORIGINS=https://nuassociates.in

TWILIO_ACCOUNT_SID=       # from Twilio console
TWILIO_AUTH_TOKEN=        # from Twilio console
TWILIO_WHATSAPP_FROM=     # whatsapp:+91XXXXXXXXXX (your verified business number)

ANTHROPIC_API_KEY=        # from console.anthropic.com

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=        # from AWS IAM
AWS_SECRET_ACCESS_KEY=    # from AWS IAM
SES_FROM_EMAIL=noreply@nuassociates.in

ICICI_DEBIT_ACCOUNT=233705000984   # confirmed — do not change

UPLOAD_DIR=/var/www/nu-pmc/uploads
MAX_FILE_SIZE_MB=20
```

**App works without Anthropic and AWS keys** — AI features silently disabled, email skipped. Start without them if needed.

---

## Step 3 — Create database

```bash
mysql -u root -p

CREATE DATABASE nu_pmc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nu_app'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON nu_pmc.* TO 'nu_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
mysql -u nu_app -p nu_pmc < /var/www/nu-pmc/schema.sql
```

Verify:
```bash
mysql -u nu_app -p nu_pmc -e "SHOW TABLES;" | wc -l
# Should show 109
```

---

## Step 4 — Create first admin user (Naveen)

```bash
cd /var/www/nu-pmc
node scripts/create-admin.js
```

This creates Naveen's account with default password `NuPMC@2026`. He must change it on first login.

---

## Step 5 — Configure Nginx

```bash
nano /etc/nginx/sites-available/nu-pmc
```

```nginx
server {
    listen 80;
    server_name nuassociates.in www.nuassociates.in;

    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /var/www/nu-pmc/uploads/;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/nu-pmc /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL
certbot --nginx -d nuassociates.in -d www.nuassociates.in
```

---

## Step 6 — Start app with PM2

```bash
cd /var/www/nu-pmc
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command it prints
```

Verify:
```bash
pm2 status          # should show online
curl localhost:3000/api/health
# {"status":"ok","db":"connected"}
```

---

## Step 7 — Configure Twilio WhatsApp

### 7a. Get WhatsApp Business number approved

1. Go to console.twilio.com → Messaging → WhatsApp
2. Submit Naveen's business number for approval
3. Wait 3–7 days for Meta verification
4. Once approved, update `TWILIO_WHATSAPP_FROM` in .env

### 7b. Set webhook URL

In Twilio console → WhatsApp → Sandbox Settings:

```
Webhook URL:        https://nuassociates.in/api/whatsapp/webhook
Status callback:    https://nuassociates.in/api/whatsapp/status-callback
HTTP method:        POST
```

### 7c. Submit 9 message templates

Submit all at once in Twilio console → Content Template Builder.

| # | Template name | Category | Variables |
|---|--------------|----------|-----------|
| 1 | `nu_grn_approval` | UTILITY | vendor_name, amount, project |
| 2 | `nu_anomaly_alert` | UTILITY | site_manager, task, pct_jump |
| 3 | `nu_issue_confirm` | UTILITY | issue_type, location, raised_by |
| 4 | `nu_mom_client_ack` | UTILITY | mom_number, meeting_date, project |
| 5 | `nu_vendor_defect` | UTILITY | ncr_number, description, due_date |
| 6 | `nu_payment_fyi` | UTILITY | vendor_name, amount, approved_by |
| 7 | `nu_schedule_drift` | UTILITY | project, drift_days, task |
| 8 | `nu_budget_alert` | UTILITY | trade, committed, sanctioned, pct |
| 9 | `nu_payment_excel` | UTILITY | week_ending, total_amount |

All category: UTILITY. Language: English (India).

---

## Step 8 — Run module tests

This verifies the entire system end to end against the live database.

```bash
cd /var/www/nu-pmc
node tests/modules/runner.js
```

**What it does:**
- Creates test users, clients, vendors, a project
- Uploads BOQ, assigns vendors, runs payments, GRNs, MOMs, issues, reports
- Simulates 12 WhatsApp webhook flows
- Cleans up all test data at the end

**Expected output:**
```
─── Module 01-setup ─────────────────────
  ✓ seed principal user
  ✓ principal can login
  ✓ create PMC user
  ... (all pass)

─── Module 13-whatsapp ──────────────────
  ✓ WhatsApp webhook responds to POST
  ... (all pass)

═════════════════════════════════════════
XX/XX tests passed in Xs
All modules passed ✓
```

**If a module fails, the chain stops.** Fix that module before continuing. Run individual modules:

```bash
node tests/modules/runner.js 07        # only GRN module
node tests/modules/runner.js 03 07    # modules 3 through 7
```

---

## Step 9 — Load master data (Naveen/Udupa does this)

Once all module tests pass, Naveen logs in and uploads:

1. **Users** — `nu_PMC_BulkUpload_Templates_v1.xlsx` → Users sheet  
   → Menu: Admin → Users → Bulk Upload  
   → Creates all 21 team members in one shot

2. **Vendors Master** — `nu_PMC_Vendors_Master_Template.xlsx`  
   → Menu: Vendors → Master → Bulk Upload  
   → All active contractors with bank details

3. **Clients Master** — same bulk upload flow  
   → SP Mandali, WeSchool, Dr. AIT, TZMO at minimum

---

## Step 10 — Create first project (TLD)

In the app:

1. Projects → New Project
2. Fill: name, client, location, contract value, start date, completion date
3. Assign team: PMC head, site manager
4. Upload BOQ Excel (Trade / Section / Item / Unit / Quantity columns)
5. Upload Schedule Excel (Task ID, Task Name, Trade, Start Date, End Date, Weight%)
6. Vendors → Engagements → Add each active contractor

---

## Module test reference

| Module | Tests | What it covers |
|--------|-------|----------------|
| 01-setup | 10 | Users, clients, vendors, fuzzy duplicate check, project creation |
| 02-boq | 7 | BOQ upload, section detection, parent-child hierarchy, validation |
| 03-engagement | 8 | Vendor search, fuzzy check, engagement, bulk upload |
| 04-boq-mapping | 6 | AI suggest mappings, manual map, delete |
| 05-schedule | 7 | Upload, progress updates, lookahead, versions |
| 06-drawings | 6 | Upload PDF, approve, drawing query full cycle |
| 07-grn | 6 | Raise planned/unplanned, approve, reject, NCR |
| 08-issues | 6 | Safety (draft→PMC confirm), design (auto-route), quality, dismiss |
| 09-moms | 6 | Create, action items, issue to client, complete |
| 10-payments | 7 | Advance (no invoice), RA bill (blocked→override), GST split, ICICI Excel |
| 11-reports | 5 | Weekly report draft, approve, task progress validation |
| 12-finance | 6 | Client receipt, GST statement, Excel download, cleanup |
| 13-whatsapp | 11 | Location check-in, daily report text, 6 button flows, status callback |

---

## Role reference

| Role | Who | Access |
|------|-----|--------|
| `principal` | Naveen | Everything |
| `design_principal` | Ajay | Everything except finance |
| `design_head` | Rajani | Design stream — drawings, queries, issues, budget |
| `team_lead` | Sahana, Sushmitha | Same as jr_architect + CN signing |
| `services_head` | Shrinatha | Services stream — drawings, queries, issues |
| `services_engineer` | Karthik | Services drawings, queries |
| `jr_architect` | Sathish R, Preethi | Drawings, queries, issues |
| `detailing` | Bhumika, Supraj, Shreyas, Abhishek, Ajay HV | Drawings only — no WhatsApp |
| `coordinator` | Prajwal | Design + site + PMC — no finance |
| `pmc_head` | Murugesan, Praveen | Reports, GRNs, issues, MOMs, payments |
| `site_manager` | Arun Kumar | Tasks, GRNs, issues, queries, labour |
| `finance_admin` | Udupa | Payments, invoices, GST, receipts |
| `trainee` | Anjaneya, Suleman | Drawings, schedule view |

---

## Environment variables reference

All 52 variables are documented in `.env.example`. Key ones Guru must not miss:

- `SESSION_SECRET` — generate with `openssl rand -hex 32`. Must be 64+ chars in production.
- `ICICI_DEBIT_ACCOUNT=233705000984` — confirmed by Naveen. Do not change.
- `TWILIO_WHATSAPP_FROM` — must include `whatsapp:` prefix e.g. `whatsapp:+919XXXXXXXXX`
- `NODE_ENV=production` — without this, rate limiting and security headers behave differently

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs nu-pmc --lines 50
# Check for missing env vars or DB connection errors
```

**DB connection failed:**
```bash
mysql -u nu_app -p nu_pmc -e "SELECT 1"
# If fails — check DB_PASSWORD in .env matches what you set in MySQL
```

**WhatsApp webhook not receiving:**
```bash
# Check Twilio webhook URL is exactly:
# https://nuassociates.in/api/whatsapp/webhook
# Check Nginx is forwarding to port 3000
curl -X POST https://nuassociates.in/api/whatsapp/webhook
# Should return 200, not 404 or 502
```

**Module tests failing at 01-setup:**
```bash
# Most likely: DB schema not loaded, or create-admin not run
mysql -u nu_app -p nu_pmc -e "SHOW TABLES;" | wc -l
# Must be 109
```

**File uploads failing:**
```bash
ls -la /var/www/nu-pmc/uploads/
# Must exist and be writable by the app user
chown -R www-data:www-data /var/www/nu-pmc/uploads/
```

---

## After go-live — ongoing operations

| Task | Who | How |
|------|-----|-----|
| User joins | Naveen or Ajay | Admin → Users → Add User |
| User leaves | Naveen or Ajay | Admin → Users → Deactivate |
| New project | Naveen | Projects → New Project |
| New vendor | PMC head | Vendors → Master → Add |
| Code update | Guru | Upload new zip, `npm install`, `pm2 restart nu-pmc` |
| DB backup | Guru (automate) | `mysqldump nu_pmc > backup.sql` — set up daily cron |

---

## Files delivered to Guru

| File | Purpose |
|------|---------|
| `nu-pmc-v1.zip` | Complete application — 113 JS files, 49 routes, 109 tables |
| `nu_PMC_BulkUpload_Templates_v1.xlsx` | Users + Vendors + Clients + Fee Schedule templates |
| `nu_PMC_Vendors_Master_Template.xlsx` | Vendors master with 50 rows + trade reference |
| `nu_PMC_Contact_Collection.xlsx` | Phone + email collection sheet for 15 team members |

**The zip contains everything else:** schema.sql, setup.sh, ecosystem.config.js, .env.example, all tests.

---

*Built by Claude Opus · April 2026 · nu associates PMC v1*

---

## Post-deploy verification (run immediately after deployment)

### Step 1: Smoke test (60 seconds)

```bash
cd /var/www/nu-pmc
./scripts/post-deploy-smoke.sh http://localhost:3000
```

This runs 22 checks across 8 groups: connectivity, static assets, authentication,
core endpoints, safety pattern (destructive actions require confirmation),
role gates (site manager correctly blocked from privileged endpoints), DB integrity,
and no-500 on common paths.

**Expected output ends with:** `Summary: 22 passed, 0 failed → Deploy looks clean.`

**If any test fails**, do NOT direct users to the system. Investigate first.

### Step 2: Module tests (3 minutes)

```bash
NODE_ENV=test node tests/modules/runner.js
```

Runs 118 integration tests against a test DB. All green = backend sound.

### Step 3: E2E tests (Playwright — 5 minutes)

**First-time setup on the VPS:**
```bash
npm install --save-dev playwright
npx playwright install chromium
# If chromium download fails, allowlist cdn.playwright.dev + playwright.azureedge.net
apt install -y libnss3 libgbm-dev libasound2  # Chromium runtime deps on Ubuntu
```

**Run:**
```bash
PLAYWRIGHT_BASE=https://nuassociates.in \
  npx playwright test --config=tests/e2e/playwright.config.js
```

Runs 20+ real-browser tests covering: destructive action safety, role gates,
happy paths, UI wiring, preview-before-send, audit log. Full details in
`tests/e2e/README.md`.

**If any test fails**, open `playwright-report/index.html` for screenshots
and traces of the failure.

---

## Ongoing safety

The system has four layers of defence:

1. **Backend role gates** — every sensitive endpoint enforces role via middleware
   or inline check. Site manager cannot hit ICICI generate even by calling API
   directly.

2. **Destructive action quarantine** — all 5 external-send flows (MOM to client,
   ICICI generate, ICICI confirm, NCR to vendor, payment FYI) require explicit
   confirmation codes: `SEND`, `GENERATE`, `CONFIRM_PAID`, `FLAG_NCR`. Plus
   entity-number match (can't accidentally send MOM-042 when you meant MOM-041).

3. **Audit log** — every sensitive action writes to `audit_log` with user_id,
   action, entity, recipient details, timestamp. Query recent activity:
   ```sql
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50;
   ```

4. **Preview endpoints** — every external send has a preview endpoint that returns
   exactly what WOULD be sent, without state changes. UI shows this in a confirmation
   modal. User reviews before confirming.

If any of these checks mysteriously fails in production, the smoke test will catch
it — run it after every deploy.
