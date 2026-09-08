/**
 * What you started and have not finished.
 *
 * ## The audit was wrong about this, in a way worth recording
 *
 * Phase 5 of the engagement brief asked for a story-arc framework, and
 * `ENGAGEMENT_OVERHAUL_AUDIT.md` filed the game as having *"parts, no
 * framework"* across `goals.ts`, `memory.ts`, `ties.ts`, `marks.ts` and
 * `informants.ts`. Re-read against what an arc actually is — a thing that
 * begins, develops over many days, and ends in a way the player can affect —
 * three of those five are not arcs at all and two of them are complete ones:
 *
 *     goals, memory, ties      substrate. The materials arcs are made of, with
 *                              no beginning or ending of their own.
 *     marks                    a whole arc. Put out, races against him talking,
 *                              ends found or hopeless, keeps its own record.
 *     informants               a whole arc, deliberately hidden.
 *
 * And the game has more that the audit did not list: a score is opened,
 * prepared over a month and run; a promise is made, runs down and is kept or
 * broken; a case opens, advances through stages and indicts or goes cold.
 *
 * **So the game is full of arcs and has no framework because it does not need
 * one.** What it has instead is the same fault this project has now found five
 * times in a season, most recently in `ties.ts` and `chronicle.ts`: the thing
 * exists, works, and cannot be seen as what it is. Every arc lives on its own
 * panel — scores on Operations, promises on the crew sheet, marks on the crew
 * sheet, cases on Law — so a boss with four things running has four screens to
 * remember to visit and nothing that says how many he has going.
 *
 * ## What this is, and what it deliberately is not
 *
 * A read, in the shape `attention.ts`, `rank.ts` and `chronicle.ts` use:
 * derived on demand, no state, nothing to save, nothing to drift. It asks each
 * system what it has open and puts the answers in one vocabulary.
 *
 * It is **not** a to-do list and does not score. `attention.ts` states that
 * rule for itself — *"it says what is waiting; it does not say what is worth
 * doing, because that is the game"* — and this follows it. Every line names
 * where the thing stands and what would end it, and none of them says which
 * you should deal with.
 *
 * The two systems that do not appear here are the two that must not. An
 * informant is an arc and naming it on a dashboard would end the mechanic on
 * the day it started — `informants.ts` refuses even to write a log line. And
 * a rival's plan is theirs, not yours.
 */

import type { GameState } from './types';
import { OPERATION_BY_ID } from '../config/operations';
import { PROMISES } from '../config/promises';
import { STAGE_BY_ID } from '../config/lawEnforcement';
import { MARK } from '../config/silence';
import { VERBS } from '../config/verbs';
import { liveScores, setupsLeft } from './scores';
import { daysLeft } from './promises';
import { liveMarks } from './marks';
import { activeCases } from './investigation';
import { territoryDef } from './territory';
import type { PanelId } from '../ui/Rail';

export interface Arc {
  id: string;
  /** What it is, named the way the player met it. */
  title: string;
  /** Where it stands today. Never a number the player is not shown elsewhere. */
  where: string;
  /** What would finish it — the half a status line usually leaves out. */
  ends: string;
  /** The day it began, so the list can be ordered by how long it has run. */
  since: number;
  /** Where to go and do something about it. */
  panel: PanelId;
  /** Whether the clock is against you. Not a severity and not a score. */
  pressing: boolean;
}

/**
 * Everything running, oldest first.
 *
 * Oldest rather than most urgent, deliberately. Sorting by pressure would be
 * scoring, which is the rule above; sorting by age answers a question the
 * player cannot answer any other way — *what have I been carrying longest* —
 * and the thing that has been open the longest is usually the thing that has
 * been forgotten.
 */
export function arcs(state: GameState): Arc[] {
  const out: Arc[] = [];

  /*
     A score: opened, prepared, and run before the window shuts.

     The clearest arc in the game and the one with the most expensive ending —
     prep is wasted if the job does not go, which is exactly the fact a player
     who has forgotten about it needs on a screen they actually look at.
  */
  for (const score of liveScores(state)) {
    const left = setupsLeft(state, score);
    const days = score.dueDay - state.day;
    out.push({
      id: `score:${score.id}`,
      title: `${OPERATION_BY_ID[score.defId]?.name ?? 'A job'} in ${territoryDef(score.territoryId)?.name}`,
      where: left.length
        ? `${left.length} ${left.length === 1 ? 'thing' : 'things'} still to get ready`
        : 'everything is ready',
      ends: days <= 0 ? 'the window has shut' : `run it within ${days} ${days === 1 ? 'day' : 'days'}`,
      since: score.openedDay,
      panel: 'operations',
      pressing: days <= 7,
    });
  }

  /*
     A week spent looking at a job properly.

     Left out of the first version of this file, and two of round 17's three
     testers reported the consequence independently: they used the Method verb
     on days 22 and 25, and neither could find any trace of it afterwards. One
     wrote *"no completion line, no odds change I could attribute, no entry in
     WHAT YOU HAVE RUNNING"*, which was exactly right and is the reason it is
     here now.

     The odds row exists — `successBreakdown` reports a `cased` term — but only
     on the one job it was bought for and only once the week is up, so for the
     first seven days the game holds a thing you spent a week on and says
     nothing about it anywhere. That is the definition of what this panel is
     for.
  */
  const cased = state.org.cased;
  if (cased) {
    const days = cased.readyDay - state.day;
    out.push({
      id: `cased:${cased.defId}:${cased.territoryId}`,
      title: `Somebody is watching ${OPERATION_BY_ID[cased.defId]?.name ?? 'a job'} in ${territoryDef(cased.territoryId)?.name}`,
      where: days > 0
        ? `${days} ${days === 1 ? 'day' : 'days'} of the week left to run`
        : 'they have seen what they need to',
      ends: days > 0
        ? 'run that job in that district once the week is up'
        : 'run that job in that district, and it goes better',
      since: cased.readyDay - VERBS.casingDays,
      panel: 'operations',
      pressing: false,
    });
  }

  /*
     A promise: made in a room, and due.

     Read through `daysLeft` rather than off `dueDay`, so this cannot disagree
     with the crew sheet about when a man stops waiting.
  */
  for (const promise of state.promises ?? []) {
    const npc = state.npcs[promise.npcId];
    if (!npc) continue;
    const days = daysLeft(state, promise);
    out.push({
      id: `promise:${promise.npcId}:${promise.kind}`,
      title: `Something you told ${npc.name}`,
      where: PROMISES[promise.kind].outstanding,
      ends:
        days <= 0
          ? 'they have stopped expecting it'
          : `${days} ${days === 1 ? 'day' : 'days'} before they stop expecting it`,
      since: promise.madeDay,
      panel: 'crew',
      pressing: days <= 3,
    });
  }

  /*
     A mark: you decided once, and from here you read the record.

     `chance` falls on every miss and below `MARK.hopelessBelow` he is gone for
     good, so "how it ends" is genuinely uncertain and the line says so rather
     than implying it is only a matter of time.
  */
  for (const mark of liveMarks(state)) {
    const npc = state.npcs[mark.npcId];
    if (!npc) continue;
    out.push({
      id: `mark:${mark.id}`,
      title: `Somebody is looking for ${npc.name}`,
      where: mark.tries === 0
        ? 'nobody has got near them yet'
        : `${mark.tries} ${mark.tries === 1 ? 'try' : 'tries'}, and they are still out there`,
      ends: mark.chance <= MARK.hopelessBelow * 1.5
        ? 'the people looking are close to giving up'
        : 'the people looking find them, or stop looking',
      since: mark.setDay,
      panel: 'crew',
      pressing: false,
    });
  }

  /*
     A case: an arc happening *to* you, which is the point of including it.

     Every other line here is something the player started. This one runs
     whether or not he does anything, and leaving it out would make the list a
     record of his own initiatives rather than of what is going on.
  */
  for (const investigation of activeCases(state)) {
    out.push({
      id: `case:${investigation.id}`,
      title: `${STAGE_BY_ID[investigation.stage]?.name ?? 'A case'} against you`,
      where: investigation.suspectIds.length
        ? `${investigation.suspectIds.length} of yours named in it`
        : 'nobody of yours named in it yet',
      ends: 'it goes cold, or it reaches a courtroom',
      since: investigation.openedDay,
      panel: 'law',
      pressing: investigation.status === 'open' && investigation.strength >= 60,
    });
  }

  return out.sort((a, b) => a.since - b.since);
}
