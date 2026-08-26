import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { registerRest } from "./rest.js";
import { RoomManager } from "./rooms/manager.js";
import type { DeckProvider } from "./rooms/room.js";
import { registerGateway } from "./ws/gateway.js";
import { startHeartbeat } from "./ws/heartbeat.js";

export interface BuildOptions {
  getDeck: DeckProvider;
  /** Absolute path to the built web client; served with SPA fallback when it exists. */
  staticRoot?: string;
  logLevel?: string;
}

export async function buildApp(opts: BuildOptions): Promise<{ app: FastifyInstance; manager: RoomManager }> {
  const app = Fastify({ logger: { level: opts.logLevel ?? "warn" } });

  await app.register(websocket);

  const manager = new RoomManager(opts.getDeck);
  manager.startGC();

  registerRest(app, manager);
  registerGateway(app, manager);

  if (opts.staticRoot && existsSync(opts.staticRoot)) {
    await app.register(fastifyStatic, { root: opts.staticRoot });
    // SPA fallback so /room/ABCDE deep links load the client.
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api") || req.raw.url?.startsWith("/ws")) {
        return reply.code(404).send({ error: "not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  const stopHeartbeat = startHeartbeat(app.websocketServer);
  app.addHook("onClose", async () => {
    stopHeartbeat();
    manager.stopGC();
  });

  return { app, manager };
}
