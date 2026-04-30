import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatTime, usePlayer } from "@/context/PlayerContext";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

export const NowPlayingBar = () => {
  const { current, isPlaying, togglePlay, next, prev, progress, duration, seek, volume, setVolume } = usePlayer();
  const [muted, setMuted] = useState(false);

  if (!current) {
    return (
      <div className="h-20 border-t border-border bg-card/80 backdrop-blur-xl flex items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Select an album to begin listening
      </div>
    );
  }

  const currentTime = progress * duration;

  return (
    <div className="h-24 border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-6">
        {/* Now playing meta */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm shadow-album">
            <img src={current.cover} alt={current.album} className="h-full w-full object-cover" />
            {isPlaying && (
              <div className="absolute inset-0 flex items-end justify-center gap-[3px] pb-1.5 bg-background/40">
                <span className="eq-bar h-2" />
                <span className="eq-bar h-2" />
                <span className="eq-bar h-2" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-base truncate">{current.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {current.artist} — <span className="italic">{current.album}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-[420px]">
          <div className="flex items-center gap-5">
            <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Previous">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-gold hover:scale-105 transition-transform"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Next">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 w-full">
            <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-right">{formatTime(currentTime)}</span>
            <Slider
              value={[progress * 100]}
              max={100}
              step={0.1}
              onValueChange={([v]) => seek(v / 100)}
              className="flex-1"
            />
            <span className="text-[10px] tabular-nums text-muted-foreground w-9">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center justify-end gap-3">
          <button
            onClick={() => {
              setMuted((m) => !m);
              setVolume(muted ? 0.8 : 0);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Mute"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v / 100)}
            className="w-28"
          />
        </div>
      </div>
    </div>
  );
};
