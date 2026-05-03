// Centralized settings store (localStorage-backed) for the audio app.
// Components subscribe via useSettings() and persist on every change.

import { useEffect, useState, useCallback } from "react";

export type ReplayGainMode = "off" | "track" | "album";
export type CrossfadeShape = "linear" | "equal-power" | "logarithmic";
export type StreamQuality = "auto" | "lossless" | "high" | "normal" | "low";
export type DownloadQuality = "original" | "lossless" | "high";
export type Theme = "dark" | "light" | "system";
export type AccentColor = "gold" | "indigo" | "emerald" | "crimson";
export type Density = "comfortable" | "compact";
export type CoverShape = "square" | "rounded" | "circle";
export type SortAlbums = "title" | "artist" | "year-desc" | "year-asc" | "added";
export type SortArtists = "name" | "albums-count" | "tracks-count";
export type LibraryView = "grid" | "list";
export type Language = "fr" | "en" | "system";

export type EqualizerBand = { hz: number; gain: number };

export type Settings = {
  // ---- Audio engine ----
  outputDevice: string; // "default" or device id
  exclusiveMode: boolean; // bit-perfect WASAPI/CoreAudio
  bitPerfect: boolean;
  sampleRate: "auto" | "44100" | "48000" | "88200" | "96000" | "176400" | "192000";
  bitDepth: "auto" | "16" | "24" | "32";
  dithering: boolean;
  upsampling: boolean;
  outputBufferMs: number; // 20 - 500
  preloadNext: boolean;

  // ---- Volume / dynamics ----
  masterVolume: number; // 0..1
  volumeNormalization: boolean;
  replayGain: ReplayGainMode;
  preampDb: number; // -12..+12
  limiter: boolean;
  monoDownmix: boolean;
  channelBalance: number; // -1..1

  // ---- Equalizer ----
  equalizerEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: EqualizerBand[]; // 10 bands

  // ---- Playback ----
  crossfadeEnabled: boolean;
  crossfadeMs: number; // 0..12000
  crossfadeShape: CrossfadeShape;
  gaplessPlayback: boolean;
  silenceTrim: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  autoPlay: boolean;
  autoPlayRadioWhenQueueEnds: boolean;
  rememberPosition: boolean;
  skipShortTracksSec: number; // 0 disables
  defaultRepeat: "off" | "all" | "one";
  defaultShuffle: boolean;

  // ---- Streaming / Quality ----
  streamQualityWifi: StreamQuality;
  streamQualityCellular: StreamQuality;
  downloadQuality: DownloadQuality;
  downloadOnWifiOnly: boolean;
  maxCacheGb: number; // 0..200

  // ---- Library / scanning ----
  musicPath: string; // server path
  watchFolder: boolean;
  scanOnStartup: boolean;
  ignoreHiddenFiles: boolean;
  groupCompilations: boolean;
  preferEmbeddedArt: boolean;
  fetchExternalMetadata: boolean;
  preferredCoverSizePx: number;
  defaultAlbumSort: SortAlbums;
  defaultArtistSort: SortArtists;
  defaultLibraryView: LibraryView;

  // ---- Network ----
  aurumBaseUrl: string;
  enforceHttps: boolean;
  connectTimeoutMs: number;
  retryCount: number;

  // ---- Appearance ----
  theme: Theme;
  accentColor: AccentColor;
  density: Density;
  coverShape: CoverShape;
  showSpectrumAnalyzer: boolean;
  reducedMotion: boolean;
  fontScale: number; // 0.85..1.25
  language: Language;

  // ---- Integrations ----
  scrobbleLastFm: boolean;
  lastFmUser: string;
  discordRichPresence: boolean;
  publishToCast: boolean;
  enableUpnp: boolean;

  // ---- Notifications ----
  showOsNotifications: boolean;
  notifyOnTrackChange: boolean;
  mediaKeysEnabled: boolean;
  hotkeyPlayPause: string;
  hotkeyNext: string;
  hotkeyPrev: string;
  hotkeyVolumeUp: string;
  hotkeyVolumeDown: string;

  // ---- Privacy ----
  analyticsEnabled: boolean;
  crashReports: boolean;
  saveListeningHistory: boolean;
};

export const DEFAULT_EQ_BANDS: EqualizerBand[] = [
  { hz: 32, gain: 0 },
  { hz: 64, gain: 0 },
  { hz: 125, gain: 0 },
  { hz: 250, gain: 0 },
  { hz: 500, gain: 0 },
  { hz: 1000, gain: 0 },
  { hz: 2000, gain: 0 },
  { hz: 4000, gain: 0 },
  { hz: 8000, gain: 0 },
  { hz: 16000, gain: 0 },
];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  Pop: [-1, 0, 1, 3, 4, 3, 1, 0, -1, -2],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, 0, 0, -1, -1, 2, 3],
  Electronic: [4, 3, 1, 0, -2, 1, 1, 2, 3, 4],
  "Vocal Boost": [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  "Bass Boost": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
};

export const DEFAULT_SETTINGS: Settings = {
  outputDevice: "default",
  exclusiveMode: false,
  bitPerfect: true,
  sampleRate: "auto",
  bitDepth: "auto",
  dithering: true,
  upsampling: false,
  outputBufferMs: 100,
  preloadNext: true,

  masterVolume: 0.8,
  volumeNormalization: true,
  replayGain: "album",
  preampDb: 0,
  limiter: false,
  monoDownmix: false,
  channelBalance: 0,

  equalizerEnabled: false,
  equalizerPreset: "Flat",
  equalizerBands: DEFAULT_EQ_BANDS,

  crossfadeEnabled: false,
  crossfadeMs: 0,
  crossfadeShape: "equal-power",
  gaplessPlayback: true,
  silenceTrim: false,
  fadeInMs: 0,
  fadeOutMs: 0,
  autoPlay: true,
  autoPlayRadioWhenQueueEnds: false,
  rememberPosition: true,
  skipShortTracksSec: 0,
  defaultRepeat: "off",
  defaultShuffle: false,

  streamQualityWifi: "lossless",
  streamQualityCellular: "high",
  downloadQuality: "lossless",
  downloadOnWifiOnly: true,
  maxCacheGb: 10,

  musicPath: "/mnt/music",
  watchFolder: true,
  scanOnStartup: true,
  ignoreHiddenFiles: true,
  groupCompilations: true,
  preferEmbeddedArt: true,
  fetchExternalMetadata: true,
  preferredCoverSizePx: 600,
  defaultAlbumSort: "artist",
  defaultArtistSort: "name",
  defaultLibraryView: "grid",

  aurumBaseUrl: "https://dahufou-aurum.duckdns.org",
  enforceHttps: true,
  connectTimeoutMs: 8000,
  retryCount: 2,

  theme: "dark",
  accentColor: "gold",
  density: "comfortable",
  coverShape: "rounded",
  showSpectrumAnalyzer: true,
  reducedMotion: false,
  fontScale: 1,
  language: "fr",

  scrobbleLastFm: false,
  lastFmUser: "",
  discordRichPresence: false,
  publishToCast: false,
  enableUpnp: false,

  showOsNotifications: true,
  notifyOnTrackChange: true,
  mediaKeysEnabled: true,
  hotkeyPlayPause: "Space",
  hotkeyNext: "Ctrl+Right",
  hotkeyPrev: "Ctrl+Left",
  hotkeyVolumeUp: "Ctrl+Up",
  hotkeyVolumeDown: "Ctrl+Down",

  analyticsEnabled: false,
  crashReports: true,
  saveListeningHistory: true,
};

const STORAGE_KEY = "aurum_settings_v1";

function load(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("aurum:settings-changed", { detail: s }));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => load());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Settings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener("aurum:settings-changed", onChange);
    return () => window.removeEventListener("aurum:settings-changed", onChange);
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const exportJson = useCallback(() => JSON.stringify(settings, null, 2), [settings]);

  const importJson = useCallback((json: string) => {
    const parsed = JSON.parse(json);
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    save(merged);
    setSettings(merged);
  }, []);

  return { settings, update, reset, exportJson, importJson };
}
