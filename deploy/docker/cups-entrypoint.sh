#!/bin/sh
set -eu

config=/etc/cups/cupsd.conf
backup=

log() {
    printf '%s\n' "cups-entrypoint: $*" >&2
}

restore_and_stop() {
    if [ -n "$backup" ]; then
        if cp -p "$backup" "$config"; then
            log "Restored $config from $backup."
        else
            log "ERROR: Could not restore $config; recover it manually from $backup before restarting."
        fi
    fi
    log "ERROR: CUPS startup stopped. Inspect the errors above and the saved configuration; do not delete cups-config or relax authentication/access rules."
    exit 1
}

if [ ! -f "$config" ]; then
    log "ERROR: $config is missing. Recover the active configuration in cups-config before restarting."
    exit 1
fi

# Repair only the known local-socket configuration, never deliberate TCP listeners.
listener_state=$(awk '
    /^[[:space:]]*#/ { next }
    {
        directive = tolower($1)
        if (directive == "port" || directive == "sslport" || directive == "ssllisten") {
            other_listener = 1
        } else if (directive == "listen") {
            if ($2 == "/var/run/cups/cups.sock" || $2 == "/run/cups/cups.sock") {
                local_socket = 1
            } else {
                other_listener = 1
            }
        }
    }
    END { print (local_socket && !other_listener) ? "socket-only" : "preserve" }
' "$config")

if [ "$listener_state" = socket-only ]; then
    if ! backup=$(mktemp "${config}.before-tcp-631.XXXXXX"); then
        log "ERROR: Cannot create a backup in /etc/cups; check cups-config permissions and free space. No listener changes made."
        exit 1
    fi
    if ! cp -p "$config" "$backup"; then
        log "ERROR: Cannot back up $config to $backup; no listener changes made."
        exit 1
    fi
    log "Backed up socket-only configuration to $backup."
    if ! printf '\n# TCP listener added by cups-entrypoint for the shared print service.\nPort 631\n' >> "$config"; then
        restore_and_stop
    fi
    log "Added Port 631; retained the Unix socket and all existing settings."
else
    log "Preserving existing listener configuration without modification."
fi

# CUPS validates HTTP Host headers; the app connects using the Compose service name.
alias_present=$(awk '
    /^[[:space:]]*#/ { next }
    {
        directive = tolower($1)
        if (directive == "servername" || directive == "serveralias") {
            for (i = 2; i <= NF; i++) {
                if ($i ~ /^#/) break
                if (tolower($i) == "cups" || (directive == "serveralias" && $i == "*")) {
                    found = 1
                }
            }
        }
    }
    END { print found ? "yes" : "no" }
' "$config")

if [ "$alias_present" = no ]; then
    if [ -z "$backup" ]; then
        if ! backup=$(mktemp "${config}.before-serveralias-cups.XXXXXX"); then
            log "ERROR: Cannot create a configuration backup; no hostname changes made."
            exit 1
        fi
        if ! cp -p "$config" "$backup"; then
            log "ERROR: Cannot back up $config to $backup; no hostname changes made."
            exit 1
        fi
        log "Backed up configuration to $backup."
    fi
    if ! printf '\n# Accept the exact Docker service hostname without allowing arbitrary hosts.\nServerAlias cups\n' >> "$config"; then
        restore_and_stop
    fi
    log "Added ServerAlias cups; authentication and network access rules remain unchanged."
else
    log "Existing configuration already accepts the cups service hostname."
fi

# Opt-in candidate: expose only a socket, never CUPS's StateDir/certificates.
if [ "${CUPS_PROTECTED_SOCKET:-0}" = 1 ]; then
    transport=/run/mahaffeys-cups
    socket=$transport/cups.sock
    if [ -L "$transport" ] || [ ! -d "$transport" ] ||
        ! awk -v path="$transport" '$5 == path { found = 1 } END { exit !found }' /proc/self/mountinfo; then
        log "ERROR: Protected transport must be a separately mounted directory."
        restore_and_stop
    fi
    if [ -n "$(find "$transport" -mindepth 1 -maxdepth 1 ! -name cups.sock -print -quit)" ] ||
        [ -L "$socket" ] || { [ -e "$socket" ] && { [ ! -S "$socket" ] || [ "$(stat -c %u "$socket")" != 0 ]; }; }; then
        log "ERROR: Protected transport contains unexpected files; refusing to expose them."
        restore_and_stop
    fi
    if [ "$(id -u node):$(id -g node)" != 1000:1000 ] ||
        ! id -nG node | tr ' ' '\n' | grep -qx lpadmin ||
        ! awk '
            /^[[:space:]]*#/ { next }
            tolower($1) == "systemgroup" {
                found = 0
                for (i = 2; i <= NF && $i !~ /^#/; i++) if ($i == "lpadmin") found = 1
            }
            END { exit !found }
        ' /etc/cups/cups-files.conf; then
        log "ERROR: Expected node UID/GID and existing lpadmin SystemGroup are required; no policy changes made."
        restore_and_stop
    fi
    if ! awk -v path="$transport" '
        /^[[:space:]]*#/ { next }
        tolower($1) == "statedir" && ($2 == path || index($2, path "/") == 1) { unsafe = 1 }
        END { exit unsafe }
    ' /etc/cups/cups-files.conf "$config"; then
        log "ERROR: CUPS state/certificates must not use the shared socket directory."
        restore_and_stop
    fi
    # CUPS recreates the socket, but does not manage this separate parent.
    if ! chown 0:1000 "$transport" || ! chmod 0750 "$transport"; then
        restore_and_stop
    fi
    if ! awk -v socket="$socket" '
        /^[[:space:]]*#/ { next }
        tolower($1) == "listen" && $2 == socket { found = 1 }
        END { exit !found }
    ' "$config"; then
        if [ -z "$backup" ]; then
            backup=$(mktemp "${config}.before-protected-socket.XXXXXX") || restore_and_stop
            cp -p "$config" "$backup" || restore_and_stop
            log "Backed up configuration to $backup."
        fi
        printf '\n# Protected local peer-credential transport; policies remain unchanged.\nListen %s\n' "$socket" >> "$config" || restore_and_stop
    fi
    log "Protected socket listener configured; CUPS access/authentication policies unchanged."
fi

if ! cupsd -t -c "$config"; then
    restore_and_stop
fi

exec cupsd -f -c "$config"
