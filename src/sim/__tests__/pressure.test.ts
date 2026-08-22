/**
 * The one repeating event a playtester actually noticed repeating.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { resolveEvent } from '../events';
import { crewList } from '../npc';
import { pushEvent } from '../util';
import type { GameState, Npc } from '../types';

function held(state: GameState): Npc {
  const npc = crewList(state)[0];
  npc.status = 'arrested';
  return npc;
}

/** Raises the memo the way the event system would, at the stage it is up to. */
function press(state: GameState, npc: Npc) {
  const stage = Math.min(state.flags[`pressed_${npc.id}`] ?? 0, 2);
  return pushEvent(state, {
    defId: 'arrest_pressure',
    title: 'x',
    body: 'x',
    severity: 'danger',
    npcId: npc.id,
    data: { stage },
    choices: [
      { id: 'lawyer', label: 'l', hint: '' },
      { id: 'family', label: 'f', hint: '' },
      { id: 'nothing', label: 'n', hint: '' },
    ],
  });
}

function evidenceOn(state: GameState, npc: Npc): number {
  return Object.values(state.evidence).filter((e) => e.npcIds.includes(npc.id)).length;
}

describe('pressure on an arrested man', () => {
  it('costs more every time it is ignored', () => {
    const state = newGame({ name: 'P', difficulty: 'normal', seed: 5 });
    const rng = new Rng(state.rng);
    const npc = held(state);

    const strengths: number[] = [];
    for (let i = 0; i < 2; i++) {
      const e = press(state, npc);
      resolveEvent(state, rng, e.id, 'nothing');
      strengths.push(
        Object.values(state.evidence)
          .filter((x) => x.npcIds.includes(npc.id))
          .slice(-1)[0].strength,
      );
    }
    expect(strengths[1]).toBeGreaterThan(strengths[0]);
  });

  it('ends with him flipping rather than asking forever', () => {
    const state = newGame({ name: 'P', difficulty: 'normal', seed: 5 });
    const rng = new Rng(state.rng);
    const npc = held(state);

    for (let i = 0; i < 3; i++) {
      const e = press(state, npc);
      resolveEvent(state, rng, e.id, 'nothing');
    }
    expect(state.flags[`broke_${npc.id}`]).toBe(1);
    expect(npc.stats.loyalty).toBe(0);

    // And once he has gone, the event has nothing left to say.
    const before = evidenceOn(state, npc);
    const again = press(state, npc);
    resolveEvent(state, rng, again.id, 'nothing');
    expect(evidenceOn(state, npc)).toBe(before);
  });

  it('lets counsel end it outright', () => {
    const state = newGame({ name: 'P', difficulty: 'normal', seed: 5 });
    const rng = new Rng(state.rng);
    const npc = held(state);
    state.org.dirtyCash = 100_000;

    const e1 = press(state, npc);
    resolveEvent(state, rng, e1.id, 'nothing');
    expect(state.flags[`pressed_${npc.id}`]).toBe(1);

    const e2 = press(state, npc);
    resolveEvent(state, rng, e2.id, 'lawyer');
    expect(state.flags[`pressed_${npc.id}`]).toBe(0);
  });

  it('lets looking after his family walk it back a step', () => {
    const state = newGame({ name: 'P', difficulty: 'normal', seed: 5 });
    const rng = new Rng(state.rng);
    const npc = held(state);
    state.org.dirtyCash = 100_000;

    for (let i = 0; i < 2; i++) resolveEvent(state, rng, press(state, npc).id, 'nothing');
    expect(state.flags[`pressed_${npc.id}`]).toBe(2);

    resolveEvent(state, rng, press(state, npc).id, 'family');
    expect(state.flags[`pressed_${npc.id}`]).toBe(1);
  });

  it('says out loud what leaving him cost', () => {
    const state = newGame({ name: 'P', difficulty: 'normal', seed: 5 });
    const rng = new Rng(state.rng);
    const npc = held(state);

    const before = state.log.length;
    resolveEvent(state, rng, press(state, npc).id, 'nothing');
    expect(state.log.length).toBeGreaterThan(before);
    expect(state.log[0].text).toContain(npc.name);
  });
});
