/**
 * What a family gets once it owns something other than a corner.
 *
 * Two reads and one action. `hasHealthInsurance` is derived every time from
 * facts the state already keeps — a union figure's standing, a count of
 * operating fronts — so there is nothing to store, nothing to migrate and no
 * second copy to drift. `state.corporateMob` exists only to hold the one
 * thing that is a decision rather than a consequence (see `types.ts`), and
 * the insurance read deliberately does not touch it.
 *
 * `runBoilerRoom` is the other half: the only way in the game to turn a week
 * of soldiers into clean money, priced with a financial trail and a stock
 * that stays burned.
 */

import { Rng } from './rng';
import type { GameState } from './types';
import { BOILER_ROOM, HEALTH_INSURANCE } from '../config/corporate';
import { figure } from './civic';
import { ownedBusinesses } from './business';
import { availableCrew } from './npc';
import { earnClean, spend } from './economy';
import { addHeat } from './heat';
import { addEvidence, addLog } from './util';

/**
 * Whether somebody else is paying for the boss's heart.
 *
 * Either route on its own is enough, and they are genuinely different careers
 * reaching the same place: a boss who spent his favours on a union local, or
 * one who bought legitimate businesses with a payroll to put a group plan on.
 * The waste hauler counts on its own because that is what it is for — a
 * legitimate payroll with your name on the door as a special consultant.
 */
export function hasHealthInsurance(state: GameState): boolean {
  if (figure(state, 'union').standing >= HEALTH_INSURANCE.minUnionStanding) return true;
  const fronts = ownedBusinesses(state);
  if (fronts.some((b) => b.defId === 'waste_management')) return true;
  return fronts.length >= HEALTH_INSURANCE.minFronts;
}

/** What the plan takes off the weekly weariness. Zero for the uninsured. */
export function wearinessRelief(state: GameState): number {
  return hasHealthInsurance(state) ? HEALTH_INSURANCE.wearinessRelief : 0;
}

const BOILER_FLAG = 'boiler_room_day';

/**
 * Whether there is a floor to open, and a stock left to sell.
 *
 * Refuses by naming its own bar, like every other refusal here.
 */
export function canRunBoilerRoom(state: GameState): { ok: boolean; reason?: string } {
  const since = state.day - (state.flags[BOILER_FLAG] ?? -9999);
  if (since < BOILER_ROOM.cooldownDays) {
    return {
      ok: false,
      reason:
        `The last issue is still being asked about. Another shell is worth nothing for ` +
        `${BOILER_ROOM.cooldownDays - since} more days.`,
    };
  }
  if (state.org.cash + state.org.dirtyCash < BOILER_ROOM.setupCost) {
    return {
      ok: false,
      reason: `The lease, the phones and the prospectus run $${BOILER_ROOM.setupCost.toLocaleString('en-US')}, and you do not have it.`,
    };
  }
  const free = availableCrew(state).length;
  if (free < BOILER_ROOM.crewRequired) {
    return {
      ok: false,
      reason: `A floor needs ${BOILER_ROOM.crewRequired} men on the phones for a week. You have ${free} free.`,
    };
  }
  return { ok: true };
}

/**
 * The pump, and the dump.
 *
 * Draws from the causal stream, which is correct: this is an outcome, not a
 * prose variant. Pays into `state.org.cash` through `earnClean` — the whole
 * point of the exercise — and leaves `finance` paper behind, which is exactly
 * the source the agencies that work money already read.
 */
export function runBoilerRoom(state: GameState, rng: Rng): { ok: boolean; message: string } {
  const check = canRunBoilerRoom(state);
  if (!check.ok) return { ok: false, message: check.reason ?? '' };
  if (!spend(state, BOILER_ROOM.setupCost, 'stock')) {
    return {
      ok: false,
      message: `The floor runs $${BOILER_ROOM.setupCost.toLocaleString('en-US')} and it is not there.`,
    };
  }

  const ramp = Math.min(
    state.org.respect * BOILER_ROOM.respectBonusPerPoint,
    BOILER_ROOM.respectBonusCap,
  );
  const multiple =
    rng.float(BOILER_ROOM.returnRange[0], BOILER_ROOM.returnRange[1]) * (1 + ramp);
  const take = Math.round(BOILER_ROOM.setupCost * multiple);

  earnClean(state, take, 'fronts');
  state.flags[BOILER_FLAG] = state.day;
  addHeat(state, BOILER_ROOM.heat, 'money', `${BOILER_ROOM.name} collapsed and somebody complained.`);
  addEvidence(state, {
    day: state.day,
    source: 'finance',
    strength: BOILER_ROOM.evidenceStrength,
    npcIds: [],
    detail: `Transfer records from the ${BOILER_ROOM.name} issue.`,
  });

  const message =
    `${BOILER_ROOM.name} closed at nothing. $${take.toLocaleString('en-US')} came out clean, ` +
    `and forty people who believed the kid on the phone did not.`;
  addLog(state, message, 'money');
  return { ok: true, message };
}
