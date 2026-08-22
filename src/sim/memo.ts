/**
 * The five things every memo needs to say a price.
 *
 * These lived inside `events.ts` until the generative half was built, and they
 * had to come out of it for a plain reason: `eventgen.ts` writes memos too, and
 * a second copy of `payable` is exactly the drift these helpers exist to stop.
 * The comment on `shortOf` already records the last time the words "You cannot
 * cover it" were written thirteen times across the sim and one copy quietly
 * dropped its figure.
 *
 * One module, imported by both. No behaviour changed in the move.
 */

import type { Rng } from './rng';
import { totalFunds } from './economy';
import type { GameState } from './types';

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * One of several ways of saying the same thing.
 *
 * The events that fire most often are on ten-to-fifteen day cooldowns, which
 * over a long game means the same paragraph six or seven times with only a
 * figure changed — a playtester could recite the opening line of the recruit
 * offer by their second run, and said so. The mechanics were fine; the seam
 * was that the prose was a constant.
 *
 * Drawn from the same seeded stream as everything else, so a reloaded save
 * tells the same story rather than a differently-worded one. Variants must be
 * interchangeable: same facts, same choices, same consequences, different
 * mouth.
 */
export function oneOf(rng: Rng, lines: string[]): string {
  return rng.pick(lines);
}

/**
 * An asking price the player could conceivably meet.
 *
 * Offers used to be priced off standing alone, which is a reasonable measure
 * of what somebody thinks you are worth and a terrible measure of what is in
 * the safe. A playtester was shown the same opportunity at $8,154, then
 * $19,078, then $19,842, while holding a four-figure balance the whole time —
 * three pop-ups, three guaranteed declines, no decision in any of them.
 *
 * So the ask is bounded by what is actually on hand. The share is the tuning:
 * at four fifths the balance probe's greedy player, which accepts everything
 * it can afford, started dying a year early — it could stake almost the whole
 * treasury on a coin flip every fortnight. Under half leaves the choice
 * genuinely expensive without being able to end a run on its own. The floor
 * keeps it from degenerating into a trivial offer when broke; below that the
 * man simply does not come.
 */
export function askable(state: GameState, ideal: number, floor: number): number {
  const ceiling = Math.round(totalFunds(state) * 0.45);
  return Math.max(floor, Math.min(ideal, Math.max(floor, ceiling)));
}

// ---------------------------------------------------------- definitions ----

/**
 * A choice that costs money, with its price and its guard in one place.
 *
 * Twelve memo choices quoted a price. One of them checked whether the player
 * could pay it — the front purchase, which had been guarded after an earlier
 * playtester marked the unexplained failure as the game's worst moment. The
 * other eleven rendered enabled at any balance, took the click, failed inside
 * `spend`, logged a line and consumed the memo.
 *
 * Round 8 found it on the one that matters most: $12,000 to buy back a
 * neighbourhood is the only repair for a district that has turned against you,
 * and a boss holding $10,698 could spend the memo on it and get nothing back.
 *
 * Returning both fields together is the whole point. A hint and a guard
 * written as separate lines drift apart the moment somebody adds a thirteenth
 * choice, which is exactly how eleven of them came to be wrong.
 */
/*
   A priced option, and what it says when you cannot afford it.

   `disabledReason` used to be the bare words "You cannot cover it", and
   `MemoModal` renders the refusal in place of the hint — so the price went to
   the hint, the hint was replaced, and the figure vanished at exactly the
   moment it decided something. Round 14 hit it five times across four memo
   families and read the DOM to prove the number was not there: "being poor is
   the state where you most need to know whether you are $50 short or $20,000
   short, because that decides whether you sell an asset or give up."

   The refusal now names what is in hand, and the hint beside it still names
   the price, which the panel keeps on screen rather than replacing. Between
   them the player has both halves of the subtraction.

   `totalFunds` rather than `state.org.cash`, because that is what the check
   above compares against — a refusal quoting a different pot than the guard
   would be a new way to be confusing.
*/
/*
   The refusal half of `payable`, for choices that build their own label.

   The same three lines were written out eight times in this file and the words
   "You cannot cover it" thirteen times across the sim. Copies drift: round 14
   found the memo version silently dropping its figure while the sit-down
   version four files away said "You have not got $4,000" and had always been
   right. One helper, so the next fix lands everywhere at once.
*/
export function shortOf(state: GameState, amount: number): string | undefined {
  const inHand = totalFunds(state);
  return inHand < amount ? `You have ${money(inHand)}` : undefined;
}

export function payable(
  state: GameState,
  amount: number,
  note: string,
): { hint: string; disabledReason: string | undefined; cost: number } {
  const inHand = totalFunds(state);
  return {
    hint: `${money(amount)} — ${note}`,
    disabledReason: inHand < amount ? `You have ${money(inHand)}` : undefined,
    cost: amount,
  };
}
