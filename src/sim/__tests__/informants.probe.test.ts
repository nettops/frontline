/**
 * Is somebody talking a read, or a lottery?
 *
 * The mechanic asks the player to look at a column of nights, see which name
 * keeps appearing, and then kill a man on the strength of it. That is only a
 * decision if the record is worth meaningfully more than a guess and
 * meaningfully less than a certainty. This file measures exactly that, between
 * two figures:
 *
 *   a guess       one crew member in about ten
 *   the record    the man who appears on the most nights, after forty weeks
 *
 * What is measured is the *player's* read, not the truth. A probe that reached
 * into `sourceId` would be checking that the simulation is self-consistent,
 * which was never in doubt. This one reads the two columns the Intelligence
 * panel prints and nothing else.
 *
 * Three instrument failures were found while writing it, all of the same family
 * as the one that made an earlier probe report a payroll spiral it had
 * invented. Each is documented at the point it bit, because the lesson is not
 * "be careful" — it is that a measurement returning a plausible number is the
 * normal presentation of a broken measurement.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { availableOperations, launchOperation } from '../operations';
import { crewList } from '../npc';
import { operableTerritories } from '../territory';
import { canRecruit, recruit } from '../crew';
import { timesPresent } from '../informants';
import { addEvidence } from '../util';
import type { GameState, Id } from '../types';
import { answerCheaply, idle, runDaysSolvent } from './helpers';

function where(state: GameState): string {
  const options = operableTerritories(state);
  return options.length ? options[0].territory.id : Object.keys(state.territories)[0];
}

/**
 * A day of ordinary work.
 *
 * Three things about this bot matter and none of them is its earnings.
 *
 * It **recruits**, because a career starts with one man and a roster of one has
 * nothing to intersect. The first draft did not, and all twenty worlds were
 * discarded for having no crew — reported, of course, as "the record is
 * unreadable".
 *
 * It **rotates**, because a player who always sends the same three men makes
 * every leak name the same three men.
 *
 * It is **kept solvent**, which is the one liberty taken here. Left to itself it
 * could not run a business: heat climbed, work stopped, wages went unpaid, and
 * every world ended with the crew dissolved — including the man who was
 * supposed to be talking. The economy is measured properly in `balance` and
 * `broke.probe`; holding it still here leaves the thing under test as the only
 * thing moving.
 */
function workADay(state: GameState, _day: number, rng: Rng): void {
  for (const id of Object.keys(state.recruits)) {
    if (canRecruit(state, id).ok) recruit(state, id);
  }

  if (state.org.heat < 88) {
    const free = idle(state);
    const def = availableOperations(state)
      .filter((d) => d.crewRequired <= free.length && d.crewRequired > 0)
      .sort((a, b) => b.crewRequired - a.crewRequired)[0];
    if (def) {
      const picked = [...free].sort(() => rng.float(-1, 1)).slice(0, def.crewRequired);
      launchOperation(
        state,
        def.id,
        picked.map((n) => n.id),
        where(state),
      );
    }
  }
}

/**
 * The plainest possible reading of the page: whichever name appears on the most
 * of the nights.
 *
 * Deliberately the naive one. Two cleverer statistics were tried — leaks
 * against nights worked, and leaks against what his share of the work would
 * predict — and both scored *worse* (6 and 9 worlds in 29, against 15), because
 * both are dominated by men with three jobs and two bad nights. Counting is what
 * a person does when they look at a list, so counting is what gets measured.
 */
function whoAPlayerWouldSuspect(state: GameState): Id | null {
  const rows = timesPresent(state);
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => (a.leaks >= b.leaks ? a : b)).id;
}

interface Run {
  /** Did the read land on the marked man? */
  named: boolean;
  crewSize: number;
  leaks: number;
}

/**
 * One career, watched for forty weeks after somebody starts talking.
 *
 * `plant` decides whether the marked man is the informant or the control: same
 * seed, same bot, same marked man, and the only difference in the world is
 * whether he is talking. That is what makes the two columns comparable. Running
 * the control on different seeds — which is what it did first — compares two
 * different cities and answers nothing.
 */
function watch(seed: number, plant: boolean): Run | null {
  const state = newGame({ name: 'Leak', difficulty: 'normal', seed });

  runDaysSolvent(state, 150, { floor: 500_000, answer: answerCheaply, onDay: workADay });

  const pool = crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
  if (pool.length < 4) return null;
  const mark = pool[Math.floor(pool.length / 2)];
  if (plant) mark.informingSince = state.day;

  /*
     Somebody has to be asking, or nobody talks.

     A case is normally the consequence of a hundred small things; forcing one
     open keeps the measurement about the record rather than about how quickly
     this particular seed happened to attract attention.
  */
  addEvidence(state, {
    day: state.day,
    source: 'operation',
    strength: 90,
    npcIds: [],
    detail: 'A file exists.',
  });
  state.org.heat = Math.max(state.org.heat, 60);

  runDaysSolvent(state, 280, { floor: 500_000, answer: answerCheaply, onDay: workADay });

  return {
    named: whoAPlayerWouldSuspect(state) === mark.id,
    crewSize: crewList(state).filter((n) => n.status !== 'dead' && n.status !== 'defected')
      .length,
    leaks: (state.leaks ?? []).length,
  };
}

/*
   Thirty worlds gave nineteen usable ones against a guard of twenty, and a
   guard with no margin flaps on work that has nothing to do with it — the
   evidence change reshuffled which families still had four men at day 150 and
   knocked one world out.

   Raised rather than the bar lowered. The claim below is unchanged; there are
   simply more worlds for it to be true in.
*/
const SEEDS = 40;
const talking = Array.from({ length: SEEDS }, (_, i) => watch(300 + i, true)).filter(
  (r): r is Run => r !== null,
);
const quiet = Array.from({ length: SEEDS }, (_, i) => watch(300 + i, false)).filter(
  (r): r is Run => r !== null,
);

describe('reading the record', () => {
  it('ran enough worlds, and they were worlds where something happened', () => {
    /*
       The guard that would have caught every instrument failure in this
       project's history, had it existed earlier. A run that produced no leaks
       is a run in which the probe did not play — and a probe that did not play
       still reports a number.
    */
    expect(talking.length).toBeGreaterThanOrEqual(20);
    expect(talking.filter((r) => r.leaks > 0).length).toBe(talking.length);
    expect(talking.every((r) => r.crewSize >= 4)).toBe(true);
  });

  it('is worth several times a guess', () => {
    const right = talking.filter((r) => r.named).length;
    const crew = talking.reduce((s, r) => s + r.crewSize, 0) / talking.length;
    const guess = 1 / crew;
    const read = right / talking.length;

    // eslint-disable-next-line no-console
    console.log(
      `informants: the record named him in ${right}/${talking.length} worlds ` +
        `(${(read * 100).toFixed(0)}%), against ${(guess * 100).toFixed(0)}% ` +
        `for picking one of ${crew.toFixed(1)} men out of the air`,
    );

    expect(read, 'the record is worth no more than a guess').toBeGreaterThan(guess * 2.5);
  });

  it('is still a coin flip, so acting on it is a risk rather than a formality', () => {
    /*
       The assertion that protects the design rather than the code.

       If this ever passes 90% the cold leaks have stopped working and the page
       has become an answer with a delay — at which point the accusation is not
       a decision, it is a button labelled "remove informant", and the reason
       for building any of it went with it.
    */
    const read = talking.filter((r) => r.named).length / talking.length;
    expect(read, 'the record is never wrong — the noise has stopped working').toBeLessThan(0.9);
  });

  it('does not name the same man when he is not talking', () => {
    /*
       Same seed, same bot, same man, one bit different.

       This is what separates "the read found the informant" from "the read
       found the hardest worker". If these two numbers were close, everything
       above would be a measurement of the roster.
    */
    const framed = quiet.filter((r) => r.named).length;
    const caught = talking.filter((r) => r.named).length;
    // eslint-disable-next-line no-console
    console.log(
      `informants control: the same man was named in ${framed}/${quiet.length} worlds ` +
        `where he was not talking`,
    );
    expect(framed).toBeLessThan(caught / 2);
  });
});
