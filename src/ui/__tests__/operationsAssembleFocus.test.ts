/**
 * Opening a job on the busiest screen in the game.
 *
 * `OperationsPanel` runs nine open jobs, an eight-district picker, a full
 * crew table and a fourteen-row locked table around the one panel a click
 * actually opens. Confirmed live: clicking a job leaves the viewport
 * exactly where it was, with "Assemble" rendered off-screen below the open
 * table and, before this fix, the entire locked table still rendered below
 * that. The click worked; nothing said so — the same defect round 24 found
 * and fixed in `CrewPanel` and `RivalsPanel` (`detailRef` +
 * `scrollIntoView`), just never carried over to this panel.
 *
 * A source scan, matching this project's no-jsdom convention: what matters
 * is that the same mechanism is wired up, and that the locked table is
 * gated on the same selection state that opens the assemble panel.
 */
import { describe, expect, it } from 'vitest';
import operations from '../panels/OperationsPanel.tsx?raw';

describe('the assemble panel scrolls into view and the noise around it clears', () => {
  it('carries the same detailRef/scrollIntoView fix as CrewPanel and RivalsPanel', () => {
    expect(operations).toMatch(/const detailRef = useRef<HTMLDivElement>\(null\)/);
    expect(operations).toMatch(
      /detailRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/,
    );
    expect(operations).toMatch(/<div ref={detailRef}>/);
  });

  it('hides the locked-jobs table while a job is actually being assembled', () => {
    expect(operations).toMatch(/\{locked\.length > 0 && !def && \(/);
  });
});

/*
   A row that read exactly as clickable once the crew was full as it did
   with a seat open — same class, same cursor, no title — and clicking it
   silently did nothing (`toggleCrew` already returned `prev` unchanged).
   Found in a 2026-09-10 audit as the one Section-18-style "looks live, is
   dead" control in this codebase. The row now drops its clickable styling
   and names the reason once the crew is full.
*/
describe('a full crew stops looking like an open one', () => {
  it('withholds the clickable class and onClick once the crew is full', () => {
    expect(operations).toMatch(/const full = !picked && needed > 0 && crewPicked\.length >= needed/);
    expect(operations).toMatch(/className=\{picked \? 'clickable selected' : full \? 'dim' : 'clickable'\}/);
    expect(operations).toMatch(/onClick=\{full \? undefined : \(\) => toggleCrew\(npc\.id\)\}/);
  });
});
