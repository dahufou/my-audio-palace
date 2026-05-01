import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    let db = "down";
    try {
      const r = await query<{ ok: number }>("select 1 as ok");
      if (r.rows[0]?.ok === 1) db = "up";
    } catch {
      /* db down */
    }
    return { status: "ok", service: "aurum-server", db };
  });
}
