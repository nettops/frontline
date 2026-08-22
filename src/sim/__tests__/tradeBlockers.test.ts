/**
 * The panel headed "What is stopping you" has to name what is stopping you.
 *
 * Round 11 opened the product trade on day 220 and it earned $73,745 in its
 * first week — more than every job in the preceding 220 days put together. By
 * day 250 it earned nothing, and the panel said: streets 12, what your free
 * people could carry 99, "You have more people than ground."
 *
 * Streets and people were identical on the day it worked and the day it did
 * not. The variable was cash: at $719 the family could not buy a $2,263 load.
 * Three days later, after selling the put-away holding, the same 12 streets and
 * the same 99 carriers moved 8 loads for $50,399.
 *
 * The buying constraint was already computed every week inside `tickContraband`
 * and thrown away. This exposes it, so the panel can stop blaming the player
 * for the wrong thing.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { readTrade, unitCost } from '../contraband';

describe('what is stopping you', () => {
  it('reports how many loads the family can actually pay for', () => {
    const state = newGame({ name: 'Trade', difficulty: 'normal', seed: 5 });
    const price = unitCost(state, 'product');

    state.org.cash = price * 3;
    state.org.dirtyCash = 0;
    expect(readTrade(state, 'product').affordable).toBe(3);

    state.org.cash = 0;
    expect(readTrade(state, 'product').affordable).toBe(0);
  });

  it('counts dirty money, because that is what pays for it', () => {
    const state = newGame({ name: 'Trade', difficulty: 'normal', seed: 5 });
    const price = unitCost(state, 'product');

    state.org.cash = 0;
    state.org.dirtyCash = price * 2;
    expect(readTrade(state, 'product').affordable).toBe(2);
  });

  it('names money as the binding constraint when it is the smallest of the three', () => {
    const state = newGame({ name: 'Trade', difficulty: 'normal', seed: 5 });
    state.org.cash = 0;
    state.org.dirtyCash = 0;

    const read = readTrade(state, 'product');
    // Round 11's day-250 state: ground and carriers were fine, money was not.
    expect(read.affordable).toBe(0);
    expect(read.affordable).toBeLessThanOrEqual(read.capacity.total);
  });
});
