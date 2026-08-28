export type RoomStatus = "lobby" | "swiping" | "finished";

export interface Restaurant {
  placeId: string;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  /** 1 (cheap) – 4 (splurge), null when unknown */
  priceLevel: number | null;
  address: string;
  category: string | null;
  /** Same-origin proxied photo path, e.g. /api/photo/<name>?w=800 */
  photoUrl: string | null;
  mapsUrl: string | null;
  openNow: boolean | null;
  /** Everything behind the swipe-up sheet. Absent on decks built before it existed. */
  details?: RestaurantDetails | null;
}

/** Whether the place does each thing; null means Places didn't say. */
export interface ServiceOptions {
  dineIn: boolean | null;
  takeout: boolean | null;
  delivery: boolean | null;
  vegetarian: boolean | null;
  outdoorSeating: boolean | null;
  reservable: boolean | null;
}

export interface PlaceReview {
  author: string;
  rating: number | null;
  text: string;
  relativeTime: string | null;
}

export interface RestaurantDetails {
  /** The restaurant's own site — where the menu lives, when it has one. */
  websiteUrl: string | null;
  phone: string | null;
  /** One line per weekday, straight from Places. */
  hours: string[];
  /** Typical spend, e.g. "$10–20". */
  priceRange: string | null;
  lat: number | null;
  lng: number | null;
  /** Google's one-line editorial blurb. */
  summary: string | null;
  /** Cuisine labels derived from the place types, e.g. ["Ramen", "Japanese"]. */
  cuisines: string[];
  serves: ServiceOptions;
  reviews: PlaceReview[];
  /** Proxied gallery photos beyond `photoUrl`. */
  photoUrls: string[];
}

export interface MemberInfo {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  deckDone: boolean;
}

export interface Filters {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  /** Subset of [1,2,3,4]; empty = any price */
  priceLevels: number[];
  openNow: boolean;
}

export interface RankedResult {
  restaurant: Restaurant;
  likeCount: number;
  passCount: number;
}

/** Final results: every unanimous match in occurrence order, plus the ranked rest. */
export interface SessionResult {
  matches: Restaurant[];
  ranked: RankedResult[];
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  hostId: string;
  members: MemberInfo[];
  filters: Filters;
  /** Present once the session has started */
  deck: Restaurant[] | null;
  /** The receiving member's own position in the deck */
  progressIndex: number;
  progress: { doneCount: number; totalCount: number };
  /** Unanimous matches so far, in the order they happened. */
  matches: Restaurant[];
  /** Whether the receiving member's most recent swipe can be taken back. */
  canUndo: boolean;
  /** Present once the session has finished. */
  result: SessionResult | null;
}

export const DEFAULT_FILTERS: Filters = {
  lat: null,
  lng: null,
  radiusM: 3200,
  priceLevels: [],
  openNow: true,
};
