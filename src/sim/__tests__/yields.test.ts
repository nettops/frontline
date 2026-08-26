/**
 * What holding ground actually does for you.
 *
 * `holdings.ts` worked out which yield each district gives and how much it is
 * worth, and then nothing read it — `holdingShare` returned a number no system
 * consumed. This is the wiring, and it is the half that makes the territory
 * screen stop "just telling you what and who".
 *
 * Each of the six lands on a system that already exists, at a point that
 * already had a multiplier in it. None of them is a new subsystem; every one is
 * a share applied to a quantity the game already computed.
 *
 * The bar for all six is the same and it is deliberately crude: **holding the
 * ground must change the number, and not holding it must leave the number
 * exactly where it was.** A yield that reads plausibly and moves nothing is the
 * failure this project keeps finding — `MARK.talksStrength` did precisely that
 * for a whole feature before a sweep caught it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { eligibleStewards, putInCharge } from '../delegation';
import { recruitCost } from '../crew';
import { launderCut } from '../business';
import { payoutMultiplier } from '../territory';
import { quietShare } from '../heat';
import { holdingShare } from '../holdings';
import { unitCost, unitValue } from '../contraband';
import { favourInterval } from '../civic';
import type { GameState } from '../types';

function game(seed = 4): GameState {
  const state = newGame({ name: 'Yield', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 10) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

/** Take a district outright and put somebody senior enough on it. */
function take(state: GameState, id: string): void {
  state.territories[id].influence.player = 80;
  const free = eligibleStewards(state).find(
    (n) => !Object.values(state.territories).some((t) => t.stewardId === n.id),
  )!;
  const done = putInCharge(state, free.id, id);
  expect(done.ok, `${id}: ${done.message}`).toBe(true);
}

describe('holding ground changes something', () => {
  it('makes hiring cheaper where the people are', () => {
    const state = game();
    const before = recruitCost(state);
    take(state, 'northside');

    expect(holdingShare(state, 'labour')).toBeGreaterThan(0);
    expect(recruitCost(state), 'union halls did nothing for hiring').toBeLessThan(before);
  });

  it('washes money better through the freight district', () => {
    const state = game();
    const before = launderCut(state);
    take(state, 'garment_district');

    expect(holdingShare(state, 'washing')).toBeGreaterThan(0);
    expect(launderCut(state), 'nobody counting the freight cost you the same').toBeLessThan(before);
  });

  it('pays more for work run where you can put things', () => {
    const state = game();
    const before = payoutMultiplier(state, 'warehouse_district');
    take(state, 'warehouse_district');

    expect(holdingShare(state, 'takings')).toBeGreaterThan(0);
    expect(payoutMultiplier(state, 'warehouse_district')).toBeGreaterThan(before);
  });

  it('lets attention fade faster while nobody is looking at Southport', () => {
    const state = game();
    const before = quietShare(state);
    take(state, 'southport');

    expect(holdingShare(state, 'quiet')).toBeGreaterThan(0);
    expect(quietShare(state), 'twenty years of nobody looking bought nothing').toBeGreaterThan(
      before,
    );
  });
});

describe('the two that move slower', () => {
  /*
     Trade and favours land on rates rather than on prices you read once, so
     both are asserted at the point the rate is applied rather than after a
     week of ticking. A test that ran the clock would be measuring the clock.
  */
  it('buys lower and sells higher off the water', () => {
    const state = game();
    const soldBefore = unitValue(state, 'product');
    const boughtBefore = unitCost(state, 'product');
    take(state, 'the_docks');

    expect(holdingShare(state, 'trade')).toBeGreaterThan(0);
    expect(unitValue(state, 'product'), 'holding the water sold for the same').toBeGreaterThan(
      soldBefore,
    );
    expect(unitCost(state, 'product'), 'holding the water bought at the same').toBeLessThan(
      boughtBefore,
    );
  });

  it('brings the people worth knowing round faster', () => {
    const state = game();
    const before = favourInterval(state);
    take(state, 'downtown');

    expect(holdingShare(state, 'civic')).toBeGreaterThan(0);
    expect(favourInterval(state), 'downtown bought no goodwill at all').toBeLessThan(before);
  });
});

describe('not holding it changes nothing', () => {
  /*
     The other half, and the one that actually catches a dead wire.

     A yield that reads plausibly and moves nothing is the failure this project
     keeps finding. These assert the untouched baseline is genuinely untouched,
     so a broken hook shows up as both tests passing for the wrong reason
     rather than one quietly passing on its own.
  */
  it('leaves every number alone for a family that holds nothing', () => {
    const state = game();
    const cost = recruitCost(state);
    const cut = launderCut(state);
    const pay = payoutMultiplier(state, 'warehouse_district');
    const quiet = quietShare(state);
    const sold = unitValue(state, 'product');
    const favours = favourInterval(state);

    // Ground with nobody on it is not the use of ground.
    state.territories['northside'].influence.player = 90;
    state.territories['southport'].influence.player = 90;

    expect(recruitCost(state)).toBe(cost);
    expect(launderCut(state)).toBe(cut);
    expect(payoutMultiplier(state, 'warehouse_district')).toBe(pay);
    expect(quietShare(state)).toBe(quiet);
    expect(unitValue(state, 'product')).toBe(sold);
    expect(favourInterval(state)).toBe(favours);
  });

  it('pays the district that gives it, not every district', () => {
    const state = game();
    const elsewhere = payoutMultiplier(state, 'northside');
    take(state, 'warehouse_district');
    expect(
      payoutMultiplier(state, 'northside'),
      'takings paid out somewhere it was never held',
    ).toBe(elsewhere);
  });
});
