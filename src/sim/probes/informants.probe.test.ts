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
import { activeCases } from '../investigation';
import { addEvidence } from '../util';
import type { GameState, Id } from '../types';
import { answerCheaply, idle, median, resolves, runDaysSolvent } from '../__tests__/helpers';

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

   Raised again, forty to a hundred and twenty, for the same reason and with
   the same rule. Two houses were added to the pool in config/houses.ts and the
   control went from 3 usable worlds in 20 to 7 in 22, which fails
   `framed < caught / 2`. Nothing about the read changed: measured over two
   hundred seeds it is 12/94 framed against 47/94 caught on the larger pool and
   11/91 against 48/91 on the smaller — 13% versus 50%, either way. What the
   houses moved is which cities the fixed seeds draw, and twenty-odd worlds
   cannot separate 13% from 50% reliably enough to assert it. At a hundred and
   twenty the control reads 9 against a bar of 16.

   The bar has not moved and must not. If this ever goes red again the first
   question is whether the read has actually stopped working, and the answer is
   a bigger sample, not a smaller number.
*/
const SEEDS = 120;
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

/* ========================================================================== *
 * Does the seat ever get filled, and by what?
 * ========================================================================== */

/**
 * Everything above plants its informant, and that is correct for what it asks.
 *
 * `watch` sets `informingSince` by hand because the question there is whether a
 * player can *read* the record — planting is what makes the two columns
 * comparable. The consequence is that until now nothing in this project had
 * ever measured whether the record gets written at all. A whole mechanic could
 * have been unreachable in ordinary play and the suite would have been green.
 *
 * That gap was found while raising `INFORMANT.fearAbove`, and the first reading
 * of it was misread twice, which is why the shape of what is counted here
 * matters more than the numbers.
 *
 * **Counting informants alive says nothing.** `tickInformants` runs the flip
 * loop only when `informants(state).length === 0` — one at a time, deliberately,
 * with the measurement recorded there: at a free-for-all rate half the crew was
 * talking inside a year and the read was worth 5 worlds in 16 against 13 in 15
 * with the cap. So "one informant alive" is the ceiling and not a rate.
 *
 * What is a rate is **how much of a career somebody spends talking**, and how
 * often the seat turns over. That is what these measure.
 */
describe('whether anybody ever starts talking on their own', () => {
  interface Flip {
    /** Days on which somebody was informing, as a share of the career. */
    occupied: number;
    /**
     * Distinct men who ever informed.
     *
     * Reads 1.0 for both bots and that is mostly a fact about the bots: they
     * never accuse anybody, so the seat is never vacated. What it does say is
     * that nobody stops talking of their own accord — the turnover a player
     * would see comes from acting on the record, not from the simulation
     * changing its mind.
     */
    distinct: number;
    /** Day the first one turned, or null. */
    firstDay: number | null;
    caseDays: number;
    crewEnd: number;
    days: number;
  }

  /**
   * A career, played straight, with nothing planted and no case forced.
   *
   * `everyDays` is the only lever: 1 grinds the crew, 4 works them at a
   * measured pace. Both matter because the gates are `fear`, `loyalty` and a
   * carried memory, and all three move with how hard people are worked — the
   * question is whether the mechanic can tell those two bosses apart.
   *
   * Kept solvent for the reason the file's other bot is: an insolvent career
   * dissolves its crew, and a crew of nobody has nobody to turn. The economy is
   * measured in `balance` and `broke.probe`.
   */
  function career(seed: number, everyDays: number): Flip {
    const state = newGame({ name: 'Flip', difficulty: 'normal', seed });
    const rng = new Rng(state.rng);
    const seen = new Set<Id>();
    let occupied = 0;
    let caseDays = 0;
    let firstDay: number | null = null;
    let days = 0;

    runDaysSolvent(state, 300, {
      floor: 500_000,
      answer: answerCheaply,
      onDay: (s, day) => {
        days++;
        if (activeCases(s).length > 0) caseDays++;
        const talking = crewList(s).filter((n) => n.informingSince !== undefined);
        if (talking.length) {
          occupied++;
          if (firstDay === null) firstDay = s.day;
          for (const n of talking) seen.add(n.id);
        }
        if (day % everyDays === 0) workADay(s, day, rng);
        for (const id of Object.keys(s.recruits)) {
          if (canRecruit(s, id).ok) recruit(s, id);
        }
      },
    });

    return {
      occupied: days ? occupied / days : 0,
      distinct: seen.size,
      firstDay,
      caseDays: days ? caseDays / days : 0,
      crewEnd: crewList(state).filter((n) => n.status !== 'dead').length,
      days,
    };
  }

  const SEEDS = Array.from({ length: 24 }, (_, i) => 700 + i);
  const grind = SEEDS.map((s) => career(s, 1));
  const measured = SEEDS.map((s) => career(s, 4));

  const share = (runs: Flip[]) => runs.filter((r) => r.firstDay !== null).length;
  const occ = (runs: Flip[]) => median(runs.map((r) => r.occupied));

  it('ran worlds where the mechanic could have happened at all', () => {
    /*
       The guard this project keeps relearning: a probe that did not play still
       reports a number. Nobody talks until somebody is asking, so a run with no
       open case measures the absence of police work rather than the absence of
       informants — and a run with no crew has nobody to turn.
    */
    for (const [label, runs] of [['grinding', grind], ['measured', measured]] as const) {
      expect(median(runs.map((r) => r.days)), `${label}: the careers did not run`).toBeGreaterThan(200);
      expect(median(runs.map((r) => r.crewEnd)), `${label}: no crew to turn`).toBeGreaterThanOrEqual(4);
      expect(
        median(runs.map((r) => r.caseDays)),
        `${label}: nobody was ever investigating, so nobody had anybody to talk to`,
      ).toBeGreaterThan(0.1);
    }
  });

  it('says how often the seat is filled, and by whom', () => {
    const line = (label: string, runs: Flip[]) => {
      const first = runs.map((r) => r.firstDay).filter((d): d is number => d !== null);
      return (
        `  ${label.padEnd(10)} ${String(share(runs)).padStart(2)}/${runs.length} careers ever had one; ` +
        `somebody was talking on ${(occ(runs) * 100).toFixed(0)}% of days\n` +
        `             first turned day ${first.length ? median(first).toFixed(0) : '—'}; ` +
        `${median(runs.map((r) => r.distinct)).toFixed(1)} distinct men (this bot never accuses); ` +
        `a case was open on ${(median(runs.map((r) => r.caseDays)) * 100).toFixed(0)}% of days`
      );
    };
    console.log(
      `\nflip: ${SEEDS.length} careers each, 300 days, nothing planted\n` +
        `${line('grinding', grind)}\n${line('measured', measured)}\n`,
    );
  });

  /**
   * Reachable at all, which is the claim nothing had ever checked.
   *
   * A mechanic the player is asked to read a page for, kill a man over, and be
   * uncertain about has to actually occur. Set at a third of careers rather
   * than at most of them because the seat is capped at one and the gates are an
   * AND of three — this is a bar on the mechanic existing, not on it being
   * common.
   */
  it('is reachable in an ordinary career', () => {
    const hit = share(grind);
    const verdict = resolves(hit, grind.length, 1 / 3);
    expect(verdict.ok, verdict.why).toBe(true);
    expect(
      hit,
      `${hit} of ${grind.length} careers ever had somebody talking. Nothing plants an ` +
        `informant in ordinary play, so if this is near zero the whole Intelligence ` +
        `page is a screen about something that does not happen.`,
    ).toBeGreaterThan(grind.length / 3);
  });

  /**
   * And not a fact of the calendar.
   *
   * The failure mode on the other side. If the seat is filled in nearly every
   * career whatever the boss does, "somebody is talking" is weather rather than
   * a consequence, and the player has nothing to have done differently.
   */
  it('is not simply what happens to everybody', () => {
    expect(
      occ(grind),
      `somebody is talking on ${(occ(grind) * 100).toFixed(0)}% of days even when grinding, ` +
        `which is close enough to always that it is weather rather than something the ` +
        `boss did`,
    ).toBeLessThan(0.85);
  });

  /**
   * The property that makes it a mechanic rather than a die roll: working
   * people harder gets more of them talking.
   *
   * All three gates move with how the crew is treated — fear rises with
   * arrests, loyalty falls with the work, and the memories that count are the
   * ones the work leaves. Stated as a direction rather than a size, because the
   * size is what `INFORMANT` is for and this is the thing that must not invert.
   */
  it('answers to how the boss works his people', () => {
    expect(
      occ(grind),
      `a boss who grinds his crew has somebody talking on ${(occ(grind) * 100).toFixed(0)}% of days ` +
        `and one who works them at a measured pace on ${(occ(measured) * 100).toFixed(0)}% — ` +
        `so how people are treated has stopped reaching who talks`,
    ).toBeGreaterThan(occ(measured));
  });
});
