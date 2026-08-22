/**
 * What the family is worth.
 *
 * These check the trade the measure makes rather than its arithmetic: that
 * building something counts, that letting it rot counts for less, and that a
 * suitcase of unexplained cash counts for nothing.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { estate } from '../estate';
import { rankRequirements } from '../player';
import { putAway } from '../economy';
import { acquireBusiness, canAcquire, ownedBusinesses } from '../business';
import { BUSINESSES } from '../../config/businesses';
import { territoryList, playerInfluence } from '../territory';
import type { GameState } from '../types';

/** A world holding one district outright, with money to spend in it. */
function landlord(): { state: GameState; territoryId: string } {
  const state = newGame({ name: 'Estate', difficulty: 'normal', seed: 3 });
  const t = territoryList(state)[0];
  t.influence.player = 100;
  t.sentiment = 80;
  state.org.cash = 400_000;
  state.org.dirtyCash = 0;
  return { state, territoryId: t.id };
}

function buyAnything(state: GameState, territoryId: string): string | null {
  for (const def of BUSINESSES) {
    if (canAcquire(state, def.id, territoryId).ok) {
      const bought = acquireBusiness(state, def.id, territoryId);
      if (bought) return bought.id;
    }
  }
  return null;
}

describe('what the family is worth', () => {
  it('counts the wallet', () => {
    const { state } = landlord();
    expect(estate(state).cash).toBe(400_000);
    expect(estate(state).total).toBeGreaterThanOrEqual(400_000);
  });

  /*
     The whole point of the measure.

     Money spent on a building is not money lost. Before this, buying a front
     took a family *backwards* on the only requirement rank was gated on, which
     is precisely the wrong incentive for a game about building something.
  */
  it('does not go down when money is turned into a front', () => {
    const { state, territoryId } = landlord();
    const before = estate(state).total;
    const id = buyAnything(state, territoryId);
    expect(id).not.toBeNull();
    const after = estate(state);
    expect(after.fronts).toBeGreaterThan(0);
    // Some value is lost to the haggle and the premium; most of it survives.
    expect(after.total).toBeGreaterThan(before * 0.85);
  });

  it('is worth less when the front is being run into the ground', () => {
    const { state, territoryId } = landlord();
    const id = buyAnything(state, territoryId)!;
    const sound = estate(state).fronts;
    state.businesses[id].health = 40;
    const ailing = estate(state).fronts;
    expect(ailing).toBeGreaterThan(0);
    expect(ailing).toBeLessThan(sound);
  });

  it('is worth nothing once the front has gone under', () => {
    const { state, territoryId } = landlord();
    const id = buyAnything(state, territoryId)!;
    expect(estate(state).fronts).toBeGreaterThan(0);
    state.businesses[id].status = 'shuttered';
    expect(ownedBusinesses(state).length).toBe(0);
    expect(estate(state).fronts).toBe(0);
  });

  /*
     A suitcase nobody can explain is not standing.

     This is the one place the old design was already right, and it is worth an
     assertion because the temptation to "just count all the money" is exactly
     what would undo the distinction between the two pools.
  */
  it('never counts dirty cash', () => {
    const { state } = landlord();
    const before = estate(state).total;
    state.org.dirtyCash = 1_000_000;
    expect(estate(state).total).toBe(before);
  });

  it('counts money put away as well as money to hand', () => {
    const { state } = landlord();
    const before = estate(state).total;
    putAway(state, 250_000);
    const after = estate(state);
    expect(after.holdings).toBe(250_000);
    expect(after.cash).toBe(150_000);
    expect(after.total).toBe(before);
  });

  /*
     Ground is counted as districts held, not as money.

     This test asserted the opposite when it was written, and the assertion was
     wrong rather than the number. Valuing ground in the estate failed
     `balance > lets careful play build a bigger organization` in three
     different forms — districts are taken by running operations, and running
     every operation available is what the greedy bot is. It was also double
     counting: the rank table already asks for districts on their own line.
  */
  it('does not put ground in the money, because rank counts it separately', () => {
    const { state } = landlord();
    const held = territoryList(state).filter((t) => playerInfluence(t) >= 25);
    expect(held.length).toBeGreaterThan(0);
    expect(estate(state).ground).toBe(0);
    /*
       And the requirement that does count ground is still there.

       Read at a rank whose *next* rung actually asks for districts — the table
       hides requirements of zero, and Enforcer asks for none, so a fresh boss
       would show no such row and prove nothing.
    */
    state.player.rank = 'crew_leader';
    const districts = rankRequirements(state).find((r) => r.label === 'Districts held');
    expect(districts).toBeDefined();
    expect(districts?.needed).toBeGreaterThan(0);
  });

  it('values a save that has never heard of holdings', () => {
    const { state } = landlord();
    delete state.org.holdings;
    expect(estate(state).holdings).toBe(0);
    expect(Number.isFinite(estate(state).total)).toBe(true);
  });
});

describe('front takings compound', () => {
  /*
     The two changes that make the estate measure worth anything.

     Counting what a family owns does not help if the family never buys
     anything, and it bought $4,387 of fronts a career while spending $85,137
     of clean money on job costs. So a front's own takings go where they cannot
     be quietly spent, and the one thing they can be spent on is another front.
  */
  it('lets holdings buy a front without paying the hurry price', () => {
    const { state, territoryId } = landlord();
    // Everything the family has is put away.
    putAway(state, 400_000);
    state.org.cash = 0;
    const before = estate(state).total;

    expect(canAcquire(state, BUSINESSES[0].id, territoryId).ok).toBe(true);
    const bought = buyAnything(state, territoryId);
    expect(bought).not.toBeNull();

    const after = estate(state);
    expect(after.fronts).toBeGreaterThan(0);
    // A `takeBack` would have cost 15% of whatever it drew. Buying directly
    // out of holdings keeps the value in the family.
    expect(after.total).toBeGreaterThan(before * 0.95);
  });

  it('refuses when even holdings cannot cover it', () => {
    const { state, territoryId } = landlord();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    state.org.holdings = 500;
    const dear = BUSINESSES[BUSINESSES.length - 1];
    const check = canAcquire(state, dear.id, territoryId);
    expect(check.ok).toBe(false);
    expect(acquireBusiness(state, dear.id, territoryId)).toBeNull();
    // And nothing was taken on the way out.
    expect(state.org.holdings).toBe(500);
  });
});
