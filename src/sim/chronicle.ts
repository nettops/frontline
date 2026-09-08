/**
 * What happened to this family, kept.
 *
 * **The game forgets itself, and the forgetting accelerates.** `addLog` holds
 * `LOG_LIMIT` — 400 entries, newest first, older ones dropped — and a career
 * writes far more than that. Measured across eight careers:
 *
 *     career length   the log reaches back   of the career visible
 *          90 days                90 days                    99%
 *         300 days               150 days                    50%
 *         600 days               132 days                    22%
 *
 * So a boss past about day 150 cannot see the founding of his own family, and
 * one playing a long game has lost four fifths of it. The 400 is not the fault
 * — the log is a firehose of routine nights and a bigger firehose is not a
 * history — but the consequence is that the one thing a crime family is
 * supposed to have, a past, is the thing this game throws away first.
 *
 * ## Why it is derived rather than recorded
 *
 * The obvious repair is a second list written at the moments that matter, and
 * it would need six or eight call sites — deaths alone happen at five — every
 * one of which is a place for the record to quietly stop being written. That
 * is the fault this project keeps finding in itself: `player.rank` was never
 * assigned, the pattern groove never left `tickStandingOrders`, round 15's
 * per-person cooldown reached one of two identical memos.
 *
 * Everything needed is already durable. **Dead and defected men stay in
 * `state.npcs` forever** — `crewList` filters them out, it does not delete
 * them — with their notes, their role and their tenure frozen at the moment
 * they stopped being crew. `daysInCrew` stops incrementing for former crew, so
 * a man's whole span is recoverable from two numbers and a dated note, and
 * every one of the five ways to die writes one.
 *
 * So this is a read in the shape `rank.ts`, `approaches.ts` and `estate.ts`
 * already use: nothing to save, no `SAVE_VERSION` move, no call site to miss,
 * and no second copy of a fact that could drift from the first.
 *
 * ## What it therefore cannot say
 *
 * People, and only people. A district taken and lost again leaves nothing
 * behind in state, and neither does a war that ended — those are current-state
 * systems and inventing a history for them would mean the recorded second list
 * this file exists to avoid. That is a real limit and it is the honest one: a
 * family remembers who came, who rose and who went, which is what is here.
 */

import type { GameState, Npc } from './types';
import { ROLE_LABEL } from '../config/economy';
import { isFormerCrew } from './npc';

export interface Chapter {
  /** The day it happened, so the panel can sort and date it. */
  day: number;
  /** Whose entry this is, for grouping a life together. */
  npcId: string;
  name: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * The last day this person was one of yours.
 *
 * Today for anybody still here. For somebody gone it is the day of their most
 * recent note, because every route out of this family writes one — killed in
 * the war, found, decided it was them, decided they were finished, or died not
 * young and not violently. Read off the note rather than a stored leaving-day,
 * so a sixth way out that writes a note is covered without knowing this file
 * exists.
 */
function lastDay(state: GameState, npc: Npc): number {
  if (!isFormerCrew(npc)) return state.day;
  return npc.notes.length ? Math.max(...npc.notes.map((n) => n.day)) : state.day;
}

/** How they went, in the words their own sheet uses. */
function exitNote(npc: Npc): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  if (!npc.notes.length) return null;
  const last = npc.notes.reduce((a, b) => (b.day >= a.day ? b : a));
  return { text: last.text, tone: last.kind };
}

/** A span of days as somebody would say it rather than as a number of days. */
function span(days: number): string {
  if (days < 14) return `${Math.max(1, days)} days`;
  if (days < 90) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = days / 365;
  return years < 1.5 ? 'a year' : `${Math.round(years)} years`;
}

/**
 * Everybody who was ever in this family, and what became of them.
 *
 * Oldest first, because that is the direction a history reads and the opposite
 * of the log — which is correct for a feed of tonight and wrong for a record
 * of a decade.
 *
 * `boss` is excluded rather than shown as having left: a predecessor is the
 * succession line's business, and `succession.ts` keeps that properly across
 * reigns. Listing him here as a departure would say he walked out.
 */
export function chronicle(state: GameState): Chapter[] {
  const out: Chapter[] = [];

  for (const npc of Object.values(state.npcs)) {
    if (npc.status === 'boss') continue;
    /*
       Everybody else counts, including the man who signed on this morning.

       This carried a `daysInCrew <= 0` guard meant to exclude people who were
       never yours, and it excluded the founding crew instead: `state.ts` gives
       some of the starting family a tenure of nought, so the first version of
       this file wrote a history of a family with no beginning. There is nobody
       to guard against — `state.npcs` is your people and nobody else's, written
       from two places, and men waiting to be hired live in `state.recruits`.
    */

    const end = lastDay(state, npc);
    const joined = Math.max(0, end - npc.daysInCrew);

    out.push({
      day: joined,
      npcId: npc.id,
      name: npc.name,
      text: `${npc.name} came in as ${ROLE_LABEL[npc.role].toLowerCase()}.`,
      tone: 'neutral',
    });

    if (isFormerCrew(npc)) {
      const how = exitNote(npc);
      out.push({
        day: end,
        npcId: npc.id,
        name: npc.name,
        text:
          `${npc.name} — ${span(npc.daysInCrew)} with you. ` +
          (how ? how.text : npc.status === 'defected' ? 'Left.' : 'Gone.'),
        tone: how ? how.tone : 'bad',
      });
    }
  }

  return out.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

/**
 * The shape of it, for a panel that wants a sentence before the list.
 *
 * Counted off the same read rather than off `state.npcs` directly, so the
 * summary and the list can never disagree about who was in the family.
 */
export function chronicleSummary(state: GameState): {
  everJoined: number;
  stillHere: number;
  gone: number;
  since: number;
} {
  const people = new Map<string, Chapter[]>();
  for (const c of chronicle(state)) {
    people.set(c.npcId, [...(people.get(c.npcId) ?? []), c]);
  }
  let gone = 0;
  let since = state.day;
  for (const [, chapters] of people) {
    if (chapters.length > 1) gone += 1;
    since = Math.min(since, chapters[0].day);
  }
  return {
    everJoined: people.size,
    stillHere: people.size - gone,
    gone,
    since: people.size ? since : state.day,
  };
}
