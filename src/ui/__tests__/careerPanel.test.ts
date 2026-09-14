/**
 * A career panel that is actually reachable.
 *
 * `sim/career.ts` keeps the curated chapter list; this checks the other
 * half — that a panel renders it oldest-first with the established
 * tone/date convention, and that the rail and the app switch actually
 * offer it. A source scan, matching this project's no-jsdom convention.
 */
import { describe, expect, it } from 'vitest';
import panel from '../panels/CareerPanel.tsx?raw';
import rail from '../Rail.tsx?raw';
import app from '../App.tsx?raw';

describe('the career panel', () => {
  it('reads the curated list, not the rotating log', () => {
    expect(panel).toMatch(/career\(state\)/);
  });

  it('colors a chapter by its tone, the same convention succession uses', () => {
    expect(panel).toMatch(/c\.tone === 'bad'/);
    expect(panel).toMatch(/c\.tone === 'good'/);
  });
});

describe('the rail offers it', () => {
  it('adds career to the panel id union', () => {
    expect(rail).toMatch(/\|\s*'career'/);
  });

  it('only while somebody has a career — not in watching mode', () => {
    expect(rail).toMatch(/if \(!watching\) ids\.push\('career'\)/);
    expect(rail).toMatch(/\{!watching && \(\s*<button/);
  });
});

describe('the app switches to it', () => {
  it('renders CareerPanel when the career panel is shown', () => {
    expect(app).toMatch(/shown === 'career' && <CareerPanel \/>/);
  });
});
