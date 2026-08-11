# Self-host Mahaffeys on Linux

This guide deploys Mahaffeys on an Ubuntu or Debian server at your site. Nginx accepts web traffic, the Nitro production server runs the React application and API, PostgreSQL stores shared data, and systemd keeps the app running after reboots.

## Deployment layout

- Public/LAN traffic: Nginx on ports `80` and `443`
- Mahaffeys: Nitro on `127.0.0.1:3000` (not exposed directly)
- Database: PostgreSQL on the same server (not exposed to the internet)
- App directory: `/var/www/mahaffeys`
- Private environment file: `/etc/mahaffeys/mahaffeys.env`

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
CREATE USER mahaffeys WITH ENCRYPTED PASSWORD 'PASTE_GENERATED_PASSWORD';
CREATE DATABASE mahaffeys OWNER mahaffeys;
\q
```

Create the protected runtime configuration. Replace the password with the same generated value:

```bash
sudo install -d -m 750 /etc/mahaffeys
sudo nano /etc/mahaffeys/mahaffeys.env
```

File contents:

```ini
NITRO_HOST=127.0.0.1
NITRO_PORT=3000
NITRO_DATABASE_URL=postgresql://mahaffeys:PASTE_GENERATED_PASSWORD@127.0.0.1:5432/mahaffeys
```

Protect it from other local users while allowing your current deployment account to read it:

```bash
sudo chown root:"$(id -gn)" /etc/mahaffeys/mahaffeys.env
sudo chmod 640 /etc/mahaffeys/mahaffeys.env
```

Use a URL-safe database password. The hexadecimal password generated above is URL-safe. Never commit this environment file to Git.

## 3. Install and build Mahaffeys

```bash
sudo git clone YOUR_REPOSITORY_URL /var/www/mahaffeys
sudo chown -R "$(id -un):$(id -gn)" /var/www/mahaffeys
cd /var/www/mahaffeys
npm ci
npm run build
```

The production build includes the browser assets and Nitro server output in `.output/`.

## 4. Install the systemd service

Copy the included service template and set its Linux user:

```bash
cd /var/www/mahaffeys
sed 's/YOUR_LINUX_USER/your-actual-linux-user/g' deploy/mahaffeys.service.example | sudo tee /etc/systemd/system/mahaffeys.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now mahaffeys
sudo systemctl status mahaffeys
```

Check the local API health endpoint:

```bash
curl http://127.0.0.1:3000/api/health
```

Do not expose port `3000` through the firewall or router. Nginx is the public entry point.

## 5. Configure Nginx

Copy the supplied configuration:

```bash
sudo cp /var/www/mahaffeys/nginx.conf.example /etc/nginx/sites-available/mahaffeys
sudo nano /etc/nginx/sites-available/mahaffeys
```

Replace `app.mahaffeysusedparts.com` with either:

- Your real domain, for internet access; or
- The server LAN IP, for local-network-only access

Enable it and remove Ubuntu's default page:

```bash
sudo ln -sf /etc/nginx/sites-available/mahaffeys /etc/nginx/sites-enabled/mahaffeys
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
sudo certbot --nginx -d app.mahaffeysusedparts.com
sudo certbot renew --dry-run
```

After this, use `https://app.mahaffeysusedparts.com`. Do not use plain HTTP for logins over the internet.

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
sudo install -d -m 700 /var/backups/mahaffeys
set -a; source /etc/mahaffeys/mahaffeys.env; set +a
BACKUP_FILE="mahaffeys_$(date +%Y%m%d_%H%M%S).dump"
pg_dump --format=custom --file="/tmp/$BACKUP_FILE" "$NITRO_DATABASE_URL"
sudo mv "/tmp/$BACKUP_FILE" /var/backups/mahaffeys/

cd /var/www/mahaffeys
git pull --ff-only origin main
npm ci
npm run build
sudo systemctl restart mahaffeys
curl http://127.0.0.1:3000/api/health
```

## Automated reinstall

`scripts/reinstall.sh` performs a PostgreSQL backup, stops the service, replaces the app with a fresh clone, rebuilds it, restarts systemd, reloads Nginx, and checks application health.

Before using it, set `REPO_URL` and, if needed, `BRANCH` near the top of the script. The initial PostgreSQL, environment, systemd, and Nginx setup above must already exist.

```bash
cd /var/www/mahaffeys
chmod +x scripts/reinstall.sh
./scripts/reinstall.sh
```

Database backups are retained in `/var/backups/mahaffeys`. Restore one with:

```bash
set -a; source /etc/mahaffeys/mahaffeys.env; set +a
pg_restore --clean --if-exists --no-owner --dbname="$NITRO_DATABASE_URL" /var/backups/mahaffeys/BACKUP_FILE.dump
sudo systemctl restart mahaffeys
```

## Troubleshooting

```bash
# Application status and recent logs
sudo systemctl status mahaffeys
sudo journalctl -u mahaffeys -n 100 --no-pager

# Nginx configuration and logs
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log

# Local app and database checks
curl http://127.0.0.1:3000/api/health
sudo systemctl status postgresql

# Listening ports
sudo ss -lntp
```

If the app works by LAN IP but not from the internet, inspect DNS, router forwarding, the public IP, CGNAT, and the server firewall. If Nginx returns `502 Bad Gateway`, inspect the `mahaffeys` systemd service and confirm Nitro is listening on `127.0.0.1:3000`.
