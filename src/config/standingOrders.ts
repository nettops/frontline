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
   * Charged per *day the pair is being worked*, not per job launched. With the
   * decay below, a pair worked continuously settles at `perFire / decayShare`
   * — 2 against 0.026, so near 77 of a possible 100. An order left running
   * forever ends up somewhere bad and stays there, with no hard ceiling needed
   * to say so.
   *
   * **Per day rather than per firing is a repair, and it mattered.** It used to
   * rise once when a job went out and fade once a day, so the depth of a groove
   * was governed by how long the job took rather than by how much of the
   * calendar you spent on that street. Measured across the board:
   *
   *     job                  days   plateau before   after
   *     corner shakedown     1      76.8             69.4
   *     protection racket    3      —                48.5
   *     truck hijacking      3      16.6             29.3
   *     backroom card game   7      —                76.8
   *
   * A three-day job sat at 16.6 — under `noticeAbove`, so the whole mechanic
   * was close to invisible on the slower half of the board, and nobody chose
   * that. Now the deepest groove belongs to the seven-day job, which is right:
   * a crew tied up on the same operation continuously is the most predictable
   * thing in the city.
   *
   * The one-day case is unchanged in mechanism, which is what lets the sweep
   * below stand — `tickOperations` resolves at phase 1 and the tick runs at
   * 1b4, so a one-day job is already home and still accrues exactly once. The
   * 76.8-to-69.4 difference is the fixture, not the change: it fired 243 days
   * of 250 rather than 250, and 2 x (243/250) / 0.026 predicts 74.8.
   */
  perFire: 2,

  /**
   * Whether a night the player runs by hand wears the groove too.
   *
   * `true`, and it is what this mechanic was always described as doing —
   * "charged to anybody working the pair, not only to the order. The police
   * watch the pattern, not your minutes." It was not true in the code: the
   * number lived on the `StandingOrder` record, so a player who never
   * automated anything had nothing for it to live on and could repeat one job
   * on one corner forever for nothing.
   *
   * Round 19's tester did exactly that from roughly day 110 to day 300 —
   * *"the inputs got bigger; the decision never got new"* — while round 18's
   * tester, who had set an order, met the same mechanic on day 68 at −17% on
   * his odds. Same build, opposite experience, and the difference was a
   * feature neither of them was choosing between.
   *
   * It is a flag rather than a bare `true` for one reason: the old note in
   * this file said every `ladder.probe` baseline was untouched *because* the
   * mechanic was inert without an order, so turning it on moves all of them at
   * once, and a change that moves every baseline needs something the paired
   * sweep in `ladder.probe` can turn. See `wearing the groove by hand` there.
   *
   * **And measured against the complaint itself, which it had never been.**
   * Every reading this mechanic had was an estate or a rank — what repetition
   * *cost*, never whether anybody stopped repeating. Sixty paired seeds on a
   * bot that reads the odds it is shown, groove against no groove:
   *
   *     over the last 90 days   without   with     seeds moved
   *     distinct job/district   21        42       54 up, 6 down
   *     share on its top 3      0.49      0.40     45 down, 15 up
   *
   * A career works twice as much of the board and leans nine points less on
   * its three habits. The day it *stops* finding anything new came back 286
   * against 294 of 300 and is not a reading — that arm re-picks a district
   * every morning, so it never settles either way. See
   * `says whether pricing repetition changes what a career does`.
   *
   * The size is an upper bound, not a forecast. It is what a player who reads
   * every number on every job gets; round 19's tester was not that player, and
   * whether the price is legible enough to change a human's mind is a question
   * for a blind round, not for this file.
   */
  wornByHand: true,

  /**
   * And what a hand-run night adds, which is not what an order adds.
   *
   * Charging `perFire` for both was the first attempt and it took the ladder
   * apart. Paired over a hundred seeds: **Boss 54/100 down to 24/100**, 38
   * seeds losing it against 8 gaining, and $1.29M off the estate. More than
   * half the top of the game, to price one habit.
   *
   * The rate was not wrong; it was being asked to do a job it was not tuned
   * for. `perFire` 2 settles a continuously-worked pair near 77 of 100, and
   * that figure was set against a *standing order* — a fixed, published
   * arrangement anybody can set a watch by, that the player opted into and can
   * move. A boss turning up himself is the same street and less of a timetable,
   * and it is not something he opted into at all.
   *
   * 0.8 settles at `0.8 / decayShare` = 31, which is the smallest figure that
   * clears `noticeAbove` — below 25 the game does not mention it, and an
   * invisible price is the exact failure recorded on `perFire` above. At 31 it
   * is worth about 19 points of odds, which is close to what round 18's tester
   * actually met and reported as the fairest lesson in his run: *"They know the
   * routine −17%... a lesson delivered entirely through numbers I was shown
   * before I made the mistake."*
   */
  perFireByHand: 0.8,

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
   *
   * **Re-run after the per-day repair above, and every figure came back
   * identical to the digit.** That is not the reassurance it looks like. Every
   * automation arm in `ladder.probe` grinds a one-day job — `AUTO_PLUS` and
   * `AUTO_CYCLED` both settle on `corner_shakedown`, `AUTO` on `burglary_run`
   * — so the probe did not confirm the repair, it was blind to it, which is
   * precisely why nothing moved.
   *
   * What verifies the repair is the plateau table under `perFire` and two
   * tests in `__tests__/standingOrders.test.ts`. That is deliberately not
   * treated as a gap to be filled with another arm: the paired estate has now
   * failed to price a mechanic three separate times in that file, while "where
   * does the groove settle on a three-day job" is a quantity this mechanic
   * moves on purpose and reads to one decimal place. Same reasoning that put
   * `crewSkill.floor` behind the teaching bar rather than the estate.
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
