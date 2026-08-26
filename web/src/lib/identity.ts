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

export function getResumeToken(roomCode: string): string | null {
  return read(`chews:resume:${roomCode}`);
}

export function saveResumeToken(roomCode: string, token: string) {
  write(`chews:resume:${roomCode}`, token);
}
