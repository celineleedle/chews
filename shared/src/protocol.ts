import { z } from "zod";
import type {
  Filters,
  MatchResult,
  MemberInfo,
  RankedResult,
  Restaurant,
  RoomSnapshot,
} from "./types.js";

// ---------------------------------------------------------------------------
// Client → Server. These arrive as untrusted JSON, so they are zod schemas and
// the server parses every inbound frame through ClientMessageSchema.
// ---------------------------------------------------------------------------

export const FiltersSchema = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  radiusM: z.number().int().min(200).max(40000),
  priceLevels: z.array(z.number().int().min(1).max(4)).max(4),
  openNow: z.boolean(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    roomCode: z.string().min(1).max(16),
    clientId: z.string().min(8).max(64),
    displayName: z.string().trim().min(1).max(24).optional(),
    resumeToken: z.string().max(128).optional(),
  }),
  z.object({ type: z.literal("set_filters"), filters: FiltersSchema }),
  z.object({ type: z.literal("start_session") }),
  z.object({
    type: z.literal("swipe"),
    placeId: z.string().min(1).max(300),
    liked: z.boolean(),
  }),
  z.object({ type: z.literal("leave") }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Server → Client. The client trusts the server, so plain types suffice.
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "SESSION_IN_PROGRESS"
  | "ROOM_FULL"
  | "NOT_HOST"
  | "BAD_STATE"
  | "NAME_REQUIRED"
  | "PLACES_UNAVAILABLE"
  | "BAD_MESSAGE";

export type ServerMessage =
  | { type: "joined"; memberId: string; resumeToken: string; room: RoomSnapshot }
  | { type: "room_update"; members: MemberInfo[]; hostId: string; filters: Filters }
  /** Carries the post-prune member list so the client never reconstructs it. */
  | {
      type: "session_started";
      deck: Restaurant[];
      members: MemberInfo[];
      progress: { doneCount: number; totalCount: number };
    }
  | { type: "progress"; doneCount: number; totalCount: number }
  | { type: "matched"; winner: Restaurant; ranked: RankedResult[] }
  | { type: "finished"; ranked: RankedResult[] }
  /** fatal: joining again would just repeat the error — don't reconnect. */
  | { type: "error"; code: ErrorCode; message: string; fatal: boolean };

export type { Filters, MatchResult, MemberInfo, RankedResult, Restaurant, RoomSnapshot };
