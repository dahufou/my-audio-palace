// Client API pour le serveur Aurum (LXC).
// Modifiable via VITE_AURUM_BASE_URL ou localStorage("aurum_base_url").

const DEFAULT_BASE = "https://dahufou-aurum.duckdns.org";

export function getAurumBase(): string {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem("aurum_base_url");
    if (ls) return ls.replace(/\/+$/, "");
  }
  const env = (import.meta as any).env?.VITE_AURUM_BASE_URL as string | undefined;
  return (env || DEFAULT_BASE).replace(/\/+$/, "");
}

export function setAurumBase(url: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("aurum_base_url", url.replace(/\/+$/, ""));
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${getAurumBase()}${path}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`Aurum ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- Types ----------
export type Stats = {
  artists: number;
  albums: number;
  tracks: number;
  music_path: string;
};

export type ArtistSummary = {
  id: string;
  name: string;
  albums_count: string | number;
  tracks_count: string | number;
};

export type AlbumSummary = {
  id: string;
  title: string;
  year: number | null;
  artist_id: string;
  artist_name: string;
  has_cover: boolean;
  tracks_count: string | number;
};

export type TrackRow = {
  id: string;
  title: string;
  track_no: number | null;
  disc_no: number | null;
  duration_sec: string | number | null;
  codec: string | null;
  container: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  lossless: boolean;
};

export type AlbumDetail = {
  id: string;
  title: string;
  year: number | null;
  artist_id: string;
  artist_name: string;
  has_cover: boolean;
  folder_path: string | null;
  tracks: TrackRow[];
};

export type ArtistDetail = {
  id: string;
  name: string;
  albums: Array<{ id: string; title: string; year: number | null; has_cover: boolean }>;
};

// ---------- API ----------
export const aurum = {
  stats: () => get<Stats>("/library/stats"),
  artists: (params: { q?: string; limit?: number; offset?: number } = {}) => {
    const u = new URLSearchParams();
    if (params.q) u.set("q", params.q);
    if (params.limit != null) u.set("limit", String(params.limit));
    if (params.offset != null) u.set("offset", String(params.offset));
    const qs = u.toString();
    return get<{ items: ArtistSummary[] }>(`/library/artists${qs ? `?${qs}` : ""}`);
  },
  artist: (id: string) => get<ArtistDetail>(`/library/artists/${id}`),
  albums: (params: { q?: string; limit?: number; offset?: number } = {}) => {
    const u = new URLSearchParams();
    if (params.q) u.set("q", params.q);
    if (params.limit != null) u.set("limit", String(params.limit));
    if (params.offset != null) u.set("offset", String(params.offset));
    const qs = u.toString();
    return get<{ items: AlbumSummary[] }>(`/library/albums${qs ? `?${qs}` : ""}`);
  },
  album: (id: string) => get<AlbumDetail>(`/library/albums/${id}`),
  coverUrl: (albumId: string) => `${getAurumBase()}/covers/${albumId}`,
  externalCoverUrl: (albumId: string) => `${getAurumBase()}/albums/${albumId}/external-cover`,
  artistImageUrl: (artistId: string) => `${getAurumBase()}/artists/${artistId}/image`,
  streamUrl: (trackId: string) => `${getAurumBase()}/stream/${trackId}`,
};

export function formatDuration(sec: string | number | null | undefined): string {
  if (sec == null) return "—";
  const s = typeof sec === "string" ? parseFloat(sec) : sec;
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
