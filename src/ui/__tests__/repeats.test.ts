/**
 * The same refusal, said once.
 *
 * Round 30: the Businesses list printed "Little Sicily only has room for 1
 * front, and it is yours..." on every row in that district, ten times down the
 * table. Four earlier repairs had moved that sentence onto each row on purpose
 * (`refusalShown.test.ts` pins it to the cell holding the button), because a
 * reason in a tooltip is a reason nobody reads. So the row keeps a reason, and a
 * row that would only repeat the one above it points at that one instead.
 */
import { describe, expect, it } from 'vitest';
import { firstWithSameReason } from '../repeats';
import businesses from '../panels/BusinessesPanel.tsx?raw';

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const flat = (src: string): string => code(src).replace(/\s+/g, ' ');

describe('which row already said it', () => {
  it('points a repeat at the first row that said the same thing', () => {
    expect(firstWithSameReason(['a', 'b', 'a', 'a', 'b'])).toEqual([null, null, 0, 0, 1]);
  });

  it('never points at a row that had nothing to say', () => {
    expect(firstWithSameReason([undefined, 'a', undefined, 'a'])).toEqual([null, null, null, 1]);
  });

  it('treats a different sentence as a different reason', () => {
    expect(firstWithSameReason(['Needs control in A.', 'Needs control in B.'])).toEqual([null, null]);
  });

  it('is empty for an empty list', () => {
    expect(firstWithSameReason([])).toEqual([]);
  });
});

describe('the buy list says each refusal once and still says it on the row', () => {
  const PANEL = flat(businesses);

  it('reads the pointer from the helper', () => {
    expect(PANEL).toMatch(/firstWithSameReason\(/);
    expect(PANEL).toMatch(/Same reason as the \{/);
  });

  it('still prints the reason itself in the cell that holds the button', () => {
    const cell = /See the \{def\.name\}[\s\S]*?<\/td>/.exec(PANEL);
    expect(cell).not.toBeNull();
    expect(/\{check\.reason\}/.test(cell?.[0] ?? '')).toBe(true);
  });
});
