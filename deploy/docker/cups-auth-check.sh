#!/bin/sh
# Build-time only: prove packaged CUPS authenticates the non-root application UID.
set -eu
export LC_ALL=C

if [ "${1:-}" != image-build ]; then
    printf '%s\n' 'This check is only for an isolated CUPS image build.' >&2
    exit 1
fi
if [ -f /etc/cups/printers.conf ] && grep -q '<Printer\|<DefaultPrinter' /etc/cups/printers.conf; then
    printf '%s\n' 'Refusing to test against existing printer queues.' >&2
    exit 1
fi

config_copy=$(mktemp)
cp -p /etc/cups/cupsd.conf "$config_copy"
scheduler=
cleanup() {
    if [ -n "$scheduler" ]; then
        kill "$scheduler" 2>/dev/null || true
        wait "$scheduler" 2>/dev/null || true
    fi
    cp -p "$config_copy" /etc/cups/cupsd.conf
    rm -f "$config_copy" /tmp/cups-auth-denied.log /etc/cups/printers.conf /etc/cups/printers.conf.O
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

/usr/local/bin/cups-entrypoint.sh &
scheduler=$!
ready=no
for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if status=$(lpstat -h /run/cups/cups.sock -r 2>/dev/null) && [ "$status" = 'scheduler is running' ]; then
        ready=yes
        break
    fi
    sleep 1
done
if [ "$ready" != yes ]; then
    printf '%s\n' 'CUPS socket did not become available during image authentication check.' >&2
    exit 1
fi

# Raw queue creation proves scheduler authorization without contacting a printer.
timeout 15 runuser -u node -- lpadmin -h /run/cups/cups.sock -U node -p mahaffeys_auth_smoke -E -v ipp://127.0.0.1:9/ipp/print -m raw </dev/null
timeout 15 runuser -u node -- lpadmin -h /run/cups/cups.sock -U node -x mahaffeys_auth_smoke </dev/null

if timeout 15 runuser -u nobody -- lpadmin -h /run/cups/cups.sock -U nobody -p mahaffeys_auth_denied -v ipp://127.0.0.1:9/ipp/print -m raw </dev/null >/tmp/cups-auth-denied.log 2>&1; then
    printf '%s\n' 'ERROR: Unauthorized account was able to create a queue.' >&2
    exit 1
fi
if ! grep -qiE 'forbidden|unauthorized|not authorized|authentication|password' /tmp/cups-auth-denied.log; then
    printf '%s\n' 'Unauthorized-client test failed for a reason other than authentication; refusing image build.' >&2
    exit 1
fi
printf '%s\n' 'CUPS image check passed: UID 1000 can administer over the local socket; unauthorized account is rejected. No print job sent.'
