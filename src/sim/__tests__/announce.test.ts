/**
 * A status the player believes they hold, quietly untrue.
 *
 * Round 19's tester reached Crime Lord on day 147. By day 300 two of his men
 * had been arrested, the rank had gone with them, and the Overview read *Boss ·
 * Crime Lord wants 2 more bodies on the books* — with no log entry, no memo and
 * no badge. He found it by chance and filed it as the round's only MUST FIX:
 * *"the log has no entry for the demotion at all, while it logs everything else
 * down to a single failed job."*
 *
 * The same round lost the entire trade to the other half of the same fault. He
 * met it on day 114 two fronts short, bought fronts later for unrelated
 * reasons, and *"nothing on screen reminded me it had opened, so I never went
 * back."*
 *
 * Both are consequences of deriving rather than storing, which is right and is
 * staying: `rankNow` reads the same board the job table gates on, so what you
 * are called and what you may do cannot come apart. A derived value simply has
 * no moment of change to hang a message on, and this is that moment.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDay } from '../clock';
import { rankNow } from '../rank';
import { tradeUnlocked } from '../contraband';
import { TRADES } from '../../config/contraband';
import { withFronts } from './helpers';
import type { GameState } from '../types';

function game(seed = 7): GameState {
  return newGame({ name: 'Said', difficulty: 'normal', seed });
}

function seated(seed = 7): GameState {
  return newGame({
    name: 'Said',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
}

/** Log lines added by one day, newest first. */
function dayOf(state: GameState): string[] {
  const before = state.log[0];
  advanceDay(state);
  const at = before ? state.log.indexOf(before) : state.log.length;
  return state.log.slice(0, at === -1 ? state.log.length : at).map((l) => l.text);
}

describe('what the game says about you', () => {
  it('says nothing on the first day, because you are what you were', () => {
    const state = game();
    const said = dayOf(state);
    expect(said.some((t) => /calling you/i.test(t))).toBe(false);
    expect(state.org.rankSaid).toBe(rankNow(state).id);
  });

  it('says so when the name changes', () => {
    const state = seated(11);
    withFronts(state, 3);
    advanceDay(state);
    const climbed = rankNow(state);
    expect(climbed.id, 'the fixture never left the bottom rung, so a rise is unmeasurable')
      .not.toBe('street_criminal');

    // Put them somewhere else on the ladder without touching the announcer.
    state.org.rankSaid = 'street_criminal';
    const said = dayOf(state);

    expect(said.join(' '), 'a rank rise went unremarked').toMatch(
      new RegExp(`calling you ${climbed.name}`, 'i'),
    );
    expect(state.org.rankSaid).toBe(climbed.id);
  });

  it('and says so going down, which is the half that was missing', () => {
    /*
       The tester's exact case. `rank.ts` is explicit that rank falls — "lose
       two districts and you are what you are now, not what you were in June" —
       so a version that only announced rises would be a trophy cabinet with
       the losses filed somewhere else.
    */
    const state = seated(12);
    advanceDay(state);
    const held = rankNow(state);

    // Claim they were higher than they are, and let the day catch up.
    state.org.rankSaid = 'crime_lord';
    const said = dayOf(state);

    expect(said.join(' ')).toMatch(/stopped calling you Crime Lord/i);
    expect(said.join(' ')).toMatch(new RegExp(`${held.name} again`, 'i'));
  });
});

describe('a door that opened while you were looking elsewhere', () => {
  it('says the trade is reachable on the day it becomes reachable', () => {
    const state = seated(21);
    // Below the bar, and marked as such, which is where a career starts.
    advanceDay(state);
    expect(tradeUnlocked(state, 'product')).toBe(false);
    expect(state.org.tradeSaid?.product).toBe(false);

    withFronts(state, TRADES.product.minFronts);
    const said = dayOf(state);

    expect(tradeUnlocked(state, 'product')).toBe(true);
    expect(said.join(' '), 'the gate lifted and nothing said so').toMatch(
      new RegExp(TRADES.product.name, 'i'),
    );
  });

  it('says it once, not every day after', () => {
    // A standing reminder that something is available is a nag.
    const state = seated(22);
    advanceDay(state);
    withFronts(state, TRADES.product.minFronts);
    const opened = dayOf(state);
    expect(opened.join(' ')).toMatch(new RegExp(TRADES.product.name, 'i'));

    for (let i = 0; i < 5; i++) {
      expect(dayOf(state).join(' ')).not.toMatch(new RegExp(TRADES.product.name, 'i'));
    }
  });
});
