/**
 * What happened while you were not looking.
 *
 * Pressing "+1 week" runs seven days of eleven systems, and until now the only
 * account of that was a log you had to read backwards. That is a fine record
 * and a poor briefing: the log tells you everything in the order it happened,
 * when what you need on walking back into the room is the four things that
 * changed and which of them you have to do something about.
 *
 * So this takes a snapshot of the numbers before time moves, compares it to
 * the numbers after, and writes the difference as sentences. It is strictly a
 * reading of state — it decides nothing and is never saved. That is why it
 * lives in ui/ rather than sim/: the simulation does not know this exists, and
 * adding a line here can never change the outcome of a game.
 */

import type { GameState, Id, NpcStatus, RankId } from '../sim/types';
import type { PanelId } from './Rail';
import type { Cue } from './audio';
import type { StageId } from '../config/lawEnforcement';
import type { FactionId } from '../config/factions';
import { crewList } from '../sim/npc';
import { controlledTerritories } from '../sim/territory';
import { playerWars } from '../sim/diplomacy';
import { formatMoney } from '../sim/util';
import { AGENCY_BY_ID, STAGE_BY_ID } from '../config/lawEnforcement';
import { TERRITORY_BY_ID } from '../config/territories';
import { WORLD_CONDITION_BY_ID } from '../config/world';
import { houseName } from '../sim/houses';
import { homeRead } from '../sim/personal';
import { HOME } from '../config/personal';

export interface Snapshot {
  day: number;
  clean: number;
  dirty: number;
  heat: number;
  respect: number;
  crew: Record<Id, NpcStatus>;
  rank: RankId;
  pendingRank: RankId | null;
  cases: Record<Id, { stage: StageId; strength: number; agencyId: string }>;
  controlled: string[];
  wars: FactionId[];
  condition: string | null;
  generation: number;
  /** Headlines that named you. The city noticing is worth a line of its own. */
  namedStories: number;
}

export function snapshot(state: GameState): Snapshot {
  const crew: Snapshot['crew'] = {};
  for (const npc of crewList(state)) crew[npc.id] = npc.status;

  const cases: Snapshot['cases'] = {};
  for (const c of Object.values(state.law.investigations)) {
    if (c.status === 'closed' || c.status === 'resolved') continue;
    cases[c.id] = { stage: c.stage, strength: c.strength, agencyId: c.agencyId };
  }

  return {
    day: state.day,
    clean: state.org.cash,
    dirty: state.org.dirtyCash,
    heat: state.org.heat,
    namedStories: state.city.stories.filter((story) => story.named).length,
    respect: state.org.respect,
    crew,
    rank: state.player.rank,
    pendingRank: state.player.pendingRank,
    cases,
    controlled: controlledTerritories(state).map((t) => t.id),
    wars: playerWars(state).map((f) => f.id),
    condition: state.world.conditionId,
    generation: state.succession.generation,
  };
}

export type LineTone = 'good' | 'bad' | 'money' | 'neutral';

/**
 * Which part of the day a line belongs to.
 *
 * The vision asks for a day with a shape — you read what came in overnight,
 * you work, and the evening is the part that is not the business. The
 * simulation already runs in that order and always has; what was missing was
 * anywhere the player could feel it, because the briefing was one
 * undifferentiated list in which a man dying and your family asking after you
 * were the same kind of line.
 *
 * Deliberately a property of the *report* rather than of the simulation. The
 * clock is unchanged, the tick order is unchanged, and nothing in `sim/` knows
 * this exists — which is the same rule the rest of this file follows and the
 * reason it lives in `ui/`.
 */
export type DayPart = 'overnight' | 'today' | 'evening';

export interface ReportLine {
  text: string;
  tone: LineTone;
  /** Where to go to do something about it. Null when there is nothing to do. */
  panel: PanelId | null;
  /** Defaults to `overnight` — most of what a briefing carries already happened. */
  part?: DayPart;
}

/** The three parts, in the order a day happens. */
export const DAY_PARTS: { id: DayPart; label: string }[] = [
  { id: 'overnight', label: 'While you were not looking' },
  { id: 'today', label: 'Waiting on you' },
  { id: 'evening', label: 'This evening' },
];

export interface DayReport {
  from: number;
  to: number;
  lines: ReportLine[];
  /** The one sound this stretch of time should make. */
  cue: Cue;
}

/** Case strength has to move this far before it is worth a line of its own. */
const STRENGTH_JUMP = 8;

/**
 * How many narrative lines a single briefing will carry.
 *
 * A bad fortnight can put a dozen of these in the log, and a briefing you have
 * to scroll is a briefing nobody reads — the log is still there for anyone who
 * wants the whole account.
 */
const NARRATIVE_LIMIT = 3;

/**
 * The order of the pushes below is the order the player reads them in, and it
 * is not the order the systems ran in. It is roughly: what happened to people,
 * what happened to the work, what the law did, what the city did, and money
 * last — because money is already on the stat bar and everything else is not.
 */
export function buildReport(before: Snapshot, state: GameState): DayReport | null {
  const lines: ReportLine[] = [];
  const now = snapshot(state);
  const push = (
    text: string,
    tone: LineTone,
    panel: PanelId | null = null,
    part: DayPart = 'overnight',
  ) => lines.push({ text, tone, panel, part });

  // --- the line of succession ------------------------------------------
  // First, above everything, because if this changed you are not the same
  // person who pressed the button.
  if (now.generation > before.generation) {
    const last = state.succession.line[state.succession.line.length - 1];
    push(
      `${last ? `${last.name} is gone. ` : ''}You are ${state.player.name} now.`,
      'bad',
      'succession',
    );
  }

  // --- people -----------------------------------------------------------
  const gone: string[] = [];
  const hurt: string[] = [];
  const held: string[] = [];
  /** Everyone the diff has already spoken about, so the log does not repeat it. */
  const mentioned: string[] = [];
  for (const [id, was] of Object.entries(before.crew)) {
    const npc = state.npcs[id];
    if (!npc) continue;
    const is = npc.status;
    if (is === was) continue;
    if (is === 'dead') gone.push(`${npc.name} is dead.`);
    else if (is === 'defected') gone.push(`${npc.name} walked.`);
    else if (is === 'arrested') held.push(npc.name);
    else if (is === 'injured') hurt.push(npc.name);
    else continue;
    mentioned.push(npc.name);
  }
  for (const line of gone) push(line, 'bad', 'crew');
  if (held.length > 0) {
    push(`${list(held)} ${held.length === 1 ? 'was' : 'were'} picked up.`, 'bad', 'crew');
  }
  if (hurt.length > 0) {
    push(`${list(hurt)} got hurt and ${hurt.length === 1 ? 'is' : 'are'} out.`, 'bad', 'crew');
  }

  const joined = Object.keys(now.crew).filter((id) => !(id in before.crew));
  if (joined.length > 0) {
    const names = joined.map((id) => state.npcs[id].name);
    mentioned.push(...names);
    push(`${list(names)} came in.`, 'good', 'crew');
  }

  /** Only the people. Kept before jobs and districts join the list below. */
  const peopleNamed = [...mentioned];

  // The two blocks below are worked out here rather than where they print,
  // because the narrative pass in between has to know every proper noun the
  // diff is going to use before it decides what the log is still allowed to
  // say. Reading order and computation order are not the same thing.
  const jobs = state.operationHistory.filter((r) => r.day > before.day);
  const took = now.controlled.filter((id) => !before.controlled.includes(id));
  const lost = before.controlled.filter((id) => !now.controlled.includes(id));
  mentioned.push(...jobs.map((j) => j.name));
  mentioned.push(...[...took, ...lost].map((id) => TERRITORY_BY_ID[id].name));

  /*
   * Things that happened without moving a number.
   *
   * Everything above this point is a diff of fields, and a diff of fields is
   * structurally blind to the most important thing that can happen in a quiet
   * week. A man turning down an offer from a rival is the only warning you get
   * before he takes the next one. A payroll you could not meet costs nothing
   * today and costs you the crew by the spring. Both left every tracked figure
   * exactly where it was, and the first draft of this briefing reported such a
   * week as uneventful.
   *
   * They are already in the log, kinded, so this reads them from there rather
   * than opening a second channel for the systems to write to. The cost of
   * borrowing the log is that the log also covers what the diff covers, from
   * the other side: playing it produced
   *
   *     Corner Shakedown in Little Sicily failed. It came apart.
   *     Corner Shakedown went wrong.
   *     Little Sicily: you now hold control.
   *     You hold Little Sicily now.
   *
   * — the same two facts, each said twice. So anything naming a person, a job
   * or a district the diff has already accounted for is dropped here.
   */
  const narrative = state.log
    .filter((e) => e.day > before.day && (e.kind === 'crew' || e.kind === 'failure'))
    .filter((e) => !mentioned.some((subject) => e.text.includes(subject)))
    .slice(0, NARRATIVE_LIMIT);
  const crewNames = crewList(state).map((n) => n.name);
  for (const entry of narrative) {
    // Only send them somewhere if the line is actually about one of their own
    // people. A rival's war reaches the log through the same channel, and a
    // link to the wrong panel is worse than no link at all.
    const aboutOurs = crewNames.some((name) => entry.text.includes(name));
    push(entry.text, entry.kind === 'failure' ? 'bad' : 'neutral', aboutOurs ? 'crew' : null);
  }

  // --- the work ---------------------------------------------------------
  if (jobs.length === 1) {
    const job = jobs[0];
    // The consequence is the whole story of a failure — whether it cost money,
    // a man, or only your nerve. Unless it is about somebody the people block
    // has already covered, in which case saying it again is just saying it
    // again: "Carla is hurt and out" directly above "Carla is hurt — out for
    // 16 days".
    const detail =
      job.consequence && !peopleNamed.some((name) => job.consequence!.includes(name))
        ? ` ${job.consequence}`
        : '';
    push(
      job.success
        ? `${job.name} came off. ${formatMoney(job.payout)}.`
        : `${job.name} went wrong.${detail}`,
      job.success ? 'good' : 'bad',
      'operations',
    );
  } else if (jobs.length > 1) {
    const won = jobs.filter((j) => j.success).length;
    push(
      `${jobs.length} jobs finished — ${won} came off, ${jobs.length - won} did not.`,
      won > jobs.length - won ? 'good' : 'bad',
      'operations',
    );
  }

  // --- ground -----------------------------------------------------------
  for (const id of took) push(`You hold ${TERRITORY_BY_ID[id].name} now.`, 'good', 'territory');
  for (const id of lost) push(`${TERRITORY_BY_ID[id].name} is no longer yours.`, 'bad', 'territory');

  // --- the law ----------------------------------------------------------
  for (const [id, c] of Object.entries(now.cases)) {
    const was = before.cases[id];
    const agency = AGENCY_BY_ID[c.agencyId].name;
    if (!was) {
      push(`${agency} opened a file on you.`, 'bad', 'law');
      continue;
    }
    if (c.stage !== was.stage) {
      push(`${agency}: ${STAGE_BY_ID[c.stage].name.toLowerCase()}.`, 'bad', 'law');
    } else if (c.strength - was.strength >= STRENGTH_JUMP) {
      push(`${agency} got something. Their case is stronger.`, 'bad', 'law');
    }
  }
  for (const id of Object.keys(before.cases)) {
    if (id in now.cases) continue;
    const closed = state.law.investigations[id];
    if (closed) push(`${AGENCY_BY_ID[closed.agencyId].name} closed their file.`, 'good', 'law');
  }

  // --- rivals -----------------------------------------------------------
  for (const id of now.wars.filter((w) => !before.wars.includes(w))) {
    push(`${houseName(state, id)} is at war with you.`, 'bad', 'diplomacy');
  }
  for (const id of before.wars.filter((w) => !now.wars.includes(w))) {
    push(`The war with ${houseName(state, id)} is over.`, 'good', 'diplomacy');
  }

  // --- the city ---------------------------------------------------------
  if (now.condition !== before.condition) {
    if (now.condition) {
      const def = WORLD_CONDITION_BY_ID[now.condition];
      push(`${def.name}. ${def.summary}`, def.tone === 'good' ? 'good' : 'bad', null);
    } else if (before.condition) {
      push(`${WORLD_CONDITION_BY_ID[before.condition].name} is over.`, 'neutral', null);
    }
  }

  // --- yourself ---------------------------------------------------------
  if (now.pendingRank && now.pendingRank !== before.pendingRank) {
    push('You have been offered a step up.', 'good', 'player');
  }

  // --- money and attention ----------------------------------------------
  const money = now.clean + now.dirty - (before.clean + before.dirty);
  if (Math.abs(money) >= 1) {
    // "+1 week" stops the moment something needs you, so a press labelled a
    // week is routinely three days. Saying "on the week" regardless is a small
    // lie about a number, which is the one kind this interface must not tell.
    const days = state.day - before.day;
    const over = days === 1 ? 'on the day' : days === 7 ? 'on the week' : `over ${days} days`;
    push(
      money > 0
        ? `Up ${formatMoney(money)} ${over}.`
        : `Down ${formatMoney(-money)} ${over}.`,
      money > 0 ? 'money' : 'bad',
      'finances',
    );
  }

  /*
   * The papers.
   *
   * Placed with the law rather than with the money because that is what it is
   * — being named in print is the city finding out, and the city finding out
   * is what eventually puts an agency on you. One line, and only when it is
   * about you: general coverage of a war between two other families is not
   * the player's news.
   */
  const printed = now.namedStories - before.namedStories;
  if (printed > 0) {
    const latest = state.city.stories.find((story) => story.named);
    push(
      printed === 1
        ? `You were named in the papers. ${latest?.headline ?? ''}`.trim()
        : `You were named in the papers ${printed} times.`,
      'bad',
      'city',
    );
  }

  const heat = Math.round(now.heat) - Math.round(before.heat);
  if (Math.abs(heat) >= 2) {
    push(
      heat > 0
        ? `Heat up ${heat}, to ${Math.round(now.heat)}.`
        : `Heat down ${-heat}, to ${Math.round(now.heat)}.`,
      heat > 0 ? 'bad' : 'good',
      null,
    );
  }

  /*
     And the part of the day that is not the business.

     This is the whole reason the roadmap put day-parts *after* the personal
     life rather than before it: an evening with nothing in it is worse than no
     evening. The house is the only thing that goes here, it only speaks when
     it has actually noticed, and it is a way through to the screen rather than
     a number.
  */
  const somethingHappened = lines.length > 0;
  const house = homeRead(state);
  if (house.neglect >= HOME.depositionFrom) {
    // Loud enough to be the only thing on the page, because at this point it
    // is costing the boss something real.
    push(
      `${house.people[0] ?? 'Somebody'} asked after you. It has been ${house.since} days.`,
      'bad',
      'player',
      'evening',
    );
  } else if (somethingHappened && house.since >= HOME.intervalDays * 6) {
    /*
       And the quiet version only ever rides along.

       Its own test caught the first half of this: a boss who had a completely
       uneventful week was handed a briefing whose single line was that nobody
       at home had seen him. That is a nag with a heading on it, and the surest
       way to teach somebody to dismiss the briefing without reading it.

       Round 15 caught the second half — it still appeared on almost every
       briefing for two hundred days, because "something happened" is true most
       weeks. Six weeks away rather than three, so the line is an observation
       about a real absence rather than a running total.
    */
    push(`Nobody at home has said anything. It has been ${house.since} days.`, 'neutral', 'player', 'evening');
  }

  /*
     Anything still on the desk belongs to today rather than to last night.

     A memo is the one thing in a briefing that has not happened yet, and
     reading it under the same heading as a death is what made the old
     briefing feel like a list rather than a morning.
  */
  if (state.pendingEvents.length > 0) {
    const n = state.pendingEvents.length;
    push(
      n === 1 ? 'Something is waiting for an answer.' : `${n} things are waiting for an answer.`,
      'neutral',
      null,
      'today',
    );
  }

  if (lines.length === 0) return null;
  return { from: before.day, to: state.day, lines, cue: cueFor(lines, state) };
}

/**
 * One sound for the whole stretch, not one per line.
 *
 * A week in which you lost a man and made money is a bad week, and playing the
 * till noise after the funeral gets the tone exactly wrong. Worst thing wins.
 */
function cueFor(lines: ReportLine[], state: GameState): Cue {
  if (state.pendingEvents.length > 0) return 'memo';
  if (lines.some((l) => l.panel === 'succession' || l.panel === 'law' || l.panel === 'diplomacy')) {
    if (lines.some((l) => l.tone === 'bad')) return 'alarm';
  }
  if (lines.some((l) => l.tone === 'bad')) return 'bad';
  if (lines.some((l) => l.tone === 'money')) return 'money';
  if (lines.some((l) => l.tone === 'good')) return 'good';
  return 'week';
}

/** "Sal", "Sal and Vito", "Sal, Vito and Marco". */
function list(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
