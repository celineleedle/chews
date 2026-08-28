import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Restaurant } from "@chews/shared";
import { send } from "../lib/socket";
import { useRoomStore } from "../store/roomStore";
import SwipeDeck from "../components/SwipeDeck";
import MatchPopup from "../components/MatchPopup";
import { Logo, Screen } from "../components/ui";

/**
 * Host-only early exit. The persistent variant asks an inline confirmation
 * (one mis-tap would end the session for everyone); the popup variant is
 * single-tap — that context is already deliberate.
 */
function FinishNowButton({ confirm }: { confirm: boolean }) {
  const connection = useRoomStore((s) => s.connection);
  const finishPending = useRoomStore((s) => s.finishPending);
  const markFinishPending = useRoomStore((s) => s.markFinishPending);
  const [armed, setArmed] = useState(false);

  // A forgotten confirm state shouldn't linger.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const disabled = connection !== "open" || finishPending;

  function handleClick() {
    if (disabled) return;
    if (confirm && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    markFinishPending();
    send({ type: "finish_now" });
  }

  const label = finishPending ? "Wrapping up…" : armed ? "End for everyone?" : "Finish now";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`min-h-10 rounded-full px-4 text-sm font-bold transition active:scale-[0.97] disabled:opacity-40 ${
        armed ? "bg-primary text-white" : "border-2 border-ink/15 bg-eggshell text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export default function Swipe() {
  const deck = useRoomStore((s) => s.deck) ?? [];
  const progressIndex = useRoomStore((s) => s.progressIndex);
  const progress = useRoomStore((s) => s.progress);
  const recordLocalSwipe = useRoomStore((s) => s.recordLocalSwipe);
  // While the socket is down a swipe would be silently dropped — lock the deck
  // (elastic drag, no fling) until we're connected again.
  const connection = useRoomStore((s) => s.connection);
  const matches = useRoomStore((s) => s.matches);
  const popupMatches = useRoomStore((s) => s.popupMatches);
  const dismissMatchPopup = useRoomStore((s) => s.dismissMatchPopup);
  const canUndo = useRoomStore((s) => s.canUndo);
  const undoPending = useRoomStore((s) => s.undoPending);
  const markUndoPending = useRoomStore((s) => s.markUndoPending);
  const memberId = useRoomStore((s) => s.memberId);
  const hostId = useRoomStore((s) => s.hostId);
  const [showMatchList, setShowMatchList] = useState(false);

  const isHost = memberId === hostId;
  const done = progressIndex >= deck.length;
  const waitingOn = progress.totalCount - progress.doneCount;

  // A new match preempts the matches-so-far list; without this, dismissing the
  // celebration popup would re-open the stale list underneath it.
  useEffect(() => {
    if (popupMatches) setShowMatchList(false);
  }, [popupMatches]);

  const closeMatchList = useCallback(() => setShowMatchList(false), []);

  // Go-back targets the card just behind the deck position. Display-only
  // derivation from server-sent facts — the server gate stays authoritative,
  // and a match on that card disables it (matches are permanent).
  const lastCard = progressIndex > 0 ? deck[progressIndex - 1] : undefined;
  const lastCardMatched = !!lastCard && matches.some((m) => m.placeId === lastCard.placeId);
  const canGoBack =
    connection === "open" && canUndo && !undoPending && !!lastCard && !lastCardMatched;

  function handleSwipe(restaurant: Restaurant, liked: boolean) {
    send({ type: "swipe", placeId: restaurant.placeId, liked });
    recordLocalSwipe();
  }

  function handleGoBack() {
    if (!canGoBack || !lastCard) return;
    markUndoPending();
    // Server-confirmed: the deck only moves back on the swipe_undone frame.
    send({ type: "undo_swipe", placeId: lastCard.placeId });
  }

  const goBackButton = (
    <button
      type="button"
      onClick={handleGoBack}
      disabled={!canGoBack}
      className="mx-auto flex min-h-10 items-center gap-1.5 rounded-full border-2 border-ink/15 bg-eggshell px-4 text-sm font-bold text-ink transition active:scale-[0.97] disabled:opacity-40"
    >
      <span aria-hidden>↩</span> {undoPending ? "Taking it back…" : "Take back"}
    </button>
  );

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

      {matches.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowMatchList(true)}
            className="min-h-10 rounded-full bg-leaf/15 px-4 text-sm font-bold text-leaf-deep transition active:scale-[0.97]"
          >
            🎉 {matches.length} {matches.length === 1 ? "match" : "matches"} so far
          </button>
          {isHost && <FinishNowButton confirm />}
        </div>
      )}

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
          {/* Undo works from the waiting state too — the server supports it. */}
          {canGoBack && goBackButton}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 pb-1">
            <SwipeDeck
              deck={deck}
              index={progressIndex}
              onSwipe={handleSwipe}
              // Also locked while an undo awaits its confirmation — a swipe
              // racing the rewind would desync the deck from the server.
              disabled={connection !== "open" || undoPending}
            />
          </div>
          {progressIndex > 0 && goBackButton}
        </>
      )}

      <AnimatePresence>
        {popupMatches && (
          <MatchPopup
            key="new-match"
            matches={popupMatches}
            celebrate
            title="It's a match! 🎉"
            subtitle={
              popupMatches.length === 1
                ? "Everyone said yes — it's on the list."
                : "Everyone said yes to all of these — they're on the list."
            }
            onDismiss={dismissMatchPopup}
          >
            {isHost && <FinishNowButton confirm={false} />}
          </MatchPopup>
        )}
        {!popupMatches && showMatchList && (
          <MatchPopup
            key="match-list"
            matches={matches}
            title="Matches so far"
            subtitle="Anything here already works for everyone."
            onDismiss={closeMatchList}
            dismissLabel="Back to swiping"
          />
        )}
      </AnimatePresence>
    </Screen>
  );
}
