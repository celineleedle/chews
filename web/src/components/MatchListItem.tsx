import type { Restaurant } from "@chews/shared";
import { restaurantSubtitle } from "../lib/format";

/**
 * One matched restaurant as a compact row — used by the match popup and the
 * results screen. Interactive (button) when `onSelect` is given. The photo
 * reuses the deck's exact URL so the browser cache serves it — a new width
 * would re-bill Google.
 */
export default function MatchListItem({
  restaurant,
  onSelect,
  emphasis = false,
}: {
  restaurant: Restaurant;
  onSelect?: () => void;
  emphasis?: boolean;
}) {
  const content = (
    <>
      {restaurant.photoUrl ? (
        <img src={restaurant.photoUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-leaf/20 text-2xl">
          🍽️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-ink ${emphasis ? "font-display text-lg font-bold" : "font-semibold"}`}>
          {restaurant.name}
        </div>
        <div className="truncate text-sm text-ink-soft">{restaurantSubtitle(restaurant)}</div>
      </div>
      <span className="shrink-0 text-xl" aria-hidden>
        🎉
      </span>
    </>
  );

  if (onSelect) {
    return (
      <li>
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full items-center gap-3 rounded-2xl bg-leaf/15 p-3 text-left shadow-sm transition active:scale-[0.98]"
        >
          {content}
        </button>
      </li>
    );
  }
  return <li className="flex items-center gap-3 rounded-2xl bg-leaf/10 p-3">{content}</li>;
}
