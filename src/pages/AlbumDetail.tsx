import { useParams, Link } from "react-router-dom";
import { findAlbum } from "@/data/library";
import { usePlayer, formatTime } from "@/context/PlayerContext";
import { Play, Pause } from "lucide-react";

const AlbumDetail = () => {
  const { id } = useParams<{ id: string }>();
  const album = id ? findAlbum(id) : undefined;
  const { playQueue, current, isPlaying, togglePlay } = usePlayer();

  if (!album) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Album not found.</p>
        <Link to="/" className="text-primary text-sm uppercase tracking-[0.2em]">
          ← Back to discover
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="relative">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage: `url(${album.cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.2)",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/85 to-background" />

        <div className="px-6 md:px-10 pt-10 pb-8 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-end">
          <img
            src={album.cover}
            alt={album.title}
            className="w-full max-w-[280px] aspect-square object-cover rounded-sm shadow-album"
          />
          <div className="animate-fade-up">
            <div className="text-[10px] uppercase tracking-[0.35em] text-primary">
              {album.genre} · {album.year}
            </div>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-2">{album.title}</h1>
            <div className="mt-3 text-lg italic text-muted-foreground">
              by <span className="text-foreground not-italic">{album.artist}</span>
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
              {album.description}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => playQueue(album.tracks, 0)}
                className="inline-flex items-center gap-2 bg-gold text-primary-foreground px-5 py-2.5 rounded-sm shadow-gold hover:scale-[1.02] transition-transform"
              >
                <Play className="h-4 w-4" />
                <span className="text-sm uppercase tracking-[0.2em] font-medium">Play</span>
              </button>
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {album.tracks.length} tracks
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="px-6 md:px-10 mt-6">
        <div className="border-t border-border">
          {album.tracks.map((t, i) => {
            const playingThis = current?.id === t.id && isPlaying;
            return (
              <button
                key={t.id}
                onClick={() => (current?.id === t.id ? togglePlay() : playQueue(album.tracks, i))}
                className="group w-full grid grid-cols-[32px_1fr_auto] items-center gap-4 py-4 border-b border-border/60 text-left hover:bg-card/40 transition-colors px-2"
              >
                <div className="w-7 flex items-center justify-center text-muted-foreground">
                  {playingThis ? (
                    <Pause className="h-4 w-4 text-primary" />
                  ) : (
                    <>
                      <span className="group-hover:hidden text-sm tabular-nums">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <Play className="h-4 w-4 hidden group-hover:block text-primary" />
                    </>
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`font-display text-lg truncate ${playingThis ? "text-primary" : ""}`}>
                    {t.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">{formatTime(t.duration)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AlbumDetail;
