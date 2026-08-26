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
}));

export async function mockDeck(filters: Filters): Promise<Restaurant[]> {
  const priced =
    filters.priceLevels.length === 0
      ? MOCK_RESTAURANTS
      : MOCK_RESTAURANTS.filter((r) => r.priceLevel !== null && filters.priceLevels.includes(r.priceLevel));
  // Never hand back an empty mock deck just because the filters were narrow.
  return priced.length >= 5 ? priced : MOCK_RESTAURANTS;
}
