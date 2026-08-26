/** Tiny TTL + LRU cache — a Map's insertion order doubles as recency order. */
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private ttlMs: number,
    private maxEntries: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    // refresh recency
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** `ttlMs` overrides the cache-wide TTL for this entry (e.g. short-lived negative entries). */
  set(key: string, value: V, ttlMs = this.ttlMs) {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size() {
    return this.entries.size;
  }
}
