export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx postgresql postgresql-contrib rsync certbot python3-certbot-nginx

# Use the official NodeSource setup script for robustness
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

npm install --global pm2

systemctl enable --now postgresql nginx