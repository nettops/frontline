/**
 * What people want, and what wanting it does to them.
 *
 * A leaf module by construction: it reads npcs, heat and cases off the state
 * object directly rather than importing the systems that own them, because
 * drift, events, poaching and succession all read *this* and any of them
 * importing back would make a cycle. The player-facing read of a goal
 * therefore lives in npc.ts alongside `perceive`, not here.
 */

import { Rng, clamp } from './rng';
import type { GameState, GoalBoard, GoalSubject, Npc } from './types';
import { GOALS, GOAL_BY_ID, GOAL_MIN_DAYS, type GoalEffects } from '../config/goals';
import { ROLE_ORDER } from '../config/economy';
import { stageIndex } from '../config/lawEnforcement';
import { RIVAL_IDS } from '../config/factions';

/** Lieutenant and up: somebody with a floor to look down from. */
const SENIOR_FROM = ROLE_ORDER.indexOf('lieutenant');

function subjectOf(npc: Npc): GoalSubject {
  return {
    loyalty: npc.stats.loyalty,
    greed: npc.stats.greed,
    ambition: npc.stats.ambition,
    fear: npc.stats.fear,
    courage: npc.stats.courage,
    leadership: npc.stats.leadership,
    grievance: npc.stats.grievance,
    age: npc.age,
    senior: ROLE_ORDER.indexOf(npc.role) >= SENIOR_FROM,
    familyMan: npc.traits.includes('family_man'),
    worstTieResentment: npc.ties.reduce((worst, t) => Math.max(worst, t.resentment), 0),
  };
}

/**
 * The organization as the crew experiences it.
 *
 * Computed once per drift tick rather than per person — with forty people this
 * was scanning every investigation forty times, which is the kind of thing
 * that is free until the day it is not.
 */
export function goalBoard(state: GameState): GoalBoard {
  let worstCaseStage = 0;
  for (const c of Object.values(state.law.investigations)) {
    if (c.status !== 'open' && c.status !== 'cold') continue;
    worstCaseStage = Math.max(worstCaseStage, stageIndex(c.stage));
  }
  let crewSize = 0;
  for (const npc of Object.values(state.npcs)) {
    if (npc.status === 'dead' || npc.status === 'defected' || npc.status === 'boss') continue;
    crewSize += 1;
  }
  return {
    heat: state.org.heat,
    worstCaseStage,
    crewSize,
    // Read inline rather than through diplomacy.ts, which reads this file.
    atWar: RIVAL_IDS.some((id) => state.factions[id]?.bonds.player?.warSince != null),
  };
}

/**
 * Picks or re-picks what somebody is after.
 *
 * Held for at least GOAL_MIN_DAYS. Without that floor a man whose stats sit
 * near a threshold flips goals every week and reads as having no character —
 * the same failure a flat random table has, arrived at from the other side.
 */
export function reviewGoal(state: GameState, rng: Rng, npc: Npc, board: GoalBoard): void {
  if (npc.goal && state.day - npc.goalSince < GOAL_MIN_DAYS) return;

  const subject = subjectOf(npc);
  const candidates = GOALS.filter((g) => g.applies(subject, board));
  if (candidates.length === 0) {
    // Nothing in the catalogue fits, which is itself a state: he is here, he
    // is fine, and he is not reaching for anything.
    npc.goal = null;
    npc.goalSince = state.day;
    return;
  }

  const total = candidates.reduce((sum, g) => sum + g.weight, 0);
  let target = rng.next() * total;
  let chosen = candidates[candidates.length - 1];
  for (const g of candidates) {
    target -= g.weight;
    if (target <= 0) {
      chosen = g;
      break;
    }
  }

  if (chosen.id === npc.goal) {
    npc.goalSince = state.day;
    return;
  }

  const previous = npc.goal;
  npc.goal = chosen.id;
  npc.goalSince = state.day;

  /*
   * A change of heart is written into the record rather than announced.
   *
   * The player is never told what somebody wants — finding out is the whole
   * mechanic — but a note dated the week it changed is the kind of thing you
   * can go back and read after he has done something, which is how this game
   * prefers to hand over information.
   */
  if (previous) {
    npc.notes.unshift({
      day: state.day,
      text: 'Something about them has changed lately.',
      kind: 'neutral',
    });
    if (npc.notes.length > 40) npc.notes.length = 40;
  }
}

/** Summed or multiplied effect of somebody's goal. Missing goal is neutral. */
export function goalEffect(npc: Npc, key: keyof GoalEffects): number {
  const multiplier = key === 'poachable' || key === 'claim' || key === 'exposure';
  const def = npc.goal ? GOAL_BY_ID[npc.goal] : null;
  const value = def?.effects[key];
  if (value === undefined) return multiplier ? 1 : 0;
  return value;
}

/** Weekly ambition creep from whatever they are chasing. */
export function applyGoalDrift(npc: Npc): void {
  const ambition = goalEffect(npc, 'ambitionPerWeek');
  if (ambition !== 0) {
    npc.stats.ambition = clamp(npc.stats.ambition + ambition, 0, 100);
  }
}
