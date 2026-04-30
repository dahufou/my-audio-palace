import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import album5 from "@/assets/album-5.jpg";
import album6 from "@/assets/album-6.jpg";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  src: string;
  duration: number; // seconds (approx)
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  cover: string;
  description: string;
  tracks: Track[];
};

// Audio sources: Free public-domain / CC0 samples (Kevin MacLeod / Pixabay-hosted CC0)
// Using SoundHelix demo tracks — freely usable for demos.
const SH = (n: number) =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

export const albums: Album[] = [
  {
    id: "midnight-brass",
    title: "Midnight Brass",
    artist: "Lior Vance Quartet",
    year: 2024,
    genre: "Modern Jazz",
    cover: album1,
    description:
      "A late-night séance of brass and shadow. Recorded live in a single take at Studio Lumière.",
    tracks: [
      { id: "mb1", title: "Smoke & Embers", artist: "Lior Vance Quartet", album: "Midnight Brass", cover: album1, src: SH(1), duration: 372 },
      { id: "mb2", title: "Lune Basse", artist: "Lior Vance Quartet", album: "Midnight Brass", cover: album1, src: SH(2), duration: 410 },
      { id: "mb3", title: "Brass for the Sleepless", artist: "Lior Vance Quartet", album: "Midnight Brass", cover: album1, src: SH(3), duration: 348 },
    ],
  },
  {
    id: "marble-suites",
    title: "Marble Suites",
    artist: "Esmé Aubergine",
    year: 2023,
    genre: "Neoclassical",
    cover: album2,
    description: "Four chamber works carved with quiet precision.",
    tracks: [
      { id: "ms1", title: "Suite I — Carrara", artist: "Esmé Aubergine", album: "Marble Suites", cover: album2, src: SH(4), duration: 295 },
      { id: "ms2", title: "Suite II — Pentelic", artist: "Esmé Aubergine", album: "Marble Suites", cover: album2, src: SH(5), duration: 318 },
      { id: "ms3", title: "Suite III — Statuario", artist: "Esmé Aubergine", album: "Marble Suites", cover: album2, src: SH(6), duration: 402 },
    ],
  },
  {
    id: "gold-grid",
    title: "Gold Grid",
    artist: "Octave Null",
    year: 2025,
    genre: "Ambient Electronic",
    cover: album3,
    description: "Hardware synthesis sculpted into geometric stillness.",
    tracks: [
      { id: "gg1", title: "Vector Field", artist: "Octave Null", album: "Gold Grid", cover: album3, src: SH(7), duration: 287 },
      { id: "gg2", title: "Lattice", artist: "Octave Null", album: "Gold Grid", cover: album3, src: SH(8), duration: 339 },
    ],
  },
  {
    id: "amber-hours",
    title: "The Amber Hours",
    artist: "Wren Hollow",
    year: 2022,
    genre: "Folk",
    cover: album4,
    description: "Dust-warm guitar and a voice from the next valley.",
    tracks: [
      { id: "ah1", title: "Long Way West", artist: "Wren Hollow", album: "The Amber Hours", cover: album4, src: SH(9), duration: 244 },
      { id: "ah2", title: "Paper Lantern", artist: "Wren Hollow", album: "The Amber Hours", cover: album4, src: SH(10), duration: 271 },
    ],
  },
  {
    id: "velvet-room",
    title: "Velvet Room",
    artist: "Ceylon June",
    year: 2024,
    genre: "Soul / Vocal",
    cover: album5,
    description: "An intimate set of standards, sung as if to one listener.",
    tracks: [
      { id: "vr1", title: "Halflight", artist: "Ceylon June", album: "Velvet Room", cover: album5, src: SH(11), duration: 226 },
      { id: "vr2", title: "Coffee at Three", artist: "Ceylon June", album: "Velvet Room", cover: album5, src: SH(12), duration: 305 },
    ],
  },
  {
    id: "auric-waves",
    title: "Auric Waves",
    artist: "Halcyon Strings",
    year: 2023,
    genre: "Cinematic",
    cover: album6,
    description: "Sweeping orchestrations for unnamed films.",
    tracks: [
      { id: "aw1", title: "Overture in Gold", artist: "Halcyon Strings", album: "Auric Waves", cover: album6, src: SH(13), duration: 388 },
      { id: "aw2", title: "Coda for the Brave", artist: "Halcyon Strings", album: "Auric Waves", cover: album6, src: SH(14), duration: 421 },
    ],
  },
];

export const allTracks: Track[] = albums.flatMap((a) => a.tracks);
export const findAlbum = (id: string) => albums.find((a) => a.id === id);
