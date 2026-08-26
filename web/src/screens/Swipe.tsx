import type { Restaurant } from "@chews/shared";
import { send } from "../lib/socket";
import { useRoomStore } from "../store/roomStore";
import SwipeDeck from "../components/SwipeDeck";
import { Logo, Screen } from "../components/ui";

export default function Swipe() {
  const deck = useRoomStore((s) => s.deck) ?? [];
  const progressIndex = useRoomStore((s) => s.progressIndex);
  const progress = useRoomStore((s) => s.progress);
  const recordLocalSwipe = useRoomStore((s) => s.recordLocalSwipe);
  // While the socket is down a swipe would be silently dropped — lock the deck
  // (elastic drag, no fling) until we're connected again.
  const connection = useRoomStore((s) => s.connection);

  const done = progressIndex >= deck.length;
  const waitingOn = progress.totalCount - progress.doneCount;

  function handleSwipe(restaurant: Restaurant, liked: boolean) {
    send({ type: "swipe", placeId: restaurant.placeId, liked });
    recordLocalSwipe();
  }

  return (
    <Screen className="h-dvh gap-4">
      <div className="flex items-center justify-between">
        <Logo small />
        <div className="flex items-center gap-3 text-sm font-semibold text-ink-soft">
          {!done && (
            <span>
              {Math.min(progressIndex + 1, deck.length)} / {deck.length}
            </span>
          )}
          <span className="rounded-full bg-ink/5 px-3 py-1">
            {progress.doneCount}/{progress.totalCount} done
          </span>
        </div>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">🧑‍🍳</div>
          <h2 className="font-display text-3xl font-black text-ink">You've swiped 'em all!</h2>
          <p className="max-w-xs text-ink-soft">
            {waitingOn > 0
              ? `Hang tight — waiting on ${waitingOn} more ${waitingOn === 1 ? "person" : "people"} to finish.`
              : "Counting the votes…"}
          </p>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-leaf transition-all"
              style={{
                width: `${progress.totalCount ? (progress.doneCount / progress.totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 pb-1">
          <SwipeDeck
            deck={deck}
            index={progressIndex}
            onSwipe={handleSwipe}
            disabled={connection !== "open"}
          />
        </div>
      )}
    </Screen>
  );
}
