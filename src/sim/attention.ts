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
import { needsSteward } from './delegation';
import { liveScores, setupsLeft } from './scores';
import { liveTraining } from './training';
import { availableOperations, crewNeeded, operationCost } from './operations';
import { totalFunds } from './economy';
import { isLayingLow } from './heat';
import { liveStanding, patternOn } from './standingOrders';
import { territoryDef } from './territory';
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

  // A district held well enough to be worth giving to somebody, with nobody in
  // it. `needsSteward` already carries both halves of that condition.
  if (needsSteward(state)) {
    out.push({
      id: 'steward',
      text: 'A district you hold has nobody running it, and somebody could.',
      panel: 'territory',
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
    const skills = spare.map((n) => n.stats.skill);
    const gap = Math.max(...skills) - Math.min(...skills);
    if (gap >= 20) {
      out.push({
        id: 'teaching',
        text: 'Your best man is free, and so is somebody who could learn from him.',
        panel: 'crew',
      });
    }
  }

  return out.slice(0, MOST);
}
