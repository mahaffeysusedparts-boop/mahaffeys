# Self-host ScrapFlow on Linux

This guide deploys ScrapFlow on an Ubuntu or Debian server at your site. Nginx accepts web traffic, the Nitro production server runs the React application and API, PostgreSQL stores shared data, and systemd keeps the app running after reboots.

## Deployment layout

- Public/LAN traffic: Nginx on ports `80` and `443`
- ScrapFlow: Nitro on `127.0.0.1:3000` (not exposed directly)
- Database: PostgreSQL on the same server (not exposed to the internet)
- App directory: `/var/www/scrapflow`
- Private environment file: `/etc/scrapflow/scrapflow.env`

Use a static LAN address for the server. For access from outside the site, use a domain with HTTPS and either router port forwarding or a private VPN. A VPN is the safest choice when the app should only be available to staff.

## 1. Prepare the server

The following examples target Ubuntu 22.04/24.04 or a current Debian release.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx postgresql postgresql-client ufw

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Reserve a static address for this server in the router's DHCP settings. Record:

- The server LAN IP, such as `192.168.1.100`
- The Linux login username that will own the app
- The Git repository URL
- The domain name, if using one

## 2. Create the PostgreSQL database

Generate a long password, then open PostgreSQL's administrative console:

```bash
openssl rand -hex 24
sudo -u postgres psql
```

Inside the PostgreSQL console, replace `PASTE_GENERATED_PASSWORD` and create the local database:

```sql
CREATE USER scrapflow WITH ENCRYPTED PASSWORD 'PASTE_GENERATED_PASSWORD';
CREATE DATABASE scrapflow OWNER scrapflow;
\q
```

Create the protected runtime configuration. Replace the password with the same generated value:

```bash
sudo install -d -m 750 /etc/scrapflow
sudo nano /etc/scrapflow/scrapflow.env
```

File contents:

```ini
NITRO_HOST=127.0.0.1
NITRO_PORT=3000
NITRO_DATABASE_URL=postgresql://scrapflow:PASTE_GENERATED_PASSWORD@127.0.0.1:5432/scrapflow
```

Protect it from other local users while allowing your current deployment account to read it:

```bash
sudo chown root:"$(id -gn)" /etc/scrapflow/scrapflow.env
sudo chmod 640 /etc/scrapflow/scrapflow.env
```

Use a URL-safe database password. The hexadecimal password generated above is URL-safe. Never commit this environment file to Git.

## 3. Install and build ScrapFlow

```bash
sudo git clone YOUR_REPOSITORY_URL /var/www/scrapflow
sudo chown -R "$(id -un):$(id -gn)" /var/www/scrapflow
cd /var/www/scrapflow
npm ci
npm run build
```

The production build includes the browser assets and Nitro server output in `.output/`.

## 4. Install the systemd service

Copy the included service template and set its Linux user:

```bash
cd /var/www/scrapflow
sed 's/YOUR_LINUX_USER/your-actual-linux-user/g' deploy/scrapflow.service.example | sudo tee /etc/systemd/system/scrapflow.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now scrapflow
sudo systemctl status scrapflow
```

Check the local API health endpoint:

```bash
curl http://127.0.0.1:3000/api/health
```

Do not expose port `3000` through the firewall or router. Nginx is the public entry point.

## 5. Configure Nginx

Copy the supplied configuration:

```bash
sudo cp /var/www/scrapflow/nginx.conf.example /etc/nginx/sites-available/scrapflow
sudo nano /etc/nginx/sites-available/scrapflow
```

Replace `scrapflow.example.com` with either:

- Your real domain, for internet access; or
- The server LAN IP, for local-network-only access

Enable it and remove Ubuntu's default page:

```bash
sudo ln -sf /etc/nginx/sites-available/scrapflow /etc/nginx/sites-enabled/scrapflow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The app should now open over the LAN at `http://SERVER_LAN_IP`.

## 6. Configure the firewall

Allow SSH before enabling the firewall so remote administration remains available:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Only ports `22`, `80`, and `443` should be reachable as needed. Do not expose PostgreSQL port `5432` or Nitro port `3000` to the internet.

## 7. Make the app available from anywhere

### Option A: Domain and router port forwarding

1. Obtain a domain or dynamic-DNS hostname.
2. Point its DNS `A` record to the site's public IPv4 address. Add an `AAAA` record only if IPv6 is deliberately configured and firewalled.
3. In the site's router, forward public TCP ports `80` and `443` to the server's static LAN IP on the same ports.
4. Confirm the Nginx `server_name` is the domain.
5. Ask the internet provider for a public IP if the connection uses carrier-grade NAT (CGNAT); normal port forwarding will not work behind CGNAT.

Install a trusted HTTPS certificate after DNS and forwarding are working:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scrapflow.example.com
sudo certbot renew --dry-run
```

After this, use `https://scrapflow.example.com`. Do not use plain HTTP for logins over the internet.

### Option B: Private VPN

For staff-only access, connect remote devices to the site's network through a VPN such as WireGuard or Tailscale and use the LAN address/private hostname. This avoids publishing the app to the entire internet and usually avoids CGNAT and port-forwarding issues. Keep Nginx in front of the app even when using a VPN.

## 8. First login and security

1. Open the final HTTPS URL.
2. Complete the initial administrator setup.
3. Use a unique, strong administrator password.
4. Approve only known users and disable accounts that no longer require access.
5. Keep Ubuntu, Node.js, PostgreSQL, and Nginx patched.

The first public deployment should not be considered complete until HTTPS works.

## Updates

Back up the database before updating:

```bash
sudo install -d -m 700 /var/backups/scrapflow
set -a; source /etc/scrapflow/scrapflow.env; set +a
BACKUP_FILE="scrapflow_$(date +%Y%m%d_%H%M%S).dump"
pg_dump --format=custom --file="/tmp/$BACKUP_FILE" "$NITRO_DATABASE_URL"
sudo mv "/tmp/$BACKUP_FILE" /var/backups/scrapflow/

cd /var/www/scrapflow
git pull --ff-only origin main
npm ci
npm run build
sudo systemctl restart scrapflow
curl http://127.0.0.1:3000/api/health
```

## Automated reinstall

`scripts/reinstall.sh` performs a PostgreSQL backup, stops the service, replaces the app with a fresh clone, rebuilds it, restarts systemd, reloads Nginx, and checks application health.

Before using it, set `REPO_URL` and, if needed, `BRANCH` near the top of the script. The initial PostgreSQL, environment, systemd, and Nginx setup above must already exist.

```bash
cd /var/www/scrapflow
chmod +x scripts/reinstall.sh
./scripts/reinstall.sh
```

Database backups are retained in `/var/backups/scrapflow`. Restore one with:

```bash
set -a; source /etc/scrapflow/scrapflow.env; set +a
pg_restore --clean --if-exists --no-owner --dbname="$NITRO_DATABASE_URL" /var/backups/scrapflow/BACKUP_FILE.dump
sudo systemctl restart scrapflow
```

## Troubleshooting

```bash
# Application status and recent logs
sudo systemctl status scrapflow
sudo journalctl -u scrapflow -n 100 --no-pager

# Nginx configuration and logs
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log

# Local app and database checks
curl http://127.0.0.1:3000/api/health
sudo systemctl status postgresql

# Listening ports
sudo ss -lntp
```

If the app works by LAN IP but not from the internet, inspect DNS, router forwarding, the public IP, CGNAT, and the server firewall. If Nginx returns `502 Bad Gateway`, inspect the `scrapflow` systemd service and confirm Nitro is listening on `127.0.0.1:3000`.
