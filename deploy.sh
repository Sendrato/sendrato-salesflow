#!/usr/bin/env bash
#
# SalesFlow CRM — Deploy a new instance to an Ubuntu server
#
# Usage:
#   ./deploy.sh <domain>
#
#   Example:
#     ./deploy.sh crm.acme.com
#
# This creates an isolated instance with its own database, systemd service,
# and nginx config — all derived from the domain name. Multiple instances
# can coexist on the same server.
#
# Prerequisites:
#   - Fresh Ubuntu 22.04 or 24.04 server (or one with existing instances)
#   - DNS A record: <domain> → <server IP>
#   - Root or sudo access
#
set -euo pipefail

# ──────────────────────────────────────────────
# Validate domain argument
# ──────────────────────────────────────────────
if [ $# -lt 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <domain>"
  echo ""
  echo "Example:"
  echo "  $0 crm.acme.com"
  exit 1
fi

DOMAIN="$1"

# Basic domain validation
if ! echo "$DOMAIN" | grep -qP '^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$'; then
  echo "Error: Invalid domain name: $DOMAIN"
  exit 1
fi

echo ""
echo "============================================"
echo "  SalesFlow CRM — New Instance Deployment"
echo "============================================"
echo ""
echo "  Domain: ${DOMAIN}"
echo ""

# ──────────────────────────────────────────────
# Derive names from domain
# ──────────────────────────────────────────────
# crm.acme.com → crm-acme-com (for systemd/user), crm_acme_com (for postgres)
SAFE_NAME_HYPHEN=$(echo "$DOMAIN" | tr '.' '-' | head -c 32)
SAFE_NAME_UNDER=$(echo "$DOMAIN" | tr '.' '_' | head -c 63)

APP_DIR="/opt/${DOMAIN}"
APP_USER="${SAFE_NAME_HYPHEN}"
PG_DB="${SAFE_NAME_UNDER}"
PG_USER="${SAFE_NAME_UNDER}"
SERVICE_NAME="${SAFE_NAME_HYPHEN}"
NGINX_CONF="${SAFE_NAME_HYPHEN}"
NODE_VERSION=20

echo "  Derived configuration:"
echo "    App directory:  ${APP_DIR}"
echo "    System user:    ${APP_USER}"
echo "    Database:       ${PG_DB}"
echo "    Service:        ${SERVICE_NAME}.service"
echo "    Nginx config:   ${NGINX_CONF}"
echo ""

# ──────────────────────────────────────────────
# Interactive prompts
# ──────────────────────────────────────────────
read -rp "Certbot email (for SSL certificate): " CERTBOT_EMAIL
if [ -z "$CERTBOT_EMAIL" ]; then
  echo "Error: Certbot email is required for SSL."
  exit 1
fi

read -rp "GitHub repo URL [https://github.com/Sendrato/sendrato-salesflow.git]: " REPO_URL
REPO_URL="${REPO_URL:-https://github.com/Sendrato/sendrato-salesflow.git}"

read -rp "Git branch [main]: " BRANCH
BRANCH="${BRANCH:-main}"

echo ""
echo "LLM/Forge API credentials (leave empty to skip AI features):"
read -rp "  Backend LLM API URL: " BUILT_IN_FORGE_API_URL
read -rp "  Backend LLM API key: " BUILT_IN_FORGE_API_KEY
read -rp "  Frontend LLM API URL: " VITE_FRONTEND_FORGE_API_URL
read -rp "  Frontend LLM API key: " VITE_FRONTEND_FORGE_API_KEY

# Auto-generate secrets
PG_PASS="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -base64 32)"

# ──────────────────────────────────────────────
# Auto-assign port (find first free port from 3000)
# ──────────────────────────────────────────────
find_free_port() {
  local port=3000
  local used_ports=""

  # Collect ports from existing instance .env files
  for envfile in /opt/*/.env; do
    [ -f "$envfile" ] || continue
    local p
    p=$(grep -oP '^PORT=\K\d+' "$envfile" 2>/dev/null || true)
    if [ -n "$p" ]; then
      used_ports="${used_ports} ${p}"
    fi
  done

  # Find the first unused port
  while echo "$used_ports" | grep -qw "$port"; do
    port=$((port + 1))
  done

  echo "$port"
}

APP_PORT=$(find_free_port)
echo ""
echo "  Assigned port: ${APP_PORT}"
echo ""

# ──────────────────────────────────────────────
# Confirm before proceeding
# ──────────────────────────────────────────────
read -rp "Proceed with deployment? [Y/n] " CONFIRM
CONFIRM="${CONFIRM:-Y}"
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

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
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ──────────────────────────────────────────────
# 3. PostgreSQL + pgvector
# ──────────────────────────────────────────────
echo ">>> [3/9] Installing PostgreSQL + pgvector..."
apt-get install -y postgresql postgresql-contrib

# Detect installed PostgreSQL major version for pgvector package
PG_MAJOR=$(pg_config --version | grep -oP '\d+' | head -1)
apt-get install -y "postgresql-${PG_MAJOR}-pgvector"

systemctl start postgresql
systemctl enable postgresql

# Create instance-specific database and user (idempotent)
sudo -u postgres psql <<EOSQL
DO \$\$
BEGIN
  CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASS}';
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';
END
\$\$;
EOSQL

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" \
  | grep -q 1 || sudo -u postgres createdb -O "${PG_USER}" "${PG_DB}"

sudo -u postgres psql -d "${PG_DB}" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "  PostgreSQL database: ${PG_DB}"
echo "  PostgreSQL user:     ${PG_USER}"

# ──────────────────────────────────────────────
# 4. Node.js + pnpm
# ──────────────────────────────────────────────
echo ">>> [4/9] Installing Node.js ${NODE_VERSION} and pnpm..."
if ! command -v node &>/dev/null || ! node -v | grep -q "v${NODE_VERSION}"; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi

corepack enable
corepack prepare pnpm@latest --activate

echo "  Node $(node -v)  |  pnpm $(pnpm -v)"

# ──────────────────────────────────────────────
# 5. Create app user and clone repo
# ──────────────────────────────────────────────
echo ">>> [5/9] Setting up application..."
id -u "${APP_USER}" &>/dev/null || useradd -r -m -s /bin/bash "${APP_USER}"

export GIT_TERMINAL_PROMPT=0
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

# Database (PostgreSQL + pgvector)
DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}

# Auth
JWT_SECRET=${JWT_SECRET}

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

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ──────────────────────────────────────────────
# 8. Systemd service
# ──────────────────────────────────────────────
echo ">>> [8/9] Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SVCEOF
[Unit]
Description=SalesFlow CRM (${DOMAIN})
After=network.target postgresql.service
Requires=postgresql.service

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
systemctl enable "${SERVICE_NAME}"
systemctl start "${SERVICE_NAME}"

echo "  Waiting for app to start..."
sleep 3
systemctl status "${SERVICE_NAME}" --no-pager || true

# ──────────────────────────────────────────────
# 9. Nginx + Let's Encrypt SSL
# ──────────────────────────────────────────────
echo ">>> [9/9] Configuring Nginx and SSL..."
apt-get install -y nginx certbot python3-certbot-nginx

# Nginx site config for this instance
cat > "/etc/nginx/sites-available/${NGINX_CONF}" <<NGEOF
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

ln -sf "/etc/nginx/sites-available/${NGINX_CONF}" "/etc/nginx/sites-enabled/${NGINX_CONF}"
# Only remove default if it exists
[ -f /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

# Obtain SSL certificate
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
echo "  App port:       ${APP_PORT}"
echo "  App service:    systemctl {start|stop|restart|status} ${SERVICE_NAME}"
echo "  App logs:       journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "  PostgreSQL database: ${PG_DB}"
echo "  PostgreSQL user:     ${PG_USER}"
echo "  PostgreSQL password: ${PG_PASS}"
echo ""
echo "  IMPORTANT: Save the credentials above securely!"
echo ""
echo "  AUTH: Visit https://${DOMAIN} to create the first"
echo "        admin account (email + password)."
echo ""
echo "  SSL auto-renewal is handled by certbot's systemd timer."
echo "  Verify with: systemctl list-timers | grep certbot"
echo ""
echo "  To deploy updates:"
echo "    cd ${APP_DIR}"
echo "    git pull origin ${BRANCH}"
echo "    pnpm install --frozen-lockfile"
echo "    pnpm run build"
echo "    pnpm run db:push"
echo "    systemctl restart ${SERVICE_NAME}"
echo ""
