import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_FILTERS,
  type ErrorCode,
  type Filters,
  type MatchResult,
  type MemberInfo,
  type Restaurant,
  type RoomSnapshot,
  type RoomStatus,
  type ServerMessage,
} from "@chews/shared";
import { allDone, checkUnanimous, rankResults, type VoteMap } from "./match.js";

/** The slice of a WebSocket the room needs — keeps tests free of real sockets. */
export interface RoomSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}
const SOCKET_OPEN = 1;

export interface DeckProvider {
  (filters: Filters): Promise<Restaurant[]>;
}

interface Member {
  id: string;
  clientId: string;
  name: string;
  resumeToken: string;
  joinSeq: number;
  socket: RoomSocket | null;
  connected: boolean;
  graceTimer: ReturnType<typeof setTimeout> | null;
  deckDone: boolean;
  /** placeIds this member has voted on — dedupes swipes and doubles as progress. */
  swiped: Set<string>;
}

export type JoinResult =
  | { ok: true; memberId: string }
  | { ok: false; code: ErrorCode; message: string };

export const MAX_MEMBERS = 10;
export const DISCONNECT_GRACE_MS = 60_000;
const DECK_CAP = 30;

const EMPTY_ROOM_TTL_MS = 5 * 60_000;
const TERMINAL_ROOM_TTL_MS = 30 * 60_000;
const MAX_ROOM_AGE_MS = 12 * 60 * 60_000;

export class Room {
  readonly code: string;
  readonly createdAt = Date.now();

  private status: RoomStatus = "lobby";
  private hostId: string | null = null;
  private filters: Filters = { ...DEFAULT_FILTERS };
  private members = new Map<string, Member>();
  private joinCounter = 0;
  private starting = false;

  private deck: Restaurant[] = [];
  private deckIds = new Set<string>();
  private active = new Set<string>();
  private likes: VoteMap = new Map();
  private passes: VoteMap = new Map();
  private result: MatchResult | null = null;

  private emptySince: number | null = Date.now();
  private terminalAt: number | null = null;

  constructor(code: string, private getDeck: DeckProvider) {
    this.code = code;
  }

  // -- joining / leaving ----------------------------------------------------

  join(socket: RoomSocket, opts: { clientId: string; displayName?: string; resumeToken?: string }): JoinResult {
    const existing = [...this.members.values()].find((m) => m.clientId === opts.clientId);

    if (existing && opts.resumeToken === existing.resumeToken) {
      this.attach(existing, socket);
      return { ok: true, memberId: existing.id };
    }

    // A clientId we know but with a bad/missing token: in the lobby, treat it
    // as a fresh join replacing the stale member; mid-session it can't resume.
    if (existing && this.status === "lobby") {
      this.removeMember(existing.id, { silent: true });
    } else if (existing) {
      return { ok: false, code: "SESSION_IN_PROGRESS", message: "This session already started and we couldn't restore your seat." };
    }

    if (this.status !== "lobby") {
      return {
        ok: false,
        code: "SESSION_IN_PROGRESS",
        message: "This crew already started swiping — ask them for the verdict, or start a fresh room.",
      };
    }
    if (this.members.size >= MAX_MEMBERS) {
      return { ok: false, code: "ROOM_FULL", message: `Rooms max out at ${MAX_MEMBERS} people.` };
    }
    const name = opts.displayName?.trim();
    if (!name) {
      return { ok: false, code: "NAME_REQUIRED", message: "Pick a display name first." };
    }

    const member: Member = {
      id: randomUUID(),
      clientId: opts.clientId,
      name: this.dedupeName(name),
      resumeToken: randomBytes(16).toString("hex"),
      joinSeq: this.joinCounter++,
      socket: null,
      connected: false,
      graceTimer: null,
      deckDone: false,
      swiped: new Set(),
    };
    this.members.set(member.id, member);
    this.emptySince = null;
    if (this.hostId === null) this.hostId = member.id;
    this.attach(member, socket);
    return { ok: true, memberId: member.id };
  }

  private attach(member: Member, socket: RoomSocket) {
    if (member.graceTimer) {
      clearTimeout(member.graceTimer);
      member.graceTimer = null;
    }
    if (member.socket && member.socket !== socket && member.socket.readyState === SOCKET_OPEN) {
      member.socket.close(4000, "replaced by a newer connection");
    }
    member.socket = socket;
    member.connected = true;
    this.sendTo(member, {
      type: "joined",
      memberId: member.id,
      resumeToken: member.resumeToken,
      room: this.snapshotFor(member.id),
    });
    this.broadcastRoomUpdate();
  }

  private dedupeName(name: string): string {
    const taken = new Set([...this.members.values()].map((m) => m.name));
    if (!taken.has(name)) return name;
    for (let n = 2; ; n++) {
      const candidate = `${name} (${n})`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /** Socket closed. Only counts if it's the member's *current* socket. */
  handleDisconnect(memberId: string, socket: RoomSocket) {
    const member = this.members.get(memberId);
    if (!member || member.socket !== socket) return;
    member.socket = null;
    member.connected = false;
    if (this.isTerminal()) {
      this.broadcastRoomUpdate();
      return;
    }
    member.graceTimer = setTimeout(() => this.removeMember(memberId), DISCONNECT_GRACE_MS);
    this.broadcastRoomUpdate();
  }

  /** Explicit leave — no grace period. */
  leave(memberId: string) {
    this.removeMember(memberId);
  }

  private removeMember(memberId: string, opts: { silent?: boolean } = {}) {
    const member = this.members.get(memberId);
    if (!member) return;
    if (member.graceTimer) clearTimeout(member.graceTimer);
    if (member.socket && member.socket.readyState === SOCKET_OPEN) {
      member.socket.close(4001, "left room");
    }
    this.members.delete(memberId);
    this.active.delete(memberId);

    if (this.members.size === 0) {
      this.emptySince = Date.now();
      this.hostId = null;
      return;
    }
    if (this.hostId === memberId) {
      const next = [...this.members.values()]
        .sort((a, b) => a.joinSeq - b.joinSeq)
        .sort((a, b) => Number(b.connected) - Number(a.connected))[0]!;
      this.hostId = next.id;
    }
    // A departure can complete unanimity or finish the deck for the rest.
    this.evaluate();
    if (!opts.silent) this.broadcastRoomUpdate();
  }

  // -- lobby ----------------------------------------------------------------

  setFilters(memberId: string, filters: Filters): ErrorCode | null {
    if (this.status !== "lobby") return "BAD_STATE";
    if (memberId !== this.hostId) return "NOT_HOST";
    this.filters = filters;
    this.broadcastRoomUpdate();
    return null;
  }

  async start(memberId: string): Promise<{ code: ErrorCode; message: string } | null> {
    if (memberId !== this.hostId) return { code: "NOT_HOST", message: "Only the host can start the session." };
    if (this.status !== "lobby" || this.starting) return { code: "BAD_STATE", message: "The session already started." };

    this.starting = true;
    let deck: Restaurant[];
    try {
      deck = await this.getDeck(this.filters);
    } catch (err) {
      this.starting = false;
      const message = err instanceof Error ? err.message : "Couldn't load restaurants.";
      return { code: "PLACES_UNAVAILABLE", message };
    }
    if (this.status !== "lobby") {
      this.starting = false;
      return null;
    }
    if (deck.length === 0) {
      this.starting = false;
      return { code: "PLACES_UNAVAILABLE", message: "No restaurants found nearby — try widening the search." };
    }

    // Anyone hanging in a disconnect grace period doesn't ride along.
    for (const member of [...this.members.values()]) {
      if (!member.connected) this.removeMember(member.id, { silent: true });
    }

    this.deck = shuffle(deck).slice(0, DECK_CAP);
    this.deckIds = new Set(this.deck.map((r) => r.placeId));
    this.likes = new Map();
    this.passes = new Map();
    this.active = new Set(this.members.keys());
    for (const member of this.members.values()) {
      member.swiped = new Set();
      member.deckDone = false;
    }
    this.status = "swiping";
    this.starting = false;
    this.broadcast({ type: "session_started", deck: this.deck });
    return null;
  }

  // -- swiping --------------------------------------------------------------

  swipe(memberId: string, placeId: string, liked: boolean) {
    if (this.status !== "swiping") return;
    const member = this.members.get(memberId);
    if (!member || !this.active.has(memberId)) return;
    if (!this.deckIds.has(placeId) || member.swiped.has(placeId)) return;

    member.swiped.add(placeId);
    const votes = liked ? this.likes : this.passes;
    let set = votes.get(placeId);
    if (!set) votes.set(placeId, (set = new Set()));
    set.add(memberId);

    if (member.swiped.size >= this.deck.length) member.deckDone = true;

    this.broadcastProgress();
    this.evaluate();
  }

  private evaluate() {
    if (this.status !== "swiping") return;
    const winnerId = checkUnanimous(this.likes, this.active);
    if (winnerId) {
      const winner = this.deck.find((r) => r.placeId === winnerId)!;
      const ranked = rankResults(this.deck, this.likes, this.passes).filter(
        (r) => r.restaurant.placeId !== winnerId,
      );
      this.result = { kind: "matched", winner, ranked };
      this.status = "matched";
      this.terminalAt = Date.now();
      this.broadcast({ type: "matched", winner, ranked });
      return;
    }
    if (allDone(this.active, (id) => this.members.get(id)?.deckDone ?? false)) {
      const ranked = rankResults(this.deck, this.likes, this.passes);
      this.result = { kind: "finished", winner: null, ranked };
      this.status = "finished";
      this.terminalAt = Date.now();
      this.broadcast({ type: "finished", ranked });
    }
  }

  // -- state out ------------------------------------------------------------

  snapshotFor(memberId: string): RoomSnapshot {
    const member = this.members.get(memberId);
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostId ?? "",
      members: this.memberInfos(),
      filters: this.filters,
      deck: this.status === "lobby" ? null : this.deck,
      progressIndex: member?.swiped.size ?? 0,
      progress: this.progressCounts(),
      result: this.result,
    };
  }

  private memberInfos(): MemberInfo[] {
    return [...this.members.values()]
      .sort((a, b) => a.joinSeq - b.joinSeq)
      .map((m) => ({
        id: m.id,
        name: m.name,
        isHost: m.id === this.hostId,
        connected: m.connected,
        deckDone: m.deckDone,
      }));
  }

  private progressCounts() {
    let doneCount = 0;
    for (const id of this.active) {
      if (this.members.get(id)?.deckDone) doneCount++;
    }
    return { doneCount, totalCount: this.active.size };
  }

  private broadcastProgress() {
    const { doneCount, totalCount } = this.progressCounts();
    this.broadcast({ type: "progress", doneCount, totalCount });
  }

  private broadcastRoomUpdate() {
    this.broadcast({
      type: "room_update",
      members: this.memberInfos(),
      hostId: this.hostId ?? "",
      filters: this.filters,
    });
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const member of this.members.values()) {
      if (member.socket && member.socket.readyState === SOCKET_OPEN) {
        try {
          member.socket.send(data);
        } catch {
          // socket died mid-send; close/grace handling will catch up with it
        }
      }
    }
  }

  private sendTo(member: Member, msg: ServerMessage) {
    if (member.socket && member.socket.readyState === SOCKET_OPEN) {
      try {
        member.socket.send(JSON.stringify(msg));
      } catch {
        // ignore — disconnect handling owns cleanup
      }
    }
  }

  // -- lifecycle ------------------------------------------------------------

  isTerminal(): boolean {
    return this.status === "matched" || this.status === "finished";
  }

  getStatus(): RoomStatus {
    return this.status;
  }

  isExpired(now: number): boolean {
    if (this.emptySince !== null && now - this.emptySince >= EMPTY_ROOM_TTL_MS) return true;
    if (this.terminalAt !== null && now - this.terminalAt >= TERMINAL_ROOM_TTL_MS) return true;
    return now - this.createdAt >= MAX_ROOM_AGE_MS;
  }

  destroy() {
    for (const member of this.members.values()) {
      if (member.graceTimer) clearTimeout(member.graceTimer);
      if (member.socket && member.socket.readyState === SOCKET_OPEN) {
        member.socket.close(4002, "room closed");
      }
    }
    this.members.clear();
    this.active.clear();
  }
}

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
