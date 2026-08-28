/**
 * The person who handles the money, and the relationship with them.
 *
 * The design lives in `config/launderers.ts`. This is the machine: retaining
 * one, what they charge today, whether they are still taking your calls, and
 * the weekly fee they take for being there.
 *
 * It owns none of the laundering itself. `business.ts` moves the money and
 * reads `launderCut`; this module only decides what that number is. Kept apart
 * because the cut is a property of who you know and the wash is a property of
 * what you own, and conflating the two is how the 24% became invisible in the
 * first place.
 */

import { Rng, clamp } from './rng';
import type { GameState } from './types';
import { addEvidence, addLog, formatMoney } from './util';
import { priced } from './market';
import { note } from './ledger';
import {
  LAUNDERERS,
  LAUNDERER_BY_ID,
  LAUNDER_TRUST,
  type LaundererDef,
} from '../config/launderers';
import { PAYDAY_INTERVAL } from '../config/economy';

export interface LaundererAction {
  ok: boolean;
  message: string;
}

/** Local copy of economy.ts:totalFunds — this module must stay off that import. */
function funds(state: GameState): number {
  return state.org.cash + state.org.dirtyCash;
}

function pay(state: GameState, amount: number): boolean {
  if (amount <= 0) return true;
  if (funds(state) < amount) return false;
  const fromDirty = Math.min(state.org.dirtyCash, amount);
  state.org.dirtyCash -= fromDirty;
  state.org.cash -= amount - fromDirty;
  // A retainer and a weekly fee are a standing arrangement, not the wash
  // itself — `wash` is the share taken out of what goes through.
  note(state, 'premises', -amount);
  return true;
}

/** Whoever is handling it, or null for a family dealing with strangers. */
export function launderer(state: GameState): LaundererDef | null {
  const id = state.org.launderer?.id;
  return id ? (LAUNDERER_BY_ID[id] ?? null) : null;
}

/** What they think of you, 0..100. Zero for somebody you have not kept. */
export function laundererTrust(state: GameState, id: string): number {
  return state.org.laundererTrust?.[id] ?? 0;
}

/**
 * What they take today.
 *
 * Walks from their opening rate toward their best one as the relationship
 * holds. `business.ts:launderCut` applies the Business attribute on top and
 * clamps the result, so this is the relationship's half of the answer and not
 * the whole of it.
 */
export function laundererRate(state: GameState, def: LaundererDef): number {
  const trust = clamp(laundererTrust(state, def.id), 0, 100) / 100;
  return def.cut - (def.cut - def.bestCut) * trust;
}

/**
 * The chance this arrangement simply ends, this week.
 *
 * Trust only ever reduces it, the same way it does for a contraband supplier.
 * At nothing the figure is exactly the config's own, which is what a family
 * that has just hired somebody sees.
 */
export function laundererWalkChance(state: GameState, def: LaundererDef): number {
  const trust = clamp(laundererTrust(state, def.id), 0, 100);
  return def.failureChancePerWeek * (1 - (trust / 100) * LAUNDER_TRUST.maxReduction);
}

export function canRetainLauderer(state: GameState, id: string): LaundererAction {
  const def = LAUNDERER_BY_ID[id];
  if (!def) return { ok: false, message: 'No such arrangement.' };
  if (state.org.launderer?.id === id) {
    return { ok: false, message: 'They already handle it.' };
  }
  const retainer = priced(state, def.retainer);
  if (funds(state) < retainer) {
    return {
      ok: false,
      message: `The retainer is ${formatMoney(retainer)} and you have ${formatMoney(funds(state))}.`,
    };
  }
  return { ok: true, message: `${formatMoney(retainer)} to open, ${formatMoney(priced(state, def.fee))} a week.` };
}

export function retainLaunderer(state: GameState, id: string): LaundererAction {
  const check = canRetainLauderer(state, id);
  if (!check.ok) return check;
  const def = LAUNDERER_BY_ID[id]!;
  if (!pay(state, priced(state, def.retainer))) {
    return { ok: false, message: 'You cannot cover the retainer.' };
  }

  state.org.launderer = { id, since: state.day };
  /*
     From nothing, every time.

     The thing being rewarded is having kept them, so walking out and coming
     back does not restore what you had. Same rule `openSupply` follows for a
     contraband arrangement, and for the same reason.
  */
  if (!state.org.laundererTrust) state.org.laundererTrust = {};
  state.org.laundererTrust[id] = 0;
  addLog(state, `${def.name} handles it now.`, 'money');
  return { ok: true, message: def.name };
}

export function dropLaunderer(state: GameState): LaundererAction {
  const held = launderer(state);
  if (!held) return { ok: false, message: 'Nobody handles it for you.' };
  state.org.launderer = null;
  addLog(state, `${held.name} does not work for you any more.`, 'neutral');
  return { ok: true, message: held.name };
}

/**
 * A raid frightens them, whatever the relationship was.
 *
 * Called from wherever a warrant lands, exactly as `shakeSupplierTrust` is.
 * This is where the discount is actually lost in play: heat holds trust at
 * nothing while you are hot, and a raid takes back what a quiet year earned.
 */
export function shakeLaundererTrust(state: GameState): void {
  const held = state.org.laundererTrust;
  if (!held) return;
  for (const id of Object.keys(held)) {
    held[id] = clamp(held[id] - LAUNDER_TRUST.seizureCost, 0, 100);
  }
}

/**
 * A week of being handled.
 *
 * Drifts toward a target rather than adding — the idiom `tickSupplierTrust` and
 * `tickCivic` both already use. The target is how long you have kept them,
 * gated on how much attention you are drawing: at or above `heatCeiling` it is
 * nothing, so a loud career never gets the better rate however long it has
 * been paying.
 *
 * Draws from `rng` only when somebody is actually retained, so a career that
 * has never hired anybody consumes exactly the randomness it always did.
 */
export function tickLaunderer(state: GameState, rng: Rng): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const held = launderer(state);
  if (!held) return;

  if (!pay(state, priced(state, held.fee))) {
    state.org.launderer = null;
    addLog(state, `${held.name} was not paid, and has stopped.`, 'failure');
    return;
  }

  /*
     A ratchet with slow decay, not a target that resets to zero.

     `tickSupplierTrust` drifts toward `100 * kept * quiet`, and `quiet` is
     zero on any week over the heat ceiling — so on a population whose mean
     heat is 77 and which is under 60 only 21% of weeks, the target is zero
     four weeks in five and the level never leaves the floor. The first version
     of this function copied that and the probe reported a best standing of
     0/100 across all 36 careers.

     Here heat gates the *gain*. A quiet week adds `driftPerWeek` toward what
     the length of the relationship allows; a loud one takes `hotDecayPerWeek`,
     which is a fraction of it. Time still caps the ceiling — nobody gets the
     best rate in their first month however quiet they are.
  */
  if (!state.org.laundererTrust) state.org.laundererTrust = {};
  const weeks = Math.max(0, (state.day - (state.org.launderer?.since ?? state.day)) / 7);
  const kept = Math.min(1, weeks / LAUNDER_TRUST.weeksToFull);
  const quiet = clamp(
    (LAUNDER_TRUST.heatCeiling - state.org.heat) /
      (LAUNDER_TRUST.heatCeiling - LAUNDER_TRUST.quietBelow),
    0,
    1,
  );
  const now = state.org.laundererTrust[held.id] ?? 0;
  const gained = Math.min(now + LAUNDER_TRUST.driftPerWeek * quiet, 100 * kept);
  const after = gained - LAUNDER_TRUST.hotDecayPerWeek * (1 - quiet);
  state.org.laundererTrust[held.id] = clamp(Math.max(after, 0), 0, 100);

  if (held.exposure > 0) {
    addEvidence(state, {
      day: state.day,
      source: 'finance',
      strength: held.exposure,
      npcIds: [],
      detail: `The same name signing for accounts in four places.`,
    });
  }

  if (rng.chance(laundererWalkChance(state, held))) {
    state.org.launderer = null;
    addLog(state, `${held.name} has stopped acting for you. No explanation.`, 'failure');
  }
}

/** Every arrangement, with what it would cost this family right now. */
export function readLaunderers(state: GameState) {
  return LAUNDERERS.map((def) => ({
    def,
    current: state.org.launderer?.id === def.id,
    trust: laundererTrust(state, def.id),
    rate: laundererRate(state, def),
    walk: laundererWalkChance(state, def),
    retainer: priced(state, def.retainer),
    fee: priced(state, def.fee),
  }));
}
