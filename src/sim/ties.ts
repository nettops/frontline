/**
 * The organization as a set of people who know each other.
 *
 * Every edge in here was written by something that happened. There is no
 * initialisation pass that gives everybody an opinion of everybody — a new man
 * has no ties at all, and picks them up by working, by being passed over, and
 * by watching somebody else get what he wanted.
 *
 * A leaf module: it takes Npc objects and the day, never GameState systems, so
 * events, operations, succession and drift can all write to it without any of
 * them importing each other. That is also why the two one-line readers below
 * are copied rather than imported from npc.ts — npc.ts reads this file every
 * drift tick, and importing back would close the loop.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, Npc, Tie } from './types';
import {
  MAX_TIES,
  TIE_CAUSE_TEXT,
  TIE_DEPARTURE,
  TIE_DRIFT,
  TIE_EVENTS,
  TIE_FROM_OPERATION,
  type TieCause,
} from '../config/ties';

/** Dead, gone, or running the place. Local copy of npc.ts:isFormerCrew. */
function gone(npc: Npc): boolean {
  return npc.status === 'dead' || npc.status === 'defected' || npc.status === 'boss';
}

function here(state: GameState): Npc[] {
  return Object.values(state.npcs).filter((n) => !gone(n));
}

function note(npc: Npc, day: number, text: string, kind: 'neutral' | 'good' | 'bad'): void {
  npc.notes.unshift({ day, text, kind });
  if (npc.notes.length > 40) npc.notes.length = 40;
}

function find(npc: Npc, otherId: Id): Tie | undefined {
  return npc.ties.find((t) => t.id === otherId);
}

/**
 * Keeps the list short.
 *
 * Dropping the *weakest* rather than the oldest matters: a twelve-year-old
 * grudge is exactly the edge worth keeping, and a polite acquaintance from
 * last month is not.
 */
function trim(npc: Npc): void {
  if (npc.ties.length <= MAX_TIES) return;
  const weight = (t: Tie) => Math.max(t.trust, t.resentment, t.debt);
  npc.ties.sort((a, b) => weight(b) - weight(a));
  npc.ties.length = MAX_TIES;
}

/**
 * Records that something happened between two people.
 *
 * `from` is the one whose view changes. Some causes are mutual — working a job
 * together makes both men think a little better of each other — and most are
 * not: being passed over is entirely one-sided, which is what makes it useful.
 */
export function recordTie(
  day: number,
  from: Npc,
  to: Npc,
  cause: TieCause,
  scale = 1,
  /** Internal: set when this call is the mirror half of a mutual cause. */
  mirrored = false,
): void {
  if (from.id === to.id) return;
  const effect = TIE_EVENTS[cause];

  let tie = find(from, to.id);
  if (!tie) {
    tie = { id: to.id, trust: 0, resentment: 0, debt: 0, cause, since: day };
    from.ties.push(tie);
  }

  tie.trust = clamp(tie.trust + (effect.trust ?? 0) * scale, 0, 100);
  tie.resentment = clamp(tie.resentment + (effect.resentment ?? 0) * scale, 0, 100);
  tie.debt = clamp(tie.debt + (effect.debt ?? 0) * scale, 0, 100);
  tie.cause = cause;
  tie.since = day;
  trim(from);

  // `mirrored` exists solely to stop a mutual cause bouncing between the two
  // men forever. Without it the first two-man job in any game blew the stack.
  if (effect.mutual && !mirrored) recordTie(day, to, from, cause, scale, true);
}

/** Everybody senior who watched somebody else get something. */
export function passedOver(
  state: GameState,
  winner: Npc,
  witnesses: Npc[],
  cause: TieCause = 'passed_over',
): void {
  for (const other of witnesses) {
    if (other.id === winner.id) continue;
    recordTie(state.day, other, winner, cause);
  }
}

/** A finished job writes acquaintance between the people who were on it. */
export function tiesFromOperation(state: GameState, rng: Rng, crew: Npc[]): void {
  if (crew.length < 2) return;
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      if (!rng.chance(TIE_FROM_OPERATION)) continue;
      recordTie(state.day, crew[i], crew[j], 'worked_together');
    }
  }
}

/**
 * A job that went wrong for one man because of a decision somebody else made.
 * The clearest single source of resentment in the game.
 */
export function tookTheBlame(state: GameState, victim: Npc, others: Npc[]): void {
  for (const other of others) {
    if (other.id === victim.id) continue;
    recordTie(state.day, victim, other, 'took_the_blame');
  }
}

// ------------------------------------------------------------------ drift ---

/**
 * What the room does to somebody's loyalty each week.
 *
 * Only ties to people who are still here count. A grudge against a man who is
 * dead or gone stops costing you anything, which is both correct and the thing
 * that stops an old organization accumulating permanent invisible drag.
 */
export function tieDrift(state: GameState, npc: Npc): number {
  let delta = 0;
  for (const tie of npc.ties) {
    const other = state.npcs[tie.id];
    if (!other || gone(other)) continue;
    delta += tie.resentment * TIE_DRIFT.resentmentLoyalty;
    delta += tie.trust * TIE_DRIFT.trustLoyalty;
  }
  return delta;
}

/** Weekly fade. Grudges outlast friendships, which is the whole of it. */
export function decayTies(state: GameState, npc: Npc): void {
  for (const tie of npc.ties) {
    tie.resentment = Math.max(0, tie.resentment - TIE_DRIFT.resentmentDecayPerWeek);
    tie.trust = Math.max(0, tie.trust - TIE_DRIFT.trustDecayPerWeek);
  }
  npc.ties = npc.ties.filter((tie) => {
    const other = state.npcs[tie.id];
    // Keep an edge to somebody who has gone only while it is still strong
    // enough to be worth remembering — a defector everybody trusted is a
    // problem for months, a man nobody noticed leaving is not.
    if (!other) return false;
    return Math.max(tie.trust, tie.resentment, tie.debt) >= TIE_DRIFT.forgetBelow;
  });
}

// ------------------------------------------------------------- departures ---

/**
 * Somebody leaving takes the people who were loyal to *him* rather than to you.
 *
 * This is the mechanic the whole file exists for: a poached lieutenant is no
 * longer one man walking out, he is a hole with a shape. The player has no
 * warning beyond the crew sheet, which has been quietly saying who trusts whom
 * for as long as they cared to look.
 */
export function followDeparture(
  state: GameState,
  rng: Rng,
  leaver: Npc,
  onFollow: (npc: Npc) => void,
): Npc[] {
  const followers: Npc[] = [];
  const remaining = here(state).filter((n) => n.id !== leaver.id);
  // He takes a share of the people who trusted him, not all of them.
  const ceiling = Math.max(1, Math.floor(remaining.length * TIE_DEPARTURE.followMaxShare));

  for (const npc of remaining) {
    const tie = find(npc, leaver.id);
    if (!tie || tie.trust < TIE_DEPARTURE.followTrustAbove) continue;

    if (followers.length < ceiling && rng.chance(TIE_DEPARTURE.followChance)) {
      note(npc, state.day, `Went with ${leaver.name}.`, 'bad');
      onFollow(npc);
      followers.push(npc);
    } else {
      npc.stats.loyalty = clamp(npc.stats.loyalty + TIE_DEPARTURE.stayerLoyalty, 0, 100);
      note(npc, state.day, `Stayed when ${leaver.name} did not.`, 'neutral');
    }
  }
  return followers;
}

// ------------------------------------------------------------ perception ---

export interface TieRead {
  name: string;
  /** The phrase, never the numbers. */
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * What the player can tell about who gets on with whom.
 *
 * Gated on knowing *both* men, because this is a thing you notice by being in
 * the room with the two of them. Knowing one of them well tells you nothing
 * about how he is with somebody you have never spoken to.
 */
export function readTies(state: GameState, npc: Npc): TieRead[] {
  if (npc.familiarity < 40) return [];

  const out: TieRead[] = [];
  for (const tie of npc.ties) {
    const other = state.npcs[tie.id];
    if (!other || gone(other) || other.familiarity < 40) continue;

    const strongest = Math.max(tie.trust, tie.resentment, tie.debt);
    /*
     * Low enough that a single incident registers.
     *
     * At 20 it did not: a crew dispute writes 18, so the boss who personally
     * adjudicated an argument between two of his own men could look at either
     * of their sheets afterwards and see nothing about it. One falling-out is
     * exactly the thing worth showing.
     */
    if (strongest < 15) continue;

    if (tie.resentment === strongest) {
      out.push({
        name: other.name,
        text:
          tie.resentment > 60
            ? `Will not be in a room with ${other.name}`
            : `Has something against ${other.name} — ${TIE_CAUSE_TEXT[tie.cause]}`,
        tone: 'bad',
      });
    } else if (tie.debt === strongest) {
      out.push({ name: other.name, text: `Owes ${other.name}`, tone: 'neutral' });
    } else {
      /*
       * The phrase has to mean what the simulation means.
       *
       * "Would follow" was drawn at 60 while `followDeparture` actually pulls
       * anybody above `followTrustAbove` — 34 — out of the door behind a man
       * who leaves. So the whole band between the two read as "rates him", and
       * a boss who lost one name to a missed payroll could lose two more he
       * had no way of seeing coming. That is a fine thing to happen and a poor
       * thing to be unable to anticipate; the compounding walkout is one of
       * the best consequences in this game and it was invisible until the
       * afternoon it landed.
       *
       * Read off the constant rather than a second copy of the number, so the
       * warning cannot drift away from the behaviour it warns about.
       */
      out.push({
        name: other.name,
        text:
          tie.trust > 60
            ? `Would follow ${other.name} anywhere`
            : tie.trust >= TIE_DEPARTURE.followTrustAbove
              ? `Would go with ${other.name} if they went`
              : `Rates ${other.name}`,
        tone: 'good',
      });
    }
  }
  return out.slice(0, 4);
}
