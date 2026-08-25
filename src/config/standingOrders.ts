/**
 * The groove a standing order wears.
 *
 * An order fired on the same job in the same district a median of **234 times
 * in a 300-day career**, and nothing in the game noticed. Heat registered each
 * night and then decayed. Two hundred and thirty-four identical crimes on one
 * block left no trace that they were the same crime.
 *
 * That is what made the automation a switch rather than a decision. Measured,
 * an order left running alone lost every career of thirty-six; the same order
 * kept alongside hand play came out ahead on sixteen of thirty-six at a median
 * of −$73,022, which on a $2.1M estate is noise. So the thing the module is
 * sold on — *a standing order does not read the room* — was true and cost
 * nothing, and whether automating was free or a trap never depended on
 * anything the player did.
 *
 * A pattern fixes that by giving repetition a price that grows and clears.
 * Three properties carry it:
 *
 * **It is worn on a job and a district together**, so the counterplay is to go
 * and stand somewhere else rather than to stop. Automation becomes a rotation
 * around the map instead of a countdown, which hands the feature to the
 * territory system rather than to a timer.
 *
 * **It is charged to anybody working the pair**, not only to the order. The
 * police watch the pattern, not your minutes. Without that the play is to let
 * the order wear the groove and hand-run the same job past it for free.
 *
 * **It is nothing at all until somebody sets an order**, exactly as `prep` is
 * nothing until somebody opens a score. Every baseline recorded in
 * `ladder.probe` is therefore untouched, and only the automated arms move.
 *
 * The order still does not read the room. The player has to.
 */

export const PATTERN = {
  /**
   * What one more night on the same corner adds.
   *
   * **Provisional, and due a sweep against the fire counts.** Sized here from
   * the shape rather than measured: with the decay below, a pattern that rises
   * by this much per firing settles at `perFire / decayShare`, so 2 against
   * 0.026 plateaus near 77 of a possible 100. That is deliberate — it means an
   * order left running forever ends up somewhere bad and stays there, without
   * needing a hard ceiling to say so.
   */
  perFire: 2,

  /**
   * Where a groove stops deepening, whatever anybody does.
   *
   * A clamp rather than the working limit; the equilibrium above sits well
   * under it. Here so the arithmetic cannot run away if the rate is ever swept
   * upward.
   */
  cap: 100,

  /**
   * Points off the odds, per unit of pattern.
   *
   * The same shape as `SCORE.alertnessWeight`, which is what a score's
   * alertness costs its own job — a place is either being watched or it is
   * not, and the game should charge for that one way.
   *
   * **Swept, and the response is not monotonic.** Paired against the same
   * thirty-six seeds, an order moved every three weeks against the same order
   * left where it was:
   *
   *     cost      half-life   moving ahead   gap        moved v hand   left v hand
   *     off       27d         (control)
   *     0.004/2   27d         17/36          −$53,207     +$334,425     −$328,500
   *     0.004/2   12d         13/36         −$288,198      −$62,915     −$198,285
   *     0.006/2.5 27d         22/36         +$683,082      +$46,920     −$495,910
   *     0.006/2.5 12d         25/36         +$337,991     +$194,402     −$609,119
   *     0.008/3   27d         19/36          +$67,110     −$196,434     −$413,696
   *     0.008/3   12d         21/36         +$167,374     −$565,213     −$552,827
   *
   * At 0.004 there is no decision: moving costs you half your nights and buys
   * back less than they were worth. At 0.008 there is no decision either, for
   * the opposite reason — the bill is heavy enough to drown both arms, and
   * automation loses to hand play whether you move it or not. That is the tax
   * again, made symmetrical.
   *
   * 0.006 is the peak, and the shape at the peak is the one this feature was
   * supposed to have: **move it and you finish level with playing by hand
   * (+$46,920); leave it and you are down half a million.** Automating well
   * is a convenience that costs nothing and wins nothing, automating lazily
   * is expensive, and neither option dominates.
   *
   * The faster-decay column is not chosen despite winning on careers, because
   * it wins by winning: +$194,402 against the hand is automation coming out
   * ahead of playing, which is the one thing `RUNS_AUTO` exists to forbid.
   */
  weight: 0.006,

  /**
   * What the night sounds like when everyone knows the routine.
   *
   * The multiplier at `cap`, interpolated down to 1 at nothing. Heat carries
   * more of this cost than the odds do, because heat is where a pattern
   * belongs: `HEAT_EVIDENCE_CONTRIBUTION` already feeds street heat into
   * case-building through `agencyHeat`, so a grind that runs loud enough for
   * long enough opens a file with nothing new plumbed in. A pattern should end
   * in a folder with your name on it, not in your men getting worse at their
   * jobs.
   *
   * Swept with `weight` rather than against it — see the table there. Moving
   * the two apart asks a question nobody would act on separately.
   */
  heatAtFull: 2.5,

  /**
   * The share of the groove that fades on a day nobody works the pair.
   *
   * A share of the load rather than a flat figure, and the same figure as
   * `HEAT_DECAY_SHARE` for the reason recorded there: a flat rate clears
   * slowest exactly where it is worst. It gives a half-life near 27 days,
   * which is deliberately longer than a sensible rotation — waiting a groove
   * out is meant to work and to be the worse of the two answers.
   *
   * Swept against a 12-day half-life with `perFire` scaled to hold the
   * plateau, and kept. Clearing faster makes moving an order *too* good: it
   * put automation $194,402 ahead of playing by hand, and it cut the order's
   * firing from 81 nights a career to 37, so the convenience stopped being
   * convenient. See the table under `weight`.
   *
   * Applied every day, including days the order fires. That is what produces
   * the plateau above rather than a runaway, and it costs no extra state: no
   * "last fired" field, no quiet-day gate, one pass.
   */
  decayShare: 0.026,

  /**
   * Where the game says something about it, once.
   *
   * `attention.ts` speaks at this level and not before. The point of the line
   * is that nobody should have to sit and watch a meter to play this well —
   * and a line that is always there is wallpaper, which is the rule that file
   * already guards.
   */
  noticeAbove: 25,
} as const;
