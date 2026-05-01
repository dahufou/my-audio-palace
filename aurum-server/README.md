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
├── sql/001_init.sql        # Schéma DB (étape B)
├── src/
│   ├── index.ts            # Entrée Fastify
│   ├── config.ts           # Chargement env
│   ├── db.ts               # Pool pg
│   ├── log.ts              # Pino
│   └── routes/
│       └── health.ts       # /health
└── README.md
```

Les étapes suivantes ajouteront : scanner, routes library/stream/zones, WS, Chromecast, UPnP.

## Accès distant

Une fois Aurum Server qui tourne et écoute sur `127.0.0.1:4477`, tu installeras
**Cloudflare Tunnel** sur le LXC pour exposer `aurum.<ton-domaine>` en HTTPS,
sans ouvrir de port sur ton routeur.
