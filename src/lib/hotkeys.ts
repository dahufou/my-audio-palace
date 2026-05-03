// Parser ultra-simple "Ctrl+Right", "Space", "Shift+P", etc.
export type ParsedHotkey = {
  code: string;       // KeyboardEvent.code OU key normalisé
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

const KEY_ALIASES: Record<string, string> = {
  space: "Space",
  spacebar: "Space",
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};

export function parseHotkey(s: string): ParsedHotkey | null {
  if (!s) return null;
  const parts = s.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const k: ParsedHotkey = { code: "", ctrl: false, shift: false, alt: false, meta: false };
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low === "ctrl" || low === "control") k.ctrl = true;
    else if (low === "shift") k.shift = true;
    else if (low === "alt" || low === "option") k.alt = true;
    else if (low === "cmd" || low === "meta" || low === "win") k.meta = true;
    else k.code = KEY_ALIASES[low] ?? p;
  }
  if (!k.code) return null;
  return k;
}

export function eventMatches(e: KeyboardEvent, h: ParsedHotkey): boolean {
  if (e.ctrlKey !== h.ctrl) return false;
  if (e.shiftKey !== h.shift) return false;
  if (e.altKey !== h.alt) return false;
  if (e.metaKey !== h.meta) return false;
  // accept by code OR by key (case-insensitive)
  const k = h.code.toLowerCase();
  if (e.code === h.code) return true;
  if ((e.key || "").toLowerCase() === k) return true;
  // single letters: KeyA, KeyB...
  if (k.length === 1 && e.code === `Key${k.toUpperCase()}`) return true;
  return false;
}
