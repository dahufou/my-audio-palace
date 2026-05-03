// CLI : `npm run scan` -> scanne /mnt/music (ou MUSIC_PATH) et quitte.
import { runMigrations, pool } from "../db.js";
import { scanLibrary, ensureCoversDir } from "../scanner/scan.js";
import { log } from "../log.js";

async function main() {
  await runMigrations();
  await ensureCoversDir();
  const stats = await scanLibrary();
  log.info(stats, "scan finished");
  await pool.end();
}

main().catch((err) => {
  log.error(err, "scan crashed");
  process.exit(1);
});
