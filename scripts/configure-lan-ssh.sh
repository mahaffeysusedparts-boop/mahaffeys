#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_IP="192.168.1.210"
LAN_SUBNET="192.168.1.0/24"
SSH_USER="jhilliard"
SSH_DROP_IN="/etc/ssh/sshd_config.d/99-mahaffeys-lan.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This SSH setup must be run as root." >&2
  exit 1
fi

if ! id "${SSH_USER}" >/dev/null 2>&1; then
  echo "Linux user ${SSH_USER} does not exist. Complete the Mahaffeys installation first." >&2
  exit 1
fi

read -r -p "Paste the trusted SSH public key for ${SSH_USER}: " SSH_PUBLIC_KEY
if [[ ! "${SSH_PUBLIC_KEY}" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256)[[:space:]] ]]; then
  echo "A supported SSH public key is required." >&2
  exit 1
fi

apt-get update
apt-get install -y openssh-server ufw

SSH_HOME="$(getent passwd "${SSH_USER}" | cut -d: -f6)"
install -d -m 700 -o "${SSH_USER}" -g "${SSH_USER}" "${SSH_HOME}/.ssh"
printf '%s\n' "${SSH_PUBLIC_KEY}" > "${SSH_HOME}/.ssh/authorized_keys"
chown "${SSH_USER}:${SSH_USER}" "${SSH_HOME}/.ssh/authorized_keys"
chmod 600 "${SSH_HOME}/.ssh/authorized_keys"
unset SSH_PUBLIC_KEY

cat > "${SSH_DROP_IN}" <<EOF
ListenAddress ${SERVER_IP}
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers ${SSH_USER}
MaxAuthTries 3
X11Forwarding no
AllowTcpForwarding no
EOF

ufw allow from "${LAN_SUBNET}" to "${SERVER_IP}" port 22 proto tcp
sshd -t
systemctl enable --now ssh
systemctl reload ssh

echo "Key-only SSH is enabled for ${SSH_USER} on ${SERVER_IP}, restricted to ${LAN_SUBNET}."
