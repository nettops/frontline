/**
 * `payRead` is supposed to say whether a man thinks he is paid enough, read
 * through the fog. It grew its own approximation of `wageExpectation`
 * instead of calling the real one — no price indexation, no trait effects —
 * so a wage that keeps pace with inflation can still read as "paid well"
 * while the man himself, by the game's own real math, thinks he is worth
 * more. This is the drift `wageExpectation`'s own callers elsewhere
 * (`loyaltyPressures` in `sim/npc.ts`) already avoid by calling the real
 * function once greed is known, rather than re-deriving it from the banded
 * perceived value.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/state';
import { crewList, wageExpectation } from '../../sim/npc';
import { payRead } from '../components';

function seated(seed = 1) {
  return newGame({
    name: 'PayRead',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
}

describe('how pay reads through the fog', () => {
  it('says nothing about a stranger', () => {
    const state = seated(2);
    const npc = crewList(state)[0];
    npc.familiarity = 0;
    expect(payRead(state, npc).tone).toBe('faint');
  });

  it('tracks the real wage expectation, not a fixed-price approximation of it', () => {
    const state = seated(3);
    const npc = crewList(state)[0];
    npc.familiarity = 90;
    npc.stats.greed = 80;
    // Prices have tripled since day one — the real expectation moves with
    // them (`DRIFT.wageIndexation`); a stale approximation anchored to the
    // nominal role wage does not.
    state.market.prices = 3;
    // Paid to 80% of what he actually expects today: a man who should read
    // as wanting more, not as paid well.
    npc.wage = Math.round(wageExpectation(state, npc) * 0.8);

    expect(payRead(state, npc).tone).not.toBe('good');
  });

  it('still reads well once actually paid above the real expectation', () => {
    const state = seated(4);
    const npc = crewList(state)[0];
    npc.familiarity = 90;
    npc.stats.greed = 80;
    state.market.prices = 3;
    npc.wage = Math.round(wageExpectation(state, npc) * 1.3);

    expect(payRead(state, npc).tone).toBe('good');
  });
});
