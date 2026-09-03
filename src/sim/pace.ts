/**
 * Whether a memo is worth interrupting a month for.
 *
 * `advanceDays` stops on the first new memo, which is right: a memo is a
 * question, and answering it a week late answers a different question. The
 * cost of that rule turns out to be the whole late game. Memos arrive on a
 * flat schedule of roughly one every four days — measured over six 450-day
 * careers at crew sizes 1, 8 and 18, which barely moves it: 0.20 to 0.25 a day
 * at every stage and every size. So asking for a month gets you four days, and
 * then four more, and a blind tester wrote:
 *
 *   > "Between days 180 and 300 I was stopped roughly every 1-2 game days, and
 *   > a '+1 month' advance almost never delivered more than 5 days... By day
 *   > 400 I was answering them without reading them, which is the failure
 *   > state for a game whose best writing is in its memos."
 *
 * His rate was an impression and the instrument disagrees with it; his second
 * sentence is exactly what one-every-four-days produces, and the third is the
 * real damage. The repair is not fewer memos — there are 23 distinct ones and
 * the most common is 12% of the queue — it is that answering one should not
 * also cancel what you were doing.
 *
 * So the advance resumes by itself once the question is answered, and stops
 * dead only for `danger`. The line is there because of where the memos
 * actually fall — measured over six 450-day careers at eighteen men, 637
 * raisings:
 *
 *     warning      43%    crew_dispute · gen_wants_a_word · shakedown_demand
 *                         respect_challenge · promotion_demand
 *     opportunity  43%
 *     info         12%
 *     danger        2%    police_sweep · plea_offer · arrest_pressure
 *                         gen_somebody_inside · rival_incursion
 *                         gen_paper_moving
 *
 * Drawing it above `warning` was the first attempt and it took a thirty-day
 * request from 2.8 days to 8.5 — better and still not a month, because the
 * warnings are 43% of everything and none of them is a thing you would stop a
 * month for. A man asking for a word, two of them not speaking, somebody
 * wanting a promotion: you answer it and there is nothing further to do. The
 * six dangers are the ones where there is: a sweep, a plea, a man in a cell,
 * a rival on your ground. Those still end the span, and they are 2% of the
 * queue, so a month is a month and the six things that change your situation
 * still stop it dead.
 */
import type { EventSeverity } from './types';

export function carriesOn(severity: EventSeverity): boolean {
  return severity !== 'danger';
}
