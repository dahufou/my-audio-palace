#!/usr/bin/env bash
# =============================================================================
#  Snapclient — Installation Linux (apt) ou macOS (brew)
#
#  Usage :
#    sudo bash install-linux-mac.sh <SERVER_HOST> [SERVER_PORT] [CLIENT_NAME]
#
#  Exemples :
#    sudo bash install-linux-mac.sh 192.168.1.50
#    sudo bash install-linux-mac.sh aurum.mondomaine.com 1704 "Mac-Bureau"
# =============================================================================

set -euo pipefail

SERVER_HOST="${1:-}"
SERVER_PORT="${2:-1704}"
CLIENT_NAME="${3:-$(hostname)}"

if [[ -z "$SERVER_HOST" ]]; then
  echo "Usage: $0 <SERVER_HOST> [SERVER_PORT] [CLIENT_NAME]" >&2
  exit 1
fi

OS="$(uname -s)"

case "$OS" in
  Linux)
    if [[ $EUID -ne 0 ]]; then echo "Lance avec sudo."; exit 1; fi
    echo "[aurum] Installation snapclient via apt"
    apt-get update -qq
    apt-get install -y --no-install-recommends snapclient
    # Reconfigure le defaults
    cat > /etc/default/snapclient <<EOF
START_SNAPCLIENT=true
SNAPCLIENT_OPTS="--host $SERVER_HOST --port $SERVER_PORT --hostID \"$CLIENT_NAME\""
EOF
    systemctl enable snapclient >/dev/null
    systemctl restart snapclient
    echo "✔  snapclient actif. Logs: journalctl -u snapclient -f"
    ;;
  Darwin)
    if ! command -v brew >/dev/null; then
      echo "Homebrew requis. Installe-le depuis https://brew.sh puis relance." >&2
      exit 1
    fi
    echo "[aurum] Installation snapclient via Homebrew"
    brew install snapcast
    PLIST="$HOME/Library/LaunchAgents/com.aurum.snapclient.plist"
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aurum.snapclient</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(brew --prefix)/bin/snapclient</string>
    <string>--host</string><string>$SERVER_HOST</string>
    <string>--port</string><string>$SERVER_PORT</string>
    <string>--hostID</string><string>$CLIENT_NAME</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/snapclient.log</string>
  <key>StandardErrorPath</key><string>/tmp/snapclient.err</string>
</dict></plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "✔  snapclient actif (LaunchAgent). Logs: tail -f /tmp/snapclient.log"
    ;;
  *)
    echo "OS non supporté: $OS" >&2
    exit 1
    ;;
esac

echo
echo "Zone connectée : '$CLIENT_NAME' → $SERVER_HOST:$SERVER_PORT"
echo "Elle apparaîtra dans Aurum → Réglages → Zones audio."
