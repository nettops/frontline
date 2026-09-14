/**
 * The Ledger verb's one target, reachable.
 *
 * `RivalBusinesses` is the panel half of `RivalBusiness` — see the sim-level
 * doc comment in `sim/types.ts`. A source scan, matching this project's
 * no-jsdom convention: what matters is that the component reads
 * `rivalBusinessRead`, gates on the same intel line the investment itself
 * becomes visible behind, and offers `buyIn` on each row — not the exact
 * markup, which is free to change.
 */
import { describe, expect, it } from 'vitest';
import panel from '../panels/RivalsPanel.tsx?raw';

describe('the rival businesses section', () => {
  it('reads the ledger of rival fronts', () => {
    expect(panel).toMatch(/rivalBusinessRead\(state\)/);
  });

  it('gates on the same closeness a rival’s own investment is seen through', () => {
    expect(panel).toMatch(/if \(intel < FACTION_INTEL_ROUGH_ABOVE\) return null;/);
  });

  it('offers to buy in, gated on the real check', () => {
    expect(panel).toMatch(/canBuyIn\(state, b\.id\)/);
    expect(panel).toMatch(/buyIn\(s, b\.id\)/);
  });

  it('is mounted under a rival’s own page', () => {
    expect(panel).toMatch(/<RivalBusinesses faction={faction} intel={read\.intel} \/>/);
  });
});
