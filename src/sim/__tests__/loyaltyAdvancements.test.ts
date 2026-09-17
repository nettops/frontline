/**
 * Five loyalty/crew mechanisms, each closing a real gap named against
 * WorldBox's loyalty and social systems. Every one only changes an already-
 * hidden number's trajectory — nothing here exposes a new figure to the
 * player, so the "hidden stats stay hidden" rule is untouched. None of the
 * new constants are probe-measured yet; see the comments in config/npcs.ts
 * and config/ties.ts.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { driftNpcs, generateNpc } from '../npc';
import { refreshRecruits } from '../crew';
import { tiesFromOperation } from '../ties';
import { DRIFT } from '../../config/npcs';
import type { GameState, Npc } from '../types';

function game(seed: number): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Adds a crew member with fully-controlled starting stats. */
function addNpc(state: GameState, rng: Rng, overrides: Partial<Npc> = {}): Npc {
  const npc = generateNpc(state, rng, 'soldier');
  Object.assign(npc, overrides);
  state.npcs[npc.id] = npc;
  return npc;
}

describe('new-hire honeymoon', () => {
  it('a fresh hire gains more loyalty per tick than an otherwise identical veteran, on average', () => {
    let honeymoonTotal = 0;
    let veteranTotal = 0;
    const trials = 40;
    for (let seed = 0; seed < trials; seed++) {
      const state = game(seed);
      state.npcs = {};
      const rng = new Rng(state.rng);
      // Each gets its own stats object — a shared reference here would mean
      // the second npc processed in driftNpcs silently overwrites the
      // first's already-computed loyalty, since both would point at the same
      // underlying object.
      const statsFor = () => ({
        ...generateNpc(state, rng, 'soldier').stats,
        loyalty: 50,
        ambition: 10,
        grievance: 0,
        fear: 0,
      });
      const fresh = addNpc(state, rng, {
        traits: [],
        wage: 1000,
        stats: statsFor(),
        daysInCrew: 0,
        joinedDay: state.day,
      });
      const veteran = addNpc(state, rng, {
        traits: [],
        wage: 1000,
        stats: statsFor(),
        daysInCrew: DRIFT.honeymoonDays * 3,
        joinedDay: state.day - DRIFT.honeymoonDays * 3,
      });
      driftNpcs(state, rng);
      honeymoonTotal += fresh.stats.loyalty - 50;
      veteranTotal += veteran.stats.loyalty - 50;
    }
    const honeymoonAvg = honeymoonTotal / trials;
    const veteranAvg = veteranTotal / trials;
    expect(honeymoonAvg - veteranAvg).toBeGreaterThan(1);
  });
});

describe('collective defection', () => {
  it('the same unhappy person defects more often when the rest of the crew is also unhappy', () => {
    const trials = 250;
    let aloneShareDefects = 0;
    let crowdedShareDefects = 0;

    for (let seed = 0; seed < trials; seed++) {
      // Scenario A: the target is the only person in the organization, so
      // the collective share is 1.0 — as unhappy as it gets.
      const stateA = game(seed);
      stateA.npcs = {};
      const genA = new Rng(stateA.rng);
      const targetA = addNpc(stateA, genA, {
        stats: { ...generateNpc(stateA, genA, 'soldier').stats, loyalty: 5, grievance: 0 },
      });
      // A fresh, fixed-offset rng for the tick itself: generating a
      // different NUMBER of npcs beforehand shifts how many draws have
      // already been consumed, which would otherwise hand the target a
      // different lucky/unlucky roll for reasons that have nothing to do
      // with the mechanism under test. Both scenarios' ticks must start from
      // the same point in the stream for the same trial index.
      driftNpcs(stateA, new Rng({ seed, calls: 0 }));
      if (targetA.status === 'defected') aloneShareDefects++;

      // Scenario B: the same target, surrounded by a happy crew, so the
      // collective share is small.
      const stateB = game(seed);
      stateB.npcs = {};
      const genB = new Rng(stateB.rng);
      const targetB = addNpc(stateB, genB, {
        stats: { ...generateNpc(stateB, genB, 'soldier').stats, loyalty: 5, grievance: 0 },
      });
      for (let i = 0; i < 15; i++) {
        addNpc(stateB, genB, {
          stats: { ...generateNpc(stateB, genB, 'soldier').stats, loyalty: 90, grievance: 0 },
        });
      }
      driftNpcs(stateB, new Rng({ seed, calls: 0 }));
      if (targetB.status === 'defected') crowdedShareDefects++;
    }

    expect(aloneShareDefects).toBeGreaterThan(crowdedShareDefects);
  });
});

describe('trait compatibility on ties', () => {
  it('a shared trait builds more trust from the same job than a clashing pair', () => {
    let sameSum = 0;
    let sameCount = 0;
    let clashSum = 0;
    let clashCount = 0;
    const trials = 300;

    for (let seed = 0; seed < trials; seed++) {
      const state = game(seed);
      state.npcs = {};
      const rng = new Rng(state.rng);
      const a = addNpc(state, rng, { traits: ['loyalist'] });
      const b = addNpc(state, rng, { traits: ['loyalist'] });
      tiesFromOperation(state, rng, [a, b]);
      const tie = a.ties.find((t) => t.id === b.id);
      if (tie) {
        sameSum += tie.trust;
        sameCount++;
      }
    }

    for (let seed = 0; seed < trials; seed++) {
      const state = game(seed);
      state.npcs = {};
      const rng = new Rng(state.rng);
      const a = addNpc(state, rng, { traits: ['loyalist'] });
      const b = addNpc(state, rng, { traits: ['greedy'] });
      tiesFromOperation(state, rng, [a, b]);
      const tie = a.ties.find((t) => t.id === b.id);
      if (tie) {
        clashSum += tie.trust;
        clashCount++;
      }
    }

    expect(sameCount).toBeGreaterThan(0);
    expect(clashCount).toBeGreaterThan(0);
    expect(sameSum / sameCount).toBeGreaterThan(clashSum / clashCount);
  });
});

describe('peer contagion', () => {
  it('a junior with a trusted senior drifts toward the senior\'s grievance reading', () => {
    const state = game(1);
    state.npcs = {};
    const rng = new Rng(state.rng);
    const senior = addNpc(state, rng, {
      daysInCrew: 500,
      stats: { ...generateNpc(state, rng, 'soldier').stats, grievance: 80 },
      ties: [{ id: 'junior-placeholder', trust: 60, resentment: 0, debt: 0, cause: 'worked_together', since: 0 }],
    });
    const junior = addNpc(state, rng, {
      daysInCrew: 10,
      stats: { ...generateNpc(state, rng, 'soldier').stats, grievance: 5 },
      ties: [{ id: senior.id, trust: 60, resentment: 0, debt: 0, cause: 'worked_together', since: 0 }],
    });
    // Fix up the placeholder id now that junior's real id is known.
    senior.ties[0].id = junior.id;

    const juniorBefore = junior.stats.grievance;
    const seniorBefore = senior.stats.grievance;
    tiesFromOperation(state, rng, [senior, junior]);

    expect(junior.stats.grievance).toBeGreaterThan(juniorBefore);
    expect(senior.stats.grievance).toBeLessThan(seniorBefore);
    // The junior moves further toward the senior than the senior moves
    // toward the junior — inertia, not none.
    expect(junior.stats.grievance - juniorBefore).toBeGreaterThan(
      seniorBefore - senior.stats.grievance,
    );
  });
});

describe('mentor-weighted recruit traits', () => {
  it('a fresh recruit pool leans toward an established, trusted hand\'s own traits', () => {
    let withMentorHits = 0;
    let withoutMentorHits = 0;
    const trials = 300;

    for (let seed = 0; seed < trials; seed++) {
      const state = game(seed);
      state.npcs = {};
      // The mentor is built off a wholly separate rng stream, so adding one
      // does not shift how many draws have been consumed by the time
      // `refreshRecruits` starts — that shift, not the mentor mechanism
      // itself, is what a first draft of this test was actually measuring.
      const mentorRng = new Rng({ seed: seed + 100_000, calls: 0 });
      addNpc(state, mentorRng, {
        daysInCrew: 1000,
        stats: { ...generateNpc(state, mentorRng, 'soldier').stats, loyalty: 90 },
        traits: ['old_school'],
      });
      refreshRecruits(state, new Rng({ seed, calls: 0 }), true);
      if (Object.values(state.recruits).some((n) => n.traits.includes('old_school'))) {
        withMentorHits++;
      }
    }

    for (let seed = 0; seed < trials; seed++) {
      const state = game(seed);
      state.npcs = {}; // no eligible mentor at all
      refreshRecruits(state, new Rng({ seed, calls: 0 }), true);
      if (Object.values(state.recruits).some((n) => n.traits.includes('old_school'))) {
        withoutMentorHits++;
      }
    }

    expect(withMentorHits).toBeGreaterThan(withoutMentorHits);
  });
});
