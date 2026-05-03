import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { log } from "./log.js";
import { healthRoutes } from "./routes/health.js";
import { libraryRoutes } from "./routes/library.js";
import { runMigrations } from "./db.js";
import { ensureCoversDir } from "./scanner/scan.js";
import { startWatcher, stopWatcher } from "./scanner/watcher.js";

async function main() {
  const app = Fastify({ loggerInstance: log });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(healthRoutes);
  await app.register(libraryRoutes);

  app.get("/", async () => ({
    name: "aurum-server",
    version: "0.1.0",
    docs: "https://github.com/dahufou/my-audio-palace/tree/main/aurum-server",
  }));

  // Migrations + dossier covers avant de démarrer.
  try {
    await runMigrations();
    await ensureCoversDir();
  } catch (err) {
    log.error({ err }, "startup init failed");
    process.exit(1);
  }

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    log.info(`Aurum Server listening on http://${config.HOST}:${config.PORT}`);
    log.info(`Music path: ${config.MUSIC_PATH}`);
  } catch (err) {
    log.error(err, "Failed to start");
    process.exit(1);
  }

  // Watcher temps réel
  try {
    startWatcher(config.MUSIC_PATH);
  } catch (err) {
    log.warn({ err }, "watcher failed to start");
  }

  const shutdown = async (sig: string) => {
    log.info({ sig }, "shutting down");
    await stopWatcher().catch(() => {});
    await app.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));
}

main();
