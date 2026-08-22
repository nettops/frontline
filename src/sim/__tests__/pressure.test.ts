/**
 * How hard you lean on a front.
 *
 * The vision asks a business to be an operating concern rather than a payout —
 * gambling in the back, inspections, staff, the wash. Most of those already
 * exist in this game under other names, so rather than a second copy of all of
 * it per front there is one dial and the rest are consequences of it.
 *
 * Two properties carry it, and the second is the one that would be easy to get
 * wrong and never notice.
 *
 * **The trade has to be real in both directions.** A dial where one setting is
 * simply better is not a decision.
 *
 * **An existing career must play identically.** `normal` is the old behaviour
 * exactly — every multiplier on it is 1 or 0 — so a save from before this
 * existed is untouched. Asserted rather than assumed, because "it defaults to
 * the old value" is a claim about arithmetic and arithmetic can be wrong.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  acquireBusiness,
  launderCapacity,
  ownedBusinesses,
  pressureOf,
  tickBusinesses,
} from '../business';
import { DEFAULT_PRESSURE, PRESSURES, PRESSURE_BY_ID } from '../../config/pressure';
import { HOME_TERRITORY } from '../../config/territories';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { RIVAL_IDS } from '../../config/factions';
import type { Business, GameState } from '../types';

function funded(seed = 9): GameState {
  const state = newGame({ name: 'Front', difficulty: 'normal', seed });
  state.territories[HOME_TERRITORY].influence.player = 60;
  for (const id of RIVAL_IDS) state.territories[HOME_TERRITORY].influence[id] = 0;
  state.org.cash = 500_000;
  /*
     Dirty money to push through it.

     Without this the front is idle, the weekly exposure decay swamps the lean,
     and every comparison below reads zero against zero — which is correct
     behaviour and a useless test. A front nobody is washing through is not an
     interesting front, whatever the dial says.
  */
  state.org.dirtyCash = 4_000_000;
  return state;
}

/**
 * Runs the weekly business tick, on the days it actually fires.
 *
 * `tickBusinesses` early-returns on `day % PAYDAY_INTERVAL`, and stepping the
 * clock by seven from a day-1 start never lands on a multiple of seven — so
 * the first version of these tests ran the tick zero times and reported that
 * leaning on a front changed nothing. **Third time this trap has been walked
 * into in one session**, which is why it now has a guard of its own below.
 */
function runWeeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / PAYDAY_INTERVAL) + 1) * PAYDAY_INTERVAL;
    tickBusinesses(state, new Rng(state.rng));
  }
}

function aFront(state: GameState): Business {
  // `acquireBusiness` returns the Business, or null when it is refused.
  const bought = acquireBusiness(state, 'laundromat', HOME_TERRITORY);
  expect(bought, 'the setup could not buy a front').not.toBeNull();
  const front = ownedBusinesses(state)[0];
  expect(front, 'no front exists, so nothing below measures anything').toBeDefined();
  return front;
}

describe('the dial', () => {
  /*
     The instrument, because the tick is gated on the calendar and a helper
     that steps the clock wrongly makes every comparison below meaningless
     while still going green.
  */
  it('actually runs the weekly tick', () => {
    const state = funded();
    const front = aFront(state);
    front.pressure = 'hard';
    const before = front.exposure;
    runWeeks(state, 4);
    expect(
      front.exposure,
      'four weeks changed nothing — the tick is never firing',
    ).toBeGreaterThan(before);
  });

  it('reads an absent setting as the old behaviour', () => {
    const state = funded();
    const front = aFront(state);
    expect(front.pressure).toBeUndefined();
    expect(pressureOf(front).id).toBe(DEFAULT_PRESSURE);
  });

  /*
     The claim that a save from before this loads unchanged is arithmetic, so
     it is checked as arithmetic rather than trusted.
  */
  it('leaves the default setting neutral in every term', () => {
    const normal = PRESSURE_BY_ID[DEFAULT_PRESSURE];
    expect(normal.launder).toBe(1);
    expect(normal.revenue).toBe(1);
    expect(normal.exposure).toBe(0);
    expect(normal.wear).toBe(0);
  });

  it('moves more money when you lean on it', () => {
    const state = funded();
    const front = aFront(state);

    front.pressure = 'normal';
    const usual = launderCapacity(state, front);
    front.pressure = 'hard';
    const hard = launderCapacity(state, front);
    front.pressure = 'clean';
    const clean = launderCapacity(state, front);

    expect(hard).toBeGreaterThan(usual);
    expect(clean).toBeLessThan(usual);
  });

  /*
     And the other half of the trade. A front leaned on has to become visibly
     a front, or "keep it clean" is a worse option with no upside.
  */
  it('becomes more interesting to look at when you lean on it', () => {
    const hardState = funded();
    const cleanState = funded();
    const hard = aFront(hardState);
    const clean = aFront(cleanState);
    hard.pressure = 'hard';
    clean.pressure = 'clean';

    runWeeks(hardState, 12);
    runWeeks(cleanState, 12);

    expect(
      hard.exposure,
      'leaning on a front for twelve weeks made it no more interesting than keeping it clean',
    ).toBeGreaterThan(clean.exposure);
  });

  it('wears the place out faster when you lean on it', () => {
    const hardState = funded();
    const cleanState = funded();
    const hard = aFront(hardState);
    const clean = aFront(cleanState);
    hard.pressure = 'hard';
    clean.pressure = 'clean';
    /*
       Both start off the ceiling.

       A new front opens at full health and this test's district is pristine —
       no hostile neighbourhood, no rivals — so recovery outruns the wear and
       both sit clamped at 100, which hides the differential rather than
       disproving it. The measured background in `ladder.probe` is about -2.08
       of wear a front-week against +2.2 of recovery, so the dial matters
       exactly where a real front lives, which is not at 100.
    */
    hard.health = 70;
    clean.health = 70;

    runWeeks(hardState, 12);
    runWeeks(cleanState, 12);

    expect(hard.health).toBeLessThan(clean.health);
  });

  /*
     Nobody comes round a place that is being run as a place. Without this,
     "keep it clean" still carries a random tax and the dial has one strictly
     dominant setting at the bottom instead of at the top.
  */
  it('never inspects a front that is being kept clean', () => {
    expect(PRESSURE_BY_ID['clean'].inspectionChance).toBe(0);
  });

  it('offers a real trade rather than one best answer', () => {
    // Every setting has to win on something, or it is not a choice.
    for (const p of PRESSURES) {
      const better = [
        p.launder > 1,
        p.revenue > 1,
        p.exposure < 0,
        p.wear < 0,
        p.inspectionChance === 0,
      ];
      const worse = [
        p.launder < 1,
        p.revenue < 1,
        p.exposure > 0,
        p.wear > 0,
        p.inspectionChance > 0,
      ];
      if (p.id === DEFAULT_PRESSURE) continue;
      expect(better.some(Boolean), `${p.id} is better at nothing`).toBe(true);
      expect(worse.some(Boolean), `${p.id} costs nothing`).toBe(true);
    }
  });
});
