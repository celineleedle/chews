import { useState } from "react";
import type { Restaurant } from "@chews/shared";
import { hashPick } from "../lib/hash";
import { restaurantSubtitle } from "../lib/format";

const FALLBACKS = [
  ["#ff8a65", "#ffb74d", "🍕"],
  ["#4db6ac", "#aed581", "🍜"],
  ["#7986cb", "#4fc3f7", "🌮"],
  ["#f06292", "#ff8a65", "🍣"],
  ["#9575cd", "#7986cb", "🍔"],
  ["#ffb74d", "#ffd166", "🥘"],
] as const;

/**
 * The photo layer, filling whatever box the parent gives it — a whole card while
 * collapsed, a header strip once expanded.
 */
export function CardPhoto({ restaurant }: { restaurant: Restaurant }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [from, to, emoji] = hashPick(restaurant.placeId, FALLBACKS);

  if (restaurant.photoUrl && !imgFailed) {
    return (
      <img
        src={restaurant.photoUrl}
        alt={restaurant.name}
        draggable={false}
        onError={() => setImgFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }
  return (
    <div
      className="absolute inset-0 flex items-center justify-center text-8xl"
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      {emoji}
    </div>
  );
}

/**
 * Name, subtitle and rating, pinned to the bottom of whatever photo box holds
 * it. On the expanding top card the photo compresses under it, so this block
 * rides upward with the photo's bottom edge — one element, never a crossfade.
 */
export function CardOverlay({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pt-16 pb-5 text-white">
      <h3 className="font-display text-3xl font-black leading-tight">{restaurant.name}</h3>
      <p className="mt-1 text-sm font-medium text-white/85">{restaurantSubtitle(restaurant)}</p>
      <div className="mt-1.5 flex items-center gap-3 text-sm text-white/75">
        {restaurant.rating != null && (
          <span>
            <span className="text-butter">★</span> {restaurant.rating.toFixed(1)}
            {restaurant.ratingCount != null && ` (${restaurant.ratingCount})`}
          </span>
        )}
        <span className="truncate">{restaurant.address}</span>
      </div>
    </div>
  );
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-ink shadow-xl select-none">
      <CardPhoto restaurant={restaurant} />
      <CardOverlay restaurant={restaurant} />
    </div>
  );
}
