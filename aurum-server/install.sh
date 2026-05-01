#!/usr/bin/env bash
# Aurum Server — installeur interactif pour Debian / LXC
# Usage: sudo ./install.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (sudo ./install.sh)." >&2
  exit 1
fi

#-------------------------------------------------------------------------------
# Couleurs
#-------------------------------------------------------------------------------
C_RESET="\033[0m"; C_BOLD="\033[1m"; C_GREEN="\033[32m"; C_BLUE="\033[34m"; C_YELLOW="\033[33m"
say()  { echo -e "${C_BLUE}==>${C_RESET} ${C_BOLD}$*${C_RESET}"; }
ok()   { echo -e "${C_GREEN}✓${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}!${C_RESET} $*"; }

#-------------------------------------------------------------------------------
# Variables (avec valeurs par défaut, surchargeables en interactif)
#-------------------------------------------------------------------------------
APP_USER="aurum"
APP_DIR="/opt/aurum"
ETC_DIR="/etc/aurum"
CACHE_DIR="/var/cache/aurum"
LOG_DIR="/var/log/aurum"

DEFAULT_MUSIC_PATH="/mnt/music"
DEFAULT_PORT="4477"
DEFAULT_HOST="127.0.0.1"
DEFAULT_DB_NAME="aurum"
DEFAULT_DB_USER="aurum"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

say "Aurum Server — installation interactive"
echo

#-------------------------------------------------------------------------------
# Questions
#-------------------------------------------------------------------------------
read -r -p "Chemin de ta bibliothèque musicale [${DEFAULT_MUSIC_PATH}] : " MUSIC_PATH
MUSIC_PATH="${MUSIC_PATH:-$DEFAULT_MUSIC_PATH}"

read -r -p "Adresse d'écoute [${DEFAULT_HOST}] : " HOST
HOST="${HOST:-$DEFAULT_HOST}"

read -r -p "Port d'écoute [${DEFAULT_PORT}] : " PORT
PORT="${PORT:-$DEFAULT_PORT}"

read -r -p "Nom de la base PostgreSQL [${DEFAULT_DB_NAME}] : " DB_NAME
DB_NAME="${DB_NAME:-$DEFAULT_DB_NAME}"

read -r -p "Utilisateur PostgreSQL [${DEFAULT_DB_USER}] : " DB_USER
DB_USER="${DB_USER:-$DEFAULT_DB_USER}"

# Mot de passe DB : généré si vide
read -r -s -p "Mot de passe PostgreSQL (vide = généré) : " DB_PASS
echo
if [[ -z "${DB_PASS}" ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  ok "Mot de passe DB généré."
fi

JWT_SECRET="$(openssl rand -hex 48)"
BRIDGE_TOKEN="$(openssl rand -hex 24)"

echo
say "Récap :"
echo "  Musique         : ${MUSIC_PATH}"
echo "  Écoute          : ${HOST}:${PORT}"
echo "  DB              : postgres://${DB_USER}:***@127.0.0.1:5432/${DB_NAME}"
echo "  App user        : ${APP_USER}"
echo "  App dir         : ${APP_DIR}"
echo
read -r -p "On continue ? [O/n] " GO
GO="${GO:-O}"
if [[ ! "${GO}" =~ ^[OoYy]$ ]]; then
  warn "Annulé."
  exit 0
fi

#-------------------------------------------------------------------------------
# Paquets système
#-------------------------------------------------------------------------------
say "Installation des paquets système (apt)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg openssl \
  ffmpeg \
  postgresql postgresql-contrib \
  avahi-daemon libnss-mdns \
  build-essential
ok "Paquets installés."

# Node.js 20 via NodeSource si nécessaire
if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]]; then
  say "Installation de Node.js 20 (NodeSource)…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v)"

#-------------------------------------------------------------------------------
# Utilisateur système
#-------------------------------------------------------------------------------
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  say "Création de l'utilisateur système ${APP_USER}…"
  useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi
ok "Utilisateur ${APP_USER} prêt."

#-------------------------------------------------------------------------------
# Dossiers
#-------------------------------------------------------------------------------
say "Création des dossiers…"
mkdir -p "${APP_DIR}" "${ETC_DIR}" "${CACHE_DIR}/transcode" "${LOG_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${CACHE_DIR}" "${LOG_DIR}"

if [[ ! -d "${MUSIC_PATH}" ]]; then
  warn "${MUSIC_PATH} n'existe pas — je le crée (vide)."
  mkdir -p "${MUSIC_PATH}"
fi
# On veut juste pouvoir lire la musique
chmod a+rx "${MUSIC_PATH}" || true

#-------------------------------------------------------------------------------
# Copie du code + build
#-------------------------------------------------------------------------------
say "Copie du code dans ${APP_DIR}…"
rsync -a --delete \
  --exclude node_modules --exclude dist \
  "${SCRIPT_DIR}/" "${APP_DIR}/"

say "npm install + build…"
cd "${APP_DIR}"
sudo -u "${APP_USER}" npm install --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
# build a besoin des devDeps
npm install --no-audit --no-fund
npm run build
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
ok "Build OK."

#-------------------------------------------------------------------------------
# PostgreSQL
#-------------------------------------------------------------------------------
say "Configuration PostgreSQL…"
systemctl enable --now postgresql

# Créer user si absent
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  ok "User PostgreSQL ${DB_USER} créé."
else
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  ok "Mot de passe ${DB_USER} mis à jour."
fi

# Créer DB si absente
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  ok "Base ${DB_NAME} créée."
fi

# Schéma (sera ajouté à l'étape B)
if [[ -f "${APP_DIR}/sql/001_init.sql" ]]; then
  say "Application du schéma SQL…"
  PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -f "${APP_DIR}/sql/001_init.sql"
fi

#-------------------------------------------------------------------------------
# Fichier d'environnement
#-------------------------------------------------------------------------------
say "Écriture de ${ETC_DIR}/aurum.env…"
cat > "${ETC_DIR}/aurum.env" <<EOF
NODE_ENV=production
HOST=${HOST}
PORT=${PORT}
MUSIC_PATH=${MUSIC_PATH}
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
BRIDGE_TOKEN=${BRIDGE_TOKEN}
FFMPEG_PATH=$(command -v ffmpeg)
TRANSCODE_CACHE=${CACHE_DIR}/transcode
LOG_LEVEL=info
EOF
chown root:${APP_USER} "${ETC_DIR}/aurum.env"
chmod 640 "${ETC_DIR}/aurum.env"
ok "Env écrit."

#-------------------------------------------------------------------------------
# systemd
#-------------------------------------------------------------------------------
say "Installation du service systemd…"
install -m 644 "${APP_DIR}/systemd/aurum.service" /etc/systemd/system/aurum.service
systemctl daemon-reload
systemctl enable aurum
systemctl restart aurum

sleep 2
if systemctl is-active --quiet aurum; then
  ok "Service aurum démarré."
else
  warn "Le service n'est pas actif. Logs : journalctl -u aurum -n 50 --no-pager"
fi

#-------------------------------------------------------------------------------
# Avahi (mDNS) — utile pour découverte Chromecast/UPnP
#-------------------------------------------------------------------------------
systemctl enable --now avahi-daemon || true

#-------------------------------------------------------------------------------
# Fin
#-------------------------------------------------------------------------------
echo
ok "Installation terminée."
echo
echo "  Test           : curl http://${HOST}:${PORT}/health"
echo "  Service        : systemctl status aurum"
echo "  Logs           : journalctl -u aurum -f"
echo "  Env            : ${ETC_DIR}/aurum.env"
echo "  Bridge token   : ${BRIDGE_TOKEN}"
echo
echo "Pour exposer Aurum à l'extérieur (Cloudflare Tunnel) — étape suivante."
