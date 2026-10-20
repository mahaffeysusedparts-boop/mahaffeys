# CUPS authorization for shared network printers

## What changed

`lpadmin: Forbidden` while adding the Brother at `192.168.1.251` is an app-to-CUPS authorization failure, not evidence of a wrong printer path. The default Compose deployment now uses `/run/cups/cups.sock` instead of unauthenticated TCP administration.

- The app still runs as `node`, UID/GID **1000:1000**; its image build verifies these IDs.
- The CUPS image defines a locked, non-login `node` account with matching IDs and membership in its container-local `lpadmin` group.
- Only the app and CUPS mount the `cups-runtime` named volume at `/run/cups`. The app mount is read-only; connecting to the socket does not require writing the socket file.
- libcups uses the executing account name, explicitly supplied through `CUPS_USER`, rather than an inherited username or an impersonated root identity. Linux peer credentials authenticate the numeric UID; CUPS checks its local account/group database for authorization.
- Existing `AuthType`, `Require`, LAN access restrictions, and queue/config/cache volumes remain unchanged. The TCP listener and health probe remain for existing diagnostics.
- Entrypoint validation stops startup if the matching identity, Unix listener, or `lpadmin` in `cups-files.conf`'s `SystemGroup` is missing. It does not silently widen a customized policy.

This grants the app printing administration inside the CUPS container, not host administration. The app's add/remove APIs remain administrator-only. Do not mount the runtime directory into unrelated services, expose a Docker socket, run the app as root, remove CUPS authentication, or make runtime directories world-writable.

## Verification gates

The CUPS Docker image build runs `deploy/docker/cups-auth-check.sh` inside the fresh image. It starts the packaged scheduler, proves the UID 1000 account can create/remove a disposable raw queue, verifies an unrelated account is denied, stops the scheduler, and removes test configuration. No network printer is contacted, no job is submitted, and no production volume is mounted. This script is removed from the runtime image. A failed check prevents that image build from succeeding.

The opt-in Vitest case `server/tools/cupsSocket.integration.test.ts` tests separate Linux containers, a shared runtime volume with a read-only client mount, authorized and unauthorized identities, and scheduler restart/socket recreation. It is enabled in a dedicated Docker-capable test environment by setting `MAHAFFEYS_CUPS_INTEGRATION=1` for the test process. Resources have random test-only names, no published ports, and no production volumes. The test builds only the CUPS image, creates/removes test queues, and removes its own resources afterward. Docker image builds and this opt-in test are **not** implied by a passing ordinary Vite/Nitro production build.

Before rollout, an administrator must run this disposable-container integration case on the deployment's Docker platform. Standard rootful Linux Docker with consistent UID mappings is the intended configuration. Rootless Docker, mismatched user namespaces, custom CUPS policies, AppArmor constraints, and future CUPS peer-credential restrictions must be verified rather than bypassed. If the integration or image-build authorization check fails, stop the rollout and diagnose the output; do not turn authentication off.

## Non-destructive rollout

1. Schedule a short printing/app maintenance window. Record current app/CUPS image revisions and the exact resolved Compose volume names. Back up the existing `cups-config` and `cups-data` volumes; retain queue names/device URIs and pending-job inventory separately. Include any custom policy configuration in the backup.
2. Verify the saved `/etc/cups/cups-files.conf` includes the intended administrative group `lpadmin` in `SystemGroup`, and the saved `cupsd.conf` retains `/run/cups/cups.sock` or `/var/run/cups/cups.sock`. If either is intentionally customized, have the administrator review it rather than replacing the file or deleting the configuration volume.
3. Build the updated **CUPS and app images**, including the CUPS image authorization gate and the app UID/GID assertions. The earlier CUPS-only listener/alias rollout is insufficient for this fix.
4. Recreate both services with the updated Compose mounts and app `NITRO_CUPS_SERVER`. Preserve PostgreSQL, images, `cups-config`, and `cups-data` volumes. Do not delete volumes or reset queues. CUPS startup validation and its existing TCP health check must pass.
5. Reinstall the reviewed `scripts/mahaffeys-diagnostics.sh` at the root-owned forced-command path if its diagnostic updates are wanted. Updating the repository copy alone does not update the installed dispatcher. Preserve the restricted SSH key and read-only permissions.
6. Use the CUPS diagnostic check to verify the app UID/GID, CUPS-local identity/groups, effective system-group settings, socket availability and permissions, and scheduler connectivity through the app's configured socket. Scheduler connectivity is **not** an administration test.
7. Compare the existing queues and device URIs against the pre-rollout inventory. Existing queues must remain intact. Retry adding the Brother in Settings with host `192.168.1.251` and path `/ipp/print`. If authorization passes but IPP negotiation fails, investigate that separate failure before changing drivers, address, or protocol.
8. Only with the user's approval, submit one small test document and confirm paper output. Queue creation/job acceptance alone must not be reported as successful printing.

Application failures return actionable bounded messages rather than subprocess command arguments. Failed add/remove actions are recorded by the browser diagnostic logger, and server-side CUPS command failures produce a `[printer-diagnostic]` marker without raw command output. Use the restricted CUPS error-log reader for detailed scheduler evidence.

## Rollback

Stop/recreate only the affected app/CUPS services using their recorded earlier images and earlier Compose transport/mount configuration. Keep all existing volumes and queues. Restoring the old TCP transport may reproduce the old authorization failure; it is a rollback, not a security workaround.

Identity provisioning is image-local. This authorization change does not replace saved policy files. If the existing entrypoint also applied a listener/alias migration, its separately logged configuration backup must be restored using the existing configuration-repair rollback procedure while CUPS is stopped. Never restore an entire old configuration volume over newly changed queues without reviewing that data loss risk. Leave production printing stopped if authorization cannot be verified safely.
