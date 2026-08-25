/**
 * The cut, as a relationship rather than a tax.
 *
 * `LAUNDER_CUT_BASE` is 0.24 and it applies to every dollar a family ever
 * washes. Measured across 36 careers of 300 days that is the single most
 * punitive charge in the game, and the only one that buys nothing — stock buys
 * units, wages buy people, upkeep buys premises, and this evaporates:
 *
 *     trading arm    sold $1,632,268
 *                    - stock    694,777
 *                    - payroll  105,821
 *                    - the cut  156,255   (~21% of everything washed)
 *                    = net      675,415
 *
 *     ...against $41,146 of estate over the same careers not trading.
 *
 * So 24% stops being what laundering costs and becomes **what a stranger
 * charges**. Somebody who handles it for you charges less, charges less again
 * the longer you keep them, and can stop taking your calls — the same shape
 * `SUPPLY_TRUST` already gives the contraband arrangements, for the same
 * reason: a flat number is not a relationship.
 *
 * The fork this has to keep honest, and the reason it is not simply a
 * discount:
 *
 *     nobody        24%, no retainer, no fee, nobody to lose
 *     somebody      a retainer up front, a fee every week whether or not
 *                   anything moves, a name on paperwork, and a rate that is
 *                   only worth having if you keep them and keep quiet
 *
 * A loud family earns no trust at all — `heatCeiling` holds it at nothing —
 * so the discount is bought with the one thing this bot has never done and a
 * player can: keeping your head down.
 *
 * As with the rest of the laundering economy this is deliberately abstract.
 * Rates, retainers, fees, exposure, and how long somebody has known you.
 * Nothing here describes how anything is concealed in the real world, and
 * nothing here should be added that does.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDay } from '../clock';
import {
  LAUNDERERS,
  LAUNDER_TRUST,
} from '../../config/launderers';
import { LAUNDER_CUT_BASE, LAUNDER_CUT_MIN } from '../../config/businesses';
import { launderCut } from '../business';
import {
  canRetainLauderer,
  dropLaunderer,
  launderer,
  laundererTrust,
  retainLaunderer,
  laundererWalkChance,
} from '../launderers';
import { totalFunds } from '../economy';
import { withFronts } from './helpers';
import type { GameState } from '../types';

function family(funds = 400_000, seed = 31): GameState {
  const state = newGame({
    name: 'Books',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, 2);
  state.org.cash = funds;
  state.org.dirtyCash = 0;
  state.org.heat = 0;
  return state;
}

const cheapest = () => [...LAUNDERERS].sort((a, b) => a.retainer - b.retainer)[0];

describe('the roster is a fork, not a discount', () => {
  it('all of them beat a stranger, which is the reason to hire one', () => {
    for (const l of LAUNDERERS) {
      expect(l.cut, `${l.id} charges more than nobody does`).toBeLessThan(LAUNDER_CUT_BASE);
      expect(l.bestCut, `${l.id} never gets better than it started`).toBeLessThan(l.cut);
    }
  });

  it('and all of them cost something a stranger does not', () => {
    // A retainer, a standing fee, a name on paperwork, and somebody who can
    // walk. Without all four this is a button that says "pay less".
    for (const l of LAUNDERERS) {
      expect(l.retainer, `${l.id} is free to open`).toBeGreaterThan(0);
      expect(l.fee, `${l.id} costs nothing to keep`).toBeGreaterThan(0);
      expect(l.exposure, `${l.id} leaves no trace at all`).toBeGreaterThan(0);
      expect(l.failureChancePerWeek, `${l.id} can never walk`).toBeGreaterThan(0);
    }
  });

  it('pays for the better rate with a dearer retainer', () => {
    // The usual shape in this game: cheap in and thin, or dear in and fat.
    // Sorting by price must sort by rate, or one row on the table is simply
    // worse than another and nobody will ever pick it.
    const byPrice = [...LAUNDERERS].sort((a, b) => a.retainer - b.retainer);
    for (let i = 1; i < byPrice.length; i++) {
      expect(
        byPrice[i].bestCut,
        `${byPrice[i].id} costs more than ${byPrice[i - 1].id} and is no better`,
      ).toBeLessThan(byPrice[i - 1].bestCut);
    }
  });

  it('is priced off a plotted distribution', () => {
    /*
       Peak funds over 36 careers, measured on `ladder.probe`'s bot:

           by day 100   p10 10,026  p25 18,528  median 39,310  p75 156,053
           by day 200   p10 15,635  p25 34,051  median 125,927 p75 232,915

       DIRECTOR §5: a bar sits between the median and the 75th. The cheapest
       has to be an early-career fixture rather than a late luxury, so it is
       sized against day 100; the best rate in the game is sized against 200.
    */
    expect(cheapest().retainer, 'the way in is out of reach of most careers').toBeLessThan(156_053);
    expect(cheapest().retainer, 'the way in is free money').toBeGreaterThan(39_310);
    const dearest = [...LAUNDERERS].sort((a, b) => b.retainer - a.retainer)[0];
    expect(dearest.retainer, 'the best rate is a late luxury nobody reaches').toBeLessThan(547_498);
  });
});

describe('retaining one', () => {
  it('refuses a family that cannot pay, and names the figure', () => {
    const state = family(100);
    const check = canRetainLauderer(state, cheapest().id);
    expect(check.ok).toBe(false);
    expect(check.message, 'a refusal that does not name the price is F10 again').toMatch(/\d/);
  });

  it('opens when you can pay for it, and takes the retainer', () => {
    const state = family();
    const before = totalFunds(state);
    expect(retainLaunderer(state, cheapest().id).ok).toBe(true);
    expect(launderer(state)?.id).toBe(cheapest().id);
    expect(totalFunds(state), 'the retainer was never paid').toBeLessThan(before);
  });

  it('starts a new relationship from nothing when you go back', () => {
    // The thing being rewarded is having kept them. Walking out and back in
    // must not restore what you had — the same rule `openSupply` follows.
    const state = family();
    retainLaunderer(state, cheapest().id);
    state.org.laundererTrust = { [cheapest().id]: 80 };
    dropLaunderer(state);
    retainLaunderer(state, cheapest().id);
    expect(laundererTrust(state, cheapest().id)).toBe(0);
  });
});

describe('what it does to the cut', () => {
  it('charges the stranger rate to a family with nobody', () => {
    const state = family();
    state.player.attributes.business = 0;
    expect(launderCut(state)).toBeCloseTo(LAUNDER_CUT_BASE, 5);
  });

  it('charges less the moment somebody is retained', () => {
    const state = family();
    state.player.attributes.business = 0;
    const stranger = launderCut(state);
    retainLaunderer(state, cheapest().id);
    expect(launderCut(state), 'hiring somebody changed nothing').toBeLessThan(stranger);
  });

  it('charges less again for a relationship that has held', () => {
    const state = family();
    state.player.attributes.business = 0;
    retainLaunderer(state, cheapest().id);
    const cold = launderCut(state);
    state.org.laundererTrust = { [cheapest().id]: 100 };
    const warm = launderCut(state);
    expect(warm, 'a year of keeping them is worth nothing').toBeLessThan(cold);
    /*
       Their own best rate, not `LAUNDER_CUT_MIN`.

       That floor is what stops a *stranger* going to nothing on the Business
       attribute alone. A retained arrangement is floored by what that person
       will actually do, which is the whole reason to pay the firm downtown
       rather than the bookkeeper — and it is allowed to be under the stranger
       floor, because a relationship is worth more than a skill.
    */
    expect(warm).toBeCloseTo(cheapest().bestCut, 2);
    expect(LAUNDER_CUT_MIN, 'the stranger floor has stopped being a floor').toBeGreaterThan(0);
  });

  it('never goes below what the best of them will do', () => {
    // The Business attribute buys the rate down on top of the relationship,
    // and the two together must not run away to nothing.
    const state = family();
    state.player.attributes.business = 20;
    for (const l of LAUNDERERS) {
      state.org.launderer = { id: l.id, since: 0 };
      state.org.laundererTrust = { [l.id]: 100 };
      expect(launderCut(state), `${l.id} ended up washing for free`).toBeGreaterThanOrEqual(
        Math.min(...LAUNDERERS.map((x) => x.bestCut)) - 0.001,
      );
    }
  });
});

describe('the relationship itself', () => {
  it('earns trust for a quiet family and none for a loud one', () => {
    /*
       The lever, and the reason this is not just a cheaper number. Heat gates
       the whole discount, so a family drawing attention pays close to the
       headline rate however long they have been dealing — the same rule
       `SUPPLY_TRUST` applies to an arrangement, and for the same measured
       reason: it is the one input a player controls and a bot never does.
    */
    const quiet = family();
    const loud = family();
    for (const s of [quiet, loud]) retainLaunderer(s, cheapest().id);
    loud.org.heat = LAUNDER_TRUST.heatCeiling + 10;

    for (let d = 0; d < 120; d++) {
      quiet.org.heat = 0;
      loud.org.heat = LAUNDER_TRUST.heatCeiling + 10;
      advanceDay(quiet);
      advanceDay(loud);
    }
    expect(laundererTrust(quiet, cheapest().id), 'four months of quiet earned nothing')
      .toBeGreaterThan(50);
    expect(
      laundererTrust(loud, cheapest().id),
      'a family at maximum attention is being given the good rate',
    ).toBe(0);
  });

  it('lets a kept relationship hold where a new one would not', () => {
    const state = family();
    retainLaunderer(state, cheapest().id);
    const cold = laundererWalkChance(state, cheapest());
    state.org.laundererTrust = { [cheapest().id]: 100 };
    expect(laundererWalkChance(state, cheapest())).toBeLessThan(cold);
  });

  it('charges the fee every week, moving or not', () => {
    const state = family();
    state.org.dirtyCash = 0;
    retainLaunderer(state, cheapest().id);
    const before = totalFunds(state);
    for (let d = 0; d < 15 && !state.gameOver; d++) advanceDay(state);
    expect(
      totalFunds(state),
      'two weeks with somebody on a retainer and nothing was ever charged',
    ).toBeLessThan(before);
  });
});
