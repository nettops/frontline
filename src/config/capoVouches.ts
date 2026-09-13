/**
 * A capo putting his own name behind one of his associates.
 *
 * Readiness is derived entirely from signals that already exist elsewhere in
 * the game — `daysInCrew`, the capo-to-associate tie `ties.ts` already keeps,
 * and the associate's own loyalty — rather than a new hidden "vouch-ready"
 * stat nothing else would ever read. See `sim/capoVouches.ts` for the
 * predicate itself; this file holds only the one number that is genuinely
 * new: how long a Wait or a Deny keeps the recommendation from coming back.
 */

export const CAPO_VOUCH = {
  /**
   * How long a Wait or a Deny holds the same recommendation off the screen.
   *
   * Same order of magnitude as `CAPO_PITCH.windowDays` (14) — the other place
   * in this game that prices "how long before this comes round again" — kept
   * as its own number rather than an import because the two mean different
   * things (a pitch going stale on its own clock vs. a boss's own decision
   * to set one aside) even though they should cost about the same.
   */
  cooldownDays: 14,
} as const;

/**
 * How many made men a capo can actually run, in the absence of a stored
 * capacity figure.
 *
 * Shaped exactly like `player.ts`'s `maxCrew` — a base plus a term per
 * district — because the same argument applies twice: a number derived from
 * what a man already holds cannot drift out of sync with a save, and a capo
 * who runs a district himself can plainly carry more men than one who has
 * never been given ground. `delegation.ts`'s own rule caps a steward at one
 * district, so in practice this is base-or-base-plus-one-term rather than an
 * open scale — which is fine; nothing here claims otherwise.
 */
export const CAPO_CAPACITY = {
  /** Every capo can run this many people with nothing else behind him. */
  base: 3,
  /** ...and this many more for the district he actually stewards, if any. */
  perDistrict: 3,
} as const;
