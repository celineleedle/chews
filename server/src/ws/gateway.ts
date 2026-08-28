import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { ClientMessageSchema, type ServerMessage } from "@chews/shared";
import type { RoomManager } from "../rooms/manager.js";
import type { Room } from "../rooms/room.js";

function send(socket: WebSocket, msg: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

export function registerGateway(app: FastifyInstance, manager: RoomManager) {
  app.get("/ws", { websocket: true }, (socket: WebSocket) => {
    let room: Room | null = null;
    let memberId: string | null = null;

    socket.on("message", async (raw) => {
      let msg;
      try {
        msg = ClientMessageSchema.parse(JSON.parse(raw.toString()));
      } catch {
        send(socket, { type: "error", code: "BAD_MESSAGE", message: "Unrecognized message.", fatal: false });
        return;
      }

      if (msg.type === "join") {
        if (room) return; // one room per connection
        const target = manager.get(msg.roomCode);
        if (!target) {
          send(socket, {
            type: "error",
            code: "ROOM_NOT_FOUND",
            message: "That room doesn't exist — double-check the code.",
            fatal: true,
          });
          return;
        }
        const result = target.join(socket, msg);
        if (result.ok) {
          room = target;
          memberId = result.memberId;
        } else {
          // A rejected join would only repeat on reconnect.
          send(socket, { type: "error", code: result.code, message: result.message, fatal: true });
        }
        return;
      }

      if (!room || !memberId) {
        send(socket, { type: "error", code: "BAD_STATE", message: "Join a room first.", fatal: false });
        return;
      }

      switch (msg.type) {
        case "set_filters": {
          const err = room.setFilters(memberId, msg.filters);
          if (err) send(socket, { type: "error", code: err.code, message: err.message, fatal: false });
          break;
        }
        case "start_session": {
          const err = await room.start(memberId);
          if (err) send(socket, { type: "error", code: err.code, message: err.message, fatal: false });
          break;
        }
        case "swipe":
          room.swipe(memberId, msg.placeId, msg.liked);
          break;
        case "finish_now": {
          const err = room.finishNow(memberId);
          if (err) send(socket, { type: "error", code: err.code, message: err.message, fatal: false });
          break;
        }
        case "leave":
          room.leave(memberId);
          room = null;
          memberId = null;
          break;
      }
    });

    socket.on("close", () => {
      if (room && memberId) room.handleDisconnect(memberId, socket);
    });
    socket.on("error", () => {
      socket.close();
    });
  });
}
