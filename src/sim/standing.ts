/**
 * Who has been carrying it.
 *
 * A leaf module, the same shape as `memory.ts`: it reads the job history and
 * the crew list, and imports nothing that imports it back.
 *
 * Derived rather than counted. `state.operationHistory` already holds every
 * job with the men who were on it, already persists, and is already capped at
 * two hundred entries — fifty-odd weeks of play. A per-person counter would be
 * a second copy of the same fact, and second copies drift.
 */

import { clamp } from './rng';
import { STANDING } from '../config/standing';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import type { GameState, Id } from './types';

function inWindow(state: GameState) {
  return state.operationHistory.filter((r) => state.day - r.day <= STANDING.windowDays);
}

/** Jobs he has been out on lately. */
export function nightsWorked(state: GameState, npcId: Id): number {
  return inWindow(state).filter((r) => r.crewIds.includes(npcId)).length;
}

/** Whether anybody has been out at all lately. */
export function crewWasBusy(state: GameState): boolean {
  return inWindow(state).some((r) => r.crewIds.length > 0);
}

function working(state: GameState) {
  return crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
}

/**
 * His nights against the crew average. One is exactly average.
 *
 * Returns 1 rather than 0 when nothing has happened at all. A quiet fortnight
 * is not the same as being passed over, and the difference matters because the
 * bench mark below reads this number to decide whether somebody has been
 * snubbed. It is also what keeps a new career from dividing by zero on day one.
 */
export function share(state: GameState, npcId: Id): number {
  const crew = working(state);
  if (crew.length === 0) return 1;

  const total = crew.reduce((sum, n) => sum + nightsWorked(state, n.id), 0);
  if (total === 0) return 1;

  return nightsWorked(state, npcId) / (total / crew.length);
}

/**
 * The weekly read of who has been carrying it and who has been watching.
 *
 * Runs before `driftNpcs`, on the same principle as `tickPromises`: a man
 * marked this morning should be aggrieved when the drift asks him this
 * afternoon how he feels about you.
 *
 * Both marks are carried by memories, which sit under sit-down reasons,
 * defection, `claimFrom` and goals already. That is deliberate — it means this
 * feeds four systems that exist and were built for exactly this, and no new
 * consumer has to be written.
 */
export function markStanding(state: GameState): void {
  const busy = crewWasBusy(state);

  for (const npc of working(state)) {
    if (npc.daysInCrew < STANDING.settledAfterDays) continue;

    const s = share(state, npc.id);

    if (s >= STANDING.carryAbove) {
      npc.stats.ambition = clamp(npc.stats.ambition + STANDING.carry.ambition, 0, 100);
      npc.stats.greed = clamp(npc.stats.greed + STANDING.carry.greed, 0, 100);
      remember(npc, state.day, 'carried_the_work');
      addNote(npc, state.day, 'Has been out more than anybody else.', 'neutral');
      continue;
    }

    /*
       Three guards on the bench mark, and they are the part of this most
       likely to punish a player for something correct.

       Holding a reserve is legitimate, and the arrest and injury systems make
       it necessary — measurement put roughly two of every seven people out of
       the crew at any moment. A man in a cell is not being snubbed. And
       somebody hired on Tuesday has not been passed over by Friday.
    */
    if (busy && s <= STANDING.benchBelow) {
      npc.stats.loyalty = clamp(npc.stats.loyalty + STANDING.bench.loyalty, 0, 100);
      npc.stats.grievance = clamp(npc.stats.grievance + STANDING.bench.grievance, 0, 100);
      remember(npc, state.day, 'left_on_the_bench');
      addNote(npc, state.day, 'Has not been out while the others have.', 'bad');
    }
  }
}
