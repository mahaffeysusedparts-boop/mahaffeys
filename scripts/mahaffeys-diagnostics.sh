#!/bin/sh
# Install as a root-owned forced-command dispatcher for a dedicated SSH key.
set -eu
PATH=/usr/bin:/bin
export PATH
unset CDPATH ENV BASH_ENV
export LC_ALL=C

request=${SSH_ORIGINAL_COMMAND:-}
case "$request" in
    connection|containers|version|cups|printer) ;;
    logs:*)
        fields=${request#logs:}
        service=${fields%%:*}
        lines=${fields#*:}
        case "$service" in
            mahaffeys|cups|nginx|postgres|storage-agent|vision-worker) ;;
            *) printf '%s\n' 'Unknown diagnostic service.' >&2; exit 2 ;;
        esac
        case "$lines" in
            ''|*[!0-9]*) printf '%s\n' 'Invalid log line count.' >&2; exit 2 ;;
        esac
        if [ "${#lines}" -gt 3 ] || [ "$lines" -lt 10 ] || [ "$lines" -gt 200 ]; then
            printf '%s\n' 'Log line count must be between 10 and 200.' >&2
            exit 2
        fi
        ;;
    *) printf '%s\n' 'Unknown request. Only the Mahaffeys read-only diagnostics protocol is supported.' >&2; exit 2 ;;
esac

if [ "$request" = connection ]; then
    hostname
    uname -s
    uptime
    exit 0
fi

cd /var/www/mahaffeys
case "$request" in
    containers)
        exec docker compose ps --all --format json
        ;;
    version)
        printf '%s\n' 'Checkout commit (not necessarily the running image version):'
        git rev-parse HEAD
        printf '%s\n' 'Working tree status:'
        git status --short
        ;;
    logs:*)
        exec docker compose logs --no-color --timestamps --tail "$lines" "$service"
        ;;
    cups)
        printf '%s\n' '=== Active CUPS listeners and accepted hostnames ==='
        docker compose exec -T cups sh -c 'grep -nE "^[[:space:]]*(Port|Listen|SSLListen|SSLPort|ServerAlias|ServerName)([[:space:]]|$)" /etc/cups/cupsd.conf' || printf '%s\n' 'Could not read CUPS configuration.'
        printf '%s\n' '=== Local CUPS TCP scheduler ==='
        docker compose exec -T cups env LC_ALL=C lpstat -h 127.0.0.1:631 -r || printf '%s\n' 'Local scheduler check failed.'
        printf '%s\n' '=== App-to-CUPS TCP scheduler ==='
        docker compose exec -T mahaffeys env LC_ALL=C lpstat -h cups:631 -r || printf '%s\n' 'App-to-CUPS scheduler check failed.'
        printf '%s\n' '=== Recent CUPS error log (up to 80 lines) ==='
        docker compose exec -T cups sh -c 'if [ -r /var/log/cups/error_log ]; then tail -n 80 /var/log/cups/error_log; else printf "%s\n" "CUPS error log is not readable at /var/log/cups/error_log."; fi' || printf '%s\n' 'Could not read the CUPS error log.'
        ;;
    printer)
        docker compose exec -T mahaffeys node -e 'const net = require("node:net"); const socket = net.createConnection({host:"192.168.1.251",port:631}); socket.setTimeout(5000); socket.once("connect",()=>{console.log("Brother printer TCP port 631 is reachable from the app container. IPP compatibility and printing have not been tested.");socket.end();}); socket.once("timeout",()=>{console.error("Printer TCP check timed out.");socket.destroy();process.exitCode=1;}); socket.once("error",error=>{console.error("Printer TCP check failed: "+error.message);process.exitCode=1;});'
        ;;
esac
