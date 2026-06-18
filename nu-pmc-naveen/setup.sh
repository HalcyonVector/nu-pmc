#!/bin/bash
# nu PMC — one-command deployment setup
# Run as: bash setup.sh
# Works on Ubuntu 22.04 / 24.04

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}── $1${NC}"; }

echo ""
echo "nu associates — PMC App Setup"
echo "================================"
echo ""

# ── CHECK .env exists
step "Checking configuration"
[ -f ".env" ] || err ".env file not found. Copy .env.example to .env and fill in credentials."
ok ".env found"
source .env 2>/dev/null || warn "Could not source .env — continuing"

# ── NODE MODULES
step "Installing dependencies"
npm ci --only=production 2>/dev/null || npm install --only=production
ok "Dependencies installed"

# ── CREATE REQUIRED DIRECTORIES
step "Creating directories"
mkdir -p "${UPLOAD_DIR:-/var/www/nu-pmc-uploads}"
mkdir -p "${BACKUP_DIR:-/home/backups/nu-pmc}"
mkdir -p /var/log/nu-pmc
chmod 755 "${UPLOAD_DIR:-/var/www/nu-pmc-uploads}"
ok "Directories created"

# ── MYSQL — create database and user
step "Setting up database"
if mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" -e "SELECT 1" &>/dev/null; then
  mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" << SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME:-nu_pmc}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER:-nu_app}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME:-nu_pmc}\`.* TO '${DB_USER:-nu_app}'@'localhost';
FLUSH PRIVILEGES;
SQL
  ok "Database and user created"

  # Run schema
  mysql -u "${DB_USER:-nu_app}" -p"${DB_PASSWORD}" "${DB_NAME:-nu_pmc}" < schema.sql
  ok "Schema loaded — $(mysql -u "${DB_USER:-nu_app}" -p"${DB_PASSWORD}" "${DB_NAME:-nu_pmc}" -se "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME:-nu_pmc}'" 2>/dev/null) tables created"
else
  warn "MySQL root login failed — skipping DB setup. Run manually:"
  warn "  mysql -u root -p < setup-db.sql"
  warn "  mysql -u nu_app -p nu_pmc < schema.sql"
fi

# ── PM2 SETUP
step "Configuring PM2"
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || warn "PM2 startup: run manually as root"
pm2 start ecosystem.config.js --env production
pm2 save
ok "PM2 started — app running"

# ── NGINX CONFIG
step "nginx configuration"
cat > /tmp/nu-pmc-nginx.conf << NGINX
server {
    listen 80;
    server_name ${APP_DOMAIN:-nuassociates.in} www.${APP_DOMAIN:-nuassociates.in};

    # Redirect HTTP to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${APP_DOMAIN:-nuassociates.in} www.${APP_DOMAIN:-nuassociates.in};

    ssl_certificate     /etc/letsencrypt/live/${APP_DOMAIN:-nuassociates.in}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN:-nuassociates.in}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # File uploads — serve via app (authenticated)
    location /api/files/ {
        proxy_pass http://127.0.0.1:${PORT:-3000};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 60s;
    }

    # Main app
    location / {
        proxy_pass http://127.0.0.1:${PORT:-3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;

        # File upload size
        client_max_body_size 25M;
    }
}
NGINX
if [ -d "/etc/nginx/sites-available" ]; then
  cp /tmp/nu-pmc-nginx.conf /etc/nginx/sites-available/nu-pmc
  ln -sf /etc/nginx/sites-available/nu-pmc /etc/nginx/sites-enabled/nu-pmc
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  ok "nginx configured"
else
  warn "nginx not installed. Config written to /tmp/nu-pmc-nginx.conf"
fi

# ── SSL CERT
step "SSL certificate"
if command -v certbot &>/dev/null; then
  certbot --nginx -d "${APP_DOMAIN:-nuassociates.in}" -d "www.${APP_DOMAIN:-nuassociates.in}" \
    --non-interactive --agree-tos -m "naveen@nuassociates.com" 2>/dev/null \
    && ok "SSL certificate installed" \
    || warn "certbot failed — run manually: certbot --nginx -d ${APP_DOMAIN:-nuassociates.in}"
else
  warn "certbot not installed. Install: apt install certbot python3-certbot-nginx"
  warn "Then run: certbot --nginx -d ${APP_DOMAIN:-nuassociates.in}"
fi

# ── CRON JOBS
step "Setting up cron jobs"
CRON_EXISTING=$(crontab -l 2>/dev/null || echo "")
APP_DIR=$(pwd)

add_cron() {
  if ! echo "$CRON_EXISTING" | grep -q "$2"; then
    CRON_EXISTING="$CRON_EXISTING"$'\n'"$1 $2"
    echo "$CRON_EXISTING" | crontab -
    ok "Cron added: $1"
  else
    warn "Cron already exists: $2"
  fi
}

add_cron "0 2 * * *"     "node $APP_DIR/scripts/vps-health.js >> /var/log/nu-pmc/health.log 2>&1"
add_cron "*/60 * * * *"  "node $APP_DIR/scripts/overdue-checker.js >> /var/log/nu-pmc/cron.log 2>&1"

# ── HEALTH CHECK
step "Verifying deployment"
sleep 2
HEALTH=$(curl -s "http://localhost:${PORT:-3000}/api/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "Health check passed"
  echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print('   DB:', d.get('db'), '| Memory:', d.get('memory'), '| Uptime:', d.get('uptime'))" 2>/dev/null
else
  warn "Health check failed — check: pm2 logs nu-pmc"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}  nu PMC setup complete${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo "Next steps for Guru:"
echo "  1. Confirm app is live: curl https://${APP_DOMAIN:-nuassociates.in}/api/health"
echo "  2. Set Twilio webhook URL: https://${APP_DOMAIN:-nuassociates.in}/api/whatsapp/webhook"
echo "  3. Set Twilio status callback: https://${APP_DOMAIN:-nuassociates.in}/api/whatsapp/status-callback"
echo "  4. Set AWS SNS endpoint: https://${APP_DOMAIN:-nuassociates.in}/api/notifications/ses-webhook"
echo "  5. Create first admin user: node scripts/create-admin.js"
echo "  6. Send test message to verify WhatsApp: pm2 logs nu-pmc"
echo ""
