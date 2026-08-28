import type { RankedResult, Restaurant } from "@chews/shared";

export type VoteMap = Map<string, Set<string>>;

/**
 * Returns every placeId all active participants have liked, excluding placeIds
 * that already matched (a card wins once). Requires at least 2 active
 * participants — a lone member can't "match with themselves"; their session
 * ends via deck exhaustion instead.
 */
export function checkUnanimous(likes: VoteMap, active: Set<string>, exclude: ReadonlySet<string>): string[] {
  if (active.size < 2) return [];
  const winners: string[] = [];
  outer: for (const [placeId, likers] of likes) {
    if (exclude.has(placeId)) continue;
    for (const memberId of active) {
      if (!likers.has(memberId)) continue outer;
    }
    winners.push(placeId);
  }
  return winners;
}

/**
 * Restaurants at least one person liked, best first: most likes, then fewest
 * passes, then deck order (stable sort keeps it). Matched restaurants are
 * excluded — they already won and are listed separately.
 */
export function rankResults(
  deck: Restaurant[],
  likes: VoteMap,
  passes: VoteMap,
  exclude: ReadonlySet<string>,
): RankedResult[] {
  return deck
    .filter((restaurant) => !exclude.has(restaurant.placeId))
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
