/**
 * What a real gap in two capos' organizational power does between them —
 * and, since an audit of the design brief's six capo-capo causes (Part 9),
 * what a real overlap in their ground does too.
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
 * **Territory** reuses the same weekly pass. `delegation.ts`'s
 * `districtsHeldBy` already says which one district (at most — "one each," a
 * man cannot be in two places) a capo stewards, and `territoryDef(id).adjacent`
 * already says which districts border which. Two capos whose ground borders
 * each other's is a fact the game already keeps, not a new one to invent —
 * unlike `lost_the_room`, neither man outranks the other here, so it lands on
 * both ties at once (`crowded_ground`, `mutual: true`, see `config/ties.ts`).
 * Checked only for pairs the power gap has not already claimed, so the same
 * edge is never written twice for two different reasons on the same day.
 *
 * **Personnel** — the design brief's "two capos who both have a claim on the
 * same associate" — turned out not to be a state this codebase can represent.
 * `Npc.reportsTo` is a single optional id: exactly one capo at a time, always
 * overwritten rather than contested (`crew.ts`, `delegation.ts`). There is no
 * "pending claim" or "contested associate" concept anywhere to read cheaply,
 * so closing this would mean inventing a bidding mechanism the brief never
 * asked for. Left undone; see the item's commit message for the finding.
 *
 * No new stored state, and no dice for either cause: a standing gap and a
 * shared border either exist or they do not, so this consumes nothing from
 * the causal stream. The only thing that needed inventing was how often to
 * look and how not to say the same thing every week — see
 * `config/capoTension.ts`.
 */

import type { GameState, Npc } from './types';
import { crewList } from './npc';
import { capoStanding } from './capoStanding';
import { recordTie } from './ties';
import type { TieCause } from '../config/ties';
import { CAPO_TENSION } from '../config/capoTension';
import { districtsHeldBy } from './delegation';
import { territoryDef } from './territory';

const POWER_CAUSE: TieCause = 'lost_the_room';
const TERRITORY_CAUSE: TieCause = 'crowded_ground';

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
 * Whether two capos' own ground shares a border. Each stewards at most one
 * district (`districtsHeldBy`'s own comment: "one each"), so this is one
 * lookup a side rather than a real search.
 */
function districtsAdjacent(state: GameState, aId: string, bId: string): boolean {
  const aHeld = districtsHeldBy(state, aId);
  const bHeld = districtsHeldBy(state, bId);
  if (aHeld.length === 0 || bHeld.length === 0) return false;
  return aHeld.some((da) => bHeld.some((db) => territoryDef(da.id).adjacent.includes(db.id)));
}

/**
 * Lands the fact on `from`'s tie to `to`, unless this exact pair already
 * registered this exact cause inside `CAPO_TENSION.cooldownDays` — read
 * straight off the tie's own `cause` and `since` rather than a second,
 * parallel piece of state, the same way `capoVouches.ts`'s cooldown reads
 * `vouchDeferredDay` instead of inventing a schedule next to it. For a mutual
 * cause (`crowded_ground`) `recordTie` itself mirrors the write onto `to`'s
 * side — this only ever has to check and write the one direction.
 */
function applyTension(state: GameState, from: Npc, to: Npc, cause: TieCause): void {
  const tie = from.ties.find((t) => t.id === to.id);
  if (tie && tie.cause === cause && state.day - tie.since < CAPO_TENSION.cooldownDays) {
    return;
  }
  recordTie(state.day, from, to, cause);
}

/**
 * Weekly pass over every pair of active capos. Power is checked first and,
 * where it already explains the pair, territory is not also checked for that
 * same pair this week — the point is one true cause landing on the tie, not
 * two mechanisms racing to overwrite each other's `cause` on the same edge.
 */
export function checkCapoPowerImbalance(state: GameState): void {
  if (state.day % CAPO_TENSION.checkIntervalDays !== 0) return;

  const capos = activeCapos(state);
  for (let i = 0; i < capos.length; i++) {
    for (let j = i + 1; j < capos.length; j++) {
      const a = capoStanding(state, capos[i].id);
      const b = capoStanding(state, capos[j].id);
      if (a && b && gapMatters(a.tier, b.tier)) {
        const [weaker, stronger] = a.tier < b.tier ? [capos[i], capos[j]] : [capos[j], capos[i]];
        applyTension(state, weaker, stronger, POWER_CAUSE);
        continue;
      }
      if (districtsAdjacent(state, capos[i].id, capos[j].id)) {
        applyTension(state, capos[i], capos[j], TERRITORY_CAUSE);
      }
    }
  }
}
