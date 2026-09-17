/**
 * How much power a capo has actually built for himself, read as one line the
 * boss can act on.
 *
 * Phase 0 (`officers.ts`) gave the Underboss and Consigliere an opinion of
 * the people under them, biased by the officer doing the reading. This is a
 * different question — not what somebody else makes of a capo, but how big a
 * thing the capo has actually built: men who answer to him, ground he holds
 * outright, and a track record that makes people watch him instead of the
 * boss. `officers.ts`'s `underbossStanding` already reads a man's standing
 * this way for the seat above capo; this is the same idiom one rung down,
 * for whichever capo the caller asks about.
 *
 * Four signals, all of them already tracked somewhere else in the game:
 *
 *   - headcount   `Npc.reportsTo` — how many men actually route through him,
 *                 the identical count `officers.ts`'s `reportCount` takes.
 *   - leadership  `perceive(capo, 'leadership')` — whether people actually
 *                 listen, not just whether they are nominally under him.
 *                 Same stat, same familiarity gate, `underbossStanding` uses
 *                 for the identical reason.
 *   - ground      `delegation.ts`'s `districtsHeldBy` — a district he runs in
 *                 his own right. Stewardship is not exclusive to capos
 *                 (`DELEGATION.minRoleIndex` lets a soldier hold one too),
 *                 but when the man in question *is* a capo, ground of his own
 *                 is exactly the "runs a piece of the neighborhood himself"
 *                 fact the design brief is asking for.
 *   - volume      `Npc.opsCompleted`, summed across the capo and everyone who
 *                 reports to him. Successful jobs are the closest thing this
 *                 game tracks to a capo's own earning power, and it is the
 *                 one signal here that can turn a man who already reads as
 *                 powerful into one who reads as a threat: a crew pulling in
 *                 enough on its own is a crew that stops needing you.
 *
 * What this deliberately leaves out, and why: `Business` carries a
 * `territoryId` and nothing else — no owner, no manager — so there is no
 * existing tie from a business to a specific capo, and inventing one would be
 * new stored state a Phase 1 read should not be adding. `loyalty`, `fear` and
 * `respectForBoss` describe how a capo feels about the organization, not how
 * much of it he has built; folding them in would answer a different question
 * than the one the brief's own example lines ask — Carlo's and Paulie's lines
 * are entirely about scale and leverage, never sentiment. Boss favor and the
 * Underboss's opinion of him are already a direct read elsewhere
 * (`officers.ts`'s `underbossOpinion`, and the plain `Tie` panel); folding
 * them in here would just repeat a reading the player can already get rather
 * than add a distinct one.
 *
 * Gated behind the same familiarity line `underbossStanding` and
 * `perceivedLeadership` use — `GOAL_CERTAIN_ABOVE` — because a read this
 * candid about a man's power is not something the boss has on a stranger.
 *
 * No new stored state: every input here already exists on `Npc` or
 * `Territory`.
 */

import type { GameState, Id } from './types';
import { crewList, perceive } from './npc';
import { isRealCapo } from './capoPitches';
import { districtsHeldBy } from './delegation';
import { say } from './util';
import { clamp } from './rng';
import { GOAL_CERTAIN_ABOVE } from '../config/goals';

export interface CapoStanding {
  /** 0..3. Never shown — the text is the read; this is what tests check. */
  tier: number;
  text: string;
}

/**
 * Big enough a share of the active roster that it reads as most of the
 * neighborhood rather than merely more than nobody. Phase-1 placeholder — no
 * probe has sized it yet, and none exists (no caller puts this on screen); a
 * later pass can size it once one does, the same deferral `officers.ts`'s
 * `SEATED_TENURE_DAYS` made for the identical reason.
 */
const CAPO_BIG_CREW_SHARE = 0.35;

/**
 * Enough successful jobs moving through his chain that it reads as money, not
 * luck. Same Phase-1 placeholder status as `CAPO_BIG_CREW_SHARE`.
 */
const CAPO_EARNING_VOLUME = 12;

/** How many men, made or not, actually answer to this capo. */
function reportCount(state: GameState, capoId: Id): number {
  return crewList(state).filter((n) => n.reportsTo === capoId).length;
}

/** Successful jobs credited to the capo himself and everyone under him. */
function creditedVolume(state: GameState, capoId: Id): number {
  const capo = state.npcs[capoId];
  const reports = crewList(state).filter((n) => n.reportsTo === capoId);
  return reports.reduce((sum, n) => sum + n.opsCompleted, capo?.opsCompleted ?? 0);
}

const CAPO_STANDING_LINES: ((name: string, reports: number) => string[])[] = [
  (name) => [
    `Nobody really listens to ${name} unless you tell them to.`,
    `${name} has the title. That's as far as it goes.`,
  ],
  (name, reports) =>
    reports > 0
      ? [
          `${name}'s crew has been getting bigger lately. People are starting to look to him.`,
          `${name} is starting to draw a following — ${reports} of the crew answer to him now.`,
        ]
      : [
          `People are starting to look to ${name}, title or no title.`,
          `${name} is building something, even without much of a crew yet.`,
        ],
  (name, reports) => [
    `${name}'s got half the guys in the neighborhood coming through his door.`,
    `${name} runs a real piece of this family — ${reports} of the crew, and they listen.`,
  ],
  (name) => [
    `${name} is making enough money that people don't need to come to you anymore.`,
    `${name} doesn't need you the way he used to. He's making his own money now.`,
  ],
];

/**
 * A capo's organizational standing, read off headcount, whether people
 * actually listen, ground held in his own right, and how much money moves
 * through his chain — see this file's header for why these four and not the
 * rest of the design brief's list. `null` when there is no such capo, or
 * before the player knows him well enough to have a read at all.
 */
export function capoStanding(state: GameState, capoId: Id): CapoStanding | null {
  const capo = state.npcs[capoId];
  if (!capo) return null;
  if (!isRealCapo(capo)) return null;
  if (capo.familiarity < GOAL_CERTAIN_ABOVE) return null;

  const reports = reportCount(state, capo.id);
  const totalCrew = crewList(state).length;
  const share = totalCrew > 0 ? reports / totalCrew : 0;
  const leadership = perceive(capo, 'leadership');
  const hasGround = districtsHeldBy(state, capo.id).length > 0;
  const volume = creditedVolume(state, capo.id);

  // A following only counts once people actually listen — headcount alone,
  // read against poor perceived leadership, is the "holds the title and not
  // much more" case the brief's own weak example describes.
  let points = 0;
  if (reports > 0 && leadership.bandIndex >= 2) points += 1;
  if (share >= CAPO_BIG_CREW_SHARE) points += 1;
  if (hasGround) points += 1;
  if (volume >= CAPO_EARNING_VOLUME) points += 1;

  const tier = clamp(points, 0, CAPO_STANDING_LINES.length - 1);
  return {
    tier,
    text: say(`capoStanding:${capo.id}`, 0, CAPO_STANDING_LINES[tier](capo.name, reports)),
  };
}
