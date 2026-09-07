/**
 * The autopilot's heat sense — the two levers and nothing else.
 *
 * Both numbers were set by measurement, not judgement: the `matchOpsSmart`
 * arm in ladder.probe ran them across 36 careers at day 300 and came out
 * level with careful hand play (median +$347,540 against the hand, 20/36
 * ahead — a spread, not an edge). The mechanism is the reverse of what it
 * looks like: throttling to quiet work above 40 stops the loop ever grinding
 * into a forced lay-low at 70, so it trades a handful of dangerous nights
 * for a great many ordinary ones. Never being benched is worth more than any
 * allocation rule.
 *
 * Deliberately crude. Two thresholds is the whole policy — anything cleverer
 * would be a strategy, and the measured finding belongs to these numbers,
 * not to the idea of heat sense in general.
 */
export const AUTOPILOT = {
  /** Above this, only low and moderate work goes out. */
  quietAbove: 40,
  /** Above this, nothing goes out at all until it cools. */
  stopAbove: 65,
} as const;

/**
 * A setting, not a strategy — round 16's own finding.
 *
 * The autopilot's one real financial crisis in a blind round traced to a
 * single omission: the jobs pass spends against `totalFunds`, which has no
 * idea payroll exists. Two risky jobs failed back to back, the loop kept
 * spending because the money was technically there, and the crew came due
 * on a Friday it could not meet. The heat sense already answers "how loud is
 * too loud" — this answers "how broke is too broke", and it is the same
 * shape of answer: crude, three settings, and the number line is `AUTOPILOT`
 * above, not a new idea next to it.
 *
 * `normal` **is** `AUTOPILOT` above, verbatim — an existing save with
 * autopilot already on gets the exact behaviour it already had, because
 * `autopilotRisk` is optional and absent reads as `normal`. `cautious` moves
 * both heat thresholds down by the same fifteen points `quietAbove` sits
 * below `stopAbove` today, and adds the one thing that was actually missing:
 * it will not spend into the coming payday. `aggressive` moves them up by
 * the same amount and changes nothing else — a player who wants the loop to
 * run hotter is asking for exactly the risk this file already prices,
 * further out.
 *
 * Reported, not yet asserted, in `ladder.probe.test.ts`'s autopilot-risk
 * arms — the numbers are a first cut sized off the existing gap between the
 * two thresholds, the same way the original two were sized off measurement
 * rather than guessed twice.
 */
export type AutopilotRisk = 'cautious' | 'normal' | 'aggressive';

export const AUTOPILOT_RISK: Record<
  AutopilotRisk,
  { quietAbove: number; stopAbove: number; reservesPayroll: boolean }
> = {
  cautious: { quietAbove: 25, stopAbove: 50, reservesPayroll: true },
  normal: { quietAbove: AUTOPILOT.quietAbove, stopAbove: AUTOPILOT.stopAbove, reservesPayroll: false },
  aggressive: { quietAbove: 55, stopAbove: 80, reservesPayroll: false },
};

export const AUTOPILOT_RISK_LABEL: Record<AutopilotRisk, string> = {
  cautious: 'Cautious',
  normal: 'Normal',
  aggressive: 'Aggressive',
};

export const AUTOPILOT_RISK_BLURB: Record<AutopilotRisk, string> = {
  cautious: `Eases off at ${AUTOPILOT_RISK.cautious.quietAbove} heat, stops at ${AUTOPILOT_RISK.cautious.stopAbove}, and never spends into what payday costs.`,
  normal: `Eases off at ${AUTOPILOT_RISK.normal.quietAbove} heat, stops at ${AUTOPILOT_RISK.normal.stopAbove}. What this always did.`,
  aggressive: `Eases off at ${AUTOPILOT_RISK.aggressive.quietAbove} heat, stops at ${AUTOPILOT_RISK.aggressive.stopAbove}. Spends everything it has.`,
};

/**
 * Whether the loop is allowed to send people after somebody.
 *
 * Contracts gave a hand player a verb the autopilot did not have, and the bar
 * for this feature is that laziness is a supported way to play rather than a
 * handicap. So the loop gets the verb — under a rule narrow enough that it
 * cannot be a strategy.
 *
 * **Only during a war the player already chose.** That is the whole safety
 * property and it is not a tuning knob. A contract can start a war; a loop
 * that weighs whether a war is worth starting is making the largest decision
 * in the game on the player's behalf, which is not what handing over the
 * operations loop meant. Inside a war that is already running, going after
 * their people is unambiguously what a careful hand does, and the worst case
 * is that it is expensive rather than that it is a surprise.
 *
 * That was written as caution and it turned out to be right on the numbers.
 * `ladder.probe`, 36 careers each against a bot that never sends anybody:
 *
 *     only at war    median $0         17 of 36 ahead
 *     freely         median −$288,425   9 of 36 ahead
 *
 * The gate is protecting the player rather than costing them, and the cost of
 * removing it would not be money — crew and heat-weeks barely move. It is the
 * war it starts.
 *
 * ## It has to reserve, and that was a measurement rather than a preference
 *
 * The first version took only what the work left over, which is the obvious
 * safe rule and made the whole thing dead. Traced across 25 days at three
 * roster sizes, free crew after the jobs pass was **zero on almost every
 * day** — the loop fills the board by design, so there is never anything
 * spare:
 *
 *     6 men     free 0, 0, 0, 0, 0      contracts opened: 0
 *     12 men    free 0, 0, 1, 0, 1      contracts opened: 0
 *     20 men    free 2, 0, 0, 0, 11     contracts opened: 1
 *
 * A verb that fires once in a career on a twenty-man outfit is decoration. So
 * the loop *reserves* `CONTRACT.crew` before it allocates jobs — but only in
 * a war, only when nothing is already out, and only when there are enough men
 * that holding two back is not the same as stopping work. A family at war does
 * not put every last man on shakedowns.
 */
export const AUTOPILOT_CONTRACTS = {
  /**
   * Men on the books before the loop will hold any of them back.
   *
   * Below this, reserving two is most of the roster and the reservation would
   * be a strategy — running the family's war instead of its work. Above it,
   * two men is a detail.
   */
  minRoster: 6,
  /** Funds must be this many times the price before it is spare money. */
  fundsMultiple: 8,
  /** Never more than one out at a time, whatever else is true. */
  maxOpen: 1,
} as const;
