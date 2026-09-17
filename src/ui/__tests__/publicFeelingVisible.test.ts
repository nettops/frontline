/**
 * The Territory sheet's own header comment names this exact fault: a round-7
 * tester watched Public feeling fall 45 -> 5, was refused every business in
 * Little Sicily for ninety days, and never learned why -- "the row was a bare
 * integer with no label and no log line ever mentioned it moving." The label
 * was added. The explanation was not: it stayed a `title` attribute, a
 * hover-only tooltip nobody reads unless they already suspect where to look.
 * A second blind round hit the same thing from the other side -- discovered
 * only when a front purchase was refused, traced backward through the log.
 *
 * `OperationsPanel.tsx` already solved this for the job-assembly screen with
 * `sentimentOutlook`, itself modeled on the heat line above the district
 * picker, per its own comment: "One sentence in the place the decision is
 * made beats a page that explains the system." This is that same sentence,
 * moved onto the page here too.
 */
import { describe, expect, it } from 'vitest';
import territoryPanel from '../panels/TerritoryPanel.tsx?raw';

describe('public feeling explains itself on the page, not on hover', () => {
  it('reads the same sentimentOutlook the job-assembly screen already uses', () => {
    expect(territoryPanel).toContain('sentimentOutlook');
  });

  it('renders it as visible body text near the Public feeling row, not only a title', () => {
    const at = territoryPanel.indexOf('Public feeling');
    expect(at, 'the row is gone or renamed').toBeGreaterThan(-1);
    // sentimentOutlook must appear close to the row it explains, in JSX body
    // position (a <p> or similar), not buried a screen away.
    const nearby = territoryPanel.slice(at, at + 800);
    expect(nearby).toMatch(/<p[^>]*>\s*\{sentimentOutlook\(/);
  });
});
