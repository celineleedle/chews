import { normalizeCode, uniqueCode } from "./codes.js";
import { Room, type DeckProvider } from "./room.js";

const GC_INTERVAL_MS = 60_000;
const MAX_ROOMS = 500;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private getDeck: DeckProvider) {}

  createRoom(): Room | null {
    if (this.rooms.size >= MAX_ROOMS) return null;
    const code = uniqueCode((c) => this.rooms.has(c));
    const room = new Room(code, this.getDeck);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(normalizeCode(code));
  }

  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      if (room.isExpired(now)) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }

  startGC() {
    if (this.gcTimer) return;
    this.gcTimer = setInterval(() => this.sweep(), GC_INTERVAL_MS);
    this.gcTimer.unref?.();
  }

  stopGC() {
    if (this.gcTimer) clearInterval(this.gcTimer);
    this.gcTimer = null;
  }

  get size() {
    return this.rooms.size;
  }
}
