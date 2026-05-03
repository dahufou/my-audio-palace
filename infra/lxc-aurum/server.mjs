// =============================================================================
//  Aurum HTTP Bridge
//  Petit serveur Node 20+ qui expose une API REST pour piloter MPD + Snapcast
//  depuis l'application Aurum (web).
//
//  - Pas de framework externe (juste node:http) → install rapide, pas de surface
//    d'attaque inutile.
//  - Auth simple par Bearer token (cf. /etc/aurum/bridge.env)
//  - CORS ouvert (Aurum est hébergé sur Lovable, donc accédé depuis Internet)
//
//  Routes :
//   GET  /health
//   GET  /status                 → état de lecture MPD courant
//   POST /play                   → body: { uri?: string, queue?: string[] }
//   POST /pause
//   POST /toggle
//   POST /stop
//   POST /next
//   POST /prev
//   POST /seek                   → body: { seconds: number }
//   POST /volume                 → body: { level: 0..100 }   (volume MPD logiciel)
//   GET  /queue
//   POST /queue                  → body: { uris: string[], replace?: boolean, play?: boolean }
//   DELETE /queue                → vide la queue
//   POST /queue/:pos/move        → body: { to: number }
//   DELETE /queue/:pos
//
//   Snapcast (zones / multi-room) :
//   GET  /zones                  → liste des clients (= zones) + groupes + streams
//   POST /zones/:id/volume       → body: { percent: 0..100, muted?: boolean }
//   POST /zones/:id/name         → body: { name: string }
//   POST /groups/:id/stream      → body: { stream_id: string }
//   POST /groups/:id/clients     → body: { clients: string[] }   (regrouper)
// =============================================================================

import { createServer } from "node:http";
import { connect as mpdConnect } from "mpd2";
import net from "node:net";

const PORT = Number(process.env.BRIDGE_PORT || 8080);
const TOKEN = process.env.BRIDGE_TOKEN || "";
const MPD_HOST = process.env.MPD_HOST || "127.0.0.1";
const MPD_PORT = Number(process.env.MPD_PORT || 6600);
const SNAP_HOST = process.env.SNAP_HOST || "127.0.0.1";
const SNAP_CTRL_PORT = Number(process.env.SNAP_CTRL_PORT || 1705);

if (!TOKEN) {
  console.error("[aurum-bridge] BRIDGE_TOKEN manquant — refus de démarrer");
  process.exit(1);
}

// -----------------------------------------------------------------------------
//  MPD client (auto-reconnect)
// -----------------------------------------------------------------------------
let mpd = null;
let mpdConnecting = null;

async function getMpd() {
  if (mpd) return mpd;
  if (mpdConnecting) return mpdConnecting;
  mpdConnecting = mpdConnect({ host: MPD_HOST, port: MPD_PORT })
    .then((client) => {
      mpd = client;
      client.on("close", () => {
        console.warn("[mpd] connexion fermée, reconnexion auto au prochain appel");
        mpd = null;
      });
      client.on("error", (e) => console.warn("[mpd] error:", e.message));
      console.log("[mpd] connecté");
      return client;
    })
    .finally(() => {
      mpdConnecting = null;
    });
  return mpdConnecting;
}

// -----------------------------------------------------------------------------
//  Snapcast JSON-RPC (TCP, line-delimited)
// -----------------------------------------------------------------------------
let snapId = 1;
function snapRpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SNAP_CTRL_PORT, SNAP_HOST);
    const id = snapId++;
    let buf = "";
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("snapcast rpc timeout"));
    }, 4000);
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            clearTimeout(timer);
            sock.end();
            if (msg.error) reject(new Error(msg.error.message || "rpc error"));
            else resolve(msg.result);
          }
        } catch (e) {
          /* notification, ignore */
        }
      }
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.write(JSON.stringify({ id, jsonrpc: "2.0", method, params }) + "\r\n");
  });
}

// -----------------------------------------------------------------------------
//  HTTP helpers
// -----------------------------------------------------------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

function send(res, status, body) {
  const payload = body == null ? "" : JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function authOk(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return false;
  return h.slice(7) === TOKEN;
}

// -----------------------------------------------------------------------------
//  Route handlers
// -----------------------------------------------------------------------------
async function handle(req, res, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  if (path === "/health") return send(res, 200, { ok: true, time: Date.now() });

  // ---------- MPD ----------
  if (path === "/status" && m === "GET") {
    const c = await getMpd();
    const [status, current] = await Promise.all([
      c.api.status.status(),
      c.api.status.currentsong(),
    ]);
    return send(res, 200, { status, current });
  }

  if (path === "/play" && m === "POST") {
    const body = await readJson(req);
    const c = await getMpd();
    if (Array.isArray(body.queue) && body.queue.length) {
      await c.api.queue.clear();
      for (const uri of body.queue) await c.api.queue.add(uri);
      await c.api.playback.play(0);
    } else if (body.uri) {
      await c.api.queue.clear();
      await c.api.queue.add(body.uri);
      await c.api.playback.play(0);
    } else {
      await c.api.playback.play();
    }
    return send(res, 200, { ok: true });
  }

  if (path === "/pause" && m === "POST") {
    const c = await getMpd();
    await c.api.playback.pause();
    return send(res, 200, { ok: true });
  }
  if (path === "/toggle" && m === "POST") {
    const c = await getMpd();
    await c.sendCommand("pause");
    return send(res, 200, { ok: true });
  }
  if (path === "/stop" && m === "POST") {
    const c = await getMpd();
    await c.api.playback.stop();
    return send(res, 200, { ok: true });
  }
  if (path === "/next" && m === "POST") {
    const c = await getMpd();
    await c.api.playback.next();
    return send(res, 200, { ok: true });
  }
  if (path === "/prev" && m === "POST") {
    const c = await getMpd();
    await c.api.playback.previous();
    return send(res, 200, { ok: true });
  }

  if (path === "/seek" && m === "POST") {
    const { seconds } = await readJson(req);
    const c = await getMpd();
    await c.sendCommand(`seekcur ${Number(seconds || 0)}`);
    return send(res, 200, { ok: true });
  }

  if (path === "/volume" && m === "POST") {
    const { level } = await readJson(req);
    const c = await getMpd();
    const v = Math.max(0, Math.min(100, Math.round(Number(level))));
    await c.sendCommand(`setvol ${v}`);
    return send(res, 200, { ok: true, level: v });
  }

  // ---------- Queue ----------
  if (path === "/queue" && m === "GET") {
    const c = await getMpd();
    const items = await c.api.queue.playlistinfo();
    return send(res, 200, { items });
  }
  if (path === "/queue" && m === "POST") {
    const { uris = [], replace = false, play = false } = await readJson(req);
    const c = await getMpd();
    if (replace) await c.api.queue.clear();
    for (const uri of uris) await c.api.queue.add(uri);
    if (play) await c.api.playback.play(0);
    return send(res, 200, { ok: true, added: uris.length });
  }
  if (path === "/queue" && m === "DELETE") {
    const c = await getMpd();
    await c.api.queue.clear();
    return send(res, 200, { ok: true });
  }

  let mq;
  if ((mq = path.match(/^\/queue\/(\d+)\/move$/)) && m === "POST") {
    const { to } = await readJson(req);
    const c = await getMpd();
    await c.sendCommand(`move ${Number(mq[1])} ${Number(to)}`);
    return send(res, 200, { ok: true });
  }
  if ((mq = path.match(/^\/queue\/(\d+)$/)) && m === "DELETE") {
    const c = await getMpd();
    await c.sendCommand(`delete ${Number(mq[1])}`);
    return send(res, 200, { ok: true });
  }

  // ---------- Snapcast / zones ----------
  if (path === "/zones" && m === "GET") {
    const result = await snapRpc("Server.GetStatus");
    const groups = result?.server?.groups || [];
    const streams = result?.server?.streams || [];
    const zones = [];
    for (const g of groups) {
      for (const cli of g.clients || []) {
        zones.push({
          id: cli.id,
          name: cli.config?.name || cli.host?.name || cli.id,
          host: cli.host?.ip,
          connected: cli.connected,
          volume: cli.config?.volume?.percent ?? 0,
          muted: !!cli.config?.volume?.muted,
          latency_ms: cli.config?.latency ?? 0,
          group_id: g.id,
          stream_id: g.stream_id,
        });
      }
    }
    return send(res, 200, { zones, groups, streams });
  }

  let mz;
  if ((mz = path.match(/^\/zones\/([^/]+)\/volume$/)) && m === "POST") {
    const { percent, muted } = await readJson(req);
    const params = {
      id: decodeURIComponent(mz[1]),
      volume: {
        percent: Math.max(0, Math.min(100, Math.round(Number(percent ?? 0)))),
        muted: !!muted,
      },
    };
    const r = await snapRpc("Client.SetVolume", params);
    return send(res, 200, r);
  }
  if ((mz = path.match(/^\/zones\/([^/]+)\/name$/)) && m === "POST") {
    const { name } = await readJson(req);
    const r = await snapRpc("Client.SetName", {
      id: decodeURIComponent(mz[1]),
      name: String(name || "").slice(0, 64),
    });
    return send(res, 200, r);
  }

  let mg;
  if ((mg = path.match(/^\/groups\/([^/]+)\/stream$/)) && m === "POST") {
    const { stream_id } = await readJson(req);
    const r = await snapRpc("Group.SetStream", {
      id: decodeURIComponent(mg[1]),
      stream_id: String(stream_id),
    });
    return send(res, 200, r);
  }
  if ((mg = path.match(/^\/groups\/([^/]+)\/clients$/)) && m === "POST") {
    const { clients } = await readJson(req);
    const r = await snapRpc("Group.SetClients", {
      id: decodeURIComponent(mg[1]),
      clients: Array.isArray(clients) ? clients : [],
    });
    return send(res, 200, r);
  }

  // ---------- Library passthrough (basique) ----------
  if (path === "/library/update" && m === "POST") {
    const c = await getMpd();
    await c.sendCommand("update");
    return send(res, 202, { ok: true });
  }

  return send(res, 404, { error: "not_found", path });
}

// -----------------------------------------------------------------------------
//  Server
// -----------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (url.pathname === "/health") {
    // Health public (sans auth) pour les checks réseau
    return send(res, 200, { ok: true });
  }
  if (!authOk(req)) return send(res, 401, { error: "unauthorized" });

  try {
    await handle(req, res, url);
  } catch (e) {
    console.error("[bridge] error", e);
    send(res, 500, { error: "internal", message: e?.message || String(e) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[aurum-bridge] listening on :${PORT} (mpd ${MPD_HOST}:${MPD_PORT}, snap ${SNAP_HOST}:${SNAP_CTRL_PORT})`);
});
