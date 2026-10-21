# Brother printer: CUPS authorization status

**A protected-socket repair candidate is implemented in the repository. Live authorization and physical printing are NOT verified. Do not deploy it until guarded server tests pass.**

The app's reported authorization error is separate from Brother reachability or IPP negotiation. The previously running app used `cups:631`; TCP scheduler health does not establish permission to administer queues.

## Repair candidate

The candidate Compose configuration uses `/run/mahaffeys-cups/cups.sock` and a dedicated `cups-transport` named volume. CUPS mounts it writable; the non-root app mounts it read-only. The parent is root-owned, group 1000, mode 0750, separate from CUPS StateDir. CUPS may recreate a permissively-mode socket, but cannot grant access through this protected parent to other groups. No certificates or other files are shared.

The CUPS image provisions a locked, non-login `node` identity with UID/GID 1000:1000 and lpadmin membership. Startup checks the existing effective `cups-files.conf` SystemGroup and refuses incompatible configurations rather than broadening access. It adds only the missing socket listener, retaining TCP, hostname, authentication and access policies. Active configuration is backed up before modification and validated with `cupsd -t`; invalid changes are restored. The app continues using its actual non-root username for CUPS PeerCred authentication.

## Verification and deployment gates

Guarded preparation must use the exact published revision with the reviewed installed management modules. The manifest comparator now compares repository-relative build contexts for unchanged services across live/test checkouts, while retaining exact checks for all other fields, mounts, Dockerfiles and unrelated services. It rejects contexts outside a checkout. This addresses the path-related false mismatch without permitting database/proxy deployment.

Preparation copies the live CUPS configuration into disposable, network-isolated containers. It must demonstrate app UID/GID, protected directory ownership/permissions, socket-only contents, PeerCred log evidence, unauthorized denial, actual root-certificate existence and non-readability, TCP scheduler health, CUPS restart and app recreation. Test queues remain disabled and have no physical printer; no document is submitted. Debug logging is confined to the disposable configuration.

**The root-owned installed dispatcher does not update when repository files change.** An administrator must review and refresh the installed management modules before these revised checks can run. Finish outstanding jobs first. The connection cannot modify its own trusted dispatcher. See [SERVER_MANAGEMENT_MCP.md](SERVER_MANAGEMENT_MCP.md).

Once the new revision is published and preparation succeeds, a separate deployment approval is required. Use the guarded app/CUPS-only rollout, which captures private config/cache/spool backups while services are stopped and restores queued-document spool before the replacement CUPS starts. Preserve all existing volumes, queues and documents. Do not use a general Compose redeploy as a substitute: `/var/spool/cups` is still not a named volume, so an unguarded recreation can lose pending documents.

After deployment, compare existing queues/jobs and retry the Brother at `192.168.1.251` using `/ipp/print` in Settings → Shared network printers. Saving a profile proves neither physical printing nor Brother IPP compatibility. Only with separate user approval, submit one small document and confirm actual paper output.

## Prohibited shortcuts

Do not enable the old experimental `/run/cups` overlay, share administrator certificates, disable authentication, run the app as root, mount Docker's socket, share host PID namespaces, delete volumes, or add a background chmod workaround. Failed verification blocks deployment; resolve the specific failure rather than bypassing it.

The detailed preservation and rollback gates are in [SELF_HOSTING.md](../SELF_HOSTING.md). Earlier `/run/cups` experiments in [CUPS_SOCKET_VERIFICATION.md](CUPS_SOCKET_VERIFICATION.md) are historical and are not the current protected-socket acceptance path.
