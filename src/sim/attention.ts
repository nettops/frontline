/**
 * What wants you today.
 *
 * A leaf module, the same shape as `standing.ts`: it reads what the other
 * systems already keep and imports nothing that imports it back. Nothing here
 * is state — every line is derived on read, so there is no second copy of a
 * fact to drift.
 *
 * It exists because a manual playthrough named moving between panels as one of
 * four tedious things: the recurring loop touches Operations, Organization and
 * Territory, and nothing said which of them had something waiting.
 *
 * **One rule, and it is the Rail's own**, written where the three badges live:
 * *a badge is a demand for attention with no statement of what would satisfy
 * it.* A playtester carried the succession "!" for a hundred days without
 * knowing what it wanted. So every line below names the thing it wants done,
 * in the words the player would use, and every line can be absent — a list
 * that is always full is wallpaper.
 *
 * Deliberately not a to-do list and deliberately not scored. It says what is
 * waiting; it does not say what is worth doing, because that is the game.
 */

import type { GameState } from './types';
import { availableCrew } from './npc';
import { eligibleStewards, stewardCandidateDistrict } from './delegation';
import { liveScores, setupsLeft } from './scores';
import { liveTraining } from './training';
import { availableOperations, crewNeeded, operationCost } from './operations';
import { totalFunds } from './economy';
import { isLayingLow } from './heat';
import { liveStanding, patternOn } from './standingOrders';
import { territoryDef } from './territory';
import { playerWars } from './diplomacy';
import { eligibleHeirs, heirOf } from './succession';
import { activeCases } from './investigation';
import { ownedBusinesses, businessDef } from './business';
import { promisesTo, daysLeft } from './promises';
import { crewList } from './npc';
import { PROMISE, PROMISES } from '../config/promises';
import { ATTENTION } from '../config/attention';
import { OPERATION_BY_ID } from '../config/operations';
import { PATTERN } from '../config/standingOrders';

/** Which screen answers it. Kept as a plain string so sim owes the UI nothing. */
export interface Wanting {
  id: string;
  /** What is waiting, and what would satisfy it. Never just "look at this". */
  text: string;
  panel: string;
}

/**
 * Six at the outside.
 *
 * A list long enough to need reading twice is one nobody reads once. When more
 * than six things are waiting the answer is not a longer list, it is that the
 * player is behind and any of the six will do.
 */
const MOST = 6;

export function attention(state: GameState): Wanting[] {
  const out: Wanting[] = [];
  if (state.gameOver) return out;

  const spare = availableCrew(state);

  /*
     People standing about while there is work they could be doing.

     Both halves matter. Idle crew with nothing affordable on the board is not
     something the player can act on — it is the broke state, and the game has
     `work_it_yourself` for that. What is worth saying is that there are men
     *and* something to send them on.
  */
  if (spare.length > 0 && !isLayingLow(state)) {
    const affordable = availableOperations(state).filter(
      (op) => crewNeeded(state, op) <= spare.length && operationCost(state, op) <= totalFunds(state),
    );
    if (affordable.length > 0) {
      out.push({
        id: 'idle',
        text: `${spare.length} standing about, and ${affordable.length} ${
          affordable.length === 1 ? 'job' : 'jobs'
        } you could send them on.`,
        panel: 'operations',
      });
    }
  }

  // Groundwork not yet under way, on a score whose window is running down.
  for (const score of liveScores(state)) {
    if (score.status !== 'open') continue;
    const left = setupsLeft(state, score);
    if (left.length === 0) continue;
    const days = Math.max(0, score.dueDay - state.day);
    out.push({
      id: 'setups',
      text: `${left.length} still to get ready, and ${days} ${
        days === 1 ? 'day' : 'days'
      } left to do it in.`,
      panel: 'operations',
    });
    break;
  }

  /*
     A district held well enough to be worth giving to somebody, with nobody
     in it. `stewardCandidateDistrict` carries both halves of that condition.

     Round 24's blind report held ground the whole run and never found this:
     "the district you hold has nobody running it" named the situation and
     not the district, the candidate, or that the control sits inside that
     district's own detail view under "Who runs it." Naming all three is the
     same repair `teaching`'s hint already made for the same reason.
  */
  const idleDistrict = stewardCandidateDistrict(state);
  if (idleDistrict) {
    const candidate = eligibleStewards(state)[0];
    out.push({
      id: 'steward',
      text: candidate
        ? `${territoryDef(idleDistrict.id).name} has nobody running it. Open it and put ${candidate.name} in charge.`
        : `${territoryDef(idleDistrict.id).name} has nobody running it, and somebody could be.`,
      panel: 'territory',
    });
  }

  /*
     A war with nobody named to survive you.

     Round 18's blind report is the reason this exists: a tester fought a
     war for a hundred days, was killed in it, and the death screen named
     the exact cause — "there was nobody senior enough to take it." Nothing
     on the war screen, the overview, or anywhere else had pointed back at
     Succession while it still mattered, and by the time the war made it
     urgent it was too late to do anything about it.

     Gated on there being somebody who actually could be named, the same
     discipline `steward` and `teaching` use above — a badge demanding
     something the player has no way to satisfy is worse than no badge.
  */
  if (playerWars(state).length > 0 && !heirOf(state)) {
    const candidate = eligibleHeirs(state)[0];
    out.push({
      id: 'heir',
      text: candidate
        ? `You are at war and nobody is named to take this if it goes wrong. ${candidate.name} is senior enough.`
        : 'You are at war and nobody is named to take this if it goes wrong.',
      panel: 'succession',
    });
  }

  /*
     An order that has been on the same corner long enough to be a routine.

     This is the line that makes the pattern playable. Nobody should have to
     sit and watch a meter to automate well, and the mechanic would be an
     ambush rather than a cost if the only way to see it coming were to open
     the assemble panel and read the odds row. Said once, above the level the
     bill starts to be felt, and it names the answer — somewhere else — rather
     than demanding a look.
  */
  for (const order of liveStanding(state)) {
    if (patternOn(state, order.defId, order.territoryId) < PATTERN.noticeAbove) continue;
    out.push({
      id: 'pattern',
      text: `${OPERATION_BY_ID[order.defId]?.name ?? 'That job'} in ${
        territoryDef(order.territoryId).name
      } has a rhythm to it now. Somewhere else would be quieter.`,
      panel: 'operations',
    });
    break;
  }

  /*
     Pairings are named only when there is nobody in one.

     A run in progress is not waiting on the player — it finishes on its own
     day. What is worth saying is that two men could be put together and are
     not, and only when the bench can carry it.
  */
  if (liveTraining(state).length === 0 && spare.length >= 4) {
    const best = [...spare].sort((a, b) => b.stats.skill - a.stats.skill)[0];
    const worst = [...spare].sort((a, b) => a.stats.skill - b.stats.skill)[0];
    const gap = best.stats.skill - worst.stats.skill;
    if (gap >= 20) {
      /*
         Round 18's blind report, twice: a prompt naming the situation
         ("your best man is free") and not the door ("open his profile,
         find Put them with somebody") sent the tester looking at the Crew
         list itself rather than at the one man's page the action actually
         lives on — this file's own header names exactly this failure for
         the succession badge and the fix is the same rule applied here.
         Naming the two men gives the player something to click on rather
         than a screen to search.
      */
      out.push({
        id: 'teaching',
        /*
           Names both men and the button, per this file's own header rule.

           A depersonalized variant of this line — "your best man ... could
           learn from him" — shipped once (5f6407f) and sat unnoticed until
           an unrelated edit exposed it; worth knowing the prose guards can
           miss a vague subject as well as catch one. Naming both people by
           name sidesteps that class of mistake entirely rather than relying
           on a linter to keep catching it.
        */
        text: `${worst.name} could learn from ${best.name}, and neither is doing anything today. Open ${worst.name}'s page and look for "Put them with somebody."`,
        panel: 'crew',
      });
    }
  }

  /*
     ------------------------------------------------------------------ drama

     Everything above this line is the recurring loop asking to be run — men
     idle, groundwork waiting, a district with nobody in it. That is what this
     file was built for and it is why a manual playthrough named moving
     between panels as tedious.

     What it never said was that anything was *going wrong*, so a career could
     be quietly falling apart on four screens the player had no reason to open.

     Two rules hold for every line below, and they are the reason there are
     only four of them.

     **It has to be something the organization can actually see.** A man's
     loyalty, his grievance, whether he has started talking — none of that
     belongs here. `perceive()` exists to blur exactly those, and a list that
     announced them would switch the perception system off from a screen the
     player reads first. The person-shaped half of this is `approaches.ts`,
     where the licence is that the man is telling you. What is left for this
     file is the paperwork: cases, books, ground, and things the player said
     out loud.

     **And it still names what would satisfy it.** The Rail's rule, which this
     file was written to obey: a demand for attention with no statement of what
     it wants is what left a playtester carrying the succession "!" for a
     hundred days.
  */

  /*
     A case that has moved, which is the one law-enforcement fact a family
     would know before it is too late.

     Gated on the stage having changed recently rather than on a case merely
     existing, because a case exists for most of a career and a permanent line
     saying so is the wallpaper this file's cap was written against. What is
     news is that it moved.
  */
  for (const c of activeCases(state)) {
    if (state.day - c.stageSince > ATTENTION.caseMovedWithin) continue;
    out.push({
      id: 'case',
      text: 'A case against you has moved on a stage. There are people you could put between it and them.',
      panel: 'law',
    });
    break;
  }

  /*
     A front going under, which the books say and nothing else does.

     `health` is the shop's own condition and the player owns the shop, so this
     is a number they are entitled to. Named as the thing to do rather than as
     a reading, because "Health: 22" is a stat and "it will close" is a
     decision.
  */
  const failing = ownedBusinesses(state).filter((b) => b.health <= ATTENTION.frontFailingAt);
  if (failing.length > 0) {
    out.push({
      id: 'front',
      text:
        failing.length === 1
          ? `${businessDef(failing[0]).name} is going under. It closes if nobody does anything about it.`
          : `${failing.length} of your fronts are going under.`,
      panel: 'businesses',
    });
  }

  /*
     Something you said, about to become something you did not do.

     The only line here that is about a person, and it is allowed because it
     is about *the player's own words* rather than about the man's insides.
     `config/promises.ts` sets the rule it serves: a promise the player forgot
     about is a fair loss, a promise the player was never shown is a trick.
  */
  const dueSoon = crewList(state)
    .flatMap((npc) =>
      promisesTo(state, npc.id).map((pr) => ({ npc, pr, left: daysLeft(state, pr) })),
    )
    .filter((x) => x.left <= PROMISE.urgentWithin)
    .sort((a, b) => a.left - b.left);
  if (dueSoon.length > 0) {
    const first = dueSoon[0];
    out.push({
      id: 'promise',
      text:
        dueSoon.length === 1
          ? `${first.npc.name} ${PROMISES[first.pr.kind].outstanding.toLowerCase()}, and you have ${first.left} ${first.left === 1 ? 'day' : 'days'}.`
          : `${dueSoon.length} things you said are about to stop being true.`,
      panel: 'crew',
    });
  }

  /*
     NOT SHIPPED: ground being taken back.

     Two versions were written and both measured as furniture. "Somebody is
     ahead of you anywhere you have a foot in" fired on 286 of 300 days in one
     career and 211 in another; narrowing it to `isContested` moved one career
     to zero and pushed another *up* to 262, because in a career that spends
     its life fighting over the same streets, contested is not news either.

     The fault is not the threshold, it is the shape. Both versions asked a
     question about a level, and this file's other lines are all about events
     — a case that moved, a front that is going under, a promise coming due.
     A district being contested is a condition the player lives in for years.

     Saying it properly needs the one thing the state does not keep: who was
     ahead here last week. That is a field and a tick, not a filter, and it
     belongs in a change that can measure whether the answer is worth the
     storage. Left out rather than left in and loud, on the same grounds
     `events.ts` parked the partner offer.
  */

  return out.slice(0, MOST);
}
