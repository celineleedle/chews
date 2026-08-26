import { create } from "zustand";
import {
  DEFAULT_FILTERS,
  type ErrorCode,
  type Filters,
  type MatchResult,
  type MemberInfo,
  type Restaurant,
  type RoomStatus,
  type ServerMessage,
} from "@chews/shared";
import { saveResumeToken } from "../lib/identity";

export type ConnectionState = "idle" | "connecting" | "open" | "reconnecting";

const FATAL_CODES: ErrorCode[] = ["ROOM_NOT_FOUND", "SESSION_IN_PROGRESS", "ROOM_FULL", "NAME_REQUIRED"];

interface RoomStore {
  connection: ConnectionState;
  roomCode: string | null;
  memberId: string | null;
  status: RoomStatus | null;
  members: MemberInfo[];
  hostId: string;
  filters: Filters;
  deck: Restaurant[] | null;
  progressIndex: number;
  progress: { doneCount: number; totalCount: number };
  result: MatchResult | null;
  fatalError: { code: ErrorCode; message: string } | null;
  toast: string | null;

  setConnection: (c: ConnectionState) => void;
  handleServerMessage: (msg: ServerMessage) => void;
  recordLocalSwipe: () => void;
  showToast: (text: string) => void;
  reset: () => void;
}

const initial = {
  connection: "idle" as ConnectionState,
  roomCode: null,
  memberId: null,
  status: null,
  members: [],
  hostId: "",
  filters: DEFAULT_FILTERS,
  deck: null,
  progressIndex: 0,
  progress: { doneCount: 0, totalCount: 0 },
  result: null,
  fatalError: null,
  toast: null,
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useRoomStore = create<RoomStore>((set, get) => ({
  ...initial,

  setConnection: (connection) => set({ connection }),

  handleServerMessage: (msg) => {
    switch (msg.type) {
      case "joined": {
        saveResumeToken(msg.room.code, msg.resumeToken);
        set({
          roomCode: msg.room.code,
          memberId: msg.memberId,
          status: msg.room.status,
          members: msg.room.members,
          hostId: msg.room.hostId,
          filters: msg.room.filters,
          deck: msg.room.deck,
          progressIndex: msg.room.progressIndex,
          progress: msg.room.progress,
          result: msg.room.result,
          fatalError: null,
        });
        break;
      }
      case "room_update":
        set({ members: msg.members, hostId: msg.hostId, filters: msg.filters });
        break;
      case "session_started":
        set((s) => ({
          status: "swiping",
          deck: msg.deck,
          progressIndex: 0,
          result: null,
          progress: { doneCount: 0, totalCount: s.members.length },
        }));
        break;
      case "progress":
        set({ progress: { doneCount: msg.doneCount, totalCount: msg.totalCount } });
        break;
      case "matched":
        set({ status: "matched", result: { kind: "matched", winner: msg.winner, ranked: msg.ranked } });
        break;
      case "finished":
        set({ status: "finished", result: { kind: "finished", winner: null, ranked: msg.ranked } });
        break;
      case "error": {
        if (FATAL_CODES.includes(msg.code)) {
          set({ fatalError: { code: msg.code, message: msg.message } });
        } else {
          get().showToast(msg.message);
        }
        break;
      }
    }
  },

  recordLocalSwipe: () => set((s) => ({ progressIndex: s.progressIndex + 1 })),

  showToast: (text) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: text });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },

  reset: () => set({ ...initial }),
}));
