/**
 * A family does not try once.
 *
 * `silence` shipped as a single roll: it worked, or the man walked away and was
 * never troubled again. That is not how any of this works. The whole reason
 * somebody in this world is frightened of the answer is that the answer does
 * not expire — a man who is wanted stays wanted, and everybody involved knows
 * it.
 *
 * So a botched attempt leaves a **mark**, and the mark keeps working. You do
 * not click again; you decided once, and now you read the record. That is the
 * same stance `standingOrders.ts` and `delegation.ts` both take, and it is the
 * one this game keeps returning to.
 *
 * **The property that stops this being a free retry:** he is talking the whole
 * time. Every week he is out there and still breathing, he gives away more —
 * so a mark is a race between your people finding him and his mouth burying
 * you, not a queue of rolls you eventually win.
 *
 * Two more things guard the shape:
 *
 * 1. **He goes further to ground each time.** The odds fall with every attempt
 *    that misses. Trying and missing makes the next one harder, which is what
 *    stops "mark everybody and wait".
 * 2. **He can get beyond reach.** Once the odds hit the floor he is gone —
 *    relocated, protected, whatever the street says. The mark lapses and the
 *    evidence he left stays. You do not get him, and you still paid.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList, generateNpc } from '../npc';
import { canSilence, silence } from '../silence';
import { callOffMark, liveMarks, markFor, markList, putOutMark, tickMarks } from '../marks';
import { MARK } from '../../config/silence';
import { SAVE_VERSION } from '../state';
import type { GameState, Npc } from '../types';

function game(seed = 5): GameState {
  const state = newGame({ name: 'Boss', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 10) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 200_000;
  return state;
}

function target(state: GameState): Npc {
  return crewList(state).find((n) => n.status === 'active')!;
}

function rigged(state: GameState, win: boolean): Rng {
  const rng = new Rng(state.rng);
  rng.chance = () => win;
  return rng;
}

/**
 * Days passing, which is what a mark runs on.
 *
 * `tickMarks` gates on `state.day`, so calling it in a loop without moving the
 * calendar exercises nothing at all — the first version of this file did
 * exactly that and six tests failed for a reason that had nothing to do with
 * the module.
 */
function days(state: GameState, n: number, win: boolean): void {
  const rng = rigged(state, win);
  for (let d = 0; d < n; d++) {
    state.day += 1;
    tickMarks(state, rng);
  }
}

describe('what a botched attempt leaves behind', () => {
  it('puts a mark out on the man who got away', () => {
    const state = game();
    const man = target(state);
    expect(state.marks).toBeUndefined();

    silence(state, rigged(state, false), man.id);

    expect(man.status).toBe('defected');
    expect(liveMarks(state)).toHaveLength(1);
    expect(markFor(state, man.id)).toBeTruthy();
  });

  it('leaves none behind when it worked, because there is nobody to look for', () => {
    const state = game();
    const man = target(state);
    silence(state, rigged(state, true), man.id);
    expect(liveMarks(state)).toHaveLength(0);
  });

  it('can be put out on somebody you let go years ago', () => {
    const state = game();
    const man = target(state);
    man.status = 'defected';
    expect(putOutMark(state, man.id)).toBeTruthy();
    expect(liveMarks(state)).toHaveLength(1);
  });

  it('refuses a second one on the same man', () => {
    const state = game();
    const man = target(state);
    man.status = 'defected';
    putOutMark(state, man.id);
    expect(putOutMark(state, man.id)).toBeNull();
    expect(liveMarks(state)).toHaveLength(1);
  });

  it('refuses somebody still working for you, who can simply be dealt with', () => {
    const state = game();
    const man = target(state);
    expect(putOutMark(state, man.id)).toBeNull();
    expect(canSilence(state, man.id).ok).toBe(true);
  });

  it('can be called off, and says nothing about whether that was wise', () => {
    const state = game();
    const man = target(state);
    man.status = 'defected';
    const mark = putOutMark(state, man.id)!;
    callOffMark(state, mark.id);
    expect(liveMarks(state)).toHaveLength(0);
  });
});

describe('what it does while it stands', () => {
  function marked(seed = 5): { state: GameState; man: Npc } {
    const state = game(seed);
    const man = target(state);
    man.status = 'defected';
    putOutMark(state, man.id);
    return { state, man };
  }

  it('tries again on its own, without being asked', () => {
    const { state, man } = marked();
    const mark = markFor(state, man.id)!;
    expect(mark.tries).toBe(0);

    days(state, MARK.everyDays * 2 + 1, false);
    expect(markFor(state, man.id)?.tries ?? 0).toBeGreaterThan(1);
  });

  it('gets him eventually, when it goes right', () => {
    const { state, man } = marked();
    days(state, MARK.everyDays + 1, true);
    expect(man.status).toBe('dead');
    expect(liveMarks(state)).toHaveLength(0);
  });

  it('costs attention every time somebody goes looking', () => {
    const { state } = marked();
    const before = state.org.heat;
    days(state, MARK.everyDays + 1, false);
    expect(state.org.heat).toBeGreaterThan(before);
  });

  /*
     The property the whole thing rests on.

     Without this, a mark is a queue of rolls you eventually win and the first
     attempt costs nothing — which would undo the trade `silence.test.ts`
     exists to protect.
  */
  it('does not stop him talking while you look for him', () => {
    const { state, man } = marked();
    const before = Object.values(state.evidence)
      .filter((e) => e.npcIds.includes(man.id))
      .reduce((sum, e) => sum + e.strength, 0);

    days(state, MARK.talksEveryDays * 3 + 1, false);

    const after = Object.values(state.evidence)
      .filter((e) => e.npcIds.includes(man.id))
      .reduce((sum, e) => sum + e.strength, 0);
    expect(after, 'a marked man sat quietly waiting to be found').toBeGreaterThan(before);
  });

  it('stops him talking the moment it lands', () => {
    const { state, man } = marked();
    days(state, MARK.everyDays + 1, true);
    const at = Object.values(state.evidence)
      .filter((e) => e.npcIds.includes(man.id))
      .reduce((sum, e) => sum + e.strength, 0);

    days(state, MARK.talksEveryDays * 4, false);
    const after = Object.values(state.evidence)
      .filter((e) => e.npcIds.includes(man.id))
      .reduce((sum, e) => sum + e.strength, 0);
    expect(after).toBe(at);
  });

  it('gets harder every time it misses, because he knows they are looking', () => {
    const { state, man } = marked();
    const first = markFor(state, man.id)!.chance;
    days(state, MARK.everyDays * 2 + 1, false);
    expect(markFor(state, man.id)!.chance).toBeLessThan(first);
  });

  /*
     And he can win. A man who stays ahead of it long enough is gone for good,
     which is what makes the first roll matter rather than merely delay things.
  */
  it('lets him get beyond reach, and he keeps what he told them', () => {
    const { state, man } = marked();
    days(state, MARK.everyDays * 40, false);

    expect(man.status, 'he was caught by a mark that should have lapsed').toBe('defected');
    expect(liveMarks(state), 'the mark never lapsed, so it is an infinite retry').toHaveLength(0);
    expect(
      Object.values(state.evidence).some((e) => e.npcIds.includes(man.id)),
      'everything he said vanished when the family gave up',
    ).toBe(true);
  });

  it('runs on the clock without anybody calling it', () => {
    const state = game();
    const man = target(state);
    silence(state, rigged(state, false), man.id);
    const before = markFor(state, man.id)!.tries;
    for (let d = 0; d < MARK.everyDays + 1; d++) advanceDay(state);
    expect(markFor(state, man.id)?.tries ?? 99).toBeGreaterThan(before);
  });
});

describe('the state it keeps', () => {
  it('is absent until somebody gets away, and does not move the save format', () => {
    const state = game();
    expect(state.marks).toBeUndefined();
    expect(SAVE_VERSION).toBe(13);
    markList(state);
    expect(state.marks).toEqual([]);
  });
});
