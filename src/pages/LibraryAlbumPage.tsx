import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { aurum, formatDuration, type TrackRow, type AlbumDetail } from "@/lib/aurum";
import { ImageOff, ArrowLeft, Play, Pause, Disc3, Clock3, Music2 } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const formatTotal = (sec: number): string => {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")} min`;
  return `${m} min`;
};

const formatHz = (hz: number | null | undefined): string | null => {
  if (!hz) return null;
  const k = hz / 1000;
  return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)} kHz`;
};

const formatBitDepth = (channels: number | null | undefined): string | null => {
  if (!channels) return null;
  return channels === 1 ? "Mono" : channels === 2 ? "Stereo" : `${channels}ch`;
};

const trackToPlayable = (t: TrackRow, album: AlbumDetail) => ({
  id: t.id,
  title: t.title,
  artist: album.artist_name,
  album: album.title,
  cover: album.has_cover ? aurum.coverUrl(album.id) : "",
  src: aurum.streamUrl(t.id),
  duration: toNum(t.duration_sec),
});

const LibraryAlbumPage = () => {
  const { id = "" } = useParams<{ id: string }>();
  const album = useQuery({
    queryKey: ["aurum", "album", id],
    queryFn: () => aurum.album(id),
    enabled: !!id,
  });

  const player = usePlayer();

  const data = album.data;

  const { totalDuration, qualityBadge, discs } = useMemo(() => {
    if (!data) return { totalDuration: 0, qualityBadge: null as string | null, discs: [] as Array<{ disc: number; tracks: TrackRow[] }> };

    const total = data.tracks.reduce((acc, t) => acc + toNum(t.duration_sec), 0);

    // Quality badge from first lossless track (Roon-style header chip)
    const ref = data.tracks.find((t) => t.lossless) ?? data.tracks[0];
    const parts: string[] = [];
    if (ref?.lossless) parts.push((ref.codec || "FLAC").toUpperCase());
    else if (ref?.codec) parts.push(ref.codec.toUpperCase());
    const hz = formatHz(ref?.sample_rate);
    if (hz) parts.push(hz);
    const ch = formatBitDepth(ref?.channels);
    if (ch) parts.push(ch);
    const badge = parts.length ? parts.join(" · ") : null;

    // Group by disc
    const map = new Map<number, TrackRow[]>();
    data.tracks.forEach((t) => {
      const d = t.disc_no ?? 1;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });
    const sortedDiscs = Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([disc, tracks]) => ({
        disc,
        tracks: [...tracks].sort((a, b) => (a.track_no ?? 0) - (b.track_no ?? 0)),
      }));

    return { totalDuration: total, qualityBadge: badge, discs: sortedDiscs };
  }, [data]);

  const playAll = () => {
    if (!data) return;
    player.playQueue(data.tracks.map((t) => trackToPlayable(t, data)), 0);
  };

  const playFrom = (trackId: string) => {
    if (!data) return;
    const flat = data.tracks.map((t) => trackToPlayable(t, data));
    const idx = flat.findIndex((t) => t.id === trackId);
    player.playQueue(flat, Math.max(0, idx));
  };

  const isCurrent = (trackId: string) => player.current?.id === trackId;

  const coverUrl = data?.has_cover ? aurum.coverUrl(data.id) : null;
  const multiDisc = discs.length > 1;

  return (
    <AppLayout>
      {/* Ambient indigo veil — Roon-style chromatic header */}
      <div className="relative">
        {coverUrl && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[420px] -z-0 opacity-40"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(60px) saturate(140%)",
              transform: "scale(1.1)",
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[420px] -z-0"
          style={{ background: "var(--gradient-indigo-veil)" }}
        />

        <div className="relative px-6 md:px-10 py-10 pb-16">
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

          {data && (
            <>
              {/* HERO */}
              <div className="mt-8 flex flex-col md:flex-row gap-8 md:gap-10 items-start md:items-end">
                <div
                  className="w-56 h-56 md:w-64 md:h-64 shrink-0 rounded-sm overflow-hidden bg-muted"
                  style={{
                    boxShadow:
                      "0 30px 80px -20px hsl(var(--indigo-deep) / 0.9), 0 0 0 1px hsl(var(--indigo-bright) / 0.15)",
                  }}
                >
                  {data.has_cover ? (
                    <img
                      src={aurum.coverUrl(data.id)}
                      alt={data.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <ImageOff className="h-10 w-10" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-end min-w-0 flex-1">
                  <div
                    className="text-[10px] uppercase tracking-[0.35em]"
                    style={{ color: "hsl(var(--primary-glow))" }}
                  >
                    Album
                  </div>
                  <h1 className="font-display text-4xl md:text-6xl mt-1 leading-[1.05] truncate">
                    {data.title}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Link
                      to={`/library/artist/${data.artist_id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {data.artist_name}
                    </Link>
                    {data.year ? <span className="text-muted-foreground">· {data.year}</span> : null}
                    <span className="text-muted-foreground">
                      · {data.tracks.length} {data.tracks.length > 1 ? "pistes" : "piste"}
                    </span>
                    <span className="text-muted-foreground">· {formatTotal(totalDuration)}</span>
                    {qualityBadge && (
                      <span
                        className="ml-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] rounded-sm border"
                        style={{
                          borderColor: "hsl(var(--indigo-bright) / 0.4)",
                          background: "hsl(var(--indigo-bright) / 0.08)",
                          color: "hsl(var(--primary-glow))",
                        }}
                      >
                        {qualityBadge}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={playAll}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "var(--gradient-indigo)",
                        color: "hsl(42 38% 96%)",
                        boxShadow: "0 10px 30px -10px hsl(var(--indigo-bright) / 0.6)",
                      }}
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Lire l'album
                    </button>
                  </div>
                </div>
              </div>

              {/* TRACK LIST — Roon-style dense */}
              <div className="mt-12">
                {/* Column headers */}
                <div
                  className="grid items-center gap-4 px-3 pb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 border-b"
                  style={{
                    gridTemplateColumns: "2.5rem minmax(0,1fr) minmax(0,14rem) 4rem",
                    borderColor: "hsl(var(--border) / 0.6)",
                  }}
                >
                  <div className="text-center">#</div>
                  <div>Titre</div>
                  <div className="hidden md:block">Qualité</div>
                  <div className="flex justify-end">
                    <Clock3 className="h-3 w-3" />
                  </div>
                </div>

                {discs.map(({ disc, tracks }) => (
                  <div key={disc} className="mt-2">
                    {multiDisc && (
                      <div className="flex items-center gap-2 px-3 pt-6 pb-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                        <Disc3 className="h-3.5 w-3.5" />
                        Disque {disc}
                      </div>
                    )}

                    {tracks.map((t, i) => {
                      const active = isCurrent(t.id);
                      const playingNow = active && player.isPlaying;
                      const hz = formatHz(t.sample_rate);
                      const kbps = t.bitrate ? `${Math.round(t.bitrate / 1000)} kbps` : null;
                      const codec = (t.codec || t.container || "").toUpperCase();
                      const qualityBits = [
                        t.lossless ? "Lossless" : null,
                        codec || null,
                        hz,
                        !t.lossless ? kbps : null,
                      ].filter(Boolean) as string[];

                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => (active ? player.togglePlay() : playFrom(t.id))}
                          onDoubleClick={() => playFrom(t.id)}
                          className="group w-full text-left grid items-center gap-4 px-3 py-2.5 rounded-sm transition-colors"
                          style={{
                            gridTemplateColumns: "2.5rem minmax(0,1fr) minmax(0,14rem) 4rem",
                            background: active ? "hsl(var(--indigo-bright) / 0.08)" : undefined,
                          }}
                          onMouseEnter={(e) =>
                            !active &&
                            (e.currentTarget.style.background = "hsl(var(--indigo-mid) / 0.35)")
                          }
                          onMouseLeave={(e) =>
                            !active && (e.currentTarget.style.background = "")
                          }
                        >
                          {/* Track number / play indicator */}
                          <div className="flex items-center justify-center w-10">
                            {active ? (
                              <span className="flex items-end gap-[2px] h-3.5">
                                {playingNow ? (
                                  <>
                                    <span className="eq-bar h-full" />
                                    <span className="eq-bar h-full" />
                                    <span className="eq-bar h-full" />
                                  </>
                                ) : (
                                  <Play className="h-3.5 w-3.5 fill-current" style={{ color: "hsl(var(--indigo-bright))" }} />
                                )}
                              </span>
                            ) : (
                              <>
                                <span className="text-xs tabular-nums text-muted-foreground/70 group-hover:hidden">
                                  {t.track_no ?? i + 1}
                                </span>
                                <Play className="h-3.5 w-3.5 hidden group-hover:block fill-current" />
                              </>
                            )}
                          </div>

                          {/* Title */}
                          <div className="min-w-0">
                            <div
                              className="truncate text-sm"
                              style={{
                                color: active ? "hsl(var(--primary-glow))" : undefined,
                                fontWeight: active ? 600 : 400,
                              }}
                            >
                              {t.title}
                            </div>
                            {/* mobile-only quality */}
                            <div className="md:hidden mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 truncate">
                              {qualityBits.join(" · ")}
                            </div>
                          </div>

                          {/* Quality column (desktop) */}
                          <div className="hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 truncate">
                            {t.lossless && (
                              <span
                                className="px-1.5 py-0.5 rounded-sm border text-[9px]"
                                style={{
                                  borderColor: "hsl(var(--indigo-bright) / 0.35)",
                                  color: "hsl(var(--primary-glow))",
                                  background: "hsl(var(--indigo-bright) / 0.06)",
                                }}
                              >
                                Lossless
                              </span>
                            )}
                            <span className="truncate">
                              {[codec, hz, !t.lossless ? kbps : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>

                          {/* Duration */}
                          <div className="text-xs tabular-nums text-muted-foreground text-right">
                            {formatDuration(t.duration_sec)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Footer total */}
                <div className="mt-6 px-3 py-3 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 border-t" style={{ borderColor: "hsl(var(--border) / 0.6)" }}>
                  <div className="flex items-center gap-2">
                    <Music2 className="h-3.5 w-3.5" />
                    {data.tracks.length} pistes
                  </div>
                  <div>{formatTotal(totalDuration)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default LibraryAlbumPage;
