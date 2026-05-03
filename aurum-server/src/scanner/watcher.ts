import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import { config } from "../config.js";
import { log } from "../log.js";
import { indexFile, removeByPath } from "./scan.js";

const AUDIO_EXTS = new Set([
  ".flac", ".mp3", ".m4a", ".alac", ".ogg", ".opus",
  ".wav", ".aif", ".aiff", ".wma", ".ape", ".dsf", ".dff",
]);

let watcher: FSWatcher | null = null;

function isAudio(p: string): boolean {
  return AUDIO_EXTS.has(path.extname(p).toLowerCase());
}

/** Démarre la surveillance du dossier musique. Idempotent. */
export function startWatcher(root: string = config.MUSIC_PATH): FSWatcher {
  if (watcher) return watcher;

  log.info({ root }, "watcher: starting");
  watcher = chokidar.watch(root, {
    ignored: (p) => path.basename(p).startsWith("."),
    ignoreInitial: true,            // le scan complet est déclenché à part
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
    usePolling: false,
  });

  const queue = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  const flush = () => {
    timer = null;
    const batch = Array.from(queue);
    queue.clear();
    (async () => {
      for (const f of batch) {
        try {
          const r = await indexFile(f);
          log.info({ file: f, result: r }, "watcher: indexed");
        } catch (err) {
          log.warn({ file: f, err }, "watcher: index failed");
        }
      }
    })();
  };
  const debounce = (f: string) => {
    queue.add(f);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 800);
  };

  watcher
    .on("add", (p) => { if (isAudio(p)) debounce(p); })
    .on("change", (p) => { if (isAudio(p)) debounce(p); })
    .on("unlink", async (p) => {
      if (!isAudio(p)) return;
      try {
        const removed = await removeByPath(p);
        log.info({ file: p, removed }, "watcher: unlink");
      } catch (err) {
        log.warn({ file: p, err }, "watcher: unlink failed");
      }
    })
    .on("error", (err) => log.warn({ err }, "watcher error"))
    .on("ready", () => log.info("watcher: ready"));

  return watcher;
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}
