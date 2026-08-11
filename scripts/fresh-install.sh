#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="mahaffeys"
DOMAIN="app.mahaffeysusedparts.com"
SERVER_IP="192.168.1.210"
INSTALL_DIR="/var/www/mahaffeys"
APP_USER="jhilliard"
DB_NAME="mahaffeys"
DB_USER="mahaffeys"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}"
PM2_SERVICE="/etc/systemd/system/pm2-${APP_USER}.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This installer must be run as root." >&2
  exit 1
fi

if [[ "${SOURCE_DIR}" == "${INSTALL_DIR}" ]]; then
  echo "Run this installer from a fresh source copy outside ${INSTALL_DIR}." >&2
  exit 1
fi

cat <<WARNING
DANGER: This permanently deletes the existing Mahaffeys deployment and its
PostgreSQL database, including every account, ticket, customer, and setting.

Domain:       ${DOMAIN}
Install path: ${INSTALL_DIR}
Database:     ${DB_NAME}
WARNING

read -r -p 'Type WIPE SCRAPFLOW to continue: ' CONFIRMATION
if [[ "${CONFIRMATION}" != "WIPE SCRAPFLOW" ]]; then
  echo "Cancelled. Nothing was changed."
  exit 0
fi

read -r -s -p "Password for Linux user ${APP_USER}: " APP_PASSWORD
echo
if [[ -z "${APP_PASSWORD}" ]]; then
  echo "The Linux account password cannot be empty." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx postgresql postgresql-contrib rsync certbot python3-certbot-nginx

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
printf '%s\n' 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm install --global pm2

systemctl enable --now postgresql nginx

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 delete "${APP_NAME}"
  pm2 save --force
fi

if id "${APP_USER}" >/dev/null 2>&1; then
  APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
else
  useradd --create-home --shell /bin/bash "${APP_USER}"
  APP_HOME="/home/${APP_USER}"
fi
printf '%s:%s\n' "${APP_USER}" "${APP_PASSWORD}" | chpasswd
unset APP_PASSWORD

if runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 delete "${APP_NAME}"
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 save --force
fi

rm -f "${NGINX_LINK}" "${NGINX_SITE}"
nginx -t
systemctl reload nginx

runuser -u postgres -- psql --set ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB_NAME};
DROP ROLE IF EXISTS ${DB_USER};
SQL

DB_PASSWORD="$(openssl rand -hex 24)"
runuser -u postgres -- psql --set ON_ERROR_STOP=1 <<SQL
CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL

rm -rf "${INSTALL_DIR}"
install -d -o "${APP_USER}" -g "${APP_USER}" "${INSTALL_DIR}"
rsync -a \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.output' \
  --exclude 'node_modules' \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"

runuser -u "${APP_USER}" -- bash -lc "cd '${INSTALL_DIR}' && npm install --legacy-peer-deps && npm run build"

cat > "${INSTALL_DIR}/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: "${APP_NAME}",
    cwd: "${INSTALL_DIR}",
    script: ".output/server/index.mjs",
    interpreter: "node",
    env: {
      NODE_ENV: "production",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: "3000",
      NITRO_DATABASE_URL: "postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}",
      NITRO_COOKIE_SECURE: "false"
    }
  }]
};
EOF
chown "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/ecosystem.config.cjs"
chmod 600 "${INSTALL_DIR}/ecosystem.config.cjs"

runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 start "${INSTALL_DIR}/ecosystem.config.cjs"
runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 save

cat > "${PM2_SERVICE}" <<EOF
[Unit]
Description=PM2 process manager for ${APP_USER}
After=network.target

[Service]
Type=forking
User=${APP_USER}
Environment=HOME=${APP_HOME}
Environment=PM2_HOME=${APP_HOME}/.pm2
PIDFile=${APP_HOME}/.pm2/pm2.pid
Restart=on-failure
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now "pm2-${APP_USER}"

cat > "${NGINX_SITE}" <<EOF
server {
    listen ${SERVER_IP}:80;
    listen [::]:80;
    server_name ${SERVER_IP} ${DOMAIN};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -s "${NGINX_SITE}" "${NGINX_LINK}"
nginx -t
systemctl reload nginx

HTTPS_ENABLED=false
if certbot --nginx \
  --domain "${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect; then
  HTTPS_ENABLED=true
  sed -i 's/NITRO_COOKIE_SECURE: "false"/NITRO_COOKIE_SECURE: "true"/' \
    "${INSTALL_DIR}/ecosystem.config.cjs"
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" \
    pm2 restart "${APP_NAME}" --update-env
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 save
else
  echo "HTTPS setup did not complete. The app remains configured for HTTP." >&2
  echo "Confirm that ${DOMAIN} points to this server, then finish HTTPS setup." >&2
fi

sleep 3
if ! curl --fail --silent --show-error http://127.0.0.1:3000/api/health; then
  echo >&2
  echo "Installation finished, but the local health check failed." >&2
  echo "Review the PM2 logs before opening the site." >&2
  exit 1
fi

echo
echo "LAN setup URL: http://${SERVER_IP}/setup"
if [[ "${HTTPS_ENABLED}" == "true" ]]; then
  echo "Public setup URL: https://${DOMAIN}/setup"
else
  echo "Public HTTP URL: http://${DOMAIN}/setup"
fi
echo "The generated database password is stored only in:"
echo "  ${INSTALL_DIR}/ecosystem.config.cjs"
