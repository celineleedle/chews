import { describe, expect, it } from "vitest";
import { toRestaurant, type ApiPlace } from "../places/client.js";

function place(overrides: Partial<ApiPlace> = {}): ApiPlace & { id: string } {
  return {
    id: "place-1",
    displayName: { text: "Noodle Cloud" },
    ...overrides,
  };
}

describe("toRestaurant", () => {
  it("keeps the card fields it always had", () => {
    const r = toRestaurant(
      place({
        rating: 4.5,
        userRatingCount: 320,
        priceLevel: "PRICE_LEVEL_MODERATE",
        formattedAddress: "12 Broth Lane",
        primaryTypeDisplayName: { text: "Ramen" },
        currentOpeningHours: { openNow: true },
        googleMapsUri: "https://maps.google.com/?cid=1",
      }),
    );
    expect(r).toMatchObject({
      placeId: "place-1",
      name: "Noodle Cloud",
      rating: 4.5,
      ratingCount: 320,
      priceLevel: 2,
      address: "12 Broth Lane",
      category: "Ramen",
      openNow: true,
      mapsUrl: "https://maps.google.com/?cid=1",
    });
  });

  it("sends the first photo to the card and the rest to the sheet's gallery", () => {
    const names = Array.from({ length: 8 }, (_, i) => ({ name: `places/p/photos/${i}` }));
    const r = toRestaurant(place({ photos: names }));
    expect(r.photoUrl).toBe("/api/photo?name=places%2Fp%2Fphotos%2F0&w=800");
    // Five carried in total: one on the card, four behind it.
    expect(r.details?.photoUrls).toHaveLength(4);
    expect(r.details?.photoUrls[0]).toBe("/api/photo?name=places%2Fp%2Fphotos%2F1&w=800");
  });

  it("has no photo url when Places returned no photos", () => {
    expect(toRestaurant(place()).photoUrl).toBeNull();
    expect(toRestaurant(place({ photos: [] })).details?.photoUrls).toEqual([]);
  });

  it("turns place types into cuisine labels and drops the generic buckets", () => {
    const r = toRestaurant(
      place({
        types: ["ramen_restaurant", "japanese_restaurant", "restaurant", "food", "point_of_interest"],
      }),
    );
    expect(r.details?.cuisines).toEqual(["Ramen", "Japanese"]);
  });

  it("caps cuisine labels and never repeats one", () => {
    const r = toRestaurant(
      place({
        types: ["a_restaurant", "a_place", "b_restaurant", "c_restaurant", "d_restaurant", "e_restaurant"],
      }),
    );
    expect(r.details?.cuisines).toEqual(["A", "B", "C", "D"]);
  });

  it("formats a price range without repeating the currency symbol", () => {
    const r = toRestaurant(
      place({
        priceRange: {
          startPrice: { currencyCode: "USD", units: "10" },
          endPrice: { currencyCode: "USD", units: "20" },
        },
      }),
    );
    expect(r.details?.priceRange).toBe("$10–20");
  });

  it("falls back to whichever price bound Places gave", () => {
    const start = toRestaurant(
      place({ priceRange: { startPrice: { currencyCode: "USD", units: "15" } } }),
    );
    expect(start.details?.priceRange).toBe("$15");

    const end = toRestaurant(place({ priceRange: { endPrice: { currencyCode: "EUR", units: "40" } } }));
    expect(end.details?.priceRange).toBe("€40");

    expect(toRestaurant(place()).details?.priceRange).toBeNull();
  });

  it("truncates long reviews, drops empty ones, and caps the count", () => {
    const r = toRestaurant(
      place({
        reviews: [
          {
            authorAttribution: { displayName: "Jordan P." },
            rating: 5,
            text: { text: "x".repeat(400) },
            relativePublishTimeDescription: "2 weeks ago",
          },
          { authorAttribution: { displayName: "Blank" }, text: { text: "   " } },
          { originalText: { text: "Fell back to originalText" } },
          { text: { text: "third" } },
          { text: { text: "fourth — over the cap" } },
        ],
      }),
    );
    const reviews = r.details!.reviews;
    expect(reviews).toHaveLength(3);
    expect(reviews[0]).toMatchObject({ author: "Jordan P.", rating: 5, relativeTime: "2 weeks ago" });
    expect(reviews[0]!.text).toHaveLength(281); // 280 chars plus the ellipsis
    expect(reviews[0]!.text.endsWith("…")).toBe(true);
    expect(reviews[1]).toMatchObject({ author: "A diner", text: "Fell back to originalText" });
    expect(reviews.map((rev) => rev.text)).not.toContain("fourth — over the cap");
  });

  it("carries the atmosphere flags through as tri-state", () => {
    const r = toRestaurant(place({ dineIn: true, delivery: false }));
    expect(r.details?.serves).toEqual({
      dineIn: true,
      delivery: false,
      takeout: null,
      vegetarian: null,
      outdoorSeating: null,
      reservable: null,
    });
  });

  it("produces an empty-but-present details block when Places sent nothing extra", () => {
    const r = toRestaurant(place());
    expect(r.details).toMatchObject({
      websiteUrl: null,
      phone: null,
      hours: [],
      lat: null,
      lng: null,
      summary: null,
      cuisines: [],
      reviews: [],
      photoUrls: [],
    });
  });
});
