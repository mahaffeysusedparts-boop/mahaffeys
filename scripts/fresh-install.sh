rsync -a \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.output' \
  --exclude 'node_modules' \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"

runuser -u "${APP_USER}" -- bash -lc "cd '${INSTALL_DIR}' && npm install && npm run build"
MAHAFFEYS_APP_USER="${APP_USER}" bash "${INSTALL_DIR}/scripts/configure-storage-management.sh"

cat > "${INSTALL_DIR}/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: 'app',
    script: 'server.js',
    cwd: '/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: '1G',
    watch: false,
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}