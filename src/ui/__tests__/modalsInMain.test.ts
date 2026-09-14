/**
 * Modals live inside `<main>`, not beside it.
 *
 * Round 28's blind report named a modal-content blind spot ("modal/dialog
 * content is not exposed to standard page-text extraction") and, separately
 * and more concretely, watched an already-repaired hint fail to register a
 * second time — `events.ts`'s `plea_offer` already says "They do not think
 * enough of you for it to hold" when the option cannot land, for exactly
 * this complaint from an earlier round, but a text-extraction tool that
 * reads `<main>` first cannot see a memo choice's hint if the memo renders
 * as `<main>`'s sibling rather than its child.
 *
 * Both `MemoModal` and `SitdownModal` are `position: fixed; inset: 0`
 * overlays (`.memo-backdrop`, `.room-backdrop` in `theme.css`), so where they
 * sit in the DOM has never affected how or where they render on screen —
 * only what a reader scoped to the main landmark can see. `role="dialog"`
 * and `aria-modal="true"` already make them correct for a real screen
 * reader regardless of DOM position; this is about a cruder, main-only
 * reader, human or automated.
 *
 * A source scan, matching this project's no-jsdom convention: what matters
 * is that both modals are mounted between `<main>`'s open and close tags.
 */
import { describe, expect, it } from 'vitest';
import app from '../App.tsx?raw';

describe('the memo and sit-down modals render inside <main>', () => {
  it('mounts MemoModal and SitdownModal before </main> closes, not after', () => {
    const mainOpen = app.indexOf('<main');
    const mainClose = app.indexOf('</main>');
    const memo = app.indexOf('<MemoModal');
    const sitdown = app.indexOf('<SitdownModal');

    expect(mainOpen, 'the main element is gone').toBeGreaterThan(-1);
    expect(mainClose, 'main never closes').toBeGreaterThan(mainOpen);
    expect(memo, 'MemoModal is gone').toBeGreaterThan(mainOpen);
    expect(sitdown, 'SitdownModal is gone').toBeGreaterThan(mainOpen);

    expect(memo, 'MemoModal renders outside <main> again').toBeLessThan(mainClose);
    expect(sitdown, 'SitdownModal renders outside <main> again').toBeLessThan(mainClose);
  });
});
