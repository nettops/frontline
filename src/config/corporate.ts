/**
 * The mob in an office.
 *
 * Two things that have nothing to do with a street corner and everything to
 * do with what a family looks like once it has stopped being poor: a health
 * plan carried on somebody else's payroll, and a room full of telephones
 * selling a stock that does not exist.
 *
 * The insurance is the interesting half. Everything else in this game that
 * touches the body — the consultation, the evening at home, the sedatives —
 * is bought a night at a time. This is the one thing that buys the *calendar*
 * back, and it is deliberately not for sale: it is a consequence of having a
 * union local in your pocket or two legitimate fronts with a payroll on them.
 * A boss who built nothing legitimate ages on schedule.
 */

export const HEALTH_INSURANCE = {
  /**
   * Union standing at which a local's plan will carry a no-show consultant.
   *
   * Read off `state.civic`'s `union` figure rather than off anything new —
   * that number already means "what the union boss thinks he owes you", and
   * a card is the most ordinary thing he has to give.
   */
  minUnionStanding: 60,

  /**
   * Or a payroll of your own. Two operating fronts is a real company with a
   * group plan on it; one is a laundromat with a cousin behind the counter.
   */
  minFronts: 2,

  /**
   * What the plan takes off `NEPOTISM.agingWearinessStress` each week.
   *
   * Set equal to that constant on purpose, so an insured boss reads exactly
   * zero on the `aging` line rather than "a bit less". It is a subtraction
   * rather than a boolean so the two numbers can never drift apart silently:
   * raise the weariness and the relief no longer covers all of it, which is
   * a balance decision somebody has to make on purpose.
   */
  wearinessRelief: 1.5,

  /**
   * Extra stress a consultation clears when somebody else is paying for it.
   *
   * The fiction is a cardiologist rather than a man in an unmarked office on
   * 72nd Street, and the mechanics follow: more of the hour is spent on the
   * heart and less of it on not being seen.
   */
  cardiologistRecoveryBonus: 12,

  /** What the covered visit bills, before `priced()`. Nearly double the
   * uncovered `STRESS.consultCost` — the plan is what makes it affordable. */
  cardiologistCost: 650,
} as const;

/**
 * A room, forty telephones, and a stock nobody has heard of.
 *
 * Deliberately not an entry in `OPERATIONS`: the board is tiered, gated on
 * districts and crew, and priced against street work, and a pump-and-dump
 * is none of those things. It is a one-shot that turns a week of a few
 * soldiers' time into *clean* money, which is the only thing in the game
 * that does — and the reason it costs what it costs on the back end.
 */
export const BOILER_ROOM = {
  name: 'Webistics',

  /** Setting the floor up: the lease, the phones, the printed prospectus. */
  setupCost: 9_000,

  /** Soldiers who have to be free to work the phones. Nobody is sent away —
   * they are on the telephone for a week, and the gate is that you have them. */
  crewRequired: 3,

  /** What the pump returns, as a multiple of `setupCost`, before the ramp. */
  returnRange: [1.6, 3.4] as [number, number],

  /**
   * How much better it goes with a bigger, better-connected family behind it.
   * Scaled on respect, which is the closest thing the game has to "how many
   * people will take your call".
   */
  respectBonusPerPoint: 0.004,

  /** Ceiling on the term above, so a late-career boss does not print money. */
  respectBonusCap: 0.6,

  /** Financial paper the dump leaves behind, read by the agencies that work it. */
  evidenceStrength: 9,

  /** And the attention. Securities fraud is loud in a way a hijacking is not. */
  heat: 6,

  /** Days before the same shell can be run again — a burned stock stays burned. */
  cooldownDays: 60,
} as const;
