# ScrapFlow Ubuntu Self-Hosting

## Production architecture

ScrapFlow serves the React interface and Nitro API from one Node.js process. User accounts, sessions, roles, tickets, customers, settings, and shared yard records are stored in a local PostgreSQL database.

Required server environment:

- `NITRO_DATABASE_URL`: PostgreSQL connection URL, for example `postgresql://scrapflow:strong-password@127.0.0.1:5432/scrapflow`
- `NITRO_HOST=127.0.0.1` when Nginx is the public entry point
- `NITRO_PORT=3000`
- `NODE_ENV=production`
- `NITRO_COOKIE_SECURE=true` when the site uses HTTPS; leave it `false` only for a trusted HTTP LAN deployment

The application creates its PostgreSQL tables and indexes automatically after connecting. Do not expose PostgreSQL port 5432 outside the server.

## Fresh PM2 and Nginx deployment checklist

1. Back up the previous database if any records must be retained.
2. Stop the old PM2 application and remove its obsolete Nginx site configuration.
3. Create an empty local PostgreSQL database and a dedicated least-privilege database user.
4. Deploy a clean copy of this repository and install the dependencies from `package.json`.
5. Build the production application and configure PM2 to start `.output/server/index.mjs` with the required environment above.
6. Configure Nginx to proxy the site to `http://127.0.0.1:3000`, preserving `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers.
7. Enable HTTPS before setting `NITRO_COOKIE_SECURE=true`.
8. Verify `/api/health` reports `database: postgresql`.
9. Open `/setup` and create the first administrator. The endpoint locks permanently once an approved administrator exists.

## Account workflow

- The first visit redirects to `/setup` while no approved administrator exists.
- The first administrator is created in a PostgreSQL transaction to prevent two simultaneous bootstrap accounts.
- Staff request access from `/login` as Yard Employee, Scale Operator, or Yard Manager.
- Administrators approve requests and may promote trusted accounts to Administrator from User Access.
- Disabled users have all active sessions revoked immediately.
- The system prevents removal or disabling of the final approved administrator.

## Starting over safely

A fresh application build does not reset user accounts because they live in PostgreSQL. To intentionally start from the one-time administrator setup, deploy against a new empty database. Keep the old database backup until the new installation has been verified.

## Docker alternative

`compose.yaml` includes both PostgreSQL and ScrapFlow. Set `POSTGRES_PASSWORD` in the deployment environment before launching the stack. The named `scrapflow-postgres-data` volume preserves all records across application rebuilds.

## Backups

Use regular PostgreSQL backups and test restoration periodically. The Settings export covers operational yard data, but database backups are required to preserve account credentials and sessions.
