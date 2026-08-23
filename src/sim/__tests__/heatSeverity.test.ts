/**
 * The three colours a heat reading is allowed to be.
 *
 * The gauge on the Overview draws twenty segments and has to colour each one.
 * The temptation is to hardcode the thirds — under 33 green, under 66 amber,
 * red above — which would look right and mean nothing, because the game's own
 * bands are 0-10, 11-25, 26-40, 41-60, 61-80, 81-92, 93-100 and none of the
 * thirds falls on one of those edges. A scale whose colours change in the
 * middle of a band tells the player a boundary exists where there is none.
 *
 * So severity is derived from `HEAT_TIERS` and the tests below assert the
 * relationship rather than the numbers. Move a tier edge in the config and
 * these still pass; hardcode a third and the first test fails.
 *
 * The one number that is pinned is 41, and it is pinned because the interface
 * was already using it before the gauge existed: the stat bar reddens at
 * `heat > 40` and the old bar flipped tone at the same place. Two components
 * disagreeing about when heat is bad is worse than either threshold being
 * wrong.
 */
import { describe, expect, it } from 'vitest';

import { HEAT_TIERS, heatSeverity, heatTier } from '../../config/heat';

describe('heat severity', () => {
  it('changes only on a tier boundary', () => {
    /*
       Walk every whole reading and record where the colour changes. Each of
       those points must also be the first reading of some tier. This is the
       check that fails if anybody replaces the mapping with thirds.
    */
    const changes: number[] = [];
    for (let v = 1; v <= 100; v++) {
      if (heatSeverity(v) !== heatSeverity(v - 1)) changes.push(v);
    }

    const tierFloors = HEAT_TIERS.map((t) => t.min);
    const offEdge = changes.filter((v) => !tierFloors.includes(v));

    expect(
      offEdge,
      `severity changes at ${offEdge.join(', ')}, which is inside a tier. ` +
        `A gauge that changes colour mid-band invents a boundary the ` +
        `simulation does not have.`,
    ).toEqual([]);
    expect(changes.length, 'severity never changes, so the gauge is one colour').toBeGreaterThan(0);
  });

  it('agrees with the threshold the rest of the interface already uses', () => {
    // The stat bar reddens above 40. The gauge has to redden in the same place.
    expect(heatSeverity(40)).not.toBe('hot');
    expect(heatSeverity(41)).toBe('hot');
  });

  it('uses all three severities, and never skips one on the way up', () => {
    const seen = [...new Set(Array.from({ length: 101 }, (_, v) => heatSeverity(v)))];
    expect(seen, 'a severity nothing can reach is a colour nobody sees').toEqual([
      'ok',
      'warn',
      'hot',
    ]);
  });

  it('never goes back down as heat rises', () => {
    const rank = { ok: 0, warn: 1, hot: 2 } as const;
    for (let v = 1; v <= 100; v++) {
      expect(
        rank[heatSeverity(v)],
        `heat ${v} is less severe than ${v - 1}, in tier "${heatTier(v).name}"`,
      ).toBeGreaterThanOrEqual(rank[heatSeverity(v - 1)]);
    }
  });

  it('holds at the very top, where heat clamps', () => {
    // `org.heat` clamps at 100, and readings arrive as floats.
    expect(heatSeverity(100)).toBe('hot');
    expect(heatSeverity(99.6)).toBe('hot');
    expect(heatSeverity(0)).toBe('ok');
  });
});
