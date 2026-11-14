# Enable read-only Ubuntu storage diagnostics

## What this enables — and what it does not

This adds a seventh read-only operation to the existing Mahaffeys SSH connection. It reports:

- Host block devices and partitions: sizes, filesystem types, UUIDs and mount points.
- Capacity/free/available bytes for mounted block-device paths, Ubuntu's root filesystem, Docker's data directory, and the app's mounted storage paths.
- Docker's actual data directory on the local daemon.
- Existing app container mount sources and destinations, including PostgreSQL, vision images and printing storage.

It does **not** pool disks, format or mount anything, migrate data, stop containers, back up databases, change SSH keys, grant sudo/Docker privileges, or increase usable app capacity. Storage migration requires a separate reviewed plan after the report is available. The existing guarded app/CUPS management connection cannot migrate database volumes.

## Requirements

- Ubuntu host administration through your existing trusted SSH session. Keep that session/access available.
- Host Node.js 22 or newer at `/usr/bin/node` (Node inside a Docker container does not count).
- Ubuntu's existing util-linux utilities (`lsblk`), coreutils (`timeout`), and Docker Compose v2.
- The existing `jhilliard` account, its existing approved local Docker access, and the already-installed restricted diagnostics key/dispatcher.
- The current project files on both the Ubuntu host and the computer running Dyad. Installing these repository changes into the web app image alone will not upgrade the host dispatcher or local plugin.
- Administrator review of the helper, dispatcher and installer before installation. Source files are trusted administrator-executed code.

Do not add the account to the Docker group or grant unrestricted sudo to solve a failed prerequisite. Docker access is effectively host-root. Do not change SSH daemon settings, remove the forced-command restriction, expose Docker's socket, or share private keys in chat.

## Code files

| Repository source | Purpose | Installed host destination |
| --- | --- | --- |
| `server/tools/storageDiagnostics.mjs` | Fixed, bounded read-only report | `/usr/local/lib/mahaffeys/storage-report.mjs` |
| `scripts/mahaffeys-diagnostics.sh` | Existing forced-command dispatcher, now accepts the fixed `storage` token | `/usr/local/lib/mahaffeys/mahaffeys-diagnostics.sh` |
| `scripts/install-mahaffeys-storage-diagnostics.mjs` | Guarded interactive administrator installer | Remains in the reviewed repository |
| `server/tools/sshDiagnostics.ts` | Validates and sends the fixed request token | Local Dyad project |
| `server/tools/mahaffeys-mcp.ts` | Registers the new read-only report | Local Dyad project |

The existing `server/tools/mahaffeys-mcp.mjs` launcher remains unchanged. The report and installer use built-in Node modules; no additional npm dependency is needed.

## Installation sequence

1. **Make the reviewed revision available on the server.** Place the repository files above in their corresponding paths under `/var/www/mahaffeys`, including the installer at `/var/www/mahaffeys/scripts/install-mahaffeys-storage-diagnostics.mjs`. Use your existing trusted repository/file-transfer workflow; do not upload private keys or replace the server's `.env`. Preserve unrelated changes and data.
2. **Review prerequisites and source.** Confirm the host Node interpreter, utilities, existing restricted key, existing Docker access and root-owned installation directory. The installer refuses symlinks, unsafe permissions, absent existing dispatcher/key and unsupported host prerequisites; it does not repair them by granting access.
3. **Administrator installation.** The installation entry point is the reviewed `scripts/install-mahaffeys-storage-diagnostics.mjs` file, interpreted by host `/usr/bin/node`, with root privileges in an interactive terminal and no arguments. Arrange execution through your approved administrator workflow; it cannot be launched through the restricted diagnostics connection. No passwords or key material are passed to it.
4. **Approve only the intended upgrade.** The installer prompts for exactly `ENABLE STORAGE DIAGNOSTICS`. Any other response cancels without replacing installed files. It privately backs up previous installed files, installs the helper first, then atomically replaces the dispatcher. The helper is root-owned mode `0644`; the dispatcher is root-owned mode `0755`. If replacement fails, it attempts to restore the prior files and reports whether recovery completed. Retain the printed private backup directory.
5. **Keep SSH configuration unchanged.** The existing authorized-key entry and forced-command path remain unchanged. The installer reads the existing entry to verify the prerequisite but never edits `authorized_keys`, keys, account groups, the firewall or the SSH daemon. Existing management modules remain untouched.
6. **Reload the local plugin.** Confirm Dyad points at the updated local project's `server/tools/mahaffeys-mcp.mjs`. In Dyad's plugin settings, keep the existing name, stdio transport, interpreter, key paths, host verification and any separate management arguments. No storage flag or new key is required. Disable/re-enable the existing custom plugin and start a new Agent turn so capabilities are rediscovered. Keep per-operation approvals enabled.
7. **Request the storage report.** In the new turn, ask: “Read my server storage report and identify which drive holds the app database and images.” Tool discovery alone does not test live access. A live report must be requested and reviewed before migration planning.

## Report interpretation and safety

- Device capacity is not filesystem free space. An unmounted drive is not usable by the app just because it appears in inventory.
- Multiple paths can share one filesystem: do not sum their capacity/free-space figures. `realPath` resolves symlinks but does not make distinct filesystems.
- `usedBytes` excludes all free blocks. `availableBytes` is the filesystem's generally available capacity; root-reserved blocks can make it smaller than `freeBytes`. These figures are not a guarantee against user quotas, container limits or concurrent changes.
- Container mount metadata is deliberately selected rather than returning full container/volume inspection data. No environment values, Compose resolved configuration, database contents, file contents or volume driver options are returned.
- Reports contain device paths, filesystem UUIDs and application paths. Treat them as sensitive. Do not publish them unreviewed.
- The daemon address is fixed to the local Unix socket; inherited Docker host variables cannot redirect the probe. The report accepts no arguments, commands, service names or user-selected paths.
- Each subprocess is capped at three seconds/64 KiB, the installed operation has an 18-second wall-clock limit, and report output is capped at 192 KiB within the bridge's existing 256 KiB cap. The report inspects at most 16 project containers, 32 mounts per container and 128 block devices for mounted-path statistics.

## Troubleshooting

- **New report absent:** update the local bridge files, then reload the plugin and use a new Agent turn. Updating only the Ubuntu files is insufficient.
- **Unknown request:** the host still has the old dispatcher. Review/install the new helper and dispatcher; do not remove the forced command.
- **Host Node missing or too old:** administrator provisioning of host Node.js 22+ is required; app-container Node is not sufficient.
- **Docker access unavailable:** review existing account permissions and local daemon status. Do not grant broad access as a shortcut. Other report sections may still be available.
- **Filesystem inaccessible:** the report marks that path unavailable rather than inventing capacity. Administrator review is needed; do not loosen filesystem permissions globally.
- **Partial errors:** review the successful sections and error classifications. Errors do not prove a drive is unused.
- **Timed out:** review host/daemon responsiveness. No migration occurred and no storage cleanup is performed.

Installing this feature is not a production storage migration. Do not format `/dev/sda`, modify volume mappings or delete old data based only on its advertised 1.8 TB size.
