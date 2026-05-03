// Récupère une pochette d'album avec cache + cascade.
// Priorité : Aurum local (/covers/:id si has_cover) → Deezer → iTunes → Cover Art Archive.
//
// Cache localStorage 30j succès / 7j échec.

import { aurum } from "@/lib/aurum";

const CACHE_KEY = "aurum_album_covers_v1";
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
const keyOf = (artist: string, title: string) => `${norm(artist)}::${norm(title)}`;

export type CoverInput = {
  albumId: string;
  artistName: string;
  title: string;
  hasCover: boolean;
};

/** Renvoie immédiatement la meilleure URL connue sans appel réseau. */
export function getInstantCover(input: CoverInput): string | null {
  if (input.hasCover) return aurum.coverUrl(input.albumId);
  const e = readCache()[keyOf(input.artistName, input.title)];
  if (!e) return null;
  const ttl = e.url ? TTL_OK : TTL_KO;
  if (Date.now() - e.ts > ttl) return null;
  return e.url;
}

async function fromDeezer(artist: string, title: string): Promise<string | null> {
  try {
    const q = `artist:"${artist}" album:"${title}"`;
    const r = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=1&output=json`,
      { mode: "cors" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Array<{ cover_xl?: string; cover_big?: string }> };
    return j.data?.[0]?.cover_xl || j.data?.[0]?.cover_big || null;
  } catch {
    return null;
  }
}

async function fromITunes(artist: string, title: string): Promise<string | null> {
  try {
    const term = `${artist} ${title}`;
    const r = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=1`,
      { mode: "cors" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: Array<{ artworkUrl100?: string }> };
    const art = j.results?.[0]?.artworkUrl100;
    if (!art) return null;
    return art.replace("100x100bb", "1000x1000bb");
  } catch {
    return null;
  }
}

async function fromCoverArtArchive(artist: string, title: string): Promise<string | null> {
  try {
    const q = `release:"${title}" AND artist:"${artist}"`;
    const r = await fetch(
      `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(q)}&limit=1&fmt=json`,
      { mode: "cors", headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { releases?: Array<{ id: string }> };
    const id = j.releases?.[0]?.id;
    if (!id) return null;
    // CAA front-cover (302 vers archive.org)
    return `https://coverartarchive.org/release/${id}/front-500`;
  } catch {
    return null;
  }
}

export async function fetchAlbumCover(input: CoverInput): Promise<string | null> {
  if (input.hasCover) return aurum.coverUrl(input.albumId);

  const k = keyOf(input.artistName, input.title);
  const cached = getInstantCover(input);
  if (cached !== null) return cached;
  // Si cache négatif récent, getInstantCover renvoie null après TTL → on rejoue
  const entry = readCache()[k];
  if (entry && Date.now() - entry.ts < TTL_KO && entry.url === null) return null;

  const ex = inflight.get(k);
  if (ex) return ex;

  const p = (async () => {
    let url: string | null = null;
    let src = "none";

    url = await fromDeezer(input.artistName, input.title);
    if (url) src = "deezer";

    if (!url) {
      url = await fromITunes(input.artistName, input.title);
      if (url) src = "itunes";
    }
    if (!url) {
      url = await fromCoverArtArchive(input.artistName, input.title);
      if (url) src = "caa";
    }

    const cache = readCache();
    cache[k] = { url, ts: Date.now(), src };
    writeCache(cache);
    return url;
  })().finally(() => inflight.delete(k));

  inflight.set(k, p);
  return p;
}
