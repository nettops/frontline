/**
 * Crates you kept, and what they are worth when the shooting starts.
 *
 * The arms trade already had the best double edge in the game and only one of
 * its two sides. Selling crates to another family gives them
 * `ARMS_SALE.strengthPerCrate` of strength, so a player funding a war with arms
 * sales is arming the people they will fight in eighteen months — and nothing
 * warns them. But keeping the crates did **nothing at all**. `playerStrength`
 * is crew count times quality and reads no stock, so an armoury was inventory
 * waiting for a buyer and never a war chest.
 *
 * That asymmetry is the whole bug. A rival with your crates is measurably
 * harder to fight; you with your own crates were exactly as easy.
 *
 * Three things have to hold together, and each kills a different wrong answer:
 *
 * 1. Holding arms makes you harder to fight — at the **same rate** a buyer
 *    gets, because any other number is a claim that crates work differently
 *    depending on who owns them.
 * 2. It is **capped**. A stockpile supplements a crew; a boss alone in a room
 *    with forty crates is not an army, and if he is then the crew system stops
 *    mattering.
 * 3. War **spends** them. Without that, stockpiling is a one-off purchase of a
 *    permanent bonus and there is no decision in it — the decision is sell now
 *    or hold for a war that may never come.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { playerStrength } from '../diplomacy';
import { armsStrength, spendWarStock } from '../contraband';
import { ARMED, ARMS_SALE } from '../../config/contraband';
import { crewList } from '../npc';
import { declareWar } from '../diplomacy';
import { advanceDay } from '../clock';
import type { GameState } from '../types';

/** A career with people and an armoury, so both halves are non-zero. */
function armed(crates: number, seed = 12): GameState {
  const state = newGame({ name: 'Nobody', difficulty: 'normal', seed });
  for (const n of crewList(state)) n.status = 'active';
  state.contraband = {
    stock: { product: 0, arms: crates },
    supplierId: null,
    supplierSince: 0,
    workshops: [],
    routes: { product: [], arms: [] },
    lastRun: null,
    lifetime: { product: 0, arms: 0 },
  };
  return state;
}

describe('an armoury is worth something', () => {
  it('makes you harder to fight than the same crew with nothing', () => {
    const bare = armed(0);
    const stocked = armed(20);
    expect(
      playerStrength(stocked),
      'twenty crates changed nothing about how hard you are to fight',
    ).toBeGreaterThan(playerStrength(bare));
  });

  it('is worth the same per crate as it is to somebody you sell to', () => {
    /*
       Symmetry, and it is the reason this is a fix rather than a new mechanic.
       A crate cannot be worth 0.55 of strength in a rival's hands and some
       other number in yours.
    */
    expect(ARMED.strengthPerCrate).toBeCloseTo(ARMS_SALE.strengthPerCrate, 5);
  });

  it('counts nothing when the shelves are empty', () => {
    expect(armsStrength(armed(0))).toBe(0);
  });

  it('is capped, so it supplements a crew and never replaces one', () => {
    const many = armed(500);
    expect(armsStrength(many)).toBeLessThanOrEqual(ARMED.maxStrength);
    expect(ARMED.maxStrength, 'the cap is high enough to be the whole story').toBeLessThan(50);
  });

  it('is worth nothing to somebody with nobody to carry it', () => {
    // Strength is already zero with no crew, and an armoury must not rescue
    // that — otherwise a boss alone in a room is a faction.
    const state = armed(40);
    for (const n of crewList(state)) n.status = 'dead';
    expect(playerStrength(state), 'crates fought the war by themselves').toBe(0);
  });
});

describe('a war spends them', () => {
  it('takes crates off the shelf', () => {
    const state = armed(20);
    spendWarStock(state, 1);
    expect(
      state.contraband!.stock.arms,
      'a week of war cost nothing out of the armoury',
    ).toBeLessThan(20);
  });

  it('takes more for more wars at once', () => {
    const one = armed(40);
    const two = armed(40);
    spendWarStock(one, 1);
    spendWarStock(two, 2);
    expect(two.contraband!.stock.arms).toBeLessThan(one.contraband!.stock.arms);
  });

  it('never goes below empty', () => {
    const state = armed(1);
    spendWarStock(state, 5);
    expect(state.contraband!.stock.arms).toBe(0);
  });

  it('does nothing in peacetime', () => {
    const state = armed(20);
    spendWarStock(state, 0);
    expect(state.contraband!.stock.arms).toBe(20);
  });

  it('leaves the other trade alone', () => {
    const state = armed(20);
    state.contraband!.stock.product = 30;
    spendWarStock(state, 2);
    expect(state.contraband!.stock.product, 'the war ate the product too').toBe(30);
  });
});

describe('the wiring, not the function', () => {
  /*
     `spendWarStock` not being skimmed is a fact about `spendWarStock`. That the
     game ever calls it is a different fact, and this project has shipped the
     gap between them before — sixteen possessions tests green while the warrant
     path called nothing. So this one starts a real war and runs the real tick.
  */
  it('a real war really empties the shelf, and peace does not', () => {
    /*
       An A/B, and the first version was not — it ran one war and asserted the
       shelf went down. It did, and it also went down with the wiring removed,
       because `tickContraband` moves stock every week for its own reasons.
       The assertion was reading the trade running, not the war being fought.

       Two identical careers, one at war, is the only shape that isolates it.
    */
    const at = armed(40, 21);
    const peace = armed(40, 21);
    declareWar(at, 'player', 'falcone');

    for (let i = 0; i < 9; i++) {
      if (!at.gameOver) advanceDay(at);
      if (!peace.gameOver) advanceDay(peace);
    }

    expect(
      at.contraband!.stock.arms,
      'a war and a quiet week cost the armoury exactly the same, so the war ' +
        'tick is not spending anything',
    ).toBeLessThan(peace.contraband!.stock.arms);
  });
});

describe('the decision it creates', () => {
  it('makes selling the armoury a real cost, not just income', () => {
    /*
       The point of the whole thing. Before this, selling crates cost you
       nothing you could see — the buyer got stronger and you got money. Now
       the same sale also empties your own side of the ledger, which is what
       makes `ARMS_SALE`'s double edge actually double.
    */
    const kept = armed(20);
    const sold = armed(0);
    const swing = playerStrength(kept) - playerStrength(sold);
    expect(swing, 'selling twenty crates costs you no strength at all').toBeGreaterThan(0);
  });
});
