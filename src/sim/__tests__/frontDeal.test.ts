/**
 * Buying a front, from the man who owns it.
 *
 * Until now this was a purchase authorisation. `acquisitionOptions` listed ten
 * businesses against every district, `canAcquire` checked control, slots,
 * public feeling and money, and pressing the button moved a number. There was
 * no seller. `haggle` in `acquisitionCost` is a flat discount off the
 * negotiation attribute — the price bends to a stat you already have, and
 * nothing is negotiated.
 *
 * Measured before any of this was written, off the catalogue itself:
 *
 *   - nothing is strictly dominated once price is counted, so no entry is dead
 *   - but **seven of ten are beaten on every quality axis** by something else,
 *     which makes the catalogue a price ladder rather than a set of choices
 *   - revenue per dollar runs 37.8 to 51.1 per $1,000 and most entries sit at
 *     exactly 50.0
 *   - capacity against legitimacy correlates at -0.41, almost all of it the
 *     casino, while `config/businesses.ts` opens by saying the two "pull
 *     against each other on purpose"
 *
 * So the only input to which front you buy is how much money you have, and
 * F15 already measured the other half of that: money is the blocker in 97% of
 * the weeks a career owns no front, and 30 careers of 36 finish holding
 * exactly one.
 *
 * What this file holds is the scene. `canAcquire` is untouched — control,
 * slots, sentiment and money still decide whether you may buy at all. The
 * conversation decides **what you pay and on what terms**, and it can end with
 * the man refusing to sell to you, which is the cost that makes it a decision
 * rather than a free discount.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  askingPrice,
  closeDeal,
  dealTerms,
  openDeal,
  sellerRead,
  sellerStats,
  termExposure,
  termRevenueShare,
} from '../frontDeal';
import { acquisitionCost, weeklyRevenue } from '../business';
import { chooseRegister, sitdownOptions } from '../sitdown';
import { BUSINESS_BY_ID } from '../../config/businesses';
import { DEAL, SELLER_REGISTERS } from '../../config/frontDeal';
import type { GameState } from '../types';

/** A family that holds Northside outright and can cover a laundromat. */
function game(seed = 5): GameState {
  const state = newGame({ name: 'Deal', difficulty: 'normal', seed });
  state.territories.northside.influence.player = 80;
  state.org.dirtyCash = 400_000;
  return state;
}

const WHERE = 'northside';
const WHAT = 'laundromat';

describe('the man selling it', () => {
  it('is derived from the district and the place, not invented', () => {
    const poor = game();
    poor.territories[WHERE].sentiment = 20;
    const warm = game();
    warm.territories[WHERE].sentiment = 80;

    expect(
      sellerStats(poor, WHAT, WHERE).grievance,
      'a district that resents you produced a seller who does not',
    ).toBeGreaterThan(sellerStats(warm, WHAT, WHERE).grievance);
  });

  it('reads the same seller the same way twice', () => {
    const state = game();
    expect(sellerStats(state, WHAT, WHERE)).toEqual(sellerStats(state, WHAT, WHERE));
  });

  /*
     The fog, which is the whole reason a sit-down is a read rather than a sum.

     A seller you can see the numbers of is a calculation. `houseRead` gives a
     rival the same five-band vocabulary the crew sheet uses and no numbers,
     and this owes the player exactly that much and no more.
  */
  it('says what he is like without saying what he is', () => {
    const lines = sellerRead(game(), WHAT, WHERE);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text, `"${line.text}" leaked a number`).not.toMatch(/\d/);
    }
  });
});

describe('opening the conversation', () => {
  it('will not open on a front the family could not buy anyway', () => {
    const state = game();
    state.territories[WHERE].influence.player = 0;
    expect(openDeal(state, WHAT, WHERE).ok).toBe(false);
  });

  it('opens above the catalogue price, because he is asking', () => {
    const state = game();
    const listed = acquisitionCost(
      state,
      BUSINESS_BY_ID[WHAT],
      state.territories[WHERE],
    );
    expect(openDeal(state, WHAT, WHERE).ok).toBe(true);
    expect(
      askingPrice(state),
      'the man opened at the shelf price, so there is nothing to talk about',
    ).toBeGreaterThan(listed);
  });

  it('puts something on the table to say', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    expect(sitdownOptions(state).length).toBeGreaterThan(0);
  });

  /*
     The registers on the table are the seller's, not the crew's. A room that
     offered "tell them they are covered" to a man selling a laundromat would
     be the modal working and the scene not existing.
  */
  it('offers the things you would say to a man selling a shop', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    const ids = new Set(SELLER_REGISTERS.map((r) => r.id));
    for (const opt of sitdownOptions(state)) {
      expect(ids.has(opt.def.id), `${opt.def.id} is not something you say to a seller`).toBe(true);
    }
  });
});

describe('what talking is worth', () => {
  it('never moves the price up', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    const rng = new Rng(state.rng);

    let last = askingPrice(state);
    for (const opt of sitdownOptions(state).slice(0, 3)) {
      chooseRegister(state, rng, opt.def.id);
      expect(askingPrice(state), 'talking made it more expensive').toBeLessThanOrEqual(last);
      last = askingPrice(state);
    }
  });

  /*
     And it has a bottom. A scene whose price falls with every landing is a
     discount slider with prose on it — the reason to stop talking has to be
     that there is nothing left to win, or that he is about to stand up.
  */
  it('will not go below what he will take', () => {
    const state = game();
    const listed = acquisitionCost(state, BUSINESS_BY_ID[WHAT], state.territories[WHERE]);
    openDeal(state, WHAT, WHERE);
    const rng = new Rng(state.rng);

    // Say everything, repeatedly, until the room empties.
    for (let i = 0; i < 40; i++) {
      const open = sitdownOptions(state).filter((o) => !o.disabledReason);
      if (!open.length || !state.sitdown || state.sitdown.done) break;
      chooseRegister(state, rng, open[0].def.id);
    }
    expect(askingPrice(state)).toBeGreaterThanOrEqual(Math.round(listed * DEAL.floorShare));
  });
});

describe('closing it', () => {
  it('buys the front at the number on the table, not the catalogue price', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    const rng = new Rng(state.rng);
    for (const opt of sitdownOptions(state).slice(0, 2)) chooseRegister(state, rng, opt.def.id);

    const paying = askingPrice(state);
    const before = state.org.cash + state.org.dirtyCash + (state.org.holdings ?? 0);
    expect(closeDeal(state).ok).toBe(true);

    const after = state.org.cash + state.org.dirtyCash + (state.org.holdings ?? 0);
    expect(before - after, 'the family paid something other than the agreed number').toBe(paying);
    expect(Object.values(state.businesses)).toHaveLength(1);
  });

  it('leaves nothing in the room afterwards', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    closeDeal(state);
    expect(state.sitdown).toBeFalsy();
  });

  it('cannot be closed twice', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    expect(closeDeal(state).ok).toBe(true);
    expect(closeDeal(state).ok).toBe(false);
  });

  /*
     The cost that makes it a decision.

     A conversation you can always walk away from having lost nothing is a free
     roll, and a free roll is not a choice. Push a man past what he will sit
     for and he does not sell to you — not today, and not for a while.
  */
  it('costs the front when he stands up', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    const rng = new Rng(state.rng);

    for (let i = 0; i < 40; i++) {
      if (!state.sitdown || state.sitdown.done) break;
      const open = sitdownOptions(state).filter((o) => !o.disabledReason);
      if (!open.length) break;
      chooseRegister(state, rng, open[0].def.id);
    }

    expect(state.sitdown?.walkedOut, 'nothing in this loop ever wore him out').toBe(true);
    expect(closeDeal(state).ok, 'he walked out and sold it to you anyway').toBe(false);
  });
});

describe('the terms', () => {
  /*
     Terms rather than a discount, because "12% off" is not a decision — it is
     the same front for less. A front the seller still has a piece of is a
     different object afterwards, and that difference is what the player is
     actually choosing between.
  */
  it('carries what was agreed onto the business itself', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    const rng = new Rng(state.rng);

    const cut = sitdownOptions(state).find((o) => o.def.id === 'offer_cut');
    expect(cut, 'there is no way to offer him a piece of it').toBeTruthy();
    chooseRegister(state, rng, cut!.def.id);

    const agreed = dealTerms(state);
    closeDeal(state);
    const bought = Object.values(state.businesses)[0];
    expect(bought.terms ?? [], 'the deal was struck and the front forgot').toEqual(agreed);
  });

  it('gives a front nobody bargained over no terms at all', () => {
    const state = game();
    openDeal(state, WHAT, WHERE);
    closeDeal(state);
    expect(Object.values(state.businesses)[0].terms ?? []).toHaveLength(0);
  });
});

/*
   And that a term is not a decoration.

   This project's standing failure mode is instruments that return believable
   numbers while measuring nothing, and its sibling is a config field nothing
   reads. `MARK.talksStrength` was swept at three values and produced identical
   estates to the dollar, after being described in three files as the property
   everything rested on. A term that saved money once and then did nothing
   would be exactly that again, and would be worse than no term at all: the
   player would have paid a permanent price for nothing.
*/
describe('what a term costs afterwards', () => {
  function bought(terms: string[]): { state: GameState; id: string } {
    const state = game();
    openDeal(state, WHAT, WHERE);
    closeDeal(state);
    const biz = Object.values(state.businesses)[0];
    if (terms.length) biz.terms = terms;
    return { state, id: biz.id };
  }

  it('takes a share of what the front earns, every week, forever', () => {
    const plain = bought([]);
    const shared = bought(['he_stays']);

    const full = weeklyRevenue(plain.state, plain.state.businesses[plain.id]);
    const less = weeklyRevenue(shared.state, shared.state.businesses[shared.id]);

    expect(full, 'the fixture front earns nothing, so this proves nothing').toBeGreaterThan(0);
    expect(less, 'a front the seller kept a piece of paid out in full').toBeLessThan(full);
  });

  it('makes a front with somebody being carried louder', () => {
    const plain = bought([]);
    const carried = bought(['looked_after']);

    expect(termExposure(plain.state.businesses[plain.id])).toBe(0);
    expect(
      termExposure(carried.state.businesses[carried.id]),
      'the man you promised to look after costs nothing at all',
    ).toBeGreaterThan(0);
  });

  it('leaves a front nobody bargained over exactly as it was', () => {
    const plain = bought([]);
    const biz = plain.state.businesses[plain.id];
    expect(termRevenueShare(biz)).toBe(1);
    expect(termExposure(biz)).toBe(0);
  });
});
