import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { aurum, type ArtistSummary } from "@/lib/aurum";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

type SortKey = "name" | "albums" | "tracks";

const ArtistsPage = () => {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const artists = useQuery({
    queryKey: ["aurum", "artists", "all"],
    queryFn: () => aurum.artists({ limit: 1000 }),
    retry: 0,
  });

  const filtered = useMemo<ArtistSummary[]>(() => {
    const items = artists.data?.items ?? [];
    const term = q.trim().toLowerCase();
    const matched = term
      ? items.filter((a) => a.name.toLowerCase().includes(term))
      : items;
    const sorted = [...matched].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "albums") return toNum(b.albums_count) - toNum(a.albums_count);
      return toNum(b.tracks_count) - toNum(a.tracks_count);
    });
    return sorted;
  }, [artists.data, q, sort]);

  // Group alphabetically (only when sorted by name)
  const grouped = useMemo(() => {
    if (sort !== "name") return null;
    const map = new Map<string, ArtistSummary[]>();
    for (const a of filtered) {
      const first = (a.name[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, sort]);

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <div className="border-b border-border pb-5">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Bibliothèque</div>
          <h1 className="font-display text-5xl md:text-6xl mt-1">Artistes</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {artists.data ? `${artists.data.items.length} artistes` : "Chargement de la bibliothèque…"}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un artiste…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em]">
              {(["name", "albums", "tracks"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`px-3 py-2 rounded-sm border transition-colors ${
                    sort === k
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {k === "name" ? "A → Z" : k === "albums" ? "Albums" : "Pistes"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {artists.isLoading && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        )}

        {artists.isError && (
          <p className="mt-10 text-destructive">Impossible de charger les artistes.</p>
        )}

        {artists.data && filtered.length === 0 && (
          <p className="mt-10 text-muted-foreground">Aucun artiste ne correspond.</p>
        )}

        {/* Grouped (alphabetical) */}
        {grouped && grouped.map(([letter, list]) => (
          <section key={letter} className="mt-10">
            <div className="flex items-baseline gap-3 border-b border-border/60 pb-2">
              <h2 className="font-display text-3xl text-primary">{letter}</h2>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                {list.length}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-x-3 gap-y-6">
              {list.map((a) => (
                <ArtistTile key={a.id} artist={a} />
              ))}
            </div>
          </section>
        ))}

        {/* Flat (when sorted by albums/tracks) */}
        {!grouped && artists.data && (
          <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-x-3 gap-y-6">
            {filtered.map((a) => (
              <ArtistTile key={a.id} artist={a} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// Deterministic hue from artist id — gives each artist a stable color
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ArtistTile({ artist }: { artist: ArtistSummary }) {
  const hue = hueFromId(artist.id);
  const bg = `linear-gradient(135deg, hsl(${hue} 45% 22%) 0%, hsl(${(hue + 40) % 360} 55% 14%) 100%)`;

  return (
    <Link
      to={`/library/artist/${artist.id}`}
      className="group block animate-fade-up text-center"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-full bg-muted shadow-album mx-auto transition-transform duration-500 group-hover:scale-[1.04]"
        style={{ background: bg }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display text-2xl md:text-3xl"
            style={{ color: `hsl(${hue} 60% 88%)` }}
          >
            {initials(artist.name)}
          </span>
        </div>
        <div
          className="absolute inset-0 rounded-full ring-1 ring-inset transition-colors"
          style={{ borderColor: `hsl(${hue} 60% 60% / 0.25)` }}
        />
      </div>
      <div className="mt-2 px-1">
        <div className="text-[13px] font-medium leading-tight line-clamp-1 group-hover:text-primary transition-colors">
          {artist.name}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mt-0.5 tabular-nums">
          {toNum(artist.albums_count)} alb · {toNum(artist.tracks_count)} pistes
        </div>
      </div>
    </Link>
  );
}

export default ArtistsPage;
