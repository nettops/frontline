/**
 * What the organization makes go away, against what it makes.
 *
 * NOTE: the trades no longer pay into this channel — see `TradeDef.heatChannel`.
 * What follows is still the true shape of the apparatus and still the reason
 * anything paying into `street` continuously becomes free above twelve people;
 * the figures below use the product trade's rate as a familiar yardstick, not
 * as a claim about where product's attention now lands.
 *
 * `HEAT_ABSORPTION` exists for a good reason and was measured carefully: heat
 * removed per day was a constant while heat generated per day rose with the
 * number of people working, so no family could grow past the size at which the
 * two met — measured at three, and not one career in twelve reached Capo.
 *
 * What was never measured is the other end. The figures are absolute — a flat
 * subsidy per head per day — and nothing compared them to what an outfit is
 * actually producing. A blind tester ran product and arms through five
 * districts at $177,143 a week for 348 days and finished a 481-day career at a
 * total heat of 7 out of 100, three of it from the street. The trade made 2.4
 * a week; his sixteen men took away 16.8, seven times more, every week, before
 * the proportional decay ran at all.
 *
 * The ratio is structural, not a number set wrong. Trade throughput is capped
 * by *ground* — the routes a family holds — while the apparatus grows with the
 * *payroll*, so past a certain size every man hired removes more than the
 * trade he enables can produce, and the largest families in the game are the
 * quietest.
 *
 * **This file holds the fault open. It does not guard a repair, because there
 * is not one.** A cap against a rolling week of arrivals was built and backed
 * out: no setting of it cleared both gates, and the probe's readings were not
 * monotonic in the setting — see the note in `config/heat.ts`. So the
 * assertions below describe what the game does today and go red the moment
 * somebody changes it, which is the point. Whoever makes them fail should
 * delete them and write the guard.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { addHeat, tickHeat } from '../heat';
import { HEAT_ABSORPTION, QUIET_DAYS_BEFORE_DECAY } from '../../config/heat';
import { TRADES } from '../../config/contraband';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Heat', difficulty: 'normal', seed });
}

/** A payroll of `count`, which is what the apparatus is a function of. */
function payroll(state: GameState, count: number): void {
  const source = Object.values(state.npcs).find((n) => n.status === 'active');
  if (!source) throw new Error('a career starts with somebody; this one did not');
  let n = 0;
  while (Object.values(state.npcs).filter((x) => x.status === 'active').length < count) {
    const copy: Npc = { ...source, id: `hand-${n++}`, name: `Hand ${n}`, status: 'active' };
    state.npcs[copy.id] = copy;
  }
}

/**
 * Where street heat settles for a family of `hands` taking `perWeek` a week.
 *
 * Runs the real tick rather than restating its arithmetic, because the thing
 * under test is an interaction between three terms in it.
 */
function settles(hands: number, perWeek: number, days = 700): number {
  const state = game();
  payroll(state, hands);
  state.org.quietDays = QUIET_DAYS_BEFORE_DECAY;
  for (let day = 1; day <= days; day++) {
    state.day = day;
    if (day % 7 === 0 && perWeek > 0) addHeat(state, perWeek, 'street', 'the trade');
    tickHeat(state);
  }
  return state.org.heatBy.street;
}

describe('the apparatus', () => {
  it('says what it removes against what a family makes', () => {
    // The instrument. A standing trade at the volume a real career reached:
    // five districts of product, roughly fifteen loads a week.
    const perWeek = 15 * TRADES.product.heatPerUnit;
    const rows = [4, 8, 12, 16, 24, 32].map((hands) => {
      const apparatus = Math.max(0, hands - HEAT_ABSORPTION.fromCrew);
      const flat = Math.min(HEAT_ABSORPTION.max, apparatus * HEAT_ABSORPTION.perCrew) * 7;
      return { hands, flat, settled: settles(hands, perWeek) };
    });

    // eslint-disable-next-line no-console
    console.log(
      `a standing trade making ${perWeek.toFixed(1)} street heat a week\n` +
        rows
          .map(
            (r) =>
              `        ${String(r.hands).padStart(2)} hands · apparatus would take ` +
              `${r.flat.toFixed(1)}/wk flat · street heat settles at ${r.settled.toFixed(1)}`,
          )
          .join('\n'),
    );

    /*
       The two properties that ought to hold and do not.

       A family generating attention continuously should not end up quieter
       than one generating none, and hiring should not be a way to make a
       standing operation invisible. Both are false above twelve people, and
       these assert the falsehood so that fixing it is loud.
    */
    const idle = settles(16, 0);
    expect(idle, 'an outfit doing nothing has street heat, so the fixture is wrong').toBe(0);
    for (const row of rows.filter((r) => r.hands >= 16)) {
      expect(
        row.settled,
        `${row.hands} hands running a trade no longer settle at nothing — the ` +
          `apparatus has been fixed, and this file should now guard the repair ` +
          `rather than record the fault`,
      ).toBe(0);
    }

    // And the shape of it. Four hands buy no apparatus at all and pay the
    // full price; twelve are nearly exempt; sixteen are exempt outright. The
    // trade costs attention only to the outfits too small to have one.
    expect(rows[0].settled, 'four hands').toBeGreaterThan(10);
    expect(rows[2].settled, 'twelve hands').toBeLessThan(1);
  });

  /*
   * And the repair, which is not to the apparatus.
   *
   * Capping the apparatus was measured against the paired sweep in
   * `ladder.probe` and costs twelve seeds of thirty-six their Boss career. So
   * the trades pay into `money` instead, where nothing absorbs, paper decays
   * slower than the street, and laying low does not help — which is also what
   * the law actually sees in a standing trade. This is the guard on that:
   * neither trade may quietly go back to the channel the apparatus eats.
   */
  it('is not where a standing trade pays any more', () => {
    for (const trade of ['product', 'arms'] as const) {
      expect(
        TRADES[trade].heatChannel,
        `${trade} pays into the channel the apparatus absorbs, so its attention is free`,
      ).not.toBe(HEAT_ABSORPTION.channel);
    }

    // And the effect, end to end: the same weekly attention that settles at
    // nothing on the street settles somewhere a player can see it.
    const perWeek = 15 * TRADES.product.heatPerUnit;
    const onTheStreet = settles(16, perWeek);
    const state = game();
    payroll(state, 16);
    state.org.quietDays = QUIET_DAYS_BEFORE_DECAY;
    for (let day = 1; day <= 700; day++) {
      state.day = day;
      if (day % 7 === 0) addHeat(state, perWeek, TRADES.product.heatChannel, 'the trade');
      tickHeat(state);
    }
    const onPaper = state.org.heatBy[TRADES.product.heatChannel];

    // eslint-disable-next-line no-console
    console.log(
      `the same ${perWeek.toFixed(1)} a week, sixteen hands:\n` +
        `        into the street: settles at ${onTheStreet.toFixed(1)}\n` +
        `        into the books:  settles at ${onPaper.toFixed(1)}`,
    );

    expect(onTheStreet).toBe(0);
    expect(
      onPaper,
      'a standing trade is still invisible in its own channel',
    ).toBeGreaterThan(10);
  });

  it('grows with the payroll, which is the whole reason it exists', () => {
    // Not a fault. This is the property the absorption was built for and it
    // still holds — heat removed rises with the number of people, which is
    // what stopped the economy walling at three men. Any repair to the cap
    // above has to keep this true.
    const busy = 6 * TRADES.product.heatPerUnit * 7;
    const small = settles(6, busy);
    const large = settles(30, busy);
    expect(large, 'a big outfit sheds no more than a small one').toBeLessThan(small);
  });
});
