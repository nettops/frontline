/**
 * Two things a round-7 blind tester found, kept so they cannot return.
 *
 * Both are the same shape: a guard that was written against the case somebody
 * had in mind, and a case nobody had in mind walking straight through it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { canLaunch, launchOperation } from '../operations';
import { canPromote, canRaise } from '../crew';
import { canSitDownWith } from '../sitdown';
import { crewList } from '../npc';
import { operableTerritories } from '../territory';
import { OPERATIONS } from '../../config/operations';
import type { GameState } from '../types';

function world(): GameState {
  const state = newGame({ name: 'Reach', difficulty: 'normal', seed: 12 });
  state.org.dirtyCash = 50_000;
  return state;
}

/** The job whose body is the player. There is only one player. */
const SOLO = OPERATIONS.find((o) => o.crewRequired === 0)!;

describe('a job that needs nobody', () => {
  it('exists, or the rest of this file is testing nothing', () => {
    expect(SOLO).toBeDefined();
    expect(SOLO.crewRequired).toBe(0);
  });

  it('can be launched once', () => {
    const state = world();
    // Somewhere the organization actually has a way into — the first key in
  // the map is a district it has never touched, and the launch fails on that
  // instead of on the thing being tested.
  const where = operableTerritories(state)[0].territory.id;
    expect(canLaunch(state, SOLO, [], where).ok).toBe(true);
    expect(launchOperation(state, SOLO.id, [], where)).not.toBeNull();
  });

  /*
     The whole finding.

     Every other job is limited by occupying people, so nothing ever had to say
     this out loud. A job requiring zero crew occupies nobody, and could be
     stacked without limit for free money capped only by heat.
  */
  it('cannot be launched twice at once', () => {
    const state = world();
    // Somewhere the organization actually has a way into — the first key in
  // the map is a district it has never touched, and the launch fails on that
  // instead of on the thing being tested.
  const where = operableTerritories(state)[0].territory.id;
    launchOperation(state, SOLO.id, [], where);
    const second = canLaunch(state, SOLO, [], where);
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/only one of you/i);
    expect(launchOperation(state, SOLO.id, [], where)).toBeNull();
    expect(Object.keys(state.activeOperations).length).toBe(1);
  });

  it('does not block jobs that use actual people', () => {
    const state = world();
    // Somewhere the organization actually has a way into — the first key in
  // the map is a district it has never touched, and the launch fails on that
  // instead of on the thing being tested.
  const where = operableTerritories(state)[0].territory.id;
    launchOperation(state, SOLO.id, [], where);
    const crewed = OPERATIONS.find(
      (o) => o.crewRequired === 1 && o.tier === 0 && o.investment === 0,
    );
    if (!crewed) return;
    const man = crewList(state).find((n) => n.status === 'active');
    if (!man) return;
    // `reason` is null when the launch is allowed, which is the expected
    // case here — the point is only that the solo guard did not catch it.
    const check = canLaunch(state, crewed, [man.id], where);
    expect(check.reason ?? '').not.toMatch(/only one of you/i);
  });
});

describe('somebody in a cell', () => {
  const held = (state: GameState) => {
    const man = crewList(state).find((n) => n.status === 'active')!;
    man.status = 'arrested';
    return man;
  };

  it('cannot be promoted', () => {
    const state = world();
    const man = held(state);
    const check = canPromote(state, man);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/cell/i);
  });

  it('cannot be given a raise', () => {
    const state = world();
    const man = held(state);
    expect(canRaise(state, man.id).ok).toBe(false);
  });

  it('cannot be sat down with', () => {
    const state = world();
    const man = held(state);
    const check = canSitDownWith(state, man.id);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/cell/i);
  });

  /*
     He stays on the crew sheet, and that is deliberate.

     Being unreachable is not being gone: he still has a wage, a history and a
     grievance, and the panel should keep showing him. Only the actions stop.
  */
  it('is still on the roster', () => {
    const state = world();
    const man = held(state);
    expect(crewList(state).some((n) => n.id === man.id)).toBe(true);
  });

  it('does not stop a sit-down with a house', () => {
    const state = world();
    held(state);
    expect(canSitDownWith(state, 'falcone').message).not.toMatch(/No such person/i);
  });
});
