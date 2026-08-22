/**
 * Whether the family still does what it is told.
 *
 * The one number the Mafia-boss audit argued for, and the reason it argued for
 * it: of everything the vision asks a boss to have, authority is the only
 * quality that is not either already in the game under a different name or a
 * presentation problem. Respect is what people will do for you because they
 * want to. Fear is what they will do because of what happens if they do not.
 * Neither of them is *obedience*, and without obedience the vision's own
 * stated interactions cannot be written down — "high fear increases obedience
 * but decreases loyalty" has nothing on the left-hand side, and "low authority
 * makes capos independent" has nothing on either.
 *
 * **Derived, never stored.** Same rule as `estate` and `legitimacy`, for the
 * same reason: it is an opinion about the world rather than a fact in it, and
 * a stored copy is a second thing to keep true. `org.influence` was a stored
 * opinion nothing could change and it shipped that way for months.
 *
 * **And it must be felt, not displayed.** The failure mode for a number like
 * this is an eleventh row on a panel that changes nothing — the "meaningless
 * statistic" the brief bans. So it has exactly one mechanical consumer, and
 * that consumer is a term that already existed in a worse form: whether a man
 * running one of your districts thinks anybody is counting.
 */

/**
 * What obedience is made of.
 *
 * Four terms, weighted to sum to one. Each is something the player did rather
 * than something that happened to them, which is what makes the number a
 * verdict on how the family has been run rather than on how lucky it has been.
 */
export const AUTHORITY = {
  /** What the crew think of you, averaged. The largest single term. */
  respected: 0.4,
  /**
   * Whether they are afraid to test it.
   *
   * Deliberately smaller than respect and deliberately present. A family runs
   * on one or the other and the vision is explicit that fear buys obedience
   * while costing loyalty — which is exactly what this weighting produces,
   * because `org.fear` also drives the loyalty drift downward elsewhere.
   */
  feared: 0.25,
  /** Whether anybody has a standing reason to ignore you. */
  ungrieved: 0.2,
  /** Whether your word has held. */
  wordKept: 0.15,

  /**
   * Wages owed, as a share of the weekly bill, at which the crew stop
   * pretending. A payroll one week behind is a bad week; four is a different
   * organization.
   */
  arrearsAtWorst: 4,

  /**
   * How hard authority brakes somebody who is thinking about skimming.
   *
   * Replaces nothing and adds nothing on a family that is run well: at full
   * authority the brake is the full value and at none of it there is no brake,
   * which is the same shape `paidWellBonus` already had for wages. The point of
   * having both is that they are different questions — one is whether he needs
   * the money, the other is whether he thinks you would notice.
   *
   * Sized against `DELEGATION.grievanceUnbrake`, which is the term pulling the
   * other way, so a boss with no authority and an aggrieved steward is in real
   * trouble and a boss with authority is not.
   */
  skimBrake: 0.9,
} as const;

/** What the number is called on the screen, loudest first. */
export const AUTHORITY_LABEL: [number, string][] = [
  [80, 'Nobody asks twice'],
  [62, 'You are obeyed'],
  [45, 'Mostly, and slowly'],
  [28, 'They decide what to hear'],
  [0, 'You are asking, not telling'],
];
