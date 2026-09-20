/**
 * A trade's first route is not a route that has been running for a month.
 *
 * Round 30: the runner door opened on day 55 and one route paid about $23.6K
 * a week almost immediately, which ended the cash famine and every other
 * decision with it. The retainer bought full throughput on the day it was
 * paid — a street that had never carried anything for the boss carried
 * everything it would ever carry, in week one.
 *
 * The director's call was to reshape rather than cap: spool the first route up
 * over `ROUTE_RAMP_WEEKS` so the day-55 windfall is a month of building
 * instead of a cheque, while the settled ceiling a long career reaches is
 * exactly what it was.
 *
 * **Entering the trade, not growing inside it.** The first cut ramped every
 * route and against `ladder.probe` that was a standing tax on expansion: the bot
 * opens a route in every district it takes, for three hundred days, so every new
 * district paid a month at a quarter. The second ramped only the literal first
 * route, which left a bypass — open the first, then the second the same
 * afternoon, and only the first spooled. What the windfall needed taming for is
 * the establishment of the trade, so a route ramps if no route in that trade has
 * yet matured, and once one has, every later route runs at once.
 *
 * Applied inside `districtCapacity`, which is the single place `throughput`,
 * the weekly spread, the order sizing and the panel all read — the same
 * reasoning `LAY_LOW_TRADE_SHARE` is applied under.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  closeRoute,
  openRoute,
  openSupply,
  routeRamp,
  throughput,
  tickContraband,
  weeksToSettle,
} from '../contraband';
import { ROUTE_RAMP_START, ROUTE_RAMP_WEEKS, TRADES } from '../../config/contraband';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { controlledTerritories } from '../territory';
import { withFronts } from './helpers';
import type { GameState } from '../types';

/** An outfit that could trade, with nothing running yet. */
function ready(seed = 31): GameState {
  const state = newGame({
    name: 'Ramp',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, TRADES.product.minFronts);
  state.org.cash = 900_000;
  state.org.dirtyCash = 0;
  expect(openSupply(state, 'runner').ok, 'the setup could not open a supply').toBe(true);
  state.contraband.stock.product = 200;
  // A distribution week, far enough in that a route can be backdated a month.
  state.day = PAYDAY_INTERVAL * 20;
  return state;
}

/** The districts the setup can run through, in a fixed order. */
function ground(state: GameState): string[] {
  const ids = controlledTerritories(state).map((t) => t.id);
  expect(ids.length, 'the setup needs at least two districts to tell first from second').toBeGreaterThan(1);
  return ids;
}

/** Open one route, as of the day given. */
function openOn(state: GameState, territoryId: string, onDay: number): void {
  const was = state.day;
  state.day = onDay;
  expect(openRoute(state, 'product', territoryId).ok, 'the setup could not open a route').toBe(true);
  state.day = was;
}

/** The capacity of one settled first route, the yardstick the others are read against. */
function settledFirst(seed = 31): number {
  const s = ready(seed);
  openOn(s, ground(s)[0], s.day - ROUTE_RAMP_WEEKS * 7);
  const carried = throughput(s, 'product').routes;
  expect(carried, 'the setup left the route with nothing to carry').toBeGreaterThan(0);
  return carried;
}

/** What every route the state has open would carry once all of them had settled. */
function settledEvery(state: GameState): number {
  const s = ready();
  for (const id of state.contraband.routes.product) openOn(s, id, s.day - ROUTE_RAMP_WEEKS * 7 * 10);
  return throughput(s, 'product').routes;
}

describe('the first route spools up', () => {
  it('carries the opening share on the week it opens', () => {
    const state = ready();
    openOn(state, ground(state)[0], state.day);
    expect(throughput(state, 'product').routes).toBeCloseTo(settledFirst() * ROUTE_RAMP_START, 6);
  });

  it('reaches what the ground is worth, and stops there', () => {
    const ancient = ready();
    openOn(ancient, ground(ancient)[0], ancient.day - ROUTE_RAMP_WEEKS * 7 * 10);
    // A route ten times as old carries no more than one that has just settled.
    expect(throughput(ancient, 'product').routes).toBeCloseTo(settledFirst(), 6);
  });

  it('climbs, week on week, and never falls back', () => {
    const full = settledFirst();
    let last = 0;
    for (let week = 0; week <= ROUTE_RAMP_WEEKS; week++) {
      const s = ready();
      openOn(s, ground(s)[0], s.day - week * 7);
      const now = throughput(s, 'product').routes;
      expect(now, `week ${week} carried less than week ${week - 1}`).toBeGreaterThanOrEqual(last);
      expect(now, `week ${week} carried more than a settled route`).toBeLessThanOrEqual(full + 1e-9);
      last = now;
    }
    expect(last).toBeCloseTo(full, 6);
  });

  it('sells that much less on the week it opens', () => {
    const fresh = ready();
    openOn(fresh, ground(fresh)[0], fresh.day);
    const settled = ready();
    openOn(settled, ground(settled)[0], settled.day - ROUTE_RAMP_WEEKS * 7);

    tickContraband(fresh, new Rng(fresh.rng));
    tickContraband(settled, new Rng(settled.rng));
    expect(
      settled.contraband.lastRun!.product.moved,
      'the setup sold nothing on the settled week',
    ).toBeGreaterThan(2);
    expect(fresh.contraband.lastRun!.product.moved).toBeLessThan(
      settled.contraband.lastRun!.product.moved,
    );
  });

  it('says so, on the same page as the number it is about', () => {
    const state = ready();
    const [first] = ground(state);
    openOn(state, first, state.day);
    expect(weeksToSettle(state, 'product', first)).toBe(ROUTE_RAMP_WEEKS);
    state.day += ROUTE_RAMP_WEEKS * 7;
    expect(weeksToSettle(state, 'product', first)).toBe(0);
  });
});

/*
   The rule, as guards. A route ramps while the trade is still being
   established — no route in it has matured — and runs at once after. Reverting
   to "only the literal first route" fails the first two tests here; reverting
   to "every route" fails the last three.
*/
describe('the ramp is for establishing the trade, not for growing inside it', () => {
  it('routes opened in one sitting all spool, so there is no way round it', () => {
    const state = ready();
    const ids = ground(state);
    for (const id of ids) openOn(state, id, state.day);

    for (const id of ids) {
      expect(routeRamp(state, 'product', id), `${id} skipped the ramp`).toBeCloseTo(
        ROUTE_RAMP_START,
        6,
      );
    }
    expect(throughput(state, 'product').routes).toBeCloseTo(
      settledEvery(state) * ROUTE_RAMP_START,
      6,
    );
  });

  it('a route opened while the first is still spooling spools from its own opening', () => {
    const state = ready();
    const [a, b] = ground(state);
    const week = 7;
    openOn(state, a, state.day - 2 * week);
    openOn(state, b, state.day);

    // The first is halfway through its own four weeks; the second has just begun.
    expect(routeRamp(state, 'product', a)).toBeGreaterThan(ROUTE_RAMP_START);
    expect(routeRamp(state, 'product', a)).toBeLessThan(1);
    expect(routeRamp(state, 'product', b)).toBeCloseTo(ROUTE_RAMP_START, 6);
    expect(weeksToSettle(state, 'product', b)).toBe(ROUTE_RAMP_WEEKS);
  });

  it('a route opened the day the first matures runs at once', () => {
    const state = ready();
    const [a, b] = ground(state);
    openOn(state, a, state.day - ROUTE_RAMP_WEEKS * 7);
    expect(weeksToSettle(state, 'product', a)).toBe(0);
    openOn(state, b, state.day);

    expect(routeRamp(state, 'product', b)).toBe(1);
    expect(state.contraband.routeSince?.[`product:${b}`]).toBeUndefined();
  });

  it('a district taken long after the trade was established carries in full the day it opens', () => {
    const state = ready();
    const [a, b] = ground(state);
    openOn(state, a, state.day - ROUTE_RAMP_WEEKS * 7 * 5);
    openOn(state, b, state.day);
    expect(routeRamp(state, 'product', b)).toBe(1);
    expect(state.contraband.routeSince?.[`product:${b}`]).toBeUndefined();
  });

  it('closing and reopening a street while an established one still runs is not a new entry', () => {
    const state = ready();
    const [a, b] = ground(state);
    openOn(state, a, state.day - ROUTE_RAMP_WEEKS * 7);
    openOn(state, b, state.day - ROUTE_RAMP_WEEKS * 7);
    closeRoute(state, 'product', b);
    openOn(state, b, state.day);
    expect(routeRamp(state, 'product', b)).toBe(1);
  });

  it('starts again if every street is given up and the trade is re-entered', () => {
    const state = ready();
    const [a, b] = ground(state);
    openOn(state, a, state.day - ROUTE_RAMP_WEEKS * 7);
    openOn(state, b, state.day - ROUTE_RAMP_WEEKS * 7);
    closeRoute(state, 'product', a);
    closeRoute(state, 'product', b);
    expect(state.contraband.routes.product).toHaveLength(0);

    openOn(state, a, state.day);
    expect(routeRamp(state, 'product', a)).toBeCloseTo(ROUTE_RAMP_START, 6);
  });

  it('giving up the only route that had matured leaves the trade unestablished', () => {
    // A matured, B still spooling. Close A: nothing in the trade has matured,
    // so a route opened now is establishing it, not expanding it.
    const state = ready();
    const [a, b, c] = ground(state);
    openOn(state, a, state.day - ROUTE_RAMP_WEEKS * 7);
    openOn(state, b, state.day - 7);
    closeRoute(state, 'product', a);
    openOn(state, c, state.day);
    expect(routeRamp(state, 'product', c)).toBeCloseTo(ROUTE_RAMP_START, 6);
  });

  it('the trade being entered on one street says nothing about the other trade', () => {
    // Arms is entered through a workshop this setup does not own, so its route
    // list is the honest empty one; what is asserted is that a product route
    // never writes a stamp under the arms key.
    const state = ready();
    openOn(state, ground(state)[0], state.day);
    expect(state.contraband.routes.arms).toHaveLength(0);
    expect(Object.keys(state.contraband.routeSince ?? {}).every((k) => k.startsWith('product:'))).toBe(true);
  });
});

/*
   The lazy initialiser, which is what lets this ship without a
   `SAVE_VERSION` move. A save written before the ramp existed has routes
   and no record of when they opened, and those routes have been running —
   some of them for three hundred days. Reading a missing day as "opened
   today" would take a settled career's income away on load, which is the
   one thing a migration must never do.
*/
describe('a save from before the ramp', () => {
  it('treats its routes as ones that have been running', () => {
    const state = ready();
    openOn(state, ground(state)[0], state.day);
    delete state.contraband.routeSince;
    expect(throughput(state, 'product').routes).toBeCloseTo(settledFirst(), 6);
  });
});
