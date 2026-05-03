import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useFavourites } from "@/lib/favourites";
import { aurum, formatDuration, type AlbumDetail } from "@/lib/aurum";
import { AlbumCover } from "@/components/AlbumCover";
import { usePlayer } from "@/context/PlayerContext";
import { Heart, Play, Disc3, Mic2, Music2, Trash2 } from "lucide-react";

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const FavouritesPage = () => {
  const { items, remove, clear } = useFavourites();
  const player = usePlayer();

  const albumIds = useMemo(() => items.filter((i) => i.kind === "album").map((i) => i.id), [items]);
  const artistIds = useMemo(() => items.filter((i) => i.kind === "artist").map((i) => i.id), [items]);
  const trackIds = useMemo(() => items.filter((i) => i.kind === "track").map((i) => i.id), [items]);

  // Tracks live inside album details — fetch unique parents
  const trackAlbumQueries = useQueries({
    queries: albumIds.map((id) => ({
      queryKey: ["aurum", "album", id],
      queryFn: () => aurum.album(id),
    })),
  });

  const artistQueries = useQueries({
    queries: artistIds.map((id) => ({
      queryKey: ["aurum", "artist", id],
      queryFn: () => aurum.artist(id),
    })),
  });

  const albums: AlbumDetail[] = trackAlbumQueries.map((q) => q.data).filter(Boolean) as AlbumDetail[];
  const artists = artistQueries.map((q) => q.data).filter(Boolean) as Array<{ id: string; name: string; albums: any[] }>;

  // For favorited tracks, locate them across all loaded albums (best effort)
  const favTracks = useMemo(() => {
    const found: Array<{ track: any; album: AlbumDetail }> = [];
    for (const tid of trackIds) {
      for (const a of albums) {
        const t = a.tracks.find((x) => x.id === tid);
        if (t) {
          found.push({ track: t, album: a });
          break;
        }
      }
    }
    return found;
  }, [trackIds, albums]);

  const playAlbum = (a: AlbumDetail) => {
    player.playQueue(
      a.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: a.artist_name,
        album: a.title,
        cover: a.has_cover ? aurum.coverUrl(a.id) : "",
        src: aurum.streamUrl(t.id),
        duration: toNum(t.duration_sec),
      })),
      0,
    );
  };

  const empty = items.length === 0;

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <div className="border-b border-border pb-5">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Vous</div>
          <h1 className="font-display text-5xl md:text-6xl mt-1">Favoris</h1>
          <p className="text-muted-foreground mt-2">
            {items.length} {items.length > 1 ? "éléments" : "élément"} sauvegardés
          </p>

          {!empty && (
            <div className="mt-5">
              <button
                onClick={clear}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-border text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Tout effacer
              </button>
            </div>
          )}
        </div>

        {empty && (
          <div className="mt-20 flex flex-col items-center text-center text-muted-foreground">
            <Heart className="h-10 w-10 mb-4 opacity-40" />
            <p className="text-sm">Aucun favori pour l'instant.</p>
            <p className="text-xs mt-1 opacity-70">
              Ajoutez albums, artistes ou pistes en cliquant sur le ❤ depuis n'importe quelle page.
            </p>
          </div>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-4">
              <Disc3 className="h-3.5 w-3.5" /> Albums ({albums.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
              {albums.map((a) => (
                <div key={a.id} className="group">
                  <Link to={`/library/album/${a.id}`} className="block relative aspect-square rounded-sm overflow-hidden shadow-album">
                    <AlbumCover
                      albumId={a.id}
                      artistName={a.artist_name}
                      title={a.title}
                      hasCover={a.has_cover}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        playAlbum(a);
                      }}
                      className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-gold opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Lire"
                    >
                      <Play className="h-4 w-4 fill-current translate-x-[1px]" />
                    </button>
                  </Link>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/library/album/${a.id}`} className="block font-display text-base leading-tight truncate hover:text-primary">
                        {a.title}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">{a.artist_name}</div>
                    </div>
                    <button
                      onClick={() => remove("album", a.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Retirer des favoris"
                    >
                      <Heart className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Artists */}
        {artists.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-4">
              <Mic2 className="h-3.5 w-3.5" /> Artistes ({artists.length})
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-6">
              {artists.map((ar) => (
                <div key={ar.id} className="text-center group">
                  <Link to={`/library/artist/${ar.id}`} className="block">
                    <div className="aspect-square rounded-full overflow-hidden bg-muted mx-auto">
                      <img
                        src={aurum.artistImageUrl(ar.id)}
                        alt={ar.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => ((e.currentTarget.style.display = "none"))}
                      />
                    </div>
                    <div className="mt-2 text-sm truncate group-hover:text-primary">{ar.name}</div>
                  </Link>
                  <button
                    onClick={() => remove("artist", ar.id)}
                    className="mt-1 text-muted-foreground hover:text-destructive"
                    aria-label="Retirer"
                  >
                    <Heart className="h-3.5 w-3.5 fill-current inline" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tracks */}
        {favTracks.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-4">
              <Music2 className="h-3.5 w-3.5" /> Pistes ({favTracks.length})
            </div>
            <div className="space-y-1">
              {favTracks.map(({ track, album }) => (
                <div
                  key={track.id}
                  className="grid items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-accent/40 group"
                  style={{ gridTemplateColumns: "3rem minmax(0,1fr) 4rem auto" }}
                >
                  <div className="h-10 w-10 rounded-sm overflow-hidden bg-muted">
                    <AlbumCover
                      albumId={album.id}
                      artistName={album.artist_name}
                      title={album.title}
                      hasCover={album.has_cover}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm">{track.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {album.artist_name} — <Link to={`/library/album/${album.id}`} className="italic hover:text-primary">{album.title}</Link>
                    </div>
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground text-right">
                    {formatDuration(track.duration_sec)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        player.playQueue(
                          [{
                            id: track.id,
                            title: track.title,
                            artist: album.artist_name,
                            album: album.title,
                            cover: album.has_cover ? aurum.coverUrl(album.id) : "",
                            src: aurum.streamUrl(track.id),
                            duration: toNum(track.duration_sec),
                          }],
                          0,
                        );
                      }}
                      className="p-2 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground"
                      aria-label="Lire"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                    <button
                      onClick={() => remove("track", track.id)}
                      className="p-2 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label="Retirer"
                    >
                      <Heart className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default FavouritesPage;
