import type { ClientMessage, ServerMessage } from "@chews/shared";
import { useRoomStore } from "../store/roomStore";
import { getClientId, getResumeToken } from "./identity";

// Server close codes that mean "don't come back on this connection".
const NO_RECONNECT_CODES = new Set([4000, 4001, 4002]);
const MAX_BACKOFF_MS = 8000;
// Longer than the server's 8s Places timeout, so a slow-but-alive start
// still resolves before the watchdog gives up on it.
const START_TIMEOUT_MS = 12_000;

let ws: WebSocket | null = null;
let roomCode: string | null = null;
let displayName: string | undefined;
let attempts = 0;
let closedByUs = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;

export function connectToRoom(code: string, name?: string) {
  if (roomCode === code && ws && ws.readyState <= WebSocket.OPEN) return;
  teardown();
  roomCode = code;
  displayName = name;
  closedByUs = false;
  attempts = 0;
  open();
}

function open() {
  if (!roomCode) return;
  const store = useRoomStore.getState();
  store.setConnection(attempts === 0 ? "connecting" : "reconnecting");

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    useRoomStore.getState().setConnection("open");
    const resumeToken = roomCode ? (getResumeToken(roomCode) ?? undefined) : undefined;
    send({
      type: "join",
      roomCode: roomCode!,
      clientId: getClientId(),
      displayName,
      resumeToken,
    });
  };

  ws.onmessage = (event) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      return;
    }
    const st = useRoomStore.getState();
    st.handleServerMessage(msg);
    // The start resolved (session_started, error, or a rejoin snapshot).
    if (startTimer && !useRoomStore.getState().pendingStart) {
      clearTimeout(startTimer);
      startTimer = null;
    }
    // A fatal join error means reconnecting would just repeat it.
    if (msg.type === "error" && useRoomStore.getState().fatalError) {
      closedByUs = true;
      ws?.close();
    }
  };

  ws.onclose = (event) => {
    ws = null;
    if (closedByUs || NO_RECONNECT_CODES.has(event.code)) {
      useRoomStore.getState().setConnection("idle");
      return;
    }
    attempts += 1;
    useRoomStore.getState().setConnection("reconnecting");
    const delay = Math.min(500 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(open, delay);
  };
}

export function send(msg: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Host's "Start swiping" tap. Unlike fire-and-forget `send`, this refuses to
 * swallow the message when the socket isn't open, and arms a watchdog so a
 * reply lost to a half-dead connection can't leave the button spinning forever.
 */
export function requestStartSession() {
  const store = useRoomStore.getState();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    store.showToast("Reconnecting — give it a second and try again.");
    return;
  }
  store.markStartPending();
  send({ type: "start_session" });

  if (startTimer) clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    startTimer = null;
    const st = useRoomStore.getState();
    if (!st.pendingStart) return;
    st.clearStartPending();
    st.showToast("That took too long — check your connection and try again.");
    // The likely culprit is a connection that died without the browser
    // noticing; recycle it so the retry goes out on a live socket.
    ws?.close();
  }, START_TIMEOUT_MS);
}

export function leaveRoom() {
  send({ type: "leave" });
  teardown();
  useRoomStore.getState().reset();
}

function teardown() {
  closedByUs = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (startTimer) clearTimeout(startTimer);
  startTimer = null;
  if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
  ws = null;
  roomCode = null;
  displayName = undefined;
}
