#!/usr/bin/env bash
#
# SalesFlow CRM — Full deployment to a Digital Ocean Ubuntu droplet
# Target URL: https://crm.sendrato.com
#
# Usage:
#   1. Copy this script to your droplet:
#      scp deploy.sh root@<DROPLET_IP>:/root/deploy.sh
#
#   2. SSH into the droplet and run:
#      ssh root@<DROPLET_IP>
#      chmod +x /root/deploy.sh
#      /root/deploy.sh
#
# Prerequisites:
#   - Fresh Ubuntu 22.04 or 24.04 droplet (tested on both)
#   - DNS A record: crm.sendrato.com → <DROPLET_IP>
#   - Root or sudo access
#
set -euo pipefail

# ──────────────────────────────────────────────
# Configuration — edit these before running
# ──────────────────────────────────────────────
DOMAIN="crm.sendrato.com"
APP_DIR="/opt/salesflow"
REPO_URL="https://github.com/sendrato/salesflow.git"   # adjust if private / different
BRANCH="main"
APP_USER="salesflow"
APP_PORT=3000
NODE_VERSION=20

# MySQL
MYSQL_ROOT_PASS="$(openssl rand -base64 24)"
MYSQL_DB="salesflow"
MYSQL_USER="salesflow"
MYSQL_PASS="$(openssl rand -base64 24)"

# Let's Encrypt
CERTBOT_EMAIL="admin@sendrato.com"   # change to your email

# App environment — fill in your actual values
VITE_APP_ID=""
JWT_SECRET="$(openssl rand -base64 32)"
OAUTH_SERVER_URL=""
OWNER_OPEN_ID=""
BUILT_IN_FORGE_API_URL=""
BUILT_IN_FORGE_API_KEY=""
VITE_OAUTH_PORTAL_URL=""
VITE_FRONTEND_FORGE_API_KEY=""
VITE_FRONTEND_FORGE_API_URL=""

# ──────────────────────────────────────────────
# 1. System update & base packages
# ──────────────────────────────────────────────
echo ">>> [1/9] Updating system and installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git build-essential software-properties-common ufw

# ──────────────────────────────────────────────
# 2. Firewall
# ──────────────────────────────────────────────
echo ">>> [2/9] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ──────────────────────────────────────────────
# 3. MySQL 8
# ──────────────────────────────────────────────
echo ">>> [3/9] Installing MySQL 8..."
apt-get install -y mysql-server

systemctl start mysql
systemctl enable mysql

# Secure the installation and create app database/user
mysql -u root <<EOSQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${MYSQL_ROOT_PASS}';
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DB}\`.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
EOSQL

echo "  MySQL root password: ${MYSQL_ROOT_PASS}"
echo "  MySQL app user:      ${MYSQL_USER} / ${MYSQL_PASS}"

# ──────────────────────────────────────────────
# 4. Node.js 20 LTS + pnpm
# ──────────────────────────────────────────────
echo ">>> [4/9] Installing Node.js ${NODE_VERSION} and pnpm..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

corepack enable
corepack prepare pnpm@latest --activate

echo "  Node $(node -v)  |  pnpm $(pnpm -v)"

# ──────────────────────────────────────────────
# 5. Create app user and clone repo
# ──────────────────────────────────────────────
echo ">>> [5/9] Setting up application..."
id -u ${APP_USER} &>/dev/null || useradd -r -m -s /bin/bash ${APP_USER}

if [ -d "${APP_DIR}" ]; then
  echo "  ${APP_DIR} exists — pulling latest..."
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

# ──────────────────────────────────────────────
# 6. Environment file
# ──────────────────────────────────────────────
echo ">>> [6/9] Writing environment file..."
cat > "${APP_DIR}/.env" <<ENVEOF
NODE_ENV=production
PORT=${APP_PORT}

# Database
DATABASE_URL=mysql://${MYSQL_USER}:${MYSQL_PASS}@localhost:3306/${MYSQL_DB}

# Auth / OAuth
VITE_APP_ID=${VITE_APP_ID}
JWT_SECRET=${JWT_SECRET}
OAUTH_SERVER_URL=${OAUTH_SERVER_URL}
OWNER_OPEN_ID=${OWNER_OPEN_ID}
VITE_OAUTH_PORTAL_URL=${VITE_OAUTH_PORTAL_URL}

# LLM / Forge API
BUILT_IN_FORGE_API_URL=${BUILT_IN_FORGE_API_URL}
BUILT_IN_FORGE_API_KEY=${BUILT_IN_FORGE_API_KEY}
VITE_FRONTEND_FORGE_API_KEY=${VITE_FRONTEND_FORGE_API_KEY}
VITE_FRONTEND_FORGE_API_URL=${VITE_FRONTEND_FORGE_API_URL}
ENVEOF

chmod 600 "${APP_DIR}/.env"

# ──────────────────────────────────────────────
# 7. Install deps, build, migrate
# ──────────────────────────────────────────────
echo ">>> [7/9] Installing dependencies and building..."
cd "${APP_DIR}"
pnpm install --frozen-lockfile
pnpm run build
pnpm run db:push

chown -R ${APP_USER}:${APP_USER} "${APP_DIR}"

# ──────────────────────────────────────────────
# 8. Systemd service
# ──────────────────────────────────────────────
echo ">>> [8/9] Creating systemd service..."
cat > /etc/systemd/system/salesflow.service <<SVCEOF
[Unit]
Description=SalesFlow CRM
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable salesflow
systemctl start salesflow

echo "  Waiting for app to start..."
sleep 3
systemctl status salesflow --no-pager || true

# ──────────────────────────────────────────────
# 9. Nginx + Let's Encrypt SSL
# ──────────────────────────────────────────────
echo ">>> [9/9] Configuring Nginx and SSL..."
apt-get install -y nginx certbot python3-certbot-nginx

# Initial HTTP-only config (certbot needs this to verify the domain)
cat > /etc/nginx/sites-available/salesflow <<NGEOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # SSE / streaming support
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }

    # File upload limit (matches Express 50MB limit)
    client_max_body_size 50M;
}
NGEOF

ln -sf /etc/nginx/sites-available/salesflow /etc/nginx/sites-enabled/salesflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Obtain SSL certificate (will modify the nginx config automatically)
certbot --nginx \
  -d "${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --email "${CERTBOT_EMAIL}" \
  --redirect

systemctl reload nginx

# ──────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────
echo ""
echo "============================================"
echo "  SalesFlow CRM deployed successfully!"
echo "============================================"
echo ""
echo "  URL:            https://${DOMAIN}"
echo "  App directory:  ${APP_DIR}"
echo "  App service:    systemctl {start|stop|restart|status} salesflow"
echo "  App logs:       journalctl -u salesflow -f"
echo ""
echo "  MySQL database: ${MYSQL_DB}"
echo "  MySQL user:     ${MYSQL_USER}"
echo "  MySQL password: ${MYSQL_PASS}"
echo "  MySQL root pw:  ${MYSQL_ROOT_PASS}"
echo ""
echo "  IMPORTANT: Save the credentials above securely!"
echo "  IMPORTANT: Edit ${APP_DIR}/.env with your actual"
echo "             OAuth and Forge API values, then restart:"
echo "             systemctl restart salesflow"
echo ""
echo "  SSL auto-renewal is handled by certbot's systemd timer."
echo "  Verify with: systemctl list-timers | grep certbot"
echo ""
