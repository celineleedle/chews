import type { RankedResult, Restaurant } from "@chews/shared";

export type VoteMap = Map<string, Set<string>>;

/**
 * Returns the placeId every active participant has liked, or null.
 * Requires at least 2 active participants — a lone member can't "match with
 * themselves"; their session ends via deck exhaustion instead.
 */
export function checkUnanimous(likes: VoteMap, active: Set<string>): string | null {
  if (active.size < 2) return null;
  outer: for (const [placeId, likers] of likes) {
    for (const memberId of active) {
      if (!likers.has(memberId)) continue outer;
    }
    return placeId;
  }
  return null;
}

/**
 * Restaurants at least one person liked, best first: most likes, then fewest
 * passes, then deck order (stable sort keeps it).
 */
export function rankResults(deck: Restaurant[], likes: VoteMap, passes: VoteMap): RankedResult[] {
  return deck
    .map((restaurant) => ({
      restaurant,
      likeCount: likes.get(restaurant.placeId)?.size ?? 0,
      passCount: passes.get(restaurant.placeId)?.size ?? 0,
    }))
    .filter((r) => r.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount || a.passCount - b.passCount);
}

/** True when every active participant has finished the deck. */
export function allDone(active: Set<string>, isDone: (memberId: string) => boolean): boolean {
  if (active.size === 0) return false;
  for (const memberId of active) {
    if (!isDone(memberId)) return false;
  }
  return true;
}
