/**
 * Live pitches, replacing the static Tier 1+ board.
 *
 * See `capoPitches.ts` for the machine. The three things worth pinning down:
 * pitches are tier 1+ and never street work, approving hands off to the
 * ordinary launch path rather than resolving anything itself, and reassigning
 * one costs the man it was taken from exactly what taking a district back
 * off a steward costs — the same numbers, not new ones.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  approvePitch,
  capoSpecialty,
  livePitches,
  pitchCapoPool,
  reassignPitch,
  rejectPitch,
  tickCapoPitches,
} from '../capoPitches';
import { STREET_WORK_IDS } from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { DELEGATION } from '../../config/delegation';
import { CAPO_PITCH } from '../../config/capoPitches';
import { territoryList } from '../territory';
import { crewList } from '../npc';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Pitch', difficulty: 'normal', seed });
}

/** Enough of an organization for Enforcer-tier work to be open. */
function build(state: GameState, districts: number, fronts: number, crew: number): void {
  const ts = territoryList(state);
  for (let i = 0; i < districts && i < ts.length; i++) {
    ts[i].influence = { ...ts[i].influence, player: 95 };
  }
  const have = crewList(state);
  const src = have[0];
  for (let i = have.length; i < crew; i++) {
    state.npcs[`n${i}`] = { ...src, id: `n${i}`, name: `Hand ${i}`, status: 'active' };
  }
  void fronts;
}

function tickToDay(state: GameState, rng: Rng, day: number): void {
  while (state.day < day) {
    tickCapoPitches(state, rng);
    state.day += 1;
  }
  tickCapoPitches(state, rng);
}

describe('capo pitches', () => {
  it('offers nothing before there is anywhere to work', () => {
    const state = game();
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    expect(livePitches(state)).toHaveLength(0);
  });

  it('fills the board, tier 1+, never street work', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const pitches = livePitches(state);
    expect(pitches.length).toBeGreaterThan(0);
    expect(pitches.length).toBeLessThanOrEqual(CAPO_PITCH.count);
    for (const p of pitches) {
      const def = OPERATION_BY_ID[p.defId];
      expect(def.tier).toBeGreaterThan(0);
      expect(STREET_WORK_IDS.has(p.defId)).toBe(false);
      expect(state.npcs[p.capoId]).toBeTruthy();
      expect(state.territories[p.territoryId]).toBeTruthy();
    }
  });

  it('tops back up to count after one clears', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const before = livePitches(state);
    expect(before.length).toBeGreaterThan(0);
    rejectPitch(state, before[0].id);
    expect(livePitches(state)).toHaveLength(before.length - 1);
    tickToDay(state, rng, 14);
    expect(livePitches(state).length).toBeGreaterThanOrEqual(before.length - 1);
  });

  it('approve marks it settled and hands off nothing itself', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const cashBefore = state.org.cash;
    const result = approvePitch(state, p.id);
    expect(result?.status).toBe('approved');
    expect(livePitches(state).find((x) => x.id === p.id)).toBeUndefined();
    // No money moved and nothing launched — that is the assemble screen's job.
    expect(state.org.cash).toBe(cashBefore);
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
  });

  it('reject clears it for nothing', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const capo = { ...state.npcs[p.capoId] };
    rejectPitch(state, p.id);
    expect(state.npcs[p.capoId].stats.loyalty).toBe(capo.stats.loyalty);
    expect(state.npcs[p.capoId].stats.grievance).toBe(capo.stats.grievance);
  });

  it('at a neutral temperament and a mid-tier job, costs exactly what taking back a district costs', () => {
    // ambition 50 and loyalty 50 cancel (0.35 up, 0.35 down); a tier-3 job is
    // this file's own neutral point for `PITCH_REACTION.importanceWeight` —
    // together the scaling multiplier is exactly 1, the same flat charge
    // this test asserted before reassignPitch started reading temperament.
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const midTier = Object.values(OPERATION_BY_ID).find((op) => op.tier === 3);
    expect(midTier, 'need a tier-3 operation to test the neutral point').toBeTruthy();
    p.defId = midTier!.id;
    const pool = pitchCapoPool(state);
    const alt = pool.find((n) => n.id !== p.capoId);
    expect(alt, 'need a second candidate to reassign to').toBeTruthy();
    const original = state.npcs[p.capoId];
    original.stats = { ...original.stats, ambition: 50, loyalty: 50 };
    const loyaltyBefore = original.stats.loyalty;
    const grievanceBefore = original.stats.grievance;
    const memoriesBefore = original.memories.length;

    const check = reassignPitch(state, p.id, alt!.id);
    expect(check.ok).toBe(true);
    expect(state.npcs[p.capoId].id).toBe(alt!.id);
    expect(original.stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
    expect(original.stats.grievance).toBe(
      Math.max(0, Math.min(100, grievanceBefore + DELEGATION.recallGrievance)),
    );
    expect(original.memories.length).toBe(memoriesBefore + 1);
    expect(original.memories[0].kind).toBe('passed_over');
    // Still live, just under somebody else now.
    expect(livePitches(state).some((x) => x.id === p.id)).toBe(true);
  });

  it('scales the charge up for a man who wants it and does not trust you to make it right', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const alt = pitchCapoPool(state).find((n) => n.id !== p.capoId);
    expect(alt, 'need a second candidate to reassign to').toBeTruthy();

    const original = state.npcs[p.capoId];
    // 60, not 5 — high enough above zero that the extra loyalty loss this
    // scaling adds cannot be masked by the stat's own floor clamp.
    original.stats = { ...original.stats, ambition: 95, loyalty: 60 };
    const loyaltyBefore = original.stats.loyalty;
    const grievanceBefore = original.stats.grievance;

    reassignPitch(state, p.id, alt!.id);

    // Bigger than the flat charge in both directions.
    expect(original.stats.loyalty).toBeLessThan(loyaltyBefore + DELEGATION.recallLoyalty);
    expect(original.stats.grievance).toBeGreaterThan(grievanceBefore + DELEGATION.recallGrievance);
  });

  it('scales the charge down for a loyal, unambitious man', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const alt = pitchCapoPool(state).find((n) => n.id !== p.capoId);
    expect(alt, 'need a second candidate to reassign to').toBeTruthy();

    const original = state.npcs[p.capoId];
    original.stats = { ...original.stats, ambition: 5, loyalty: 95 };
    const loyaltyBefore = original.stats.loyalty;
    const grievanceBefore = original.stats.grievance;

    reassignPitch(state, p.id, alt!.id);

    // Smaller than the flat charge in both directions.
    expect(original.stats.loyalty).toBeGreaterThan(loyaltyBefore + DELEGATION.recallLoyalty);
    expect(original.stats.grievance).toBeLessThan(grievanceBefore + DELEGATION.recallGrievance);
  });

  it('writes a tie from the passed-over capo toward the one who got it', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    const alt = pitchCapoPool(state).find((n) => n.id !== p.capoId);
    expect(alt, 'need a second candidate to reassign to').toBeTruthy();

    const original = state.npcs[p.capoId];
    expect(original.ties.find((t) => t.id === alt!.id)).toBeUndefined();

    reassignPitch(state, p.id, alt!.id);

    const tie = original.ties.find((t) => t.id === alt!.id);
    expect(tie, 'expected a tie toward the man who got the pitch').toBeTruthy();
    expect(tie!.resentment).toBeGreaterThan(0);
    expect(tie!.trust).toBeLessThan(0 + 1); // fell, or started and stayed at the floor
  });

  it('reaction note reads as a shrug for a man who takes it well, and as resentment for one who does not', () => {
    const low = game(11);
    build(low, 1, 0, 4);
    const rngLow = new Rng(low.rng);
    tickToDay(low, rngLow, 7);
    const pLow = livePitches(low)[0];
    const altLow = pitchCapoPool(low).find((n) => n.id !== pLow.capoId)!;
    const mildNpc = low.npcs[pLow.capoId];
    mildNpc.stats = { ...mildNpc.stats, ambition: 0, loyalty: 100 };
    reassignPitch(low, pLow.id, altLow.id);
    expect(mildNpc.notes[0].kind).toBe('neutral');

    const high = game(11);
    build(high, 1, 0, 4);
    const rngHigh = new Rng(high.rng);
    tickToDay(high, rngHigh, 7);
    const pHigh = livePitches(high)[0];
    const altHigh = pitchCapoPool(high).find((n) => n.id !== pHigh.capoId)!;
    const sourNpc = high.npcs[pHigh.capoId];
    sourNpc.stats = { ...sourNpc.stats, ambition: 100, loyalty: 0 };
    reassignPitch(high, pHigh.id, altHigh.id);
    expect(sourNpc.notes[0].kind).toBe('bad');
    expect(mildNpc.notes[0].text).not.toBe(sourNpc.notes[0].text);
  });

  it('is stable for a given capo', () => {
    // A permanent fact about him, not a fresh roll — same id, same answer,
    // however many times it is asked.
    const npc = { id: 'stable_check' } as Npc;
    expect(capoSpecialty(npc)).toBe(capoSpecialty(npc));
  });

  it('prefers a real capo\'s own trade when it is on the board', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);

    // Find an id whose specialty is 'muscle' — this build opens two muscle
    // jobs (protection_racket, freelance_muscle) and one contraband job
    // (truck_hijack), so a muscle specialist always has his own trade to
    // prefer on the first pitch drafted for him.
    let capoId = '';
    for (let i = 0; i < 500; i++) {
      const candidate = `capo_test_${i}`;
      if (capoSpecialty({ id: candidate } as Npc) === 'muscle') {
        capoId = candidate;
        break;
      }
    }
    expect(capoId, 'need an id that hashes to muscle').not.toBe('');

    // He is the only real capo, so pitchCapoPool has exactly one member and
    // every pitch this refresh is unambiguously his.
    const crew = crewList(state);
    const template = crew[0];
    state.npcs[capoId] = { ...template, id: capoId, name: 'Test Capo', role: 'capo', status: 'active' };
    for (const n of crew) n.role = 'soldier';

    tickToDay(state, rng, 7);
    const pitches = livePitches(state);
    expect(pitches.length).toBeGreaterThan(0);
    for (const p of pitches) expect(p.capoId).toBe(capoId);

    const categories = pitches.map((p) => OPERATION_BY_ID[p.defId].category);
    // A matching op was on the board when the batch started, so it must have
    // been drafted before the board ran out of muscle work.
    expect(categories[0]).toBe('muscle');
  });

  it('a more ambitious capo gets attributed more of the pitches — a standing bias, not a lock-out', () => {
    const state = game();
    build(state, 1, 0, 6);
    const rng = new Rng(state.rng);
    const crew = crewList(state);
    const [low, high, ...rest] = crew;
    low.role = 'capo';
    high.role = 'capo';
    // `build`'s clones are a shallow spread of the same template, so `.stats`
    // is one shared object across them until replaced outright — mutating it
    // in place would silently set both men's ambition at once.
    low.stats = { ...low.stats, ambition: 5 };
    high.stats = { ...high.stats, ambition: 95 };
    for (const n of rest) n.role = 'soldier';

    const counts: Record<string, number> = { [low.id]: 0, [high.id]: 0 };
    for (let day = state.day; day <= 7 * 40; day++) {
      state.day = day;
      tickCapoPitches(state, rng);
      if (day % CAPO_PITCH.refreshIntervalDays === 0) {
        for (const p of livePitches(state)) {
          counts[p.capoId] = (counts[p.capoId] ?? 0) + 1;
          rejectPitch(state, p.id); // clear it so next week drafts fresh
        }
      }
    }

    // Weight 2 vs weight 1 is roughly a 2:1 split over enough draws — a wide
    // margin (1.3x) so this reads the bias, not sampling noise.
    expect(counts[high.id]).toBeGreaterThan(counts[low.id] * 1.3);
  });

  it('an unanswered pitch goes stale on its own clock', () => {
    const state = game();
    build(state, 1, 0, 4);
    const rng = new Rng(state.rng);
    tickToDay(state, rng, 7);
    const p = livePitches(state)[0];
    tickToDay(state, rng, 7 + CAPO_PITCH.windowDays);
    expect(livePitches(state).some((x) => x.id === p.id)).toBe(false);
  });
});
