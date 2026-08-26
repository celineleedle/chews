import { describe, expect, it } from "vitest";
import type { Restaurant } from "@chews/shared";
import { allDone, checkUnanimous, rankResults } from "../rooms/match.js";

function restaurant(placeId: string): Restaurant {
  return {
    placeId,
    name: placeId,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    address: "",
    category: null,
    photoUrl: null,
    mapsUrl: null,
    openNow: null,
  };
}

const votes = (entries: Array<[string, string[]]>) =>
  new Map(entries.map(([place, members]) => [place, new Set(members)]));

describe("checkUnanimous", () => {
  it("returns the place everyone active has liked", () => {
    const likes = votes([
      ["a", ["m1", "m2"]],
      ["b", ["m1", "m2", "m3"]],
    ]);
    expect(checkUnanimous(likes, new Set(["m1", "m2", "m3"]))).toBe("b");
  });

  it("ignores likes from departed members when judging unanimity", () => {
    const likes = votes([["a", ["m1", "gone"]]]);
    expect(checkUnanimous(likes, new Set(["m1", "m2"]))).toBeNull();
  });

  it("a departure can complete a match", () => {
    const likes = votes([["a", ["m1", "m2"]]]);
    expect(checkUnanimous(likes, new Set(["m1", "m2", "m3"]))).toBeNull();
    expect(checkUnanimous(likes, new Set(["m1", "m2"]))).toBe("a");
  });

  it("never matches a solo participant with themselves", () => {
    const likes = votes([["a", ["m1"]]]);
    expect(checkUnanimous(likes, new Set(["m1"]))).toBeNull();
  });
});

describe("rankResults", () => {
  const deck = [restaurant("a"), restaurant("b"), restaurant("c"), restaurant("d")];

  it("sorts by likes desc, then fewest passes, and drops unliked places", () => {
    const likes = votes([
      ["a", ["m1"]],
      ["b", ["m1", "m2"]],
      ["c", ["m1"]],
    ]);
    const passes = votes([
      ["a", ["m2", "m3"]],
      ["c", ["m2"]],
    ]);
    const ranked = rankResults(deck, likes, passes);
    expect(ranked.map((r) => r.restaurant.placeId)).toEqual(["b", "c", "a"]);
    expect(ranked[0]).toMatchObject({ likeCount: 2, passCount: 0 });
  });
});

describe("allDone", () => {
  it("is true only when every active member is done", () => {
    const done = new Set(["m1"]);
    const isDone = (id: string) => done.has(id);
    expect(allDone(new Set(["m1", "m2"]), isDone)).toBe(false);
    done.add("m2");
    expect(allDone(new Set(["m1", "m2"]), isDone)).toBe(true);
  });

  it("is false for an empty participant set", () => {
    expect(allDone(new Set(), () => true)).toBe(false);
  });
});
