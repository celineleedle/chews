import { useState } from "react";
import type { Restaurant } from "@chews/shared";

const FALLBACKS = [
  ["#ff8a65", "#ffb74d", "🍕"],
  ["#4db6ac", "#aed581", "🍜"],
  ["#7986cb", "#4fc3f7", "🌮"],
  ["#f06292", "#ff8a65", "🍣"],
  ["#9575cd", "#7986cb", "🍔"],
  ["#ffb74d", "#ffd166", "🥘"],
] as const;

function fallbackFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACKS[Math.abs(hash) % FALLBACKS.length]!;
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [from, to, emoji] = fallbackFor(restaurant.placeId);
  const showPhoto = restaurant.photoUrl && !imgFailed;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-ink shadow-xl select-none">
      {showPhoto ? (
        <img
          src={restaurant.photoUrl!}
          alt={restaurant.name}
          draggable={false}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-8xl"
          style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
        >
          {emoji}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pt-16 pb-5 text-white">
        <h3 className="font-display text-3xl font-black leading-tight">{restaurant.name}</h3>
        <p className="mt-1 text-sm font-medium text-white/85">
          {[restaurant.category, restaurant.priceLevel ? "$".repeat(restaurant.priceLevel) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
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
    </div>
  );
}
