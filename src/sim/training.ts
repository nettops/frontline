/**
 * Getting better at it: the machine.
 *
 * The table and the reasoning are in `config/training.ts`. This file owns the
 * two ways a man's skill can move, and they are deliberately different shapes.
 *
 * **Work teaches**, through `learnFromWork`, called once per man per job from
 * `resolveOperation`. It uses the same accumulator the player's own attributes
 * use — progress spills into a point against a rising cost — so nothing here
 * invents a second way to model the same idea.
 *
 * **Men teach**, through a pairing with a deadline. That is the ordinary
 * optional-state shape this codebase uses for anything with a clock on it, and
 * the cost is two bodies for the run of it: the same bill a district steward
 * and a score's held man are charged, and the one the measurement says bites.
 */

import { clamp } from './rng';
import type { GameState, Id, Npc, Training } from './types';
import { addLog, nextId } from './util';
import { addNote, gainFamiliarity } from './npc';
import { TRAINING, skillProgressNeeded } from '../config/training';
import { STAT_BANDS } from '../config/npcs';

/** Where a stat sits on its own five-word ladder. */
function bandOf(value: number): string {
  const words = STAT_BANDS.skill;
  const i = clamp(Math.floor(value / (100 / words.length)), 0, words.length - 1);
  return words[i];
}

// ------------------------------------------------------- work teaches -----

/**
 * A night out, and what it left him with.
 *
 * Mirrors `trainAttribute` in `player.ts` — an accumulator spilling into a
 * point against a rising cost — with its own curve, because that one is sized
 * for attributes running 1 to 20 and these stats run 0 to 100. See
 * `skillProgressNeeded`. `skillProgress` is optional and lazily created, so a save written
 * before this existed loads with everybody's progress at zero — which for
 * those saves is exactly true.
 *
 * Silent unless he crosses a band. A line every time somebody gained a point
 * of skill would be four lines a day in a busy week, and the number itself is
 * behind the perception fog anyway — what a player can actually notice is a
 * man going from *learning* to *competent*.
 */
export function learnFromWork(
  state: GameState,
  npc: Npc,
  tier: number,
  worked: boolean,
): void {
  if (npc.stats.skill >= TRAINING.streetCeiling) return;

  const gain =
    TRAINING.perJob * (1 + tier * TRAINING.perTier) * (worked ? 1 : TRAINING.onFailure);
  npc.skillProgress = (npc.skillProgress ?? 0) + gain;

  const was = bandOf(npc.stats.skill);
  while (
    npc.stats.skill < TRAINING.streetCeiling &&
    npc.skillProgress >= skillProgressNeeded(npc.stats.skill)
  ) {
    npc.skillProgress -= skillProgressNeeded(npc.stats.skill);
    npc.stats.skill += 1;
  }
  const now = bandOf(npc.stats.skill);
  if (now !== was) {
    addNote(npc, state.day, `Has come on. ${now} now.`, 'good');
    addLog(state, `${npc.name} has come on with the work. ${now} now.`, 'crew');
  }
}

// -------------------------------------------------------- men teach -------

/**
 * Everything anybody is being shown, lazily.
 *
 * Optional state with a lazy initialiser, the same idiom `orders`, `promises`,
 * `civic` and `scores` use — so `SAVE_VERSION` does not move and a save
 * written before this existed loads with nobody being taught anything.
 */
export function trainingList(state: GameState): Training[] {
  if (!state.training) state.training = [];
  return state.training;
}

export function liveTraining(state: GameState): Training[] {
  return (state.training ?? []).filter((t) => t.status === 'running');
}

/** The pairing a given man is tied up in, either side of it. */
export function trainingFor(state: GameState, npcId: Id): Training | undefined {
  return liveTraining(state).find((t) => t.teacherId === npcId || t.studentId === npcId);
}

export interface TeachCheck {
  ok: boolean;
  reason: string | null;
}

export function canTeach(state: GameState, teacherId: Id, studentId: Id): TeachCheck {
  if (teacherId === studentId) {
    return { ok: false, reason: 'Nobody learns anything from their own company.' };
  }
  const teacher = state.npcs[teacherId];
  const student = state.npcs[studentId];
  if (!teacher || !student) return { ok: false, reason: 'One of them is not yours.' };
  if (teacher.status !== 'active') {
    return { ok: false, reason: `${teacher.name} is not available.` };
  }
  if (student.status !== 'active') {
    return { ok: false, reason: `${student.name} is not available.` };
  }
  /*
     You cannot teach past what you know, and that is the whole decision.

     Checked as a refusal rather than left to produce a gain of nothing,
     because a button that runs for twelve days and moves no number is worse
     than one that says why.
  */
  if (teacher.stats.skill <= student.stats.skill) {
    return { ok: false, reason: `${teacher.name} has nothing to show them.` };
  }
  return { ok: true, reason: null };
}

/**
 * Put one man with another.
 *
 * Both are held for the run of it. That is the honest reading of "they are off
 * learning" and it is the bill this game is short of — the measured cause of a
 * dead week is a shortage of people, never of money.
 */
export function startTraining(
  state: GameState,
  teacherId: Id,
  studentId: Id,
): Training | null {
  if (!canTeach(state, teacherId, studentId).ok) return null;

  const teacher = state.npcs[teacherId];
  const student = state.npcs[studentId];
  const until = state.day + TRAINING.days;
  for (const man of [teacher, student]) {
    man.status = 'busy';
    man.unavailableUntilDay = until;
  }

  const run: Training = {
    id: nextId(state, 'train'),
    teacherId,
    studentId,
    startDay: state.day,
    endDay: until,
    status: 'running',
  };
  trainingList(state).push(run);
  addLog(
    state,
    `${student.name} is with ${teacher.name} for ${TRAINING.days} days. Neither is available.`,
    'crew',
  );
  return run;
}

/** Give them both back, without anybody having learned anything. */
export function stopTraining(state: GameState, id: Id): void {
  const run = (state.training ?? []).find((t) => t.id === id);
  if (!run || run.status !== 'running') return;
  release(state, run);
  run.status = 'stopped';
  run.settledDay = state.day;
}

/**
 * Hand a man back, but only if this is what is holding him.
 *
 * A teacher who was arrested halfway through has a timer of his own now, and
 * it is not this one's to clear.
 */
function release(state: GameState, run: Training): void {
  for (const id of [run.teacherId, run.studentId]) {
    const man = state.npcs[id];
    if (man && man.status === 'busy' && man.unavailableUntilDay === run.endDay) {
      man.status = 'active';
      man.unavailableUntilDay = null;
    }
  }
}

/**
 * What twelve days with somebody was worth.
 *
 * A share of the gap rather than a flat figure, for the same reason the heat
 * and case meters were repaired to work that way: a flat rate teaches a man
 * who knows nothing exactly as much as one who nearly matches his teacher. It
 * also gives the ceiling for free — a share of a gap that has closed is
 * nothing, so nobody is ever taught past what his teacher knows.
 */
function finish(state: GameState, run: Training): void {
  const teacher = state.npcs[run.teacherId];
  const student = state.npcs[run.studentId];
  if (!teacher || !student) return;

  const was = bandOf(student.stats.skill);
  const gap = teacher.stats.skill - student.stats.skill;
  if (gap > 0) {
    student.stats.skill = clamp(student.stats.skill + gap * TRAINING.closesGap, 0, 100);
  }
  // And how careful he is, which is not always a gift. Both directions: a
  // sloppy teacher makes a sloppy student.
  student.stats.discipline = clamp(
    student.stats.discipline +
      (teacher.stats.discipline - student.stats.discipline) * TRAINING.disciplineShare,
    0,
    100,
  );
  // He knows what he is worth now. `wageExpectation` reads greed, so this is
  // his price going up through the path that already exists.
  student.stats.ambition = clamp(student.stats.ambition + TRAINING.taught.ambition, 0, 100);
  student.stats.greed = clamp(student.stats.greed + TRAINING.taught.greed, 0, 100);
  // Twelve days in a room with somebody tells you who he is.
  gainFamiliarity(student, TRAINING.familiarity);

  const now = bandOf(student.stats.skill);
  addNote(
    student,
    state.day,
    `Spent ${TRAINING.days} days with ${teacher.name}. ${now} now.`,
    'good',
  );
  addLog(
    state,
    now !== was
      ? `${student.name} came back from ${teacher.name} ${now}.`
      : `${student.name} came back from ${teacher.name} better than they went.`,
    'crew',
  );
}

/**
 * Daily, beside `tickScores` and for the same reason: a deadline is a day.
 *
 * A pairing that loses either man comes apart with nothing learned. That is
 * not a punishment on top of the arrest — it is what happens when the man
 * teaching you is in a cell.
 */
export function tickTraining(state: GameState): void {
  for (const run of liveTraining(state)) {
    const teacher = state.npcs[run.teacherId];
    const student = state.npcs[run.studentId];
    const lost =
      !teacher ||
      !student ||
      (teacher.status !== 'busy' && teacher.status !== 'active') ||
      (student.status !== 'busy' && student.status !== 'active');

    if (lost) {
      release(state, run);
      run.status = 'stopped';
      run.settledDay = state.day;
      addLog(state, 'That came apart. Nobody learned anything.', 'crew');
      continue;
    }

    if (state.day < run.endDay) continue;
    finish(state, run);
    release(state, run);
    run.status = 'done';
    run.settledDay = state.day;
  }
}
