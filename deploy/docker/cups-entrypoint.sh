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

if ! cupsd -t -c "$config"; then
    restore_and_stop
fi

exec cupsd -f -c "$config"
