/**
 * The case-strength breakdown, reachable.
 *
 * `CaseRead.growth` is the sim half — see `sim/investigation.ts`'s doc
 * comment on `Investigation.lastGrowth`. A source scan, matching this
 * project's no-jsdom convention: what matters is that the panel reads the
 * three named terms and renders them only when present, not the exact
 * markup or wording, which is free to change.
 */
import { describe, expect, it } from 'vitest';
import panel from '../panels/LawPanel.tsx?raw';

describe('the case-strength breakdown', () => {
  it('reads the itemized reading rather than inventing its own', () => {
    expect(panel).toMatch(/read\.growth/);
  });

  it('names all three causal terms', () => {
    expect(panel).toMatch(/read\.growth\.absorbed/);
    expect(panel).toMatch(/read\.growth\.work/);
    expect(panel).toMatch(/read\.growth\.visibility/);
  });

  it('says nothing when there is nothing to say', () => {
    expect(panel).toMatch(/read\.growth &&\s*\n\s*\(read\.growth\.absorbed > 0/);
  });
});
