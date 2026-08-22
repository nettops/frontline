/**
 * Money put somewhere it cannot be spent.
 *
 * The mechanic exists because a career earns $189,469 of clean money over four
 * years, needs $45,000 of it in one place to make Capo, and peaks at $28,711 —
 * the clean pool is what every cost falls back on once dirty runs out, so the
 * savings were being spent on the next job before they could ever be a hoard.
 *
 * What these check is the trade rather than the plumbing: it counts for rank,
 * it pays for nothing, and getting it back costs something.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { cleanWorth, putAway, spend, takeBack, totalFunds } from '../economy';
import { rankRequirements } from '../player';
import { HOLDINGS } from '../../config/economy';
import type { GameState } from '../types';

function world(): GameState {
  const state = newGame({ name: 'Holdings', difficulty: 'normal', seed: 4 });
  state.org.cash = 50_000;
  state.org.dirtyCash = 0;
  return state;
}

describe('putting money away', () => {
  it('moves it out of the wallet without losing any of it', () => {
    const state = world();
    expect(putAway(state, 20_000).ok).toBe(true);
    expect(state.org.cash).toBe(30_000);
    expect(state.org.holdings).toBe(20_000);
    expect(cleanWorth(state)).toBe(50_000);
  });

  it('refuses paperwork nobody would do', () => {
    const state = world();
    expect(putAway(state, HOLDINGS.minimum - 1).ok).toBe(false);
    expect(state.org.holdings ?? 0).toBe(0);
  });

  it('refuses to put away money that is not there', () => {
    const state = world();
    expect(putAway(state, 60_000).ok).toBe(false);
    expect(state.org.cash).toBe(50_000);
  });

  /*
     The whole point, and the thing that makes it a decision.

     If holdings could be spent this would be a label rather than a mechanic.
     A boss who banks his Capo money has to find the lawyer's fee somewhere
     else, and `totalFunds` is what every affordability check in the game
     reads.
  */
  it('cannot be spent on anything', () => {
    const state = world();
    putAway(state, 45_000);
    expect(totalFunds(state)).toBe(5_000);
    expect(spend(state, 10_000)).toBe(false);
    expect(state.org.holdings).toBe(45_000);
  });

  it('still counts as standing when the table asks', () => {
    const state = world();
    const before = rankRequirements(state).find((r) => r.label === 'Clean money');
    putAway(state, 45_000);
    const after = rankRequirements(state).find((r) => r.label === 'Clean money');
    expect(after?.current).toBe(before?.current);
  });
});

describe('taking it back', () => {
  it('returns less than went in, because selling in a hurry is not selling well', () => {
    const state = world();
    putAway(state, 20_000);
    expect(takeBack(state, 20_000).ok).toBe(true);
    expect(state.org.holdings).toBe(0);
    expect(state.org.cash).toBe(30_000 + Math.floor(20_000 * HOLDINGS.withdrawReturn));
    expect(cleanWorth(state)).toBeLessThan(50_000);
  });

  it('refuses to sell what is not there', () => {
    const state = world();
    putAway(state, 5_000);
    expect(takeBack(state, 6_000).ok).toBe(false);
    expect(state.org.holdings).toBe(5_000);
  });
});
