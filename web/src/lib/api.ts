import type { RoomStatus } from "@chews/shared";

export async function createRoom(): Promise<string> {
  const res = await fetch("/api/rooms", { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't create a room right now.");
  }
  const { code } = (await res.json()) as { code: string };
  return code;
}

export async function checkRoom(code: string): Promise<{ exists: boolean; status: RoomStatus | null }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Couldn't reach the server.");
  return (await res.json()) as { exists: boolean; status: RoomStatus | null };
}
