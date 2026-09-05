/**
 * Things that changed on their own, and were never said out loud.
 *
 * Round 19's tester reached Crime Lord on day 147, and by day 300 the Overview
 * quietly read *Boss · Crime Lord wants 2 more bodies on the books.* Two men
 * had been arrested; the rank had gone with them; nothing announced it. He
 * found it by chance re-opening a panel he had no reason to re-open, and filed
 * it as the round's only MUST FIX:
 *
 *   > "The log has no entry for the demotion at all, while it logs everything
 *   > else down to a single failed job. A status the player believes they
 *   > hold, quietly untrue."
 *
 * The same round lost the whole trade to the other half of it. He met it on
 * day 114 two fronts short, bought fronts over the following weeks for
 * unrelated reasons, and *"nothing on screen reminded me it had opened, so I
 * never went back."* A gate that lifts in silence is a feature the player has
 * paid for and does not know they own.
 *
 * Both are the same fault and it is a consequence of how this game is built.
 * Rank and the trade gates are *derived* — `rankNow` reads the same board the
 * job table gates on, `tradeUnlocked` counts fronts — which is right, and is
 * why neither could drift out of step with what the player can actually do.
 * But a derived value has no moment of change to hang a message on. Nothing
 * assigns it, so nothing can announce it.
 *
 * So this remembers what was last said, and says it again when it stops being
 * true. One optional field per thing announced, lazily initialised, so an old
 * save reads as an outfit nobody has told anything yet and settles on its
 * first tick.
 *
 * The rule it serves is the project's third: everything the player sees is
 * true, and a rank on a panel is something the player sees.
 */
import type { GameState, RankId } from './types';
import { addLog } from './util';
import { rankNow } from './rank';
import { tradeUnlocked } from './contraband';
import { TRADES, TRADE_IDS } from '../config/contraband';
import { RANKS, rankIndex } from '../config/economy';

export function tickAnnouncements(state: GameState): void {
  announceRank(state);
  announceTrades(state);
}

/**
 * What people call you, when it changes in either direction.
 *
 * Deliberately both ways. `rank.ts` says it in as many words — *"lose two
 * districts and you are what you are now, not what you were in June"* — and a
 * derived rank that only ever announced its rises would be a trophy cabinet
 * with the losses filed somewhere else.
 *
 * The first tick of a career sets the mark without saying anything, because a
 * street criminal being told he is a street criminal is not news.
 */
function announceRank(state: GameState): void {
  const now = rankNow(state);
  const said = state.org.rankSaid;
  if (said === undefined) {
    state.org.rankSaid = now.id;
    return;
  }
  if (said === now.id) return;

  const wasAbove = rankIndex(said) > rankIndex(now.id);
  state.org.rankSaid = now.id;
  addLog(
    state,
    wasAbove
      ? `People have stopped calling you ${nameFor(said)}. You are ${now.name} again.`
      : `They are calling you ${now.name} now.`,
    wasAbove ? 'failure' : 'success',
  );
}

/**
 * And a door that opened while you were looking somewhere else.
 *
 * Said once, on the tick it opens, and never again — a standing reminder that
 * something is available is a nag, and this game does not nag. If it closes
 * again the mark resets, so re-opening it says so a second time, which is
 * correct: the second opening is as much news as the first.
 */
function announceTrades(state: GameState): void {
  for (const trade of TRADE_IDS) {
    const open = tradeUnlocked(state, trade);
    const said = state.org.tradeSaid?.[trade];
    if (said === open) continue;
    state.org.tradeSaid = { ...(state.org.tradeSaid ?? {}), [trade]: open };
    // Opening is news. Closing is a consequence of something else that was
    // already reported — a front shutting says so itself — so it is recorded
    // silently and only resets the mark.
    if (!open || said === undefined) continue;
    addLog(
      state,
      `You have the premises for ${TRADES[trade].name} now. Somebody would deal with you.`,
      'success',
    );
  }
}

function nameFor(id: RankId): string {
  return RANKS.find((r) => r.id === id)?.name ?? id;
}
