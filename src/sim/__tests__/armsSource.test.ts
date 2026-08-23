/**
 * Buying crates instead of building a factory to make them.
 *
 * The arms trade is the most interesting thing in the contraband economy and
 * almost nobody ever sees it. It wants **Capo**, and then it wants a workshop
 * at **$120,000**. Measured over 24 careers that actually play:
 *
 *     peak funds in 300 days   p10 $19,511   median $47,419
 *                              p75 $69,175   p90 $94,345   max $172,656
 *
 * So under one career in ten ever holds the price of a single workshop, before
 * the rank gate is applied at all. That is the `PATRON` shape this project
 * already has a finding for — the best content priced for a run that has
 * already succeeded — and it is why the armoury built beside this file would
 * otherwise have been a war chest for one career in twenty-four.
 *
 * The fix keeps the structural difference the header defends rather than
 * flattening it. Arms are still *made* in a workshop, and that is still the
 * good way to run the trade. What is new is that you can also **buy finished
 * crates from somebody outside the city** — cheap to start, dear per crate.
 *
 *     making   $120,000 up front, $5,200 a crate, and a building a warrant
 *              can name
 *     buying   a small retainer, a much worse unit price, and nothing anybody
 *              can raid
 *
 * That is a real fork rather than a discount: the buyer gets in early and
 * never gets rich on it, and the maker needs a fortune first and then owns the
 * margin. Neither dominates, which the last test checks directly.
 *
 * Nothing here describes how anything is made, moved or concealed. The header
 * on `config/contraband.ts` stands.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { ARMS_SUPPLIERS, TRADES, WORKSHOP } from '../../config/contraband';
import {
  armsSupplier,
  canOpenArmsSupply,
  openArmsSupply,
  openRoute,
  unitCost,
} from '../contraband';
import { totalFunds } from '../economy';
import { controlledTerritories } from '../territory';
import { advanceDay } from '../clock';
import type { GameState } from '../types';

function capo(funds = 60_000, seed = 14): GameState {
  const state = newGame({ name: 'Nobody', difficulty: 'normal', seed });
  state.player.rank = 'capo';
  state.org.cash = funds;
  return state;
}

describe('there is a way in that is not a factory', () => {
  it('offers at least one source', () => {
    expect(ARMS_SUPPLIERS.length, 'arms still have only the workshop').toBeGreaterThan(0);
  });

  it('costs far less to start than a workshop', () => {
    /*
       The whole reason this exists. Against a measured p90 peak of $94,345, a
       $120,000 entry is content for nobody.
    */
    for (const s of ARMS_SUPPLIERS) {
      expect(
        s.retainer,
        `${s.id} costs ${s.retainer}, which is no better than the workshop it is an alternative to`,
      ).toBeLessThan(WORKSHOP.cost / 2);
    }
  });

  it('is reachable at the peak an ordinary career actually reaches', () => {
    // p75 of peak funds is $69,175. At least one source has to sit under it or
    // this has moved the wall rather than removed it.
    const cheapest = Math.min(...ARMS_SUPPLIERS.map((s) => s.retainer));
    expect(cheapest, 'even the cheapest source is out of reach of three careers in four')
      .toBeLessThan(69_175);
  });

  it('opens when you can pay for it', () => {
    const state = capo();
    const id = ARMS_SUPPLIERS[0].id;
    expect(canOpenArmsSupply(state, id).ok, canOpenArmsSupply(state, id).message).toBe(true);
    const before = totalFunds(state);
    openArmsSupply(state, id);
    expect(armsSupplier(state)?.id, 'the arrangement did not take').toBe(id);
    expect(totalFunds(state), 'the retainer was never paid').toBeLessThan(before);
  });

  it('refuses when you cannot, and says what it costs', () => {
    const state = capo(100);
    const check = canOpenArmsSupply(state, ARMS_SUPPLIERS[0].id);
    expect(check.ok).toBe(false);
    expect(check.message, 'a refusal that does not name the price is F10 again').toMatch(/\d/);
  });

  it('refuses below the rank the trade itself asks for', () => {
    const state = capo();
    state.player.rank = 'street_criminal';
    expect(canOpenArmsSupply(state, ARMS_SUPPLIERS[0].id).ok).toBe(false);
  });
});

describe('the wiring, not the function', () => {
  /*
     Opening the arrangement pays a retainer. Whether anything then arrives is a
     separate fact, and paying for a source that never delivers is the worst
     possible version of this feature — the player is poorer and the shelves are
     the same. So this runs the real weekly tick and reads the real shelf.
  */
  it('crates actually arrive', () => {
    /*
       The sandbox 'seated' start, which is what `deep.test.ts` uses for every
       contraband case — it holds a district at Control, which is what the arms
       trade asks for before a route will carry anything. Building that state by
       hand is how a fixture ends up testing nothing.
    */
    const state = newGame({
      name: 'Arms',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'seated',
      seed: 31,
    });
    state.org.cash = 400_000;
    const where = controlledTerritories(state)[0];
    expect(where, 'the seated start holds nothing, so nothing can carry crates').toBeDefined();
    openRoute(state, 'arms', where.id);
    expect(openArmsSupply(state, ARMS_SUPPLIERS[0].id).ok).toBe(true);

    const before = state.contraband.stock.arms;
    for (let i = 0; i < 15 && !state.gameOver; i++) advanceDay(state);

    expect(
      state.contraband.stock.arms,
      'two weeks with a paid arms source delivered nothing at all',
    ).toBeGreaterThan(before);
  });
});

describe('buying is not simply cheaper', () => {
  it('costs more per crate than making them', () => {
    /*
       The fork. If bought crates were also cheaper per unit there would be no
       reason to ever build a workshop, and the trade's capital half — the
       thing a warrant can raid, which is most of its drama — would be dead
       content.
    */
    const state = capo();
    const made = unitCost(state, 'arms');
    openArmsSupply(state, ARMS_SUPPLIERS[0].id);
    const bought = unitCost(state, 'arms');
    expect(
      bought,
      'bought crates cost no more than manufactured ones, so nobody will ever build a workshop',
    ).toBeGreaterThan(made);
  });

  it('still leaves a margin worth having', () => {
    // Dearer than making, and not so dear that the trade loses money — which
    // would make the whole route a trap rather than a choice.
    const state = capo();
    openArmsSupply(state, ARMS_SUPPLIERS[0].id);
    expect(unitCost(state, 'arms')).toBeLessThan(TRADES.arms.unitValue);
  });

  it('pays back the entry sooner than a workshop does', () => {
    // Cheap in, thin margin. That is the trade being offered, and it has to be
    // true or the cheaper door leads nowhere.
    const state = capo();
    const madeMargin = TRADES.arms.unitValue - unitCost(state, 'arms');
    openArmsSupply(state, ARMS_SUPPLIERS[0].id);
    const boughtMargin = TRADES.arms.unitValue - unitCost(state, 'arms');

    const cratesToRepayWorkshop = WORKSHOP.cost / madeMargin;
    const cratesToRepaySource = ARMS_SUPPLIERS[0].retainer / boughtMargin;
    expect(
      cratesToRepaySource,
      'the cheap door takes longer to pay back than the expensive one',
    ).toBeLessThan(cratesToRepayWorkshop);
  });
});
