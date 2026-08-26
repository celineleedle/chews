import type { Filters, Restaurant } from "@chews/shared";
import { env } from "../env.js";
import { TtlCache } from "./cache.js";
import { geohash } from "./geohash.js";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.formattedAddress",
  "places.primaryTypeDisplayName",
  "places.currentOpeningHours.openNow",
  "places.photos.name",
  "places.googleMapsUri",
].join(",");

const PRICE_FROM_ENUM: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const PRICE_TO_ENUM: Record<number, string> = {
  1: "PRICE_LEVEL_INEXPENSIVE",
  2: "PRICE_LEVEL_MODERATE",
  3: "PRICE_LEVEL_EXPENSIVE",
  4: "PRICE_LEVEL_VERY_EXPENSIVE",
};

interface ApiPlace {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  formattedAddress?: string;
  primaryTypeDisplayName?: { text?: string };
  currentOpeningHours?: { openNow?: boolean };
  photos?: Array<{ name?: string }>;
  googleMapsUri?: string;
}

const cache = new TtlCache<Restaurant[]>(env.PLACES_CACHE_TTL_MIN * 60_000, 200);

function cacheKey(f: Filters): string {
  // ~800m radius buckets: tiny slider nudges shouldn't bust the cache
  return [
    geohash(f.lat!, f.lng!, 6),
    Math.round(f.radiusM / 800),
    [...f.priceLevels].sort().join(""),
    f.openNow ? 1 : 0,
  ].join(":");
}

export async function placesDeck(filters: Filters): Promise<Restaurant[]> {
  if (filters.lat == null || filters.lng == null) {
    throw new Error("The host needs to share their location before starting.");
  }

  const key = cacheKey(filters);
  const cached = cache.get(key);
  if (cached) {
    console.log(`[places] cache hit ${key}`);
    return cached;
  }
  console.log(`[places] cache miss ${key} — calling Google Places`);

  const body: Record<string, unknown> = {
    textQuery: "restaurants",
    includedType: "restaurant",
    maxResultCount: 20,
    openNow: filters.openNow || undefined,
    locationBias: {
      circle: {
        center: { latitude: filters.lat, longitude: filters.lng },
        radius: Math.min(filters.radiusM, 50_000),
      },
    },
  };
  if (filters.priceLevels.length > 0 && filters.priceLevels.length < 4) {
    body.priceLevels = filters.priceLevels.map((p) => PRICE_TO_ENUM[p]).filter(Boolean);
  }

  let res: Response;
  try {
    res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("Couldn't reach the restaurant search — check your connection and try again.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[places] search failed ${res.status}: ${detail.slice(0, 500)}`);
    throw new Error("Restaurant search is having a moment — try again in a bit.");
  }

  const data = (await res.json().catch(() => ({}))) as { places?: ApiPlace[] };
  const restaurants: Restaurant[] = (data.places ?? [])
    .filter((p): p is ApiPlace & { id: string } => Boolean(p.id && p.displayName?.text))
    .map((p) => {
      const photoName = p.photos?.[0]?.name;
      return {
        placeId: p.id,
        name: p.displayName!.text!,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? null,
        priceLevel: p.priceLevel ? (PRICE_FROM_ENUM[p.priceLevel] ?? null) : null,
        address: p.formattedAddress ?? "",
        category: p.primaryTypeDisplayName?.text ?? null,
        photoUrl: photoName ? `/api/photo?name=${encodeURIComponent(photoName)}&w=800` : null,
        mapsUrl: p.googleMapsUri ?? null,
        openNow: p.currentOpeningHours?.openNow ?? null,
      };
    });

  if (restaurants.length > 0) cache.set(key, restaurants);
  return restaurants;
}

const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_.=-]+$/;

type Photo = { bytes: ArrayBuffer; contentType: string };

// Every member's browser requests the same deck's photos the moment a session
// starts, and browser Cache-Control only helps per-client — so cache the bytes
// (~100KB each) and coalesce concurrent fetches server-side to keep billable
// Photo Media calls at one per photo. 100 entries ≈ 10MB ≈ 3 active decks.
const photoCache = new TtlCache<Photo>(24 * 60 * 60_000, 100);
const photoInflight = new Map<string, Promise<Photo | null>>();

/**
 * Fetches a Places photo server-side so the API key never reaches the browser.
 * Returns null for invalid names or upstream failures.
 */
export function fetchPhoto(name: string, widthPx: number): Promise<Photo | null> {
  if (!PHOTO_NAME_RE.test(name)) return Promise.resolve(null);
  const width = Math.min(Math.max(Math.round(widthPx) || 800, 100), 1600);
  const key = `${name}:${width}`;

  const cached = photoCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = photoInflight.get(key);
  if (inflight) return inflight;

  const fetching = fetchPhotoUpstream(name, width).then((photo) => {
    if (photo) photoCache.set(key, photo);
    return photo;
  });
  photoInflight.set(key, fetching);
  void fetching.finally(() => photoInflight.delete(key));
  return fetching;
}

async function fetchPhotoUpstream(name: string, width: number): Promise<Photo | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}`,
      {
        headers: { "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    return {
      bytes: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}
