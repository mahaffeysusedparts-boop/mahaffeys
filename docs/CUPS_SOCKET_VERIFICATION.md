# CUPS socket authorization: isolated acceptance procedure

**Status: not executed by Dyad. Production socket transport is blocked.** This procedure tests a candidate identity, not a deployed repair. The available SSH diagnostics connection is read-only and cannot create these containers. An administrator must review and execute this procedure on an isolated Docker test machine, record results, and approve a revised implementation before production configuration changes.

## Findings and assumptions

- The app Dockerfile uses `node:22-bookworm-slim`, runs `USER node`, and installs Debian libcups. Its expected UID/GID is 1000:1000, but measure the built runtime image rather than assuming the tag guarantees it.
- CUPS 2.4.2 Linux source implements client `PeerCred` only when `cupsUser()` resolves to the calling UID. The scheduler uses `SO_PEERCRED` and compares the claimed user's numeric UID against the kernel peer UID, then checks `@SYSTEM` membership. `-U node` is not authentication and must not be used to bypass an identity mismatch.
- Sources: [libcups auth.c](https://github.com/OpenPrinting/cups/blob/v2.4.2/cups/auth.c), [scheduler auth.c](https://github.com/OpenPrinting/cups/blob/v2.4.2/scheduler/auth.c), [scheduler conf.c](https://github.com/OpenPrinting/cups/blob/v2.4.2/scheduler/conf.c). Source support is not proof of the installed binary's behavior.
- Effective `SystemGroup` is configured in `cups-files.conf` on this CUPS generation; do not infer it solely from the repository's legacy `cupsd.conf` directive. Verify installed package versions, both files, group membership and actual authorization.
- Initial target: rootful Linux Docker, no user-namespace remapping, no `user:` override, separate default PID namespaces, Debian Bookworm app/CUPS images. Rootless Docker, remapped UIDs, heterogeneous UID mappings, Snap CUPS, custom LSM restrictions and alternative CUPS versions need separately reviewed and tested designs. Never use host PID/user namespaces or privileged app execution as a workaround.
- CUPS 2.4.2 resets `StateDir` to mode 0755 at startup/reload. CUPS commonly creates its socket with mode 0777. A pre-start chmod cannot guarantee lasting restrictive permissions. **Record actual modes after startup and restart. Do not promote this candidate if the socket is world-writable under the plan's requirements.** A revised design may need a protected socket parent separate from `StateDir` and a reliable recreation strategy; none is approved here. Do not add a race-prone background chmod loop or weaken policies.
- The runtime mount grants container-local printing-administration capability, not host administration. Mount only in app and CUPS; never mount Docker's socket. The app must not be able to read CUPS root certificates. Matching GIDs can accidentally grant certificate access: explicitly test readability without displaying certificate contents.

## Reproducible isolated experiment

The following script is a test-machine procedure, not a production deployment command. It uses unique resources, no Compose production project, no published ports, no network access, no physical printer, and no document submission. It builds the actual app runtime image; only the disposable CUPS image is modified to add the candidate identity and debug evidence. Existing repository Dockerfiles, volumes, and access policies are not edited.

```sh
#!/bin/sh
set -eu
umask 077
work=$(mktemp -d)
suffix="$(date +%s)-$$"
app_image="mahaffeys-cups-proof-app:$suffix"
cups_image="mahaffeys-cups-proof-server:$suffix"
app="mahaffeys-cups-proof-app-$suffix"
cups="mahaffeys-cups-proof-server-$suffix"
runtime="mahaffeys-cups-proof-runtime-$suffix"
config="mahaffeys-cups-proof-config-$suffix"
cache="mahaffeys-cups-proof-cache-$suffix"
# Delete only resources created by this script, never production resources.
cleanup() {
  docker rm -f "$app" "$cups" >/dev/null 2>&1 || true
  docker volume rm "$runtime" "$config" "$cache" >/dev/null 2>&1 || true
  docker image rm "$app_image" "$cups_image" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT HUP INT TERM

docker version --format '{{.Server.Version}}'
docker info --format '{{json .SecurityOptions}}'
# Stop here if rootless/userns is listed; the first candidate does not support it.
security=$(docker info --format '{{json .SecurityOptions}}')
case "$security" in *rootless*|*userns*) echo 'Unsupported namespace configuration; stop.' >&2; exit 1;; esac

docker build --target runtime -t "$app_image" .
uid=$(docker run --rm --network none --entrypoint id "$app_image" -u)
gid=$(docker run --rm --network none --entrypoint id "$app_image" -g)
[ "$uid:$gid" = 1000:1000 ] || { echo 'Actual app identity differs; revise candidate.' >&2; exit 1; }

cp deploy/docker/cups.Dockerfile "$work/cups.Dockerfile"
# This adds an identity in the disposable server ONLY. No password/login shell.
printf '\nRUN groupadd --gid 1000 node && useradd --uid 1000 --gid node --no-create-home --shell /usr/sbin/nologin node && usermod -aG lpadmin node\nRUN grep -Eq "^SystemGroup[[:space:]].*lpadmin" /etc/cups/cups-files.conf\nRUN printf "\\nLogLevel debug\\n" >> /etc/cups/cupsd.conf\n' >> "$work/cups.Dockerfile"
docker build -f "$work/cups.Dockerfile" -t "$cups_image" .
for volume in "$runtime" "$config" "$cache"; do docker volume create "$volume" >/dev/null; done

docker run -d --name "$cups" --network none \
  --mount "type=volume,src=$runtime,dst=/run/cups" \
  --mount "type=volume,src=$config,dst=/etc/cups" \
  --mount "type=volume,src=$cache,dst=/var/cache/cups" "$cups_image"
start_app() {
  docker run -d --name "$app" --network none \
    --mount "type=volume,src=$runtime,dst=/run/cups,readonly" \
    --entrypoint /bin/sh "$app_image" -c 'exec sleep 600'
}
start_app
wait_scheduler() {
  count=0
  until docker exec "$app" env LC_ALL=C timeout 5 lpstat -h /run/cups/cups.sock -r; do
    count=$((count + 1)); [ "$count" -lt 20 ] || return 1
    sleep 1
  done
}
wait_scheduler

docker exec "$app" id
docker exec "$app" dpkg-query -W cups libcups2
docker exec "$cups" id node
docker exec "$cups" dpkg-query -W cups libcups2
docker exec "$cups" sh -c 'grep -nE "^[[:space:]]*(SystemGroup|User|Group|StateDir)([[:space:]]|$)" /etc/cups/cups-files.conf /etc/cups/cupsd.conf'
docker exec "$cups" cupsd -t
docker inspect --format 'user={{.Config.User}} userns={{.HostConfig.UsernsMode}} pid={{.HostConfig.PidMode}}' "$app" "$cups"
docker exec "$app" sh -c 'test "$(id -u)" = 1000 && test "$(id -g)" = 1000 && test ! -r /run/cups/certs/0'
docker exec "$cups" stat -c '%n uid=%u gid=%g mode=%a type=%F' /run/cups /run/cups/cups.sock
# Loopback TCP remains available, independent of app socket transport.
docker exec "$cups" env LC_ALL=C timeout 5 lpstat -h 127.0.0.1:631 -r

# A raw, disabled queue isolates authorization from driver/IPP negotiation.
# No -E, no lp/lpr, no network printer, no test page.
docker exec "$app" env LC_ALL=C timeout 10 lpadmin -h /run/cups/cups.sock \
  -p peer_proof -v socket://127.0.0.1:9 -m raw
docker exec "$app" env LC_ALL=C timeout 5 lpstat -h /run/cups/cups.sock -v peer_proof
# Require evidence of PeerCred, not successful fallback to a Local root certificate.
docker exec "$cups" sh -c 'grep "Authorized as node using PeerCred" /var/log/cups/error_log | tail -n 5'
# grep through a pipeline can mask absence; independently assert the evidence.
docker exec "$cups" grep -q 'Authorized as node using PeerCred' /var/log/cups/error_log

# Unauthorized identity can reach the scheduler but cannot administer the queue.
docker exec --user 65534:65534 "$app" env LC_ALL=C timeout 5 lpstat -h /run/cups/cups.sock -r
if docker exec --user 65534:65534 "$app" env LC_ALL=C timeout 10 \
  lpadmin -h /run/cups/cups.sock -x peer_proof >"$work/denied" 2>&1; then
  echo 'Unauthorized identity removed queue; STOP.' >&2; exit 1
fi
grep -Ei 'forbidden|unauthorized|not.authorized|authorization|password' "$work/denied"
docker exec "$app" env LC_ALL=C timeout 5 lpstat -h /run/cups/cups.sock -v peer_proof

# Restart server (new socket) and recreate app, keeping only test volumes.
docker restart "$cups"
docker rm -f "$app"
start_app
wait_scheduler
docker exec "$app" sh -c 'test "$(id -u)" = 1000 && test ! -r /run/cups/certs/0'
docker exec "$cups" stat -c '%n uid=%u gid=%g mode=%a type=%F' /run/cups /run/cups/cups.sock
docker exec "$cups" env LC_ALL=C timeout 5 lpstat -h 127.0.0.1:631 -r
docker exec "$app" env LC_ALL=C timeout 10 lpadmin -h /run/cups/cups.sock -x peer_proof
docker exec "$app" env LC_ALL=C timeout 10 lpadmin -h /run/cups/cups.sock \
  -p peer_recreated -v socket://127.0.0.1:9 -m raw
docker exec "$app" env LC_ALL=C timeout 10 lpadmin -h /run/cups/cups.sock -x peer_recreated
# Required permission gate: CUPS defaults may FAIL this despite valid PeerCred.
docker exec "$cups" sh -c 'mode=$(stat -c %a /run/cups/cups.sock); case "$mode" in *[2367]) echo "World-writable socket: revise design; not approved for rollout." >&2; exit 1;; esac'
echo 'Disposable identity/restart checks passed. Still requires policy review and approved production implementation/rollout.'
```

Keep a sanitized verification report recording revision, Docker/security options, image IDs/digests, package versions, numeric identities, runtime/socket modes, root-certificate non-readability, authorized queue create/delete, unauthorized denial, queue persistence/recreation, and TCP/socket scheduler results. Record failed checks rather than calling them passed. Do not copy raw authentication headers or certificate contents into the report.

## Acceptance before promotion

1. Demonstrate all checks above, including denial and recreation, with the final candidate permissions and the same Docker namespace/LSM configuration intended for deployment. Source review or a unit mock is insufficient.
2. Review effective deployed `cups-files.conf`, `cupsd.conf`, default/queue policies and identity; copying a fresh image configuration over `cups-config` is prohibited. Repeat the isolated test with a private copy of the actual policy/configuration, removing queue fixtures so no physical printer can be contacted.
3. Resolve the socket permission invariant in the revised design. Keep the app non-root and preserve access/auth rules, persistent config, queued documents and TCP publication/health checks.
4. Only then add the dedicated CUPS identity and runtime volume to production Docker/Compose configuration. Mount the directory rather than the socket. Keep `cups-config` and `cups-data`; do not repurpose/delete them.
5. Follow the approved backup/inventory/rollback steps in SELF_HOSTING.md. Live queue creation and physical print approval are separate gates.
