/**
 * Cascade multi-sources pour récupérer une photo d'artiste ou une pochette
 * d'album. Toutes les sources sont rate-limitées ; les résultats sont
 * destinés à être cachés en DB par le caller.
 *
 * Sources artiste : Spotify → Deezer → Last.fm → Wikipedia → MusicBrainz+Wikipedia
 * Sources album   : Spotify → Deezer → iTunes → Cover Art Archive
 */

import { config } from "../config.js";
import { log } from "../log.js";
import {
  deezerLimiter,
  itunesLimiter,
  lastfmLimiter,
  mbLimiter,
  spotifyLimiter,
  wikipediaLimiter,
} from "./rateLimit.js";
import { artistNameVariants, cleanAlbumTitle } from "./nameUtils.js";

const UA = "AurumServer/0.1 (https://github.com/dahufou/my-audio-palace)";

// ---------- Spotify (Client Credentials, token caché en mémoire) ----------

let spotifyToken: { value: string; expiresAt: number } | null = null;
async function getSpotifyToken(): Promise<string | null> {
  if (!config.SPOTIFY_CLIENT_ID || !config.SPOTIFY_CLIENT_SECRET) return null;
  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 60_000) return spotifyToken.value;

  try {
    const auth = Buffer.from(
      `${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`,
    ).toString("base64");
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!r.ok) {
      log.warn({ status: r.status }, "spotify token failed");
      return null;
    }
    const j = (await r.json()) as { access_token: string; expires_in: number };
    spotifyToken = {
      value: j.access_token,
      expiresAt: Date.now() + j.expires_in * 1000,
    };
    return spotifyToken.value;
  } catch (err) {
    log.warn({ err }, "spotify token error");
    return null;
  }
}

async function spotifySearchArtist(name: string): Promise<string | null> {
  const token = await getSpotifyToken();
  if (!token) return null;
  return spotifyLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://api.spotify.com/v1/search?type=artist&limit=1&q=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) return null;
      const j = (await r.json()) as {
        artists?: { items?: Array<{ images?: Array<{ url: string; width: number }> }> };
      };
      const imgs = j.artists?.items?.[0]?.images || [];
      if (!imgs.length) return null;
      const sorted = [...imgs].sort((a, b) => (b.width || 0) - (a.width || 0));
      return sorted[0]?.url || null;
    } catch {
      return null;
    }
  });
}

async function spotifySearchAlbum(artist: string, title: string): Promise<string | null> {
  const token = await getSpotifyToken();
  if (!token) return null;
  return spotifyLimiter.run(async () => {
    try {
      const q = `album:${title} artist:${artist}`;
      const r = await fetch(
        `https://api.spotify.com/v1/search?type=album&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) return null;
      const j = (await r.json()) as {
        albums?: { items?: Array<{ images?: Array<{ url: string; width: number }> }> };
      };
      const imgs = j.albums?.items?.[0]?.images || [];
      if (!imgs.length) return null;
      const sorted = [...imgs].sort((a, b) => (b.width || 0) - (a.width || 0));
      return sorted[0]?.url || null;
    } catch {
      return null;
    }
  });
}

// ---------- Deezer ----------

function isDeezerPlaceholder(url: string): boolean {
  return (
    url.includes("/artist//") ||
    url.endsWith("/artist/") ||
    url.includes("2a96cbd8b46e442fc41c2b86b821562f")
  );
}

async function deezerArtist(name: string): Promise<string | null> {
  return deezerLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1&output=json`,
      );
      if (!r.ok) return null;
      const j = (await r.json()) as {
        data?: Array<{ picture_xl?: string; picture_big?: string }>;
      };
      const pic = j.data?.[0]?.picture_xl || j.data?.[0]?.picture_big || null;
      if (!pic || isDeezerPlaceholder(pic)) return null;
      return pic;
    } catch {
      return null;
    }
  });
}

async function deezerAlbum(artist: string, title: string): Promise<string | null> {
  return deezerLimiter.run(async () => {
    try {
      const q = `artist:"${artist}" album:"${title}"`;
      const r = await fetch(
        `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=1&output=json`,
      );
      if (!r.ok) return null;
      const j = (await r.json()) as { data?: Array<{ cover_xl?: string; cover_big?: string }> };
      return j.data?.[0]?.cover_xl || j.data?.[0]?.cover_big || null;
    } catch {
      return null;
    }
  });
}

// ---------- Last.fm ----------

async function lastfmArtist(name: string): Promise<string | null> {
  if (!config.LASTFM_API_KEY) return null;
  return lastfmLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(name)}&api_key=${config.LASTFM_API_KEY}&format=json`,
      );
      if (!r.ok) return null;
      const j = (await r.json()) as {
        artist?: { image?: Array<{ "#text": string; size: string }> };
      };
      // Last.fm renvoie une URL placeholder fixe depuis 2019.
      // On essaie quand même au cas où l'artiste a une vraie image.
      const imgs = j.artist?.image || [];
      const big =
        imgs.find((i) => i.size === "mega")?.["#text"] ||
        imgs.find((i) => i.size === "extralarge")?.["#text"] ||
        null;
      if (!big) return null;
      // Filtre le placeholder Last.fm
      if (big.includes("2a96cbd8b46e442fc41c2b86b821562f")) return null;
      return big;
    } catch {
      return null;
    }
  });
}

// ---------- Wikipedia direct ----------

async function wikipediaArtist(name: string): Promise<string | null> {
  const variants = [
    name,
    `${name} (musician)`,
    `${name} (band)`,
    `${name} (singer)`,
    `${name} (group)`,
    `${name} (musicien)`,
    `${name} (groupe)`,
  ];
  for (const lang of ["en", "fr"]) {
    for (const v of variants) {
      const found = await wikipediaLimiter.run(async () => {
        try {
          const r = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}?redirect=true`,
            { headers: { "User-Agent": UA } },
          );
          if (!r.ok) return null;
          const j = (await r.json()) as {
            type?: string;
            originalimage?: { source?: string };
            thumbnail?: { source?: string };
          };
          if (j.type === "disambiguation") return null;
          return j.originalimage?.source || j.thumbnail?.source || null;
        } catch {
          return null;
        }
      });
      if (found) return found;
    }
  }
  return null;
}

// ---------- iTunes ----------

async function itunesArtist(name: string): Promise<string | null> {
  return itunesLimiter.run(async () => {
    try {
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=1`,
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

async function itunesAlbum(artist: string, title: string): Promise<string | null> {
  return itunesLimiter.run(async () => {
    try {
      const term = `${artist} ${title}`;
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=1`,
      );
      if (!r.ok) return null;
      const j = (await r.json()) as { results?: Array<{ artworkUrl100?: string }> };
      const art = j.results?.[0]?.artworkUrl100;
      if (!art) return null;
      return art.replace("100x100bb", "1000x1000bb");
    } catch {
      return null;
    }
  });
}

// ---------- MusicBrainz + Wikipedia (fallback ultime) ----------

async function mbWikiArtist(name: string): Promise<string | null> {
  try {
    const mb = await mbLimiter.run(() =>
      fetch(
        `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&limit=1&fmt=json`,
        { headers: { Accept: "application/json", "User-Agent": UA } },
      ),
    );
    if (!mb.ok) return null;
    const mbj = (await mb.json()) as { artists?: Array<{ id: string }> };
    const artist = mbj.artists?.[0];
    if (!artist) return null;

    const rel = await mbLimiter.run(() =>
      fetch(
        `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`,
        { headers: { Accept: "application/json", "User-Agent": UA } },
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
    return wikipediaLimiter.run(async () => {
      const wp = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { "User-Agent": UA } },
      );
      if (!wp.ok) return null;
      const wpj = (await wp.json()) as {
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      return wpj.originalimage?.source || wpj.thumbnail?.source || null;
    });
  } catch {
    return null;
  }
}

async function caaAlbum(artist: string, title: string): Promise<string | null> {
  try {
    const q = `release:"${title}" AND artist:"${artist}"`;
    const r = await mbLimiter.run(() =>
      fetch(
        `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(q)}&limit=1&fmt=json`,
        { headers: { Accept: "application/json", "User-Agent": UA } },
      ),
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { releases?: Array<{ id: string }> };
    const id = j.releases?.[0]?.id;
    if (!id) return null;
    return `https://coverartarchive.org/release/${id}/front-500`;
  } catch {
    return null;
  }
}

// ---------- Orchestrateurs ----------

export type ProviderResult = { url: string | null; source: string };

export async function findArtistImage(rawName: string): Promise<ProviderResult> {
  const variants = artistNameVariants(rawName);
  if (!variants.length) return { url: null, source: "skip" };

  type Provider = { name: string; fn: (n: string) => Promise<string | null> };
  const providers: Provider[] = [
    { name: "spotify", fn: spotifySearchArtist },
    { name: "deezer", fn: deezerArtist },
    { name: "lastfm", fn: lastfmArtist },
    { name: "wikipedia", fn: wikipediaArtist },
    { name: "itunes", fn: itunesArtist },
    { name: "mb_wiki", fn: mbWikiArtist },
  ];

  for (const p of providers) {
    for (const v of variants) {
      const url = await p.fn(v);
      if (url) {
        log.debug({ artist: rawName, source: p.name, variant: v }, "image found");
        return { url, source: p.name };
      }
    }
  }
  return { url: null, source: "none" };
}

export async function findAlbumCover(
  rawArtist: string,
  rawTitle: string,
): Promise<ProviderResult> {
  const artistVariants = artistNameVariants(rawArtist);
  const title = cleanAlbumTitle(rawTitle);
  if (!artistVariants.length || !title) return { url: null, source: "skip" };

  type Provider = { name: string; fn: (a: string, t: string) => Promise<string | null> };
  const providers: Provider[] = [
    { name: "spotify", fn: spotifySearchAlbum },
    { name: "deezer", fn: deezerAlbum },
    { name: "itunes", fn: itunesAlbum },
    { name: "caa", fn: caaAlbum },
  ];

  for (const p of providers) {
    for (const a of artistVariants) {
      const url = await p.fn(a, title);
      if (url) {
        log.debug({ artist: rawArtist, title, source: p.name }, "cover found");
        return { url, source: p.name };
      }
    }
  }
  return { url: null, source: "none" };
}
