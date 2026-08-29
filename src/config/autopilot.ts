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
