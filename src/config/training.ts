/**
 * Getting better at it.
 *
 * A man was exactly as good as the day you hired him, forever, and then got
 * worse. `stats.skill` is rolled once in `generateNpc` from a range of 10 to
 * 70, and the only writes to it afterwards were `AGING.skillPerYear` — a
 * decline, and only past 55 — and a single event that adds twenty points at
 * the moment of hire. Nothing in the game raised it. The word ladder for the
 * stat reads `green · learning · competent · very good · exceptional`, so
 * "learning" named a state no character was ever in.
 *
 * Two halves, and they are deliberately not redundant.
 *
 * **Work makes journeymen.** Going out is how you get good at going out, up to
 * `streetCeiling` and no further. That is what stops a career of corner
 * shakedowns producing an exceptional crew, and it is what leaves the second
 * half something to sell.
 *
 * **Teaching makes specialists.** Past the ceiling the only thing that moves a
 * man is another man, and never past what that man knows.
 *
 * Work uses a rising cost curve, the same *shape* the player's own attributes
 * use, so progress compresses at the top rather than running away. Teaching
 * closes a share of the gap, the same shape the repaired heat and case meters
 * use, which gives "you cannot teach past what you know" for free.
 */

export const TRAINING = {
  /**
   * Where street work stops teaching, on the 0..100 stat scale.
   *
   * The band words split at twenty, so this is the top of *competent*. A man
   * who has worked for years is reliably competent and no more; very good and
   * exceptional are things somebody has to be shown, which is the whole reason
   * the second half of this feature exists.
   */
  streetCeiling: 60,

  /** Progress from one job, before the tier and the outcome scale it. */
  perJob: 1.6,

  /**
   * What a point of skill costs, rising with what he already has.
   *
   * The same *shape* as `attributeProgressNeeded` in `config/economy.ts` and
   * deliberately not the same numbers, because that curve is sized for the
   * player's attributes, which run 1 to 20. Crew stats run 0 to 100. Borrowing
   * it directly was tried first and priced a point at 35 progress at skill 20
   * and 83 at skill 50 — against roughly twenty nights a man gets in a career,
   * that is about **one point of skill in three hundred days**, which is a
   * feature nobody would ever notice.
   *
   * At these figures a point costs 9 at skill 20 and 19 at skill 60, so a man
   * doing street work crosses a band over a long career and a man on the big
   * jobs does it faster. Both plotted against the crew-skill distribution
   * rather than picked; see the probe arms.
   */
  pointBase: 4,
  pointSlope: 0.25,

  /**
   * How much more a big job teaches than a small one, per tier.
   *
   * A port operation is not a corner shakedown with a larger number on it.
   * Multiplied, so tier 0 street work still teaches something and tier 5 work
   * teaches roughly three times as much.
   */
  perTier: 0.4,

  /**
   * A job that went wrong still teaches, and teaches less.
   *
   * Not zero: the night everything came apart is the one people talk about for
   * years. Not equal either, or the safest way to build a crew would be to
   * lose deliberately.
   */
  onFailure: 0.5,

  // ------------------------------------------------------------ teaching ---

  /** Days a pairing runs. Both men are off the board for all of them. */
  days: 12,

  /**
   * The share of the gap between them that closes over a full run.
   *
   * A share rather than a rate, for the same reason the heat and case meters
   * were repaired to work that way: a flat figure teaches a man who knows
   * nothing exactly as much as one who nearly matches his teacher, and the
   * second of those is not how anybody learns anything. It also gives the
   * "cannot teach past what you know" rule for free — a share of a gap that
   * has closed is nothing.
   *
   * **Not sized against the estate.** Swept at 0.35 / 0.20 / 0.12 / 0.08, the
   * paired estate gap read +$477k / +$292k / +$291k / +$264k and the careers
   * that came out ahead read 24 / 24 / 20 / 22 of 36 — a fourfold change in
   * the strength of the mechanic barely moving either. That is the same
   * coarseness the scores arm found in the same instrument: the median of
   * thirty-odd paired careers is not a scale this can be weighed on, and
   * tuning against it would have been tuning against noise.
   *
   * So it is sized on what a fortnight ought to be worth. At 0.35 a pairing
   * returned 10.7 points of skill, over half a band from one run — a man
   * transformed by a single decision. At 0.12 it returns 3.8: noticeable,
   * incremental, and it takes several rounds to close on a teacher, which
   * makes this a repeated decision rather than a one-shot upgrade.
   */
  closesGap: 0.12,

  /**
   * And the same share of the gap in how careful they are.
   *
   * Lower than the skill figure on purpose. What a man picks up first is the
   * craft; whether he learns to leave nothing behind takes longer, and a boss
   * who puts a junior under his best earner should be able to be surprised by
   * this rather than warned by it. Discipline drives heat and exposure through
   * `crewTraitEffect`, so a sloppy teacher is a real bill arriving later.
   */
  disciplineShare: 0.2,

  /**
   * What a man who has been taught thinks he is owed now.
   *
   * The same move `STANDING.carry` makes, and for the reason recorded there:
   * `wageExpectation` already reads greed, so raising it *is* raising his
   * price through the path that exists. Nothing new is coupled to the wage
   * economy.
   */
  taught: {
    ambition: 2.5,
    greed: 2,
  },

  /**
   * Familiarity from a full run.
   *
   * Twelve days in a room with somebody tells you who he is. Sized against
   * `FAMILIARITY_PER_OPERATION` of 4 — worth about three jobs, which is what
   * the time is worth.
   */
  familiarity: 12,
} as const;

/** What the next point costs him. Rises with what he already has. */
export function skillProgressNeeded(current: number): number {
  return TRAINING.pointBase + current * TRAINING.pointSlope;
}
