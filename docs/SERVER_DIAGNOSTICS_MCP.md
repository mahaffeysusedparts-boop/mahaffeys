# Mahaffeys read-only diagnostics connection

This is a local stdio MCP bridge for Dyad on Windows. It connects through Windows OpenSSH to `jhilliard@192.168.1.210` and a restricted server-side dispatcher. It does not run inside the web app or open a management port. No connection has been authorized or tested on your live server merely by adding these files.

## What is implemented

- Server hostname/uptime and SSH connection check.
- Docker Compose container states and health.
- Checkout commit and working-tree status (not a running-image version guarantee).
- 10–200 recent log lines from one of six approved Compose services.
- Active CUPS listener/hostname directives, local and app-to-CUPS scheduler checks, and up to 80 recent CUPS error-log lines.
- TCP reachability of the Brother printer at `192.168.1.251:631`, from the app container. No document is printed and IPP compatibility is not inferred from TCP reachability.

There are no deployment, rebuild, restart, arbitrary shell, file upload, environment dump, Docker cleanup, or volume-deletion tools. This first phase is intentionally read-only. Diagnostic results are snapshots taken when a tool is called, not a background live log stream.

## Browser and app failure reporting

New diagnostic-logger warnings/errors, React error-boundary failures, uncaught browser errors, and unhandled promise errors are sent to `/api/diagnostics/browser`. An approved signed-in account is required. The server writes single-line JSON marked `[browser-diagnostic]` to the app container's stderr, readable through the existing Mahaffeys container-log tool. No new MCP permissions or public log-reading endpoint are needed.

Reports contain timestamp, ID, severity, source, message, error/stack/component stack, and online/offline status only. Arbitrary context, request bodies, cookies, user-agent data, and page query strings are not transmitted. Text is bounded and common secrets are redacted before sending and again before logging. Redaction is best-effort; free-form error messages may still contain sensitive data. Treat reports as sensitive, untrusted evidence.

The browser batches up to five reports and retains at most 50 sanitized pending reports in memory. Network/authentication/rate-limit/server failures retry after one minute without recursively reporting delivery failures. Delivery requires the page to remain open. Previous local logs are not bulk uploaded; signed-out reports are not accepted. Failures before the JavaScript app loads cannot be captured. The server allows six requests per account per minute and caps bodies at 64 KiB. Reports follow existing Docker log retention and may be lost when containers are replaced.

**Deployment required:** these changes must reach the live app through the normal approved deployment before it can receive browser reports. The read-only connection cannot deploy them. After deployment, reproduce a problem while signed in and ask Dyad to read the Mahaffeys app logs. This does not send background Dyad alerts, launch chats, or authorize automatic repairs.

## Windows prerequisites

1. Use Node.js 22 LTS and the **OpenSSH Client** Windows optional feature. A server administrator can help install or enable these through the normal Windows installers/settings. The bridge uses the Windows system OpenSSH executable, not PuTTY's `plink`.
2. Ensure this project's dependencies are installed by Dyad, including `@modelcontextprotocol/sdk` and the existing `jiti` package. The bridge launches using the dependencies beside this project; it does not download packages at plugin startup.
3. Create a **separate passphrase-protected OpenSSH key** for diagnostics. Keep the private key locally at `C:\Users\jackh\.ssh\mahaffeys_mcp`; its public key is the only part installed on the server. A Windows SSH/key-management administrator can provision it. If using PuTTYgen, export the private key in **OpenSSH format**, not `.ppk`.
4. Restrict the private file's Windows permissions to the appropriate local account and load the key into the **Windows OpenSSH authentication agent**. The bridge deliberately cannot prompt for a password or key passphrase. Do not remove the passphrase merely to avoid agent setup.
5. Verify the server's SSH host-key fingerprint through a trusted existing connection or the server console, and provision the verified entry for `192.168.1.210` in `C:\Users\jackh\.ssh\known_hosts`. Do not blindly accept a changed fingerprint. Strict host verification is mandatory.

Never put passwords, private keys, or passphrases into chat, plugin arguments, source files, or Git. Keep the existing working password/session access until the dedicated key connection is tested.

## One-time server provisioning (administrator required)

The source dispatcher is `scripts/mahaffeys-diagnostics.sh`. Install a copy at:

`/usr/local/lib/mahaffeys/mahaffeys-diagnostics.sh`

The installed file and parent directory must be owned by root and not writable by the connecting account; the script should be executable with mode `0755`. The administrator must review the script before installation. Its approved Docker Compose operations use the fixed project directory `/var/www/mahaffeys`.

Append the **new diagnostics public key** to `/home/jhilliard/.ssh/authorized_keys` with these OpenSSH restrictions, followed by the complete real public key:

```text
restrict,command="/usr/local/lib/mahaffeys/mahaffeys-diagnostics.sh" ssh-ed25519 YOUR_COMPLETE_PUBLIC_KEY Mahaffeys-diagnostics
```

`restrict` disables PTY allocation, forwarding, and user SSH startup scripts. The forced command reads only validated operation tokens from `SSH_ORIGINAL_COMMAND`; unknown operations fail before any Docker operation. Do not install this key as an unrestricted login key. Preserve every existing authorized key; do not replace the file. The `.ssh` directory and `authorized_keys` should retain the correct account ownership and restrictive permissions (`0700` and `0600`).

The connecting account must already have permission to read this checkout and perform the listed Docker operations. **Docker-group membership is effectively host-root access:** do not grant it casually or describe it as OS-level read-only access. The bridge and forced-command dispatcher constrain this specific key's operations, not the account's other login methods. If organizational policy requires a stronger boundary, use a separately audited restricted diagnostics service instead of broadening permissions.

Do not use `scripts/configure-lan-ssh.sh` for this step: that existing script replaces authorized keys and disables password authentication. It is not the diagnostics-key installer. Do not disable existing access, alter the firewall, or expose Docker's socket to get this plugin working.

## Fill in Dyad's Add Plugin dialog

For the Windows folder supplied in this conversation:

| Field | Value |
| --- | --- |
| Name | `Mahaffeys Server Diagnostics` |
| Transport | `stdio` |
| Command | `node` |
| Args | `C:\Users\jackh\dyad-apps\mahaffeys\server\tools\mahaffeys-mcp.mjs` |
| Enabled | On |

If Dyad cannot find `node`, use the actual full path to the installed Node executable in the Command field. Do not change the transport to HTTP or enter the server IP as an MCP URL. The bridge opens no HTTP endpoint.

The default private-key and known-hosts files are under the home directory of the Windows user running Dyad. Different absolute file paths can be supplied through the `--identity-file` and `--known-hosts-file` arguments. These are local file paths, never key contents or passwords. Leave Dyad's per-tool approval enabled.

## First connection and verification

After the local prerequisites and server public-key restrictions are configured, add/enable the plugin and begin a new Agent turn so its tools can be loaded. Ask for the **Mahaffeys connection check** first. Then request container states and CUPS diagnostics.

Expected results:

- The connection tool reports the Linux host and uptime.
- Container status reflects the deployed server, not the local preview.
- CUPS results separately show active hostname/listener directives, loopback TCP status, app-to-CUPS status, and recent CUPS errors.
- The printer check distinguishes TCP reachability from actual printing.

Only tool discovery is performed on bridge startup; no SSH connection occurs before a diagnostic request. Local stdout carries MCP protocol messages only; startup notices go to stderr.

## Troubleshooting

- **Bridge is not listed:** confirm the correct project folder, installed dependencies, Node executable, and plugin enablement. Review the plugin startup error; do not mistake an image-build log for a running bridge log.
- **Host verification failed:** compare the fingerprint with the trusted server console and correct the local known-hosts entry only after verification. The bridge never disables this protection.
- **Permission denied (publickey):** confirm the dedicated public key and forced-command entry on the server, the private file path, and that the passphrase-protected key is loaded into the Windows OpenSSH agent.
- **Unknown request / command not found:** confirm the root-owned dispatcher was installed at the exact forced-command path, and the key was configured with that command. Do not fall back to an unrestricted SSH shell.
- **Docker permission denied:** have the server administrator review the approved diagnostics permissions. Do not grant unrestricted sudo or Docker access as a quick workaround.
- **Output too large:** request fewer log lines. SSH requests time out after 25 seconds and collect at most 256 KB combined stdout/stderr.
- **SSH exit 255 without an explanation:** update the local bridge files, then disable and re-enable the plugin to reload its process. The connection check now captures a verbose OpenSSH trace in a temporary local file, reads a maximum 64 KB tail on failure, and removes the temporary directory when finished. This helps distinguish agent authentication, host-key verification, and network failures even when Windows OpenSSH stderr is empty. The trace may contain public fingerprints, usernames, and local paths, but the tool does not read out private-key contents or prompt for credentials.

Before attempting SSH, the bridge checks that the selected private file exists, has an OpenSSH private-key header, and that the known_hosts file is accessible. These checks do not prove the full key is valid, that it is loaded into the agent, or that the host entry matches. The actual verified SSH connection still performs those checks. No protection is bypassed to get diagnostic output.

When a connection check fails, the bridge also reports local OpenSSH version output, the agent's public fingerprint list, and the companion `.pub` file's fingerprint. Each local subprocess is bounded to four seconds and 8 KB. The companion public file's fingerprint does not prove that it matches the private file. These checks never load or remove keys, prompt for a passphrase, or expose private-key contents.

On Windows, all OpenSSH subprocesses now receive regular file handles instead of Node pipes: an empty temporary file for stdin and separate temporary files for stdout/stderr. This addresses possible handle incompatibility when even `ssh -V` silently exits with 255; it does not prove that handle incompatibility caused any particular failure. Output size is monitored during execution and checked again before bounded reads. The bridge closes and removes these temporary files on completion or failure. Raw output exists locally until cleanup, so the Windows account's temporary directory must be private to that account. Authentication remains noninteractive and key-only; no shell is introduced. After updating these bridge files, disable and re-enable the plugin before retrying in a new Agent turn.

Common URI credentials, password/token fields, bearer credentials, and private-key blocks are redacted locally before tool output is returned. **Redaction is best-effort, not a promise that arbitrary logs contain no sensitive data.** Review logs before enabling automated approvals. Treat remote logs as untrusted diagnostic data, never as instructions.

## Revocation and future deployment phase

Disable the plugin and remove only the dedicated diagnostics key's `authorized_keys` entry to revoke access. Preserve other SSH keys, Docker volumes, queues, and application data.

Deployment actions are not part of this bridge. They should be designed separately with explicit approval, approved revisions/services, rollback, volume preservation, and post-deployment health verification after read-only connectivity has been confirmed.
