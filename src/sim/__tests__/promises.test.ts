/**
 * Things you said you would do.
 *
 * The thing being guarded here is not the arithmetic. It is that a promise is
 * *reachable in both directions* — that saying it can help you and can cost
 * you, and that which one happens depends on what the player did afterwards
 * rather than on a die. The flag this replaced could only ever have been
 * written; a test that only proved a promise can be broken would be describing
 * the same dead end with more steps.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import { canRaise, setWage, wageCeiling } from '../crew';
import { keepPromise, makePromise, promisesTo, tickPromises } from '../promises';
import { remember } from '../memory';
import { informFromMemory } from '../memory';
import { PROMISES } from '../../config/promises';
import { CREW_REGISTERS } from '../../config/sitdown';
import type { GameState, Npc } from '../types';

function game(seed = 4): GameState {
  return newGame({ name: 'Word', difficulty: 'normal', seed });
}

/** Somebody to make a promise to. Throws rather than skipping — see delegation.test. */
function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

function runTo(state: GameState, day: number): void {
  while (state.day < day) advanceDay(state);
}

describe('a promise', () => {
  it('is on the books the moment it is made, and readable', () => {
    const state = game();
    const npc = someone(state);
    makePromise(state, npc.id, 'next_job');

    const owed = promisesTo(state, npc.id);
    expect(owed).toHaveLength(1);
    expect(owed[0].dueDay).toBe(state.day + PROMISES.next_job.days);
  });

  it('does not stack when you say it twice — it resets his patience', () => {
    const state = game();
    const npc = someone(state);
    makePromise(state, npc.id, 'next_job');
    const first = promisesTo(state, npc.id)[0].dueDay;

    runTo(state, state.day + 5);
    makePromise(state, npc.id, 'next_job');

    const owed = promisesTo(state, npc.id);
    expect(owed).toHaveLength(1);
    expect(owed[0].dueDay).toBeGreaterThan(first);
  });

  it('pays him when it is kept', () => {
    const state = game();
    const npc = someone(state);
    npc.stats.loyalty = 50;
    npc.stats.grievance = 40;

    makePromise(state, npc.id, 'next_job');
    expect(keepPromise(state, npc.id, 'next_job')).toBe(true);

    expect(npc.stats.loyalty).toBeGreaterThan(50);
    expect(npc.stats.grievance).toBeLessThan(40);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.memories.some((m) => m.kind === 'word_kept')).toBe(true);
  });

  it('costs him when the deadline passes with nothing done', () => {
    const state = game();
    const npc = someone(state);
    npc.stats.loyalty = 60;
    npc.stats.grievance = 10;

    makePromise(state, npc.id, 'next_job');
    state.day += PROMISES.next_job.days;
    tickPromises(state);

    expect(npc.stats.loyalty).toBeLessThan(60);
    expect(npc.stats.grievance).toBeGreaterThan(10);
    expect(npc.memories.some((m) => m.kind === 'word_broken')).toBe(true);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
  });
});

describe('being covered', () => {
  /*
     The inverted one. "You are covered" is kept by a month in which nothing
     happened to him, so the tick has to read silence as success — and read a
     single bad thing on his record as failure the day it appears, not on the
     deadline. Both directions are asserted because the first draft of the tick
     settled every promise the same way and this one passed anyway.
  */
  it('is kept by a quiet month', () => {
    const state = game();
    const npc = someone(state);
    npc.stats.loyalty = 50;

    makePromise(state, npc.id, 'covered');
    state.day += PROMISES.covered.days;
    tickPromises(state);

    expect(npc.stats.loyalty).toBeGreaterThan(50);
    expect(npc.memories.some((m) => m.kind === 'word_kept')).toBe(true);
  });

  it('breaks the day something happens to him, without waiting for the clock', () => {
    const state = game();
    const npc = someone(state);
    npc.stats.loyalty = 50;

    makePromise(state, npc.id, 'covered');
    state.day += 3;
    remember(npc, state.day, 'took_a_charge');
    tickPromises(state);

    expect(npc.stats.loyalty).toBeLessThan(50);
    expect(npc.memories.some((m) => m.kind === 'word_broken')).toBe(true);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
  });

  it('ignores what happened to him before you said it', () => {
    const state = game();
    const npc = someone(state);
    remember(npc, state.day, 'was_hurt');

    state.day += 2;
    makePromise(state, npc.id, 'covered');
    state.day += 2;
    tickPromises(state);

    expect(promisesTo(state, npc.id)).toHaveLength(1);
  });
});

describe('what breaking your word connects to', () => {
  /*
     The reason this is a memory and not a stat.

     A broken promise has to reach the systems that ask a man what he is
     carrying — the informant gate is the sharpest of them. If this test ever
     fails it means somebody made `word_broken` a private currency of the
     promise system, and the connection that makes the whole thing worth having
     went with it.
  */
  it('makes a man more use to an investigator', () => {
    const state = game();
    const npc = someone(state);
    const before = informFromMemory(npc, state.day);

    makePromise(state, npc.id, 'next_job');
    state.day += PROMISES.next_job.days;
    tickPromises(state);

    expect(informFromMemory(npc, state.day)).toBeGreaterThan(before);
  });

  it('is what the sit-down commits you to, in the config rather than the code', () => {
    // The register is where the words are; the machine never has to know which
    // sentence was a promise. If this drops to zero the sit-down has gone back
    // to being free.
    const committing = CREW_REGISTERS.filter((r) => r.promises);
    expect(committing.length).toBeGreaterThan(0);
    for (const reg of committing) {
      expect(PROMISES[reg.promises!]).toBeDefined();
    }
  });
});

describe('the promise nobody is left to hold you to', () => {
  it('is dropped rather than settled when he is gone', () => {
    const state = game();
    const npc = someone(state);
    makePromise(state, npc.id, 'next_job');

    npc.status = 'defected';
    state.day += PROMISES.next_job.days;
    const loyalty = npc.stats.loyalty;
    tickPromises(state);

    expect(npc.stats.loyalty).toBe(loyalty);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
  });
});

describe('the raise that could not happen', () => {
  /*
     Not a promise, but the same family of defect and the reason it was found:
     a control that looked like it did something, did nothing, and quietly
     charged the player for it.
  */
  it('does not punish a man for a raise the ceiling refused', () => {
    const state = game();
    const npc = someone(state);
    npc.wage = wageCeiling(state, npc);
    npc.stats.grievance = 10;
    const notes = npc.notes.length;

    expect(canRaise(state, npc.id).ok).toBe(false);
    const result = setWage(state, npc.id, Math.round(npc.wage * 1.25));

    expect(result.ok).toBe(true);
    expect(npc.stats.grievance, 'pressing Raise pay made him angrier').toBe(10);
    expect(npc.notes.length, 'he was told he had had his pay cut').toBe(notes);
  });

  it('still says so plainly when the pay really is cut', () => {
    const state = game();
    const npc = someone(state);
    npc.stats.grievance = 10;
    setWage(state, npc.id, Math.round(npc.wage * 0.6));
    expect(npc.stats.grievance).toBeGreaterThan(10);
  });
});

describe('a game that has never made one', () => {
  it('carries no list at all, so old saves load unchanged', () => {
    const state = game();
    const rng = new Rng(state.rng);
    void rng;
    runTo(state, state.day + 10);
    expect(state.promises === undefined || state.promises.length === 0).toBe(true);
  });
});
