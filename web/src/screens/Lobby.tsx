import { useEffect, useRef, useState } from "react";
import type { Filters } from "@chews/shared";
import { send } from "../lib/socket";
import { useRoomStore } from "../store/roomStore";
import MemberAvatars from "../components/MemberAvatars";
import { Logo, PrimaryButton, Screen } from "../components/ui";

const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
const MILES = 1609.34;

export default function Lobby() {
  const roomCode = useRoomStore((s) => s.roomCode) ?? "";
  const members = useRoomStore((s) => s.members);
  const hostId = useRoomStore((s) => s.hostId);
  const memberId = useRoomStore((s) => s.memberId);
  const filters = useRoomStore((s) => s.filters);
  const showToast = useRoomStore((s) => s.showToast);

  const isHost = memberId === hostId;
  const hostName = members.find((m) => m.id === hostId)?.name ?? "the host";
  const [starting, setStarting] = useState(false);
  const [radiusMi, setRadiusMi] = useState(filters.radiusM / MILES);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "ok" | "denied">(
    filters.lat != null ? "ok" : "idle",
  );
  const geoRequested = useRef(false);

  useEffect(() => {
    setRadiusMi(filters.radiusM / MILES);
    if (filters.lat != null) setGeoState("ok");
  }, [filters.radiusM, filters.lat]);

  // The host's location anchors the search for the whole room.
  useEffect(() => {
    if (!isHost || filters.lat != null || geoRequested.current || !("geolocation" in navigator)) return;
    geoRequested.current = true;
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("ok");
        pushFilters({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, filters.lat]);

  function pushFilters(patch: Partial<Filters>) {
    send({ type: "set_filters", filters: { ...useRoomStore.getState().filters, ...patch } });
  }

  function togglePrice(level: number) {
    const current = new Set(filters.priceLevels);
    if (current.has(level)) current.delete(level);
    else current.add(level);
    pushFilters({ priceLevels: [...current].sort() });
  }

  async function share() {
    const url = `${location.origin}/room/${roomCode}`;
    const text = `Help pick where we eat — join my Chews room: ${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Chews", text, url });
        return;
      }
    } catch {
      // fall through to clipboard (user may have dismissed the sheet)
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied!");
    } catch {
      showToast(url);
    }
  }

  return (
    <Screen className="gap-6">
      <div className="flex items-center justify-between">
        <Logo small />
        <span className="text-sm font-medium text-ink-soft">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </div>

      <button
        type="button"
        onClick={share}
        className="rounded-3xl border-2 border-dashed border-primary/40 bg-eggshell px-6 py-5 text-center transition active:scale-[0.98]"
      >
        <div className="text-xs font-semibold tracking-widest text-ink-soft uppercase">Room code</div>
        <div className="mt-1 font-display text-5xl font-black tracking-[0.25em] text-primary">
          {roomCode}
        </div>
        <div className="mt-2 text-sm font-medium text-ink-soft">Tap to share the invite link</div>
      </button>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-ink">Who's hungry</h2>
        <MemberAvatars members={members} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-ink">
          Search settings {!isHost && <span className="text-sm font-normal text-ink-soft">(set by {hostName})</span>}
        </h2>

        <div className="rounded-2xl bg-eggshell p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-ink">
            <span>Distance</span>
            <span className="text-primary-deep">{radiusMi.toFixed(1)} mi</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={radiusMi}
            disabled={!isHost}
            onChange={(e) => setRadiusMi(Number(e.target.value))}
            onPointerUp={() => pushFilters({ radiusM: Math.round(radiusMi * MILES) })}
            onTouchEnd={() => pushFilters({ radiusM: Math.round(radiusMi * MILES) })}
            className="mt-3 w-full accent-primary disabled:opacity-50"
          />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Price</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((level) => {
                const on = filters.priceLevels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={!isHost}
                    onClick={() => togglePrice(level)}
                    className={`min-h-10 rounded-xl px-3 font-display text-sm font-bold transition active:scale-95 disabled:pointer-events-none ${
                      on ? "bg-primary text-white" : "bg-ink/5 text-ink-soft"
                    }`}
                  >
                    {PRICE_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>
          {filters.priceLevels.length === 0 && (
            <p className="mt-1 text-right text-xs text-ink-soft">any price</p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Open now only</span>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => pushFilters({ openNow: !filters.openNow })}
              className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${filters.openNow ? "bg-leaf" : "bg-ink/15"}`}
              aria-pressed={filters.openNow}
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${filters.openNow ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`}
              />
            </button>
          </div>

          <div className="mt-4 text-sm">
            {geoState === "ok" && <span className="font-medium text-leaf-deep">📍 Location set</span>}
            {geoState === "asking" && <span className="text-ink-soft">📍 Getting location…</span>}
            {geoState === "denied" && isHost && (
              <span className="text-primary-deep">
                📍 Location blocked — enable it in your browser to search nearby.
              </span>
            )}
            {geoState === "idle" && !isHost && (
              <span className="text-ink-soft">📍 Waiting for {hostName}'s location</span>
            )}
          </div>
        </div>
      </section>

      <div className="mt-auto pt-2">
        {isHost ? (
          <PrimaryButton
            disabled={starting}
            onClick={() => {
              setStarting(true);
              send({ type: "start_session" });
              // if the server rejects, a toast arrives; re-enable shortly
              setTimeout(() => setStarting(false), 3000);
            }}
          >
            {starting ? "Firing up the grill…" : "Start swiping"}
          </PrimaryButton>
        ) : (
          <div className="rounded-2xl bg-ink/5 px-6 py-4 text-center font-medium text-ink-soft">
            Waiting for {hostName} to start…
          </div>
        )}
      </div>
    </Screen>
  );
}
