import type { Filters, Restaurant } from "@chews/shared";

// name, category, price 1-4, rating
const DATA: Array<[string, string, number, number]> = [
  ["Ember & Oak", "Steakhouse", 3, 4.6],
  ["Noodle Cloud", "Ramen", 2, 4.5],
  ["La Milpa Roja", "Mexican", 1, 4.7],
  ["Golden Bao House", "Dim Sum", 2, 4.3],
  ["Saffron Story", "Indian", 2, 4.4],
  ["The Brined Bird", "Fried Chicken", 2, 4.2],
  ["Verde Cocina", "Vegetarian", 2, 4.5],
  ["Pesto District", "Italian", 3, 4.4],
  ["Seoul Fire BBQ", "Korean BBQ", 3, 4.6],
  ["Banh Mi Bright", "Vietnamese", 1, 4.8],
  ["Tsukiji Slice", "Sushi", 4, 4.7],
  ["Falafel Physics", "Middle Eastern", 1, 4.3],
  ["Butter & Crumb", "Bakery Cafe", 2, 4.6],
  ["The Gumbo Line", "Cajun", 2, 4.4],
  ["Pho Real", "Vietnamese", 1, 4.5],
  ["Casa de Arepas", "Venezuelan", 1, 4.6],
  ["Thai Orchid Table", "Thai", 2, 4.3],
  ["Smash Alley", "Burgers", 1, 4.2],
  ["Mount Olympus Gyro", "Greek", 2, 4.4],
  ["Dumpling Meridian", "Chinese", 2, 4.7],
  ["Ceviche Costa", "Peruvian", 3, 4.5],
  ["Rustica Wood-Fired", "Pizza", 2, 4.6],
  ["The Curry Leaf", "Sri Lankan", 2, 4.5],
  ["Prairie Harvest", "New American", 4, 4.3],
  ["Midnight Diner 24", "Diner", 1, 4.1],
];

const HOURS = [
  "Monday: 11:00 AM – 10:00 PM",
  "Tuesday: 11:00 AM – 10:00 PM",
  "Wednesday: 11:00 AM – 10:00 PM",
  "Thursday: 11:00 AM – 11:00 PM",
  "Friday: 11:00 AM – 12:00 AM",
  "Saturday: 10:00 AM – 12:00 AM",
  "Sunday: 10:00 AM – 9:00 PM",
];

const REVIEW_TEXT = [
  "Came here with four friends and we all ordered something different — not a dud in the bunch. The service was quick even with a full room.",
  "Solid neighbourhood spot. Portions are generous and the staff actually remember you the second time around.",
  "Worth the wait. Get there before 7 or plan on standing outside for twenty minutes.",
];

export const MOCK_RESTAURANTS: Restaurant[] = DATA.map(([name, category, priceLevel, rating], i) => ({
  placeId: `mock-${i + 1}`,
  name,
  rating,
  ratingCount: 120 + ((i * 137) % 900),
  priceLevel,
  address: `${100 + i * 7} Sample St`,
  category,
  photoUrl: `https://picsum.photos/seed/chews-${i + 1}/800/1000`,
  mapsUrl: null,
  openNow: true,
  details: {
    websiteUrl: `https://example.com/${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    phone: `(555) ${String(100 + i).padStart(3, "0")}-${String(1000 + i * 7).slice(0, 4)}`,
    hours: HOURS,
    priceRange: ["$5–15", "$10–20", "$25–40", "$50–80"][priceLevel - 1] ?? null,
    // Scattered around downtown Chicago so the map preview has something to show.
    lat: 41.8827 + ((i % 5) - 2) * 0.004,
    lng: -87.6233 + ((i % 7) - 3) * 0.004,
    summary: `${category} spot known for its ${rating >= 4.5 ? "famously good" : "reliably good"} ${category.toLowerCase()}.`,
    cuisines: [category, i % 2 === 0 ? "Casual Dining" : "Family Friendly"],
    serves: {
      dineIn: true,
      takeout: i % 3 !== 0,
      delivery: i % 2 === 0,
      vegetarian: i % 4 !== 0,
      outdoorSeating: i % 5 === 0,
      reservable: priceLevel >= 3,
    },
    reviews: REVIEW_TEXT.slice(0, (i % 3) + 1).map((text, j) => ({
      author: ["Jordan P.", "Riley M.", "Sam K."][j]!,
      rating: j === 0 ? 5 : 4,
      text,
      relativeTime: ["2 weeks ago", "a month ago", "3 months ago"][j]!,
    })),
    photoUrls: [1, 2, 3].map((n) => `https://picsum.photos/seed/chews-${i + 1}-${n}/800/600`),
  },
}));

export async function mockDeck(filters: Filters): Promise<Restaurant[]> {
  const priced =
    filters.priceLevels.length === 0
      ? MOCK_RESTAURANTS
      : MOCK_RESTAURANTS.filter((r) => r.priceLevel !== null && filters.priceLevels.includes(r.priceLevel));
  // Never hand back an empty mock deck just because the filters were narrow.
  return priced.length >= 5 ? priced : MOCK_RESTAURANTS;
}
