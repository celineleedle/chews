import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "../places/cache.js";
import { geohash } from "../places/geohash.js";

describe("TtlCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns values before TTL and drops them after", () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeUndefined();
  });

  it("evicts the least recently used entry at capacity", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // refresh a's recency
    cache.set("c", 3); // evicts b
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });
});

describe("geohash", () => {
  it("matches known reference values", () => {
    // classic reference point from the geohash spec
    expect(geohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
    expect(geohash(37.7749, -122.4194, 6)).toBe("9q8yyk");
  });

  it("nearby points share a precision-6 prefix", () => {
    expect(geohash(40.7128, -74.006, 6)).toBe(geohash(40.7129, -74.0061, 6));
  });
});
