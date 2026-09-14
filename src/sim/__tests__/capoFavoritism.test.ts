/**
 * What a real, sustained gap in whose pitches get approved does to the
 * capo the boss has been comparatively ignoring — see `capoFavoritism.ts`'s
 * header.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { PROMOTION } from '../../config/npcs';
import { CAPO_FAVORITISM } from '../../config/capoFavoritism';
import { checkCapoFavoritism } from '../capoFavoritism';
import { advanceDay } from '../clock';
import type { CapoPitch, GameState, Npc } from '../types';

function game(seed = 801): GameState {
  return newGame({ name: 'CapoFavoritism', difficulty: 'normal', seed });
}

function hire(state: GameState, calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 2020, calls }), 'capo');
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

let pitchSeq = 0;

/** Pushes `n` already-settled pitches for `capoId`, split between the two outcomes. */
function settle(state: GameState, capoId: string, approved: number, other: number): void {
  if (!state.capoPitches) state.capoPitches = [];
  const pitches: CapoPitch[] = [];
  for (let i = 0; i < approved; i++) {
    pitches.push({
      id: `pitch${pitchSeq++}`,
      defId: 'numbers',
      territoryId: Object.keys(state.territories)[0],
      capoId,
      offeredDay: 1,
      status: 'approved',
      settledDay: 1,
    });
  }
  for (let i = 0; i < other; i++) {
    pitches.push({
      id: `pitch${pitchSeq++}`,
      defId: 'numbers',
      territoryId: Object.keys(state.territories)[0],
      capoId,
      offeredDay: 1,
      status: 'rejected',
      settledDay: 1,
    });
  }
  state.capoPitches.push(...pitches);
}

describe('checkCapoFavoritism', () => {
  it('does nothing off the weekly cadence', () => {
    const state = game();
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    const startGrievance = ignored.stats.grievance;

    state.day = 3; // not a multiple of checkIntervalDays
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(startGrievance);
  });

  it('leaves both capos alone when neither has a big enough sample', () => {
    const state = game(802);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, CAPO_FAVORITISM.minSettled - 1, 0);
    settle(state, ignored.id, 0, CAPO_FAVORITISM.minSettled - 1);
    const startFavored = favored.stats.grievance;
    const startIgnored = ignored.stats.grievance;

    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(startIgnored);
    expect(favored.stats.grievance).toBe(startFavored);
  });

  it('leaves both capos alone when the gap is below the threshold', () => {
    const state = game(803);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    // 4/6 vs 2/6: a real difference, nowhere near CAPO_FAVORITISM.shareGap.
    settle(state, favored.id, 4, 2);
    settle(state, ignored.id, 2, 4);
    const startFavored = favored.stats.grievance;
    const startIgnored = ignored.stats.grievance;

    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(startIgnored);
    expect(favored.stats.grievance).toBe(startFavored);
  });

  it('raises grievance and drops respect for the boss on the ignored capo, and only him', () => {
    const state = game(804);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    const startGrievance = ignored.stats.grievance;
    const startRespect = ignored.stats.respectForBoss;
    const startFavoredGrievance = favored.stats.grievance;

    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(startGrievance + PROMOTION.grievanceRelief);
    expect(ignored.stats.respectForBoss).toBe(startRespect - PROMOTION.respectForBossGain);
    expect(ignored.memories.some((m) => m.kind === 'left_on_the_bench')).toBe(true);
    // The favored capo carries nothing from this — only the ignored man reacts.
    expect(favored.stats.grievance).toBe(startFavoredGrievance);
  });

  it('does not refire on the same capo inside the cooldown', () => {
    const state = game(805);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);
    const afterFirst = ignored.stats.grievance;

    state.day += CAPO_FAVORITISM.checkIntervalDays; // still well inside cooldownDays
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(afterFirst);
  });

  it('can register again once the cooldown has passed', () => {
    const state = game(806);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);
    const afterFirst = ignored.stats.grievance;

    const next =
      CAPO_FAVORITISM.checkIntervalDays +
      CAPO_FAVORITISM.cooldownDays +
      CAPO_FAVORITISM.checkIntervalDays;
    state.day = next - (next % CAPO_FAVORITISM.checkIntervalDays);
    checkCapoFavoritism(state);

    expect(ignored.stats.grievance).toBe(
      Math.min(100, afterFirst + PROMOTION.grievanceRelief),
    );
  });
});

describe('wired into the daily loop', () => {
  it('runs on its own, with nobody calling checkCapoFavoritism directly', () => {
    const state = game(807);
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);

    while (state.day < CAPO_FAVORITISM.checkIntervalDays) advanceDay(state);

    expect(state.day).toBe(CAPO_FAVORITISM.checkIntervalDays);
    // A plain grievance comparison would also pass off `driftNpcs`'s own
    // weekly noise — both capos are 6 days old, well under
    // `STANDING.settledAfterDays`, so `standing.ts`'s identical memory kind
    // cannot have fired yet either. `favoritismNoticedDay` and the memory
    // are written by nothing but this check.
    expect(ignored.favoritismNoticedDay).toBe(CAPO_FAVORITISM.checkIntervalDays);
    expect(ignored.memories.some((m) => m.kind === 'left_on_the_bench')).toBe(true);
  });
});
