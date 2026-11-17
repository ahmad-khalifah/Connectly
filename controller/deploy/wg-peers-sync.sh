#!/usr/bin/env bash
# Applies the router peer list written by the (unprivileged) controller to the
# WireGuard hub. Runs as root, so it trusts nothing in the file: every peer
# must be a valid WireGuard public key with exactly one /32 inside
# 10.77.0.0/22 that is not the controller's own 10.77.0.1.
#
# STATUS: NOT YET RUN on any machine (staging stage).
set -euo pipefail

PEERS=/var/lib/connectly-controller/wg-peers.conf
IFACE=wg-connectly
KEY=/etc/wireguard/connectly.key

[ -f "$PEERS" ] || exit 0
out=$(mktemp)
trap 'rm -f "$out"' EXIT
chmod 600 "$out"
{
  echo "[Interface]"
  echo "PrivateKey = $(cat "$KEY")"
  echo "ListenPort = ${WG_PORT:-51820}"
} > "$out"

key=''
while IFS= read -r line; do
  case "$line" in
    ''|'#'*|'[Peer]') continue ;;
    'PublicKey = '*)
      key=${line#PublicKey = }
      [[ "$key" =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$ ]] || { echo "bad key: $key" >&2; exit 1; } ;;
    'AllowedIPs = '*)
      ip=${line#AllowedIPs = }
      [[ "$ip" =~ ^10\.77\.([0-3])\.([0-9]{1,3})/32$ ]] || { echo "bad address: $ip" >&2; exit 1; }
      (( BASH_REMATCH[2] <= 255 )) || { echo "bad address: $ip" >&2; exit 1; }
      [ "$ip" != "10.77.0.1/32" ] || { echo "controller address given to a peer" >&2; exit 1; }
      [ -n "$key" ] || { echo "address without key" >&2; exit 1; }
      printf '\n[Peer]\nPublicKey = %s\nAllowedIPs = %s\n' "$key" "$ip" >> "$out"
      key='' ;;
    *) echo "unexpected line: $line" >&2; exit 1 ;;
  esac
done < "$PEERS"

wg syncconf "$IFACE" "$out"
logger -t connectly-wg "applied $(grep -c '^\[Peer\]' "$out") router peer(s)"
