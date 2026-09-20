/**
 * The story of a run, kept rather than reconstructed.
 *
 * `chronicle.ts` already does this for the crew roster, and does it by
 * derivation on purpose — no state, no call site to miss, nothing that can
 * drift. This file cannot take that approach, and says why: a district taken
 * and lost again, a war fought and settled, leave
 * nothing behind in state once they are over. `chronicle.ts`'s own header
 * calls this out directly — "inventing a history for them would mean the
 * recorded second list this file exists to avoid." That second list is this
 * one, kept deliberately narrow: only the handful of things a player would
 * actually call a chapter, not everything that changed.
 *
 * 2026-09-10 polish pass, Section 11/12/21: `state.log` is the closest thing
 * that already exists, and it is the wrong instrument for this — capped at
 * `LOG_LIMIT` (400) and rotated, so a 300-day career has already lost half of
 * it and a 600-day one has lost 78%. This list is small by construction
 * (curated, not everything), so it does not need the same cap; `CAREER_LIMIT`
 * below is a safety valve, not a practical one.
 */

import type { FactionId } from '../config/factions';
import { ROLE_LABEL, ROLE_ORDER } from '../config/economy';
import { BUSINESS_BY_ID } from '../config/businesses';
import type { CareerEntry, CareerTone, GameState, Id, NpcStatus, RoleId } from './types';
import { ownedBusinesses } from './business';
import { controlledTerritories, territoryDef } from './territory';
import { playerWars } from './diplomacy';
import { houseShort } from './houses';
import { activeCases, agencyOf } from './investigation';

export type { CareerEntry, CareerTone };

/** A save written before this existed loads as a career with no chapters yet. */
export function career(state: GameState): CareerEntry[] {
  if (!state.career) state.career = [];
  return state.career;
}

/**
 * A safety valve, not a practical limit.
 *
 * The curated list this file writes fires perhaps a handful of times a
 * month in an eventful career — nothing like the daily volume `state.log`
 * carries. A career would have to run for real years of played days to
 * threaten this, and if one somehow does, dropping the oldest chapter is
 * the same trade `state.log` already makes, just at a much higher bar.
 */
const CAREER_LIMIT = 1000;

function record(state: GameState, text: string, tone: CareerTone): void {
  const entries = career(state);
  entries.push({ day: state.day, text, tone });
  if (entries.length > CAREER_LIMIT) entries.shift();
}

/** Rank a crew member has to reach before their promotion is its own chapter. */
const NOTABLE_ROLE_FROM = ROLE_ORDER.indexOf('capo');

/**
 * What a day started with, for the diff `recordCareerMilestones` reads.
 *
 * Deliberately not `report.ts`'s `Snapshot` — that lives in `ui/` for a
 * reason (nothing in `sim/` may depend on it), and it is shaped around what
 * a briefing narrates rather than what a career remembers. The overlap is
 * real; the two are not allowed to be the same function.
 */
export interface CareerSnapshot {
  /** Status and role together, so a death and a promotion are told apart. */
  crew: Record<Id, { status: NpcStatus; role: RoleId }>;
  controlled: string[];
  fronts: string[];
  wars: FactionId[];
  generation: number;
  /** Case ids currently at the indictment stage or beyond. */
  indicted: string[];
}

export function careerSnapshot(state: GameState): CareerSnapshot {
  const crew: CareerSnapshot['crew'] = {};
  for (const npc of Object.values(state.npcs)) crew[npc.id] = { status: npc.status, role: npc.role };
  return {
    crew,
    controlled: controlledTerritories(state).map((t) => t.id),
    fronts: ownedBusinesses(state).map((b) => b.id),
    wars: playerWars(state).map((f) => f.id),
    generation: state.succession.generation,
    indicted: activeCases(state)
      .filter((c) => c.stage === 'indictment' || c.stage === 'trial')
      .map((c) => c.id),
  };
}

/**
 * The diff. Called once a day, after everything else has ticked.
 *
 * Every branch reads a number some other system already owns — `npc.status`,
 * `controlledTerritories`, `ownedBusinesses`, `playerWars`,
 * `succession.generation`. Nothing here is a new mechanic, the same rule
 * `eventgen.ts` follows and for the same reason: this is the existing
 * simulation given a memory, not a second simulation running beside it.
 */
export function recordCareerMilestones(state: GameState, before: CareerSnapshot): void {
  const now = careerSnapshot(state);

  for (const [id, was] of Object.entries(before.crew)) {
    const npc = state.npcs[id];
    if (!npc || npc.status === was.status) continue;
    if (npc.status === 'dead') record(state, `${npc.name} died.`, 'bad');
    else if (npc.status === 'defected') record(state, `${npc.name} defected.`, 'bad');
  }

  for (const [id, was] of Object.entries(before.crew)) {
    const npc = state.npcs[id];
    if (!npc || npc.role === was.role) continue;
    const fromIdx = ROLE_ORDER.indexOf(was.role);
    const toIdx = ROLE_ORDER.indexOf(npc.role);
    if (toIdx >= NOTABLE_ROLE_FROM && toIdx > fromIdx) {
      record(state, `${npc.name} made ${ROLE_LABEL[npc.role]}.`, 'good');
    }
  }

  for (const id of now.controlled) {
    if (!before.controlled.includes(id)) {
      record(state, `Took ${territoryDef(id).name}.`, 'good');
    }
  }
  for (const id of before.controlled) {
    if (!now.controlled.includes(id)) {
      record(state, `Lost ${territoryDef(id).name}.`, 'bad');
    }
  }

  for (const id of now.fronts) {
    if (before.fronts.includes(id)) continue;
    const b = state.businesses[id];
    if (b) {
      record(
        state,
        `Bought ${BUSINESS_BY_ID[b.defId]?.name ?? 'a front'} in ${territoryDef(b.territoryId).name}.`,
        'good',
      );
    }
  }
  // Only businesses still named in `before` can be identified once gone —
  // `state.businesses[id]` itself may already be deleted by the time this
  // runs, which `possessions.ts` documents as deliberate elsewhere.
  const lostFronts = before.fronts.filter((id) => !now.fronts.includes(id));
  if (lostFronts.length > 0) {
    record(
      state,
      lostFronts.length === 1 ? 'Lost a front.' : `Lost ${lostFronts.length} fronts.`,
      'bad',
    );
  }

  for (const id of now.wars) {
    if (!before.wars.includes(id)) record(state, `War began with the ${houseShort(state, id)}.`, 'bad');
  }
  for (const id of before.wars) {
    if (!now.wars.includes(id)) record(state, `The war with the ${houseShort(state, id)} ended.`, 'neutral');
  }

  if (now.generation > before.generation) {
    record(state, `${state.player.name} took over the family.`, 'neutral');
  }

  for (const id of now.indicted) {
    if (before.indicted.includes(id)) continue;
    const investigation = state.law.investigations[id];
    if (investigation) record(state, `Indicted by ${agencyOf(investigation).shortName}.`, 'bad');
  }
}

/**
 * For the handful of chapters a snapshot diff genuinely cannot see.
 *
 * Kept as small as possible on purpose — `chronicle.ts`'s own header and this
 * file's argue for a derived read wherever one is possible, because a written
 * hook is a hook a future call site can skip, and this project has found that
 * exact defect four times in one season (see `chronicle.ts`). What is left
 * here earns the exception: a contract landing on a rival capo or boss moves
 * nothing in the player's own state a snapshot could diff — the target lives
 * in `state.factions[x].capos`, not `state.npcs` — and both call sites
 * (`contract.ts`'s `landCapo`/`landBoss`) are the same singular "this is
 * where it happens" functions that already write the day's `addLog` line, not
 * a new site invented for this.
 */
export function recordCareerEvent(state: GameState, text: string, tone: CareerTone): void {
  record(state, text, tone);
}
