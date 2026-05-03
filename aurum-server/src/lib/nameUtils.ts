/**
 * Génère des variantes "raisonnables" d'un nom d'artiste pour maximiser
 * les chances de matcher dans les bases externes (Deezer, Spotify, Wikipedia…).
 *
 * Stratégie :
 *   - Nettoie les annotations [Live], (Remastered), etc.
 *   - Sépare les collaborations (feat., &, with, ,) → garde le 1er artiste
 *   - "Nom, Prénom" (classique) → "Prénom Nom"
 *   - Ignore "Various Artists", "Compilation"
 *
 * On renvoie l'array du plus précis au plus permissif.
 */
export function artistNameVariants(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim().replace(/\s+/g, " ");
    if (t.length < 2) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  if (!raw) return out;

  // Filtre direct
  const lower = raw.toLowerCase();
  if (
    lower === "various artists" ||
    lower === "various" ||
    lower === "va" ||
    lower === "compilation" ||
    lower === "unknown artist" ||
    lower === "unknown"
  ) {
    return [];
  }

  // 1) Brut
  push(raw);

  // 2) Sans annotations entre parenthèses ou crochets
  const stripped = raw
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, "")
    .replace(/\s*-\s*(remaster(ed)?|live|edit|version|deluxe).*/i, "");
  push(stripped);

  // 3) Collaborations : split sur feat./featuring/with/&/,/ vs / x
  const splitters =
    /\s+(?:feat\.?|featuring|with|vs\.?|x|presents|pres\.)\s+|\s*&\s*|\s*,\s*/i;
  const parts = stripped.split(splitters).filter(Boolean);
  if (parts.length > 1) {
    push(parts[0]);
  }

  // 4) "Nom, Prénom" (musique classique) → "Prénom Nom"
  //    On détecte si le brut contient une virgule ET pas de "&" ni "feat"
  if (/^[^,&]+,\s*[^,&]+$/.test(raw) && !/\bfeat\.?\b|\bwith\b/i.test(raw)) {
    const [last, first] = raw.split(",").map((s) => s.trim());
    if (last && first) push(`${first} ${last}`);
  }

  // 5) Premier "mot" significatif (dernier recours pour les noms à rallonge)
  const firstWord = stripped.split(/[\s&,]/).filter(Boolean)[0];
  if (firstWord && firstWord.length >= 4) push(firstWord);

  return out;
}

/** Nettoie un titre d'album pour les recherches externes. */
export function cleanAlbumTitle(raw: string): string {
  return raw
    .replace(/\s*[\(\[][^\)\]]*(remaster|deluxe|edition|version|bonus|disc|cd\s*\d)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*-\s*(remaster(ed)?|deluxe|expanded).*/i, "")
    .trim();
}
