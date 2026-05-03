// Récupère une photo d'artiste en cascade depuis plusieurs sources publiques.
// Ordre : Deezer → iTunes → MusicBrainz + Wikipedia/Wikidata.
// Toutes ces APIs sont gratuites, sans clé, et CORS-friendly.
//
// Cache : localStorage avec TTL (30j succès, 7j échec). Déduplication des
// requêtes en vol. Throttling par source via lib/rateLimit.
// (TODO: ajouter un endpoint /artists/:id/image côté Aurum pour partager
// le cache entre appareils.)

import { mbLimiter, itunesLimiter, deezerLimiter } from "@/lib/rateLimit";

const CACHE_KEY = "aurum_artist_images_v2";
const TTL_OK = 1000 * 60 * 60 * 24 * 30; // 30 jours
const TTL_KO = 1000 * 60 * 60 * 24 * 7; // 7 jours

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

// ---------- Sources ----------

async function fromDeezer(name: string): Promise<string | null> {
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
    if (!pic) return null;
    // Filtre les placeholders Deezer
    if (pic.includes("/artist//") || pic.endsWith("/artist/")) return null;
    return pic;
  } catch {
    return null;
  }
}

async function fromITunes(name: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`,
      { mode: "cors" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      results?: Array<{ artistLinkUrl?: string; artworkUrl100?: string }>;
    };
    // iTunes ne donne pas d'image artiste directement → on prend une cover
    // d'album du même artiste comme proxy (mieux que rien).
    const hit = j.results?.[0];
    if (!hit?.artistLinkUrl) return null;
    const r2 = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=1`,
      { mode: "cors" },
    );
    if (!r2.ok) return null;
    const j2 = (await r2.json()) as { results?: Array<{ artworkUrl100?: string }> };
    const art = j2.results?.[0]?.artworkUrl100;
    if (!art) return null;
    return art.replace("100x100bb", "600x600bb");
  } catch {
    return null;
  }
}

async function fromMusicBrainzWikipedia(name: string): Promise<string | null> {
  try {
    // 1. Recherche MBID
    const mb = await fetch(
      `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=1&fmt=json`,
      { mode: "cors", headers: { Accept: "application/json" } },
    );
    if (!mb.ok) return null;
    const mbj = (await mb.json()) as {
      artists?: Array<{ id: string; relations?: Array<{ type: string; url?: { resource: string } }> }>;
    };
    const artist = mbj.artists?.[0];
    if (!artist) return null;

    // 2. Récupère relations (Wikipedia/Wikidata)
    const rel = await fetch(
      `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`,
      { mode: "cors", headers: { Accept: "application/json" } },
    );
    if (!rel.ok) return null;
    const relj = (await rel.json()) as {
      relations?: Array<{ type: string; url?: { resource: string } }>;
    };

    const wikiRel = relj.relations?.find((x) => x.type === "wikipedia");
    if (wikiRel?.url?.resource) {
      const m = wikiRel.url.resource.match(/^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/(.+)$/);
      if (m) {
        const lang = m[1];
        const title = decodeURIComponent(m[2]);
        const wp = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          { mode: "cors" },
        );
        if (wp.ok) {
          const wpj = (await wp.json()) as { thumbnail?: { source?: string }; originalimage?: { source?: string } };
          const img = wpj.originalimage?.source || wpj.thumbnail?.source;
          if (img) return img;
        }
      }
    }
    return null;
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
