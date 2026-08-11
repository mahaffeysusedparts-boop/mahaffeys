set -Eeuo pipefail

APP_DIR="/var/www/mahaffeys"
REPO_URL="https://github.com/mahaffeysusedparts-boop/mahaffeys"
BRANCH="main"
BACKUP_DIR="/var/backups/mahaffeys"
ENV_FILE="/etc/mahaffeys/mahaffeys.env"
SERVICE_NAME="mahaffeys"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE. Complete the initial server setup in SELF_HOSTING.md first."
    exit 1
fi