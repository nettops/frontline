/**
 * Getting better at it.
 *
 * A man was exactly as good as the day you hired him, forever, and then got
 * worse. `stats.skill` is rolled once in `generateNpc` and the only writes to
 * it afterwards were `AGING.skillPerYear` — a *decline*, and only past 55 —
 * and one event that adds twenty points at the moment of hire. The word ladder
 * for the stat is `green · learning · competent · very good · exceptional`, so
 * "learning" named a state no character in this game was ever in.
 *
 * Two halves, and the properties each has to hold.
 *
 * **Work teaches.** Going out is how you get good at going out. It has to be
 * bounded, or a career of corner shakedowns produces an exceptional crew; and
 * it has to decelerate, or the first man you hire ends the game at 100.
 *
 * **Men teach.** The bill is two bodies for a run of days, which is the cost
 * this project's own measurement says actually bites. Three properties keep it
 * from being a button: you cannot teach past what you know, the gain closes
 * the gap so it decelerates, and what transmits is not only skill — a sloppy
 * teacher makes a sloppy student, and the man you trained knows he is worth
 * more.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList, generateNpc } from '../npc';
import { launchOperation } from '../operations';
import {
  canTeach,
  liveTraining,
  startTraining,
  stopTraining,
  trainingList,
} from '../training';
import { TRAINING } from '../../config/training';
import { OPERATION_BY_ID } from '../../config/operations';
import { SAVE_VERSION } from '../state';
import type { GameState, Npc } from '../types';

function game(seed = 5): GameState {
  const state = newGame({ name: 'Teacher', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 8) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 200_000;
  for (const t of Object.values(state.territories)) t.influence.player = 60;
  return state;
}

/** Two men with a decided gap between them, so the arithmetic is readable. */
function pair(state: GameState, teacher: number, student: number): [Npc, Npc] {
  const crew = crewList(state).filter((n) => n.status === 'active');
  crew[0].stats.skill = teacher;
  crew[1].stats.skill = student;
  return [crew[0], crew[1]];
}

function runTo(state: GameState, day: number): void {
  while (state.day < day) advanceDay(state);
}

describe('work teaches', () => {
  it('makes a man better at it', () => {
    const state = game();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const man = crewList(state).filter((n) => n.status === 'active')[0];
    man.stats.skill = 20;
    const before = man.stats.skill;

    // Enough nights that the accumulator has to spill at least once.
    for (let i = 0; i < 40; i++) {
      const op = launchOperation(state, def.id, [man.id], Object.keys(state.territories)[0]);
      if (!op) throw new Error('the fixture cannot launch');
      op.successChance = 1;
      for (let d = 0; d < def.durationDays; d++) advanceDay(state);
    }

    expect(man.stats.skill).toBeGreaterThan(before);
  });

  it('does not touch a man who was left at home', () => {
    const state = game();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const [worker, idler] = pair(state, 20, 20);
    const was = idler.stats.skill;

    for (let i = 0; i < 20; i++) {
      const op = launchOperation(state, def.id, [worker.id], Object.keys(state.territories)[0]);
      if (!op) throw new Error('the fixture cannot launch');
      op.successChance = 1;
      for (let d = 0; d < def.durationDays; d++) advanceDay(state);
    }

    expect(idler.stats.skill).toBe(was);
    expect(worker.stats.skill).toBeGreaterThan(was);
  });

  /*
     The ceiling. Street work makes journeymen, not specialists — without this,
     a career of corner shakedowns ends with an exceptional crew and the second
     half of this feature has nothing to sell.
  */
  it('stops short of the top of the scale', () => {
    const state = game();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const man = crewList(state).filter((n) => n.status === 'active')[0];
    man.stats.skill = TRAINING.streetCeiling;

    for (let i = 0; i < 30; i++) {
      const op = launchOperation(state, def.id, [man.id], Object.keys(state.territories)[0]);
      if (!op) throw new Error('the fixture cannot launch');
      op.successChance = 1;
      for (let d = 0; d < def.durationDays; d++) advanceDay(state);
    }

    expect(man.stats.skill).toBeLessThanOrEqual(TRAINING.streetCeiling);
  });

  it('decelerates, so the first man you hired does not run away with it', () => {
    const state = game();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const [green, seasoned] = pair(state, 15, 50);
    const from = { green: green.stats.skill, seasoned: seasoned.stats.skill };

    for (let i = 0; i < 30; i++) {
      for (const man of [green, seasoned]) {
        const op = launchOperation(state, def.id, [man.id], Object.keys(state.territories)[0]);
        if (!op) continue;
        op.successChance = 1;
      }
      for (let d = 0; d < def.durationDays; d++) advanceDay(state);
    }

    expect(green.stats.skill - from.green).toBeGreaterThan(
      seasoned.stats.skill - from.seasoned,
    );
  });
});

describe('putting a man with somebody', () => {
  it('holds them both for the run of it', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const before = crewList(state).filter((n) => n.status === 'active').length;

    const started = startTraining(state, teacher.id, student.id);
    expect(started).toBeTruthy();
    expect(crewList(state).filter((n) => n.status === 'active').length).toBe(before - 2);
    expect(liveTraining(state)).toHaveLength(1);
  });

  it('refuses somebody who has nothing to teach', () => {
    const state = game();
    const [teacher, student] = pair(state, 30, 60);
    expect(canTeach(state, teacher.id, student.id).ok).toBe(false);
  });

  it('refuses a man who is already busy', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    teacher.status = 'busy';
    expect(canTeach(state, teacher.id, student.id).ok).toBe(false);
  });

  it('refuses to pair a man with himself', () => {
    const state = game();
    const [teacher] = pair(state, 70, 20);
    expect(canTeach(state, teacher.id, teacher.id).ok).toBe(false);
  });

  it('gives them both back and moves the student when it finishes', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = student.stats.skill;
    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');

    runTo(state, run.endDay + 1);

    expect(student.stats.skill).toBeGreaterThan(was);
    expect(state.npcs[teacher.id].status).toBe('active');
    expect(state.npcs[student.id].status).toBe('active');
    expect(liveTraining(state)).toHaveLength(0);
  });

  it('leaves the teacher no better than he was', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = teacher.stats.skill;
    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');
    runTo(state, run.endDay + 1);

    expect(teacher.stats.skill).toBe(was);
  });

  /*
     The property that makes *who teaches* the decision, rather than a button
     that says "improve somebody".
  */
  it('cannot take a man past what his teacher knows', () => {
    const state = game();
    const [teacher, student] = pair(state, 45, 20);
    let run = startTraining(state, teacher.id, student.id);
    for (let i = 0; i < 12 && run; i++) {
      runTo(state, run.endDay + 1);
      run = startTraining(state, teacher.id, student.id);
    }

    expect(student.stats.skill).toBeLessThanOrEqual(teacher.stats.skill);
  });

  it('teaches less the closer they already are', () => {
    const state = game();
    const wide = game(6);
    const [t1, s1] = pair(state, 80, 20);
    const [t2, s2] = pair(wide, 80, 70);

    const a = startTraining(state, t1.id, s1.id);
    const b = startTraining(wide, t2.id, s2.id);
    if (!a || !b) throw new Error('the fixture cannot start');
    const from = { s1: s1.stats.skill, s2: s2.stats.skill };
    runTo(state, a.endDay + 1);
    runTo(wide, b.endDay + 1);

    expect(s1.stats.skill - from.s1).toBeGreaterThan(s2.stats.skill - from.s2);
  });

  /*
     What else comes across. A sloppy teacher is not a free gain, and the man
     you trained knows what he is worth — the same move `STANDING.carry` makes,
     for the reason recorded there: raising greed *is* raising his price,
     through the path that already exists.
  */
  it('passes on how careful the teacher is, not only how good', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    teacher.stats.discipline = 10;
    student.stats.discipline = 80;
    const was = student.stats.discipline;

    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');
    runTo(state, run.endDay + 1);

    expect(student.stats.discipline).toBeLessThan(was);
  });

  it('leaves the student wanting more than he did', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = { greed: student.stats.greed, ambition: student.stats.ambition };

    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');
    runTo(state, run.endDay + 1);

    expect(student.stats.greed).toBeGreaterThan(was.greed);
    expect(student.stats.ambition).toBeGreaterThan(was.ambition);
  });

  it('tells you who he is as well as making him better', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = student.familiarity;

    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');
    runTo(state, run.endDay + 1);

    expect(student.familiarity).toBeGreaterThan(was);
  });

  it('comes apart if one of them is taken', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = student.stats.skill;
    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');

    advanceDay(state);
    teacher.status = 'arrested';
    teacher.unavailableUntilDay = state.day + 60;
    runTo(state, run.endDay + 1);

    expect(liveTraining(state)).toHaveLength(0);
    expect(student.stats.skill).toBe(was);
    expect(state.npcs[student.id].status).toBe('active');
  });

  it('can be called off, and gives the days back to nobody', () => {
    const state = game();
    const [teacher, student] = pair(state, 70, 20);
    const was = student.stats.skill;
    const run = startTraining(state, teacher.id, student.id);
    if (!run) throw new Error('the fixture cannot start');

    advanceDay(state);
    stopTraining(state, run.id);

    expect(liveTraining(state)).toHaveLength(0);
    expect(student.stats.skill).toBe(was);
    expect(state.npcs[teacher.id].status).toBe('active');
    expect(state.npcs[student.id].status).toBe('active');
  });
});

describe('the state it keeps', () => {
  it('is absent until somebody trains, and does not move the save format', () => {
    const state = game();
    expect(state.training).toBeUndefined();
    expect(SAVE_VERSION).toBe(13);

    trainingList(state);
    expect(state.training).toEqual([]);
  });
});
