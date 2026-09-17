/**
 * The money that is already gone.
 *
 * Every other pool in this game is for spending on the organization. This one
 * is the opposite: `nestEgg` leaves the wallet, leaves `cleanWorth`, leaves
 * the rank table, and never comes back. It buys exactly one thing, once, at
 * the end — the only way out of the chair that is not a cell, a bullet or a
 * handover.
 *
 * `putAway` in `economy.ts` is the honest comparison and the reason this is a
 * different system rather than a bigger version of that one. Holdings are
 * unavailable and still yours: `cleanWorth` counts them, so rank counts them.
 * This does not. Siphoning is a boss taking money off his own organization
 * and calling it retirement, and the organization is not stupid.
 *
 * Which is the whole trap. `suspicion` is the price of the plan, and it is
 * paid to the people whose grievance already decides whether there is a coup
 * this week. A boss quietly building a landing strip is a boss whose capos are
 * watching the take come in light for reasons nobody will say out loud.
 */

export const FLORIDA = {
  /**
   * What a peaceful retirement costs.
   *
   * Sized against what a mid-career organization is actually worth rather than
   * against a score: a quarter of a million is several good years of clean
   * money that could have been fronts, lawyers or rank. Reaching it is a
   * decision to stop growing, which is the point — nothing in this game has
   * ever asked the player to stop.
   */
  targetNestEgg: 250_000,

  /** Suspicion gained per $1,000 siphoned. */
  suspicionPerSiphon: 0.4,

  /**
   * ...and what a quiet week takes back off it.
   *
   * Slow on purpose. The plan is supposed to be something a boss carries for
   * a long time rather than something he can wash off by skipping a month.
   */
  suspicionDecayWeekly: 1.5,

  /**
   * Past here, the room has worked out what the light weeks are about, and
   * the coup roll doubles. Also the bar at which the weekly pass starts
   * putting grievance on the capos directly.
   */
  coupRiskSuspicionThreshold: 50,

  /** Multiplies `DEPOSITION.chancePerWeek` once past the bar above. */
  coupChanceMultiplier: 2.0,

  /** Past here they stop waiting for the roll. */
  mutinyThreshold: 85,

  /** What a week over the coup bar puts on every capo at the table. */
  grievancePerWeekOverThreshold: 2,
} as const;
