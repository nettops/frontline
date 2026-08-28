/**
 * What a boss is made of, and what that lets him do.
 *
 * See `config/build.ts` for what this replaces and why. In short: eight
 * attributes that improved by use, two of which were read by nothing at all,
 * and none of which was ever a decision.
 *
 * A leaf module. It reads the player and derives everything; nothing here
 * reaches into another system, and every consumer asks it a question rather
 * than being handed a number. That is deliberate — seven stats wired outward
 * would be seven new couplings, and the whole point is that a stat *gates* a
 * thing the game already knows how to do.
 */

import type { GameState } from './types';
import { statBonus } from './nicknames';
import {
  BUILD,
  STAT_BY_ID,
  STAT_IDS,
  VERB_AT,
  WORLD_AT,
  worldShare,
  type Build,
  type StatId,
} from '../config/build';

export interface Check {
  ok: boolean;
  reason: string | null;
}

/**
 * The build, with a lazy floor.
 *
 * Optional on `Player` and absent on every save written before this existed,
 * which is the idiom the nine other optional fields on this state use. A save
 * from before loads as somebody who put nothing anywhere and still has the
 * pool to place — which is the correct reading of a career that never had a
 * build screen.
 */
export function buildOf(state: GameState): Build {
  const stored = state.player.build;
  const out = {} as Build;
  for (const id of STAT_IDS) out[id] = stored?.[id] ?? BUILD.min;
  return out;
}

export function statLevel(state: GameState, id: StatId): number {
  /*
     Placed points plus whatever the street gave you.

     A nickname counts toward the verb, and that is the whole reason a name is
     worth having rather than being a line of flavour on a screen — see
     `config/nicknames.ts`. Added here rather than written into `build` so
     losing the name cannot leave a phantom point in a saved allocation.

     The cap is applied last, so a reward cannot break the one ceiling every
     other rule in this file respects.
  */
  const placed = state.player.build?.[id] ?? BUILD.min;
  return Math.min(BUILD.max, placed + statBonus(state, id));
}

/** Points in hand. Absent on an old save means the whole opening pool. */
export function pointsLeft(state: GameState): number {
  return state.player.points ?? BUILD.startingPoints;
}

export function canSpendPoint(state: GameState, id: StatId): Check {
  if (pointsLeft(state) <= 0) {
    return { ok: false, reason: 'No points to place. The next tier of work pays more.' };
  }
  if (statLevel(state, id) >= BUILD.max) {
    /*
       Names the figure, because `refusals.test.ts` is right to insist.

       "That is as far as it goes" is the shape of refusal that cost this
       project two blind rounds — a player told no, with no number to work
       against, cannot tell a rule from a bug.
    */
    return {
      ok: false,
      reason: `${STAT_BY_ID[id].label} is at ${BUILD.max}, which is as high as anything goes.`,
    };
  }
  return { ok: true, reason: null };
}

export function spendPoint(state: GameState, id: StatId): Check {
  const guard = canSpendPoint(state, id);
  if (!guard.ok) return guard;

  const build = buildOf(state);
  build[id] += 1;
  state.player.build = build;
  state.player.points = pointsLeft(state) - 1;
  return { ok: true, reason: null };
}

/** What climbing pays. Called when the family opens a tier of work it had not. */
export function awardPoints(state: GameState, howMany: number = BUILD.pointsPerTier): void {
  state.player.points = pointsLeft(state) + howMany;
}

/**
 * Daily. Opening a tier of work you could not reach before pays points.
 *
 * The job table is the progression this game actually has, now that the rank
 * ladder is gone — so it is what a build grows against. `bestOps` in the probe
 * says a career opens three or four tiers, which is another six to eight
 * points: enough to finish a build, not enough to have every verb.
 *
 * Counted rather than event-driven, so a save written before any of this
 * existed catches up on its first morning instead of never paying at all.
 */
export function tickPoints(state: GameState, tiersOpenNow: number): void {
  const seen = state.player.tiersSeen ?? 0;
  if (tiersOpenNow <= seen) return;
  state.player.tiersSeen = tiersOpenNow;
  // Nothing is owed for the tier the game starts you on.
  if (seen === 0) return;
  awardPoints(state, (tiersOpenNow - seen) * BUILD.pointsPerTier);
}

/**
 * Whether the verb is open.
 *
 * A threshold and not a slope, which is the whole difference between a build
 * and a set of multipliers. At the number you can do the thing; one below it
 * you cannot, and nothing except points crosses that line — not playing well,
 * not playing long, not getting lucky.
 */
export function hasVerb(state: GameState, id: StatId): boolean {
  return statLevel(state, id) >= VERB_AT[id];
}

/**
 * How much the world has started behaving differently, 0..1.
 *
 * On before the verb is, so a stat with four points in it does something. A
 * build where every point below a threshold is dead weight is not a
 * distribution, it is a checklist of seven thresholds.
 */
export function worldPull(state: GameState, id: StatId): number {
  return worldShare(statLevel(state, id));
}

/** Everything the boss can do that another boss could not. */
export function verbsOpen(state: GameState): StatId[] {
  return STAT_IDS.filter((id) => hasVerb(state, id));
}

/** For the screen: what is placed, what is left, what it has opened. */
export function buildRead(state: GameState) {
  return STAT_IDS.map((id) => ({
    id,
    level: statLevel(state, id),
    verb: hasVerb(state, id),
    /** How far off the verb is, so the screen can say what a point would buy. */
    toVerb: Math.max(0, VERB_AT[id] - statLevel(state, id)),
    world: worldPull(state, id),
    noticed: statLevel(state, id) >= WORLD_AT,
  }));
}
