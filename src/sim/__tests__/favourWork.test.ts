/**
 * Asking the people who owe you for money instead of for protection.
 *
 * This is the redesign of the connected jobs, and it exists because the first
 * version measured as a lie. Four operations opened on `owed >= 1`, which is
 * cleared by **24 of 24 careers by day 150** — a timer wearing a relationship
 * as a costume. Plotting first, which is what should have happened:
 *
 *     favours granted over 300 days    mean 6.0, all 36 careers reach 6
 *     favours held at day 300          mean 6.0 — identical, none ever spent
 *
 * The favour network accrues to near its ceiling in every career and nothing
 * ever spends it. So the problem was never a missing lock. It was an idle
 * currency, and the fix is a second thing to buy with it.
 *
 * ## Why the price is standing and not the favour
 *
 * Because favours are pegged at the cap, consuming one is free — regeneration
 * covers it, and a cost nobody feels is not a cost. The price has to be the
 * relationship. Standing measured at day 300 across all figures:
 *
 *     p25 4    median 24    p75 34    p90 39    max 97
 *
 * Against a median of 24, a hit of 9 is better than a third of the typical
 * relationship. That is the trade: take the money tonight, or keep the judge
 * for the case that is coming for you.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { askForWork, canAskForWork, figure } from '../civic';
import { CIVIC, CIVIC_WORK } from '../../config/civic';
import { totalFunds } from '../economy';
import type { GameState } from '../types';

/** Somebody who owes you one and will take the meeting. */
function connected(id = 'union', seed = 9): GameState {
  const state = newGame({ name: 'Nobody', difficulty: 'normal', seed });
  // The judge wants Influence before taking a meeting at all, so the fixture
  // has to clear that gate too or the refusal under test is the wrong one.
  state.player.attributes.influence = 12;
  const held = figure(state, id);
  held.standing = 60;
  held.owed = 1;
  return state;
}

describe('asking for work', () => {
  it('pays', () => {
    const state = connected();
    const before = totalFunds(state);
    const result = askForWork(state, 'union');
    expect(result.ok, result.message).toBe(true);
    expect(totalFunds(state), 'the meeting happened and no money moved').toBeGreaterThan(before);
  });

  it('spends the favour', () => {
    const state = connected();
    askForWork(state, 'union');
    expect(figure(state, 'union').owed, 'the favour survived being called in').toBe(0);
  });

  it('costs standing with the person you asked', () => {
    /*
       The load-bearing test. Without this the whole thing is free money on a
       timer, which is exactly what the version this replaces turned out to be.
    */
    const state = connected();
    const before = figure(state, 'union').standing;
    askForWork(state, 'union');
    expect(
      before - figure(state, 'union').standing,
      'asking a man for money cost you nothing with him',
    ).toBeCloseTo(CIVIC_WORK.standingCost, 5);
  });

  it('costs enough to be a real trade against a typical relationship', () => {
    // Measured: standing across figures runs p25 4, median 24, p75 34. A cost
    // that rounds to nothing against the median is a cost nobody weighs.
    expect(CIVIC_WORK.standingCost).toBeGreaterThanOrEqual(6);
  });

  it('does not touch anybody else', () => {
    const state = connected();
    const judgeBefore = figure(state, 'judge').standing;
    askForWork(state, 'union');
    expect(figure(state, 'judge').standing).toBe(judgeBefore);
  });
});

describe('when it refuses', () => {
  it('refuses when they owe you nothing, and says so', () => {
    const state = connected();
    figure(state, 'union').owed = 0;
    const check = canAskForWork(state, 'union');
    expect(check.ok).toBe(false);
    expect(check.reason, 'a refusal with no reason is F10 again').toBeTruthy();
  });

  it('refuses a stranger', () => {
    const state = connected();
    figure(state, 'union').standing = CIVIC.coldBelow - 1;
    expect(canAskForWork(state, 'union').ok).toBe(false);
  });

  it('refuses somebody who does not exist', () => {
    expect(canAskForWork(connected(), 'nobody-at-all').ok).toBe(false);
  });

  it('changes nothing when it refuses', () => {
    const state = connected();
    figure(state, 'union').owed = 0;
    const before = { funds: totalFunds(state), standing: figure(state, 'union').standing };
    const result = askForWork(state, 'union');
    expect(result.ok).toBe(false);
    expect(totalFunds(state)).toBe(before.funds);
    expect(figure(state, 'union').standing).toBe(before.standing);
  });
});

describe('the competition, which is the point', () => {
  it('leaves nothing to bury a case with', () => {
    /*
       One favour, two uses. Spending it on work has to make the protective
       use unavailable, or this is not a decision — it is a second free thing.
    */
    const state = connected('judge');
    expect(figure(state, 'judge').owed).toBe(1);
    askForWork(state, 'judge');
    expect(
      figure(state, 'judge').owed,
      'the judge paid you and still owes you the case',
    ).toBe(0);
  });

  it('cannot be asked twice off one favour', () => {
    const state = connected();
    expect(askForWork(state, 'union').ok).toBe(true);
    expect(askForWork(state, 'union').ok, 'one favour paid out twice').toBe(false);
  });
});
