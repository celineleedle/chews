const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Standard geohash encoder. Precision 6 ≈ 1.2km × 0.6km cell — close enough
 * that two groups at the same restaurant strip share a cache entry.
 */
export function geohash(lat: number, lng: number, precision = 6): string {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = "";
  let bits = 0;
  let bit = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        bits = (bits << 1) | 1;
        minLng = mid;
      } else {
        bits = bits << 1;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        minLat = mid;
      } else {
        bits = bits << 1;
        maxLat = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[bits]!;
      bits = 0;
      bit = 0;
    }
  }
  return hash;
}
