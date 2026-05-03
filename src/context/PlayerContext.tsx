import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/data/library";

type PlayerCtx = {
  current: Track | null;
  queue: Track[];
  index: number;
  isPlaying: boolean;
  progress: number; // 0..1
  duration: number;
  volume: number;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  addToQueue: (tracks: Track | Track[]) => void;
  playNext: (tracks: Track | Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  jumpTo: (index: number) => void;
  reorder: (from: number, to: number) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);

  const current = queue[index] ?? null;

  // Bind audio events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setProgress(a.duration ? a.currentTime / a.duration : 0);
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => {
      setIndex((i) => (i + 1 < queue.length ? i + 1 : i));
      if (index + 1 >= queue.length) setIsPlaying(false);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [queue.length, index]);

  // Load src on track change
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.src !== current.src) {
      a.src = current.src;
      a.load();
    }
    if (isPlaying) {
      a.play().catch(() => setIsPlaying(false));
    }
  }, [current, isPlaying]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    setQueue(tracks);
    setIndex(startIndex);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }, [current]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length - 1)), [queue.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const seek = useCallback((ratio: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = ratio * a.duration;
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);

  const addToQueue = useCallback((tracks: Track | Track[]) => {
    const arr = Array.isArray(tracks) ? tracks : [tracks];
    setQueue((q) => {
      if (q.length === 0) {
        setIndex(0);
        setIsPlaying(true);
        return arr;
      }
      return [...q, ...arr];
    });
  }, []);

  const playNext = useCallback((tracks: Track | Track[]) => {
    const arr = Array.isArray(tracks) ? tracks : [tracks];
    setQueue((q) => {
      if (q.length === 0) {
        setIndex(0);
        setIsPlaying(true);
        return arr;
      }
      const copy = [...q];
      copy.splice(index + 1, 0, ...arr);
      return copy;
    });
  }, [index]);

  const removeFromQueue = useCallback((i: number) => {
    setQueue((q) => {
      const copy = q.filter((_, idx) => idx !== i);
      setIndex((cur) => {
        if (i < cur) return cur - 1;
        if (i === cur) return Math.min(cur, copy.length - 1);
        return cur;
      });
      return copy;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setIndex(0);
    setIsPlaying(false);
  }, []);

  const jumpTo = useCallback((i: number) => {
    setIndex(i);
    setIsPlaying(true);
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setQueue((q) => {
      if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return q;
      const copy = [...q];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      setIndex((cur) => {
        if (cur === from) return to;
        if (from < cur && to >= cur) return cur - 1;
        if (from > cur && to <= cur) return cur + 1;
        return cur;
      });
      return copy;
    });
  }, []);

  const value = useMemo(
    () => ({ current, queue, index, isPlaying, progress, duration, volume, playQueue, togglePlay, next, prev, seek, setVolume, addToQueue, playNext, removeFromQueue, clearQueue, jumpTo, reorder }),
    [current, queue, index, isPlaying, progress, duration, volume, playQueue, togglePlay, next, prev, seek, setVolume, addToQueue, playNext, removeFromQueue, clearQueue, jumpTo, reorder],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
};

export const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};
