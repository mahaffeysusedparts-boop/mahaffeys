# ScrapFlow Linux Self-Hosting

## What this deployment contains

The production container serves the React application, secure Nitro API, and SQLite database from one Linux PC. The database file is stored in the persistent `scrapflow-data` volume, so browser devices no longer maintain separate user or yard databases.

## Linux deployment

1. Install Docker Engine with Compose support, or use a graphical manager such as Portainer.
2. Deploy this repository as a Compose stack using `compose.yaml`.
3. Confirm the stack reports `scrapflow` as running and open port `3000` on the Linux PC.
4. Open `/api/health` in a browser. A healthy installation returns `database: connected`.
5. Open the application and create the primary administrator. This setup can only run once.

## Safe off-site access

Use Cloudflare Tunnel or another authenticated reverse proxy to publish the application. Point the public hostname to the ScrapFlow service on port `3000`. Keep the SQLite file and service port behind the tunnel; do not expose a database port to the internet.

The application and API should use the same public hostname. This keeps secure session cookies first-party and avoids exposing credentials to browser storage.

## Backups

Back up the Docker volume containing `/data/scrapflow.db`. The application Settings page also exports yard records as JSON, but account passwords and active sessions are intentionally excluded. User accounts should be recreated through registration if the database itself is not restored.

## Updates

Create a database-volume backup before deploying a newer image. Rebuilding the Compose stack preserves the named data volume.
