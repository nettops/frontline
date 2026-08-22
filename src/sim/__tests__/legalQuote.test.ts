/**
 * A tier has to be priced at the point you choose it.
 *
 * The representation picker showed only "×2.6 retainer" and a single total in
 * the page header. Round 11 selected the local attorney on day 30 reading
 * "$381 / WEEK IN LEGAL", and read "$1,058" for the same unchanged tier on day
 * 60 — because the bill scales with how many agencies have a case open and how
 * serious the worst one is, which is correct behaviour and was disclosed
 * nowhere.
 *
 * So the picker can quote each tier against today's board.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { legalCostAt, weeklyLegalCost } from '../investigation';
import { LAWYERS } from '../../config/lawEnforcement';

describe('the retainer quote', () => {
  it('prices every tier against the cases open right now', () => {
    const state = newGame({ name: 'Legal', difficulty: 'normal', seed: 6 });

    for (const lawyer of LAWYERS) {
      const quoted = legalCostAt(state, lawyer.level);
      if (lawyer.costMultiplier === 0) expect(quoted).toBe(0);
      else expect(quoted).toBeGreaterThan(0);
    }
  });

  it('agrees with the bill actually charged for the tier in force', () => {
    const state = newGame({ name: 'Legal', difficulty: 'normal', seed: 6 });

    for (const lawyer of LAWYERS) {
      state.law.lawyer = lawyer.level;
      expect(legalCostAt(state, lawyer.level)).toBe(weeklyLegalCost(state));
    }
  });

  it('rises with the tier, so the ordering on screen is honest', () => {
    const state = newGame({ name: 'Legal', difficulty: 'normal', seed: 6 });
    const quotes = LAWYERS.map((l) => legalCostAt(state, l.level));

    for (let i = 1; i < quotes.length; i++) {
      expect(quotes[i]).toBeGreaterThanOrEqual(quotes[i - 1]);
    }
  });
});
