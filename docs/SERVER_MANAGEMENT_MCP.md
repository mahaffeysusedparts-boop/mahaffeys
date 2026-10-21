# Mahaffeys guarded verification and deployment connection

## Scope and activation status

The local MCP bridge supports optional guarded management in addition to the original six read-only diagnostics. **Adding these files does not activate server write access.** The server administrator must review/install the separate dispatcher and authorize a separate management public key. The old diagnostics key stays read-only.

Supported operations:

1. **Prepare and verify** an exact lowercase 40-character Git commit from the existing server `origin/main` history. Fetch/build operations create artifacts but never deploy. The job builds both committed app/CUPS images, copies the live CUPS configuration into a disposable test container, and tests non-root UID/GID, queue administration, unauthorized denial, certificate privacy, a protected socket parent, and socket recreation. No real printer or print job is used.
2. **Read job status**. Long operations run in a detached worker; calls return a server-generated job ID promptly. Poll status until `succeeded` or `failed`. Cancelling the SSH/MCP request does not cancel an already accepted background job.
3. **Deploy a verified plan**, less than one hour after verification, using pinned image IDs and recorded Compose configuration. The runner checks for baseline drift, stops only app/CUPS, backs up configuration/cache/spool, recreates only those two services without building/pulling at deployment time, restores queued-document spool before CUPS starts, and waits for both health checks.
4. **Roll back the most recent finished deployment attempt**, preserving current named volumes and current queued documents. If a failed replacement never restored its spool, recovery uses that attempt's preserved pre-replacement spool archive. Stale rollback requests are refused.

There is no arbitrary shell, uploaded script, path editing, environment dump, database/proxy deployment, firewall/SSH configuration, unrestricted restart, Docker pruning, or Docker volume deletion. Test containers are removed only by recorded ID and matching job label; private artifacts and backups are retained for administrator-controlled cleanup. The server checkout is not reset: immutable Git worktrees hold reviewed revisions, and management records the active deployment manifest separately.

## Security and trust

Management requests use a separate key, fixed forced-command dispatcher, strict host verification, key-only noninteractive authentication, validated commit/job tokens, root-owned server modules/policy, one-operation lock, explicit write confirmations, and MCP write/destructive annotations.

**Keep Dyad's per-tool approval enabled for every management write.** Annotation hints and typed confirmation fields are not cryptographic proof of human consent and do not protect a client configured for automatic approval. Anyone holding the management key has the delegated management capabilities. Protect it with a passphrase and the local Windows OpenSSH agent. Never put keys/passwords in chat, source or plugin arguments.

The approved Git `origin/main` maintainers are trusted to supply Docker build/startup code. Code from a trusted revision can still be powerful; review the exact revision before approval. The account's already-existing Docker permission is effectively host-root. The installer does not grant Docker-group membership or sudo rights, and this design does not claim an OS-level sandbox around that account's other login methods.

The runner rejects service privilege/network/healthcheck changes, lost/changed production mounts, other-service changes, host bind mounts, and unsafe shared runtime volumes. Its one permitted new volume is `cups-transport` named `mahaffeys_cups-transport`, mounted at `/run/mahaffeys-cups` in CUPS and read-only in the app. Tests require a root-owned, group-1000, non-group-writable socket parent inaccessible to other users. CUPS's default socket mode cannot bypass that protected parent. **Sharing `/run/cups` and its administrator certificates is forbidden.** Current TCP/default revisions will fail this gate until a reviewed protected-socket printer configuration is committed; the connection does not silently patch authentication to make them pass.

The private state directory contains resolved configuration (including sensitive environment values), images, reports, worktrees and backups. Keep it mode `0700`, accessible only to the management account and server administrator. Public job reports omit raw manifests/environment/archive contents. Error redaction is best-effort; treat reports as sensitive and untrusted evidence.

## One-time administrator provisioning

Administrator prerequisites:

- Host Node.js **22 or newer** at `/usr/bin/node`, Docker Compose v2, Git, and sufficient disk space.
- Fixed checkout `/var/www/mahaffeys`, clean working tree, existing approved Git origin with `main`, and existing `.env` maintained privately on the server.
- Existing `jhilliard` account with already-approved Docker access. No permissions should be broadened as a shortcut.
- Separate passphrase-protected Ed25519 **management** key on the Windows machine. Only its public `.pub` file is transferred to the administrator through an approved channel. Load the private key into the Windows OpenSSH agent and retain verified `known_hosts`.

The reviewed installer is `scripts/install-mahaffeys-management.mjs`. A server administrator launches it locally as root in an interactive terminal, supplying the public-key file path as its sole argument. It validates the public key, confirms existing Docker access, and requires the administrator to type `ENABLE MAHAFFEYS MANAGEMENT` before making changes. It cannot be invoked through the old read-only key.

The installer:

- Copies the reviewed `runner.mjs`, `operations.mjs`, and `policy.mjs` from `server/tools/management/` to `/usr/local/lib/mahaffeys/management/`, owned by root and not writable by the connecting account.
- Creates `/var/lib/mahaffeys-management` owned by `jhilliard` with mode `0700`.
- Installs `/etc/mahaffeys-management.json`, owned by root, with the fixed approved repository/project/branch/state paths and `enabled: true`.
- Backs up existing policy/authorized keys and **appends** the new public key with `restrict,command="/usr/bin/node /usr/local/lib/mahaffeys/management/runner.mjs"`. Existing keys and access are preserved; a key already present is rejected to prevent diagnostics-key reuse.
- Does not modify SSH daemon/firewall settings, assign Docker-group/sudo rights, deploy services, create queues, or send a print job.

Stop/finish outstanding management jobs before upgrading installed modules. A stale `operation.lock` must be reviewed by an administrator; it is never automatically removed remotely, since a disconnected worker may still be running.

## Dyad plugin settings

Keep the existing stdio Command (`node`) and bridge path. Append these two arguments to Args:

- `--enable-management`
- `--management-identity-file` followed by the separate local private-key path, for example `C:\Users\jackh\.ssh\mahaffeys_management`.

Do not provide public-key contents, passwords or private-key contents as arguments. The existing `--identity-file` still selects the separate read-only diagnostics key. Known-hosts verification is shared and remains strict.

After administrator provisioning and argument updates, disable/re-enable the custom plugin to reload its process, then start a new Agent turn. The bridge lists six diagnostics plus four management tools only when management was explicitly enabled with a separate absolute key path. Tool discovery never contacts SSH or starts a job.

## Operation workflow

1. Publish and review the exact intended commit in the existing origin/main history. Approve preparation with that full commit hash and confirmation `RUN VERIFIED TESTS`.
2. Poll the returned job ID. A failed test/manifest gate blocks deployment. Source review and ordinary Vitest/Vite builds are not equivalent to passing the actual server Docker acceptance test.
3. Review the passed report and schedule app/printing downtime. Approve deployment using the passed preparation ID and confirmation `DEPLOY APPROVED PLAN`.
4. Poll the deployment ID. Before replacement, configuration/cache/spool archives are captured from stopped CUPS. Each archive is bounded to 5 GiB and 120 seconds; at least 15 GiB free space is required. An oversized/failed backup blocks replacement and original services are restarted. Tar archives retain ownership for spool restoration without extracting root-owned files onto the host.
5. If replacement or health verification fails, managed services are stopped, backups retained, and explicit recovery is required. Approve rollback using the latest finished deployment ID with confirmation `ROLLBACK DEPLOYMENT`. A rollback restores image/Compose configuration, **not a blind overwrite of saved CUPS policies or queue definitions**. If policy-specific repair is required, the administrator reviews/restores the exact backed-up files separately.
6. Confirm existing queue/device inventory and application behavior after a healthy deployment. Actual paper output remains a separate user-approved test. Stopping/restarting CUPS can cause queued jobs to retry; use a maintenance window and review pending work.

## Revocation and recovery

Remove only the management key's authorized entry and/or set the root-owned policy `enabled` to `false`. Preserve the diagnostics key and all production volumes. Revocation blocks new requests; it does not kill an already running worker. An administrator must review and stop an active operation safely if immediate shutdown is required.

Do not delete job directories, backups, worktrees or pinned images while a deployment/recovery references them. Cleanup is administrator-controlled and never uses a remote broad prune/delete operation. If an external/manual deployment changes recorded container identities, management refuses further preparation/deployment until an administrator reviews the baseline. Do not erase state to conceal failed verification or data-loss risk.
