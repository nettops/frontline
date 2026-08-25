/**
 * A supplier you have kept, against a supplier you merely pay.
 *
 * `failureChancePerWeek` was a constant, and a constant is not a relationship.
 * Measured over 24 careers running each arrangement for a year:
 *
 *     dockside (5%/wk)    lasted mean 18.4 weeks   lost inside a year 21/24
 *     overland (3%/wk)    lasted mean 26.9 weeks   lost inside a year 16/24
 *     quiet    (1.5%/wk)  lasted mean 28.8 weeks   lost inside a year 16/24
 *
 * So the common outcome is: pay $40,000, buy for four months, and one morning
 * a coin comes up and it is gone. Nothing the player did caused it and nothing
 * they could have done would have prevented it. That is round 15's complaint
 * about the crew payoff loop in another system — *"I stopped believing that
 * anything I did for my people mattered."*
 *
 * ## Why trust only ever helps
 *
 * Three candidate inputs were plotted and all three are degenerate under the
 * probe's bot:
 *
 *     volume as a share of the supplier ceiling  ... p10 0.03, p90 0.04
 *     heat, in a career that actually works ...... median 100, p75 100
 *     time held ................................... identical for everybody
 *
 * The bot buys a thirtieth of what dockside could deliver, and runs so hot it
 * sits pegged at the top of the scale. It cannot be told apart from any other
 * career on any axis this feature would read — F7, again.
 *
 * That is what fixes the shape of the design rather than merely qualifying it.
 * Trust **reduces** the chance they walk and can never raise it. A career that
 * runs hot gets no discount and behaves exactly as it does today, which is why
 * no probe can move; a career that keeps its head down gets an arrangement
 * that lasts. The punishment for being loud is losing something good, not
 * being handed something worse — and once you have had it, that is a real
 * cost.
 *
 * ## What it bought, measured
 *
 * Twenty-four worlds each, running dockside for a year:
 *
 *     flat 5% a week, as it was ........ kept a full year  3/24
 *     pegged at heat 100, no trust ..... kept a full year  4/24, mean trust 0
 *     kept quiet, trust earned ......... kept a full year  9/24, mean trust 78
 *
 * The loud row is the baseline, which is the point — a career that earns
 * nothing sees what it saw before. A quiet one roughly triples its odds of
 * still having a supplier at the end of the year.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { withFronts } from './helpers';
import { TRADES } from '../../config/contraband';
import {
  openRoute,
  openSupply,
  seizeStock,
  supplierTrust,
  walkChance,
} from '../contraband';
import { Rng } from '../rng';
import { controlledTerritories } from '../territory';
import { advanceDay } from '../clock';
import { SUPPLIER_BY_ID, SUPPLY_TRUST } from '../../config/contraband';
import type { GameState } from '../types';

function trading(seed = 5): GameState {
  const state = newGame({
    name: 'Supply',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  state.org.cash = 2_000_000;
  // The product trade opens on premises now rather than on a rank, and the
  // seated start holds ground without owning anything standing on it.
  withFronts(state, TRADES.product.minFronts);
  const where = controlledTerritories(state)[0];
  expect(where, 'the seated start holds nothing to run a route through').toBeDefined();
  openRoute(state, 'product', where.id);
  expect(openSupply(state, 'dockside').ok).toBe(true);
  return state;
}

describe('trust can only ever help', () => {
  it('starts at nothing, so a new arrangement is exactly as fragile as before', () => {
    const state = trading();
    expect(supplierTrust(state, 'dockside')).toBe(0);
    expect(
      walkChance(state, SUPPLIER_BY_ID.dockside),
      'a brand new arrangement is already safer than the config says',
    ).toBeCloseTo(SUPPLIER_BY_ID.dockside.failureChancePerWeek, 6);
  });

  it('never makes them more likely to walk than the config says', () => {
    /*
       The load-bearing property, and the reason this cannot break a probe. The
       bot runs pegged at heat 100 and buys a thirtieth of the ceiling, so it
       earns no trust and must therefore see today's behaviour unchanged.
    */
    const state = trading();
    for (const level of [0, 1, 25, 50, 99, 100, 250, -40]) {
      state.contraband.supplierTrust = { dockside: level };
      expect(
        walkChance(state, SUPPLIER_BY_ID.dockside),
        `trust ${level} made them likelier to leave than the flat rate`,
      ).toBeLessThanOrEqual(SUPPLIER_BY_ID.dockside.failureChancePerWeek + 1e-9);
    }
  });

  it('cuts the chance substantially once the relationship holds', () => {
    const state = trading();
    state.contraband.supplierTrust = { dockside: 100 };
    const cut = walkChance(state, SUPPLIER_BY_ID.dockside);
    expect(cut).toBeCloseTo(
      SUPPLIER_BY_ID.dockside.failureChancePerWeek * (1 - SUPPLY_TRUST.maxReduction),
      6,
    );
    expect(SUPPLY_TRUST.maxReduction, 'the discount is too small to be worth protecting')
      .toBeGreaterThanOrEqual(0.5);
  });

  it('scales between the two, rather than flipping at a threshold', () => {
    const state = trading();
    const at = (t: number) => {
      state.contraband.supplierTrust = { dockside: t };
      return walkChance(state, SUPPLIER_BY_ID.dockside);
    };
    expect(at(50)).toBeLessThan(at(0));
    expect(at(100)).toBeLessThan(at(50));
  });
});

describe('what earns it', () => {
  it('grows on its own while the arrangement is quiet', () => {
    // Time is the accrual, because it is the one input the plot did not find
    // degenerate. Keeping a supplier is the thing being rewarded.
    const state = trading();
    const before = supplierTrust(state, 'dockside');
    for (let i = 0; i < 42 && state.contraband.supplierId; i++) advanceDay(state);
    expect(
      supplierTrust(state, 'dockside'),
      'six weeks of steady dealing earned nothing',
    ).toBeGreaterThan(before);
  });

  it('is held at nothing while you are drawing attention', () => {
    /*
       The lever. A supplier does not keep a customer the police are watching,
       and this is the one thing a player controls that the bot never does.
    */
    const hot = trading();
    hot.org.heat = SUPPLY_TRUST.heatCeiling + 10;
    for (let i = 0; i < 42 && hot.contraband.supplierId; i++) {
      hot.org.heat = SUPPLY_TRUST.heatCeiling + 10;
      advanceDay(hot);
    }
    expect(
      supplierTrust(hot, 'dockside'),
      'six weeks at the top of the heat scale still built a relationship',
    ).toBeLessThan(10);
  });

  it('belongs to the arrangement, not to you', () => {
    // Dropping them and coming back does not restore what you had.
    const state = trading();
    state.contraband.supplierTrust = { dockside: 90 };
    state.contraband.supplierId = null;
    openSupply(state, 'dockside');
    expect(
      supplierTrust(state, 'dockside'),
      'walking out and back in kept the whole relationship',
    ).toBe(0);
  });

  it('is not shared between suppliers', () => {
    const state = trading();
    state.contraband.supplierTrust = { dockside: 80 };
    expect(supplierTrust(state, 'overland')).toBe(0);
  });
});

describe('a raid takes it back', () => {
  it('costs the relationship, through the real seizure path', () => {
    /*
       Not `shakeSupplierTrust` called directly — that would prove the function
       and not the wiring, which is the gap this project keeps shipping. This
       runs the seizure the law actually runs.
    */
    const state = trading();
    state.contraband.supplierTrust = { dockside: 100 };
    state.contraband.stock.product = 40;
    seizeStock(state, new Rng(state.rng), 'The Bureau');
    expect(
      supplierTrust(state, 'dockside'),
      'the police carried your stock out and the supplier did not mind at all',
    ).toBeLessThan(100);
  });

  it('does nothing when there was nothing to take', () => {
    const state = trading();
    state.contraband.supplierTrust = { dockside: 100 };
    state.contraband.stock.product = 0;
    state.contraband.stock.arms = 0;
    seizeStock(state, new Rng(state.rng), 'The Bureau');
    expect(supplierTrust(state, 'dockside')).toBe(100);
  });
});

describe('the arrangements last longer for it', () => {
  it('a quiet year keeps a supplier that a loud one loses', () => {
    /*
       The whole claim, measured rather than asserted. Twelve worlds each way,
       identical but for heat — which is the only thing the player controls
       here and the only thing that separates them.
    */
    const survive = (hot: boolean) => {
      let kept = 0;
      for (let i = 0; i < 12; i++) {
        const state = trading(i * 11 + 2);
        for (let d = 0; d < 364 && state.contraband.supplierId; d++) {
          if (hot) state.org.heat = 100;
          else state.org.heat = 0;
          advanceDay(state);
        }
        if (state.contraband.supplierId) kept++;
      }
      return kept;
    };
    const quiet = survive(false);
    const loud = survive(true);
    expect(
      quiet,
      `a quiet year kept ${quiet} of 12 and a loud one kept ${loud} — keeping your ` +
        `head down bought nothing`,
    ).toBeGreaterThan(loud);
  });
});
