import { env } from "../env.js";
import { mockDeck } from "./mock.js";
import { placesDeck } from "./client.js";
import type { DeckProvider } from "../rooms/room.js";

// Mock deck when MOCK_PLACES=1 or no API key is configured; real Google Places otherwise.
export const getDeck: DeckProvider = env.useMockPlaces ? mockDeck : placesDeck;

if (env.useMockPlaces) {
  console.log("[places] using mock restaurant data (set GOOGLE_PLACES_API_KEY and MOCK_PLACES=0 for real search)");
}
