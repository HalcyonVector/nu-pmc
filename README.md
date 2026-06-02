# nu PMC — Setup Instructions for Guru

## What's in this zip

- `nu-pmc/` — full v6.02 codebase
- `pv90-fixed.sql` — PV90 project data (all passwords set to Welcome@123)
- `dev-seed.sql` — dev role switcher user (user1 / Start@123)
- This README

---

## Step 1 — Install dependencies

```bash
cd nu-pmc
npm install
```

---

## Step 2 — Configure .env

```bash
cp .env.example .env
```

Edit `.env` — set these values:

```
NODE_ENV=development
PORT=5100
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<your mysql password>
DB_NAME=nu_pmc
SESSION_SECRET=<any random 32+ character string>
PWA_BASE_URL=http://18.60.155.241:5100
APP_URL=http://18.60.155.241:5100
NOTIFICATIONS=disabled
```

---

## Step 3 — Load the database

Run these in order. Each command asks for the MySQL password.

```bash
# Create database
mysql -u root -p -e "DROP DATABASE IF EXISTS nu_pmc; CREATE DATABASE nu_pmc CHARACTER SET utf8mb4"

CREATE USER 'nu_app'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON nu_pmc.* TO 'nu_app'@'localhost';
FLUSH PRIVILEGES;


# Load schema
# Load PV90 data (passwords are Welcome@123)
mysql -u root -p nu_pmc < pmc_initial_schema_with_data.sql

## Admin Password
mysql -h database-2.c74oaeo42yfo.ap-south-2.rds.amazonaws.com -P 3306 -u admin -p nu_pmc < pmc_initial_schema_with_data.sql

## 
mysql -u root -p nu_pmc < patch-schema-2026-05-09.sql

## Admin Password
mysql -h database-2.c74oaeo42yfo.ap-south-2.rds.amazonaws.com -P 3306 -u admin -p nu_pmc < patch-schema-2026-05-09.sql

# Load dev role switcher user
mysql -u root -p nu_pmc < dev-seed.sql

mysql -h database-2.c74oaeo42yfo.ap-south-2.rds.amazonaws.com -P 3306 -u admin -p nu_pmc < dev-seed.sql

```

---

## Step 4 — Start the app

```bash
pm2 start nu-pmc/server.js --name nu-pmc
```

Or without pm2:
```bash
cd nu-pmc && npm start
```

---

## Step 5 — Verify

Open: http://18.60.155.241:5100/

**Standard login** (any PV90 user):
- Username: `naveen` / Password: `Welcome@123`
- Username: `ajay` / Password: `Welcome@123`
- (all 20 users have same password)

**Dev role switcher** (testing only):
- Username: `user1` / Password: `Start@123`
- After login, a role picker appears — select any user to browse as that role
- Only works when `NODE_ENV=development` in `.env`

---

## To disable the role switcher later

In `.env`, change:
```
NODE_ENV=production
```

Restart the app. Role switcher endpoint is completely inactive.

---

## If you get duplicate column errors during SQL load

Safe to ignore — these are from columns added in migrations that already exist. The data will load correctly.

## If pm2 is not found

```bash
npm install -g pm2
```
