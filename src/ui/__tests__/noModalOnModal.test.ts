/**
 * Two full-screen overlays, never both live at once.
 *
 * Section 30 of the 2026-09-10 polish pass asks for exactly this edge case
 * verified: a memo and a sit-down room stacking on top of each other. It
 * cannot happen through the two guards that already exist for unrelated
 * reasons, checked here so a future edit cannot remove either without this
 * failing:
 *
 *  - `step()` refuses to advance the day at all while `state.sitdown` is
 *    open — a conversation stops the clock the same way a memo does. Every
 *    `pushEvent` call site in `sim/` fires from inside `advanceDay`'s own
 *    tick pipeline (`events.ts`, `faction.ts`, `investigation.ts`, `npc.ts`,
 *    `succession.ts`, `world.ts` — none of them reachable from a sit-down's
 *    own action handlers), so a day that cannot advance cannot raise a new
 *    memo either.
 *  - `.memo-backdrop` is `position: fixed; inset: 0; z-index: 50` with no
 *    `pointer-events: none` — a real screen-covering overlay, so nothing
 *    underneath it, including a button that would open a sit-down, can be
 *    clicked while a memo is showing.
 *
 * A source scan for the first guard, matching this project's no-jsdom
 * convention; the CSS assertion for the second reads the actual stylesheet
 * rather than trusting a class name.
 */
import { describe, expect, it } from 'vitest';
import app from '../App.tsx?raw';
import css from '../../styles/theme.css?raw';

describe('a sit-down blocks the day from advancing', () => {
  it('refuses to step the clock while a room is open', () => {
    const start = app.indexOf('const step = useCallback');
    expect(start, 'step() is gone').toBeGreaterThan(-1);
    const end = app.indexOf('}, []);', start);
    expect(end, 'step() never closes').toBeGreaterThan(start);
    expect(app.slice(start, end)).toMatch(/if \(s\.sitdown\) return;/);
  });
});

describe('a memo blocks everything under it', () => {
  it('the backdrop is a real full-screen overlay, not decoration', () => {
    const start = css.indexOf('.memo-backdrop {');
    expect(start, 'the rule is gone').toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/inset:\s*0/);
    expect(rule).not.toMatch(/pointer-events:\s*none/);
  });
});
