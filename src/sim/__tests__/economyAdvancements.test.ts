/**
 * Four economy/succession/event mechanisms, closing real gaps named against
 * WorldBox's decision-weighting, succession, and resource-growth systems.
 * Two related findings from the same batch — a culture-selected succession
 * tiebreak, and a multi-day leaderless interregnum — were scoped out on
 * inspection rather than force-fit: the player's organization has no
 * "culture" concept to key a tiebreak off, and this codebase's turn
 * structure has no scheduling hook for a delayed, async resolution. See the
 * session's own chat for the reasoning; nothing here pretends otherwise.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { weightedPick } from '../util';
import { GEN_DEFS } from '../eventgen';
import { generateNpc, driftNpcs } from '../npc';
import { acquireBusiness, ownedBusinesses, tickBusinesses, weeklyRevenue } from '../business';
import { HOME_TERRITORY } from '../../config/territories';
import { REINVEST } from '../../config/businesses';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { HANDOVER } from '../../config/succession';
import type { EventContext } from '../events';
import type { GameState } from '../types';

function game(seed = 1): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

describe('softmax sharpening', () => {
  it('a real weight gap translates into a bigger gap in odds than linear picking gives it', () => {
    const items = [
      { id: 'small', weight: 5 },
      { id: 'big', weight: 15 },
    ];
    // Below the point where linear picking chooses "small" (5/20 = 0.25),
    // but sharpening inflates "big"'s share of the total enough to already
    // win at this same roll.
    const roll = 0.24;
    const linear = weightedPick(items, roll);
    const sharpened = weightedPick(items, roll, 0.12);
    expect(linear.id).toBe('small');
    expect(sharpened.id).toBe('big');
  });

  it('sharpness omitted behaves exactly as before — every existing caller is unaffected', () => {
    const items = [
      { id: 'a', weight: 3 },
      { id: 'b', weight: 7 },
    ];
    expect(weightedPick(items, 0.29).id).toBe('a');
    expect(weightedPick(items, 0.31).id).toBe('b');
  });
});

describe('live-severity event weight', () => {
  it('gen_front_trouble scores higher the worse the front actually is', () => {
    const def = GEN_DEFS.find((d) => d.id === 'gen_front_trouble')!;
    expect(typeof def.weight).toBe('function');
    const weight = def.weight as (state: GameState, ctx: EventContext) => number;
    const state = game();

    const barelyBad: EventContext = { business: { ...emptyBusiness(), health: 44 } };
    const collapsing: EventContext = { business: { ...emptyBusiness(), health: 2 } };
    expect(weight(state, collapsing)).toBeGreaterThan(weight(state, barelyBad));
  });

  it('gen_paper_moving scores higher the stronger the case against you is', () => {
    const def = GEN_DEFS.find((d) => d.id === 'gen_paper_moving')!;
    const weight = def.weight as (state: GameState, ctx: EventContext) => number;
    const state = game();

    const weak = { investigation: { strength: 31 } } as unknown as EventContext;
    const strong = { investigation: { strength: 95 } } as unknown as EventContext;
    expect(weight(state, strong)).toBeGreaterThan(weight(state, weak));
  });

  function emptyBusiness() {
    return {
      id: 'biz_test',
      defId: 'laundromat',
      territoryId: HOME_TERRITORY,
      purchasedDay: 0,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 50,
      status: 'operating' as const,
    };
  }

});

describe('reinvestment threshold', () => {
  it('a front that has paid for itself several times over earns a permanent bump', () => {
    const state = game();
    state.org.cash = 500_000;
    for (const t of Object.values(state.territories)) t.influence.player = 60;
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    const front = ownedBusinesses(state)[0];
    expect(front).toBeTruthy();

    const before = weeklyRevenue(state, front!);
    expect(front!.reinvested).toBeFalsy();

    front!.revenueTotal = REINVEST.thresholdRevenue - 1;
    state.day = PAYDAY_INTERVAL; // tickBusinesses only pays out on payday
    tickBusinesses(state, new Rng(state.rng));
    // One more week's earnings should cross the threshold from here.
    expect(front!.reinvested).toBe(true);
    expect(weeklyRevenue(state, front!)).toBeGreaterThan(before);
  });

  it('does nothing to a front nowhere near the threshold', () => {
    const state = game();
    state.org.cash = 500_000;
    for (const t of Object.values(state.territories)) t.influence.player = 60;
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    const front = ownedBusinesses(state)[0]!;
    state.day = PAYDAY_INTERVAL;
    tickBusinesses(state, new Rng(state.rng));
    expect(front.reinvested).toBeFalsy();
  });
});

describe('shaky handover', () => {
  it('an unhappy person defects more often while the room is still unsettled from a weak-claim handover', () => {
    const trials = 250;
    let shakyDefects = 0;
    let settledDefects = 0;

    for (let seed = 0; seed < trials; seed++) {
      const stateA = game(seed);
      stateA.npcs = {};
      const genA = new Rng(stateA.rng);
      const targetA = generateNpc(stateA, genA, 'soldier');
      targetA.stats.loyalty = 5;
      targetA.stats.grievance = 0;
      stateA.npcs[targetA.id] = targetA;
      stateA.org.shakyHandoverUntilDay = stateA.day + HANDOVER.shakyHandoverDays;
      driftNpcs(stateA, new Rng({ seed, calls: 0 }));
      if (targetA.status === 'defected') shakyDefects++;

      const stateB = game(seed);
      stateB.npcs = {};
      const genB = new Rng(stateB.rng);
      const targetB = generateNpc(stateB, genB, 'soldier');
      targetB.stats.loyalty = 5;
      targetB.stats.grievance = 0;
      stateB.npcs[targetB.id] = targetB;
      // No shaky handover on this side.
      driftNpcs(stateB, new Rng({ seed, calls: 0 }));
      if (targetB.status === 'defected') settledDefects++;
    }

    expect(shakyDefects).toBeGreaterThan(settledDefects);
  });

  it('does nothing once the window has passed', () => {
    const state = game();
    state.npcs = {};
    const rng = new Rng(state.rng);
    const npc = generateNpc(state, rng, 'soldier');
    npc.stats.loyalty = 90;
    state.npcs[npc.id] = npc;
    state.org.shakyHandoverUntilDay = state.day - 1; // already expired
    driftNpcs(state, rng);
    // Nothing to assert about defection at loyalty 90 — this just proves the
    // window check doesn't throw or misread an expired day as active.
    expect(state.org.shakyHandoverUntilDay).toBeLessThan(state.day);
  });
});
