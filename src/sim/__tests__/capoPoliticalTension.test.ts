/**
 * The one event that surfaces `capoTension.ts`'s `lost_the_room` tie to the
 * player: a resentful capo's complaint about a rival capo's growing power,
 * with the Boss deciding whether to intervene. Design brief §8's political
 * sub-type, previously recorded and never shown.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { recordTie } from '../ties';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { pushEvent } from '../util';
import type { GameState, Npc } from '../types';

function game(seed = 9001): GameState {
  return newGame({ name: 'CapoPolitics', difficulty: 'normal', seed });
}

function capo(state: GameState, calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 44, calls }), 'capo');
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

/** The exact fact `checkCapoPowerImbalance` leaves behind — read here rather than re-derived. */
function withResentfulPair(state: GameState): { weaker: Npc; stronger: Npc } {
  const weaker = capo(state, 1);
  const stronger = capo(state, 10);
  recordTie(state.day, weaker, stronger, 'lost_the_room');
  return { weaker, stronger };
}

const DEF = EVENT_DEF_BY_ID['capo_political_tension'];

describe('capo_political_tension: applies', () => {
  it('does not fire between two capos with no recorded tension', () => {
    const state = game();
    capo(state, 1);
    capo(state, 10);
    for (let i = 0; i < 50; i++) {
      expect(DEF.applies(state, new Rng({ seed: 1, calls: i }))).toBeNull();
    }
  });

  it('fires on the pair carrying the lost_the_room tie, weaker onto stronger', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);

    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.npc!.id).toBe(weaker.id);
    expect(ctx!.other!.id).toBe(stronger.id);
  });

  it('does not fire off an unrelated tie between two capos', () => {
    const state = game();
    const a = capo(state, 1);
    const b = capo(state, 10);
    recordTie(state.day, a, b, 'worked_together');
    for (let i = 0; i < 50; i++) {
      expect(DEF.applies(state, new Rng({ seed: 1, calls: i }))).toBeNull();
    }
  });
});

describe('capo_political_tension: build', () => {
  it('names both capos', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const rng = new Rng({ seed: 2, calls: 0 });
    const built = DEF.build(state, rng, { npc: weaker, other: stronger });

    expect(built.title + built.body).toContain(weaker.name);
    expect(built.title + built.body).toContain(stronger.name);
    expect(built.choices.length).toBeGreaterThanOrEqual(2);
  });
});

describe('capo_political_tension: resolve', () => {
  function put(state: GameState, weaker: Npc, stronger: Npc) {
    const rng = new Rng({ seed: 2, calls: 0 });
    return pushEvent(state, DEF.build(state, rng, { npc: weaker, other: stronger }));
  }

  it('addressing it eases the recorded resentment, at a real cost to the other capo', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const before = weaker.ties.find((t) => t.id === stronger.id)!.resentment;
    const strongerRespectBefore = stronger.stats.respectForBoss;

    const e = put(state, weaker, stronger);
    resolveEvent(state, new Rng(state.rng), e.id, 'address');

    const after = weaker.ties.find((t) => t.id === stronger.id)!.resentment;
    expect(after).toBeLessThan(before);
    expect(stronger.stats.respectForBoss).toBeLessThan(strongerRespectBefore);
  });

  it('letting it sit is a real, non-punishing choice: no stat moves against the complaining capo', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const tieBefore = weaker.ties.find((t) => t.id === stronger.id)!.resentment;
    const grievanceBefore = weaker.stats.grievance;
    const loyaltyBefore = weaker.stats.loyalty;
    const respectBefore = weaker.stats.respectForBoss;

    const e = put(state, weaker, stronger);
    resolveEvent(state, new Rng(state.rng), e.id, 'let_it_sit');

    expect(weaker.ties.find((t) => t.id === stronger.id)!.resentment).toBe(tieBefore);
    expect(weaker.stats.grievance).toBe(grievanceBefore);
    expect(weaker.stats.loyalty).toBe(loyaltyBefore);
    expect(weaker.stats.respectForBoss).toBeLessThanOrEqual(respectBefore);
  });
});
