// Récupère une photo d'artiste avec cascade de sources gratuites & sans clé.
//
// Ordre :
//   1. Deezer (rapide, large catalogue, mais souvent placeholder)
//   2. Wikipedia REST summary (image principale de la page artiste)
//   3. iTunes (fallback : cover album comme proxy visuel)
//   4. MusicBrainz → Wikipedia (via MBID, plus précis mais rate-limited 1/s)
//
// Cache localStorage (30j succès / 7j échec). Throttling par source.

import { mbLimiter, itunesLimiter, deezerLimiter } from "@/lib/rateLimit";

const CACHE_KEY = "aurum_artist_images_v3";
const TTL_OK = 1000 * 60 * 60 * 24 * 30;
const TTL_KO = 1000 * 60 * 60 * 24 * 7;

type CacheEntry = { url: string | null; ts: number; src?: string };
type CacheShape = Record<string, CacheEntry>;

function readCache(): CacheShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : {};
  } catch {
    return {};
  }
}
function writeCache(c: CacheShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

const inflight = new Map<string, Promise<string | null>>();
const norm = (s: string) => s.trim().toLowerCase();

export function getCachedArtistImage(name: string): string | null | undefined {
  const e = readCache()[norm(name)];
  if (!e) return undefined;
  const ttl = e.url ? TTL_OK : TTL_KO;
  if (Date.now() - e.ts > ttl) return undefined;
  return e.url;
}

// ---------- Helpers ----------

function isDeezerPlaceholder(url: string): boolean {
  // Les placeholders Deezer ont toujours le même hash
  return (
    url.includes("/artist//") ||
    url.endsWith("/artist/") ||
    url.includes("2a96cbd8b46e442fc41c2b86b821562f") // hash placeholder connu
  );
}

// ---------- Sources ----------

async function fromDeezer(name: string): Promise<string | null> {
  return deezerLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1&output=json`,
        { mode: "cors" },
      );
      if (!r.ok) return null;
      const j = (await r.json()) as {
        data?: Array<{ name: string; picture_xl?: string; picture_big?: string }>;
      };
      const hit = j.data?.[0];
      const pic = hit?.picture_xl || hit?.picture_big || null;
      if (!pic || isDeezerPlaceholder(pic)) return null;
      return pic;
    } catch {
      return null;
    }
  });
}

/**
 * Wikipedia REST API : pas de rate limit strict, CORS OK.
 * On essaie plusieurs variantes du nom.
 */
async function fromWikipediaDirect(name: string): Promise<string | null> {
  const variants = [
    name,
    `${name} (musician)`,
    `${name} (band)`,
    `${name} (singer)`,
    `${name} (group)`,
  ];
  for (const lang of ["en", "fr"]) {
    for (const v of variants) {
      try {
        const r = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}?redirect=true`,
          { mode: "cors" },
        );
        if (!r.ok) continue;
        const j = (await r.json()) as {
          type?: string;
          originalimage?: { source?: string };
          thumbnail?: { source?: string };
          description?: string;
        };
        if (j.type === "disambiguation") continue;
        const img = j.originalimage?.source || j.thumbnail?.source;
        if (img) return img;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

async function fromITunes(name: string): Promise<string | null> {
  return itunesLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=1`,
        { mode: "cors" },
      );
      if (!r.ok) return null;
      const j = (await r.json()) as { results?: Array<{ artworkUrl100?: string }> };
      const art = j.results?.[0]?.artworkUrl100;
      if (!art) return null;
      return art.replace("100x100bb", "600x600bb");
    } catch {
      return null;
    }
  });
}

async function fromMusicBrainzWikipedia(name: string): Promise<string | null> {
  try {
    const mb = await mbLimiter.run(() =>
      fetch(
        `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=1&fmt=json`,
        { mode: "cors", headers: { Accept: "application/json" } },
      ),
    );
    if (!mb.ok) return null;
    const mbj = (await mb.json()) as { artists?: Array<{ id: string }> };
    const artist = mbj.artists?.[0];
    if (!artist) return null;

    const rel = await mbLimiter.run(() =>
      fetch(
        `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`,
        { mode: "cors", headers: { Accept: "application/json" } },
      ),
    );
    if (!rel.ok) return null;
    const relj = (await rel.json()) as {
      relations?: Array<{ type: string; url?: { resource: string } }>;
    };

    const wikiRel = relj.relations?.find((x) => x.type === "wikipedia");
    if (!wikiRel?.url?.resource) return null;
    const m = wikiRel.url.resource.match(/^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/(.+)$/);
    if (!m) return null;
    const lang = m[1];
    const title = decodeURIComponent(m[2]);
    const wp = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { mode: "cors" },
    );
    if (!wp.ok) return null;
    const wpj = (await wp.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    return wpj.originalimage?.source || wpj.thumbnail?.source || null;
  } catch {
    return null;
  }
}

// ---------- Orchestrateur ----------

export async function fetchArtistImage(name: string): Promise<string | null> {
  const key = norm(name);
  const cached = getCachedArtistImage(name);
  if (cached !== undefined) return cached;

  const ex = inflight.get(key);
  if (ex) return ex;

  const p = (async () => {
    let url: string | null = null;
    let src = "none";

    url = await fromDeezer(name);
    if (url) src = "deezer";

    if (!url) {
      url = await fromWikipediaDirect(name);
      if (url) src = "wikipedia";
    }
    if (!url) {
      url = await fromITunes(name);
      if (url) src = "itunes";
    }
    if (!url) {
      url = await fromMusicBrainzWikipedia(name);
      if (url) src = "mb+wiki";
    }

    const cache = readCache();
    cache[key] = { url, ts: Date.now(), src };
    writeCache(cache);
    return url;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}
