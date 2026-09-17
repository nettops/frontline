/**
 * The neighbours, and the bill that comes for them.
 *
 * The design argument is in `config/suburbs.ts`. The mechanics that matter:
 *
 * **A favour is cheap and legal and it is still the most expensive thing on
 * this screen.** It costs a few hundred dollars and it moves a civic figure's
 * bar, which is the same `publicStanding` `investigation.ts` already reads to
 * decide how fast a case grows. So the immediate effect is genuinely good.
 * What it also does is put a man who never took an oath one rung further in.
 *
 * **Civilians break, and they break once.** `panicked` latches. A neighbour
 * who has folded is spent — there is no second statement — which keeps this
 * from becoming a weekly tax and makes each of them a finite, real loss.
 *
 * **Nothing here is stored that can be derived.** `activeInformantThreats` is
 * recomputed from scratch on every weekly tick rather than appended to, so a
 * case going cold takes the threat off the list the same week.
 */

import { Rng, clamp } from './rng';
import type { GameState, SuburbanNeighbour, SuburbanState } from './types';
import {
  SUBURBAN_FAVOUR_BY_ID,
  SUBURBAN_NEIGHBOURS,
  SUBURBAN_NEIGHBOUR_BY_ID,
  SUBURBS,
} from '../config/suburbs';
import { stageIndex } from '../config/lawEnforcement';
import { activeCases, recordCaseEvent } from './investigation';
import { figure } from './civic';
import { canAfford, spend } from './economy';
import { priced } from './market';
import { addLog } from './util';

/** Lazy, so a save written before the cul-de-sac existed loads with a clean block. */
export function suburbanState(state: GameState): SuburbanState {
  if (!state.suburban) {
    state.suburban = {
      neighbours: SUBURBAN_NEIGHBOURS.map((def) => ({
        id: def.id,
        name: def.name,
        exposure: 0,
        lastFavourDay: -9999,
      })),
      resolvedFavours: [],
      activeInformantThreats: [],
    };
  }
  /*
     And a neighbour added to the catalogue after this save was written, the
     same way `civic.ts`'s `figure` handles a figure added later. A block
     built once and never reconciled is how a roster quietly loses the
     newest entry for the whole of an old career.
  */
  const have = new Set(state.suburban.neighbours.map((n) => n.id));
  for (const def of SUBURBAN_NEIGHBOURS) {
    if (have.has(def.id)) continue;
    state.suburban.neighbours.push({
      id: def.id,
      name: def.name,
      exposure: 0,
      lastFavourDay: -9999,
    });
  }
  return state.suburban;
}

export function neighbour(state: GameState, id: string): SuburbanNeighbour | undefined {
  return suburbanState(state).neighbours.find((n) => n.id === id);
}

export interface FavourCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether the favour can be asked for tonight.
 *
 * Refuses by naming what would lift it, like every other refusal in this
 * project — the one rule a gate is not allowed to break.
 */
export function canRequestSuburbanFavour(
  state: GameState,
  neighbourId: string,
  favourId: string,
): FavourCheck {
  const def = SUBURBAN_NEIGHBOUR_BY_ID[neighbourId];
  const fav = SUBURBAN_FAVOUR_BY_ID[favourId];
  if (!def || !fav) return { ok: false, reason: 'Nobody on this street can arrange that.' };
  if (!def.favours.includes(favourId)) {
    return { ok: false, reason: `${def.name} is not the one to ask about that.` };
  }
  const held = neighbour(state, neighbourId);
  if (!held) return { ok: false, reason: 'Nobody on this street can arrange that.' };
  if (held.panicked) {
    return {
      ok: false,
      reason: `${held.name} has already talked to them. He will not open the door.`,
    };
  }
  const since = state.day - held.lastFavourDay;
  if (since < fav.cooldownDays) {
    return {
      ok: false,
      reason:
        `You asked ${held.name} for something ${since === 0 ? 'today' : `${since} days ago`}. ` +
        `Going back inside ${fav.cooldownDays} days makes it an arrangement rather than a favour.`,
    };
  }
  const cost = priced(state, fav.cost);
  if (!canAfford(state, cost)) {
    return {
      ok: false,
      reason: `Arranging it runs $${Math.round(cost).toLocaleString('en-US')}, and you do not have it.`,
    };
  }
  return { ok: true };
}

export interface FavourResult {
  ok: boolean;
  message: string;
}

/**
 * Asking, and getting it.
 *
 * The standing lands directly on the neighbour's civic figure rather than
 * through `helpFigure` on purpose: `helpFigure` carries its own
 * `CIVIC.helpCooldownDays` rate limit and returns `false` when it bites,
 * which would make this a control that takes a click, spends the money and
 * quietly does nothing. The rate limit here is the favour's own
 * `cooldownDays`, and `canRequestSuburbanFavour` says so out loud before the
 * money moves.
 */
export function requestSuburbanFavour(
  state: GameState,
  neighbourId: string,
  favourId: string,
): FavourResult {
  const check = canRequestSuburbanFavour(state, neighbourId, favourId);
  if (!check.ok) return { ok: false, message: check.reason ?? '' };

  const def = SUBURBAN_NEIGHBOUR_BY_ID[neighbourId];
  const fav = SUBURBAN_FAVOUR_BY_ID[favourId];
  const held = neighbour(state, neighbourId)!;
  if (!spend(state, priced(state, fav.cost), 'world')) {
    return { ok: false, message: 'The money for it is not there.' };
  }

  const standing = figure(state, def.figureId);
  standing.standing = clamp(standing.standing + fav.standing, 0, 100);
  held.exposure = clamp(held.exposure + fav.exposure, 0, SUBURBS.maxExposure);
  held.lastFavourDay = state.day;
  suburbanState(state).resolvedFavours.push({ neighbourId, favourId, day: state.day });

  const message = `${held.name}: ${fav.name.toLowerCase()}. Nobody on the street will call it anything else.`;
  addLog(state, message, 'neutral');
  return { ok: true, message };
}

/**
 * Whether anybody is knocking on ordinary doors this week.
 *
 * Two conditions and either is enough — a case with a van outside is already
 * building a list of everybody the boss talks to, and heat past
 * `panicHeatFloor` means agents are asking around whether a file says so or
 * not. Exported so the panel can show the same bar this file reads.
 */
export function civiliansAreBeingQuestioned(state: GameState): boolean {
  if (state.org.heat >= SUBURBS.panicHeatFloor) return true;
  return activeCases(state).some((c) => stageIndex(c.stage) >= stageIndex('surveillance'));
}

/**
 * Once a week: who is exposed, and whether one of them folded.
 *
 * Draws from the causal stream, which is correct — this is an outcome, not a
 * prose variant. Returns immediately on every other day, so `clock.ts` does
 * not have to know the interval.
 */
export function tickSuburban(state: GameState, rng: Rng): void {
  if (state.day % 7 !== 0) return;
  const block = suburbanState(state);

  const questioned = civiliansAreBeingQuestioned(state);
  const compromised = block.neighbours.filter((n) => n.exposure > 0 && !n.panicked);
  // Recomputed rather than appended to — see this file's header.
  block.activeInformantThreats = questioned ? compromised.map((n) => n.id) : [];
  if (!questioned) return;

  /*
     The file it lands on. Worst case first: a panicked civilian talks to
     whoever is in front of him, and the agency with the strongest case is
     the one with agents out knocking. Heat alone can raise the questioning
     without any file existing — in that case there is nothing to hand a
     statement to and nothing happens, which is the honest outcome rather
     than inventing a case to receive it.
  */
  const cases = activeCases(state);
  if (cases.length === 0) return;
  const worst = cases.reduce((a, b) => (b.strength > a.strength ? b : a));

  for (const held of compromised) {
    if (!rng.chance(held.exposure * SUBURBS.panicChancePerExposure)) continue;
    held.panicked = true;
    worst.strength = clamp(worst.strength + SUBURBS.panicEvidence, 0, 100);
    /*
       Folded into `absorbed` rather than left off the breakdown. `lastGrowth`
       is the itemised answer to "why is this number what it is", and a case
       that grew from a neighbour's statement with nothing on the breakdown to
       show for it is the one thing this project's third rule forbids. Absent
       until the case's own weekly tick has run at least once, so it is
       created rather than assumed.
    */
    worst.lastGrowth = worst.lastGrowth
      ? { ...worst.lastGrowth, absorbed: worst.lastGrowth.absorbed + SUBURBS.panicEvidence }
      : { absorbed: SUBURBS.panicEvidence, work: 0, visibility: 0 };
    worst.lastProgressDay = state.day;

    /*
       Through `recordCaseEvent` rather than onto `history` directly, so this
       line obeys the same 40-entry cap every other case event does and is
       told to the player by the same rule. `obvious: true` because a
       neighbour who has been in front of a grand jury tells his wife, and
       the street knows by Sunday.
    */
    recordCaseEvent(
      state,
      worst,
      `${held.name} panicked under federal questioning and handed over records.`,
      true,
    );
  }

  block.activeInformantThreats = block.neighbours
    .filter((n) => n.exposure > 0 && !n.panicked)
    .map((n) => n.id);
}
