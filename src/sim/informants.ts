/**
 * Somebody talking, and what it costs to decide who.
 *
 * The design and the three rules that keep this a read rather than a puzzle
 * live in `config/informants.ts`. This is the machine: it turns people, it
 * hands nights over, it manufactures the nights nobody handed over, and it
 * carries out an accusation.
 *
 * Two rules the code has to hold on its own, because no amount of config can:
 *
 * - **`sourceId` never leaves this module.** It is written, it is read here,
 *   and nothing in the UI is given a way to ask. `readLeaks` exists precisely
 *   so no panel is ever handed the raw record.
 *
 * - **An accusation returns the same sentence either way.** The difference
 *   between killing the right man and the wrong one is entirely in what happens
 *   over the following months. If this file ever starts saying which one
 *   happened, the mechanic is over.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Leak, Npc, OperationResult } from './types';
import { INFORMANT } from '../config/informants';
import { addEvidence, addLog } from './util';
import { addHeat } from './heat';
import { addNote, crewList } from './npc';
import { informFromMemory, remember } from './memory';
import { gainFear, gainRespect } from './player';
import { activeCases } from './investigation';
import { territoryDef } from './territory';

export interface Check {
  ok: boolean;
  message: string;
}

function leakList(state: GameState): Leak[] {
  if (!state.leaks) state.leaks = [];
  return state.leaks;
}

/** Everybody who is currently talking. Never called by anything player-facing. */
function informants(state: GameState): Npc[] {
  return crewList(state).filter(
    (n) => n.informingSince !== undefined && n.status !== 'dead' && n.status !== 'defected',
  );
}

// ---------------------------------------------------------------- turning ---

/**
 * Whether this man is reachable at all.
 *
 * Three things about him and one about the world. The three are the ones the
 * informant-scare event has always tested — he is frightened, he is not
 * convinced, and he is carrying something specific that an investigator can
 * put a hand on. The fourth is that somebody is actually building a case,
 * because a frightened man with nobody to talk to stays a frightened man.
 */
function reachable(state: GameState, npc: Npc): boolean {
  if (npc.informingSince !== undefined) return false;
  if (npc.status === 'dead' || npc.status === 'defected') return false;
  return (
    npc.stats.fear > INFORMANT.fearAbove &&
    npc.stats.loyalty < INFORMANT.loyaltyBelow &&
    informFromMemory(npc, state.day) >= INFORMANT.memoryAtLeast
  );
}

function turn(npc: Npc, day: number): void {
  npc.informingSince = day;
  /*
     Nothing is logged and nothing is noted.

     Every other state change in this simulation announces itself somewhere,
     and this one must not: the player's only route to it is the record of what
     the other side turns out to know. A line in the log here would end the
     mechanic on the day it started.
  */
}

// ---------------------------------------------------------------- talking ---

function recentJobs(state: GameState): OperationResult[] {
  return state.operationHistory.filter(
    (r) => state.day - r.day <= INFORMANT.recallDays && r.crewIds.length > 0,
  );
}

/**
 * The nights still on the page.
 *
 * One window for both columns, and it is the same window a leak can be about.
 * An earlier version counted nights worked over a fixed four months while the
 * leak column ran back as far as the ledger reached, so the two numbers the
 * player is asked to compare were measured over different spans — which makes
 * the comparison meaningless in exactly the games where it matters most, the
 * quiet ones where work has slowed.
 */
function onThePage(state: GameState): Leak[] {
  return (state.leaks ?? []).filter((l) => state.day - l.day <= INFORMANT.recallDays);
}

function record(state: GameState, job: OperationResult, sourceId: Id | null): Leak {
  const leak: Leak = {
    day: state.day,
    opId: job.id,
    opName: job.name,
    territoryId: job.territoryId,
    knewIds: [...job.crewIds],
    sourceId,
  };
  state.leaks = [leak, ...leakList(state)].slice(0, INFORMANT.ledgerLength);
  return leak;
}

/**
 * What the player is told, which is everything except the one thing that
 * matters. Exported as the only way to read the record, so no panel is ever
 * holding a `sourceId`.
 */
export interface LeakLine {
  day: number;
  opName: string;
  district: string;
  who: { id: Id; name: string }[];
}

export function readLeaks(state: GameState): LeakLine[] {
  return onThePage(state).map((leak) => ({
    day: leak.day,
    opName: leak.opName,
    district: territoryDef(leak.territoryId).name,
    who: leak.knewIds.map((id) => ({ id, name: state.npcs[id]?.name ?? 'somebody since gone' })),
  }));
}

/**
 * How many of the nights each man was there for, against how many he worked.
 *
 * Two counts and no third number. Counting is something the player could do
 * with a pencil and a straight edge, so refusing to do it for them would be
 * tedium rather than difficulty — but the comparison between the two columns is
 * the entire read, and the game does not make it. There is no share, no
 * percentage, no ordering by anything but the raw leak count, and no opinion
 * about what any of it means.
 *
 * The confound is deliberate and is the trap: the man who works the most nights
 * appears on the most leaks whether or not he has said a word. A player who
 * reads only the first column will eventually kill their hardest worker.
 */
export interface Presence {
  id: Id;
  name: string;
  /** Leaked nights he was there for. */
  leaks: number;
  /** Nights he worked at all, over the same window. */
  jobs: number;
  /**
   * Dead, defected, or otherwise no longer anybody's problem.
   *
   * The window this table reads is longer than a man lasts, so the people you
   * have already dealt with keep appearing in it — and they appear at the top,
   * because it sorts on the leak count and a man who stopped working still has
   * his old nights. A blind tester finished a 481-day career with 6 of the 16
   * rows belonging to men who were gone, two of them killed by him, listed as
   * "2 nights / 0 worked" and "5 / 0". `canAccuse` refuses them, so nothing
   * was exploitable; what they did was make the one comparison this whole
   * screen exists for unreadable, with a zero denominator, at the top of the
   * table.
   */
  gone: boolean;
}

export function timesPresent(state: GameState): Presence[] {
  const leaks = new Map<Id, number>();
  for (const leak of onThePage(state)) {
    for (const id of leak.knewIds) leaks.set(id, (leaks.get(id) ?? 0) + 1);
  }

  const jobs = new Map<Id, number>();
  for (const job of recentJobs(state)) {
    for (const id of job.crewIds) jobs.set(id, (jobs.get(id) ?? 0) + 1);
  }

  const isGone = (id: Id) => {
    const npc = state.npcs[id];
    return !npc || npc.status === 'dead' || npc.status === 'defected';
  };

  return [...new Set([...leaks.keys(), ...jobs.keys()])]
    .map((id) => ({
      id,
      name: state.npcs[id]?.name ?? 'somebody since gone',
      leaks: leaks.get(id) ?? 0,
      jobs: jobs.get(id) ?? 0,
      gone: isGone(id),
    }))
    .filter((row) => row.leaks > 0)
    // Men who are gone still belong on the page — a night they were on is a
    // night they were on — but never above the men you can still do something
    // about. They sort under, whatever their count.
    .sort((a, b) => Number(a.gone) - Number(b.gone) || b.leaks - a.leaks);
}

// ------------------------------------------------------------------- tick ---

export function tickInformants(state: GameState, rng: Rng): void {
  if (state.day % INFORMANT.intervalDays !== 0) return;

  // Nobody has anybody to talk to until somebody is asking.
  if (activeCases(state).length === 0) return;

  /*
     One at a time, and this is a design decision rather than a shortcut.

     An agency runs the source it has. More to the point, "who is talking" stops
     being a question the moment the answer can be "four of them": the player
     kills the man the record points at, the leaks carry on, and that reads as
     having been wrong even when it was right — which destroys the only feedback
     the mechanic ever gives. Measured at a free-for-all flip rate, half the
     crew was talking inside a year and the read was worth 5 worlds in 16; with
     the cap it is 13 in 15.
  */
  if (informants(state).length === 0) {
    for (const npc of crewList(state)) {
      if (!reachable(state, npc)) continue;
      const chance =
        INFORMANT.flipChancePerWeek *
        (npc.status === 'arrested' ? INFORMANT.arrestedMultiplier : 1);
      if (rng.chance(chance)) {
        turn(npc, state.day);
        break;
      }
    }
  }

  const jobs = recentJobs(state);
  if (jobs.length === 0) return;

  for (const npc of informants(state)) {
    if (npc.carefulUntilDay !== undefined && state.day < npc.carefulUntilDay) continue;
    if (!rng.chance(INFORMANT.leakChancePerWeek)) continue;

    const his = jobs.filter((j) => j.crewIds.includes(npc.id));
    if (his.length === 0) continue;
    const job = rng.pick(his);
    noteAftermath(state, record(state, job, npc.id));
    addEvidence(state, {
      day: state.day,
      source: 'informant',
      strength: Math.round(rng.float(INFORMANT.leakStrength[0], INFORMANT.leakStrength[1])),
      npcIds: [...job.crewIds],
      detail: `Somebody has described ${job.name} in ${territoryDef(job.territoryId).name} in detail.`,
    });
  }

  /*
     And the nights nobody gave them.

     A wiretap, a witness, a receipt, four men in a car for eleven weeks. The
     agency's own work produces exactly the same artefact as a man talking,
     because from where the player is standing there is no way to tell the two
     apart — and that indistinguishability is the mechanic.
  */
  if (rng.chance(INFORMANT.coldLeakChancePerWeek)) {
    const job = rng.pick(jobs);
    noteAftermath(state, record(state, job, null));
    addEvidence(state, {
      day: state.day,
      source: 'operation',
      strength: Math.round(
        rng.float(INFORMANT.coldLeakStrength[0], INFORMANT.coldLeakStrength[1]),
      ),
      npcIds: [...job.crewIds],
      detail: `They have put ${job.name} in ${territoryDef(job.territoryId).name} together on their own.`,
    });
  }
}

// ------------------------------------------------------------- afterwards ---

/**
 * What has come back since the last time you decided it was somebody.
 *
 * The right/wrong branch in `accuse` has always been real — a correct call
 * pays +14 respect and costs the room 5 loyalty, a wrong one costs 10 respect,
 * 16 loyalty and 20 grievance to every man in it, and the player is never told
 * which they paid. A blind tester killed two men across a 481-day career, both
 * of whom were in fact talking, and reported the outcome as identical in both
 * cases and therefore as a screen with no consequence behind it:
 *
 *   > "If the leak stopping is the payoff, I could not see it; if the leak
 *   > continuing is the punishment, I could not see that either. Right now,
 *   > not knowing costs nothing, so it isn't a burden — it's just missing
 *   > information."
 *
 * He was right about the thing that mattered. The design's own answer is
 * `INFORMANT.cautiousDays`: the real informant goes quiet for eight weeks
 * rather than stopping, so *the record going quiet is the only confirmation
 * there is* — and nothing on any screen tracked the record from the day of the
 * accusation, so a quiet page and a solved problem looked the same and so did
 * a page that had started filling up again.
 *
 * This counts, and says nothing about what the count means. Derived from the
 * dated note `accuse` already writes, so there is no new state and nothing to
 * migrate.
 */
export interface Aftermath {
  /** Who you decided it was, and when. */
  name: string;
  day: number;
  daysSince: number;
  /** Nights that have come back since. The whole read, and it adjudicates nothing. */
  sinceCount: number;
  /** The most recent of them, for the panel to date. */
  lastDay: number | null;
}

const DECIDED = 'You decided it was them.';

export function readAftermath(state: GameState): Aftermath | null {
  let best: { npc: Npc; day: number } | null = null;
  for (const npc of Object.values(state.npcs)) {
    for (const note of npc.notes ?? []) {
      if (note.text !== DECIDED) continue;
      if (!best || note.day > best.day) best = { npc, day: note.day };
    }
  }
  if (!best) return null;

  const since = leakList(state).filter((l) => l.day > best!.day);
  return {
    name: best.npc.name,
    day: best.day,
    daysSince: state.day - best.day,
    sinceCount: since.length,
    lastDay: since.length ? Math.max(...since.map((l) => l.day)) : null,
  };
}

/**
 * And the one line that makes it land without answering anything.
 *
 * Said the first time the record breaks its silence after an accusation, which
 * is the moment a player who was wrong could have found out and never did.
 * Deliberately not "you were wrong" — a leak after a correct call is possible
 * too, because somebody else can always start.
 */
export function noteAftermath(state: GameState, leak: Leak): void {
  const after = readAftermath(state);
  if (!after) return;
  // Only the first one. After that the page speaks for itself.
  if (after.sinceCount !== 1 || after.lastDay !== leak.day) return;
  addLog(
    state,
    `Something has come back that they could not have told anybody. ` +
      `${after.name} has been in the ground ${after.daysSince} days.`,
    'heat',
  );
}

// --------------------------------------------------------------- accusing ---

export function canAccuse(state: GameState, npcId: Id): Check {
  const npc = state.npcs[npcId];
  if (!npc) return { ok: false, message: 'No.' };
  if (npc.status === 'dead' || npc.status === 'defected') {
    return { ok: false, message: `${npc.name} is already gone.` };
  }
  if (onThePage(state).length === 0) {
    return { ok: false, message: 'Nothing has come back to you yet.' };
  }
  return { ok: true, message: `Decide it was ${npc.name}` };
}

/**
 * Deciding it was him.
 *
 * There is no lesser version. The game offers no way to watch him, no way to
 * test him and no way to ask — those exist elsewhere and none of them answer
 * this. What is on the table is a decision made on a count of names in a
 * column, and the only thing that ever confirms it is whether the column goes
 * quiet afterwards.
 */
export function accuse(state: GameState, npcId: Id): Check {
  const guard = canAccuse(state, npcId);
  if (!guard.ok) return guard;

  const npc = state.npcs[npcId];
  const wasTalking = npc.informingSince !== undefined;

  npc.status = 'dead';
  npc.unavailableUntilDay = null;
  npc.informingSince = undefined;
  addNote(npc, state.day, 'You decided it was them.', 'bad');

  // Killing one of your own is the same act whoever he turned out to be.
  addHeat(state, INFORMANT.heat, 'street', 'a man of yours found dead');
  addEvidence(state, {
    day: state.day,
    source: 'violence',
    strength: INFORMANT.evidenceStrength,
    npcIds: [npc.id],
    detail: `${npc.name} was killed. They worked for you and everybody knew it.`,
  });
  gainFear(state, INFORMANT.anyFearGain);

  const others = crewList(state).filter(
    (n) => n.id !== npc.id && n.status !== 'dead' && n.status !== 'defected',
  );

  if (wasTalking) {
    gainRespect(state, INFORMANT.correctRespect);
    gainFear(state, INFORMANT.correctFear);
    for (const other of others) {
      other.stats.loyalty = clamp(other.stats.loyalty + INFORMANT.anyLoyaltyHit, 0, 100);
    }
  } else {
    gainRespect(state, INFORMANT.wrongRespect);
    for (const other of others) {
      const close = other.ties.find(
        (t) => t.id === npc.id && t.trust >= INFORMANT.closeTrustAbove,
      );
      other.stats.loyalty = clamp(
        other.stats.loyalty +
          INFORMANT.wrongLoyaltyHit +
          (close ? INFORMANT.wrongCloseLoyaltyHit : 0),
        0,
        100,
      );
      other.stats.grievance = clamp(other.stats.grievance + INFORMANT.wrongGrievance, 0, 100);
      if (close) remember(other, state.day, 'lost_a_friend', npc.id);
    }

    /*
       And the man who is actually talking has learned something.

       He goes quiet rather than stopping, which is the worse outcome for the
       player: the record dries up for two months, and a record that has dried
       up is indistinguishable from a problem that has been solved.
    */
    for (const talker of informants(state)) {
      talker.carefulUntilDay = state.day + INFORMANT.cautiousDays;
    }
  }

  /*
     One sentence, and the same one either way.

     Everything above this line branched on whether he was talking. Nothing
     below it may, because the player is not entitled to know today — only to
     find out, over months, from whether anything else comes back.
  */
  addLog(
    state,
    `${npc.name} is dead. Everybody understood why, and nobody asked whether it was true.`,
    'failure',
  );
  return { ok: true, message: `${npc.name} is dead.` };
}
