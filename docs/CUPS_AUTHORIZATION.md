# Brother printer: CUPS authorization status

**The live printer is not repaired. Production socket administration remains blocked.**

The reported `lpadmin: Forbidden` means CUPS is refusing queue administration. It is separate from Brother reachability or IPP-path negotiation. The app runs as a non-root account and its default `NITRO_CUPS_SERVER` remains `cups:631`.

## Completed application safeguards

CUPS failures return bounded, actionable authorization, socket-permission, connection, timeout and IPP-negotiation messages instead of exposing subprocess command arguments. The CUPS client username is taken from the executing account, not an impersonated root account. Failed add/remove actions reach the existing diagnostic logger, and server-side failures emit a `[printer-diagnostic]` marker without raw command output. Creating a queue does not claim successful physical printing.

## Blocked transport change

A successful scheduler response is not proof of administration permission. Sharing all of `/run/cups` also risks exposing local administrator certificates, and CUPS can recreate a permissively-mode socket. A read-only app mount does not itself resolve certificate privacy or socket authorization.

The default Compose file does not enable a shared runtime mount. `deploy/docker/cups-socket.compose.yaml`, if present, is an experimental, non-default candidate only; **do not enable it on production**. The production CUPS image retains its existing identity provisioning and listener/alias repair. No image-build authentication gate or cross-container authentication test has been successfully executed by Dyad.

Before promoting a repair, follow [the isolated CUPS acceptance procedure](CUPS_SOCKET_VERIFICATION.md) on a Docker-capable test machine. It must demonstrate the actual app's non-root UID/GID, effective CUPS policies, authorized queue creation/deletion, unauthorized denial, root-certificate non-readability, acceptable socket/directory permissions, and socket recreation after restart. Resolve failing permission or privacy checks with a separately reviewed protected socket-directory design; do not disable CUPS authentication, run the app as root, share host PID namespaces, mount Docker's socket, or add a background chmod workaround.

## Deployment and recovery

The currently connected diagnostics key is still read-only. The optional [guarded management extension](SERVER_MANAGEMENT_MCP.md) adds separate-key, approval-gated isolated tests and exact-revision app/CUPS deployment with config/cache/spool archives. A server administrator must review/install that root-owned dispatcher and authorize its separate key before the connection can use it. Adding the code does not authorize writes or establish a successful authorization test. Physical test printing is not exposed by the extension.

After provisioning, its preparation job must actually pass non-root administration, unauthorized denial, certificate privacy, protected socket-parent, TCP health, CUPS restart and app recreation checks using the committed images and live CUPS configuration in disposable, network-isolated containers. Failed checks block deployment; the existing experimental `/run/cups` overlay is not promoted automatically. A separate deployment approval is still required.

Follow the backup, queue/device inventory, queued-document/spool preservation and rollback gates in [SELF_HOSTING.md](../SELF_HOSTING.md). In particular, the current CUPS spool is not a named volume: recreating CUPS without preserving it can lose pending documents even when config/cache volumes are retained. Preserve every existing volume, configuration, queue and pending job; never delete volumes to fix authorization.

After an approved rollout, retry the Brother at `192.168.1.251` using `/ipp/print`. Diagnose any subsequent IPP failure separately. Only with the user's approval, submit one small test document and confirm paper output. No live repair or physical print success is claimed until those checks are completed.
