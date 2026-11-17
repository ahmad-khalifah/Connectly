#!/usr/bin/env bash
# Prepares an Ubuntu 24.04 machine to run the controller: WireGuard hub,
# firewall, a dedicated user and the systemd service. Holds no secrets:
# the WireGuard private key is generated on the machine, and the database
# password goes into controller.env by hand afterwards.
#
# STATUS: written for the staging stage; NOT YET RUN on any machine.
# Run as root:  sudo bash deploy/install.sh
set -euo pipefail

WG_PORT="${WG_PORT:-51820}"
SSH_FROM="${SSH_FROM:-}"          # optional: only allow SSH from this address/range
APP_DIR=/opt/connectly-controller

apt-get update -q
apt-get install -y -q wireguard ufw unattended-upgrades curl ca-certificates
if ! command -v node >/dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0] < 22)'; then
  echo "Install Node.js 22 LTS first (for example from nodejs.org or NodeSource), then re-run." >&2
  exit 1
fi

id connectly >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin connectly

# WireGuard hub: 10.77.0.1/22. Router peers are added later, one per router.
install -d -m 700 /etc/wireguard
if [ ! -f /etc/wireguard/connectly.key ]; then
  umask 077
  wg genkey > /etc/wireguard/connectly.key
  wg pubkey < /etc/wireguard/connectly.key > /etc/wireguard/connectly.pub
  chmod 644 /etc/wireguard/connectly.pub
fi
if [ ! -f /etc/wireguard/wg-connectly.conf ]; then
  umask 077
  cat > /etc/wireguard/wg-connectly.conf <<EOF
[Interface]
Address = 10.77.0.1/22
ListenPort = ${WG_PORT}
PostUp = wg set %i private-key /etc/wireguard/connectly.key
EOF
fi
systemctl enable --now wg-quick@wg-connectly

# Firewall: WireGuard from anywhere; SSH from SSH_FROM if given; bootstrap only on the tunnel.
ufw default deny incoming
ufw default allow outgoing
ufw allow "${WG_PORT}"/udp
if [ -n "$SSH_FROM" ]; then ufw allow from "$SSH_FROM" to any port 22 proto tcp; else ufw allow 22/tcp; fi
ufw allow in on wg-connectly to 10.77.0.1 port 8080 proto tcp
ufw --force enable

install -d -m 755 "$APP_DIR"
cp -r src package.json package-lock.json "$APP_DIR"/
(cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)
install -d -m 750 -o root -g connectly /etc/connectly-controller
[ -f /etc/connectly-controller/controller.env ] || install -m 640 -o root -g connectly deploy/controller.env.example /etc/connectly-controller/controller.env
install -m 644 deploy/connectly-controller.service /etc/systemd/system/connectly-controller.service
install -m 755 deploy/wg-peers-sync.sh /usr/local/sbin/connectly-wg-peers-sync
install -m 644 deploy/connectly-wg-sync.service deploy/connectly-wg-sync.path /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now connectly-wg-sync.path

echo
echo "Next: edit /etc/connectly-controller/controller.env (database URL and CA file),"
echo "then: sudo -u connectly env \$(cat /etc/connectly-controller/controller.env | xargs) node $APP_DIR/src/main.ts --check"
echo "and:  systemctl enable --now connectly-controller"
echo "Back up /var/lib/connectly-controller/credential-key.pem and /etc/wireguard/connectly.key offline."
