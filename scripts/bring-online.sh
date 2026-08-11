#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="mahaffeys"
APP_USER="jhilliard"
APP_HOME="/home/jhilliard"
INSTALL_DIR="/var/www/mahaffeys"
DOMAIN="app.mahaffeysusedparts.com"
SERVER_IP="192.168.1.210"
PM2_SERVICE="pm2-${APP_USER}"
ECOSYSTEM_FILE="${INSTALL_DIR}/ecosystem.config.cjs"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This recovery script must be run as root." >&2
  exit 1
fi

if [[ ! -f "${INSTALL_DIR}/.output/server/index.mjs" ]]; then
  echo "Production build not found at ${INSTALL_DIR}/.output/server/index.mjs." >&2
  echo "Complete the fresh installation before using this recovery script." >&2
  exit 1
fi

if [[ ! -f "${ECOSYSTEM_FILE}" ]]; then
  echo "PM2 configuration not found at ${ECOSYSTEM_FILE}." >&2
  exit 1
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "Application user ${APP_USER} does not exist." >&2
  exit 1
fi

systemctl enable postgresql nginx >/dev/null
systemctl start postgresql

if systemctl list-unit-files "${PM2_SERVICE}.service" --no-legend 2>/dev/null | grep -q "${PM2_SERVICE}.service"; then
  systemctl enable "${PM2_SERVICE}" >/dev/null
  systemctl start "${PM2_SERVICE}" || true
fi

if ! runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" \
    pm2 start "${ECOSYSTEM_FILE}"
else
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" \
    pm2 restart "${APP_NAME}" --update-env
fi

runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 save

nginx -t
systemctl start nginx
systemctl reload nginx

LOCAL_HEALTHY=false
for attempt in {1..15}; do
  if curl --fail --silent --show-error \
    http://127.0.0.1:3000/api/health >/tmp/mahaffeys-health.json; then
    LOCAL_HEALTHY=true
    break
  fi
  sleep 2
done

if [[ "${LOCAL_HEALTHY}" != "true" ]]; then
  echo "Mahaffeys did not pass its local health check." >&2
  echo "Current PM2 status:" >&2
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" pm2 status >&2 || true
  echo "Recent application logs:" >&2
  runuser -u "${APP_USER}" -- env HOME="${APP_HOME}" \
    pm2 logs "${APP_NAME}" --lines 40 --nostream >&2 || true
  exit 1
fi

echo "Local health check passed:"
cat /tmp/mahaffeys-health.json
echo
rm -f /tmp/mahaffeys-health.json

if ! curl --fail --silent --show-error --max-time 15 \
  "http://${SERVER_IP}/api/health" >/dev/null; then
  echo "The app is healthy locally, but Nginx is not responding at http://${SERVER_IP}." >&2
  exit 2
fi
echo "Mahaffeys is online on the LAN at http://${SERVER_IP}"

if curl --fail --silent --show-error --max-time 15 \
  "https://${DOMAIN}/api/health" >/dev/null; then
  echo "Mahaffeys is online publicly at https://${DOMAIN}"
else
  echo "The LAN app is healthy, but the optional public HTTPS check failed." >&2
fi
