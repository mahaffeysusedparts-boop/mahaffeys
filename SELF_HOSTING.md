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

Docker Compose also starts a private `cups` container that runs the CUPS print service on the LAN. The Mahaffeys app container talks to it over the internal `cups:631` address (set via `NITRO_CUPS_SERVER`). This lets any workstation print receipts, checks, and vehicle stickers directly to a shared network printer instead of routing through each device's browser print dialog. Add printers in **Settings → Shared network printers**, then choose one at print time in the receipt, check, and sticker dialogs. The app container needs `chromium` (installed in the image) to render documents to PDF before handing them to CUPS.

### Managing the Docker Deployment

- **View logs:** `sudo docker compose logs -f`
- **Stop services:** `sudo docker compose down`
- **Restart services:** `sudo docker compose restart`
- **Update the application:**
  1.  `git pull origin main`
  2.  `sudo docker compose up --build -d`

### Read-only diagnostics from Dyad on Windows

See [SERVER_DIAGNOSTICS_MCP.md](docs/SERVER_DIAGNOSTICS_MCP.md) for the stdio plugin fields, dedicated SSH key prerequisites, and restricted server dispatcher. This bridge reads container status, bounded logs, and CUPS/printer connectivity; it does not deploy, restart services, or expose Docker management on the network. One-time administrator provisioning is required before live diagnostics work.

### CUPS TCP connectivity and persistent configuration

The `cups-config` volume holds the active `/etc/cups` configuration and printer queues. The `cups-data` volume retains the mounted CUPS cache. **Rebuilding the image does not replace configuration already saved in `cups-config`.** The packaged `deploy/docker/cupsd.conf` already has `Port 631`, but an older volume may contain only `Listen /var/run/cups/cups.sock`. In that case CUPS can run locally while the app cannot reach `cups:631`.

The Docker entrypoint repairs only the known socket-only listener configuration (also accepting `/run/cups/cups.sock`). Before appending `Port 631`, it creates a uniquely named `/etc/cups/cupsd.conf.before-tcp-631.*` backup, preserving file ownership and permissions. It retains the socket, authentication, access rules, and other settings. Existing `Port`, `SSLPort`, `SSLListen`, or other `Listen` directives are deliberately left alone, even if they do not enable the app's expected address.

CUPS also validates the HTTP hostname used by clients. The app uses the Docker service name `cups`; without an accepted `ServerName` or `ServerAlias`, CUPS may return `lpadmin: Bad Request` even with TCP enabled. The packaged configuration includes `ServerAlias cups`. On startup, the entrypoint adds this exact alias to older saved configurations only when they do not already accept it. It reuses the listener backup when both repairs occur together; an alias-only repair creates `/etc/cups/cupsd.conf.before-serveralias-cups.*`. It does not add a wildcard, remove authentication, or widen network access rules. Existing wildcard aliases are left untouched. Repeated successful starts neither duplicate directives nor create additional backups.

Every startup runs `cupsd -t` against the active file before starting CUPS in the foreground. If validation fails after either repair, the entrypoint restores the backup and exits with diagnostic logs. An already-invalid configuration that was not changed is left untouched and startup stops. The health check uses TCP at `127.0.0.1:631` under `LC_ALL=C`, checks command success, and requires exactly `scheduler is running`; a working Unix socket alone cannot pass.

**Security:** The existing `631:631` host publication is unchanged. Restrict it to trusted networks using Docker-aware host firewall/network controls; do not forward it from the internet. Docker-published ports may bypass ordinary UFW rules. Never resolve a later authorization error by disabling authentication or adding unrestricted access.

#### Non-destructive CUPS-only rollout

Deployment checks below are performed on the Docker server, from the project directory with its existing `.env`. No database or application rebuild is needed for this listener fix.

```bash
# Validate shell syntax and Compose interpolation before rollout.
sh -n deploy/docker/cups-entrypoint.sh
docker compose config --quiet

# Record existing queues/device URIs if the old scheduler is running via its socket.
docker compose exec cups lpstat -h /var/run/cups/cups.sock -p -v

# Rebuild/recreate only CUPS, retaining both named volumes.
docker compose up -d --build cups

# Review the migration backup path, validation output, and health status.
docker compose logs --tail=100 cups
docker compose ps cups
docker compose exec cups cupsd -t

# Prove TCP scheduler availability locally and from the app container.
docker compose exec cups env LC_ALL=C lpstat -h 127.0.0.1:631 -r
docker compose exec mahaffeys env LC_ALL=C lpstat -h cups:631 -r

# Compare these queues/device URIs with the pre-rollout inventory.
docker compose exec cups lpstat -h 127.0.0.1:631 -p -v
```

Both scheduler checks must report `scheduler is running`. A healthy loopback check alone does not prove the app can connect or administer queues. Do not use `docker compose down -v`, delete named volumes, or replace `/etc/cups` wholesale. If the old scheduler is stopped, retain a copy of its `printers.conf` for the queue comparison instead of treating a failed inventory command as an empty queue list.

After the app check succeeds, use the existing **Settings → Shared network printers** interface to retry the Brother host `192.168.1.251` with its current `/ipp/print` path. Send a small document through the app and confirm actual paper output. Saving a profile or accepting a job is not proof of printing. An authentication/authorization failure, an unreachable printer, or a protocol failure is a separate issue; inspect application/CUPS logs and diagnose it without changing drivers or access rules merely to bypass an error.

#### Rollback of the CUPS configuration repair

The backup filename is logged at startup and retained in `cups-config`. Stop CUPS before restoring it so the scheduler cannot rewrite the configuration. The one-off restore explicitly bypasses the repair entrypoint and mounts the existing volumes; use the exact backup filename from the log. For an alias-only repair, substitute the `cupsd.conf.before-serveralias-cups.*` backup for the listener backup in the example below.

```bash
docker compose stop cups
docker compose run --rm --no-deps --entrypoint /bin/sh cups -c \
  'cp -p /etc/cups/cupsd.conf.before-tcp-631.EXACT_SUFFIX /etc/cups/cupsd.conf && cupsd -t -c /etc/cups/cupsd.conf'
```

This rolls back only `cupsd.conf`, not queues or application data. Leave the service stopped while diagnosing the problem: normal startup will repair a socket-only file again. To run the restored configuration temporarily without the migration, use a local Compose override setting the `cups` service's `entrypoint` to `["cupsd", "-f"]`; remove that override when the issue is resolved. A socket-only rollback intentionally fails the TCP health check and does not restore app printing. Reverting/rebuilding the image alone does not undo a change in the persistent volume. If automatic restoration failed, recover from the logged backup before attempting another startup.

#### Deployment verification checklist

Use disposable CUPS configuration volumes, not production queues, for failure-case tests:

- Socket-only file: verify a backup exists, exactly one `Port 631` and any missing `ServerAlias cups` are added, and removing the appended blocks gives byte-for-byte original content.
- Second startup: verify the configuration and backup count are unchanged.
- Existing `Port 631` or deliberately bound TCP listener: verify listeners are unchanged; only a missing service hostname alias may be appended.
- Existing TCP configuration missing `ServerAlias cups`: verify an alias-only backup is created and exactly one alias is added. Case-insensitive `cups` in existing `ServerName` or `ServerAlias` directives and existing wildcard aliases must not be duplicated.
- File containing an invalid directive: verify validation stops startup and restores the original when either repair was applied. An invalid file requiring neither repair must stop startup without modification.
- Socket-only scheduler started with the repair entrypoint bypassed: verify the TCP health probe fails despite local socket availability. With TCP enabled, verify the probe succeeds.
- Production rollout: verify app-to-CUPS TCP connectivity, unchanged existing queues, successful printer addition, and physical test output separately.

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
-   Installing system dependencies (Nginx, PostgreSQL, Node.js, CUPS, Chromium).
-   Configuring the database, application, `pm2` service manager, and Nginx.
-   Attempting to secure the site with a free Let's Encrypt HTTPS certificate.

Once complete, the application will be running at `http://192.168.1.210` and, if successful, `https://app.mahaffeysusedparts.com`.

For shared network printing, the installer also enables the local CUPS service and installs Chromium. Add printers in **Settings → Shared network printers**, then choose one at print time in the receipt, check, and sticker dialogs. The app renders each document to PDF with Chromium and submits it to CUPS, so jobs print directly to the selected network printer instead of routing through each workstation's browser.

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