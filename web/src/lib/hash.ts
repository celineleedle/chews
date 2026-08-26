/** Deterministically picks an option for a key — stable avatar colors, card fallbacks, etc. */
export function hashPick<T>(key: string, options: readonly T[]): T {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return options[Math.abs(hash) % options.length]!;
}
