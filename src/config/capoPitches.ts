/**
 * The board a boss with people under him actually looks at.
 *
 * The static table listed every open Tier 1+ job as a permanent row and left
 * the picking to the player, every time, no matter how large the organization
 * had grown — a boss who has outgrown the corner should not still be
 * personally reading a twenty-row menu. This is what replaces it: a short,
 * live list of what capos are bringing him, refreshed on the same weekly
 * cadence `DELEGATION.intervalDays` and `VERBS.casingDays` already use.
 *
 * Tier 0 is untouched — see `sim/operations.ts`'s `outgrewStreetWork`. Street
 * work is either gone or the plain manual board; it never becomes a pitch.
 */

export const CAPO_PITCH = {
  /** How many are on the board at once. Few enough to read in one look. */
  count: 3,

  /** He brings you something new this often — the same week `tickDelegation` uses. */
  refreshIntervalDays: 7,

  /**
   * How long an unanswered pitch stays live before he stops waiting on you and
   * takes it elsewhere. Two refresh cycles, the same order of magnitude as
   * `call_in_tribute`'s `cooldownDays: 14` — the one other number in this game
   * that prices "how long before this comes round again".
   */
  windowDays: 14,
} as const;
