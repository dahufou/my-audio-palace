#!/usr/bin/env bash
# =============================================================================
#  Aurum Audio Server — Installation script
#  Cible : LXC Debian 12 / Ubuntu 22.04+ (root ou sudo)
#
#  Ce script installe :
#    - MPD (Music Player Daemon) configuré pour sortir en bit-perfect vers
#      une FIFO consommée par Snapserver
#    - Snapserver (synchronisation multi-room)
#    - Le bridge HTTP "aurum-bridge" (Node.js) qui expose une API REST utilisée
#      par l'application Aurum pour piloter MPD + Snapcast
#    - Un mount CIFS/SMB read-only vers le LXC médiathèque
#    - Les services systemd correspondants
#
#  Usage :
#    sudo bash install.sh
#
#  Le script est interactif. Les valeurs sont aussi configurables par variables
#  d'environnement :
#    SMB_HOST=192.168.1.10 SMB_SHARE=music SMB_USER=foo SMB_PASS=bar \
#    BRIDGE_PORT=8080 BRIDGE_TOKEN=xxxx sudo -E bash install.sh
# =============================================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé en root (utilise sudo)." >&2
  exit 1
fi

# -----------------------------------------------------------------------------
#  Helpers
# -----------------------------------------------------------------------------
log()  { printf "\033[1;36m[aurum]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m  %s\n" "$*"; }
err()  { printf "\033[1;31m[err]\033[0m   %s\n" "$*" >&2; }

ask() {
  # ask "Question" "default" varname
  local prompt="$1" default="${2-}" __var="$3" reply
  if [[ -n "${!__var-}" ]]; then return; fi
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default] : " reply || true
    reply="${reply:-$default}"
  else
    read -r -p "$prompt : " reply
  fi
  printf -v "$__var" "%s" "$reply"
}

ask_secret() {
  local prompt="$1" __var="$2" reply
  if [[ -n "${!__var-}" ]]; then return; fi
  read -r -s -p "$prompt : " reply
  echo
  printf -v "$__var" "%s" "$reply"
}

# -----------------------------------------------------------------------------
#  Récupération des paramètres
# -----------------------------------------------------------------------------
log "Configuration interactive (Ctrl-C pour annuler)"
ask "IP/host du LXC médiathèque (SMB)"           ""               SMB_HOST
ask "Nom du partage SMB (sans \\\\ ni /)"        "music"          SMB_SHARE
ask "Sous-dossier dans le partage (vide = racine)" ""             SMB_SUBPATH
ask "Utilisateur SMB"                            "guest"          SMB_USER
ask_secret "Mot de passe SMB (vide si invité)"                    SMB_PASS
ask "Port HTTP du bridge Aurum"                  "8080"           BRIDGE_PORT
ask "Port d'écoute Snapserver (audio)"           "1704"           SNAP_STREAM_PORT
ask "Port de contrôle Snapserver (JSON-RPC)"     "1705"           SNAP_CTRL_PORT

# Token d'auth pour le bridge — généré si non fourni
if [[ -z "${BRIDGE_TOKEN-}" ]]; then
  BRIDGE_TOKEN="$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)"
  log "Token bridge généré : $BRIDGE_TOKEN"
fi

MUSIC_MOUNT="/mnt/music"
MPD_FIFO="/tmp/snapfifo"

# -----------------------------------------------------------------------------
#  Installation des paquets
# -----------------------------------------------------------------------------
log "Mise à jour APT et installation des paquets…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  mpd mpc snapserver \
  cifs-utils \
  curl ca-certificates gnupg \
  jq

# Node.js 20 (officiel NodeSource)
if ! command -v node >/dev/null || ! node -e "process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)"; then
  log "Installation Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# -----------------------------------------------------------------------------
#  Mount SMB read-only vers la médiathèque
# -----------------------------------------------------------------------------
log "Configuration du mount SMB → $MUSIC_MOUNT"
mkdir -p "$MUSIC_MOUNT"

CRED_FILE="/etc/aurum/smb.cred"
mkdir -p /etc/aurum
chmod 700 /etc/aurum
cat > "$CRED_FILE" <<EOF
username=$SMB_USER
password=$SMB_PASS
EOF
chmod 600 "$CRED_FILE"

SMB_PATH="//$SMB_HOST/$SMB_SHARE"
[[ -n "$SMB_SUBPATH" ]] && SMB_PATH="$SMB_PATH/$SMB_SUBPATH"

# Retire toute ligne fstab existante pour ce mount
sed -i "\|$MUSIC_MOUNT|d" /etc/fstab
echo "$SMB_PATH  $MUSIC_MOUNT  cifs  credentials=$CRED_FILE,ro,iocharset=utf8,uid=mpd,gid=audio,file_mode=0444,dir_mode=0555,vers=3.0,nofail,x-systemd.automount,x-systemd.device-timeout=10  0  0" >> /etc/fstab

systemctl daemon-reload
if ! mount "$MUSIC_MOUNT"; then
  warn "Le mount SMB a échoué. Vérifie host/share/credentials puis relance : mount $MUSIC_MOUNT"
else
  log "Mount SMB OK → $(ls "$MUSIC_MOUNT" 2>/dev/null | head -3 | tr '\n' ' ')"
fi

# -----------------------------------------------------------------------------
#  Configuration MPD → FIFO Snapcast (bit-perfect, pas de resampling)
# -----------------------------------------------------------------------------
log "Configuration de MPD"
install -d -o mpd -g audio /var/lib/mpd /var/lib/mpd/playlists
install -o mpd -g audio /dev/null /var/log/mpd/mpd.log 2>/dev/null || true

cat > /etc/mpd.conf <<EOF
# Géré par Aurum installer — modifications manuelles écrasées au prochain run
music_directory     "$MUSIC_MOUNT"
playlist_directory  "/var/lib/mpd/playlists"
db_file             "/var/lib/mpd/tag_cache"
log_file            "/var/log/mpd/mpd.log"
state_file          "/var/lib/mpd/state"
sticker_file        "/var/lib/mpd/sticker.sql"
user                "mpd"
group               "audio"
bind_to_address     "127.0.0.1"
port                "6600"
restore_paused      "yes"
auto_update         "yes"
auto_update_depth   "0"
follow_outside_symlinks "yes"
follow_inside_symlinks  "yes"

# Pas de replaygain global — Aurum gère lui-même côté UI
replaygain          "off"
volume_normalization "no"

# Sortie unique : FIFO consommée par Snapserver (PCM 48k/16/2 — bit-perfect côté lecteur)
audio_output {
    type            "fifo"
    name            "Snapcast"
    path            "$MPD_FIFO"
    format          "48000:16:2"
    mixer_type      "software"
}

# Important : pas de resampling supplémentaire
audio_output_format "48000:16:2"
EOF

systemctl enable mpd >/dev/null
systemctl restart mpd

# -----------------------------------------------------------------------------
#  Configuration Snapserver
# -----------------------------------------------------------------------------
log "Configuration de Snapserver"
mkdir -p /etc/snapserver
cat > /etc/snapserver.conf <<EOF
# Géré par Aurum installer
[server]
threads = -1
datadir = /var/lib/snapserver

[http]
enabled = true
bind_to_address = 0.0.0.0
port = 1780
doc_root = /usr/share/snapserver/snapweb

[tcp]
enabled = true
bind_to_address = 0.0.0.0
port = $SNAP_CTRL_PORT

[stream]
source = pipe://$MPD_FIFO?name=Aurum&sampleformat=48000:16:2&codec=flac
buffer = 1000
sampleformat = 48000:16:2
codec = flac
stream_port = $SNAP_STREAM_PORT
EOF

systemctl enable snapserver >/dev/null
systemctl restart snapserver

# -----------------------------------------------------------------------------
#  Bridge HTTP Aurum (Node.js)
# -----------------------------------------------------------------------------
log "Installation du bridge Aurum HTTP"
BRIDGE_DIR="/opt/aurum-bridge"
mkdir -p "$BRIDGE_DIR"

# Le code source du bridge est inline plus bas pour rendre ce script autonome.
# Si tu veux l'éditer, le fichier final vit dans $BRIDGE_DIR/server.mjs
cat > "$BRIDGE_DIR/package.json" <<'EOF'
{
  "name": "aurum-bridge",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "dependencies": {
    "mpd2": "^5.1.0"
  }
}
EOF

# server.mjs est volontairement gardé dans un fichier séparé — copié depuis
# le repo Aurum (infra/lxc-aurum/server.mjs). Si tu lances ce script depuis
# le repo cloné, il sera trouvé à côté. Sinon on tente un téléchargement.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/server.mjs" ]]; then
  cp "$SCRIPT_DIR/server.mjs" "$BRIDGE_DIR/server.mjs"
else
  err "server.mjs introuvable à côté de install.sh"
  err "Place server.mjs dans $SCRIPT_DIR puis relance."
  exit 1
fi

(cd "$BRIDGE_DIR" && npm install --omit=dev --no-audit --no-fund --silent)

# Config du bridge
cat > /etc/aurum/bridge.env <<EOF
BRIDGE_PORT=$BRIDGE_PORT
BRIDGE_TOKEN=$BRIDGE_TOKEN
MPD_HOST=127.0.0.1
MPD_PORT=6600
SNAP_HOST=127.0.0.1
SNAP_CTRL_PORT=$SNAP_CTRL_PORT
MUSIC_ROOT=$MUSIC_MOUNT
EOF
chmod 600 /etc/aurum/bridge.env

# Service systemd
cat > /etc/systemd/system/aurum-bridge.service <<EOF
[Unit]
Description=Aurum HTTP Bridge (MPD + Snapcast control)
After=network.target mpd.service snapserver.service
Wants=mpd.service snapserver.service

[Service]
Type=simple
EnvironmentFile=/etc/aurum/bridge.env
WorkingDirectory=$BRIDGE_DIR
ExecStart=/usr/bin/node $BRIDGE_DIR/server.mjs
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aurum-bridge >/dev/null
systemctl restart aurum-bridge

# -----------------------------------------------------------------------------
#  Récap
# -----------------------------------------------------------------------------
LAN_IP="$(hostname -I | awk '{print $1}')"
cat <<EOF

\033[1;32m═══════════════════════════════════════════════════════════════════\033[0m
\033[1;32m  ✔  Installation terminée\033[0m
\033[1;32m═══════════════════════════════════════════════════════════════════\033[0m

  Médiathèque montée  : $MUSIC_MOUNT  ←  $SMB_PATH
  MPD                 : 127.0.0.1:6600
  Snapserver audio    : $LAN_IP:$SNAP_STREAM_PORT  (à pointer depuis snapclient)
  Snapserver control  : $LAN_IP:$SNAP_CTRL_PORT    (JSON-RPC)
  Snapserver web UI   : http://$LAN_IP:1780
  Bridge Aurum HTTP   : http://$LAN_IP:$BRIDGE_PORT

  \033[1;33mTOKEN du bridge\033[0m :
     $BRIDGE_TOKEN

  À copier dans Aurum → Réglages → Audio → "Mode serveur"

  Test rapide :
     curl -H "Authorization: Bearer $BRIDGE_TOKEN" http://$LAN_IP:$BRIDGE_PORT/health
     curl -H "Authorization: Bearer $BRIDGE_TOKEN" http://$LAN_IP:$BRIDGE_PORT/zones

  Forcer une réindexation MPD :
     mpc -h 127.0.0.1 update

  Logs :
     journalctl -u aurum-bridge -f
     journalctl -u mpd -f
     journalctl -u snapserver -f

EOF
