#!/usr/bin/env bash
# Mahaffeys Auto-Recovery (Linux)
# --------------------------------
# Waits for internet, pulls the latest code from GitHub, installs/builds if
# anything changed, then execs the production server. Pair with the provided
# mahaffeys.service systemd unit so the OS restarts this script (and the
# server) after any crash or power loss.

set -u

REPO_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${MAHAFFEYS_BRANCH:-main}"
LOG_DIR="$REPO_DIR/scripts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/auto-recover.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" | tee -a "$LOG_FILE"; }

wait_for_internet() {
  local i
  for i in $(seq 1 60); do
    if curl -fsS --max-time 5 https://github.com >/dev/null 2>&1; then return 0; fi
    sleep 5
  done
  return 1
}

# Echoes "changed" when the working copy moved to a new commit.
update_from_github() {
  git -C "$REPO_DIR" fetch origin "$BRANCH" >>"$LOG_FILE" 2>&1
  local before after
  before=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null)
  git -C "$REPO_DIR" pull --ff-only origin "$BRANCH" >>"$LOG_FILE" 2>&1
  after=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null)
  [ "$before" != "$after" ]
}

log "=== Mahaffeys auto-recovery starting (repo: $REPO_DIR, branch: $BRANCH) ==="

if wait_for_internet; then log "Internet available."; else log "No internet after 5 min - starting local copy."; fi

CHANGED=0
if update_from_github; then
  CHANGED=1
  log "GitHub update applied."
else
  log "No GitHub changes (or offline) - continuing with local copy."
fi

if [ "$CHANGED" -eq 1 ] || [ ! -d "$REPO_DIR/node_modules" ]; then
  log "Installing dependencies..."
  (cd "$REPO_DIR" && npm install >>"$LOG_FILE" 2>&1)
fi
if [ "$CHANGED" -eq 1 ] || [ ! -f "$REPO_DIR/.output/server/index.mjs" ]; then
  log "Building production server..."
  (cd "$REPO_DIR" && npm run build >>"$LOG_FILE" 2>&1)
fi

if [ ! -f "$REPO_DIR/.output/server/index.mjs" ]; then
  log "ERROR: server build missing - build may have failed."
  exit 1
fi

log "Starting server (exec node)..."
exec node "$REPO_DIR/.output/server/index.mjs"
