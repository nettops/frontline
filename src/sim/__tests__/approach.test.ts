/**
 * The second decision on a job.
 *
 * What is worth testing is that the three options are actually different in
 * the ways the panel claims, and that they reach the places the job list never
 * touched — heat, fear and the neighbourhood. A payout multiplier on its own
 * would be a slider, not a decision.
 *
 * Also here: saves written before approaches existed must still resolve.
 */

import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDays } from '../clock';
import { availableCrew } from '../npc';
import { approachOf, launchOperation, successBreakdown } from '../operations';
import { operableTerritories } from '../territory';
import { OPERATION_BY_ID, APPROACHES, APPROACH_BY_ID } from '../../config/operations';
import type { GameState } from '../types';

function fresh(seed = 12): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

function shakedown(state: GameState, approach: Parameters<typeof launchOperation>[4]) {
  const free = availableCrew(state);
  const where = operableTerritories(state)[0];
  return launchOperation(state, 'corner_shakedown', [free[0].id], where.territory.id, approach);
}

describe('the approaches differ in the ways the panel says they do', () => {
  it('trades odds against payout in opposite directions', () => {
    const quiet = APPROACH_BY_ID.quiet;
    const heavy = APPROACH_BY_ID.heavy;
    expect(quiet.success).toBeGreaterThan(heavy.success);
    expect(quiet.payout).toBeLessThan(heavy.payout);
    expect(quiet.heat).toBeLessThan(heavy.heat);
  });

  it('shows up in the odds the player is quoted', () => {
    const state = fresh();
    const def = OPERATION_BY_ID.corner_shakedown;
    const crew = availableCrew(state);
    const where = operableTerritories(state)[0].territory.id;
    const q = successBreakdown(state, def, crew.slice(0, 1), where, 'quiet');
    const h = successBreakdown(state, def, crew.slice(0, 1), where, 'heavy');
    expect(q.total).toBeGreaterThan(h.total);
    expect(q.approach).toBeGreaterThan(0);
    expect(h.approach).toBeLessThan(0);
  });

  it('projects a bigger score for the loud version of the same job', () => {
    const a = fresh();
    const b = fresh();
    const quiet = shakedown(a, 'quiet');
    const heavy = shakedown(b, 'heavy');
    expect(heavy!.projectedPayout).toBeGreaterThan(quiet!.projectedPayout);
  });

  it('reaches fear and the neighbourhood, which the job list never did', () => {
    // Run the same contract both ways from identical states and compare what
    // moved besides money. This is the whole reason the axis exists.
    const quiet = fresh(21);
    const heavy = fresh(21);
    const where = operableTerritories(quiet)[0].territory.id;
    for (let i = 0; i < 8; i++) {
      const q = availableCrew(quiet);
      const h = availableCrew(heavy);
      if (q.length) launchOperation(quiet, 'corner_shakedown', [q[0].id], where, 'quiet');
      if (h.length) launchOperation(heavy, 'corner_shakedown', [h[0].id], where, 'heavy');
      advanceDays(quiet, 2);
      advanceDays(heavy, 2);
    }
    expect(heavy.org.heat).toBeGreaterThan(quiet.org.heat);
    expect(heavy.org.fear).toBeGreaterThanOrEqual(quiet.org.fear);
    expect(heavy.territories[where].sentiment).toBeLessThan(quiet.territories[where].sentiment);
  });
});

describe('saves from before the choice existed', () => {
  it('resolve as the straight approach rather than crashing', () => {
    const state = fresh();
    const op = shakedown(state, 'heavy')!;
    // Exactly what an old save looks like: no approach on the record at all.
    delete (op as { approach?: unknown }).approach;
    expect(approachOf(op)).toBe('standard');
    advanceDays(state, 3);
    expect(state.operationHistory.length).toBeGreaterThan(0);
  });

  it('every approach is reachable by id', () => {
    for (const a of APPROACHES) expect(APPROACH_BY_ID[a.id]).toBe(a);
  });
});
