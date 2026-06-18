# nu PMC v4 — Docker Deploy Guide

One-command deploy using Docker + Docker Compose. MariaDB and the Node app run as separate containers on a private network. Data persists across restarts in named volumes.

This is the recommended path unless you have a specific reason to run bare-metal (e.g. existing MariaDB install, no Docker permissions).

---

## Prerequisites

On the staging/production box:

```bash
# Docker 24+ and Docker Compose v2
docker --version        # Docker version 24.x or later
docker compose version  # Docker Compose version v2.x
```

If Docker isn't installed, follow the official guide for your OS: https://docs.docker.com/engine/install/

Disk: 500 MB for the app image + whatever the DB grows to (uploads live in a volume too — budget 5-10 GB for typical project traffic).

Memory: 1 GB minimum. 2 GB comfortable.

Ports: 3100 (app) needs to be free. 8080 only if you want the Adminer DB UI.

---

## Deploy the tarball

```bash
# Unpack to any directory. /opt is conventional.
sudo mkdir -p /opt/nu-pmc
sudo tar -xzf nu-pmc-v4.tar.gz -C /opt/nu-pmc
cd /opt/nu-pmc

# Copy env template and edit it
cp .env.docker.example .env
vim .env
#   Set DB_ROOT_PASSWORD   — generated with: openssl rand -base64 24
#   Set DB_PASSWORD        — generated with: openssl rand -base64 24
#   Set SESSION_SECRET     — generated with: openssl rand -hex 32
#   Leave optional integration keys blank unless you have them
```

---

## First boot

```bash
# 1. Start the DB and wait for it to be healthy
docker compose up -d db
docker compose ps          # DB should show "healthy" within ~30s
# If not healthy:
#   docker compose logs db

# 2. Build the app image + run the one-shot seed container
docker compose --profile seed run --rm seed

# Expected output ends with:
#   ━━━ seed complete — counts ━━━
#   projects        2
#   users          37
#   ...
#   ✓ seed complete

# 3. Start the app
docker compose up -d app
docker compose ps          # app should show "healthy" within ~45s

# 4. Verify from host
curl -I http://localhost:3100/
# HTTP/1.1 200 OK
```

---

## Verify the deploy

Run the full L1-L4a test suite inside the running container:

```bash
docker compose exec app bash scripts/verify.sh
```

Expected output:
```
✓ MariaDB up (via docker)
✓ seed OK
✓ node up on 3100
━━━ running tests ━━━
  l1_read_smoke                 ✓
  l1b_login_render              ✓    # Playwright — can every role log in + see a screen
  l2_role_gates                 ✓
  l3a_illegal                   ✓
  l3b_audit                     ✓
  l3c_invariants                ✓
  l4a_traversal                 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY SUMMARY: 7 pass, 0 fail
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If any suite fails, run it individually for detail:
```bash
docker compose exec app python3 tests/verify/l1b_login_render.py
```

**Note on l1b_login_render.py:** this test uses Playwright which needs a browser binary. If the suite reports "skipped, playwright not installed" on first run, that's because the base Node image doesn't include Playwright by default. Install inside the container:
```bash
docker compose exec app sh -c "pip install playwright && playwright install chromium --with-deps"
```
Then rerun. (Or bake it into the image if you plan to rerun verify often — see "Adding Playwright permanently" below.)

---

## Daily ops

```bash
# Tail app logs
docker compose logs -f app

# Restart just the app (keeps DB running)
docker compose restart app

# Stop everything (data persists)
docker compose down

# Stop AND wipe all data (volumes removed — dangerous!)
docker compose down -v

# Shell into a container
docker compose exec app bash
docker compose exec db bash

# Run one-off DB query as root
docker compose exec db mysql -u root -p nu_pmc

# Re-seed (idempotent — safe to re-run)
docker compose --profile seed run --rm seed

# Start Adminer DB UI on http://localhost:8080 (server=db, user=nu_app or root)
docker compose --profile debug up -d adminer
```

---

## Updating to a newer version

When you receive a new `nu-pmc-v4.tar.gz`:

```bash
cd /opt/nu-pmc
# Backup the DB first — critical before any update
docker compose exec db mysqldump -u root -p$DB_ROOT_PASSWORD nu_pmc > ~/nu-pmc-backup-$(date +%F).sql

# Unpack on top of existing install (preserves .env)
sudo tar -xzf nu-pmc-v4-new.tar.gz -C /opt/nu-pmc

# Rebuild image
docker compose build app

# Apply any new migrations via seed (idempotent)
docker compose --profile seed run --rm seed

# Restart with new image
docker compose up -d app
docker compose exec app bash scripts/verify.sh
```

If verify fails after update, roll back:
```bash
# Stop containers
docker compose stop app db
# Restore DB
docker compose up -d db
sleep 10
cat ~/nu-pmc-backup-YYYY-MM-DD.sql | docker compose exec -T db mysql -u root -p$DB_ROOT_PASSWORD nu_pmc
# Re-deploy previous tarball, restart
```

---

## Adding Playwright permanently (optional)

If you plan to run `verify.sh` regularly and want l1b to "just work," add to the end of the `Dockerfile`:

```dockerfile
USER root
RUN apk add --no-cache python3 py3-pip chromium \
    && pip install --no-cache-dir --break-system-packages playwright requests \
    && playwright install chromium
USER nuapp
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

Rebuild with `docker compose build app` and `l1b_login_render.py` will run without a manual pip install.

---

## Production hardening (before real cutover)

1. **HTTPS** — put the app behind a reverse proxy (nginx, Caddy, Cloudflare). Update `ALLOWED_ORIGINS` in `.env` to the HTTPS URL.

2. **Firewall** — only expose port 443 (HTTPS) to the internet. Keep 3100 and 8080 internal.

3. **Backup cron** — automate the `mysqldump` above. Keep 30 days of daily backups, 1 year of weekly.

4. **Monitoring** — pipe `docker compose logs app` to wherever you aggregate logs. The app writes structured JSON-ish lines to stdout.

5. **`NODE_ENV=production`** — already set in `.env.docker.example`. Double-check.

6. **Run as non-root** — already done. Container runs as `nuapp` user.

7. **DB not exposed to host** — already done. Compose keeps port 3306 internal to `nu-pmc-net` bridge.

8. **Remove `--profile debug`** — don't `up` adminer in production. Or use it only when needed and `down` when done.

---

## Field testing path

After `verify.sh` shows all green:

1. Browse to `http://<staging-box>:3100/` in a phone browser
2. Log in as a test user (e.g. `test_site_manager` / `Test1234`)
3. Add to home screen (PWA install)
4. Walk through `FIELD_TEST_CHECKLIST.md` on a real device
5. Collect results, ship or fix

The test users have `force_password_change = 0` so they go straight to the app. Real users (naveen, ajay, etc.) have `force_password_change = 1` — their first login forces them to set a new password, which is correct.

---

## Common issues

**"SESSION_SECRET must be set in .env"** on app boot
→ Your `.env` file is missing or SESSION_SECRET is blank. Fill it with a 32+ char value.

**App container keeps restarting**
→ Check `docker compose logs app`. Most common: DB password mismatch between DB container init and app env. Wipe with `docker compose down -v` and start again — the DB container only initializes passwords on first boot of an empty volume.

**Seed shows 0 projects / 0 users after success**
→ The seed output said "success" but some INSERTs silently skipped. Check `docker compose logs nu-pmc-seed` for "ERROR" lines. Usually a schema mismatch from a migration that didn't apply.

**"Login failed" for every role**
→ This was Bug #34 in earlier builds — bcryptjs hash mismatch. Fixed in the current tarball. If it recurs, verify `tests/verify/l1b_login_render.py` passes first. If not, regenerate the seed hash: `docker compose exec app node -e "console.log(require('bcryptjs').hashSync('Test1234', 10))"` and paste it into `scripts/seed-full.sh`.

**Playwright errors "browser not installed"**
→ See "Adding Playwright permanently" above.

**Can't reach :3100 from phone on the same wifi**
→ The container binds to 0.0.0.0 by default so it should be reachable. Check host firewall: `sudo ufw allow 3100/tcp` or equivalent.
