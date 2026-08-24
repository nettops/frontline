/**
 * Making product instead of buying it, and why that is not a second workshop.
 *
 * The reflex answer to "the game has smuggling, what about manufacturing" is
 * the matrix: arms can be made and product cannot, so give product a facility
 * that makes it. Measured first, and the measurement said no.
 *
 *     trade unlocked (2 fronts)   24/24    median day 45
 *     opened a supply             23/24    median day 169
 *     trade income for the year   median $1,473,652
 *
 * The arms workshop got its second door because $120,000 was out of reach of
 * nine careers in ten — the PATRON shape. The product trade has no access
 * problem at all, so a mirror door would be answering a question nobody asked
 * while destroying the one structural difference between the two trades.
 *
 * What is built instead is a **change of terms**. A plant produces nothing. It
 * lowers what a unit costs, it cannot walk out on you, and it is a building
 * with an address. Every assertion below is about keeping that fork honest in
 * both directions, because a fork where one side dominates is a discount
 * wearing a decision's clothes.
 *
 * Nothing here describes how anything is made, moved or concealed. The header
 * on `config/contraband.ts` stands.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { PLANT, SUPPLIERS, TRADES, WORKSHOP } from '../../config/contraband';
import {
  buildPlant,
  canBuildPlant,
  openRoute,
  openSupply,
  plantList,
  productSources,
  throughput,
  unitCost,
} from '../contraband';
import { totalFunds } from '../economy';
import { withFronts } from './helpers';
import { controlledTerritories } from '../territory';
import { advanceDay } from '../clock';
import type { GameState } from '../types';

/** An outfit that holds ground, runs premises, and can pay for a plant. */
function seated(funds = 400_000, seed = 31): GameState {
  const state = newGame({
    name: 'Plant',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, TRADES.product.minFronts);
  state.org.cash = funds;
  state.org.dirtyCash = 0;
  return state;
}

describe('the price is off a distribution', () => {
  /*
     Measured on `ladder.probe`'s bot — the project's standard career, not one
     written for this feature — across 144 careers. Peak funds inside the first
     year after the trade opened, which is the state a player is in when this
     becomes a question at all:

         reached the trade   131/144
         peak funds          p10 $38,690   median $236,014   p75 $766,036

     DIRECTOR §5: a bar goes between the median and the 75th of a distribution
     somebody has plotted. Both ends are asserted, because a price under the
     median is a giveaway and a price over the 75th is the PATRON shape again.

     The first pass put this at $185,000 off a bot written alongside the
     feature, which reported a median of $176,843 — and which opened a supply
     in 14 careers of 36 where the standard bot reaches two fronts in 132 of
     144. Re-plotted rather than argued with.
  */
  it('sits between the median and the 75th of what a trading career reaches', () => {
    expect(PLANT.cost, 'cheaper than the median career ever holds is a giveaway').toBeGreaterThan(
      236_014,
    );
    expect(PLANT.cost, 'three careers in four can never ask the question').toBeLessThan(766_036);
  });
});

describe('the fork stays honest', () => {
  it('is cheaper per unit than every arrangement', () => {
    // The whole reason to build one. If it were not, nobody ever would.
    for (const s of SUPPLIERS) {
      expect(
        PLANT.unitCostShare,
        `${s.id} sells cheaper than making it, so the plant is decoration`,
      ).toBeLessThan(s.priceMultiplier);
    }
  });

  it('cannot feed an operation on its own', () => {
    /*
       The constraint that keeps the supplier in the game. A plant that covered
       any volume would retire all three arrangements the week it opened, and
       `supplierTrust` — twelve weeks of keeping your head down to earn a
       discount — would become flavour a player buys their way out of.
    */
    expect(PLANT.supplyPerWeek, 'one plant out-delivers the waterfront').toBeLessThan(
      Math.min(...SUPPLIERS.map((s) => s.ceiling)),
    );
    expect(
      PLANT.supplyPerWeek * PLANT.max,
      'a full set of plants beats the largest arrangement in the game',
    ).toBeLessThan(Math.max(...SUPPLIERS.map((s) => s.ceiling)));
  });

  it('is the loudest thing in the trade', () => {
    // The price of never being walked out on. A delivery pattern stops when
    // the deliveries stop; a building does not.
    for (const s of SUPPLIERS) {
      expect(PLANT.exposure, `${s.id} is noisier than a building with a lease`).toBeGreaterThan(
        s.exposure,
      );
    }
  });

  it('costs money every week whether or not anything moves', () => {
    expect(PLANT.upkeep).toBeGreaterThan(0);
  });

  it('does not quietly become the arms workshop', () => {
    // A plant has no `outputPerWeek` and never will. The day it does, both
    // trades are the same trade — see the header on config/contraband.ts.
    expect(Object.keys(PLANT)).not.toContain('outputPerWeek');
    expect(WORKSHOP.outputPerWeek).toBeGreaterThan(0);
  });
});

describe('opening one', () => {
  it('refuses an outfit that cannot pay, and names the figure', () => {
    const state = seated(1_000);
    const where = controlledTerritories(state)[0];
    const check = canBuildPlant(state, where.id);
    expect(check.ok).toBe(false);
    expect(check.message, 'a refusal that does not name the price is F10 again').toMatch(/\d/);
  });

  it('refuses ground that is not really yours, and says which', () => {
    const state = seated();
    const held = new Set(controlledTerritories(state).map((t) => t.id));
    const loose = Object.values(state.territories).find((t) => !held.has(t.id))!;
    const check = canBuildPlant(state, loose.id);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/control/i);
  });

  it('opens when you can pay for it, and takes the money', () => {
    const state = seated();
    const where = controlledTerritories(state)[0];
    const before = totalFunds(state);
    expect(canBuildPlant(state, where.id).ok, canBuildPlant(state, where.id).message).toBe(true);
    expect(buildPlant(state, where.id).ok).toBe(true);
    expect(plantList(state).length).toBe(1);
    expect(totalFunds(state), 'it was free').toBeLessThan(before);
  });

  it('stops at the ceiling, and says how many that is', () => {
    const state = seated(5_000_000);
    const where = controlledTerritories(state)[0];
    for (let i = 0; i < PLANT.max; i++) buildPlant(state, where.id);
    expect(plantList(state).length).toBe(PLANT.max);
    const check = canBuildPlant(state, where.id);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(String(PLANT.max));
  });
});

describe('what it actually changes', () => {
  it('lowers what a unit costs', () => {
    const state = seated();
    openSupply(state, 'dockside');
    const bought = unitCost(state, 'product');
    buildPlant(state, controlledTerritories(state)[0].id);
    expect(
      unitCost(state, 'product'),
      'the plant did not change the price of anything',
    ).toBeLessThan(bought);
  });

  it('leaves the arrangement running beside it', () => {
    /*
       Not a replacement. A career that buys its way in and later builds a
       plant keeps the arrangement until it stops being worth the price, which
       is the shape of every other supply decision in this file.
    */
    const state = seated();
    openSupply(state, 'dockside');
    buildPlant(state, controlledTerritories(state)[0].id);
    expect(state.contraband.supplierId, 'building a plant tore up the arrangement').toBe(
      'dockside',
    );
    const sources = productSources(state);
    expect([...sources.map((s) => s.kind)].sort()).toEqual(['plant', 'supplier']);
    expect(sources[0].kind, 'the dear source is being used first').toBe('plant');
  });

  it('supplies units through the real weekly tick', () => {
    /*
       The wiring, not the function. Paying $185,000 for a facility that never
       delivers anything is the worst possible version of this feature — the
       player is poorer and the shelves are the same — so this runs the actual
       tick and reads the actual shelf, with no arrangement open at all.
    */
    const state = seated(600_000);
    const where = controlledTerritories(state)[0];
    openRoute(state, 'product', where.id);
    expect(buildPlant(state, where.id).ok).toBe(true);
    expect(state.contraband.supplierId, 'this is meant to run on the plant alone').toBeNull();

    const before = state.contraband.lifetime.product;
    for (let i = 0; i < 15 && !state.gameOver; i++) advanceDay(state);
    expect(
      state.contraband.lifetime.product,
      'two weeks with a plant and a route earned nothing at all',
    ).toBeGreaterThan(before);
  });

  it('does not turn cheaper units into more units', () => {
    /*
       Routes bind 74% of weeks and that is the trade's actual governor. If a
       plant raised throughput it would be a volume upgrade wearing a cost
       upgrade's clothes, and the district capacity — the thing the whole trade
       is balanced against — would stop mattering.
    */
    const state = seated(600_000);
    const where = controlledTerritories(state)[0];
    openRoute(state, 'product', where.id);
    const before = throughput(state, 'product').total;
    buildPlant(state, where.id);
    expect(throughput(state, 'product').total).toBe(before);
  });
});
