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
import { UNDERBOSS_FILTER } from '../../config/underboss';
import type { GameState, Npc, Tie } from '../types';

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

function underboss(state: GameState, calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 44, calls }), 'underboss');
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

/** A weaker capo's tie to the Underboss, set directly rather than accumulated. */
function tieTo(npc: Npc, other: Npc, trust: number, resentment: number): Tie {
  const tie: Tie = { id: other.id, trust, resentment, debt: 0, cause: 'worked_together', since: 0 };
  npc.ties.push(tie);
  return tie;
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

describe('capo_political_tension: a trusted, competent Underboss fields it quietly', () => {
  function withHandlingUnderboss(state: GameState, weaker: Npc) {
    const boss = underboss(state, 20);
    boss.stats.leadership = UNDERBOSS_FILTER.leadershipAbove + 10;
    tieTo(weaker, boss, UNDERBOSS_FILTER.trustAbove + 10, UNDERBOSS_FILTER.resentmentBelow - 10);
    return boss;
  }

  it('never raises the event, and eases the tie at half of what `address` itself moves', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    withHandlingUnderboss(state, weaker);

    const tensionBefore = weaker.ties.find((t) => t.id === stronger.id)!.resentment;
    const weakerRespectBefore = weaker.stats.respectForBoss;
    const strongerRespectBefore = stronger.stats.respectForBoss;

    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));

    expect(ctx).toBeNull();
    const tensionAfter = weaker.ties.find((t) => t.id === stronger.id)!.resentment;
    expect(tensionBefore - tensionAfter).toBe(7);
    expect(weaker.stats.respectForBoss - weakerRespectBefore).toBe(2);
    expect(strongerRespectBefore - stronger.stats.respectForBoss).toBe(2);
  });

  it('sets the same cooldown flag an actual raise would, so it does not refire every eligible day', () => {
    const state = game();
    const { weaker } = withResentfulPair(state);
    withHandlingUnderboss(state, weaker);

    DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(state.flags['evt_capo_political_tension']).toBe(state.day);
  });

  it('logs a brief note that it was handled', () => {
    const state = game();
    const { weaker } = withResentfulPair(state);
    withHandlingUnderboss(state, weaker);

    const logBefore = state.log.length;
    DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(state.log.length).toBe(logBefore + 1);
    expect(state.log[0].text.length).toBeGreaterThan(0);
  });
});

describe('capo_political_tension: the Underboss does not field it, and the event raises as before', () => {
  it('with no Underboss at all', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.npc!.id).toBe(weaker.id);
    expect(ctx!.other!.id).toBe(stronger.id);
    expect(ctx!.distrustedUnderboss).toBeUndefined();
  });

  it('when the weaker capo does not trust the Underboss enough, absent any real resentment', () => {
    const state = game();
    const { weaker } = withResentfulPair(state);
    const boss = underboss(state, 20);
    boss.stats.leadership = UNDERBOSS_FILTER.leadershipAbove + 10;
    tieTo(weaker, boss, UNDERBOSS_FILTER.trustAbove - 20, 0);

    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.distrustedUnderboss).toBeUndefined();
  });

  it('when the Underboss himself is not competent enough', () => {
    const state = game();
    const { weaker } = withResentfulPair(state);
    const boss = underboss(state, 20);
    boss.stats.leadership = UNDERBOSS_FILTER.leadershipAbove - 20;
    tieTo(weaker, boss, UNDERBOSS_FILTER.trustAbove + 10, 0);

    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.distrustedUnderboss).toBeUndefined();
  });
});

describe('capo_political_tension: real distrust of the Underboss gets named', () => {
  it('carries the Underboss on the context when the weaker capo genuinely resents him', () => {
    const state = game();
    const { weaker } = withResentfulPair(state);
    const boss = underboss(state, 20);
    boss.stats.leadership = UNDERBOSS_FILTER.leadershipAbove + 10;
    tieTo(weaker, boss, UNDERBOSS_FILTER.trustAbove + 10, UNDERBOSS_FILTER.resentmentBelow + 10);

    const ctx = DEF.applies(state, new Rng({ seed: 1, calls: 0 }));
    expect(ctx).not.toBeNull();
    expect(ctx!.distrustedUnderboss?.id).toBe(boss.id);
  });

  it('names him in the built body text when the context carries him', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const boss = underboss(state, 20);

    const built = DEF.build(state, new Rng({ seed: 2, calls: 0 }), {
      npc: weaker,
      other: stronger,
      distrustedUnderboss: boss,
    });
    expect(built.body).toContain(boss.name);
    expect(built.body).toContain('hearing about it first');
  });

  it('says nothing about being kept from an Underboss when the context carries none', () => {
    const state = game();
    const { weaker, stronger } = withResentfulPair(state);
    const built = DEF.build(state, new Rng({ seed: 2, calls: 0 }), { npc: weaker, other: stronger });
    expect(built.body).not.toContain('hearing about it first');
  });
});
