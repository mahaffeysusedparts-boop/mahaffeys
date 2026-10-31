# Local Dyad preview

The Vite development server automatically uses embedded, on-disk storage (PGlite) instead of connecting to PostgreSQL. No Docker, database URL or database password is needed. Even if `NITRO_DATABASE_URL` or `DATABASE_URL` is saved in Dyad, development ignores it.

Accounts, sessions, customers, tickets, shared settings and database-stored uploads live in `data/local-preview/database` inside the app folder on the computer running Dyad. Preview backups live in `data/local-preview/backups`. These private files are excluded from Git. Refreshing, signing out or restarting the preview does not delete them. Do not delete this folder or open it from two preview processes simultaneously.

Create a separate administrator on the first-time setup screen. Production accounts and records are not copied into the preview. The preview retains normal authentication, permissions, transactions and payment validation.

Production (`NODE_ENV=production`) still requires the existing PostgreSQL URL and does not use this local store. Existing PostgreSQL integration tests (`NODE_ENV=test`) retain their isolated `TEST_DATABASE_URL` behavior. `NITRO_PREVIEW_DATA_DIR`, if set, overrides the local storage directory for development only; use a private directory outside the public assets folder.

This removes the external database dependency, not hardware or external-service dependencies. Real scales, LAN cameras, CUPS printing, vision processing and online VIN lookup still require their respective devices/services; existing manual workflows remain available.
