import { AppLayout } from "@/components/AppLayout";
import { usePlayer, formatTime } from "@/context/PlayerContext";
import { ListMusic, Play, Pause, Trash2, X, ChevronUp, ChevronDown, Music2 } from "lucide-react";

const QueuePage = () => {
  const { queue, index, current, isPlaying, togglePlay, jumpTo, removeFromQueue, clearQueue, reorder } = usePlayer();

  const totalSec = queue.reduce((acc, t) => acc + (t.duration || 0), 0);
  const remainingSec = queue.slice(index).reduce((acc, t) => acc + (t.duration || 0), 0);

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <div className="border-b border-border pb-5">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Lecture</div>
          <h1 className="font-display text-5xl md:text-6xl mt-1">File d'attente</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ListMusic className="h-3.5 w-3.5" />
              {queue.length} {queue.length > 1 ? "pistes" : "piste"}
            </span>
            {queue.length > 0 && (
              <>
                <span>· Total {formatTime(totalSec)}</span>
                <span>· Restant {formatTime(remainingSec)}</span>
              </>
            )}
          </div>

          {queue.length > 0 && (
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={clearQueue}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-border text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vider la file
              </button>
            </div>
          )}
        </div>

        {queue.length === 0 && (
          <div className="mt-20 flex flex-col items-center text-center text-muted-foreground">
            <Music2 className="h-10 w-10 mb-4 opacity-40" />
            <p className="text-sm">Aucune piste dans la file d'attente.</p>
            <p className="text-xs mt-1 opacity-70">Lancez un album ou ajoutez des morceaux pour commencer.</p>
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-8 space-y-1">
            {queue.map((t, i) => {
              const active = i === index;
              const past = i < index;
              return (
                <div
                  key={`${t.id}-${i}`}
                  className="group grid items-center gap-3 px-3 py-2.5 rounded-sm transition-colors hover:bg-accent/40"
                  style={{
                    gridTemplateColumns: "2.5rem 3rem minmax(0,1fr) 4rem auto",
                    background: active ? "hsl(var(--indigo-bright) / 0.08)" : undefined,
                    opacity: past ? 0.5 : 1,
                  }}
                >
                  <button
                    onClick={() => (active ? togglePlay() : jumpTo(i))}
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={active && isPlaying ? "Pause" : "Lire"}
                  >
                    {active && isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <>
                        <span className="text-xs tabular-nums group-hover:hidden">{i + 1}</span>
                        <Play className="h-4 w-4 hidden group-hover:block fill-current" />
                      </>
                    )}
                  </button>
                  <div className="h-10 w-10 shrink-0 rounded-sm overflow-hidden bg-muted">
                    {t.cover ? (
                      <img src={t.cover} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm" style={{ fontWeight: active ? 600 : 400 }}>
                      {t.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.artist} — <span className="italic">{t.album}</span>
                    </div>
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground text-right">
                    {formatTime(t.duration || 0)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => reorder(i, i - 1)}
                      disabled={i === 0}
                      className="p-1.5 rounded-sm hover:bg-accent disabled:opacity-30"
                      aria-label="Monter"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => reorder(i, i + 1)}
                      disabled={i === queue.length - 1}
                      className="p-1.5 rounded-sm hover:bg-accent disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="p-1.5 rounded-sm hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Retirer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default QueuePage;
