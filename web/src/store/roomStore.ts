import { create } from "zustand";
import {
  DEFAULT_FILTERS,
  type ErrorCode,
  type Filters,
  type SessionResult,
  type MemberInfo,
  type Restaurant,
  type RoomStatus,
  type ServerMessage,
} from "@chews/shared";
import { saveResumeToken } from "../lib/identity";

export type ConnectionState = "idle" | "connecting" | "open" | "reconnecting";

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
  /** Unanimous matches so far, in the order they happened (server truth). */
  matches: Restaurant[];
  /**
   * Matches to show in the popup right now. Only set by match events received
   * while connected — a resume never replays popups; the indicator covers it.
   * A match event arriving while the popup is open merges into it.
   */
  popupMatches: Restaurant[] | null;
  /** Server-confirmed: the most recent swipe can be taken back. */
  canUndo: boolean;
  /** undo_swipe sent, no swipe_undone/error back yet. */
  undoPending: boolean;
  /** finish_now sent, no finished/error back yet. */
  finishPending: boolean;
  result: SessionResult | null;
  fatalError: { code: ErrorCode; message: string } | null;
  toast: string | null;
  /** start_session sent, no session_started/error back yet. */
  pendingStart: boolean;

  setConnection: (c: ConnectionState) => void;
  handleServerMessage: (msg: ServerMessage) => void;
  recordLocalSwipe: () => void;
  dismissMatchPopup: () => void;
  markUndoPending: () => void;
  markFinishPending: () => void;
  markStartPending: () => void;
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
  matches: [] as Restaurant[],
  popupMatches: null,
  canUndo: false,
  undoPending: false,
  finishPending: false,
  result: null,
  fatalError: null,
  toast: null,
  pendingStart: false,
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
          matches: msg.room.matches,
          canUndo: msg.room.canUndo,
          result: msg.room.result,
          fatalError: null,
          pendingStart: false,
          undoPending: false,
          finishPending: false,
        });
        break;
      }
      case "room_update":
        set({ members: msg.members, hostId: msg.hostId, filters: msg.filters });
        break;
      case "session_started":
        set({
          status: "swiping",
          deck: msg.deck,
          members: msg.members,
          progressIndex: 0,
          matches: [],
          popupMatches: null,
          canUndo: false,
          result: null,
          progress: msg.progress,
          pendingStart: false,
        });
        break;
      case "progress":
        set({ progress: { doneCount: msg.doneCount, totalCount: msg.totalCount } });
        break;
      case "match_found":
        set((s) => ({
          matches: [...s.matches, ...msg.matches],
          popupMatches: s.popupMatches ? [...s.popupMatches, ...msg.matches] : msg.matches,
        }));
        break;
      case "finished":
        set({
          status: "finished",
          result: { matches: msg.matches, ranked: msg.ranked },
          matches: msg.matches,
          popupMatches: null,
          canUndo: false,
          finishPending: false,
        });
        break;
      case "swipe_undone":
        set((s) =>
          // A newer local swipe already advanced past the reported index (the
          // confirmation raced a fling) — don't rewind the deck underneath it.
          s.progressIndex > msg.progressIndex + 1
            ? { canUndo: false, undoPending: false }
            : { progressIndex: msg.progressIndex, canUndo: false, undoPending: false },
        );
        break;
      case "error": {
        set({ pendingStart: false, undoPending: false, finishPending: false });
        if (msg.fatal) {
          set({ fatalError: { code: msg.code, message: msg.message } });
        } else {
          get().showToast(msg.message);
        }
        break;
      }
    }
  },

  recordLocalSwipe: () => set((s) => ({ progressIndex: s.progressIndex + 1, canUndo: true })),

  dismissMatchPopup: () => set({ popupMatches: null }),

  markUndoPending: () => set({ undoPending: true }),

  markFinishPending: () => set({ finishPending: true }),

  markStartPending: () => set({ pendingStart: true }),

  showToast: (text) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: text });
    toastTimer = setTimeout(() => set({ toast: null }), 3500);
  },

  reset: () => set({ ...initial }),
}));
