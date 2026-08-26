import type { Restaurant } from "@chews/shared";

/** 1–4 → "$"–"$$$$" */
export function priceDollars(level: number): string {
  return "$".repeat(level);
}

/** "Greek Restaurant · $$" — whichever parts are known. */
export function restaurantSubtitle(r: Restaurant): string {
  return [r.category, r.priceLevel ? priceDollars(r.priceLevel) : null].filter(Boolean).join(" · ");
}
