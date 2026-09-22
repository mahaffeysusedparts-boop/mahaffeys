# Mahaffeys Auto-Recovery Kit

Brings the yard server back online **by itself** after a power loss or crash,
pulls the **latest code from GitHub**, rebuilds if anything changed, and keeps
the server running with an automatic watchdog.

## What happens on boot

1. Waits for internet (up to 10 minutes — routers/DHCP need a minute after an outage).
2. Runs `git pull --ff-only` from `origin/main` (never discards local commits).
3. If the code changed: `npm install` + `npm run build`. If never built: builds anyway.
4. Starts the production server (`node .output/server/index.mjs`).
5. If the server ever exits or crashes: waits 5 seconds, pulls any new code, and restarts — forever.

If GitHub is unreachable, it still boots the **last known-good build**, so the
yard never stays down because of an internet outage.

All activity is logged to `scripts/logs/auto-recover.log`.

## Windows setup (recommended for the yard workstation)

Requires **one-time setup** from an elevated (Administrator) PowerShell:

```powershell
cd C:\path\to\mahaffeys
powershell -ExecutionPolicy Bypass -File .\scripts\install-auto-start.ps1
```

That registers a Scheduled Task that runs the recovery script at every boot —
no login required. Node.js and Git must be installed for the system (they
already are if you've been running the app).

Verify it worked by rebooting the PC — after a few minutes the app should be
reachable again. Check `scripts\logs\auto-recover.log` for the boot trail.

## Linux setup (servers)

```bash
sudo cp scripts/mahaffeys.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mahaffeys
```

Adjust `WorkingDirectory`, `User`, and `ExecStart` paths in the unit file to
match your deployment (default `/opt/mahaffeys`).

## Data safety notes

- Business data lives in **PostgreSQL** and per-workstation local storage —
  power loss does not corrupt it. Make sure PostgreSQL is set to auto-start
  (the Windows installer's service and systemd units do this by default).
- `git pull --ff-only` will never overwrite local work; if you have local
  commits diverging from GitHub, the update is skipped and logged.
- To change the tracked branch: pass `-Branch <name>` (Windows) or set
  `MAHAFFEYS_BRANCH` (Linux).

## Manual test (without rebooting)

Windows:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\auto-recover.ps1
```

Linux:
```bash
bash scripts/auto-recover.sh
```
