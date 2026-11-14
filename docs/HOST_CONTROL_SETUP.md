# Guarded app and assistant host controls

## Implemented scope

The Server & backups page at `/settings?section=server` now offers:

- Host-connection availability and an explicit setup warning when unavailable.
- Confirmed restart of **only the existing Mahaffeys Docker app container**, followed by server-side health verification.
- Exact-commit preparation/verification, deployment of a successfully verified preparation, bounded job status and rollback of the latest finished deployment attempt.
- Read-only host network interfaces, IPv4 routes, resolver/upstream DNS addresses and listening TCP/UDP sockets.
- Existing bounded container, storage, checkout, CUPS and printer diagnostics.
- Navigation to the existing editable app settings. Existing backup, audit, scale, stoplight and storage controls remain available with their existing permissions.

The assistant connection also exposes read-only network diagnostics and a separately approved app-restart job. No arbitrary shell, root file editor, generic service restart, Ubuntu network/firewall/SSH editing, drive formatting, storage migration or Docker socket access is exposed to the app. These capabilities are intentionally distinct from changing OS settings.

## Two control planes

1. **Assistant:** the existing local stdio SSH bridge. Eight read-only diagnostics use the restricted diagnostics key. Five management operations use the separate, explicitly enabled management key. Keep per-operation approval on. Reload the local plugin after updating its files, and start a new Agent turn.
2. **App:** production Nitro routes connect to an administrator-installed host daemon through the fixed Unix socket `/run/mahaffeys-control/control.sock`. It has no TCP/HTTP network listener and accepts only validated fixed actions. The app mounts its socket directory read-only; Docker's socket and SSH/private keys are **never** mounted into the app.

Both paths delegate writes to the **same root-owned guarded management runner**, shared operation lock, job store, verification gate and rollback policy. This is not a second, weaker deployment implementation.

## Security and trust

- Every app route requires an approved administrator session. POST actions also require same-origin requests, strict input fields, bounded request bodies, per-admin rate limits and exact typed write confirmations. Requested actions are audited without storing report contents, passwords or confirmations. Job polling does not add audit noise.
- The Unix socket is owner `jhilliard`, group `1000`, mode `0660`, under a root-owned, non-group/world-writable directory. Review all local users with that group. Any process with socket access has the delegated capabilities. Socket access is not an independent per-user app-auth boundary; the app's server routes enforce administrator access.
- The host daemon runs as the already-approved `jhilliard` account, **not root**, using reviewed root-owned modules. Existing Docker access is effectively host-root. This design constrains the interface, not that account's other login methods or trusted build code.
- A compromised app backend could exercise the delegated actions. The installer explicitly asks approval for this new trust boundary. Do not enable it unless that delegation is acceptable.
- No sudo/Docker-group access, SSH keys, firewall changes or management policy broadening are installed. Never add unrestricted access to resolve a setup error.
- Reports can contain private network addresses, paths and UUIDs. They are not publicly accessible or cached, but redaction is best-effort. Do not publish them without review.
- The app client is enabled only when both `NODE_ENV=production` and `NITRO_HOST_CONTROL_ENABLED=true`. Development previews remain unable to control the host even if production environment values are present.

## Prerequisites

- Existing Ubuntu administrator access, trusted server checkout `/var/www/mahaffeys`, host Node.js 22+ at `/usr/bin/node`, Docker Compose v2, systemd and Ubuntu's iproute2/util-linux/coreutils tools.
- Existing separately provisioned guarded management connection from [SERVER_MANAGEMENT_MCP.md](SERVER_MANAGEMENT_MCP.md), with the fixed enabled policy at `/etc/mahaffeys-management.json` and private account-owned mode-0700 state at `/var/lib/mahaffeys-management`.
- Existing approved `jhilliard` access to the local Docker daemon. The installer checks it; it never grants it.
- Administrator review of all new/changed host modules, the Unix-socket delegation, local group membership and the initial Compose bind mount.
- Finish any outstanding management job. The installer acquires the same exclusive operation lock and refuses an existing lock rather than removing it.

## Code and installation

The guarded installation entry point is `scripts/install-mahaffeys-host-control.mjs`. It accepts no arguments, requires an interactive root Ubuntu host session and uses host Node.js. Make the reviewed repository revision available under `/var/www/mahaffeys` through your existing approved update/file-transfer workflow. Installing a web image alone does not update host modules or the local SSH plugin.

The installer requires the exact typed confirmation **`ENABLE GUARDED HOST CONTROL`**. It:

1. Checks the existing enabled policy/account/private state, approved local Docker access, host tools and source syntax. It does not provision keys or silently enable a disabled management policy.
2. Acquires the shared management operation lock. Stale locks require review; no automatic deletion is used.
3. Creates root-owned module destinations and private backups of old files/units, including a destination/mode manifest.
4. Updates the diagnostics helpers/dispatcher and the three existing guarded management modules, preserving keys, policy, state, volumes and app data.
5. Installs the Unix-socket systemd units and enables the socket. The gateway is activated lazily when its socket is contacted. It never binds a TCP port.
6. Attempts file/unit recovery if installation fails and prints whether recovery completed, plus the private backup location. Retain those backups.

Installed locations:

| Source | Destination |
| --- | --- |
| `server/tools/hostControlProtocol.mjs` | `/usr/local/lib/mahaffeys/control/hostControlProtocol.mjs` |
| `server/tools/hostControlGateway.mjs` | `/usr/local/lib/mahaffeys/control/hostControlGateway.mjs` |
| `server/tools/networkDiagnostics.mjs` | `/usr/local/lib/mahaffeys/network-report.mjs` |
| `server/tools/storageDiagnostics.mjs` | `/usr/local/lib/mahaffeys/storage-report.mjs` |
| `scripts/mahaffeys-diagnostics.sh` | `/usr/local/lib/mahaffeys/mahaffeys-diagnostics.sh` |
| `server/tools/management/{runner,operations,policy}.mjs` | Existing `/usr/local/lib/mahaffeys/management/` paths |

The installer also writes `/etc/systemd/system/mahaffeys-host-control.socket` and `.service`. The socket is persistent across reboot through systemd. Worker jobs are not cancelled merely by restarting the gateway process; installers still refuse active jobs via the shared lock.

For **assistant-only read-only diagnostics**, the earlier `scripts/install-mahaffeys-storage-diagnostics.mjs` now installs both storage and network helpers without granting management. Its existing confirmation remains `ENABLE STORAGE DIAGNOSTICS`.

## Enable the app connection — separate initial administrator deployment

The repository Compose configuration adds a read-only bind of `/run/mahaffeys-control` and passes `NITRO_HOST_CONTROL_ENABLED`, defaulting to **false**. After installing/reviewing the host connector, set this non-secret server configuration value to `true` using your approved configuration workflow and arrange an administrator-reviewed initial deployment with that bind present. Do not change app UID/GID or grant container privilege.

**The existing remote deployment gate deliberately rejects adding a new host bind mount.** It must continue to reject it. The initial integration cannot be bootstrapped by a remote guarded redeployment: an administrator must review/activate the mount and reconcile any existing deployment baseline through the documented administrative process. Do not relax the manifest comparator, delete management state or reset container identity records to bypass this review. Subsequent guarded deployments must preserve the now-existing mount/configuration and all existing authorization tests.

This installer does not restart/redeploy the app, recreate Docker volumes, migrate data or trigger a printer test. Host module installation, initial approved app deployment and plugin reload are separate steps. Existing runtime settings need a fresh production process when the administrator activates the connection.

## Use the controls

1. Open **Settings → Server & backups** as an approved admin and select **Check host connection**. Unavailable controls remain disabled with a setup explanation. Do not interpret a local preview or missing daemon as a working host connection.
2. Select **Network settings** or another fixed report, then **Run diagnostics**. The report is from the host, not the app container. Network settings are inspected, not edited.
3. For restart, select **Restart app** and type **`RESTART APP`**. The host returns a queued job ID and later reports healthy/succeeded or failed. Queued acceptance is not success.
4. For redeploy, enter an exact lowercase 40-character commit already available in the trusted server `origin/main` history. Select **Verify revision** and type **`RUN VERIFIED TESTS`**. This fetches/builds/tests only; it does not deploy.
5. After successful preparation, the preparation ID is filled into the form. Select **Deploy verified plan** and type **`DEPLOY APPROVED PLAN`** during a maintenance window. The runner enforces fresh successful preparation, baseline stability, app/CUPS-only scope, stopped-service backups and existing authorization checks.
6. Track the returned job. The last job ID is retained in the current browser session under the signed-in user ID, so you can resume after app restart. You can also paste an existing job ID. Running jobs poll every five seconds; use **Refresh job status** after reconnecting. Status errors do not prove a deployment failed or did not happen; always recover the original job before retrying a write.
7. A finished deployment job exposes **Roll back deployment** with **`ROLLBACK DEPLOYMENT`** confirmation. Server-side latest-attempt and recovery restrictions still apply.
8. Use **Manage app settings** for existing application settings and the existing sections for backups/devices. No generic OS configuration editor is provided.

## Recovery and revocation

- Keep the private installer backups and existing admin SSH access. Inspect the printed recovery result after any installation failure.
- Disable the production host-control flag and stop/disable the dedicated systemd socket/service through your administrator workflow to revoke app delegation. Removing only the app flag does not revoke other local socket clients.
- Revoke the separate SSH key or disable the existing root-owned management policy to revoke assistant management. The gateway also delegates through that policy, so disabling it prevents new writes there too. A running accepted worker must be separately reviewed; revocation is not blind cancellation.
- Do not delete job state, active-operation locks, old images, queued documents, database or Docker volumes as a troubleshooting shortcut.
- Network/IP/DNS changes, drive migration, firewall edits, arbitrary file editing and broad Ubuntu configuration are out of scope. Add a separately reviewed explicit operation only after its validation, authorization, rollback and access-preservation requirements are defined.

## Verification status

Source unit tests cover request allowlists/confirmations, admin/origin boundaries, preview isolation, delegated program selection, preservation of the deployment gate and report filtering. Browser tests use mocked host endpoints, so they never restart or deploy the live server. Syntax checks and app builds do not prove that the gateway is installed, systemd activation works or the live deployment acceptance gate passes; those require post-installation host verification.
