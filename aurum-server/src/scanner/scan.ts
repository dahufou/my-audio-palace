import { stat, readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { selectCover, type IAudioMetadata, type IOptions } from "music-metadata";
import { query } from "../db.js";
import { config } from "../config.js";
import { log } from "../log.js";

const AUDIO_EXTS = new Set([
  ".flac", ".mp3", ".m4a", ".alac", ".ogg", ".opus",
  ".wav", ".aif", ".aiff", ".wma", ".ape", ".dsf", ".dff",
]);
const COVER_NAMES = ["cover", "folder", "front", "albumart", "album"];
const COVER_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const COVERS_DIR = path.join("/var/cache/aurum", "covers");

type ParseFile = (filePath: string, options?: IOptions) => Promise<IAudioMetadata>;

async function parseAudioFile(filePath: string, options?: IOptions): Promise<IAudioMetadata> {
  const mm = await import("music-metadata");
  const parseFile = (mm as unknown as { parseFile?: ParseFile }).parseFile;
  if (!parseFile) throw new Error("music-metadata parseFile export is unavailable in this Node runtime");
  return parseFile(filePath, options);
}

export interface ScanStats {
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export async function ensureCoversDir(): Promise<void> {
  await mkdir(COVERS_DIR, { recursive: true });
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    log.warn({ dir, err }, "walk: cannot read dir");
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (AUDIO_EXTS.has(ext)) yield full;
    }
  }
}

/** Cherche un fichier cover.* / folder.* / front.* dans le dossier. */
async function findFolderCover(folder: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(folder);
  } catch {
    return null;
  }
  const lower = entries.map((n) => [n, n.toLowerCase()] as const);
  for (const base of COVER_NAMES) {
    for (const ext of COVER_EXTS) {
      const target = base + ext;
      const found = lower.find(([, l]) => l === target);
      if (found) return path.join(folder, found[0]);
    }
  }
  return null;
}

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png":  return "image/png";
    case ".webp": return "image/webp";
    default:      return "application/octet-stream";
  }
}

async function upsertArtist(name: string): Promise<string> {
  const r = await query<{ id: string }>(
    `insert into artists (name) values ($1)
     on conflict (name) do update set name = excluded.name
     returning id`,
    [name],
  );
  return r.rows[0].id;
}

async function upsertAlbum(
  artistId: string,
  title: string,
  year: number | null,
  folder: string,
): Promise<string> {
  const r = await query<{ id: string }>(
    `insert into albums (artist_id, title, year, folder_path)
     values ($1, $2, $3, $4)
     on conflict (artist_id, title)
     do update set year = coalesce(excluded.year, albums.year),
                   folder_path = excluded.folder_path
     returning id`,
    [artistId, title, year, folder],
  );
  return r.rows[0].id;
}

async function setAlbumCoverIfMissing(
  albumId: string,
  coverPath: string,
  mime: string,
): Promise<void> {
  await query(
    `update albums set cover_path = $2, cover_mime = $3
     where id = $1 and (cover_path is null or cover_path = '')`,
    [albumId, coverPath, mime],
  );
}

async function extractEmbeddedCover(
  filePath: string,
  albumId: string,
): Promise<{ path: string; mime: string } | null> {
  try {
    const meta = await parseAudioFile(filePath, { skipCovers: false });
    const cover = selectCover(meta.common.picture);
    if (!cover) return null;
    await ensureCoversDir();
    const ext =
      cover.format === "image/png" ? ".png" :
      cover.format === "image/webp" ? ".webp" : ".jpg";
    const out = path.join(COVERS_DIR, `${albumId}${ext}`);
    await writeFile(out, cover.data);
    return { path: out, mime: cover.format };
  } catch (err) {
    log.warn({ filePath, err }, "extract cover failed");
    return null;
  }
}

/**
 * Indexe un fichier audio.
 * Retourne 'added' | 'updated' | 'skipped'.
 */
export async function indexFile(
  filePath: string,
): Promise<"added" | "updated" | "skipped" | "error"> {
  let st;
  try {
    st = await stat(filePath);
  } catch {
    return "error";
  }

  // Skip si fichier déjà indexé et mtime inchangé
  const existing = await query<{ id: string; album_id: string; file_mtime: Date | null }>(
    `select id, album_id, file_mtime from tracks where file_path = $1`,
    [filePath],
  );
  if (existing.rows[0]?.file_mtime) {
    const prev = existing.rows[0].file_mtime.getTime();
    if (Math.abs(prev - st.mtimeMs) < 1000) return "skipped";
  }

  let meta;
  try {
    meta = await parseAudioFile(filePath, { skipCovers: true, duration: true });
  } catch (err) {
    log.warn({ filePath, err }, "metadata parse failed");
    return "error";
  }

  const c = meta.common;
  const f = meta.format;
  const artistName = (c.albumartist || c.artist || "Unknown Artist").trim();
  const albumTitle = (c.album || "Unknown Album").trim();
  const trackTitle = (c.title || path.basename(filePath, path.extname(filePath))).trim();
  const folder = path.dirname(filePath);

  const artistId = await upsertArtist(artistName);
  const albumId = await upsertAlbum(artistId, albumTitle, c.year ?? null, folder);

  // Cover: dossier prioritaire, fallback embedded
  const folderCover = await findFolderCover(folder);
  if (folderCover) {
    await setAlbumCoverIfMissing(albumId, folderCover, mimeFromExt(path.extname(folderCover)));
  } else {
    const exists = await query<{ cover_path: string | null }>(
      `select cover_path from albums where id = $1`,
      [albumId],
    );
    if (!exists.rows[0]?.cover_path) {
      const ext = await extractEmbeddedCover(filePath, albumId);
      if (ext) await setAlbumCoverIfMissing(albumId, ext.path, ext.mime);
    }
  }

  const codec = (f.codec || "").toLowerCase();
  const lossless = !!f.lossless;
  const container = (f.container || "").toLowerCase();

  const upsert = await query<{ id: string; xmax: string }>(
    `insert into tracks
       (album_id, artist_id, title, track_no, disc_no, duration_sec,
        bitrate, sample_rate, channels, codec, container, lossless,
        file_path, file_size, file_mtime)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (file_path) do update set
       album_id = excluded.album_id,
       artist_id = excluded.artist_id,
       title = excluded.title,
       track_no = excluded.track_no,
       disc_no = excluded.disc_no,
       duration_sec = excluded.duration_sec,
       bitrate = excluded.bitrate,
       sample_rate = excluded.sample_rate,
       channels = excluded.channels,
       codec = excluded.codec,
       container = excluded.container,
       lossless = excluded.lossless,
       file_size = excluded.file_size,
       file_mtime = excluded.file_mtime
     returning id, xmax::text as xmax`,
    [
      albumId,
      artistId,
      trackTitle,
      c.track?.no ?? null,
      c.disk?.no ?? null,
      f.duration ?? null,
      f.bitrate ? Math.round(f.bitrate) : null,
      f.sampleRate ?? null,
      f.numberOfChannels ?? null,
      codec || null,
      container || null,
      lossless,
      filePath,
      st.size,
      new Date(st.mtimeMs),
    ],
  );

  // xmax = '0' pour insert, sinon update
  const wasInsert = upsert.rows[0]?.xmax === "0";
  return wasInsert ? "added" : "updated";
}

export async function removeByPath(filePath: string): Promise<boolean> {
  const r = await query(`delete from tracks where file_path = $1`, [filePath]);
  return (r.rowCount ?? 0) > 0;
}

/** Scan complet de la racine. */
export async function scanLibrary(root: string = config.MUSIC_PATH): Promise<ScanStats> {
  const t0 = Date.now();
  const stats: ScanStats = {
    scanned: 0, added: 0, updated: 0, skipped: 0, errors: 0, durationMs: 0,
  };
  log.info({ root }, "scan: start");
  for await (const file of walk(root)) {
    stats.scanned++;
    const r = await indexFile(file);
    if (r === "added") stats.added++;
    else if (r === "updated") stats.updated++;
    else if (r === "skipped") stats.skipped++;
    else stats.errors++;
    if (stats.scanned % 200 === 0) {
      log.info({ ...stats }, "scan: progress");
    }
  }
  stats.durationMs = Date.now() - t0;
  log.info({ ...stats }, "scan: done");
  return stats;
}

/** Lit le binaire d'une cover (fichier sur disque). */
export async function readCoverFile(p: string): Promise<Buffer> {
  return readFile(p);
}

/** Hash stable pour ETag de cover. */
export function etagFor(p: string, mtimeMs: number): string {
  return `"${crypto.createHash("sha1").update(`${p}:${mtimeMs}`).digest("hex")}"`;
}
