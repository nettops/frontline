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
import { ROLE_ORDER } from '../config/economy';

const POWER_CAUSE: TieCause = 'lost_the_room';
const TERRITORY_CAUSE: TieCause = 'crowded_ground';
const GENERATION_CAUSE: TieCause = 'generational_clash';

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

// ------------------------------------------------------------ generations ---

/*
   The third cause, and the first one that is about the men rather than about
   what they have built.

   Power and territory are both facts about position — who has more, whose
   ground touches whose. This one is a fact about era: a man who learned this
   business when it was done in person, and a man who learned it when it was
   done with a laptop and a merchant account, disagree about the only thing
   they both actually care about, which is what gets everybody arrested. Each
   thinks the other is the liability and each is partly right.

   Same weekly pass, same cooldown, same `recordTie` door. No dice: a man's
   age, role and traits either put him on one side of this or they do not.
*/

/**
 * A man from before. The trait is the explicit route in; age and rank are the
 * implicit one, because an institution does not have to describe itself.
 *
 * Exported because `dementia.ts` reads the identical question of the
 * identical roster when a hit on a failing capo goes round the room.
 */
export function isRelic(npc: Npc): boolean {
  if (npc.traits.includes('old_school')) return true;
  return (
    npc.age >= CAPO_TENSION.relicAge &&
    ROLE_ORDER.indexOf(npc.role) >= ROLE_ORDER.indexOf('capo')
  );
}

/**
 * A man from after. The trait, or the disposition that would have earned him
 * the trait had the roll gone that way — young, hungry, and not careful.
 */
export function isTracksuit(npc: Npc): boolean {
  if (npc.traits.includes('tracksuit')) return true;
  return (
    npc.age < CAPO_TENSION.tracksuitAge &&
    npc.stats.greed >= CAPO_TENSION.tracksuitGreedAbove &&
    npc.stats.discipline < CAPO_TENSION.tracksuitDisciplineBelow
  );
}

/**
 * Whether power or ground has already spoken for this edge and is still
 * inside its cooldown. Checked in both directions: the power cause lands on
 * the weaker man only, so a pair can be explained by a tie this loop happens
 * to be holding the wrong end of.
 */
function alreadyExplained(state: GameState, a: Npc, b: Npc): boolean {
  const live = (from: Npc, toId: string): boolean => {
    const tie = from.ties.find((t) => t.id === toId);
    if (!tie) return false;
    if (tie.cause !== POWER_CAUSE && tie.cause !== TERRITORY_CAUSE) return false;
    return state.day - tie.since < CAPO_TENSION.cooldownDays;
  };
  return live(a, b.id) || live(b, a.id);
}

/** Opposite sides of it, whichever way round the pair happens to come. */
function acrossTheLine(a: Npc, b: Npc): boolean {
  return (isRelic(a) && isTracksuit(b)) || (isTracksuit(a) && isRelic(b));
}

/**
 * Weekly. Every capo against every other capo, and every capo against the men
 * who actually answer to him.
 *
 * Subordinates are included because that is where this is felt: two capos who
 * disagree about the era see each other at sit-downs, and a capo who has to
 * work with a man he thinks is going to get them all indicted sees him every
 * day. `reportsTo` is the chain the roster already keeps — no new state and
 * no search, one pass over the crew per capo.
 *
 * `generational_clash` is mutual, so `recordTie` mirrors the write itself and
 * this only ever has to record the one direction.
 *
 * Position outranks era on the same edge. `checkCapoPowerImbalance`'s own
 * header states the rule this has to keep — one true cause landing on a tie,
 * not two mechanisms racing to overwrite each other's `cause` — and a pair
 * that a standing gap or a shared border has already claimed inside the
 * cooldown is left exactly as it was found. It is the same relationship
 * either way; what differs is only which fact the crew sheet names, and the
 * one it names should be the concrete one.
 */
export function checkGenerationalFracture(state: GameState): void {
  if (state.day % CAPO_TENSION.checkIntervalDays !== 0) return;

  const capos = activeCapos(state);
  for (let i = 0; i < capos.length; i++) {
    for (let j = i + 1; j < capos.length; j++) {
      if (!acrossTheLine(capos[i], capos[j])) continue;
      if (alreadyExplained(state, capos[i], capos[j])) continue;
      applyTension(state, capos[i], capos[j], GENERATION_CAUSE);
    }
  }

  for (const capo of capos) {
    for (const npc of crewList(state)) {
      if (npc.reportsTo !== capo.id) continue;
      if (npc.status !== 'active' && npc.status !== 'busy') continue;
      if (!acrossTheLine(capo, npc)) continue;
      applyTension(state, capo, npc, GENERATION_CAUSE);
    }
  }
}
