import type { WebSocketServer, WebSocket } from "ws";

const HEARTBEAT_INTERVAL_MS = 25_000;

interface TrackedSocket extends WebSocket {
  isAlive?: boolean;
}

/**
 * Standard ws liveness sweep: sockets that miss a ping/pong round trip get
 * terminated, which fires their 'close' handlers and starts the room's
 * disconnect grace period.
 */
export function startHeartbeat(wss: WebSocketServer): () => void {
  wss.on("connection", (socket: TrackedSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
  });

  const timer = setInterval(() => {
    for (const client of wss.clients as Set<TrackedSocket>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref?.();

  return () => clearInterval(timer);
}
