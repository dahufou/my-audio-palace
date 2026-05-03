# Aurum Server

Serveur audio Roon-like pour Debian / LXC.

- Node.js 20, Fastify, PostgreSQL, ffmpeg
- Scan de bibliothèque (FLAC/ALAC/MP3/OGG/AAC/WAV/DSD)
- Streaming HTTP + transcodage à la volée
- Zones de lecture multi-endpoints (Browser / Chromecast / UPnP-DLNA)
- API REST + WebSocket (sync temps réel)
- Multi-utilisateurs (familles), auth Bearer JWT

## Installation rapide sur ton LXC Debian

**Option 1 — Cloner tout le repo (recommandé) :**

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/dahufou/my-audio-palace.git
cd my-audio-palace/aurum-server
chmod +x install.sh
sudo ./install.sh
```

**Option 2 — Récupérer juste le script :**

```bash
curl -fsSL https://raw.githubusercontent.com/dahufou/my-audio-palace/main/aurum-server/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

> ⚠️ L'option 2 ne marche que partiellement pour l'instant : `install.sh` a besoin du dossier `aurum-server/` complet (code source, `package.json`, `src/`, etc.) pour build. **Préfère l'option 1.**

Le script est **interactif** : il te demandera le chemin de ta musique, le port d'écoute,
créera la base PostgreSQL, l'utilisateur système `aurum`, et le service systemd.

## Structure

```
aurum-server/
├── install.sh              # Installeur interactif (Debian)
├── package.json
├── tsconfig.json
├── .env.example
├── systemd/aurum.service
├── sql/001_init.sql        # Schéma DB (artists/albums/tracks/...)
├── src/
│   ├── index.ts            # Entrée Fastify
│   ├── config.ts           # Chargement env
│   ├── db.ts               # Pool pg + runMigrations()
│   ├── log.ts              # Pino
│   ├── cli/scan.ts         # `npm run scan`
│   ├── scanner/
│   │   ├── scan.ts         # Walk + music-metadata + covers
│   │   └── watcher.ts      # chokidar (temps réel)
│   └── routes/
│       ├── health.ts       # /health
│       └── library.ts      # /library/*, /covers/:id
└── README.md
```

## API actuelle

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Statut serveur + DB |
| `GET` | `/library/stats` | Compteurs artists/albums/tracks |
| `GET` | `/library/artists?q=&limit=&offset=` | Liste / recherche artistes |
| `GET` | `/library/artists/:id` | Détail artiste + ses albums |
| `GET` | `/library/albums?q=&limit=&offset=` | Liste / recherche albums |
| `GET` | `/library/albums/:id` | Détail album + ses pistes |
| `GET` | `/library/tracks/:id` | Détail piste |
| `GET` | `/library/search?q=` | Recherche globale |
| `GET` | `/covers/:albumId` | Cover de l'album (avec ETag + cache) |
| `POST` | `/library/scan` | Lance un re-scan (header `X-Bridge-Token`) |

## Scan de la bibliothèque

Le **watcher chokidar** tourne en permanence dans le service et indexe en temps réel les
ajouts / modifications / suppressions dans `MUSIC_PATH`.

Pour un **scan complet** manuel (ex: première fois) :

```bash
sudo -u aurum bash -lc 'cd /opt/aurum && set -a && . /etc/aurum/aurum.env && set +a && npm run scan'
```

Ou via API (depuis le LXC) :

```bash
TOKEN=$(sudo grep ^BRIDGE_TOKEN /etc/aurum/aurum.env | cut -d= -f2)
curl -X POST -H "X-Bridge-Token: $TOKEN" http://127.0.0.1:4477/library/scan
```

### Pochettes d'album

Priorité : `cover.jpg` / `folder.jpg` / `front.jpg` (jpg/png/webp) **dans le dossier de l'album**.
Sinon, on extrait la cover embarquée dans les tags vers `/var/cache/aurum/covers/<albumId>.<ext>`.

## Accès distant

Une fois Aurum Server qui tourne et écoute sur `127.0.0.1:4477`, tu installeras
**Cloudflare Tunnel** sur le LXC pour exposer `aurum.<ton-domaine>` en HTTPS,
sans ouvrir de port sur ton routeur.

