import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { log } from "./log.js";
import { healthRoutes } from "./routes/health.js";

async function main() {
  const app = Fastify({ logger: log });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(healthRoutes);

  app.get("/", async () => ({
    name: "aurum-server",
    version: "0.1.0",
    docs: "https://github.com/dahufou/my-audio-palace/tree/main/aurum-server",
  }));

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    log.info(`Aurum Server listening on http://${config.HOST}:${config.PORT}`);
    log.info(`Music path: ${config.MUSIC_PATH}`);
  } catch (err) {
    log.error(err, "Failed to start");
    process.exit(1);
  }
}

main();
