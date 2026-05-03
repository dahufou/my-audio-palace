import type { FastifyInstance } from "fastify";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { query } from "../db.js";
import { scanLibrary } from "../scanner/scan.js";
import { config } from "../config.js";

export async function libraryRoutes(app: FastifyInstance) {
  // ---- Artists -----------------------------------------------------------
  app.get("/library/artists", async (req) => {
    const { q, limit = "200", offset = "0" } = (req.query ?? {}) as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 200, 500);
    const off = parseInt(offset, 10) || 0;
    const params: unknown[] = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `where name ilike $${params.length}`;
    }
    params.push(lim, off);
    const r = await query(
      `select a.id, a.name,
              (select count(*) from albums where artist_id = a.id) as albums_count,
              (select count(*) from tracks where artist_id = a.id) as tracks_count
         from artists a
         ${where}
         order by a.name asc
         limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return { items: r.rows };
  });

  app.get("/library/artists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await query(`select id, name from artists where id = $1`, [id]);
    if (!a.rows[0]) return reply.code(404).send({ error: "not_found" });
    const albums = await query(
      `select id, title, year, cover_path is not null as has_cover
         from albums where artist_id = $1
         order by year nulls last, title`,
      [id],
    );
    return { ...a.rows[0], albums: albums.rows };
  });

  // ---- Albums ------------------------------------------------------------
  app.get("/library/albums", async (req) => {
    const { q, limit = "200", offset = "0" } = (req.query ?? {}) as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 200, 500);
    const off = parseInt(offset, 10) || 0;
    const params: unknown[] = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `where al.title ilike $${params.length} or ar.name ilike $${params.length}`;
    }
    params.push(lim, off);
    const r = await query(
      `select al.id, al.title, al.year, al.artist_id, ar.name as artist_name,
              al.cover_path is not null as has_cover,
              (select count(*) from tracks where album_id = al.id) as tracks_count
         from albums al
         join artists ar on ar.id = al.artist_id
         ${where}
         order by ar.name, al.year nulls last, al.title
         limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    return { items: r.rows };
  });

  app.get("/library/albums/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await query(
      `select al.id, al.title, al.year, al.artist_id, ar.name as artist_name,
              al.cover_path is not null as has_cover, al.folder_path
         from albums al join artists ar on ar.id = al.artist_id
         where al.id = $1`,
      [id],
    );
    if (!a.rows[0]) return reply.code(404).send({ error: "not_found" });
    const tracks = await query(
      `select id, title, track_no, disc_no, duration_sec,
              codec, container, bitrate, sample_rate, channels, lossless
         from tracks
         where album_id = $1
         order by coalesce(disc_no,1), coalesce(track_no,0), title`,
      [id],
    );
    return { ...a.rows[0], tracks: tracks.rows };
  });

  // ---- Tracks ------------------------------------------------------------
  app.get("/library/tracks/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await query(
      `select t.*, ar.name as artist_name, al.title as album_title
         from tracks t
         join artists ar on ar.id = t.artist_id
         join albums  al on al.id = t.album_id
         where t.id = $1`,
      [id],
    );
    if (!r.rows[0]) return reply.code(404).send({ error: "not_found" });
    return r.rows[0];
  });

  // ---- Search ------------------------------------------------------------
  app.get("/library/search", async (req) => {
    const { q = "" } = (req.query ?? {}) as { q?: string };
    const term = q.trim();
    if (!term) return { artists: [], albums: [], tracks: [] };
    const like = `%${term}%`;
    const [ar, al, tr] = await Promise.all([
      query(`select id, name from artists where name ilike $1 order by name limit 25`, [like]),
      query(
        `select al.id, al.title, ar.name as artist_name, al.year
           from albums al join artists ar on ar.id = al.artist_id
           where al.title ilike $1 or ar.name ilike $1
           order by ar.name, al.title limit 50`,
        [like],
      ),
      query(
        `select t.id, t.title, ar.name as artist_name, al.title as album_title
           from tracks t
           join artists ar on ar.id = t.artist_id
           join albums  al on al.id = t.album_id
           where t.title ilike $1
           order by t.title limit 50`,
        [like],
      ),
    ]);
    return { artists: ar.rows, albums: al.rows, tracks: tr.rows };
  });

  // ---- Stats -------------------------------------------------------------
  app.get("/library/stats", async () => {
    const r = await query<{ artists: string; albums: string; tracks: string }>(
      `select
         (select count(*) from artists)::text as artists,
         (select count(*) from albums)::text  as albums,
         (select count(*) from tracks)::text  as tracks`,
    );
    const row = r.rows[0];
    return {
      artists: Number(row.artists),
      albums: Number(row.albums),
      tracks: Number(row.tracks),
      music_path: config.MUSIC_PATH,
    };
  });

  // ---- Scan trigger ------------------------------------------------------
  // Protégé par BRIDGE_TOKEN (header X-Bridge-Token) — auth user viendra plus tard.
  app.post("/library/scan", async (req, reply) => {
    const token = req.headers["x-bridge-token"];
    if (token !== config.BRIDGE_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    // Async fire-and-forget : on répond tout de suite.
    scanLibrary().catch((err) => app.log.error({ err }, "scan failed"));
    return reply.code(202).send({ status: "scan_started" });
  });

  // ---- Cover art ---------------------------------------------------------
  app.get("/covers/:albumId", async (req, reply) => {
    const { albumId } = req.params as { albumId: string };
    const r = await query<{ cover_path: string | null; cover_mime: string | null }>(
      `select cover_path, cover_mime from albums where id = $1`,
      [albumId],
    );
    const row = r.rows[0];
    if (!row?.cover_path) return reply.code(404).send({ error: "no_cover" });
    try {
      const st = await stat(row.cover_path);
      const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
      if (req.headers["if-none-match"] === etag) {
        return reply.code(304).send();
      }
      reply
        .header("Content-Type", row.cover_mime || "image/jpeg")
        .header("Cache-Control", "public, max-age=86400")
        .header("ETag", etag)
        .header("Content-Length", String(st.size));
      return reply.send(createReadStream(row.cover_path));
    } catch {
      return reply.code(404).send({ error: "cover_missing" });
    }
  });

  // ---- Audio streaming (HTTP Range) --------------------------------------
  app.get("/stream/:trackId", async (req, reply) => {
    const { trackId } = req.params as { trackId: string };
    const r = await query<{ file_path: string; container: string | null; codec: string | null }>(
      `select file_path, container, codec from tracks where id = $1`,
      [trackId],
    );
    const row = r.rows[0];
    if (!row?.file_path) return reply.code(404).send({ error: "not_found" });

    let st;
    try {
      st = await stat(row.file_path);
    } catch {
      return reply.code(404).send({ error: "file_missing" });
    }

    const size = st.size;
    const mime = guessAudioMime(row.container, row.codec, row.file_path);
    const etag = `"${size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;

    if (req.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }

    const range = req.headers.range;
    reply
      .header("Accept-Ranges", "bytes")
      .header("Content-Type", mime)
      .header("ETag", etag)
      .header("Cache-Control", "private, max-age=0");

    if (!range) {
      reply.header("Content-Length", String(size));
      return reply.send(createReadStream(row.file_path));
    }

    // Parse "bytes=start-end"
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      return reply.code(416).header("Content-Range", `bytes */${size}`).send();
    }
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end   = m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      return reply.code(416).header("Content-Range", `bytes */${size}`).send();
    }
    const chunk = end - start + 1;
    reply
      .code(206)
      .header("Content-Range", `bytes ${start}-${end}/${size}`)
      .header("Content-Length", String(chunk));
    return reply.send(createReadStream(row.file_path, { start, end }));
  });
}

function guessAudioMime(container: string | null, codec: string | null, path: string): string {
  const ext = (path.split(".").pop() || "").toLowerCase();
  const c = (container || codec || ext || "").toLowerCase();
  if (c.includes("flac")) return "audio/flac";
  if (c.includes("mp3")) return "audio/mpeg";
  if (c.includes("opus")) return "audio/ogg";
  if (c.includes("ogg") || c.includes("vorbis")) return "audio/ogg";
  if (c.includes("alac") || c === "m4a" || c.includes("aac") || c.includes("mp4")) return "audio/mp4";
  if (c.includes("wav")) return "audio/wav";
  if (c.includes("aiff")) return "audio/aiff";
  return "application/octet-stream";
}
