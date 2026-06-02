# Local Setup — nu PMC on Your Laptop

Run the entire nu PMC backend + PWA on your laptop. No AWS, no EMS. Click every link, test every workflow.

Tested on macOS (Apple Silicon and Intel), Windows 10/11, Ubuntu 22+.

---

## What You Need

| Tool        | Version | How to check                  |
| ----------- | ------- | ----------------------------- |
| Node.js     | 18+     | `node --version`              |
| npm         | 9+      | `npm --version`  (ships with Node) |
| MySQL       | 8.0+    | `mysql --version`             |
| A browser   | any     | Chrome/Safari/Firefox/Edge    |

If you're missing anything:
- **Node.js** → download from nodejs.org (LTS version is fine)
- **MySQL** → download MySQL Community Server, OR install MariaDB (drop-in compatible)
- **macOS shortcut** → `brew install node mysql` does both at once

Start MySQL after install:
- macOS: `brew services start mysql`
- Windows: it usually auto-starts; check Services
- Linux: `sudo systemctl start mysql`

---

## Step 1 — Unzip and Install (5 min)

```bash
unzip nu-pmc-v6.02-20260504.zip
cd nu-pmc
npm install
```

`npm install` takes 2-5 minutes. Some warnings are normal. Errors are not — if it fails, your Node version is probably too old (need 18+).

---

## Step 2 — Create the Database (3 min)

Open a terminal:

```bash
mysql -u root -p
```

When prompted, enter your MySQL root password (whatever you set when installing MySQL).

Inside the MySQL prompt, paste these four lines one at a time:

```sql
CREATE DATABASE nu_pmc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nu_app'@'localhost' IDENTIFIED BY 'localpass123';
GRANT ALL PRIVILEGES ON nu_pmc.* TO 'nu_app'@'localhost';
EXIT;
```

Now load the schema and seed data (run these from the `nu-pmc` directory in the terminal, not inside MySQL):

```bash
mysql -u nu_app -p'localpass123' nu_pmc < nu-pmc-install-20260502.sql
mysql -u nu_app -p'localpass123' nu_pmc < nu-pmc-seed-example.sql
```

The first command takes about 30 seconds. You'll see lots of "1" appear — that's each migration block confirming it ran. The last line should say `Seed complete. Log in as admin1 with password Welcome@123.`

---

## Step 3 — Configure (.env file, 2 min)

Copy the example config:

```bash
cp .env.example .env
```

Open `.env` in any text editor. You only need to change these lines:

```
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=nu_pmc
DB_USER=nu_app
DB_PASSWORD=localpass123

SESSION_SECRET=any-random-string-at-least-32-characters-long-replace-this

PWA_BASE_URL=http://localhost:3000
```

For local testing you can leave Twilio, Anthropic, and Matrix variables either commented out or with their placeholder values — the app handles missing credentials gracefully (notifications go to a `matrix_outbox` table instead of being sent).

**Optional — see what notifications would have been sent:** any time the app would send a Matrix message, it gets captured in the `matrix_outbox` table. Browse it with:

```bash
mysql -u nu_app -p'localpass123' nu_pmc -e "SELECT id, room_id, body FROM matrix_outbox ORDER BY id DESC LIMIT 20"
```

---

## Step 4 — Run It (1 min)

```bash
npm start
```

You should see something like:

```
[server] nu PMC listening on http://localhost:3000
[matrix-adapter] DRY_RUN mode (no MATRIX_BOT_TOKEN — sends captured to matrix_outbox)
[server] ready
```

Open `http://localhost:3000` in your browser.

Log in with:
- **Username:** `admin1`
- **Password:** `Welcome@123`

That admin account has Principal-level permissions, so you can see every screen.

---

## Step 5 — Click Around

The seed data creates 21 sample users covering every role. To test other roles, log out and log in as any of these (same password `Welcome@123`):

| Username        | Role                | What they see                                |
| --------------- | ------------------- | -------------------------------------------- |
| admin1          | principal           | Everything                                   |
| naveen          | principal           | Everything                                   |
| ajay            | design_principal    | Design + everything                          |
| pmc_head1       | pmc_head            | Project management view                      |
| design_head1    | design_head         | Design-stream drawings, materials, queries   |
| services_head1  | services_head       | Services-stream drawings, materials, queries |
| finance1        | finance_admin       | Payments, vendors, GST                       |
| site1           | site_manager        | One project's site work                      |
| coord1          | coordinator         | Coordination view                            |
| audit1          | audit               | Read-only across everything                  |

Full list with project assignments is in `nu-pmc-seed-example.sql`.

---

## To Test Matrix For Real (Optional, 10 min)

If you want to actually see Matrix polls firing instead of just being captured to `matrix_outbox`:

1. Sign up at **app.element.io** with any email (free, no approval needed)
2. Note your username — it'll be like `@yourname:matrix.org`
3. In Element, go to **Settings → Help & About → Advanced → Access Token**, copy the token
4. Create a test room, invite yourself, copy the room ID (looks like `!abc123:matrix.org`)
5. Update `.env`:
   ```
   NOTIFICATIONS=matrix
   MATRIX_HOMESERVER=https://matrix.org
   MATRIX_BOT_TOKEN=syt_xxxxx_your_token_here
   MATRIX_BOT_USER_ID=@yourname:matrix.org
   ```
6. In MySQL, set the test admin's `matrix_room_id` to your test room:
   ```sql
   UPDATE users SET matrix_room_id = '!abc123:matrix.org' WHERE username = 'admin1';
   ```
7. Restart the app (`Ctrl-C` then `npm start` again)
8. Trigger an action that sends a notification (raise a payment request, approve a daily report, etc.)
9. Watch the message appear in your Element room

This is useful for demoing the actual Matrix experience — but for routine link-clicking and screen verification, DRY_RUN mode is faster and you don't need to set this up.

---

## Stopping Everything

```bash
# Stop the app
Ctrl-C in the terminal running npm start

# Stop MySQL (optional, if you want to fully reset between sessions)
brew services stop mysql       # macOS
sudo systemctl stop mysql      # Linux
# Windows: stop the service via Services
```

To completely wipe and start fresh:

```bash
mysql -u root -p -e "DROP DATABASE nu_pmc; CREATE DATABASE nu_pmc CHARACTER SET utf8mb4"
mysql -u nu_app -p'localpass123' nu_pmc < nu-pmc-install-20260502.sql
mysql -u nu_app -p'localpass123' nu_pmc < nu-pmc-seed-example.sql
```

---

## Troubleshooting

**`Error: connect ECONNREFUSED 127.0.0.1:3306`**
MySQL isn't running. Start it (see the install section above).

**`ER_ACCESS_DENIED_ERROR for user 'nu_app'@'localhost'`**
You skipped the `CREATE USER` step in Step 2, or used a different password than what's in `.env`. Either re-run the GRANT, or update `DB_PASSWORD` in `.env` to match.

**`Cannot find module 'express'` or similar**
`npm install` didn't complete. Re-run it.

**`Error: SESSION_SECRET must be at least 32 characters`**
Update `SESSION_SECRET` in `.env` — anything random 32+ chars works.

**Pages render but buttons do nothing**
Open browser DevTools (F12) → Console tab. JavaScript errors will show there. Most often a missing route in seed data — log out and log in as `admin1` (full permissions).

**Matrix outbox is empty after I clicked things**
Either the action didn't trigger a notification (some are info-only), or `MATRIX_DISABLED=1` is set in `.env`. Remove that line and restart.

---

## What Works Locally vs What Doesn't

**✅ Works fully on laptop:**
- Login, navigation, all screens, all forms, all 16 role views
- Database operations — create projects, add vendors, raise issues, approve workflows
- File uploads (saved to local `./uploads` folder)
- PDF generation (PO, final settlement)
- All API endpoints
- Audit logs, permissions, role gates

**⚠️ Works in DRY_RUN (captured but not delivered):**
- Matrix poll sends — appear in `matrix_outbox` table
- WhatsApp dispatch — captured if Twilio credentials missing
- Email sends — captured if SMTP not configured

**❌ Won't work locally:**
- Real Matrix polls + vote reading (set up matrix.org account if you want this)
- Real WhatsApp delivery (needs Twilio)
- Real email (needs SMTP)
- ICICI bulk payment webhooks (needs public URL)

For the laptop walkthrough you proposed — clicking every link in every role — DRY_RUN is exactly what you want. Nothing leaves your laptop, nothing costs money, and you can inspect every notification that *would* have been sent by looking at `matrix_outbox`.
