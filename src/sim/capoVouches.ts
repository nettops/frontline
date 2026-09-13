/**
 * A capo putting his own name behind one of his associates.
 *
 * Readiness is a pure derived read — no stored "vouch-ready" flag — off three
 * signals that already exist: how long the man has been in the crew, how much
 * the capo's own tie to him trusts him, and the man's own loyalty. `Make`
 * reuses `promote` outright rather than duplicating its side effects; `Deny`
 * prices the snub the identical way `capoPitches.ts`'s `reassignPitch` already
 * prices watching a job go to somebody else. `Wait` and `Deny` share the one
 * bit of state this needs: the last day this recommendation was set aside, so
 * neither nags the player again before `CAPO_VOUCH.cooldownDays` has passed.
 */

import type { GameState, Id, Npc } from './types';
import { crewList, addNote } from './npc';
import { isRealCapo } from './capoPitches';
import { promote, canPromote, type ActionResult } from './crew';
import { recordTie } from './ties';
import { remember } from './memory';
import { addLog } from './util';
import { TIE_DEPARTURE } from '../config/ties';
import { BEHAVIOUR, DRIFT } from '../config/npcs';
import { CAPO_VOUCH } from '../config/capoVouches';

/** Whether this capo would put his name behind this associate, today. */
export function isVouchReady(state: GameState, capo: Npc, associate: Npc): boolean {
  if (associate.role !== 'associate') return false;
  if (associate.status !== 'active') return false;
  if (associate.reportsTo !== capo.id) return false;
  // Only a real capo has anything to lose by vouching — the seniority
  // fallback `pitchCapoPool` stands in with when there is no real capo yet
  // is not a person the game can charge for being wrong.
  if (!isRealCapo(capo)) return false;
  if (state.day - associate.joinedDay < DRIFT.daysInRoleBeforeStagnation) return false;
  // Reused from the same threshold that gates a demand-a-raise event — a
  // capo does not stick his neck out for a man on the edge of walking.
  if (associate.stats.loyalty < BEHAVIOUR.demandLoyaltyBelow) return false;
  const tie = capo.ties.find((t) => t.id === associate.id);
  if (!tie || tie.trust < TIE_DEPARTURE.followTrustAbove) return false;
  return true;
}

/** Everybody a capo is currently prepared to vouch for, cooldown already applied. */
export function vouchCandidates(state: GameState): { capo: Npc; associate: Npc }[] {
  const out: { capo: Npc; associate: Npc }[] = [];
  for (const associate of crewList(state)) {
    if (!associate.reportsTo) continue;
    const capo = state.npcs[associate.reportsTo];
    if (!capo) continue;
    if (!isVouchReady(state, capo, associate)) continue;
    if (
      associate.vouchDeferredDay != null &&
      state.day - associate.vouchDeferredDay < CAPO_VOUCH.cooldownDays
    ) {
      continue;
    }
    out.push({ capo, associate });
  }
  return out;
}

/** Make: the vouch succeeds. Nothing here but `promote` — no second copy of its effects. */
export function canMakeVouch(state: GameState, associateId: Id): ActionResult {
  const npc = state.npcs[associateId];
  if (!npc) return { ok: false, message: 'No such person.' };
  return canPromote(state, npc);
}

export function makeVouch(state: GameState, associateId: Id): ActionResult {
  const check = canMakeVouch(state, associateId);
  if (!check.ok) return check;
  return promote(state, associateId);
}

/** Wait: set aside for now. No cost, no state beyond the shared cooldown. */
export function waitOnVouch(state: GameState, associateId: Id): ActionResult {
  const npc = state.npcs[associateId];
  if (!npc) return { ok: false, message: 'No such person.' };
  npc.vouchDeferredDay = state.day;
  return { ok: true, message: `Left for now. ${npc.name} will come up again.` };
}

/**
 * Deny: the vouch is refused. The associate stays where he is; the capo who
 * put his name behind him is the one who pays for it — the exact tie cost and
 * memory `reassignPitch` already charges a capo passed over for a pitch,
 * because a boss overruling a capo's word is the identical snub.
 */
export function denyVouch(state: GameState, associateId: Id): ActionResult {
  const associate = state.npcs[associateId];
  if (!associate) return { ok: false, message: 'No such person.' };
  const capo = associate.reportsTo ? state.npcs[associate.reportsTo] : undefined;
  if (!capo) return { ok: false, message: 'Nobody vouched for them.' };

  associate.vouchDeferredDay = state.day;
  recordTie(state.day, capo, associate, 'passed_over');
  remember(capo, state.day, 'passed_over', associate.id);
  addNote(capo, state.day, `Was turned down for putting ${associate.name} up.`, 'bad');
  addLog(
    state,
    `You pass on ${capo.name}'s word for ${associate.name}. ${capo.name} will remember it.`,
    'crew',
  );
  return { ok: true, message: `${associate.name} stays where they are.` };
}
