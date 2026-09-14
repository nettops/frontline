/**
 * Dispatching a capo's own people, instead of ticking names one at a time.
 *
 * `squadFor` is pure selection logic: given who is free and how many bodies a
 * job needs, it says whether a single capo-led group can fill it alone. It
 * reads `reportsTo` and changes nothing — additive, the same way the field
 * itself was built (see `reportsTo.test.ts`) — so a roster with no hierarchy
 * yet simply gets `null` back and the manual checkbox path is exactly what it
 * always was.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { squadFor } from '../crew';
import type { GameState, Npc } from '../types';

function game(seed = 12): GameState {
  return newGame({ name: 'Squad', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 707, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

describe('squadFor', () => {
  it('finds nothing for a roster with no reporting structure', () => {
    const state = game();
    const a = hire(state, 'soldier', 1);
    const b = hire(state, 'soldier', 2);
    expect(squadFor([a, b], 2)).toBeNull();
  });

  it('finds nothing when asked for zero or fewer bodies', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const soldier = hire(state, 'soldier', 2);
    soldier.reportsTo = capo.id;
    expect(squadFor([capo, soldier], 0)).toBeNull();
  });

  it('fills the job with the capo and his reports when they cover it exactly', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const a = hire(state, 'soldier', 2);
    const b = hire(state, 'soldier', 3);
    a.reportsTo = capo.id;
    b.reportsTo = capo.id;
    const squad = squadFor([capo, a, b], 3);
    expect(squad?.capo.id).toBe(capo.id);
    expect(new Set(squad?.members.map((n) => n.id))).toEqual(
      new Set([capo.id, a.id, b.id]),
    );
  });

  it('never returns more people than the job needs', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const a = hire(state, 'soldier', 2);
    const b = hire(state, 'soldier', 3);
    const c = hire(state, 'soldier', 4);
    a.reportsTo = capo.id;
    b.reportsTo = capo.id;
    c.reportsTo = capo.id;
    const squad = squadFor([capo, a, b, c], 2);
    expect(squad?.members).toHaveLength(2);
    expect(squad?.members[0].id).toBe(capo.id);
  });

  it('refuses to fill a job the best squad alone cannot cover', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const a = hire(state, 'soldier', 2);
    a.reportsTo = capo.id;
    // Only two free between them; the job wants four.
    expect(squadFor([capo, a], 4)).toBeNull();
  });

  it('picks the capo with the most free reports when more than one qualifies', () => {
    const state = game();
    const smallCapo = hire(state, 'capo', 1);
    const bigCapo = hire(state, 'capo', 2);
    const a = hire(state, 'soldier', 3);
    const b = hire(state, 'soldier', 4);
    const c = hire(state, 'soldier', 5);
    a.reportsTo = smallCapo.id;
    b.reportsTo = bigCapo.id;
    c.reportsTo = bigCapo.id;
    const squad = squadFor([smallCapo, bigCapo, a, b, c], 2);
    expect(squad?.capo.id).toBe(bigCapo.id);
  });

  it('ignores a report who is not actually free', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const a = hire(state, 'soldier', 2);
    a.reportsTo = capo.id;
    // b reports to the capo too, but is not in the free pool passed in —
    // busy, arrested, whatever kept them off the list this function is given.
    const busy = hire(state, 'soldier', 3);
    busy.reportsTo = capo.id;
    const squad = squadFor([capo, a], 2);
    expect(squad?.members.map((n) => n.id)).not.toContain(busy.id);
  });
});
