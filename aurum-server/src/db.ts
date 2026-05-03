import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { log } from "./log.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never);
}

/**
 * Applique tous les fichiers .sql du dossier ../sql relatifs au build (dist/db.js -> ../sql).
 * Idempotent : chaque fichier vérifie/insère sa version dans schema_migrations.
 */
export async function runMigrations(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/ -> projet racine -> sql/
  const sqlDir = path.resolve(here, "..", "sql");
  let files: string[];
  try {
    files = (await readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
  } catch (err) {
    log.warn({ sqlDir, err }, "no sql dir, skipping migrations");
    return;
  }

  for (const f of files) {
    const full = path.join(sqlDir, f);
    const sql = await readFile(full, "utf8");
    log.info({ file: f }, "applying migration");
    await pool.query(sql);
  }
  log.info("migrations done");
}
