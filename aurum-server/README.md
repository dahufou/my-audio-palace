# Aurum Server

Serveur audio Roon-like pour Debian / LXC.

- Node.js 20, Fastify, PostgreSQL, ffmpeg
- Scan de bibliothèque (FLAC/ALAC/MP3/OGG/AAC/WAV/DSD)
- Streaming HTTP + transcodage à la volée
- Zones de lecture multi-endpoints (Browser / Chromecast / UPnP-DLNA)
- API REST + WebSocket (sync temps réel)
- Multi-utilisateurs (familles), auth Bearer JWT

## Installation rapide sur ton LXC Debian

```bash
# Dans ton LXC Debian (en root)
curl -fsSL https://raw.githubusercontent.com/<toi>/<repo>/main/aurum-server/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

Ou, si tu as déjà cloné le repo :

```bash
cd aurum-server
sudo ./install.sh
```

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
