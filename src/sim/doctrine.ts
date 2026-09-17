/**
 * The one decision that is about the whole organization.
 *
 * The design argument is in `config/doctrine.ts`. What this file has to keep
 * true is four things:
 *
 * 1. **Nothing is stored that can be derived.** `MobDoctrineState` is two
 *    fields — which one, and when. Every modifier below is a lookup out of
 *    `DOCTRINES` at the moment it is asked, so a config change moves the
 *    whole game rather than only new saves.
 *
 * 2. **An undeclared career is bit-identical to one written before this
 *    existed.** Every modifier returns its neutral value when `state.doctrine`
 *    is absent, and nothing here draws from any stream at all. A doctrine is
 *    a thing a man says, not a thing a die decides.
 *
 * 3. **Every refusal names what would lift it.** `setDoctrine` on a cooldown
 *    says the day it clears and how many days that is.
 *
 * 4. **The relic step is a consequence, not a subscription.** Declaring costs
 *    or pays the old men once, at the table, on the day. `DOCTRINE.
 *    switchCooldownDays` is what stops that being farmable — without it a boss
 *    could toggle twice an afternoon and buy ten points of loyalty a time.
 */

import { clamp } from './rng';
import type { AttributeId, GameState, MobDoctrineState, Npc } from './types';
import { DOCTRINE, DOCTRINES, type DoctrineDef, type DoctrineId } from '../config/doctrine';
import { isRelic } from './capoTension';
import { crewList, addNote } from './npc';
import { recordCareerEvent } from './career';
import { addLog } from './util';

export type { DoctrineId };

/**
 * What is currently declared, or nothing.
 *
 * Reads without creating, unlike `tributeState` and `suburbanState` — see the
 * note on `GameState.doctrine` for why a lazy default is the one thing this
 * field cannot have.
 */
export function doctrineState(state: GameState): MobDoctrineState | null {
  return state.doctrine ?? null;
}

/** The declared doctrine's definition, or null while nothing has been said. */
export function currentDoctrine(state: GameState): DoctrineDef | null {
  const held = doctrineState(state);
  return held ? DOCTRINES[held.current] : null;
}

/** Everybody at the table who remembers the old way. */
export function relics(state: GameState): Npc[] {
  return crewList(state).filter(
    (n) => (n.status === 'active' || n.status === 'busy') && isRelic(n),
  );
}

// ------------------------------------------------------------ the modifiers --

/**
 * Added to the attribute a job is scored on — and only where that attribute
 * is the one the doctrine is actually about.
 *
 * Deliberately not written into `state.player.attributes`. Storing it would
 * make the bonus a permanent stat the training system then builds on, and
 * switching away would have to subtract it back out of a number that has since
 * been clamped at `ATTRIBUTE_MAX` — which silently destroys real points the
 * player earned. A derived read cannot do that.
 */
export function doctrineAttributeBonus(state: GameState, attribute: AttributeId): number {
  if (attribute !== 'intimidation') return 0;
  return currentDoctrine(state)?.intimidationBonus ?? 0;
}

/** Multiplies the attention a job draws. 1 while nothing has been declared. */
export function doctrineFederalHeat(state: GameState): number {
  return currentDoctrine(state)?.federalHeat ?? 1;
}

/** Multiplies what a front takes over the counter. */
export function doctrineCleanYield(state: GameState): number {
  return currentDoctrine(state)?.cleanYield ?? 1;
}

/** Multiplies `FEAR.decayShare`. Above 1 means a claim to violence expires faster. */
export function doctrineFearDecay(state: GameState): number {
  return currentDoctrine(state)?.fearDecay ?? 1;
}

// ------------------------------------------------------------ declaring it --

export interface DoctrineResult {
  ok: boolean;
  message: string;
}

/** When the current declaration can be taken back, or null if it already can. */
export function doctrineLockedUntil(state: GameState): number | null {
  const held = doctrineState(state);
  if (!held) return null;
  const clears = held.sinceDay + DOCTRINE.switchCooldownDays;
  return clears > state.day ? clears : null;
}

/**
 * Say it out loud.
 *
 * Refuses a no-op rather than re-charging the table for hearing the same
 * thing twice, and refuses a switch inside the cooldown with the day it
 * clears — which is the whole of rule 4: a gate is fine, a gate that will not
 * say what lifts it is not.
 */
export function setDoctrine(state: GameState, doctrine: DoctrineId): DoctrineResult {
  const held = doctrineState(state);
  if (held?.current === doctrine) {
    return { ok: false, message: `That is already what this is.` };
  }

  const locked = doctrineLockedUntil(state);
  if (locked !== null) {
    const days = locked - state.day;
    return {
      ok: false,
      message:
        `You said what this was ${state.day - held!.sinceDay} days ago and people ` +
        `arranged their lives around it. Ask again in ${days} day${days === 1 ? '' : 's'}.`,
    };
  }

  const def = DOCTRINES[doctrine];
  state.doctrine = { current: doctrine, sinceDay: state.day };

  /*
     The men who made you find out the same afternoon.

     One step, at the table, once. `isRelic` is `capoTension.ts`'s read and is
     reused rather than re-derived — the same men the generational fracture
     already puts on one side of the room are the men this lands on, which is
     the point: these two systems are about the same fault line.
  */
  for (const npc of relics(state)) {
    if (def.relicLoyalty !== 0) {
      npc.stats.loyalty = clamp(npc.stats.loyalty + def.relicLoyalty, 0, 100);
    }
    if (def.relicGrievance !== 0) {
      npc.stats.grievance = clamp(npc.stats.grievance + def.relicGrievance, 0, 100);
      addNote(npc, state.day, 'Heard the boss call this an industry.', 'bad');
    }
  }

  addLog(state, def.beat, 'crew');
  recordCareerEvent(state, `Declared the family ${def.name}.`, 'neutral');
  return { ok: true, message: def.name };
}
