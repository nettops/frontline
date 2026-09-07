/**
 * The other standing bill.
 *
 * A front had a purchase price and, once bought, nothing at all to keep —
 * measured (2026-09-07, Opus diagnosis, F1/H1) as a career earning $5,354 per
 * crew-week on a $195 wage and never running out of money, because nothing it
 * owns costs anything to hold. `weeklyFrontUpkeep` prices ownership itself:
 * a share of what the fronts actually took, due on payday out of the same
 * treasury wages draw on — so it can go unpaid, same as wages, rather than
 * being netted off the top of a front's own earnings where it could never be
 * felt.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  acquireBusiness,
  ownedBusinesses,
  tickBusinesses,
  tickFrontUpkeep,
  weeklyFrontUpkeep,
} from '../business';
import { FRONT_UPKEEP_RATE, HEALTH } from '../../config/businesses';
import { HOME_TERRITORY } from '../../config/territories';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function funded(seed = 9): GameState {
  const state = newGame({ name: 'Upkeep', difficulty: 'normal', seed });
  state.territories[HOME_TERRITORY].influence.player = 60;
  for (const id of RIVAL_IDS) state.territories[HOME_TERRITORY].influence[id] = 0;
  state.org.cash = 500_000;
  state.org.dirtyCash = 0;
  return state;
}

// See pressure.test.ts's identical helper and its comment: `tickBusinesses`
// (and, here, `tickFrontUpkeep`) are gated on the calendar, and stepping by
// seven from a day-1 start never lands on a multiple of seven by accident.
function runWeeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / PAYDAY_INTERVAL) + 1) * PAYDAY_INTERVAL;
    tickBusinesses(state, new Rng(state.rng));
    tickFrontUpkeep(state);
  }
}

describe('front upkeep', () => {
  it('owning nothing costs nothing', () => {
    const state = funded();
    const before = state.org.cash;
    runWeeks(state, 4);
    expect(state.org.cash).toBe(before);
    expect(state.org.frontUpkeepOwed ?? 0).toBe(0);
  });

  it('charges a real share of what the fronts actually earned', () => {
    const state = funded();
    const bought = acquireBusiness(state, 'restaurant', HOME_TERRITORY);
    expect(bought, 'the setup could not buy a front').not.toBeNull();

    // Front revenue is put away into holdings (business.ts's own comment:
    // "put away rather than banked"), not paid into cash — so the bill this
    // test is checking draws from a different pool than the one the front
    // just filled. What it must equal is the drop in cash and dirty cash
    // taken together; the earned figure is only here to size the bill by.
    state.day = (Math.floor(state.day / PAYDAY_INTERVAL) + 1) * PAYDAY_INTERVAL;
    const before = state.org.cash + state.org.dirtyCash;
    const { revenue: earned } = tickBusinesses(state, new Rng(state.rng));
    const bill = weeklyFrontUpkeep(state);
    tickFrontUpkeep(state);

    expect(earned, 'the front earned nothing, so this measures nothing').toBeGreaterThan(0);
    /*
       Not exact equality against `earned * FRONT_UPKEEP_RATE`:
       `weeklyFrontUpkeep` reads `totalWeeklyRevenue` fresh, after
       `tickBusinesses` has already run — and that same tick can move a
       front's health, which is a term in the revenue formula. So the bill is
       a real share of a real week, not a stale share of the number this test
       happened to capture on the way in. A percent of drift either side of
       the naive figure is the health tick moving, not a bug.
    */
    expect(bill).toBeGreaterThan(0);
    expect(Math.abs(bill - earned * FRONT_UPKEEP_RATE) / bill).toBeLessThan(0.02);
    expect(state.org.cash + state.org.dirtyCash).toBe(before - bill);
    expect(state.org.frontUpkeepOwed ?? 0).toBe(0);
  });

  it('carries a shortfall rather than a cliff, and it costs the fronts their health', () => {
    const state = funded();
    const bought = acquireBusiness(state, 'restaurant', HOME_TERRITORY);
    expect(bought).not.toBeNull();
    const front = ownedBusinesses(state)[0];
    const startHealth = front.health ?? HEALTH.start;

    // Nothing to pay the bill with, on purpose — the fronts still earn (paid
    // into holdings via tickBusinesses' own path), but the general treasury
    // this bill draws on is empty.
    state.org.cash = 0;
    state.org.dirtyCash = 0;

    runWeeks(state, 1);

    expect(
      state.org.frontUpkeepOwed ?? 0,
      'a complete miss should carry the whole bill forward',
    ).toBeGreaterThan(0);
    expect(
      front.health ?? HEALTH.start,
      'a front nobody paid to keep up should not still be at full health',
    ).toBeLessThan(startHealth);
  });

  it('does not touch a front that is being kept up', () => {
    const state = funded();
    const bought = acquireBusiness(state, 'restaurant', HOME_TERRITORY);
    expect(bought).not.toBeNull();
    const front = ownedBusinesses(state)[0];
    const startHealth = front.health ?? HEALTH.start;

    runWeeks(state, 4);

    expect(state.org.frontUpkeepOwed ?? 0).toBe(0);
    expect(front.health ?? HEALTH.start).toBeGreaterThanOrEqual(startHealth);
  });

  it('a save from before this existed loads with nothing owed', () => {
    const state = funded();
    expect(state.org.frontUpkeepOwed).toBeUndefined();
  });
});
