/**
 * City conditions — the world having its own month.
 *
 * The important property of this file is what it does *not* import. Every
 * other system reads `worldMod()`, so world.ts has to sit below all of them:
 * it touches state directly and imports only leaf config, never another sim
 * module that could import back. That is why the board summary below reads
 * `state.law.investigations` rather than calling `activeCases()`.
 */

import { Rng } from './rng';
import type { GameState } from './types';
import { addLog, pushEvent, weightedPick } from './util';
import { crewList } from './npc';
import { controlledTerritories } from './territory';
import {
  BLEEDING_BELOW,
  CONDITION_CHANCE_PER_DAY,
  CONDITION_GAP_DAYS,
  WORLD_CONDITIONS,
  WORLD_CONDITION_BY_ID,
  type WorldBoard,
  type WorldEffectKey,
} from '../config/world';
import { stageIndex } from '../config/lawEnforcement';
import { ALL_FACTIONS, RIVAL_IDS } from '../config/factions';

// ------------------------------------------------------------- accessors ---

export function activeCondition(state: GameState) {
  const id = state.world?.conditionId;
  return id ? (WORLD_CONDITION_BY_ID[id] ?? null) : null;
}

/**
 * The multiplier the current condition applies to `key`, or 1.
 *
 * Every read site in the simulation goes through this one function, which is
 * what lets a new condition be one config entry rather than a change to four
 * systems.
 */
export function worldMod(state: GameState, key: WorldEffectKey): number {
  return activeCondition(state)?.effects[key] ?? 1;
}

/** Success is additive, not multiplicative — so it gets its own reader. */
export function worldSuccessDelta(state: GameState): number {
  return activeCondition(state)?.effects.successDelta ?? 0;
}

export function conditionDaysLeft(state: GameState): number {
  return Math.max(0, (state.world?.endsDay ?? 0) - state.day);
}

// ----------------------------------------------------------------- board ---

/** The small set of facts a condition is allowed to be caused by. */
function readBoard(state: GameState): WorldBoard {
  const cases = Object.values(state.law.investigations).filter(
    (c) => c.status === 'open' || c.status === 'cold',
  );

  // Read inline rather than through diplomacy.ts — this module deliberately
  // sits below every system that reads `worldMod`, including that one.
  const warInCity = ALL_FACTIONS.some((a) =>
    ALL_FACTIONS.some(
      (b) => a !== b && a !== 'player' && state.factions[a]?.bonds[b]?.warSince != null,
    ),
  );

  const bleedingRival = RIVAL_IDS.some((id) => {
    const faction = state.factions[id];
    // A flat threshold rather than a share of the archetype's founding figure.
    // Which house sits in a slot is drawn per seed now, so the config number is
    // no longer this family's starting strength — and "visibly on the floor" is
    // a better description of the condition anyway.
    return faction && faction.strength < BLEEDING_BELOW;
  });

  return {
    day: state.day,
    heat: state.org.heat,
    openCases: cases.length,
    worstCaseStage: cases.reduce((worst, c) => Math.max(worst, stageIndex(c.stage)), 0),
    crewSize: crewList(state).length,
    districtsHeld: controlledTerritories(state).length,
    businesses: Object.values(state.businesses).filter((b) => b.status === 'operating').length,
    warInCity,
    bleedingRival,
    weeklyLaundered: state.lastLaunderReport?.laundered ?? 0,
  };
}

// ------------------------------------------------------------------ tick ---

/**
 * Daily. Ends a condition that has run its course, and occasionally starts a
 * new one — but only one at a time, and never straight after the last.
 */
export function tickWorld(state: GameState, rng: Rng): void {
  const world = state.world;

  if (world.conditionId) {
    if (state.day < world.endsDay) return;
    const ended = WORLD_CONDITION_BY_ID[world.conditionId];
    world.conditionId = null;
    world.lastEndedDay = state.day;
    state.flags[`world_${ended.id}`] = state.day;
    addLog(state, `${ended.name}: over. The city goes back to normal.`, 'neutral');
    return;
  }

  if (state.day - world.lastEndedDay < CONDITION_GAP_DAYS) return;
  if (!rng.chance(CONDITION_CHANCE_PER_DAY)) return;

  const board = readBoard(state);
  const candidates = WORLD_CONDITIONS.filter((def) => {
    const last = state.flags[`world_${def.id}`] ?? -9999;
    if (state.day - last < def.cooldownDays) return false;
    return def.requires ? def.requires(board) : true;
  });
  if (candidates.length === 0) return;

  const chosen = weightedPick(candidates, rng.next());
  world.conditionId = chosen.id;
  world.startedDay = state.day;
  world.endsDay = state.day + rng.int(chosen.durationDays[0], chosen.durationDays[1]);

  /*
   * The city gets its weather whoever is watching, but only a player gets
   * handed the memo about it.
   *
   * This is the one place a system above the Simulation gate in the pipeline
   * still reaches for the player, and it does not fail quietly: a memo nobody
   * can answer blocks the clock permanently, because every step checks the
   * queue before it moves. Caught by running eight years in Simulation and
   * finding all eight of them were day 99.
   */
  if (state.mode !== 'simulation') {
    pushEvent(state, {
      defId: 'world_condition',
      title: chosen.name,
      body: chosen.body,
      severity:
        chosen.tone === 'bad' ? 'warning' : chosen.tone === 'good' ? 'opportunity' : 'info',
      npcId: null,
      data: { conditionId: chosen.id },
      choices: [
        { id: 'acknowledge', label: 'Note it', hint: 'Nothing to decide. Only to work around' },
      ],
    });
  }
  addLog(state, `${chosen.name}. ${chosen.summary}`, chosen.tone === 'bad' ? 'heat' : 'neutral');
}
