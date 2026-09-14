/**
 * Fifteen tabs, chunked into landmarks.
 *
 * A developer's own Interface playtest (2026-09-09) named a first
 * impression — "a lot of text on every screen, and there are a lot of tabs
 * so it is possible someone could get lost." Confirmed against the source
 * rather than taken on faith: `Rail.tsx`'s `BUILT` list has fifteen entries
 * in career and sandbox mode, one flat column under a single header. No
 * panel moved and no data changed — this only groups the same fifteen
 * buttons under a few section headers, the same `rail-group` mechanism the
 * rail already uses for "Records" below them.
 *
 * A source scan, matching this project's no-jsdom convention: the fix is a
 * data-driven grouping (`entry.section`), so what matters is that the field
 * exists, is actually attached to `BUILT`'s entries, and is read by the
 * render loop to decide when a new header prints — not the exact wording of
 * any one label, which is free to change.
 */
import { describe, expect, it } from 'vitest';
import rail from '../Rail.tsx?raw';

describe('the rail groups its fifteen tabs instead of listing them flat', () => {
  it('carries a section on the BUILT entries', () => {
    expect(rail).toMatch(/section\?:\s*string/);
    expect(rail).toMatch(/section:\s*'The Business'/);
    expect(rail).toMatch(/section:\s*'The City'/);
    expect(rail).toMatch(/section:\s*'The Family'/);
  });

  it('prints a new rail-group header only when the section actually changes', () => {
    expect(rail).toMatch(
      /entry\.section\s*&&\s*entry\.section\s*!==\s*entries\[i\s*-\s*1\]\?\.section/,
    );
  });

  it('leaves the watching-mode header alone — five items was never the complaint', () => {
    expect(rail).toMatch(/watching\s*&&\s*<div className="rail-group">The City<\/div>/);
  });
});
