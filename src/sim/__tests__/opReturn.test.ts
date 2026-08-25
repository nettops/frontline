/**
 * The job table's return on capital, tier by tier.
 *
 * The header of `config/operations.ts` states one rule — capital buys
 * efficiency — and measures it as expected money per crew per day. That rule
 * holds and `broke.probe.test.ts` guards it. This file guards a second axis
 * the header never named, and which measurement found running the wrong way.
 *
 * Return on stake is `mean payout * odds / investment`: how much capital comes
 * back for capital put in. Across 12 careers it *fell* as the player climbed —
 * a paid mean of 4.7x among street work against 1.9x at Boss. The table
 * punished ambition in the one currency ambition is made of, and the jobs at
 * the top returned a third as much on the money as the burglary that opens the
 * game.
 *
 * That mattered because rank is gated on a *stock* of clean money — $130,000
 * for Underboss, $420,000 for Boss — and clean money is washed out of the
 * surplus left after each job is re-staked. A falling return means a thinner
 * surplus every rung, so the ladder tightened exactly where it was supposed to
 * open up. Measured: 24 careers reached Crew Leader or Capo, none went higher,
 * and the five jobs above Capo were rank-shut on 100% of 3,600 days.
 *
 * The street tier is exempt from the rising curve and only has to hold its
 * floor. Its stakes are $150 to $800, and the header of `operations.ts`
 * explains at length why the bottom of the table protects a broke player.
 * Raising those numbers to make the curve tidy would take that protection away,
 * so the curve is built by cutting stakes above the street instead.
 */

import { describe, expect, it } from 'vitest';

import { OPERATIONS } from '../../config/operations';
import type { OperationDef } from '../types';

/** Capital back per capital in. Free jobs have no stake and no ratio. */
function returnOnStake(o: OperationDef): number {
  const mean = (o.payout[0] + o.payout[1]) / 2;
  return (mean * o.baseSuccess) / o.investment;
}

const paid = (tier: number) => OPERATIONS.filter((o) => o.tier === tier && o.investment > 0);

/** Tiers that actually carry a paid job, lowest first. */
const tiers = [...new Set(OPERATIONS.map((o) => o.tier))]
  .sort((a, b) => a - b)
  .filter((t) => paid(t).length > 0);

const meanReturn = (tier: number) => {
  const xs = paid(tier).map(returnOnStake);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

describe('return on stake rises with the tier', () => {
  it('every rank above the street returns more on capital than the one below', () => {
    const above = tiers.filter((t) => t !== 0);
    for (let i = 1; i < above.length; i++) {
      const now = meanReturn(above[i]);
      const before = meanReturn(above[i - 1]);
      expect(
        now,
        `${above[i]} returns ${now.toFixed(1)}x, below ${above[i - 1]} at ${before.toFixed(1)}x`,
      ).toBeGreaterThan(before);
    }
  });

  it('the top of the ladder beats the street it grew out of', () => {
    const top = meanReturn(tiers[tiers.length - 1]);
    const street = meanReturn(0);
    expect(
      top,
      `top tier ${top.toFixed(1)}x against street ${street.toFixed(1)}x`,
    ).toBeGreaterThan(street);
  });

  it('no paid job returns less than its own stake', () => {
    for (const o of OPERATIONS.filter((x) => x.investment > 0)) {
      expect(returnOnStake(o), `${o.name} returns ${returnOnStake(o).toFixed(2)}x`).toBeGreaterThan(1);
    }
  });
});
