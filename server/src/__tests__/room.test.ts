import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, type Restaurant, type ServerMessage } from "@chews/shared";
import { DISCONNECT_GRACE_MS, Room, type RoomSocket } from "../rooms/room.js";

class FakeSocket implements RoomSocket {
  readyState = 1;
  sent: ServerMessage[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  last<T extends ServerMessage["type"]>(type: T) {
    return [...this.sent].reverse().find((m) => m.type === type) as
      | Extract<ServerMessage, { type: T }>
      | undefined;
  }
}

function restaurant(placeId: string): Restaurant {
  return {
    placeId,
    name: placeId,
    rating: 4.5,
    ratingCount: 100,
    priceLevel: 2,
    address: "1 Test St",
    category: "Test",
    photoUrl: null,
    mapsUrl: null,
    openNow: true,
  };
}

const DECK = [restaurant("a"), restaurant("b"), restaurant("c")];

function makeRoom(deck: Restaurant[] = DECK) {
  return new Room("TESTC", async () => deck);
}

let clientSeq = 0;
function joinAs(room: Room, name: string, clientId = `client-${name}-${clientSeq++}`) {
  const socket = new FakeSocket();
  const result = room.join(socket, { clientId, displayName: name });
  if (!result.ok) throw new Error(`join failed: ${result.code}`);
  return { socket, memberId: result.memberId, clientId };
}

/** Starting requires a location, so set one first — like the real host flow. */
function startAs(room: Room, hostId: string) {
  room.setFilters(hostId, { ...DEFAULT_FILTERS, lat: 37.77, lng: -122.42 });
  return room.start(hostId);
}

describe("Room", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes the first joiner host and dedupes display names", () => {
    const room = makeRoom();
    const a = joinAs(room, "Sam");
    const b = joinAs(room, "Sam");
    const joined = b.socket.last("joined")!;
    expect(joined.room.hostId).toBe(a.memberId);
    expect(joined.room.members.map((m) => m.name)).toEqual(["Sam", "Sam (2)"]);
  });

  it("blocks new joins once the session has started", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    joinAs(room, "Pal");
    expect(await startAs(room, host.memberId)).toBeNull();

    const result = room.join(new FakeSocket(), { clientId: "late", displayName: "Late" });
    expect(result).toMatchObject({ ok: false, code: "SESSION_IN_PROGRESS" });
  });

  it("only the host can start or set filters", async () => {
    const room = makeRoom();
    joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    expect(await room.start(pal.memberId)).toMatchObject({ code: "NOT_HOST" });
  });

  it("resumes a member by token with progress intact; wrong token mid-session is blocked", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const token = pal.socket.last("joined")!.resumeToken;
    await startAs(room, host.memberId);

    room.swipe(pal.memberId, "a", true);
    room.handleDisconnect(pal.memberId, pal.socket);

    const rejoin = new FakeSocket();
    const resumed = room.join(rejoin, { clientId: pal.clientId, resumeToken: token });
    expect(resumed).toMatchObject({ ok: true, memberId: pal.memberId });
    expect(rejoin.last("joined")!.room.progressIndex).toBe(1);

    const badToken = room.join(new FakeSocket(), { clientId: pal.clientId, resumeToken: "nope" });
    expect(badToken).toMatchObject({ ok: false, code: "SESSION_IN_PROGRESS" });
  });

  it("hands host to the next member when the host leaves", () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    room.leave(host.memberId);
    expect(pal.socket.last("room_update")!.hostId).toBe(pal.memberId);
  });

  it("announces a unanimous match to everyone and keeps the session swiping", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", true);
    room.swipe(host.memberId, "b", true);
    room.swipe(pal.memberId, "b", false);
    expect(pal.socket.last("match_found")).toBeUndefined();

    room.swipe(pal.memberId, "a", true);
    const found = pal.socket.last("match_found")!;
    expect(found.matches.map((r) => r.placeId)).toEqual(["a"]);
    expect(host.socket.last("match_found")).toBeDefined();

    // Not terminal: swiping continues, and the match lands in final results.
    expect(room.getStatus()).toBe("swiping");
    room.swipe(host.memberId, "c", false);
    room.swipe(pal.memberId, "c", true);
    const finished = pal.socket.last("finished")!;
    expect(finished.matches.map((r) => r.placeId)).toEqual(["a"]);
    // Matched card excluded from ranked; b and c tie on counts so order is deck order.
    expect(finished.ranked.map((r) => r.restaurant.placeId).sort()).toEqual(["b", "c"]);
  });

  it("a resume snapshot mid-session carries the accumulated matches", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const token = pal.socket.last("joined")!.resumeToken;
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", true);
    room.swipe(pal.memberId, "a", true);
    room.handleDisconnect(pal.memberId, pal.socket);

    const rejoin = new FakeSocket();
    room.join(rejoin, { clientId: pal.clientId, resumeToken: token });
    const snapshot = rejoin.last("joined")!.room;
    expect(snapshot.status).toBe("swiping");
    expect(snapshot.matches.map((r) => r.placeId)).toEqual(["a"]);
  });

  it("a match no longer skips the disconnect grace timer or starts the GC clock", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const tri = joinAs(room, "Tri");
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", true);
    room.swipe(pal.memberId, "a", true);
    room.swipe(tri.memberId, "a", true);
    expect(host.socket.last("match_found")).toBeDefined();
    expect(room.getStatus()).toBe("swiping");
    // Live session: no terminal TTL ticking (would expire at +30min if it were).
    expect(room.isExpired(Date.now() + 31 * 60_000)).toBe(false);

    // Disconnecting mid-session still gets the grace period, then removal.
    room.handleDisconnect(tri.memberId, tri.socket);
    expect(host.socket.last("room_update")!.members.find((m) => m.id === tri.memberId)!.connected).toBe(false);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(host.socket.last("room_update")!.members.map((m) => m.id)).not.toContain(tri.memberId);
  });

  it("one departure can complete several matches at once, announced in deck order", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const tri = joinAs(room, "Tri");
    await startAs(room, host.memberId);

    // host and pal both like b then a; tri blocks both.
    room.swipe(host.memberId, "b", true);
    room.swipe(host.memberId, "a", true);
    room.swipe(pal.memberId, "b", true);
    room.swipe(pal.memberId, "a", true);
    expect(host.socket.last("match_found")).toBeUndefined();

    room.leave(tri.memberId);
    const found = host.socket.last("match_found")!;
    const deckOrder = host.socket.last("session_started")!.deck.map((r) => r.placeId);
    const expected = deckOrder.filter((id) => id === "a" || id === "b");
    expect(found.matches.map((r) => r.placeId)).toEqual(expected);
  });

  it("a final swipe can complete a match and finish the session in one pass", async () => {
    const room = makeRoom([restaurant("a")]);
    const room1 = room;
    const host = joinAs(room1, "Host");
    const pal = joinAs(room1, "Pal");
    await startAs(room1, host.memberId);

    room1.swipe(host.memberId, "a", true);
    room1.swipe(pal.memberId, "a", true);
    expect(pal.socket.last("match_found")!.matches.map((r) => r.placeId)).toEqual(["a"]);
    const finished = pal.socket.last("finished")!;
    expect(finished.matches.map((r) => r.placeId)).toEqual(["a"]);
    expect(finished.ranked).toEqual([]);
  });

  it("ignores duplicate swipes on the same place", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", true);
    room.swipe(host.memberId, "a", true);
    // pal has NOT liked "a" — a duplicate like from host must not fake unanimity
    expect(host.socket.last("match_found")).toBeUndefined();
    expect(host.socket.last("joined")).toBeDefined();
  });

  it("removes a disconnected member after the grace period, which can complete a match", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const third = joinAs(room, "Third");
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", true);
    room.swipe(pal.memberId, "a", true);
    expect(host.socket.last("match_found")).toBeUndefined();

    room.handleDisconnect(third.memberId, third.socket);
    expect(host.socket.last("match_found")).toBeUndefined();

    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(host.socket.last("match_found")!.matches.map((r) => r.placeId)).toEqual(["a"]);
  });

  it("finishes with ranked results when the deck is exhausted without unanimity", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const tri = joinAs(room, "Tri");
    await startAs(room, host.memberId);

    room.swipe(host.memberId, "a", false);
    room.swipe(host.memberId, "b", true);
    room.swipe(host.memberId, "c", true);
    room.swipe(pal.memberId, "a", false);
    room.swipe(pal.memberId, "b", true);
    room.swipe(pal.memberId, "c", false);
    room.swipe(tri.memberId, "a", false);
    room.swipe(tri.memberId, "b", false);
    room.swipe(tri.memberId, "c", false);

    // no unanimity; b: 2 likes, c: 1 like + 2 passes, a: no likes (dropped)
    const finished = pal.socket.last("finished")!;
    expect(finished.matches).toEqual([]);
    expect(finished.ranked.map((r) => r.restaurant.placeId)).toEqual(["b", "c"]);
  });

  it("a solo member never self-matches; finishing the deck ends the session", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    await startAs(room, host.memberId);
    room.leave(pal.memberId);

    room.swipe(host.memberId, "a", true);
    expect(host.socket.last("match_found")).toBeUndefined();
    room.swipe(host.memberId, "b", false);
    room.swipe(host.memberId, "c", false);
    const finished = host.socket.last("finished")!;
    expect(finished.matches).toEqual([]);
    expect(finished.ranked.map((r) => r.restaurant.placeId)).toEqual(["a"]);
  });

  it("host finish-now ends the session with matches and ranked-so-far", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    await startAs(room, host.memberId);

    // No match yet: finish-now is locked.
    expect(room.finishNow(host.memberId)).toMatchObject({ code: "BAD_STATE" });

    room.swipe(host.memberId, "a", true);
    room.swipe(pal.memberId, "a", true);
    room.swipe(host.memberId, "b", true);

    // Non-host can't end it.
    expect(room.finishNow(pal.memberId)).toMatchObject({ code: "NOT_HOST" });
    expect(room.getStatus()).toBe("swiping");

    expect(room.finishNow(host.memberId)).toBeNull();
    const finished = pal.socket.last("finished")!;
    expect(finished.matches.map((r) => r.placeId)).toEqual(["a"]);
    // Ranked from votes so far: only b has a like; the match is excluded.
    expect(finished.ranked.map((r) => r.restaurant.placeId)).toEqual(["b"]);
    // Session is over: further finish-now and swipes are rejected/ignored.
    expect(room.finishNow(host.memberId)).toMatchObject({ code: "BAD_STATE" });
  });

  it("finish-now power moves with host handoff", async () => {
    const room = makeRoom();
    const host = joinAs(room, "Host");
    const pal = joinAs(room, "Pal");
    const tri = joinAs(room, "Tri");
    await startAs(room, host.memberId);

    room.swipe(pal.memberId, "a", true);
    room.swipe(tri.memberId, "a", true);
    room.swipe(host.memberId, "a", true);
    expect(pal.socket.last("match_found")).toBeDefined();

    room.leave(host.memberId);
    // pal is the new host; the ex-host's power is gone, pal's works.
    expect(room.finishNow(tri.memberId)).toMatchObject({ code: "NOT_HOST" });
    expect(room.finishNow(pal.memberId)).toBeNull();
    expect(tri.socket.last("finished")!.matches.map((r) => r.placeId)).toEqual(["a"]);
  });

  it("expires when empty, after terminal TTL, and at max age", async () => {
    const room = makeRoom();
    const t0 = Date.now();
    expect(room.isExpired(t0 + 5 * 60_000)).toBe(true); // empty since creation

    const host = joinAs(room, "Host");
    expect(room.isExpired(t0 + 10 * 60_000)).toBe(false);
    room.leave(host.memberId);
    expect(room.isExpired(Date.now() + 5 * 60_000)).toBe(true);
    expect(room.isExpired(t0 + 13 * 60 * 60_000)).toBe(true);
  });
});
