#!/usr/bin/env bash

# Reinstalls the Mahaffeys application while preserving its server configuration
# and creating a PostgreSQL backup. Run this as the normal deployment user.

set -Eeuo pipefail

APP_DIR="/var/www/mahaffeys"
REPO_URL="<YOUR_GIT_REPOSITORY_URL>"
BRANCH="main"
BACKUP_DIR="/var/backups/mahaffeys"
ENV_FILE="/etc/mahaffeys/mahaffeys.env"
SERVICE_NAME="mahaffeys"

if [[ "$REPO_URL" == "<YOUR_GIT_REPOSITORY_URL>" ]]; then
    echo "Set REPO_URL near the top of this script before running it."
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Complete the initial server setup in SELF_HOSTING.md first."
    exit 1
fi

read -r -p "This will replace $APP_DIR with a fresh clone. Continue? [y/N] " REPLY
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Reinstallation cancelled."
    exit 0
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/mahaffeys_${TIMESTAMP}.dump"

echo "[1/7] Backing up PostgreSQL..."
sudo install -d -m 700 "$BACKUP_DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
if [[ -z "${NITRO_DATABASE_URL:-}" ]]; then
    echo "NITRO_DATABASE_URL is not set in $ENV_FILE."
    exit 1
fi
pg_dump --format=custom --file="/tmp/mahaffeys_${TIMESTAMP}.dump" "$NITRO_DATABASE_URL"
sudo mv "/tmp/mahaffeys_${TIMESTAMP}.dump" "$BACKUP_FILE"
sudo chmod 600 "$BACKUP_FILE"
echo "Database backup saved to $BACKUP_FILE"

echo "[2/7] Stopping the application..."
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

echo "[3/7] Replacing application files..."
sudo rm -rf "$APP_DIR"
sudo git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$APP_DIR"

echo "[4/7] Installing production dependencies and building..."
cd "$APP_DIR"
npm ci
npm run build

echo "[5/7] Starting the application..."
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "[6/7] Validating Nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "[7/7] Checking application health..."
for attempt in {1..15}; do
    if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
        echo "Mahaffeys is healthy. Reinstallation complete."
        echo "Backup retained at $BACKUP_FILE"
        exit 0
    fi
    sleep 2
done

echo "The service started but its health check did not pass."
echo "Inspect it with: sudo systemctl status $SERVICE_NAME"
exit 1
