# Aurum — Lecture serveur (mode "Roon-like")

Cette infra te permet de faire fonctionner Aurum comme **Roon** :
- un **serveur central** (LXC) gère bibliothèque + lecture
- des **endpoints réseau** (Snapclient sur PC, RPi, etc.) reçoivent l'audio
  synchronisé, multi-room
- l'**UI Aurum** dans ton navigateur pilote tout via une API HTTP

```
┌─ LXC médiathèque ─┐         ┌─ LXC Aurum ──────────────────────┐
│  /music/...       │ ──SMB──▶│  /mnt/music                       │
└───────────────────┘         │  ├─ MPD          (lecture)        │
                              │  ├─ Snapserver   (sync multi-room)│
                              │  └─ aurum-bridge (API HTTP :8080) │
                              └────────────┬──────────────────────┘
                                           │ TCP 1704
                                  ┌────────┴────────┐
                                  ▼        ▼        ▼
                                PC      Cuisine   Salon
                              (Snapclient)
```

## 1. Sur le LXC Aurum (Debian/Ubuntu)

```bash
# Récupère les 2 fichiers d'install (install.sh + server.mjs) côte à côte
mkdir -p /root/aurum && cd /root/aurum
# … place install.sh et server.mjs ici …
chmod +x install.sh
sudo bash install.sh
```

Le script demande :
- l'IP du LXC médiathèque + le partage SMB (ex: `music`)
- les credentials SMB
- les ports (défauts: bridge 8080, snapserver 1704/1705)

Il génère un **token bridge** affiché à la fin → à coller dans Aurum.

### Exposer le bridge sur Internet

Aurum tourne dans Lovable (donc sur Internet), il doit pouvoir joindre ton bridge.
Trois options :

1. **Cloudflare Tunnel** (recommandé) — `cloudflared tunnel --url http://localhost:8080`
2. **Tailscale Funnel** — si déjà sur Tailscale
3. **Port-forward** + reverse proxy nginx avec HTTPS (Let's Encrypt)

⚠️ Ne jamais exposer le port 6600 (MPD) ni 1705 (Snapcast control) directement
sur Internet — seul le bridge HTTP doit être accessible. Le token Bearer protège.

## 2. Sur ton PC (premier endpoint)

**Windows** (PowerShell admin) :
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-windows.ps1 -ServerHost <IP_LAN_LXC> -ClientName "PC-Bureau"
```

**Linux/macOS** :
```bash
sudo bash install-linux-mac.sh <IP_LAN_LXC>
```

Ton PC apparaîtra comme zone dans Aurum → Réglages → Zones audio.

## 3. Plus tard : ajouter d'autres endpoints

- **Raspberry Pi** : flasher [Moode Audio](https://moodeaudio.org/) ou
  [piCorePlayer](https://www.picoreplayer.org/), activer le rôle "Snapclient"
- **Ampli/DAC réseau** : tout ce qui supporte Snapcast ou Squeezelite
- **Téléphone** : app `Snapdroid` (Android), `Snap.Net.Client` (iOS — limité)

Tous apparaîtront automatiquement comme zones dans Aurum.

## API exposée par le bridge

Toutes les routes (sauf `/health`) requièrent l'en-tête :
```
Authorization: Bearer <BRIDGE_TOKEN>
```

| Méthode | Route                       | Description                        |
|---------|-----------------------------|------------------------------------|
| GET     | `/health`                   | ping public                        |
| GET     | `/status`                   | état MPD + morceau courant         |
| POST    | `/play`                     | `{uri?, queue?}`                   |
| POST    | `/pause` / `/toggle` / `/stop` |                                |
| POST    | `/next` / `/prev`           |                                    |
| POST    | `/seek`                     | `{seconds}`                        |
| POST    | `/volume`                   | `{level: 0..100}` (volume MPD)     |
| GET     | `/queue`                    | liste de la queue                  |
| POST    | `/queue`                    | `{uris, replace?, play?}`          |
| DELETE  | `/queue`                    | vide la queue                      |
| GET     | `/zones`                    | clients/groupes/streams Snapcast   |
| POST    | `/zones/:id/volume`         | `{percent, muted?}`                |
| POST    | `/zones/:id/name`           | `{name}`                           |
| POST    | `/groups/:id/stream`        | `{stream_id}`                      |
| POST    | `/groups/:id/clients`       | `{clients: [...ids]}`              |
| POST    | `/library/update`           | force réindexation MPD             |

## Logs / debug

```bash
journalctl -u aurum-bridge -f
journalctl -u mpd -f
journalctl -u snapserver -f
mpc -h 127.0.0.1 status        # contrôle direct MPD en CLI
```
