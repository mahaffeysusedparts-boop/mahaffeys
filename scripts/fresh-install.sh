# Clean up any previous, conflicting Node.js repository configurations
echo "Cleaning up previous Node.js repository configurations..."
rm -f /etc/apt/sources.list.d/nodesource.list
rm -f /etc/apt/keyrings/nodesource.gpg
rm -f /usr/share/keyrings/nodesource.gpg

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx postgresql postgresql-contrib rsync certbot python3-certbot-nginx