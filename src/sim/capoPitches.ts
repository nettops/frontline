/**
 * Work a capo brings you, instead of a menu you browse yourself.
 *
 * The design lives in `config/capoPitches.ts`. This is the machine: it keeps
 * a short live list topped up on a weekly cadence, and it answers the three
 * things a boss can do with a pitch — approve it, turn it down, or hand it to
 * somebody else.
 *
 * Approving never resolves anything itself. It hands the job to the same
 * assemble screen a hand-picked job always used — `resolveOperation` and
 * `canLaunch` are untouched — because the thing that changed is what is on
 * the board and whose idea it was, not how a job actually runs.
 *
 * Whose idea it is: a real capo (`ROLE_ORDER` at `capo` or above) if the
 * organization has one, and the most senior people available otherwise. That
 * second case is a placeholder rather than `reportsTo` on purpose —
 * `reportsTo` is brand new and most careers will not have built a reporting
 * hierarchy the week this lands, and a pitch system that only works after a
 * hierarchy exists would sit dark for most of a career. Phase 3's dispatch
 * reads `reportsTo` where it exists; attribution here does not need to.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, CapoPitch, Npc } from './types';
import type { Check } from './delegation';
import { CAPO_PITCH } from '../config/capoPitches';
import { DELEGATION } from '../config/delegation';
import { ROLE_ORDER } from '../config/economy';
import { OPERATION_BY_ID } from '../config/operations';
import { availableOperations, STREET_WORK_IDS } from './operations';
import { operableTerritories, territoryDef } from './territory';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { addLog, nextId } from './util';

function list(state: GameState): CapoPitch[] {
  if (!state.capoPitches) state.capoPitches = [];
  return state.capoPitches;
}

/** What is actually waiting on an answer. */
export function livePitches(state: GameState): CapoPitch[] {
  return list(state).filter((p) => p.status === 'open');
}

/**
 * Who a pitch can be attributed to, or reassigned toward.
 *
 * Real capos first; the whole active roster, senior first, if there are none
 * yet. See this file's header for why the fallback exists at all.
 */
export function pitchCapoPool(state: GameState): Npc[] {
  const crew = crewList(state).filter((n) => n.status === 'active' || n.status === 'busy');
  const real = crew.filter((n) => ROLE_ORDER.indexOf(n.role) >= ROLE_ORDER.indexOf('capo'));
  const pool = real.length > 0 ? real : crew;
  return [...pool].sort((a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role));
}

/** Tier 1 and above, open to the player, and never the jobs a boss runs himself. */
function pitchableOperations(state: GameState) {
  return availableOperations(state).filter(
    (op) => op.tier > 0 && !STREET_WORK_IDS.has(op.id),
  );
}

/**
 * Tops the board back up to `CAPO_PITCH.count`, once a week, and ages out
 * anything that has sat unanswered too long.
 *
 * Expiry runs every day rather than only on the refresh day — a pitch's own
 * clock started the day it was offered, not the day the board next turns
 * over, the same way `Score.dueDay` does not wait for a tick to matter.
 */
export function tickCapoPitches(state: GameState, rng: Rng): void {
  const pitches = list(state);
  for (const p of pitches) {
    if (p.status === 'open' && state.day - p.offeredDay >= CAPO_PITCH.windowDays) {
      p.status = 'expired';
      p.settledDay = state.day;
    }
  }

  if (state.day % CAPO_PITCH.refreshIntervalDays !== 0) return;

  const need = CAPO_PITCH.count - pitches.filter((p) => p.status === 'open').length;
  if (need <= 0) return;

  const districts = operableTerritories(state);
  const capos = pitchCapoPool(state);
  if (districts.length === 0 || capos.length === 0) return;

  const openIds = new Set(pitches.filter((p) => p.status === 'open').map((p) => p.defId));
  const ops = pitchableOperations(state);
  if (ops.length === 0) return;
  const fresh = ops.filter((op) => !openIds.has(op.id));
  const chosen = rng.sample(fresh.length > 0 ? fresh : ops, need);

  for (const op of chosen) {
    pitches.push({
      id: nextId(state, 'pitch'),
      defId: op.id,
      territoryId: rng.pick(districts).territory.id,
      capoId: rng.pick(capos).id,
      offeredDay: state.day,
      status: 'open',
    });
  }
}

/** Funds and launches nothing itself — see this file's header. */
export function approvePitch(state: GameState, pitchId: Id): CapoPitch | null {
  const p = list(state).find((x) => x.id === pitchId && x.status === 'open');
  if (!p) return null;
  p.status = 'approved';
  p.settledDay = state.day;
  return p;
}

/** Clears for nothing. No cost to reading a pitch and passing on it. */
export function rejectPitch(state: GameState, pitchId: Id): void {
  const p = list(state).find((x) => x.id === pitchId && x.status === 'open');
  if (!p) return;
  p.status = 'rejected';
  p.settledDay = state.day;
}

/**
 * Hands the pitch to somebody else. Costs the man it was taken from the same
 * way taking a district back off a steward does — `delegation.ts`'s own
 * `recallLoyalty`/`recallGrievance`, not a new number, because a man watching
 * a job go to somebody else is the same snub the game already prices.
 */
export function reassignPitch(state: GameState, pitchId: Id, newCapoId: Id): Check {
  const p = list(state).find((x) => x.id === pitchId && x.status === 'open');
  if (!p) return { ok: false, message: 'That pitch is not open any more.' };
  const newCapo = state.npcs[newCapoId];
  if (!newCapo) return { ok: false, message: 'No such person.' };
  if (p.capoId === newCapoId) return { ok: false, message: `It is already ${newCapo.name}'s.` };

  const passedOver = state.npcs[p.capoId];
  if (passedOver) {
    passedOver.stats.loyalty = clamp(
      passedOver.stats.loyalty + DELEGATION.recallLoyalty,
      0,
      100,
    );
    passedOver.stats.grievance = clamp(
      passedOver.stats.grievance + DELEGATION.recallGrievance,
      0,
      100,
    );
    remember(passedOver, state.day, 'passed_over');
    addNote(
      passedOver,
      state.day,
      `Watched ${newCapo.name} get the ${OPERATION_BY_ID[p.defId]?.name ?? 'job'} instead.`,
      'bad',
    );
  }

  p.capoId = newCapoId;
  addLog(
    state,
    `${newCapo.name} takes the ${OPERATION_BY_ID[p.defId]?.name ?? 'pitch'} in ${
      territoryDef(p.territoryId).name
    } instead.`,
    'crew',
  );
  return { ok: true, message: '' };
}
