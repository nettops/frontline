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

  /**
   * How much more often an ambitious capo's pitch gets drafted, next to a man
   * content running his crew — the design brief's "wants more responsibility"
   * read as a standing bias rather than a one-off scripted ask. A capo at 0
   * ambition keeps weight 1 (the old even odds); one at 100 gets weight 2, so
   * the most ambitious man in a two-capo pool brings you roughly twice as many
   * pitches as the least ambitious, not a guarantee, never a lock-out.
   */
  ambitionWeight: 1,
} as const;
