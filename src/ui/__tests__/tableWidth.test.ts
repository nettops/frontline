/**
 * One cell was eating the Businesses table.
 *
 * Two round-17 scorers reported that panel scrolling sideways at 1600px, and
 * iteration 8 had already looked at the same overflow, measured it, and
 * recorded the horizontal wrap as a deliberate decision. Both were right about
 * different things.
 *
 * Measured in Chromium at 1600x1000 on a fresh career, the "Arrangement" column
 * was **1076px of a 1463px table** — 74% of the width — beside three columns of
 * 33 to 41px, putting the panel 135px into scroll. The cause was not which
 * columns earn their place. `.name-cell` is `white-space: nowrap` because a
 * name broken over two lines reads as two people; the sub-line inside it
 * inherited that, and on this table the sub-line is a whole sentence of blurb.
 *
 * Letting the sub-line wrap took the table to 790px, gave the crushed numeric
 * columns their width back — "Takes now" 41 to 72, "They walk" 33 to 72 — and
 * left every one of the fourteen panels at zero overflow.
 *
 * This test guards the rule rather than the measurement, because the
 * measurement needs a browser and this suite does not have one: a name may not
 * wrap, and what is said about it must be allowed to.
 */
import { describe, expect, it } from 'vitest';
/*
   `?raw`, with `css: true` on the unit project in `vitest.workspace.ts`.

   Vitest stubs every CSS import to an empty string by default, `?raw`
   included, so the first version of this file asserted against nothing — and
   was caught by its own instrument guard, which is the only reason that guard
   is here.
*/
import css from '../../styles/theme.css?raw';

/** One rule block, by selector, with its comments stripped. */
function rule(selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const at = bare.indexOf(`${selector} {`);
  if (at === -1) return '';
  return bare.slice(at, bare.indexOf('}', at));
}

describe('a name and what is said about it', () => {
  it('is reading the stylesheet it asserts about', () => {
    expect(css.length).toBeGreaterThan(1000);
    expect(rule('.name-cell')).toContain('white-space');
  });

  /**
   * The half that must not change. A name broken across two lines reads as two
   * people, and every table in the game leans on that.
   */
  it('keeps names on one line', () => {
    expect(rule('.name-cell')).toMatch(/white-space:\s*nowrap/);
  });

  /**
   * And the half that was the fault. The sub-line carries descriptions, not
   * names, and nowrap on a sentence makes the column as wide as the sentence.
   */
  it('lets the line under a name wrap', () => {
    const sub = rule('.name-sub');
    expect(sub, '.name-sub has gone').toBeTruthy();
    expect(
      sub,
      'the sub-line is back to nowrap, so one sentence can set a whole table’s width',
    ).toMatch(/white-space:\s*normal/);
  });

  /** With a ceiling, so a long blurb wraps rather than merely wrapping late. */
  it('caps how wide a description may get before it wraps', () => {
    expect(rule('.name-sub')).toMatch(/max-width:/);
  });
});
