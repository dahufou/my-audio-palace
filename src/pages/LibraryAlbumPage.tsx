import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { aurum, formatDuration } from "@/lib/aurum";
import { ImageOff, ArrowLeft } from "lucide-react";

const LibraryAlbumPage = () => {
  const { id = "" } = useParams<{ id: string }>();
  const album = useQuery({
    queryKey: ["aurum", "album", id],
    queryFn: () => aurum.album(id),
    enabled: !!id,
  });

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Library
        </Link>

        {album.isLoading && (
          <div className="mt-10 animate-pulse flex gap-10">
            <div className="h-64 w-64 bg-muted rounded-sm" />
            <div className="flex-1 space-y-4">
              <div className="h-10 bg-muted w-1/2 rounded-sm" />
              <div className="h-4 bg-muted w-1/3 rounded-sm" />
            </div>
          </div>
        )}

        {album.isError && (
          <p className="mt-10 text-destructive">Failed to load album.</p>
        )}

        {album.data && (
          <>
            <div className="mt-8 flex flex-col md:flex-row gap-10">
              <div className="w-64 h-64 shrink-0 rounded-sm overflow-hidden shadow-album bg-muted">
                {album.data.has_cover ? (
                  <img
                    src={aurum.coverUrl(album.data.id)}
                    alt={album.data.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <ImageOff className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-end">
                <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Album</div>
                <h1 className="font-display text-5xl md:text-6xl mt-1">{album.data.title}</h1>
                <div className="mt-3 text-muted-foreground">
                  <Link
                    to={`/library/artist/${album.data.artist_id}`}
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    {album.data.artist_name}
                  </Link>
                  {album.data.year ? <> · {album.data.year}</> : null}
                  {" · "}{album.data.tracks.length} tracks
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-border">
              {album.data.tracks.map((t, i) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[3rem_1fr_auto_4rem] gap-4 items-center py-3 border-b border-border/50 hover:bg-accent/30 transition-colors px-2 -mx-2 rounded-sm"
                >
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {t.track_no ?? i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                      {t.codec || t.container}
                      {t.lossless ? " · Lossless" : ""}
                      {t.sample_rate ? ` · ${(t.sample_rate / 1000).toFixed(1)} kHz` : ""}
                      {t.bitrate ? ` · ${Math.round(t.bitrate / 1000)} kbps` : ""}
                    </div>
                  </div>
                  <audio
                    controls
                    preload="none"
                    src={aurum.streamUrl(t.id)}
                    className="h-8"
                  />
                  <div className="text-xs text-muted-foreground tabular-nums text-right">
                    {formatDuration(t.duration_sec)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default LibraryAlbumPage;
