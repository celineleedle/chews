import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import type { ServerMessage } from "@chews/shared";
import { buildApp } from "../app.js";
import { MOCK_RESTAURANTS } from "../places/mock.js";

let app: FastifyInstance;
let baseUrl: string;
let wsUrl: string;

class TestClient {
  ws: WebSocket;
  private queue: ServerMessage[] = [];
  private waiters: Array<{ type: string; resolve: (m: ServerMessage) => void }> = [];

  constructor() {
    this.ws = new WebSocket(wsUrl);
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const waiterIdx = this.waiters.findIndex((w) => w.type === msg.type);
      if (waiterIdx >= 0) {
        this.waiters.splice(waiterIdx, 1)[0]!.resolve(msg);
      } else {
        this.queue.push(msg);
      }
    });
  }

  ready() {
    return new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor<T extends ServerMessage["type"]>(type: T, timeoutMs = 3000) {
    const queued = this.queue.findIndex((m) => m.type === type);
    if (queued >= 0) {
      return Promise.resolve(this.queue.splice(queued, 1)[0] as Extract<ServerMessage, { type: T }>);
    }
    return new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        type,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }
}

beforeAll(async () => {
  ({ app } = await buildApp({ getDeck: async () => MOCK_RESTAURANTS.slice(0, 5) }));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (typeof address === "string" || !address) throw new Error("no address");
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/ws`;
});

afterAll(async () => {
  await app.close();
});

describe("end-to-end room flow over real websockets", () => {
  it("three clients join, start, swipe, and all see the match; a killed socket resumes", async () => {
    const createRes = await fetch(`${baseUrl}/api/rooms`, { method: "POST" });
    const { code } = (await createRes.json()) as { code: string };
    expect(code).toMatch(/^[A-Z2-9]{5}$/);

    const [ana, ben, cal] = [new TestClient(), new TestClient(), new TestClient()];
    await Promise.all([ana.ready(), ben.ready(), cal.ready()]);

    ana.send({ type: "join", roomCode: code, clientId: "client-ana-0001", displayName: "Ana" });
    const anaJoined = await ana.waitFor("joined");
    ben.send({ type: "join", roomCode: code, clientId: "client-ben-0001", displayName: "Ben" });
    await ben.waitFor("joined");
    cal.send({ type: "join", roomCode: code, clientId: "client-cal-0001", displayName: "Cal" });
    const calJoined = await cal.waitFor("joined");
    expect(calJoined.room.members).toHaveLength(3);
    expect(calJoined.room.hostId).toBe(anaJoined.memberId);

    // Non-host cannot start
    ben.send({ type: "start_session" });
    expect((await ben.waitFor("error")).code).toBe("NOT_HOST");

    ana.send({ type: "start_session" });
    const [deckA, deckB, deckC] = await Promise.all([
      ana.waitFor("session_started"),
      ben.waitFor("session_started"),
      cal.waitFor("session_started"),
    ]);
    // Identical ordered deck for everyone
    expect(deckB.deck.map((r) => r.placeId)).toEqual(deckA.deck.map((r) => r.placeId));
    expect(deckC.deck.map((r) => r.placeId)).toEqual(deckA.deck.map((r) => r.placeId));

    const target = deckA.deck[0]!.placeId;
    ana.send({ type: "swipe", placeId: target, liked: true });
    ben.send({ type: "swipe", placeId: target, liked: true });
    cal.send({ type: "swipe", placeId: target, liked: true });
    const [matchedA, matchedB, matchedC] = await Promise.all([
      ana.waitFor("matched"),
      ben.waitFor("matched"),
      cal.waitFor("matched"),
    ]);
    expect(matchedA.winner.placeId).toBe(target);
    expect(matchedB.winner.placeId).toBe(target);
    expect(matchedC.winner.placeId).toBe(target);

    for (const c of [ana, ben, cal]) c.ws.close();
  });

  it("a killed socket resumes mid-session with progress intact", async () => {
    const { code } = (await (await fetch(`${baseUrl}/api/rooms`, { method: "POST" })).json()) as {
      code: string;
    };
    const host = new TestClient();
    const pal = new TestClient();
    await Promise.all([host.ready(), pal.ready()]);

    host.send({ type: "join", roomCode: code, clientId: "client-host-0002", displayName: "Host" });
    await host.waitFor("joined");
    pal.send({ type: "join", roomCode: code, clientId: "client-pal-00002", displayName: "Pal" });
    const palJoined = await pal.waitFor("joined");

    host.send({ type: "start_session" });
    const { deck } = await pal.waitFor("session_started");

    pal.send({ type: "swipe", placeId: deck[0]!.placeId, liked: true });
    await pal.waitFor("progress");
    pal.ws.terminate();

    const palAgain = new TestClient();
    await palAgain.ready();
    palAgain.send({
      type: "join",
      roomCode: code,
      clientId: "client-pal-00002",
      resumeToken: palJoined.resumeToken,
    });
    const resumed = await palAgain.waitFor("joined");
    expect(resumed.memberId).toBe(palJoined.memberId);
    expect(resumed.room.status).toBe("swiping");
    expect(resumed.room.progressIndex).toBe(1);

    host.ws.close();
    palAgain.ws.close();
  });

  it("joining a nonexistent room errors instead of creating one", async () => {
    const client = new TestClient();
    await client.ready();
    client.send({ type: "join", roomCode: "ZZZZZ", clientId: "client-lost-001", displayName: "Lost" });
    expect((await client.waitFor("error")).code).toBe("ROOM_NOT_FOUND");
    client.ws.close();
  });
});
