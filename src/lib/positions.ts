// Mémorisation des positions de lecture par piste (rememberPosition).
const KEY = "aurum_positions_v1";
const MAX_ENTRIES = 200;

type Map = Record<string, { t: number; at: number }>;

function read(): Map {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    return {};
  }
}

function write(m: Map) {
  // garde les N plus récents
  const entries = Object.entries(m).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function getPosition(trackId: string): number | null {
  const m = read();
  return m[trackId]?.t ?? null;
}

export function setPosition(trackId: string, t: number) {
  if (!Number.isFinite(t) || t <= 1) return;
  const m = read();
  m[trackId] = { t, at: Date.now() };
  write(m);
}

export function clearPosition(trackId: string) {
  const m = read();
  delete m[trackId];
  write(m);
}

export function clearAllPositions() {
  localStorage.removeItem(KEY);
}
