/**
 * A chain of command inside the player's own crew.
 *
 * `capos.ts`'s `Capo[]` gives a rival family's men a place in a hierarchy —
 * who runs what, who is under whom — and the player's own roster has never
 * had the equivalent: `Npc` is flat, and a soldier and a capo are
 * distinguished only by `role`, never by who they actually answer to.
 *
 * `reportsTo` is optional and additive on purpose: absent reads as "answers
 * straight to the boss," which is exactly what every save before this existed
 * already means, so nothing below changes for a roster that never assigns it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { assignToCapo, canAssignToCapo } from '../delegation';
import { dismiss, promote } from '../crew';
import type { GameState, Npc } from '../types';

function game(seed = 40): GameState {
  return newGame({ name: 'Chain', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 909, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

describe('assigning a man under a capo', () => {
  it('refuses a subordinate for anybody junior to capo', () => {
    const state = game();
    const capo = hire(state, 'enforcer', 1); // below capo
    const soldier = hire(state, 'soldier', 2);
    const check = canAssignToCapo(state, soldier.id, capo.id);
    expect(check.ok).toBe(false);
  });

  it('refuses putting somebody under a peer or a junior', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const anotherCapo = hire(state, 'capo', 2);
    expect(canAssignToCapo(state, anotherCapo.id, capo.id).ok).toBe(false);
  });

  it('assigns a junior man under a capo', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const soldier = hire(state, 'soldier', 2);
    expect(canAssignToCapo(state, soldier.id, capo.id).ok).toBe(true);

    const result = assignToCapo(state, soldier.id, capo.id);
    expect(result.ok).toBe(true);
    expect(state.npcs[soldier.id].reportsTo).toBe(capo.id);
  });
});

describe('the chain reacting to what happens to the people in it', () => {
  it('clears a man back to answering straight to the boss when his capo is dismissed', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const soldier = hire(state, 'soldier', 2);
    assignToCapo(state, soldier.id, capo.id);
    expect(state.npcs[soldier.id].reportsTo).toBe(capo.id);

    dismiss(state, capo.id);
    expect(state.npcs[soldier.id].reportsTo).toBeUndefined();
  });

  it('stops reporting to anybody once promoted to capo himself', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const lieutenant = hire(state, 'lieutenant', 2);
    assignToCapo(state, lieutenant.id, capo.id);
    expect(state.npcs[lieutenant.id].reportsTo).toBe(capo.id);

    promote(state, lieutenant.id);
    expect(state.npcs[lieutenant.id].role).toBe('capo');
    expect(state.npcs[lieutenant.id].reportsTo).toBeUndefined();
  });

  it('leaves an untouched roster exactly as it was — nobody reports to anybody by default', () => {
    const state = game();
    hire(state, 'capo', 1);
    const soldier = hire(state, 'soldier', 2);
    expect(state.npcs[soldier.id].reportsTo).toBeUndefined();
  });
});
