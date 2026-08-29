import type { Filters, PlaceReview, Restaurant, RestaurantDetails } from "@chews/shared";
import { env } from "../env.js";
import { TtlCache } from "./cache.js";
import { createByteDiskCache } from "./diskCache.js";
import { geohash } from "./geohash.js";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
// Everything from "places.websiteUri" down is only read by the swipe-up detail
// sheet. Note the SKU steps: rating/priceLevel already put this call in the
// Enterprise tier, and editorialSummary/reviews/the serves-* flags step it up
// again to Enterprise + Atmosphere. One search covers the whole deck either way.
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
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.priceRange",
  "places.location",
  "places.types",
  "places.editorialSummary",
  "places.reviews",
  "places.dineIn",
  "places.takeout",
  "places.delivery",
  "places.servesVegetarianFood",
  "places.outdoorSeating",
  "places.reservable",
].join(",");

/** Photos carried per restaurant: one for the card, the rest for the sheet's gallery. */
const MAX_PHOTOS = 5;
/** Reviews are the bulkiest field and the whole deck ships over one WS frame. */
const MAX_REVIEWS = 3;
const MAX_REVIEW_CHARS = 280;

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

export interface ApiMoney {
  currencyCode?: string;
  units?: string | number;
}

export interface ApiReview {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
}

export interface ApiPlace {
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
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  priceRange?: { startPrice?: ApiMoney; endPrice?: ApiMoney };
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  editorialSummary?: { text?: string };
  reviews?: ApiReview[];
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  servesVegetarianFood?: boolean;
  outdoorSeating?: boolean;
  reservable?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };

function money(m: ApiMoney | undefined): string | null {
  if (!m || m.units == null) return null;
  const symbol = CURRENCY_SYMBOLS[m.currencyCode ?? "USD"] ?? "";
  return `${symbol}${m.units}`;
}

/** "$10–20", or a bare bound when Places only gives one side. */
function priceRange(range: ApiPlace["priceRange"]): string | null {
  const start = money(range?.startPrice);
  const end = money(range?.endPrice);
  if (start && end) return `${start}–${end.replace(/^[^\d]+/, "")}`;
  return start ?? end ?? null;
}

/**
 * Turns place types ("ramen_restaurant", "japanese_restaurant") into cuisine
 * labels ("Ramen", "Japanese"). The generic buckets carry no information for a
 * diner staring at a restaurant card, so they're dropped.
 */
const GENERIC_TYPES = new Set([
  "restaurant",
  "food",
  "point_of_interest",
  "establishment",
  "store",
]);

function cuisines(types: string[] | undefined): string[] {
  const labels: string[] = [];
  for (const type of types ?? []) {
    if (GENERIC_TYPES.has(type)) continue;
    const label = type
      .replace(/_restaurant$|_place$/, "")
      .split("_")
      .filter(Boolean)
      .map((word) => word[0]!.toUpperCase() + word.slice(1))
      .join(" ");
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.slice(0, 4);
}

function reviews(list: ApiReview[] | undefined): PlaceReview[] {
  return (list ?? [])
    .map((r) => {
      const text = (r.text?.text ?? r.originalText?.text ?? "").trim();
      return {
        author: r.authorAttribution?.displayName ?? "A diner",
        rating: r.rating ?? null,
        text: text.length > MAX_REVIEW_CHARS ? `${text.slice(0, MAX_REVIEW_CHARS).trimEnd()}…` : text,
        relativeTime: r.relativePublishTimeDescription ?? null,
      };
    })
    .filter((r) => r.text.length > 0)
    .slice(0, MAX_REVIEWS);
}

function details(p: ApiPlace, photoNames: string[]): RestaurantDetails {
  return {
    websiteUrl: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    priceRange: priceRange(p.priceRange),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    summary: p.editorialSummary?.text ?? null,
    cuisines: cuisines(p.types),
    serves: {
      dineIn: p.dineIn ?? null,
      takeout: p.takeout ?? null,
      delivery: p.delivery ?? null,
      vegetarian: p.servesVegetarianFood ?? null,
      outdoorSeating: p.outdoorSeating ?? null,
      reservable: p.reservable ?? null,
    },
    reviews: reviews(p.reviews),
    photoUrls: photoNames.slice(1).map(photoPath),
  };
}

const photoPath = (name: string) => `/api/photo?name=${encodeURIComponent(name)}&w=800`;

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

/** One Places result → the shape the deck ships to every member. */
export function toRestaurant(p: ApiPlace & { id: string }): Restaurant {
  const photoNames = (p.photos ?? [])
    .map((photo) => photo.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, MAX_PHOTOS);
  return {
    placeId: p.id,
    name: p.displayName!.text!,
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ? (PRICE_FROM_ENUM[p.priceLevel] ?? null) : null,
    address: p.formattedAddress ?? "",
    category: p.primaryTypeDisplayName?.text ?? null,
    photoUrl: photoNames[0] ? photoPath(photoNames[0]) : null,
    mapsUrl: p.googleMapsUri ?? null,
    openNow: p.currentOpeningHours?.openNow ?? null,
    details: details(p, photoNames),
  };
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
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? "timed out after 8s"
        : err instanceof Error
          ? `${err.name}: ${err.message}`
          : String(err);
    console.error(`[places] search request failed (${reason})`);
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
    .map(toRestaurant);

  if (restaurants.length > 0) cache.set(key, restaurants);
  return restaurants;
}

const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_.=-]+$/;

type Photo = { bytes: ArrayBuffer; contentType: string };

// A photo resource name always refers to the same image and a map of a fixed
// point doesn't change, so both byte caches keep entries for a week.
const BYTES_TTL_MS = 7 * 24 * 60 * 60_000;
// Upstream failures (photo gone, Maps Static not enabled on the key) are also
// cached — briefly — so every open of the same sheet doesn't re-hit Google.
const NEGATIVE_TTL_MS = 5 * 60_000;

// Every member's browser requests the same deck's photos the moment a session
// starts, and browser Cache-Control only helps per-client — so cache the bytes
// (~100KB each) and coalesce concurrent fetches server-side to keep billable
// Photo Media calls at one per photo. A deck alone is up to 100 photos
// (5 × 20 cards), so 400 entries ≈ 40MB ≈ 4 active decks; the disk layer
// catches evictions and restarts.
const photoCache = new TtlCache<Photo | null>(BYTES_TTL_MS, 400);
const photoDisk = createByteDiskCache("photos", BYTES_TTL_MS, 2000);
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
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = photoInflight.get(key);
  if (inflight) return inflight;

  const fetching = (async () => {
    const onDisk = await photoDisk?.get(key);
    if (onDisk) {
      photoCache.set(key, onDisk);
      return onDisk;
    }
    const photo = await fetchPhotoUpstream(name, width);
    if (photo) {
      photoCache.set(key, photo);
      void photoDisk?.set(key, photo);
    } else {
      photoCache.set(key, null, NEGATIVE_TTL_MS);
    }
    return photo;
  })();
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

// ---------------------------------------------------------------------------
// Static map proxy
// ---------------------------------------------------------------------------

type MapImage = { bytes: ArrayBuffer; contentType: string };

// Same shape as the photo cache: the whole room opens the same detail sheet, and
// Maps Static is its own billable SKU, so cache and coalesce hard. A map is
// keyed by rounded coordinates, so every member's request is one upstream call.
const mapCache = new TtlCache<MapImage | null>(BYTES_TTL_MS, 200);
const mapDisk = createByteDiskCache("maps", BYTES_TTL_MS, 1000);
const mapInflight = new Map<string, Promise<MapImage | null>>();

/**
 * Fetches a Maps Static image server-side so the API key never reaches the
 * browser. Returns null when the coordinates are unusable or the Static Maps
 * API isn't enabled on the key — callers should treat that as "no map".
 */
export function fetchStaticMap(lat: number, lng: number, widthPx: number): Promise<MapImage | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return Promise.resolve(null);

  // ~11m of precision: nudging the request width shouldn't miss the cache.
  const at = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const width = Math.min(Math.max(Math.round(widthPx) || 640, 100), 640);
  const height = Math.round(width * 0.5);
  const key = `${at}:${width}`;

  const cached = mapCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = mapInflight.get(key);
  if (inflight) return inflight;

  const fetching = (async () => {
    const onDisk = await mapDisk?.get(key);
    if (onDisk) {
      mapCache.set(key, onDisk);
      return onDisk;
    }
    const image = await fetchStaticMapUpstream(at, width, height);
    if (image) {
      mapCache.set(key, image);
      void mapDisk?.set(key, image);
    } else {
      mapCache.set(key, null, NEGATIVE_TTL_MS);
    }
    return image;
  })();
  mapInflight.set(key, fetching);
  void fetching.finally(() => mapInflight.delete(key));
  return fetching;
}

async function fetchStaticMapUpstream(
  at: string,
  width: number,
  height: number,
): Promise<MapImage | null> {
  const url =
    `https://maps.googleapis.com/maps/api/staticmap?center=${at}&zoom=15` +
    `&size=${width}x${height}&scale=2&maptype=roadmap` +
    `&markers=${encodeURIComponent(`color:0xff5a36|${at}`)}` +
    `&key=${encodeURIComponent(env.GOOGLE_PLACES_API_KEY)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      // Most likely the key doesn't have Maps Static enabled — say so once,
      // loudly enough to find, then let the sheet render without a map.
      console.error(`[staticmap] ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    return {
      bytes: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/png",
    };
  } catch {
    return null;
  }
}
