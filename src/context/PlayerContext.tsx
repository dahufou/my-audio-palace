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

  const value = useMemo(
    () => ({ current, queue, index, isPlaying, progress, duration, volume, playQueue, togglePlay, next, prev, seek, setVolume }),
    [current, queue, index, isPlaying, progress, duration, volume, playQueue, togglePlay, next, prev, seek, setVolume],
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
