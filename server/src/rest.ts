import type { FastifyInstance } from "fastify";
import { fetchPhoto, fetchStaticMap } from "./places/client.js";
import type { RoomManager } from "./rooms/manager.js";

const CREATES_PER_MINUTE_PER_IP = 20;

export function registerRest(app: FastifyInstance, manager: RoomManager) {
  const recentCreates = new Map<string, number[]>();

  app.post("/api/rooms", async (req, reply) => {
    const now = Date.now();
    // Drop expired entries wholesale so the map stays bounded by IPs seen in the last minute.
    for (const [ip, all] of recentCreates) {
      if (all.every((t) => now - t >= 60_000)) recentCreates.delete(ip);
    }
    const stamps = (recentCreates.get(req.ip) ?? []).filter((t) => now - t < 60_000);
    if (stamps.length >= CREATES_PER_MINUTE_PER_IP) {
      return reply.code(429).send({ error: "Slow down — too many rooms created." });
    }
    stamps.push(now);
    recentCreates.set(req.ip, stamps);

    const room = manager.createRoom();
    if (!room) {
      return reply.code(503).send({ error: "The server is at capacity right now. Try again in a bit." });
    }
    return { code: room.code };
  });

  app.get<{ Params: { code: string } }>("/api/rooms/:code", async (req) => {
    const room = manager.get(req.params.code);
    return room
      ? { exists: true, status: room.getStatus(), joinable: room.isJoinable() }
      : { exists: false, status: null, joinable: false };
  });

  // Server-side photo proxy: the Google API key never reaches the browser.
  app.get<{ Querystring: { name?: string; w?: string } }>("/api/photo", async (req, reply) => {
    const { name, w } = req.query;
    if (!name) return reply.code(400).send({ error: "missing name" });
    const photo = await fetchPhoto(name, Number(w ?? 800));
    if (!photo) return reply.code(404).send({ error: "photo unavailable" });
    return reply
      .header("Content-Type", photo.contentType)
      .header("Cache-Control", "public, max-age=86400, immutable")
      .send(Buffer.from(photo.bytes));
  });

  // Same deal for the detail sheet's location preview.
  app.get<{ Querystring: { lat?: string; lng?: string; w?: string } }>(
    "/api/staticmap",
    async (req, reply) => {
      const { lat, lng, w } = req.query;
      if (lat == null || lng == null) return reply.code(400).send({ error: "missing lat/lng" });
      const image = await fetchStaticMap(Number(lat), Number(lng), Number(w ?? 640));
      if (!image) return reply.code(404).send({ error: "map unavailable" });
      return reply
        .header("Content-Type", image.contentType)
        .header("Cache-Control", "public, max-age=86400, immutable")
        .send(Buffer.from(image.bytes));
    },
  );

  app.get("/healthz", async () => ({ ok: true, rooms: manager.size }));
}
