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
 *
 * A real capo also has a trade — see `capoSpecialty` — so Paulie brings
 * construction and Ralph brings bookmaking rather than the board reading like
 * one man wearing three different names. It is read off him, never stored,
 * and it never costs a capo a pitch: his own category is preferred only when
 * it is actually on the board this week, and the seniority fallback above is
 * never given one at all, because there is no capo yet for it to belong to.
 */

import { Rng, clamp } from './rng';
import type { GameState, Id, CapoPitch, Npc, OperationCategory, OperationDef } from './types';
import type { Check } from './delegation';
import { CAPO_PITCH } from '../config/capoPitches';
import { DELEGATION } from '../config/delegation';
import { ROLE_ORDER } from '../config/economy';
import { OPERATION_BY_ID, OPERATION_CATEGORIES } from '../config/operations';
import { availableOperations, STREET_WORK_IDS } from './operations';
import { operableTerritories, territoryDef } from './territory';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { addLog, nextId, weightedPick } from './util';

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
 * A real capo, as opposed to the seniority stand-in `pitchCapoPool` falls back to.
 *
 * Exported for `crew.ts`'s recruit attribution and `capoVouches.ts`'s
 * eligibility check, both of which need the identical distinction this file
 * already draws rather than a second copy of the role comparison.
 */
export function isRealCapo(npc: Npc): boolean {
  return ROLE_ORDER.indexOf(npc.role) >= ROLE_ORDER.indexOf('capo');
}

/**
 * What a real capo brings, read off him rather than kept as a second stat.
 *
 * Nothing already on `Npc` says "runs numbers" or "moves trucks" — the stats
 * are dispositions (greed, courage, discipline...) and the traits are the
 * same, so mapping either onto a business category would be inventing a
 * connection neither was written to carry, the same mistake the design note
 * on `config/operations.ts` warns against when sorting jobs into categories
 * that don't fit them. A steward's district was the other candidate and it
 * fails for a different reason: most capos never hold one, so it cannot give
 * every capo an answer.
 *
 * `id` can. It is permanent, unique, and every `Npc` has one from the moment
 * he exists — so this reads it through `Rng.stableNoise`, the same idiom
 * `perceive()` uses for a stat's fuzz: a fact that has to hold still for one
 * person forever rather than reroll on every tick, without spending a call on
 * the causal stream or a field in the save.
 */
export function capoSpecialty(capo: Npc): OperationCategory {
  const roll = Rng.stableNoise(`capoSpecialty:${capo.id}`, 0);
  return OPERATION_CATEGORIES[Math.floor(roll * OPERATION_CATEGORIES.length)];
}

/** Worded from `config/operations.ts`'s own gloss on what each category is. */
const SPECIALTY_LINE: Record<OperationCategory, string> = {
  vice: 'a standing vice',
  contraband: 'goods that move',
  muscle: 'a threat or a collection',
  influence: 'a favour bought',
};

/**
 * The line under a pitch's capo, naming the trade `capoSpecialty` already
 * computed for him.
 *
 * Ungated, on the same footing as his role and the operation itself — both
 * already print on the pitch card with no `perceive()` check, because a
 * trade is what somebody does, not a read on who they are. Null for the
 * seniority fallback `pitchCapoPool` uses when there is no real capo yet:
 * that pool was never given a specialty (see this file's header), so there
 * is nothing here to name.
 */
export function specialtyLine(capo: Npc): string | null {
  if (!isRealCapo(capo)) return null;
  return `${capo.name}'s usual line: ${SPECIALTY_LINE[capoSpecialty(capo)]}`;
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

  /*
     Shrinks by one op per pitch drafted, so a job offered this batch cannot
     be offered again in the same batch — what `rng.sample` used to guarantee
     in one call, back when the batch was drawn before any capo was attached
     to it.

     The capo comes first now, because biasing toward his trade means knowing
     whose trade it is before picking the job. A real capo's own category is
     preferred whenever it is still in `pool`; the seniority fallback (no real
     capo yet — see this file's header) never filters at all, so an org with
     nobody to specialise stays exactly as generic as before this existed.
  */
  let pool = fresh.length > 0 ? fresh : ops;

  for (let i = 0; i < need && pool.length > 0; i++) {
    // Weighted rather than even odds: a man reaching for more brings you more
    // of his own pitches. Weight 1 at zero ambition keeps the old even split;
    // `CAPO_PITCH.ambitionWeight` (1) doubles it at 100 — a bias, never a
    // lock-out, so a low-ambition capo still gets his share.
    const capo = weightedPick(
      capos.map((c) => ({ capo: c, weight: 1 + (c.stats.ambition / 100) * CAPO_PITCH.ambitionWeight })),
      rng.next(),
    ).capo;
    let candidates: OperationDef[] = pool;
    if (isRealCapo(capo)) {
      const own = pool.filter((op) => op.category === capoSpecialty(capo));
      if (own.length > 0) candidates = own;
    }
    const op = rng.pick(candidates);
    pool = pool.filter((o) => o.id !== op.id);

    pitches.push({
      id: nextId(state, 'pitch'),
      defId: op.id,
      territoryId: rng.pick(districts).territory.id,
      capoId: capo.id,
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
