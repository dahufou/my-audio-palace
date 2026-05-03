import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { aurum, type AlbumSummary, type ArtistSummary } from "@/lib/aurum";
import { ImageOff, Disc3, Mic2, Music2, ChevronRight } from "lucide-react";

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const Index = () => {
  const stats = useQuery({
    queryKey: ["aurum", "stats"],
    queryFn: () => aurum.stats(),
    retry: 0,
  });

  const albums = useQuery({
    queryKey: ["aurum", "albums", "all"],
    queryFn: () => aurum.albums({ limit: 500 }),
    retry: 0,
  });

  const artists = useQuery({
    queryKey: ["aurum", "artists", "all"],
    queryFn: () => aurum.artists({ limit: 500 }),
    retry: 0,
  });

  // « Récemment ajoutés » — pas de vraie date côté serveur, on prend la fin de l'index (proxy)
  const recent = useMemo<AlbumSummary[]>(() => {
    const items = albums.data?.items ?? [];
    return [...items].reverse().slice(0, 18);
  }, [albums.data]);

  // « Artistes à explorer » — ceux avec le plus d'albums
  const topArtists = useMemo<ArtistSummary[]>(() => {
    const items = artists.data?.items ?? [];
    return [...items]
      .sort((a, b) => toNum(b.albums_count) - toNum(a.albums_count))
      .slice(0, 12);
  }, [artists.data]);

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Aurum</div>
          <h1 className="font-display text-5xl md:text-6xl mt-1">Accueil</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Vue d'ensemble de votre bibliothèque, façon Roon Overview.
          </p>
        </div>

        {/* Stats — Roon Overview header */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/50 rounded-sm overflow-hidden border border-border">
          <StatCell
            icon={<Mic2 className="h-4 w-4" />}
            label="Artistes"
            value={stats.data?.artists}
            loading={stats.isLoading}
          />
          <StatCell
            icon={<Disc3 className="h-4 w-4" />}
            label="Albums"
            value={stats.data?.albums}
            loading={stats.isLoading}
          />
          <StatCell
            icon={<Music2 className="h-4 w-4" />}
            label="Pistes"
            value={stats.data?.tracks}
            loading={stats.isLoading}
          />
          <StatCell
            icon={<Disc3 className="h-4 w-4" />}
            label="Stockage"
            value={stats.data?.music_path ? "Local" : undefined}
            sub={stats.data?.music_path}
            loading={stats.isLoading}
          />
        </div>

        {/* Récemment ajoutés */}
        <SectionHeader title="Récemment ajoutés" to="/library" />
        {albums.isLoading ? (
          <RowSkeleton />
        ) : (
          <div className="mt-4 -mx-2 px-2 flex gap-3 overflow-x-auto scrollbar-thin pb-3 snap-x">
            {recent.map((a) => (
              <RecentAlbumCard key={a.id} album={a} />
            ))}
          </div>
        )}

        {/* Artistes à explorer */}
        <SectionHeader title="Artistes à explorer" to="/artists" />
        {artists.isLoading ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 w-32 rounded-sm bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {topArtists.map((ar) => (
              <Link
                key={ar.id}
                to={`/library/artist/${ar.id}`}
                className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-sm border border-border bg-card/40 hover:border-primary/60 hover:bg-card transition-colors"
              >
                <span className="text-sm">{ar.name}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {toNum(ar.albums_count)} alb · {toNum(ar.tracks_count)} pistes
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// ─── Sub-components ───

function StatCell({
  icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-card/60 px-5 py-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 font-display text-3xl md:text-4xl tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 bg-muted rounded-sm animate-pulse align-middle" /> : (value ?? "—")}
      </div>
      {sub && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-1 truncate font-mono">
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mt-12 flex items-end justify-between border-b border-border/60 pb-2">
      <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-primary transition-colors"
      >
        Tout voir <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="mt-4 flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="shrink-0 w-36">
          <div className="aspect-square bg-muted rounded-sm animate-pulse" />
          <div className="h-3 bg-muted mt-2 w-3/4 rounded-sm animate-pulse" />
          <div className="h-2.5 bg-muted mt-1.5 w-1/2 rounded-sm animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function RecentAlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <Link
      to={`/library/album/${album.id}`}
      className="group shrink-0 w-36 snap-start animate-fade-up"
    >
      <div className="relative aspect-square overflow-hidden rounded-sm shadow-album bg-muted">
        <AlbumCover
          albumId={album.id}
          artistName={album.artist_name}
          title={album.title}
          hasCover={album.has_cover}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
        />
      </div>
      <div className="mt-2">
        <div className="text-[13px] font-medium leading-tight line-clamp-1">{album.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
          {album.artist_name}
          {album.year ? <> · <span className="text-muted-foreground/70">{album.year}</span></> : null}
        </div>
      </div>
    </Link>
  );
}

export default Index;
