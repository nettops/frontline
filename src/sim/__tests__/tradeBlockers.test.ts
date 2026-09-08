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
import { openRoute, openSupply, readTrade, unitCost } from '../contraband';
import { controlledTerritories } from '../territory';
import { TRADES } from '../../config/contraband';
import { withFronts } from './helpers';
import { crewList } from '../npc';

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

/*
 * Round 18 reproduced the same fault twice more, in both directions, on a
 * career that had money.
 *
 * Day 45: two fronts, a route open in Little Sicily whose button read "Stop",
 * and every one of six men on a standing order. The panel said *"Nothing can
 * move. Open a route in one of the districts below."* It had displayed
 * "WHAT YOUR FREE PEOPLE COULD CARRY: 0" two lines above the sentence
 * contradicting it: the message was inferred from `capacity.total`, which is
 * `min(routes, crew)`, so a zero on the people side reported as a shortage of
 * streets.
 *
 * Days 138 and 140: route open, money in hand, and no supply arrangement. The
 * panel said *"Money is the short end."* Nothing on the screen had any word
 * for a supplier, and the $40,314 retainer that was the actual gate appeared
 * only in the refusal text of a button that looked disabled. That cost roughly
 * ninety days of a three-hundred-day career.
 */
describe('and names the right one', () => {
  const seated = (seed: number) =>
    newGame({
      name: 'Trade',
      difficulty: 'normal',
      mode: 'sandbox' as const,
      sandboxStart: 'seated' as const,
      seed,
    });

  /** Fronts, a district, and a route open in it. */
  function running(seed: number) {
    const state = seated(seed);
    withFronts(state, TRADES.product.minFronts);
    const t = controlledTerritories(state)[0];
    openRoute(state, 'product', t.id);
    state.org.cash = 500_000;
    state.org.dirtyCash = 0;
    return state;
  }

  it('does not tell you to open a route you have open', () => {
    const state = running(400);
    openSupply(state, 'dockside');
    for (const npc of crewList(state)) npc.status = 'busy';

    const read = readTrade(state, 'product');
    expect(read.capacity.crew).toBe(0);
    expect(read.routes.length).toBeGreaterThan(0);
    expect(read.blocker?.id).toBe('people');
    expect(read.blocker?.sentence).not.toMatch(/open a route/i);
  });

  it('names the supplier, and the retainer, before it blames the money', () => {
    const state = running(401);
    // Everything a player could have except somebody to buy from.
    expect(readTrade(state, 'product').sourced).toBe(false);

    const read = readTrade(state, 'product');
    expect(read.affordable).toBeGreaterThan(0);
    expect(read.blocker?.id).toBe('source');
    expect(read.blocker?.sentence).toMatch(/supplying you/);
    // The figure itself, which is the thing there was no way to find.
    expect(read.blocker?.sentence).toMatch(/\$\d/);
    expect(read.blocker?.sentence).not.toMatch(/short end/);

    openSupply(state, 'dockside');
    expect(readTrade(state, 'product').sourced).toBe(true);
    expect(readTrade(state, 'product').blocker?.id).not.toBe('source');
  });

  it('still says money when money is what is missing', () => {
    const state = running(402);
    openSupply(state, 'dockside');
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    expect(readTrade(state, 'product').blocker?.id).toBe('money');
  });

  it('says the arms trade needs a shop or a freight agent, with both figures', () => {
    const state = seated(403);
    withFronts(state, TRADES.arms.minFronts);
    const t = controlledTerritories(state)[0];
    openRoute(state, 'arms', t.id);
    state.org.cash = 5_000_000;

    const read = readTrade(state, 'arms');
    expect(read.sourced).toBe(false);
    expect(read.blocker?.id).toBe('source');
    expect(read.blocker?.sentence).toMatch(/freight agent/);
    expect(read.blocker?.sentence).toMatch(/workshop/);
  });
});
