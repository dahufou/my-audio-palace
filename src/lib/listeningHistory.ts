// Historique d'écoute local (respecte le toggle "saveListeningHistory").
import type { Track } from "@/data/library";

const KEY = "aurum_history_v1";
const MAX = 500;

export type HistoryEntry = {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  playedAt: number;
};

export function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendHistory(t: Track) {
  try {
    const cur = readHistory();
    const next: HistoryEntry[] = [
      {
        trackId: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        cover: t.cover,
        playedAt: Date.now(),
      },
      ...cur,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
