import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/data/library";
import { useSettings } from "@/lib/settings";
import { appendHistory } from "@/lib/listeningHistory";
import { getPosition, setPosition } from "@/lib/positions";
import { eventMatches, parseHotkey } from "@/lib/hotkeys";

type RepeatMode = "off" | "all" | "one";

type PlayerCtx = {
  current: Track | null;
  queue: Track[];
  index: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRepeat: (m: RepeatMode) => void;
  toggleShuffle: () => void;
  addToQueue: (tracks: Track | Track[]) => void;
  playNext: (tracks: Track | Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  jumpTo: (index: number) => void;
  reorder: (from: number, to: number) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // ---------- Audio element ----------
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    audioRef.current.crossOrigin = "anonymous";
  }
  if (!preloadRef.current && typeof Audio !== "undefined") {
    preloadRef.current = new Audio();
    preloadRef.current.preload = "auto";
    preloadRef.current.crossOrigin = "anonymous";
  }

  // ---------- Web Audio graph ----------
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const preampRef = useRef<GainNode | null>(null);
  const eqRef = useRef<BiquadFilterNode[]>([]);
  const balanceRef = useRef<StereoPannerNode | null>(null);
  const monoSplitRef = useRef<ChannelSplitterNode | null>(null);
  const monoMergeRef = useRef<ChannelMergerNode | null>(null);
  const monoMergeGain = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const fadeGainRef = useRef<GainNode | null>(null);
  const audioGraphReady = useRef(false);

  const ensureGraph = useCallback(() => {
    if (audioGraphReady.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const actx = new AC();
      ctxRef.current = actx;

      const src = actx.createMediaElementSource(a);
      sourceRef.current = src;

      const preamp = actx.createGain();
      preampRef.current = preamp;

      const bands = EQ_FREQS.map((hz, i) => {
        const f = actx.createBiquadFilter();
        if (i === 0) f.type = "lowshelf";
        else if (i === EQ_FREQS.length - 1) f.type = "highshelf";
        else f.type = "peaking";
        f.frequency.value = hz;
        f.Q.value = 1.0;
        f.gain.value = 0;
        return f;
      });
      eqRef.current = bands;

      const balance = actx.createStereoPanner();
      balanceRef.current = balance;

      // mono path (split+merge) — bypassed by default
      const split = actx.createChannelSplitter(2);
      const merge = actx.createChannelMerger(2);
      const monoMix = actx.createGain();
      monoMix.gain.value = 0.5;
      monoSplitRef.current = split;
      monoMergeRef.current = merge;
      monoMergeGain.current = monoMix;

      const limiter = actx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.05;
      limiterRef.current = limiter;

      const fadeGain = actx.createGain();
      fadeGainRef.current = fadeGain;

      const master = actx.createGain();
      masterRef.current = master;

      // Wire (default: bypass mono, bypass limiter)
      let node: AudioNode = src;
      node.connect(preamp);
      node = preamp;
      bands.forEach((b) => {
        node.connect(b);
        node = b;
      });
      node.connect(balance);
      node = balance;
      // limiter is conditionally connected each apply
      node.connect(fadeGain);
      fadeGain.connect(master);
      master.connect(actx.destination);

      audioGraphReady.current = true;
    } catch (err) {
      console.warn("[player] WebAudio graph failed", err);
    }
  }, []);

  // ---------- State ----------
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(settings.masterVolume);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>(settings.defaultRepeat);
  const [shuffle, setShuffle] = useState<boolean>(settings.defaultShuffle);

  const current = queue[index] ?? null;

  // ---------- Apply audio params reactively ----------
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = muted;
  }, [muted]);

  useEffect(() => {
    const m = masterRef.current;
    if (m) m.gain.value = muted ? 0 : volume;
    else if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // EQ + preamp + balance + mono + limiter
  useEffect(() => {
    const s = settings;
    const preamp = preampRef.current;
    const eq = eqRef.current;
    const balance = balanceRef.current;
    const limiter = limiterRef.current;
    const fadeGain = fadeGainRef.current;
    const master = masterRef.current;
    if (!preamp || !balance || !fadeGain || !master) return;

    // Preamp
    const preampLin = Math.pow(10, s.preampDb / 20);
    preamp.gain.value = preampLin;

    // EQ
    if (eq.length === s.equalizerBands.length) {
      eq.forEach((node, i) => {
        node.gain.value = s.equalizerEnabled ? s.equalizerBands[i].gain : 0;
      });
    }

    // Balance
    balance.pan.value = Math.max(-1, Math.min(1, s.channelBalance));

    // Mono downmix — re-route balance->{mono} or balance->fadeGain
    try {
      balance.disconnect();
    } catch { /* */ }
    if (s.monoDownmix && monoSplitRef.current && monoMergeRef.current && monoMergeGain.current) {
      const split = monoSplitRef.current;
      const merge = monoMergeRef.current;
      const mix = monoMergeGain.current;
      try { split.disconnect(); } catch {}
      try { merge.disconnect(); } catch {}
      balance.connect(split);
      split.connect(mix, 0);
      split.connect(mix, 1);
      mix.connect(merge, 0, 0);
      mix.connect(merge, 0, 1);
      const target: AudioNode = s.limiter && limiter ? limiter : fadeGain;
      merge.connect(target);
      if (s.limiter && limiter) {
        try { limiter.disconnect(); } catch {}
        limiter.connect(fadeGain);
      }
    } else {
      const target: AudioNode = s.limiter && limiter ? limiter : fadeGain;
      balance.connect(target);
      if (s.limiter && limiter) {
        try { limiter.disconnect(); } catch {}
        limiter.connect(fadeGain);
      }
    }
  }, [
    settings.equalizerEnabled,
    settings.equalizerBands,
    settings.preampDb,
    settings.channelBalance,
    settings.monoDownmix,
    settings.limiter,
  ]);

  // Persist master volume
  useEffect(() => {
    setVolumeState(settings.masterVolume);
  }, [settings.masterVolume]);

  // ---------- Audio events ----------
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const dur = a.duration || 0;
      setProgress(dur ? a.currentTime / dur : 0);
      // Save position throttled (every ~3s)
      if (
        settingsRef.current.rememberPosition &&
        current &&
        Math.floor(a.currentTime) % 3 === 0
      ) {
        setPosition(current.id, a.currentTime);
      }
      // Fade out near the end
      const fout = settingsRef.current.fadeOutMs;
      const fadeGain = fadeGainRef.current;
      if (fout > 0 && fadeGain && ctxRef.current && dur > 0) {
        const remaining = dur - a.currentTime;
        if (remaining > 0 && remaining < fout / 1000 && fadeGain.gain.value > 0.01) {
          const ctxT = ctxRef.current.currentTime;
          fadeGain.gain.cancelScheduledValues(ctxT);
          fadeGain.gain.setValueAtTime(fadeGain.gain.value, ctxT);
          fadeGain.gain.linearRampToValueAtTime(0.0001, ctxT + remaining);
        }
      }
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => handleEnded();
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, index]);

  const handleEnded = useCallback(() => {
    const s = settingsRef.current;
    if (current) setPosition(current.id, 0);
    if (repeat === "one") {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        a.play().catch(() => {});
      }
      return;
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      return;
    }
    if (repeat === "all" && queue.length > 0) {
      setIndex(0);
      return;
    }
    setIsPlaying(false);
    if (s.notifyOnTrackChange && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("Aurum", { body: "Fin de la file" }); } catch {}
    }
  }, [current, repeat, index, queue.length]);

  // Load track on change
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    ensureGraph();
    if (a.src !== current.src) {
      a.src = current.src;
      a.load();
      // Skip very short tracks
      const skip = settingsRef.current.skipShortTracksSec;
      if (skip > 0 && current.duration > 0 && current.duration < skip) {
        // Schedule a forward skip on metadata
        const onLoaded = () => {
          a.removeEventListener("loadedmetadata", onLoaded);
          if ((a.duration || 0) < skip) {
            handleEnded();
          }
        };
        a.addEventListener("loadedmetadata", onLoaded);
      }
      // Resume position
      if (settingsRef.current.rememberPosition) {
        const saved = getPosition(current.id);
        if (saved && saved > 1) {
          const setOnce = () => {
            a.removeEventListener("loadedmetadata", setOnce);
            try { a.currentTime = Math.min(saved, (a.duration || saved) - 1); } catch {}
          };
          a.addEventListener("loadedmetadata", setOnce);
        }
      }
    }
    // Fade-in
    const fin = settingsRef.current.fadeInMs;
    const fadeGain = fadeGainRef.current;
    const ac = ctxRef.current;
    if (ac && fadeGain) {
      const t = ac.currentTime;
      fadeGain.gain.cancelScheduledValues(t);
      if (fin > 0) {
        fadeGain.gain.setValueAtTime(0.0001, t);
        fadeGain.gain.linearRampToValueAtTime(1, t + fin / 1000);
      } else {
        fadeGain.gain.setValueAtTime(1, t);
      }
    }
    // History
    if (settingsRef.current.saveListeningHistory) {
      appendHistory(current);
    }
    // Preload next
    const pre = preloadRef.current;
    const nextT = queue[index + 1];
    if (pre && settingsRef.current.preloadNext && nextT) {
      try {
        if (pre.src !== nextT.src) {
          pre.src = nextT.src;
          pre.load();
        }
      } catch {}
    }
    if (isPlaying) {
      ctxRef.current?.resume().catch(() => {});
      a.play().catch(() => setIsPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      ctxRef.current?.resume().catch(() => {});
      a.play().catch(() => setIsPlaying(false));
    } else {
      a.pause();
    }
  }, [isPlaying]);

  // ---------- Media Session ----------
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
        artwork: current.cover ? [{ src: current.cover, sizes: "512x512" }] : [],
      });
    } catch {}
    if (settings.notifyOnTrackChange && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      if (settings.showOsNotifications && Notification.permission === "granted") {
        try {
          new Notification(current.title, {
            body: `${current.artist} — ${current.album}`,
            icon: current.cover || undefined,
            silent: true,
          });
        } catch {}
      }
    }
  }, [current, settings.notifyOnTrackChange, settings.showOsNotifications]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!settings.mediaKeysEnabled) {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch {}
      return;
    }
    try {
      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        setIndex((i) => Math.min(i + 1, queue.length - 1)),
      );
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        setIndex((i) => Math.max(i - 1, 0)),
      );
    } catch {}
  }, [settings.mediaKeysEnabled, queue.length]);

  // ---------- Hotkeys ----------
  useEffect(() => {
    const map = [
      { hk: parseHotkey(settings.hotkeyPlayPause), action: "playpause" as const },
      { hk: parseHotkey(settings.hotkeyNext), action: "next" as const },
      { hk: parseHotkey(settings.hotkeyPrev), action: "prev" as const },
      { hk: parseHotkey(settings.hotkeyVolumeUp), action: "volup" as const },
      { hk: parseHotkey(settings.hotkeyVolumeDown), action: "voldown" as const },
    ].filter((m) => m.hk) as Array<{ hk: NonNullable<ReturnType<typeof parseHotkey>>; action: string }>;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
      for (const m of map) {
        if (eventMatches(e, m.hk)) {
          e.preventDefault();
          if (m.action === "playpause") setIsPlaying((p) => !p);
          else if (m.action === "next") setIndex((i) => Math.min(i + 1, queue.length - 1));
          else if (m.action === "prev") setIndex((i) => Math.max(i - 1, 0));
          else if (m.action === "volup") setVolumeState((v) => Math.min(1, v + 0.05));
          else if (m.action === "voldown") setVolumeState((v) => Math.max(0, v - 0.05));
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    settings.hotkeyPlayPause,
    settings.hotkeyNext,
    settings.hotkeyPrev,
    settings.hotkeyVolumeUp,
    settings.hotkeyVolumeDown,
    queue.length,
  ]);

  // ---------- Public API ----------
  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    const s = settingsRef.current;
    let arr = tracks;
    if (s.defaultShuffle && tracks.length > 1) {
      const head = tracks[startIndex];
      const rest = tracks.filter((_, i) => i !== startIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      arr = [head, ...rest];
      setQueue(arr);
      setIndex(0);
    } else {
      setQueue(arr);
      setIndex(startIndex);
    }
    setIsPlaying(s.autoPlay);
  }, []);

  const togglePlay = useCallback(() => {
    if (!current) return;
    setIsPlaying((p) => !p);
  }, [current]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length - 1)), [queue.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const seek = useCallback((ratio: number) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = ratio * a.duration;
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const setRepeat = useCallback((m: RepeatMode) => setRepeatState(m), []);
  const toggleShuffle = useCallback(() => {
    setShuffle((sh) => {
      const nextSh = !sh;
      if (nextSh && queue.length > 1) {
        // Fisher-Yates on items after current
        const head = queue.slice(0, index + 1);
        const tail = queue.slice(index + 1);
        for (let i = tail.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tail[i], tail[j]] = [tail[j], tail[i]];
        }
        setQueue([...head, ...tail]);
      }
      return nextSh;
    });
  }, [queue, index]);

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
    () => ({
      current, queue, index, isPlaying, progress, duration, volume, muted, repeat, shuffle,
      playQueue, togglePlay, next, prev, seek, setVolume, toggleMute, setRepeat, toggleShuffle,
      addToQueue, playNext, removeFromQueue, clearQueue, jumpTo, reorder,
    }),
    [current, queue, index, isPlaying, progress, duration, volume, muted, repeat, shuffle,
      playQueue, togglePlay, next, prev, seek, setVolume, toggleMute, setRepeat, toggleShuffle,
      addToQueue, playNext, removeFromQueue, clearQueue, jumpTo, reorder],
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
