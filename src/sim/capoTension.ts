/**
 * What a real gap in two capos' organizational power does between them.
 *
 * `capoStanding.ts` (Phase 1) already reads how big a thing each capo has
 * actually built — men who answer to him, ground of his own, a chain earning
 * on its own — into a single 0..3 tier. This is the same read turned into a
 * comparison: when two capos' tiers are far enough apart that the gap is a
 * fact rather than ordinary variation, it lands on the weaker man's own tie
 * to the stronger one, the way `capoVouches.ts`'s `denyVouch` lands a real
 * decision onto a tie rather than inventing a second place to keep score.
 * Never the reverse — a man does not resent somebody beneath him.
 *
 * This is the design brief's item on crew size carrying political weight: it
 * establishes that the gap is recorded as a real relationship change. Whether
 * anything reacts to that resentment — whether the weaker capo does something
 * about it, whether it makes him easier to peel away — is a later phase's
 * question; this one only has to make the fact durable and readable off the
 * same `ties.ts` sheet everything else already writes to.
 *
 * Reuses `lost_the_room` rather than inventing a cause: `TIE_CAUSE_TEXT`
 * already reads it as "lost the room to them", which is exactly what a real
 * standing gap between two capos is, and `TIE_EVENTS`'s numbers for it
 * (resentment 30, trust -18) are already sized for "lost real standing to a
 * specific person" — the closest existing analog to this, closer than
 * `passed_over`'s single-decision framing.
 *
 * No new stored state, and no dice: a standing gap either exists or it does
 * not, so this consumes nothing from the causal stream. The only thing that
 * needed inventing was how often to look and how not to say the same thing
 * every week — see `config/capoTension.ts`.
 */

import type { GameState, Npc } from './types';
import { crewList } from './npc';
import { capoStanding } from './capoStanding';
import { recordTie } from './ties';
import { CAPO_TENSION } from '../config/capoTension';

const TENSION_CAUSE = 'lost_the_room';

/**
 * Capos proper — not the underboss or consigliere above them, and not a
 * stand-in. Exported for `capoFavoritism.ts`, which asks the identical
 * "which capos count" question of the identical roster.
 */
export function activeCapos(state: GameState): Npc[] {
  return crewList(state).filter(
    (n) => n.role === 'capo' && (n.status === 'active' || n.status === 'busy'),
  );
}

/** Whether two standings are far enough apart to be a fact rather than noise. */
function gapMatters(tierA: number, tierB: number): boolean {
  return Math.abs(tierA - tierB) >= CAPO_TENSION.gapTiers;
}

/**
 * Lands the gap on the weaker capo's tie to the stronger one, unless this
 * exact pair already registered it inside `CAPO_TENSION.cooldownDays` — read
 * straight off the tie's own `cause` and `since` rather than a second, parallel
 * piece of state, the same way `capoVouches.ts`'s cooldown reads
 * `vouchDeferredDay` instead of inventing a schedule next to it.
 */
function applyGap(state: GameState, weaker: Npc, stronger: Npc): void {
  const tie = weaker.ties.find((t) => t.id === stronger.id);
  if (tie && tie.cause === TENSION_CAUSE && state.day - tie.since < CAPO_TENSION.cooldownDays) {
    return;
  }
  recordTie(state.day, weaker, stronger, TENSION_CAUSE);
}

/**
 * Weekly pass over every pair of active capos: where one has genuinely
 * outgrown the other by `capoStanding`'s own read, records that gap onto the
 * weaker man's tie. Not yet wired into `clock.ts` — see the phase report.
 */
export function checkCapoPowerImbalance(state: GameState): void {
  if (state.day % CAPO_TENSION.checkIntervalDays !== 0) return;

  const capos = activeCapos(state);
  for (let i = 0; i < capos.length; i++) {
    for (let j = i + 1; j < capos.length; j++) {
      const a = capoStanding(state, capos[i].id);
      const b = capoStanding(state, capos[j].id);
      if (!a || !b || !gapMatters(a.tier, b.tier)) continue;
      const [weaker, stronger] = a.tier < b.tier ? [capos[i], capos[j]] : [capos[j], capos[i]];
      applyGap(state, weaker, stronger);
    }
  }
}
