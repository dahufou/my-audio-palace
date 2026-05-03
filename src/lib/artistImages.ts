// Récupération des photos d'artistes via l'API publique Deezer.
// - Pas de clé requise
// - CORS ouvert
// - Cache localStorage (avec TTL) pour éviter de re-spammer l'API
// - Déduplication des requêtes en vol

const CACHE_KEY = "aurum_artist_images_v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours
const NEG_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours pour les "non trouvés"

type CacheEntry = { url: string | null; ts: number };
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
    // quota ou indispo : on ignore
  }
}

const inflight = new Map<string, Promise<string | null>>();

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function getCachedArtistImage(name: string): string | null | undefined {
  const cache = readCache();
  const e = cache[normalize(name)];
  if (!e) return undefined;
  const ttl = e.url ? TTL_MS : NEG_TTL_MS;
  if (Date.now() - e.ts > ttl) return undefined;
  return e.url;
}

export async function fetchArtistImage(name: string): Promise<string | null> {
  const key = normalize(name);
  const cached = getCachedArtistImage(name);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1&output=json`;
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(`Deezer ${res.status}`);
      const json = (await res.json()) as {
        data?: Array<{ name: string; picture_xl?: string; picture_big?: string; picture_medium?: string }>;
      };
      const hit = json.data?.[0];
      const pic = hit?.picture_xl || hit?.picture_big || hit?.picture_medium || null;
      // Filtre les placeholders Deezer (image grise par défaut)
      const isPlaceholder = pic?.includes("/artist//") || pic?.endsWith("/artist/") || false;
      const finalUrl = pic && !isPlaceholder ? pic : null;

      const cache = readCache();
      cache[key] = { url: finalUrl, ts: Date.now() };
      writeCache(cache);
      return finalUrl;
    } catch {
      const cache = readCache();
      cache[key] = { url: null, ts: Date.now() };
      writeCache(cache);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
