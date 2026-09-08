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
import { canRaise, promote, setWage, wageCeiling } from '../crew';
import { putInCharge } from '../delegation';
import { nameHeir } from '../succession';
import { territoryList, playerInfluence } from '../territory';
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

/**
 * The four kinds added when the vocabulary was widened.
 *
 * The point of these is not that four more entries exist in a table. It is
 * that each of them is *kept by an act the player would have performed
 * anyway* — which is the rule the first two established and the only thing
 * stopping a promise from being a second, parallel way to move loyalty.
 *
 * So every test below performs the ordinary action through its own module's
 * public entry point — `promote`, `putInCharge`, `nameHeir` — and asserts the
 * promise settled as a side effect. A test that called `keepPromise` directly
 * would prove the machine works and nothing about whether it is connected,
 * which is exactly the defect the audit found in this system.
 */
describe('the wider vocabulary', () => {
  it('keeps the rung when he is actually promoted', () => {
    const state = game(9);
    const npc = someone(state);
    npc.stats.loyalty = 50;
    makePromise(state, npc.id, 'promoted');
    expect(promisesTo(state, npc.id)).toHaveLength(1);

    // Through crew.ts's own door, not through keepPromise.
    const before = npc.stats.loyalty;
    const result = promote(state, npc.id);
    expect(result.ok).toBe(true);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.stats.loyalty).toBeGreaterThan(before);
    expect(npc.memories.some((m) => m.kind === 'word_kept')).toBe(true);
  });

  it('keeps the ground when he is put in charge of some', () => {
    const state = game(11);
    const npc = someone(state);
    makePromise(state, npc.id, 'territory');

    // Give him the seniority and the influence the appointment needs.
    npc.role = 'capo';
    const t = territoryList(state).find((x) => playerInfluence(x) > 0);
    if (!t) throw new Error('a career starts with a foothold; this seed did not');

    const check = putInCharge(state, npc.id, t.id);
    expect(check.ok).toBe(true);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.memories.some((m) => m.kind === 'word_kept')).toBe(true);
  });

  it('keeps the line when he is actually named', () => {
    const state = game(13);
    const npc = someone(state);
    npc.role = 'underboss';
    npc.stats.loyalty = 70;
    makePromise(state, npc.id, 'next_in_line');

    const named = nameHeir(state, npc.id);
    expect(named.ok).toBe(true);
    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.memories.some((m) => m.kind === 'word_kept')).toBe(true);
  });

  it('breaks the rung on silence, and he writes it down', () => {
    const state = game(15);
    const npc = someone(state);
    makePromise(state, npc.id, 'promoted');
    const before = npc.stats.grievance;

    runTo(state, state.day + PROMISES.promoted.days + 1);

    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.stats.grievance).toBeGreaterThan(before);
    expect(npc.memories.some((m) => m.kind === 'word_broken')).toBe(true);
  });

  /**
   * "I will handle it" and "you are covered" fail on different silences.
   *
   * This is the whole reason `brokenBy` moved out of `sim/promises.ts` and
   * into the table. Being passed over is not something that breaks a promise
   * of protection, and being hurt is not something that breaks a promise to
   * deal with a grudge — so the same memory must settle one and leave the
   * other standing.
   */
  it('breaks the fix on the thing happening again, and not on any bad day', () => {
    const state = game(17);
    const npc = someone(state);
    makePromise(state, npc.id, 'handled');
    makePromise(state, npc.id, 'covered');

    // A memory that is on `handled`'s list and not on `covered`'s.
    remember(npc, state.day, 'passed_over');
    tickPromises(state);

    const left = promisesTo(state, npc.id).map((p) => p.kind);
    expect(left).toContain('covered');
    expect(left).not.toContain('handled');
  });

  it('keeps the fix by the thing simply not happening again', () => {
    const state = game(19);
    const npc = someone(state);
    const before = npc.stats.loyalty;
    makePromise(state, npc.id, 'handled');

    runTo(state, state.day + PROMISES.handled.days + 1);

    expect(promisesTo(state, npc.id)).toHaveLength(0);
    expect(npc.stats.loyalty).toBeGreaterThanOrEqual(before);
    expect(npc.memories.some((m) => m.kind === 'word_broken')).toBe(false);
  });

  it('has a register for every kind, so nothing is only reachable from code', () => {
    const sayable = new Set(
      CREW_REGISTERS.filter((r) => r.promises).map((r) => r.promises as string),
    );
    for (const kind of Object.keys(PROMISES)) {
      expect(sayable).toContain(kind);
    }
  });

  it('survives a save and a load', () => {
    const state = game(21);
    const npc = someone(state);
    makePromise(state, npc.id, 'next_in_line');

    const reloaded = JSON.parse(JSON.stringify(state)) as GameState;
    const owed = promisesTo(reloaded, npc.id);
    expect(owed).toHaveLength(1);
    expect(owed[0].kind).toBe('next_in_line');
    expect(owed[0].dueDay).toBe(state.day + PROMISES.next_in_line.days);
  });

  /**
   * A save written before any of this existed has no `promises` array at all,
   * and the tick must read that as "nothing was ever said" rather than throw.
   */
  it('loads a save from before promises existed', () => {
    const state = game(23);
    delete (state as { promises?: unknown }).promises;
    expect(() => tickPromises(state)).not.toThrow();
    expect(promisesTo(state, someone(state).id)).toHaveLength(0);
  });
});
