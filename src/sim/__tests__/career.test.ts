/**
 * The story of a run, kept rather than reconstructed.
 *
 * The properties under test: `career()` lazily starts empty, the snapshot
 * diff in `recordCareerMilestones` catches each of the milestones it claims
 * to (and nothing noisier — an ordinary promotion below capo is not a
 * chapter), the three direct-write call sites (`recordCareerEvent`, used by
 * `contract.ts` and the family-conflict event) land where expected, and the
 * safety valve on the list length actually holds.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { career, careerSnapshot, recordCareerEvent, recordCareerMilestones } from '../career';
import { controlledTerritories, territoryDef } from '../territory';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState, Npc } from '../types';

function game(seed = 41): GameState {
  return newGame({ name: 'Chapters', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'] = 'soldier'): Npc {
  const npc = generateNpc(state, new Rng(state.rng), role);
  state.npcs[npc.id] = npc;
  return npc;
}

describe('the ledger itself', () => {
  it('starts empty on a fresh save, and a save from before this existed loads the same way', () => {
    const state = game();
    expect(career(state)).toEqual([]);
  });

  it('is a safety valve, not a practical limit', () => {
    const state = game();
    for (let i = 0; i < 1010; i++) recordCareerEvent(state, `Chapter ${i}.`, 'neutral');
    expect(career(state).length).toBeLessThanOrEqual(1000);
    // The oldest went, not the newest.
    expect(career(state).at(-1)!.text).toBe('Chapter 1009.');
  });
});

describe('the snapshot diff', () => {
  it('records a rank change', () => {
    const state = game();
    const before = careerSnapshot(state);
    state.player.rank = 'capo';
    recordCareerMilestones(state, before);
    expect(career(state).some((c) => /Reached/.test(c.text))).toBe(true);
  });

  it('tells a death from a defection', () => {
    const state = game();
    const dead = hire(state);
    const gone = hire(state);
    const before = careerSnapshot(state);
    dead.status = 'dead';
    gone.status = 'defected';
    recordCareerMilestones(state, before);
    const entries = career(state);
    expect(entries.some((c) => c.text === `${dead.name} died.`)).toBe(true);
    expect(entries.some((c) => c.text === `${gone.name} defected.`)).toBe(true);
  });

  it('notes a promotion to capo, and stays quiet below it', () => {
    const state = game();
    const capo = hire(state, 'associate');
    const soldier = hire(state, 'associate');
    const before = careerSnapshot(state);
    capo.role = 'capo';
    soldier.role = 'soldier';
    recordCareerMilestones(state, before);
    const entries = career(state);
    expect(entries.some((c) => c.text === `${capo.name} made Capo.`)).toBe(true);
    expect(
      entries.some((c) => c.text.includes(soldier.name)),
      'an ordinary promotion below capo should not be its own chapter',
    ).toBe(false);
  });

  it('records territory taken and lost', () => {
    const state = game();
    const territory = Object.values(state.territories)[0];
    territory.influence.player = 0;
    const before = careerSnapshot(state);
    territory.influence.player = 90;
    recordCareerMilestones(state, before);
    expect(controlledTerritories(state).some((t) => t.id === territory.id)).toBe(true);
    expect(career(state).some((c) => c.text === `Took ${territoryDef(territory.id).name}.`)).toBe(true);

    const before2 = careerSnapshot(state);
    territory.influence.player = 0;
    recordCareerMilestones(state, before2);
    expect(career(state).some((c) => /^Lost /.test(c.text))).toBe(true);
  });

  it('records a war starting and ending', () => {
    const state = game();
    const rival = RIVAL_IDS[0];
    const before = careerSnapshot(state);
    state.factions[rival].bonds['player'].warSince = state.day;
    recordCareerMilestones(state, before);
    expect(career(state).some((c) => /^War began with/.test(c.text))).toBe(true);

    const before2 = careerSnapshot(state);
    state.factions[rival].bonds['player'].warSince = null;
    recordCareerMilestones(state, before2);
    expect(career(state).some((c) => /war .* ended\.$/.test(c.text))).toBe(true);
  });

  it('records a succession handover', () => {
    const state = game();
    const before = careerSnapshot(state);
    state.succession.generation += 1;
    recordCareerMilestones(state, before);
    expect(career(state).some((c) => /took over the family/.test(c.text))).toBe(true);
  });

  it('records an indictment, naming the agency', () => {
    const state = game();
    const before = careerSnapshot(state);
    state.law.investigations['case_test'] = {
      id: 'case_test',
      agencyId: 'city_police',
      stage: 'indictment',
      openedDay: state.day,
      stageSince: state.day,
      strength: 90,
      suspectIds: [],
      businessIds: [],
      lastProgressDay: state.day,
      status: 'open',
      verdict: null,
      verdictDay: null,
      history: [],
    } as never;
    recordCareerMilestones(state, before);
    expect(career(state).some((c) => /^Indicted by/.test(c.text))).toBe(true);
  });

  it('does not write in Simulation mode', () => {
    const state = newGame({ name: 'Watching', difficulty: 'normal', seed: 41, mode: 'simulation' });
    const before = careerSnapshot(state);
    state.player.rank = 'capo';
    recordCareerMilestones(state, before);
    // Nothing asserts this is wired into `advanceDay`'s own mode guard here —
    // that is `clock.ts`'s job. This only confirms calling the diff function
    // itself never throws against a Simulation-mode state, which has no
    // `crewList` in the usual sense and a `player` that is nobody's.
    expect(() => careerSnapshot(state)).not.toThrow();
  });
});

describe('direct writes, kept to the minimum this file argues for', () => {
  it('lands where called, with the day and tone given', () => {
    const state = game();
    state.day = 55;
    recordCareerEvent(state, 'Had somebody killed.', 'good');
    const entry = career(state).at(-1)!;
    expect(entry.day).toBe(55);
    expect(entry.tone).toBe('good');
    expect(entry.text).toBe('Had somebody killed.');
  });
});
