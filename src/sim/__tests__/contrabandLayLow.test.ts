/**
 * The trade does not run at full strength while the boss is dark.
 *
 * Round 30: "the trade also keeps earning while Lay Low is on". Laying low is
 * the game's answer to heat, and the heat channel the trade uses (`money`) is
 * documented as one that laying low does nothing for — which left the boss's
 * biggest income untouched by the one decision that is supposed to cost him
 * something. A trade is people on street corners; when the organization goes
 * quiet, half of them do.
 *
 * Applied where the weekly ceiling is read (`throughput`), so the sale, the
 * weekly buy, the order sizing and the row on the board all say the same
 * thing and nothing shows a figure the week will not deliver.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { openRoute, openSupply, throughput, tickContraband } from '../contraband';
import { LAY_LOW_TRADE_SHARE, TRADES } from '../../config/contraband';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { controlledTerritories } from '../territory';
import { withFronts } from './helpers';
import type { GameState } from '../types';

/** An outfit holding ground, running premises, with a route open and stock on the shelf. */
function trading(seed = 31): GameState {
  const state = newGame({
    name: 'Dark',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, TRADES.product.minFronts);
  state.org.cash = 900_000;
  state.org.dirtyCash = 0;
  expect(openSupply(state, 'runner').ok, 'the setup could not open a supply').toBe(true);
  for (const t of controlledTerritories(state)) openRoute(state, 'product', t.id);
  expect(state.contraband.routes.product.length, 'the setup opened no route').toBeGreaterThan(0);
  state.contraband.stock.product = 200;
  state.day = PAYDAY_INTERVAL * (Math.floor(state.day / PAYDAY_INTERVAL) + 1);
  return state;
}

function goDark(state: GameState): void {
  state.org.layLowUntilDay = state.day + 21;
}

describe('the trade while laying low', () => {
  it('can carry the stated share of what it could', () => {
    const open = trading();
    const dark = trading();
    goDark(dark);
    const a = throughput(open, 'product');
    const b = throughput(dark, 'product');
    expect(a.total, 'the setup left the routes with nothing to carry').toBeGreaterThan(0);
    expect(b.total).toBeCloseTo(a.total * LAY_LOW_TRADE_SHARE, 6);
    // What the routes and the people could do is unchanged; only the week is.
    expect(b.routes).toBe(a.routes);
    expect(b.crew).toBe(a.crew);
  });

  it('sells that much less in a distribution week', () => {
    const open = trading();
    const dark = trading();
    goDark(dark);
    tickContraband(open, new Rng(open.rng));
    tickContraband(dark, new Rng(dark.rng));
    const full = open.contraband.lastRun!.product.moved;
    const half = dark.contraband.lastRun!.product.moved;
    expect(full, 'the setup sold nothing on the open week').toBeGreaterThan(2);
    // `moved` is rounded per trade, so allow the one unit that costs.
    expect(Math.abs(half - full * LAY_LOW_TRADE_SHARE)).toBeLessThanOrEqual(1);
    expect(open.contraband.lifetime.product).toBeGreaterThan(dark.contraband.lifetime.product);
  });

  it('says so, so a quieter week does not read as a fault', () => {
    const state = trading();
    goDark(state);
    tickContraband(state, new Rng(state.rng));
    expect(state.log.some((l) => /laying low/i.test(l.text))).toBe(true);
  });

  it('is not said, and nothing is halved, once he is back on the street', () => {
    const state = trading();
    state.org.layLowUntilDay = state.day - 1;
    const before = throughput(state, 'product').total;
    tickContraband(state, new Rng(state.rng));
    expect(state.log.some((l) => /laying low/i.test(l.text))).toBe(false);
    expect(before).toBeCloseTo(throughput(trading(), 'product').total, 6);
  });
});
