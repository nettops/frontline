/**
 * When the Underboss quietly handles something instead of it reaching the
 * Boss at all.
 *
 * `officers.ts` already reads what the Underboss makes of a given man
 * (`underbossOpinion`) and how solid his own seat is (`underbossStanding`).
 * This is the threshold for a third, narrower question `events.ts`'s
 * `capo_political_tension` asks of him directly: is this specific man's own
 * tie to the Underboss good enough, and the Underboss himself competent
 * enough, that he would field this before it ever became the Boss's problem.
 */

import { TIE_DEPARTURE } from './ties';

export const UNDERBOSS_FILTER = {
  /**
   * Trust the weaker capo needs in the Underboss before the Underboss's
   * quiet handling reads as welcome rather than as being managed. Reuses
   * `TIE_DEPARTURE.followTrustAbove` rather than inventing a second "decent
   * trust" number — it is already the measured ceiling real play produces
   * (two years of the same men on the same jobs topped out at 42), so it is
   * the same "this man's opinion actually counts for something" line
   * `followDeparture` already draws.
   */
  trustAbove: TIE_DEPARTURE.followTrustAbove,

  /**
   * Resentment on that same tie has to stay under this before it reads as
   * ordinary rather than a real grudge. `TIE_EVENTS.lost_the_room` — the
   * exact cause this event's own pair is built from — writes 30 in one
   * stroke, so 30 is where a tie stops being "hasn't had reason to trust him
   * yet" and starts being "has a reason not to."
   */
  resentmentBelow: 30,

  /**
   * The Underboss's own raw `leadership`, centred on 50 the way every stat in
   * this game is (`officers.ts`'s own comment on `OFFICER_BIAS_PULL` reads
   * off the identical centring). Below the middle of the range, he is not
   * the man you'd trust to field this quietly — the plain event stands.
   */
  leadershipAbove: 50,
} as const;
