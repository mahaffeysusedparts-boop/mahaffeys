#!/usr/bin/env bash
set -Eeuo pipefail

APP_USER="${MAHAFFEYS_APP_USER:-jhilliard}"
SETUP_PATH="/usr/local/sbin/mahaffeys-storage-setup"
WRAPPER_PATH="/usr/local/sbin/mahaffeys-mdadm"
SUDOERS_PATH="/etc/sudoers.d/mahaffeys-storage"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Storage management setup must run as root." >&2
  exit 1
fi

if [[ "$(readlink -f "$0")" != "${SETUP_PATH}" ]]; then
  install -o root -g root -m 0755 "$0" "${SETUP_PATH}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "Application user ${APP_USER} does not exist." >&2
  exit 1
fi

if ! command -v mdadm >/dev/null 2>&1 || ! command -v sudo >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y mdadm sudo
fi

cat > "${WRAPPER_PATH}" <<'WRAPPER'
#!/usr/bin/env bash
set -Eeuo pipefail

MDADM="$(command -v mdadm || true)"
if [[ -z "${MDADM}" ]]; then
  echo "mdadm is not installed" >&2
  exit 127
fi

valid_array() {
  [[ "$1" =~ ^/dev/md[0-9]+$ ]]
}

valid_device() {
  [[ "$1" =~ ^/dev/[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]
}

if [[ "$#" -eq 1 && "$1" == "--version" ]]; then
  exec "${MDADM}" --version
fi

if [[ "${1:-}" == "--create" ]]; then
  if [[ "$#" -lt 8 ]]; then
    echo "Invalid RAID create request" >&2
    exit 64
  fi

  ARRAY_PATH="$2"
  LEVEL_ARG="$3"
  COUNT_ARG="$4"
  METADATA_ARG="$5"
  RUN_ARG="$6"
  shift 6
  DEVICES=("$@")

  valid_array "${ARRAY_PATH}" || { echo "Invalid RAID array path" >&2; exit 64; }
  [[ "${LEVEL_ARG}" =~ ^--level=(1|5|6|10)$ ]] || { echo "Unsupported RAID level" >&2; exit 64; }
  [[ "${COUNT_ARG}" =~ ^--raid-devices=([0-9]+)$ ]] || { echo "Invalid drive count" >&2; exit 64; }
  [[ "${METADATA_ARG}" == "--metadata=1.2" && "${RUN_ARG}" == "--run" ]] || { echo "Invalid RAID options" >&2; exit 64; }

  RAID_LEVEL="${LEVEL_ARG#--level=}"
  DRIVE_COUNT="${COUNT_ARG#--raid-devices=}"
  [[ "${#DEVICES[@]}" -eq "${DRIVE_COUNT}" ]] || { echo "Drive count does not match request" >&2; exit 64; }
  case "${RAID_LEVEL}" in
    1) [[ "${DRIVE_COUNT}" -ge 2 ]] ;;
    5) [[ "${DRIVE_COUNT}" -ge 3 ]] ;;
    6) [[ "${DRIVE_COUNT}" -ge 4 ]] ;;
    10) [[ "${DRIVE_COUNT}" -ge 4 && $((DRIVE_COUNT % 2)) -eq 0 ]] ;;
  esac || { echo "Insufficient drives for RAID ${RAID_LEVEL}" >&2; exit 64; }
  for DEVICE in "${DEVICES[@]}"; do
    valid_device "${DEVICE}" && [[ -b "${DEVICE}" ]] || { echo "Invalid block device" >&2; exit 64; }
  done

  exec "${MDADM}" --create "${ARRAY_PATH}" "${LEVEL_ARG}" "${COUNT_ARG}" "${METADATA_ARG}" "${RUN_ARG}" "${DEVICES[@]}"
fi

if [[ "${1:-}" == "--manage" ]]; then
  if [[ "$#" -ne 4 ]]; then
    echo "Invalid RAID member request" >&2
    exit 64
  fi

  ARRAY_PATH="$2"
  ACTION="$3"
  DEVICE="$4"
  valid_array "${ARRAY_PATH}" || { echo "Invalid RAID array path" >&2; exit 64; }
  valid_device "${DEVICE}" && [[ -b "${DEVICE}" ]] || { echo "Invalid block device" >&2; exit 64; }
  [[ "${ACTION}" == "--fail" || "${ACTION}" == "--remove" || "${ACTION}" == "--add" ]] || { echo "Unsupported member action" >&2; exit 64; }

  exec "${MDADM}" --manage "${ARRAY_PATH}" "${ACTION}" "${DEVICE}"
fi

echo "Unsupported storage-management operation" >&2
exit 64
WRAPPER

chown root:root "${WRAPPER_PATH}"
chmod 0755 "${WRAPPER_PATH}"

cat > "${SUDOERS_PATH}" <<EOF
${APP_USER} ALL=(root) NOPASSWD: ${WRAPPER_PATH} *
EOF
chown root:root "${SUDOERS_PATH}"
chmod 0440 "${SUDOERS_PATH}"
visudo -cf "${SUDOERS_PATH}" >/dev/null

if ! runuser -u "${APP_USER}" -- sudo -n "${WRAPPER_PATH}" --version >/dev/null 2>&1; then
  echo "Storage-management permission verification failed." >&2
  exit 1
fi

echo "Storage management is enabled for ${APP_USER} through ${WRAPPER_PATH}."
