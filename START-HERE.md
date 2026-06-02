# nu PMC — Fresh Install Guide

## What you need first
- Node.js 20+
- MySQL 8.0+
- A server (AWS EC2, VPS, or local machine)

## Step 1 — Install dependencies
```bash
cd nu-pmc
npm install
```

## Step 2 — Set up the database
```bash
# In MySQL:
CREATE DATABASE nu_pmc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nu_app'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON nu_pmc.* TO 'nu_app'@'localhost';
FLUSH PRIVILEGES;

# Step 2a — Schema + migrations (no real data):
mysql -u nu_app -p nu_pmc < nu-pmc-install-20260502.sql

# Step 2b — Placeholder users and company entities:
mysql -u nu_app -p nu_pmc < nu-pmc-seed-example.sql
```

After first login (admin1 / Welcome@123), go to **Settings → Account Setup**
to enter your real company and bank details.

## Step 3 — Configure environment
```bash
cp .env.example .env
# Edit .env — minimum required values:
```
```
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nu_pmc
DB_USER=nu_app
DB_PASSWORD=your_password
SESSION_SECRET=any_random_64_character_string
NOTIFICATIONS=matrix
MATRIX_HOMESERVER=https://nuassociates.ems.host
MATRIX_BOT_TOKEN=your_bot_token
MATRIX_BOT_USER_ID=@nu_pmc_bot:your-matrix-server.com
PWA_BASE_URL=https://your-domain.com
```

## Step 4 — Create first admin user
```bash
node scripts/create-admin.js
```

## Step 5 — Start the app
```bash
# Development:
npm run dev

# Production (with PM2):
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

App runs at: http://localhost:3000

Default password for all new users: `Welcome@123`
Users are prompted to change after 25 logins (set to 2 before go-live).

## Step 6 — Verify
```bash
npx jest
# Expected: 75 suites, 1330 tests passing, 0 failures
```

## AWS-specific setup
See `deploy/GURU-AWS-DEPLOY.md` for nginx config, SSL, and process management.

## Matrix setup
EMS (Element Matrix Services) must be provisioned separately.
Once EMS is live, run:
```bash
node scripts/matrix-provision-rooms.js --project PV90
node scripts/test-matrix.js
node scripts/test-threads.js
```
