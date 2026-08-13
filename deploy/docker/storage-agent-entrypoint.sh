#!/usr/bin/env sh
set -eu

mdadm --assemble --scan --run >/dev/null 2>&1 || true
exec node /agent/storage-agent.mjs
