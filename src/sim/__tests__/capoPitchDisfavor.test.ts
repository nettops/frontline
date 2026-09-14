/**
 * A capo disfavored twice (`capoFavoritism.ts`) brings measurably less of
 * the weekly pitch board himself, for as long as the read holds — the
 * design brief's "he stops bringing you his best," distinct in kind from
 * the grievance/respect tick `applyFavoritism` already charges the man
 * himself. `seedFollowup` (util.ts) is the counter; `isPitchDisfavored`
 * is the derived read; `capoPitches.ts`'s `tickCapoPitches` is where it
 * lands. See all three headers.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { checkCapoFavoritism, isPitchDisfavored } from '../capoFavoritism';
import { livePitches, rejectPitch, tickCapoPitches } from '../capoPitches';
import { territoryList } from '../territory';
import { CAPO_FAVORITISM } from '../../config/capoFavoritism';
import { CAPO_PITCH } from '../../config/capoPitches';
import type { CapoPitch, GameState, Npc } from '../types';

function game(seed = 901): GameState {
  return newGame({ name: 'PitchDisfavor', difficulty: 'normal', seed });
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
      id: `pd_pitch${pitchSeq++}`,
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
      id: `pd_pitch${pitchSeq++}`,
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

/**
 * Registers `ignored` as disfavored against `favored`, twice, `cooldownDays`
 * apart — `checkCapoFavoritism` only ever runs on a multiple of
 * `checkIntervalDays`, so the second day is rounded down to one, the same
 * way `capoFavoritism.test.ts`'s own "can register again" case does.
 */
function disfavorTwice(state: GameState, favored: Npc, ignored: Npc): void {
  settle(state, favored.id, 6, 0);
  settle(state, ignored.id, 0, 6);
  state.day = CAPO_FAVORITISM.checkIntervalDays;
  checkCapoFavoritism(state);

  const next =
    CAPO_FAVORITISM.checkIntervalDays +
    CAPO_FAVORITISM.cooldownDays +
    CAPO_FAVORITISM.checkIntervalDays;
  state.day = next - (next % CAPO_FAVORITISM.checkIntervalDays);
  settle(state, favored.id, 6, 0);
  settle(state, ignored.id, 0, 6);
  checkCapoFavoritism(state);
}

describe('isPitchDisfavored', () => {
  it('is false before any notice, false on the first, true on the second, and lapses after cooldownDays', () => {
    const state = game();
    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    expect(isPitchDisfavored(state, ignored.id)).toBe(false);

    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    state.day = CAPO_FAVORITISM.checkIntervalDays;
    checkCapoFavoritism(state);
    expect(isPitchDisfavored(state, ignored.id)).toBe(false);
    // The favored man never registers, obviously.
    expect(isPitchDisfavored(state, favored.id)).toBe(false);

    const next =
      state.day + CAPO_FAVORITISM.cooldownDays + CAPO_FAVORITISM.checkIntervalDays;
    state.day = next - (next % CAPO_FAVORITISM.checkIntervalDays);
    settle(state, favored.id, 6, 0);
    settle(state, ignored.id, 0, 6);
    checkCapoFavoritism(state);
    expect(isPitchDisfavored(state, ignored.id)).toBe(true);

    state.day += CAPO_FAVORITISM.cooldownDays;
    expect(isPitchDisfavored(state, ignored.id)).toBe(false);
  });
});

describe('a disfavored capo brings fewer pitches himself', () => {
  it('draws well under an equally-ambitious rival once he registers as disfavored twice', () => {
    const state = game();
    const ts = territoryList(state);
    ts[0].influence = { ...ts[0].influence, player: 95 };
    const have = crewList(state);
    for (let i = have.length; i < 6; i++) {
      state.npcs[`n${i}`] = { ...have[0], id: `n${i}`, name: `Hand ${i}`, status: 'active' };
    }

    const favored = hire(state, 1);
    const ignored = hire(state, 2);
    // Equal, zero ambition: absent the disfavor bias, both draw weight 1.
    favored.stats = { ...favored.stats, ambition: 0 };
    ignored.stats = { ...ignored.stats, ambition: 0 };

    disfavorTwice(state, favored, ignored);
    expect(isPitchDisfavored(state, ignored.id)).toBe(true);

    const rng = new Rng(state.rng);
    const counts: Record<string, number> = { [favored.id]: 0, [ignored.id]: 0 };
    const start = state.day;
    for (let day = start; day <= start + 6 * CAPO_PITCH.refreshIntervalDays; day++) {
      state.day = day;
      tickCapoPitches(state, rng);
      if (day % CAPO_PITCH.refreshIntervalDays === 0) {
        for (const p of livePitches(state)) {
          if (p.capoId === favored.id || p.capoId === ignored.id) {
            counts[p.capoId] = (counts[p.capoId] ?? 0) + 1;
          }
          rejectPitch(state, p.id); // clear it so next week drafts fresh
        }
      }
    }

    expect(counts[favored.id] + counts[ignored.id]).toBeGreaterThan(0);
    expect(counts[ignored.id]).toBeLessThan(counts[favored.id]);
  });
});
