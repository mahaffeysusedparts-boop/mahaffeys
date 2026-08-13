# Self-host Mahaffeys on Linux

This guide deploys Mahaffeys on an Ubuntu or Debian server at your site. You can use the traditional systemd service approach or the simpler, fully containerized Docker Compose method.

## Option A: Docker Compose Deployment (Recommended)

This is the simplest and most robust way to run Mahaffeys. It packages the application, database, and web server into isolated containers.

### 1. Install Docker

First, install Docker and Docker Compose on your server:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2
```

### 2. Create Environment File

Create a `.env` file in the root of the Mahaffeys project directory. This file will securely store your database password.

```bash
nano .env
```

Add the following values to the file:

```ini
POSTGRES_PASSWORD=replace-with-a-long-random-password
APP_PORT=8080
NITRO_COOKIE_SECURE=false
```

Use a unique database password and never commit the real `.env` file. Keep `NITRO_COOKIE_SECURE=false` for LAN-only HTTP access; change it to `true` when the site is later served over HTTPS.

### 3. Build and Run

From the project root directory, build and start all services in the background:

```bash
sudo docker compose up --build -d
```

The application will now be available at `http://SERVER_LAN_IP:8080`. Set `APP_PORT=80` if you want to access it without the port suffix.

The PostgreSQL volume stores users, sessions, application records, and uploaded images across container updates and restarts. Docker Compose also starts a private `storage-agent` container. It installs `mdadm`, receives no published host port, validates every requested block-device operation, and is the only container granted host device privileges. The public Mahaffeys web container remains unprivileged. RAID operations affect real host disks and should only be confirmed after checking the selected device serial numbers.

### Managing the Docker Deployment

- **View logs:** `sudo docker compose logs -f`
- **Stop services:** `sudo docker compose down`
- **Restart services:** `sudo docker compose restart`
- **Update the application:**
  1.  `git pull origin main`
  2.  `sudo docker compose up --build -d`

---

## Option B: Traditional systemd Deployment

This method uses the `fresh-install.sh` script to install all application components directly onto the host server.

**Warning:** This script is destructive and will permanently delete any existing Mahaffeys deployment and database on the server.

### Automated Installation

1.  Ensure you are running the script from a fresh copy of the project source code, not from within the final `/var/www/mahaffeys` installation directory.
2.  Make the script executable and run it with `sudo`:

    ```bash
    chmod +x scripts/fresh-install.sh
    sudo ./scripts/fresh-install.sh
    ```

The installer will guide you through the process, which includes:
-   Prompting for the `jhilliard` Linux user password.
-   Confirming the data wipe.
-   Installing system dependencies (Nginx, PostgreSQL, Node.js).
-   Configuring the database, application, `pm2` service manager, and Nginx.
-   Attempting to secure the site with a free Let's Encrypt HTTPS certificate.

Once complete, the application will be running at `http://192.168.1.210` and, if successful, `https://app.mahaffeysusedparts.com`.

### Post-Installation

After the initial installation, you can manage the application using the `reinstall.sh` and `configure-lan-ssh.sh` scripts as described below.

### 6. Configure LAN-only SSH and the firewall

The included SSH setup accepts a trusted public key, disables password and root login, binds SSH to `192.168.1.210`, and permits port 22 only from `192.168.1.0/24`:

```bash
cd /var/www/mahaffeys
chmod +x scripts/configure-lan-ssh.sh
sudo ./scripts/configure-lan-ssh.sh
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Do not expose SSH, PostgreSQL port `5432`, or Nitro port `3000` to the internet. The `jhilliard` password is not accepted by SSH after this key-only setup.

Approved application administrators can use **Server Admin** in the Mahaffeys navigation to view service health, disk and memory usage, recent PM2 logs, and request a guarded production restart. The Linux installation and recovery scripts also install `mdadm` and configure the root-owned `mahaffeys-mdadm` validation wrapper automatically, enabling the guarded RAID and hot-swap controls without granting the web service unrestricted root access.

### 7. Make the app available from anywhere

#### Option A: Domain and router port forwarding

1.  Obtain a domain or dynamic-DNS hostname.
2.  Point its DNS `A` record to the site's public IPv4 address. Add an `AAAA` record only if IPv6 is deliberately configured and firewalled.
3.  In the site's router, forward public TCP ports `80` and `443` to the server's static LAN IP on the same ports.
4.  Confirm the Nginx `server_name` is the domain.
5.  Ask the internet provider for a public IP if the connection uses carrier-grade NAT (CGNAT); normal port forwarding will not work behind CGNAT.

Install a trusted HTTPS certificate after DNS and forwarding are working:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.mahaffeysusedparts.com
sudo certbot renew --dry-run
```

After this, use `https://app.mahaffeysusedparts.com`. Do not use plain HTTP for logins over the internet.

#### Option B: Private VPN

For staff-only access, connect remote devices to the site's network through a VPN such as WireGuard or Tailscale and use the LAN address/private hostname. This avoids publishing the app to the entire internet and usually avoids CGNAT and port-forwarding issues. Keep Nginx in front of the app even when using a VPN.

### 8. First login and security

1.  Open the final HTTPS URL.
2.  Complete the initial administrator setup.
3.  Use a unique, strong administrator password.
4.  Approve only known users and disable accounts that no longer require access.
5.  Keep Ubuntu, Node.js, PostgreSQL, and Nginx patched.

The first public deployment should not be considered complete until HTTPS works.

### Updates

Back up the database before updating:

```bash
sudo install -d -m 700 /var/backups/mahaffeys
set -a; source /etc/mahaffeys/mahaffeys.env; set +a
BACKUP_FILE="mahaffeys_$(date +%Y%m%d_%H%M%S).dump"
pg_dump --format=custom --file="/tmp/$BACKUP_FILE" "$NITRO_DATABASE_URL"
sudo mv "/tmp/$BACKUP_FILE" /var/backups/mahaffeys/

cd /var/www/mahaffeys
git pull --ff-only origin main
npm install
npm run build
sudo systemctl restart mahaffeys
curl http://127.0.0.1:3000/api/health
```

### Automated reinstall

`scripts/reinstall.sh` performs a PostgreSQL backup, stops the service, replaces the app with a fresh clone, rebuilds it, restarts systemd, reloads Nginx, and checks application health.

The initial PostgreSQL, environment, systemd, and Nginx setup above must already exist.

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

### Troubleshooting

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