// localStorage can throw (private mode, blocked storage) — degrade to in-memory.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // in-memory fallback already holds it
  }
}

export function getClientId(): string {
  let id = read("chews:clientId");
  if (!id) {
    id = crypto.randomUUID();
    write("chews:clientId", id);
  }
  return id;
}

export function getSavedName(): string {
  return read("chews:name") ?? "";
}

export function saveName(name: string) {
  write("chews:name", name);
}

// Rooms expire server-side within hours, so stale tokens are just clutter.
const RESUME_PREFIX = "chews:resume:";
const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function getResumeToken(roomCode: string): string | null {
  const raw = read(RESUME_PREFIX + roomCode);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { t: string }).t;
  } catch {
    return raw; // pre-JSON value
  }
}

export function saveResumeToken(roomCode: string, token: string) {
  write(RESUME_PREFIX + roomCode, JSON.stringify({ t: token, ts: Date.now() }));
  pruneResumeTokens();
}

function pruneResumeTokens() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(RESUME_PREFIX)) continue;
      let expired = true; // pre-JSON values have no timestamp — treat as stale
      try {
        const { ts } = JSON.parse(localStorage.getItem(key) ?? "") as { ts?: number };
        expired = typeof ts !== "number" || now - ts >= RESUME_MAX_AGE_MS;
      } catch {
        // unparseable ⇒ expired stays true
      }
      if (expired) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable — the in-memory fallback dies with the tab anyway
  }
}
