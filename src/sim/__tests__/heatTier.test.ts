/**
 * Every reading between 0 and 100 lands in a tier, including the fractional ones.
 *
 * `org.heat` is a sum of three floating channels, and the tier table is written
 * in whole numbers. The old lookup required `heat >= min && heat <= max`, so
 * 10.4 and 25.6 and 40.2 matched nothing and fell through to a default of
 * *Quiet* — the bottom of the scale — which made the log announce that
 * attention had risen to Quiet on a day the panel said Investigating.
 *
 * Found by a blind tester reading their own log, not by any of the two hundred
 * tests that were already here, because every one of them used whole numbers.
 */
import { describe, expect, it } from 'vitest';

import { HEAT_TIERS, heatTier } from '../../config/heat';

describe('heat tiers', () => {
  it('never falls through to the bottom of the scale', () => {
    const wrong: string[] = [];
    for (let h = 0; h <= 100; h += 0.1) {
      const tier = heatTier(h);
      if (h > tier.max + 1 || h < tier.min) wrong.push(`${h.toFixed(1)} -> ${tier.name}`);
    }
    expect(wrong).toEqual([]);
  });

  it('rises monotonically across the whole range', () => {
    let last = -1;
    for (let h = 0; h <= 100; h += 0.1) {
      const index = HEAT_TIERS.indexOf(heatTier(h));
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it('puts the boundaries where the table says', () => {
    expect(heatTier(0).name).toBe(HEAT_TIERS[0].name);
    expect(heatTier(100).name).toBe(HEAT_TIERS[HEAT_TIERS.length - 1].name);
    for (const t of HEAT_TIERS) expect(heatTier(t.min).name).toBe(t.name);
  });
});
