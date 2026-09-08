/**
 * One man, one complaint, one answer.
 *
 * Round 16's tester reported two memos that were the same memo: the same
 * person, over the same grudge, offering *hear him out / pay him / turn him
 * away*, one of them headed "wants a word" and the other "is carrying
 * something". The prose was reskinned; the decision was not.
 *
 * The duplication was the visible half. The mechanical half is worse, and it
 * is why this file is behavioural rather than a source scan.
 *
 * `tickEvents` draws twice — once from the authored table, once from the
 * generated one, and only on the days the first came up empty. `grievance_raised`
 * lives in the first pool and `gen_wants_a_word` in the second, so neither
 * could ever see the other's cooldown. And round 15's second MUST FIX was this
 * exact situation becoming a subscription — a tester paid one man on days 202,
 * 215 and 225, each time against an option reading "and the matter is closed" —
 * repaired with a **per-person** cooldown, `GEN_WHEN.askedAgainAfterDays`.
 *
 * That repair was applied to the generated memo only. The authored twin kept a
 * ten-day per-shape cooldown and no memory of the person at all, so the fixed
 * memo and the unfixed one sat side by side and a man dealt with through one
 * could walk back in through the other the same week. **A duplicate is where a
 * fix goes to be half-applied**, which is the general reason this project
 * treats two names for one situation as a fault rather than as flavour.
 *
 * What is guarded here is the shared guard, in both directions. The remaining
 * difference between the two memos — this one happened in front of the room,
 * and the room now reacts — is guarded at the bottom.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { EVENT_DEF_BY_ID, resolveEvent } from '../events';
import { pushEvent } from '../util';
import { GEN_WHEN } from '../../config/eventgen';
import type { GameState, Npc, PendingEvent } from '../types';

function game(seed = 8): GameState {
  const state = newGame({ name: 'One', difficulty: 'normal', seed });
  state.org.dirtyCash = 50_000;
  return state;
}

/**
 * A career with people in it, because a room needs a room.
 *
 * The first version of the crowd tests below guarded themselves with
 * `if (!watching.length) return`, and a fresh career on these seeds has one
 * man in it — so all three passed with the crowd effects deleted. That is the
 * failure `variation.test.ts` names twice in its own comments: a check that
 * cannot fail gets trusted. The fixture hires, and the tests assert that it
 * did before they assert anything else.
 */
function withCrew(seed = 8, extra = 3): GameState {
  const state = game(seed);
  for (let i = 0; i < extra; i++) {
    const npc = generateNpc(state, new Rng({ seed: 404, calls: i * 40 }), 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

/** A man with a live complaint and nobody having asked him about it. */
function sore(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  npc.stats.grievance = 90;
  npc.stats.loyalty = 30;
  delete state.flags[`asked_${npc.id}`];
  return npc;
}

/**
 * Whether this memo would pick this man today.
 *
 * Asks the definition's own `applies`, rather than re-stating its rule here —
 * the whole fault was two places disagreeing about one situation, and a test
 * that copied the gate would be a third.
 *
 * Sampled rather than asked once: `applies` picks at random from everybody
 * eligible, so a single null could mean "he is guarded" or "it chose somebody
 * else". Fifty draws with an rng that is not the causal stream.
 */
function wouldAsk(state: GameState, defId: string, npcId: string): boolean {
  const def = EVENT_DEF_BY_ID[defId];
  for (let i = 0; i < 50; i++) {
    const ctx = def.applies(state, new Rng({ seed: 991, calls: i }));
    if (ctx?.npc?.id === npcId) return true;
  }
  return false;
}

/**
 * Put the memo in front of the player without waiting for the dice.
 *
 * Built by the definition itself rather than by a stub, so the choice ids
 * answered below are the real ones — a stub would let a branch be renamed
 * without this file noticing.
 */
function put(state: GameState, defId: string, npc: Npc): PendingEvent {
  const rng = new Rng({ seed: 17, calls: 0 });
  return pushEvent(state, EVENT_DEF_BY_ID[defId].build(state, rng, { npc }));
}

describe('a man who has been dealt with', () => {
  it('is asked about by both memos while nothing has been done', () => {
    const state = game();
    const npc = sore(state);
    expect(wouldAsk(state, 'grievance_raised', npc.id)).toBe(true);
    expect(wouldAsk(state, 'gen_wants_a_word', npc.id)).toBe(true);
  });

  /**
   * The direction that was broken. Answering the generated memo used to leave
   * the authored one free to ask the same thing the following week.
   */
  it('does not come back through the authored memo after the generated one', () => {
    const state = game();
    const npc = sore(state);
    const e = put(state, 'gen_wants_a_word', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'hear');

    expect(wouldAsk(state, 'gen_wants_a_word', npc.id)).toBe(false);
    expect(wouldAsk(state, 'grievance_raised', npc.id)).toBe(false);
  });

  /** And the other direction, which was broken in the same way. */
  it('does not come back through the generated memo after the authored one', () => {
    const state = game();
    const npc = sore(state);
    const e = put(state, 'grievance_raised', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'listen');

    expect(wouldAsk(state, 'grievance_raised', npc.id)).toBe(false);
    expect(wouldAsk(state, 'gen_wants_a_word', npc.id)).toBe(false);
  });

  /**
   * Being told no is being dealt with.
   *
   * The branch that refuses is the one most likely to be forgotten, and
   * forgetting it is worse than forgetting the others: a man you turned away
   * asking again next week reads as the refusal not having happened.
   */
  it('is dealt with even when the answer was no', () => {
    const state = game();
    const npc = sore(state);
    const e = put(state, 'grievance_raised', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'ignore');
    expect(wouldAsk(state, 'grievance_raised', npc.id)).toBe(false);
  });

  it('comes back eventually, because being heard once is not forever', () => {
    const state = game();
    const npc = sore(state);
    const e = put(state, 'grievance_raised', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'listen');

    state.day += GEN_WHEN.askedAgainAfterDays;
    npc.stats.grievance = 90;
    expect(wouldAsk(state, 'grievance_raised', npc.id)).toBe(true);
  });

  /**
   * Somebody else may still come to you tomorrow.
   *
   * The guard is per person, and a per-shape reading of it would quietly turn
   * one man's bad week into silence from the whole crew.
   */
  it('does not silence anybody else', () => {
    const state = withCrew();
    const crew = crewList(state);
    expect(crew.length, 'the fixture hired nobody').toBeGreaterThan(1);
    for (const n of crew) {
      n.stats.grievance = 90;
      delete state.flags[`asked_${n.id}`];
    }
    const e = put(state, 'grievance_raised', crew[0]);
    resolveEvent(state, new Rng(state.rng), e.id, 'listen');

    expect(wouldAsk(state, 'grievance_raised', crew[0].id)).toBe(false);
    expect(wouldAsk(state, 'grievance_raised', crew[1].id)).toBe(true);
  });
});

/**
 * And what is left of the difference between them.
 *
 * With the guard shared, the two memos are no longer distinguished by their
 * cooldowns, so they have to be distinguished by what they are. This one
 * happens **in front of the crew** — its prose always said so, and nothing in
 * its effects ever did. The generated memo is the man asking privately.
 */
describe('a complaint made in front of everybody', () => {
  const others = (state: GameState, npc: Npc) =>
    crewList(state).filter((n) => n.id !== npc.id && n.status === 'active');

  it('is seen by the people who were standing there', () => {
    const state = withCrew();
    const npc = sore(state);
    const watching = others(state, npc);
    expect(watching.length, 'nobody was in the room — this would pass either way').toBeGreaterThan(0);
    const before = watching.map((n) => n.stats.respectForBoss);

    const e = put(state, 'grievance_raised', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'listen');

    expect(watching.map((n) => n.stats.respectForBoss)).not.toEqual(before);
  });

  it('costs you with them when you let it sit', () => {
    const state = withCrew();
    const npc = sore(state);
    const watching = others(state, npc);
    expect(watching.length, 'nobody was in the room — this would pass either way').toBeGreaterThan(0);
    const before = watching[0].stats.respectForBoss;

    const e = put(state, 'grievance_raised', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'ignore');

    expect(watching[0].stats.respectForBoss).toBeLessThan(before);
  });

  /** The private one is private. Nobody else was there to learn anything. */
  it('is the only one of the two the room hears', () => {
    const state = withCrew();
    const npc = sore(state);
    const watching = others(state, npc);
    expect(watching.length, 'nobody was in the room — this would pass either way').toBeGreaterThan(0);
    const before = watching.map((n) => n.stats.respectForBoss);

    const e = put(state, 'gen_wants_a_word', npc);
    resolveEvent(state, new Rng(state.rng), e.id, 'hear');

    expect(watching.map((n) => n.stats.respectForBoss)).toEqual(before);
  });
});
