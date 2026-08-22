/**
 * The ledger of ground lost, and the thing a player can do about it.
 *
 * Two properties, and the second matters more than the first. A family
 * remembers being pushed out of a district, which is what lets it decide to do
 * something about a player it is no longer stronger than. And a tribute
 * settles that memory — because a counterplay that answers the *mood* while
 * the *ledger* drives the targeting is not a counterplay at all, it is a
 * family taking your money and coming back next week.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { noteInfluenceTaken } from '../faction';
import { doDiplomacy, diplomaticCost } from '../diplomacy';
import { GROUND_LOST, RIVAL_IDS, type FactionId } from '../../config/factions';
import { territoryList } from '../territory';
import { runDaysSolvent } from './helpers';
import type { GameState } from '../types';

/** A district the given family is actually standing in, so the loss registers. */
function districtHeldBy(state: GameState, id: FactionId): string {
  const t = territoryList(state).find((x) => (x.influence[id] ?? 0) >= 10);
  if (!t) throw new Error(`no district held by ${id}`);
  return t.id;
}

function ledgerAgainstPlayer(state: GameState, id: FactionId): number {
  const entries = state.factions[id]?.groundLost ?? {};
  return Object.entries(entries)
    .filter(([key]) => key.startsWith('player:'))
    .reduce((sum, [, value]) => sum + value, 0);
}

/**
 * Everything every family is holding against anybody.
 *
 * Used where the assertion is that the loss was *recorded*, because who gets
 * blamed for it deliberately is not guaranteed — `attribute` lets a family
 * that cannot tell who pushed them out settle on a plausible neighbour, and
 * that misattribution is a feature the ledger inherits on purpose.
 */
function ledgerTotal(state: GameState): number {
  return RIVAL_IDS.reduce(
    (sum, id) =>
      sum +
      Object.values(state.factions[id]?.groundLost ?? {}).reduce((a, b) => a + b, 0),
    0,
  );
}

describe('ground lost', () => {
  it('is written down when the player takes a street', () => {
    const state = newGame({ name: 'Ledger', difficulty: 'normal', seed: 7 });
    const rng = new Rng(state.rng);
    const id: FactionId = 'falcone';
    const where = districtHeldBy(state, id);

    expect(ledgerTotal(state)).toBe(0);
    noteInfluenceTaken(state, rng, where, 12);
    expect(ledgerTotal(state)).toBeGreaterThan(0);
  });

  it('does not record a loss in a district the family is not standing in', () => {
    const state = newGame({ name: 'Ledger', difficulty: 'normal', seed: 7 });
    const rng = new Rng(state.rng);
    const empty = territoryList(state).find((t) =>
      RIVAL_IDS.every((id) => (t.influence[id] ?? 0) < 10),
    );
    if (!empty) return; // Every district is spoken for in this city; nothing to assert.
    noteInfluenceTaken(state, rng, empty.id, 20);
    expect(ledgerTotal(state)).toBe(0);
  });

  it('is settled by a tribute, in proportion to what was paid', () => {
    const state = newGame({ name: 'Ledger', difficulty: 'normal', seed: 7 });
    const rng = new Rng(state.rng);
    const id: FactionId = 'falcone';
    const where = districtHeldBy(state, id);

    // A grievance far larger than one envelope can cover.
    state.factions[id].groundLost = { [`player:${where}`]: 400 };
    const before = ledgerAgainstPlayer(state, id);

    const cost = diplomaticCost(state, 'offer_tribute', id);
    state.org.dirtyCash += cost;
    state.org.cash += cost;
    const result = doDiplomacy(state, rng, 'offer_tribute', id);
    expect(result.ok).toBe(true);

    const after = ledgerAgainstPlayer(state, id);
    expect(after).toBeLessThan(before);
    // Priced, not wiped: one payment must not settle an entire feud.
    expect(after).toBeGreaterThan(0);
    expect(before - after).toBeCloseTo((cost / 10_000) * GROUND_LOST.settledPer10k, 5);
  });

  it('fades on its own when the player leaves them alone', () => {
    const state = newGame({ name: 'Ledger', difficulty: 'normal', seed: 7 });
    const id: FactionId = 'falcone';
    const where = districtHeldBy(state, id);
    state.factions[id].groundLost = { [`player:${where}`]: 6 };

    /*
       Days, not calls. `tickFactions` returns immediately unless the day is a
       multiple of FACTION_DECISION_INTERVAL_DAYS, so twenty calls on a Tuesday
       run the weekly work exactly zero times — which is how the first version
       of this test asserted a fade that had never been given a chance to
       happen. The player runs nothing here, so nothing feeds the ledger back.
    */
    runDaysSolvent(state, 20 * 7);

    expect(ledgerAgainstPlayer(state, id)).toBe(0);
  });
});
