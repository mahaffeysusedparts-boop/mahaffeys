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
        printf '%s\n' '=== CUPS administrative group settings and container-local node identity ==='
        docker compose exec -T cups sh -c 'grep -nE "^[[:space:]]*(SystemGroup|User|Group|StateDir)([[:space:]]|$)" /etc/cups/cups-files.conf /etc/cups/cupsd.conf | head -n 30; id node 2>/dev/null || printf "%s\n" "No container-local node identity is provisioned."; dpkg-query -W cups libcups2' || printf '%s\n' 'Could not inspect CUPS identity/settings.'
        printf '%s\n' '=== Local CUPS TCP scheduler ==='
        docker compose exec -T cups env LC_ALL=C timeout 6 lpstat -h 127.0.0.1:631 -r || printf '%s\n' 'Local scheduler check failed.'
        printf '%s\n' '=== App-to-CUPS configured scheduler (not an administration test) ==='
        docker compose exec -T mahaffeys node -e 'const {execFileSync}=require("node:child_process"); const fs=require("node:fs"); const server=process.env.NITRO_CUPS_SERVER; console.log("App UID/GID: "+process.getuid()+":"+process.getgid()); if(server!=="/run/cups/cups.sock" && server!=="/var/run/cups/cups.sock" && server!=="/run/mahaffeys-cups/cups.sock" && server!=="cups:631"){console.error("Configured CUPS address is outside this read-only probe allowlist; no probe sent.");process.exit(1);} console.log("Transport: "+(server.startsWith("/")?"Unix socket":"TCP")); if(server.startsWith("/")){try{for(const path of [server==="/run/mahaffeys-cups/cups.sock"?"/run/mahaffeys-cups":"/run/cups",server]){const s=fs.statSync(path);console.log(path+" uid="+s.uid+" gid="+s.gid+" mode="+(s.mode&4095).toString(8)+" socket="+s.isSocket());}}catch{console.error("CUPS runtime directory/socket is not accessible.");process.exit(1);}} try{const status=execFileSync("lpstat",["-h",server,"-r"],{env:{...process.env,LC_ALL:"C"},timeout:6000,maxBuffer:8192,stdio:["ignore","pipe","pipe"]}).toString().trim();if(status!=="scheduler is running")throw new Error();console.log(status);}catch{console.error("Configured app-to-CUPS scheduler check failed. Inspect transport, permissions and service health; administration has not been tested.");process.exit(1);}' || printf '%s\n' 'App-to-CUPS scheduler check failed.'
        printf '%s\n' '=== Recent CUPS error log (up to 80 lines) ==='
        docker compose exec -T cups sh -c 'if [ -r /var/log/cups/error_log ]; then tail -n 80 /var/log/cups/error_log; else printf "%s\n" "CUPS error log is not readable at /var/log/cups/error_log."; fi' || printf '%s\n' 'Could not read the CUPS error log.'
        ;;
    printer)
        docker compose exec -T mahaffeys node -e 'const net = require("node:net"); const socket = net.createConnection({host:"192.168.1.251",port:631}); socket.setTimeout(5000); socket.once("connect",()=>{console.log("Brother printer TCP port 631 is reachable from the app container. IPP compatibility and printing have not been tested.");socket.end();}); socket.once("timeout",()=>{console.error("Printer TCP check timed out.");socket.destroy();process.exitCode=1;}); socket.once("error",error=>{console.error("Printer TCP check failed: "+error.message);process.exitCode=1;});'
        ;;
esac
