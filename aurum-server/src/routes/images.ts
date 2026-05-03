/**
 * Endpoints de récupération d'images externes (artistes & albums).
 *
 * Stratégie :
 *  - On regarde le cache DB (artist_images / album_external_covers).
 *  - Si frais → 302 vers l'URL distante (le navigateur la cache aussi).
 *  - Si périmé/absent → fetch en cascade, on store, puis on redirige.
 *  - Si tout échoue → 404 ; le frontend affichera son fallback.
 *
 * TTL : 90j succès, 7j échec.
 * Anti-stampede : map en mémoire des fetches en vol.
 */

import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { findAlbumCover, findArtistImage } from "../lib/imageProviders.js";

const TTL_OK_DAYS = 90;
const TTL_KO_DAYS = 7;

const inflight = new Map<string, Promise<{ url: string | null; source: string }>>();

function expiresFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function imageRoutes(app: FastifyInstance) {
  // ---- Artist image -----------------------------------------------------
  app.get("/artists/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };

    // 1. Cache DB
    const cached = await query<{ url: string | null; expires_at: Date }>(
      `select url, expires_at from artist_images where artist_id = $1`,
      [id],
    );
    const row = cached.rows[0];
    if (row && row.expires_at > new Date()) {
      if (!row.url) return reply.code(404).send({ error: "no_image" });
      return reply.redirect(row.url, 302);
    }

    // 2. Charge le nom de l'artiste
    const a = await query<{ name: string }>(
      `select name from artists where id = $1`,
      [id],
    );
    if (!a.rows[0]) return reply.code(404).send({ error: "artist_not_found" });
    const name = a.rows[0].name;

    // 3. Fetch (avec dédup en vol)
    const key = `artist:${id}`;
    let p = inflight.get(key);
    if (!p) {
      p = findArtistImage(name).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const { url, source } = await p;

    // 4. Persiste cache
    const expires = expiresFromNow(url ? TTL_OK_DAYS : TTL_KO_DAYS);
    await query(
      `insert into artist_images (artist_id, url, source, fetched_at, expires_at)
         values ($1, $2, $3, now(), $4)
       on conflict (artist_id) do update
         set url = excluded.url,
             source = excluded.source,
             fetched_at = excluded.fetched_at,
             expires_at = excluded.expires_at`,
      [id, url, source, expires],
    );

    if (!url) return reply.code(404).send({ error: "no_image" });
    return reply.redirect(url, 302);
  });

  // ---- Album external cover ---------------------------------------------
  // Utilisé seulement si l'album n'a pas de cover_path locale.
  app.get("/albums/:id/external-cover", async (req, reply) => {
    const { id } = req.params as { id: string };

    const cached = await query<{ url: string | null; expires_at: Date }>(
      `select url, expires_at from album_external_covers where album_id = $1`,
      [id],
    );
    const row = cached.rows[0];
    if (row && row.expires_at > new Date()) {
      if (!row.url) return reply.code(404).send({ error: "no_cover" });
      return reply.redirect(row.url, 302);
    }

    const a = await query<{ title: string; artist_name: string }>(
      `select al.title, ar.name as artist_name
         from albums al join artists ar on ar.id = al.artist_id
         where al.id = $1`,
      [id],
    );
    if (!a.rows[0]) return reply.code(404).send({ error: "album_not_found" });
    const { title, artist_name } = a.rows[0];

    const key = `album:${id}`;
    let p = inflight.get(key);
    if (!p) {
      p = findAlbumCover(artist_name, title).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const { url, source } = await p;

    const expires = expiresFromNow(url ? TTL_OK_DAYS : TTL_KO_DAYS);
    await query(
      `insert into album_external_covers (album_id, url, source, fetched_at, expires_at)
         values ($1, $2, $3, now(), $4)
       on conflict (album_id) do update
         set url = excluded.url,
             source = excluded.source,
             fetched_at = excluded.fetched_at,
             expires_at = excluded.expires_at`,
      [id, url, source, expires],
    );

    if (!url) return reply.code(404).send({ error: "no_cover" });
    return reply.redirect(url, 302);
  });
}
