/**
 * Somebody buys a piece of you.
 *
 * F15 is the top-ranked open finding and it is a fun problem before it is a
 * balance one. 25 of 36 careers end under $48,000 holding one front; 11 hold
 * seven and run away with it. **34 of 36 are held by the money line.** Round 15
 * put it plainly: they *"stalled on capital, not on rank"*, and then played
 * another 145 days of a run that had already been decided.
 *
 * A game that forks by day 60 and continues for 240 more is the definition of
 * round 14's complaint — *"grinding a position I could not win"*. What was
 * missing is not money. It is a **decision available to somebody who has
 * none**, which is exactly when this game currently offers nothing.
 *
 * ## Why not the lender
 *
 * There are already three of them in `config/market.ts`, and one lends against
 * nothing. They do not solve this, for a reason that is easy to miss: a loan
 * has to be **serviced**. `REPAYMENT_SHARE` comes off every payday whether or
 * not the week earned anything, and a boss with no income cannot carry that —
 * borrowing while broke buys three weeks and a collections problem. The shark
 * is a tool for a liquidity gap, not for a career that has stalled.
 *
 * So this is equity, not debt. No schedule, no default, nobody sent to the
 * restaurant. They take a share of what comes in, and if nothing comes in they
 * take a share of nothing. That is the difference that makes it reachable from
 * the bottom.
 *
 * ## Why a rival, and not an investor
 *
 * An anonymous backer would be a menu item. A rival family is a **relationship
 * you now have to live inside**: they will not move against you while they own
 * a piece of you, which is genuinely useful, and every dollar you make makes
 * them stronger, which is genuinely bad. It also gives F5 something to do —
 * the families currently do nothing a player notices.
 *
 * The buy-out is the whole arc. You take the deal at your lowest, you carry it
 * for a hundred days, and then one day you can afford to be free of it. That
 * is a better shape than any amount of money would have been.
 */

export const PARTNER = {
  /**
   * Total funds below which somebody comes calling.
   *
   * Deliberately low, and confirmed against a plot rather than left as an
   * intuition. Measured at day 300 over 24 careers played by a bot that
   * actually launches jobs:
   *
   *     funds on hand   p10 $15   median $1,610   p75 $10,788   p90 $18,284
   *     grew under $10,000 across days 150 to 300 ....... 22 of 24
   *     fronts held ...................... 0 in 17, 1 in 7, 2+ in none
   *
   * The median career is *below* this line at day 300, and nearly all of them
   * are flat for the second half of the run. That is who this is for. An
   * earlier reading put every career at exactly $2,500 with no fronts, which
   * looked like a plateau and was `runDaysSolvent` never launching a job at
   * all — F7 in the measuring instrument, caught only because $2,500 is the
   * starting balance.
   */
  offerBelow: 1_800,

  /**
   * No offers in the first month.
   *
   * Everybody is broke on day 3, and being broke on day 3 is the game working.
   * An offer that early would read as the game apologising for its own opening,
   * which is the part that scores 9.
   */
  notBeforeDay: 30,

  /** What they put in, before the price index. */
  stake: 30_000,

  /**
   * Their permanent share of criminal income.
   *
   * High enough to be felt on every job — the cut is reported by name in the
   * log, so this is a number the player watches leave — and low enough that
   * working is still clearly better than not. Below about 0.1 it becomes a
   * rounding error nobody minds, which would make the buy-out pointless.
   */
  share: 0.12,

  /** What it costs to end it early: this multiple of the original stake. */
  buyoutMultiple: 2.0,

  /**
   * They stop taking once they have had this multiple of the stake, and the
   * arrangement ends by itself.
   *
   * Added after measuring, and the measurement is the reason it exists. A
   * permanent share read well and scored badly: `scorecard.probe` put Pacing
   * at **2.5 against a bar of 3**, with the mean longest quiet stretch out
   * from 413 days to 535. The count of careers reaching Capo went *up* — 19
   * to 22 — so the deal was doing its job at the bottom and then charging for
   * it forever, and the flat stretch between milestones is precisely round
   * 14's complaint. A comeback lane that lengthens the grind is not one.
   *
   * Bounded, the drag has an end a player can see coming. It also gives the
   * buy-out something to be: at 2.0 it costs $60,000 to walk away from a debt
   * that would otherwise take $90,000 out of you slowly. Paying early saves a
   * third, and waiting is a real alternative rather than a mistake.
   */
  endsAtMultiple: 3.0,

  /**
   * They take nothing from a job smaller than this.
   *
   * The second correction from the same measurement, and the one that
   * actually worked. Bounding their total take moved Pacing 2.5 to 2.6 and
   * changed nothing, because the ceiling only binds on a career that is
   * already earning — and the careers dragging the reading were the ones
   * scraping. The drag was never the size of the cut. It was that the cut
   * applied at the bottom, to a boss running `work_it_yourself` for $300 a
   * day, which is the exact position this feature exists to rescue.
   *
   * Above the floor, on real work, they take their share. Below it they take
   * nothing at all, so the arrangement is weightless precisely while you are
   * struggling and only bites once you are not. $800 clears every job a
   * destitute career can actually field.
   */
  takesNothingBelow: 800,

  /** After a refusal, they do not ask again for this long. */
  refusalCooldownDays: 120,

  /**
   * They will not move against you while they hold a piece.
   *
   * Applied as a floor on their bond rather than as a special case in the
   * diplomacy AI, so everything downstream of the bond gets it for free.
   */
  protectionTrust: 45,
} as const;
