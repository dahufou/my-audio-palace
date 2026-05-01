import { z } from "zod";

const Schema = z.object({
  NODE_ENV: z.string().default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4477),
  MUSIC_PATH: z.string().min(1),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  BRIDGE_TOKEN: z.string().min(8),
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),
  TRANSCODE_CACHE: z.string().default("/var/cache/aurum/transcode"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  console.error("[aurum] Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
