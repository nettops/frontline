/**
 * The row labelled "Current heat" must be current heat.
 *
 * Round 11 read the odds panel against the top bar on four days and found the
 * label charging more at *lower* heat: heat 27 cost -8%, heat 11 cost -13%,
 * reproduced 155 days apart. The arithmetic was never wrong — the total is
 * honest — but `heat` folded in `surveillancePenalty`, so the row named one
 * thing and reported two.
 *
 * The cost was real and expensive. That tester bought two fourteen-day lay-lows
 * for roughly $10,500 and 28 idle days specifically to move a number that was
 * only partly the number they were moving. The game's own promise on that panel
 * is "The odds you are shown are the odds you get."
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { successBreakdown, availableOperations } from '../operations';
import { heatSuccessPenalty } from '../heat';
import { availableCrew } from '../npc';
import { operableTerritories } from '../territory';
import type { GameState } from '../types';

function firstJob(state: GameState) {
  const def = availableOperations(state)[0];
  const where = operableTerritories(state)[0].territory.id;
  const crew = availableCrew(state).slice(0, def.crewRequired);
  return successBreakdown(state, def, crew, where);
}

describe('the odds breakdown', () => {
  it('reports heat as heat, and being watched as its own term', () => {
    const state = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    state.org.heat = 40;

    const b = firstJob(state);
    expect(b.heat).toBeCloseTo(-heatSuccessPenalty(state), 6);
    expect(b).toHaveProperty('watched');
  });

  it('still sums to the total it shows', () => {
    const state = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    state.org.heat = 55;

    const b = firstJob(state);
    const sum =
      b.base +
      b.crew +
      b.attribute +
      b.heat +
      b.watched +
      b.territory +
      b.difficulty +
      b.world +
      b.approach;
    // The total clamps, so compare against the unclamped sum only when it is
    // inside the band — otherwise this asserts the clamp rather than the sum.
    if (sum > 0.05 && sum < 0.95) expect(b.total).toBeCloseTo(sum, 6);
  });

  it('never charges more for less heat, even with a case open', () => {
    /*
       The reading round 11 actually took, reproduced.

       A first version of this set the two heat levels and nothing else, and
       passed before the fix — on day one there are no investigations, so
       surveillance was zero on both sides and the defect could not appear. A
       test that cannot reach the bug is not a test of it.
    */
    const low = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    const high = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    low.org.heat = 11;
    high.org.heat = 27;

    // The low-heat family is the one being watched, which is the shape that
    // made the row read backwards.
    low.law.investigations.probe = {
      id: 'probe',
      agencyId: 'city_police',
      stage: 'surveillance',
      stageSince: 1,
      strength: 30,
      status: 'open',
      suspectIds: [],
      evidenceIds: [],
      history: [],
      openedDay: 1,
      lastProgressDay: 1,
      verdict: null,
      verdictDay: null,
    } as unknown as (typeof low.law.investigations)[string];

    expect(firstJob(low).heat).toBeGreaterThanOrEqual(firstJob(high).heat);
  });
});
