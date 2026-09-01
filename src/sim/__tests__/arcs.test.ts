/**
 * What you started and have not finished.
 *
 * The engagement brief's phase 5 asked for a story-arc framework and the audit
 * filed the game as having *"parts, no framework"*. Re-read against what an arc
 * is — begins, develops over many days, ends in a way the player can affect —
 * three of the five modules named are substrate (`goals`, `memory`, `ties`) and
 * two are complete arcs (`marks`, `informants`). The game has more besides:
 * scores, promises, cases.
 *
 * So the fault was the one this project keeps finding: the thing exists, works,
 * and cannot be seen as what it is. Each arc lived on its own panel, so a boss
 * with four things running had four screens to remember to visit.
 *
 * Three properties are guarded, and only the first is about the contents.
 *
 * 1. **Every running arc appears, and nothing finished does.** A list that
 *    keeps a settled thing on it is a list the player learns to distrust.
 * 2. **It changes nothing.** A derived read; `whispers.ts` records what happens
 *    when a reporting system forgets that.
 * 3. **It never names an informant.** The one arc that must not be listed, and
 *    the one where a test is the only thing standing between the mechanic and
 *    somebody helpfully surfacing it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { crewList, generateNpc } from '../npc';
import { Rng } from '../rng';
import { arcs } from '../arcs';
import { scoreList } from '../scores';
import { makePromise } from '../promises';
import { putOutMark, callOffMark } from '../marks';
import { SCORE_TARGETS } from '../../config/scores';
import { operableTerritories } from '../territory';
import type { GameState, Npc } from '../types';

/**
 * A career with enough people in it for somebody to be able to leave.
 *
 * A fresh game starts with one man on these seeds, and `putOutMark` needs
 * somebody who has defected — so the first version of this fixture defected
 * the only person in the family and every later `crewList` came back empty.
 */
function game(seed = 5): GameState {
  const state = newGame({ name: 'Running', difficulty: 'normal', seed });
  state.org.cash = 500_000;
  for (let i = 0; i < 3; i++) {
    const npc = generateNpc(state, new Rng({ seed: 71, calls: i * 29 }), 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

/**
 * Somebody worth looking for.
 *
 * `putOutMark` refuses anybody who has not defected — the mark is what happens
 * *after* a man walks out — so a fixture that hands it an ordinary crew member
 * gets null back and the test measures nothing.
 */
function walkedOut(state: GameState): Npc {
  const crew = crewList(state);
  if (crew.length < 2) {
    throw new Error('this fixture needs somebody to leave and somebody to stay');
  }
  const npc = crew[crew.length - 1];
  npc.status = 'defected';
  return npc;
}

describe('what is running', () => {
  it('is nothing at the start of a career', () => {
    expect(arcs(game())).toHaveLength(0);
  });

  it('lists a promise you made, and what would end it', () => {
    const state = game();
    const npc = someone(state);
    makePromise(state, npc.id, 'promoted');

    const running = arcs(state);
    expect(running).toHaveLength(1);
    expect(running[0].title).toContain(npc.name);
    expect(running[0].ends, 'a line that does not say how it ends is a status, not an arc')
      .toBeTruthy();
  });

  it('lists a mark you put out', () => {
    const state = game();
    putOutMark(state, walkedOut(state).id);
    expect(arcs(state).some((a) => a.id.startsWith('mark:'))).toBe(true);
  });

  /** And drops it the moment it is settled, which is what keeps the list honest. */
  it('forgets a mark you called off', () => {
    const state = game();
    const mark = putOutMark(state, walkedOut(state).id);
    expect(mark, 'the fixture never put a mark out, so this proves nothing').not.toBeNull();
    callOffMark(state, mark!.id);
    expect(arcs(state).some((a) => a.id.startsWith('mark:'))).toBe(false);
  });

  /**
   * A score, placed rather than opened.
   *
   * Every job in `SCORE_TARGETS` is tier four or five, so reaching one through
   * `openScore` means a two-hundred-day fixture. What is under test here is
   * that the read finds a live score and says how it ends; that `openScore`
   * refuses the wrong ones is `scores.test.ts`'s business.
   */
  it('lists a score that is running', () => {
    const state = game();
    const where = operableTerritories(state)[0];
    const defId = Object.keys(SCORE_TARGETS)[0];
    expect(where, 'nowhere to run it').toBeTruthy();
    scoreList(state).push({
      id: 'sc_test',
      defId,
      territoryId: where.territory.id,
      manId: someone(state).id,
      openedDay: state.day,
      dueDay: state.day + 30,
      kit: [],
      botched: [],
      alertness: 0,
      status: 'open',
    });

    const score = arcs(state).find((a) => a.id.startsWith('score:'));
    expect(score, 'a live score is not on the list').toBeTruthy();
    expect(score!.ends).toContain('run it');
  });

  /**
   * Oldest first, and that is a decision rather than a default.
   *
   * Ordering by pressure would be scoring, which `attention.ts` forbids itself
   * and this follows. Age answers the question no other screen can — what have
   * I been carrying longest — and the oldest thing is usually the forgotten one.
   */
  it('reads oldest first, and not by how loud a thing is', () => {
    const state = game();
    const crew = crewList(state);
    expect(crew.length, 'the fixture hired nobody').toBeGreaterThan(1);

    // An old, quiet thing first — pushed out so sixty days of clock does not
    // quietly make it pressing too, which is what the first fixture did.
    makePromise(state, crew[0].id, 'promoted');
    state.promises!.find((pr) => pr.npcId === crew[0].id)!.dueDay = state.day + 400;
    state.day += 60;
    // ...then a new one with the clock nearly run out on it.
    makePromise(state, crew[1].id, 'covered');
    const urgent = state.promises!.find((pr) => pr.npcId === crew[1].id)!;
    urgent.dueDay = state.day + 1;

    const running = arcs(state);
    expect(running.length).toBe(2);
    /*
       The pressing one is second, and that is the assertion.

       An earlier version of this test made both promises quiet, so sorting by
       pressure instead of by age left the order untouched and it passed with
       the rule broken. Ordering by pressure would be scoring, which
       `attention.ts` forbids itself and this follows.
    */
    expect(running[0].pressing, 'the old one should be the quiet one here').toBe(false);
    expect(running[1].pressing, 'the new one should be the pressing one here').toBe(true);
    const days = running.map((a) => a.since);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  /**
   * Every line goes somewhere. A row the player cannot act on is a notification.
   */
  it('sends you somewhere for every one of them', () => {
    const state = game();
    makePromise(state, someone(state).id, 'promoted');
    putOutMark(state, walkedOut(state).id);
    const running = arcs(state);
    expect(running.length, 'nothing was running, so this checked nothing').toBeGreaterThan(1);
    for (const a of running) {
      expect(a.panel, `${a.id} has nowhere to go`).toBeTruthy();
      expect(a.where.length, `${a.id} does not say where it stands`).toBeGreaterThan(0);
      expect(a.ends.length, `${a.id} does not say how it ends`).toBeGreaterThan(0);
    }
  });
});

describe('what is deliberately not on it', () => {
  /**
   * An informant is an arc and must never be listed.
   *
   * `informants.ts` refuses to write even a log line when somebody turns,
   * because the player's only route to it is what the other side turns out to
   * know. A dashboard row would end the mechanic on the day it started, and
   * this test is the only thing standing between it and somebody helpfully
   * surfacing it later.
   */
  it('never names somebody who is talking', () => {
    const state = game(13);
    const npc = someone(state);
    npc.informingSince = state.day;
    makePromise(state, npc.id, 'promoted');

    for (const a of arcs(state)) {
      expect(a.id.startsWith('informant'), 'the informant arc has been surfaced').toBe(false);
      expect(a.where.toLowerCase()).not.toContain('talking');
      expect(a.ends.toLowerCase()).not.toContain('informant');
    }
  });
});

describe('the read changes nothing', () => {
  it('consumes no random draws', () => {
    const state = game(7);
    makePromise(state, someone(state).id, 'promoted');
    const before = state.rng.calls;
    arcs(state);
    arcs(state);
    expect(state.rng.calls).toBe(before);
  });

  it('moves nothing on the state it reads', () => {
    const state = game(8);
    makePromise(state, someone(state).id, 'covered');
    const snapshot = JSON.stringify(state);
    arcs(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is the same on the same seed', () => {
    const run = () => {
      const state = game(31);
      for (let d = 0; d < 90; d++) advanceDay(state);
      return arcs(state).map((a) => `${a.since}:${a.id}:${a.where}`);
    };
    expect(run()).toEqual(run());
  });

  it('survives a save that predates every one of these systems', () => {
    const state = game(9);
    delete (state as { promises?: unknown }).promises;
    delete (state as { scores?: unknown }).scores;
    delete (state as { marks?: unknown }).marks;
    expect(() => arcs(state)).not.toThrow();
  });

  /** It reads hidden state and must not print a number the player is not shown. */
  it('never puts a raw stat on screen', () => {
    const state = game(12);
    const stays = someone(state);
    putOutMark(state, walkedOut(state).id);
    makePromise(state, stays.id, 'promoted');
    for (const a of arcs(state)) {
      expect(a.where.toLowerCase()).not.toMatch(/strength|chance|alertness|grievance/);
    }
  });
});
