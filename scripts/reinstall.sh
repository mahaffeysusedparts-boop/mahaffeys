#!/bin/bash

# ScrapFlow Reinstallation Script
# This script automates the process of backing up data, removing the old
# installation, and deploying a fresh version of the application.
#
# WARNING: This is a destructive operation.

# --- Configuration ---
# IMPORTANT: Update these variables before running the script.
APP_DIR="/var/www/scrapflow"
REPO_URL="<YOUR_GIT_REPOSITORY_URL>" # <-- Replace this!
SERVER_IP="192.168.1.100"           # <-- Replace with your server's static LAN IP
BACKUP_DIR="/var/backups/scrapflow"
# --- End Configuration ---

set -e # Exit immediately if a command exits with a non-zero status.

echo "--- ScrapFlow Reinstallation Utility ---"

# --- Safety Check ---
read -p "WARNING: This will delete all files in $APP_DIR. A backup of your database will be attempted. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reinstallation cancelled."
    exit 1
fi

# --- 1. Backup Data ---
echo "[1/7] Backing up database..."
if [ -f "$APP_DIR/data/scrapflow.db" ]; then
    sudo mkdir -p $BACKUP_DIR
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/scrapflow_backup_$TIMESTAMP.db"
    sudo cp "$APP_DIR/data/scrapflow.db" "$BACKUP_FILE"
    echo "✅ Database backed up to $BACKUP_FILE"
else
    echo "⚠️  No existing database found to back up. Skipping."
fi

# --- 2. Stop Services ---
echo "[2/7] Stopping PM2 services..."
pm2 stop scrapflow-app >/dev/null 2>&1 || echo "  - scrapflow-app not running."
pm2 delete scrapflow-app >/dev/null 2>&1 || echo "  - scrapflow-app not in pm2 list."
pm2 save >/dev/null

# --- 3. Remove Old Installation ---
echo "[3/7] Removing old installation files..."
sudo rm -f /etc/nginx/sites-enabled/scrapflow || echo "  - Nginx site not enabled."
sudo rm -f /etc/nginx/sites-available/scrapflow || echo "  - Nginx config not found."
sudo systemctl restart nginx
sudo rm -rf $APP_DIR
echo "✅ Old installation removed."

# --- 4. Fresh Installation ---
echo "[4/7] Cloning fresh repository from $REPO_URL..."
cd /var/www
sudo git clone "$REPO_URL" scrapflow
cd $APP_DIR

echo "[5/7] Installing dependencies and building application..."
sudo npm install
sudo npm run build
echo "✅ Build complete."

# --- 6. Restore Database ---
read -p "Do you want to restore the latest database backup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ && -f "$BACKUP_FILE" ]]; then
    echo "  - Restoring database from $BACKUP_FILE..."
    sudo cp "$BACKUP_FILE" "$APP_DIR/data/scrapflow.db"
    echo "✅ Database restored."
elif [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  No backup file found to restore."
fi

# --- 7. Configure and Launch ---
echo "[7/7] Configuring Nginx and starting application..."
NGINX_CONF="server {
    listen 80;
    server_name $SERVER_IP scrapflow.local;

    root $APP_DIR/dist;
    index index.html;

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}"
echo "$NGINX_CONF" | sudo tee /etc/nginx/sites-available/scrapflow > /dev/null
sudo ln -s /etc/nginx/sites-available/scrapflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

cd $APP_DIR
pm2 start "npm" --name "scrapflow-app" -- run preview
pm2 save

echo "---"
echo "✅ Reinstallation Complete! ---"
echo "ScrapFlow is now running on http://$SERVER_IP"