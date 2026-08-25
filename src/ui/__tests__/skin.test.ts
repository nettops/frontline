/**
 * The terminal skin is parked, and parked means not shipped.
 *
 * `styles/crt.css` and `ui/skin.ts` are a built prototype nobody has approved.
 * They stay on disk so the work is not lost, and they stay out of the bundle
 * so no player can reach them. Those two facts have to hold together: a parked
 * prototype that is still imported is not parked, it is shipped with the
 * switch hidden.
 *
 * That is the shape of the bug this guards. The toggle was removed once from
 * the stat bar and left on the title screen, and a player who turned it on had
 * no way back — the comment above `SkinToggle` records that afternoon. Deleting
 * one of two call sites is exactly the mistake a grep-and-delete makes, so the
 * check walks every source file rather than the two anybody remembers.
 *
 * If the CRT is ever approved, this file is the thing that fails first, and
 * the failure message says what to do.
 */
import { describe, expect, it } from 'vitest';

/*
   Every source file, read as text — the same idiom `voice.test.ts` uses, and
   for the same reason: a hand-written list of files to check is how a guard
   ends up guarding the wrong thing.
*/
const sources = import.meta.glob('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/*
   Vite shortens every glob key to the shortest relative path, so this file's
   own siblings come back as `./skin.test.ts` and `../skin.ts` rather than the
   `../../ui/...` the pattern suggests. Both helpers below were written against
   the pattern instead of against the output, and both were wrong: the tidy
   printed raw keys, and the test-file filter matched on `__tests__`, which is
   in none of the shortened keys — so this file, which necessarily contains the
   word SkinToggle, reported itself as an offender.
*/
function tidy(key: string): string {
  const parts = 'src/ui/__tests__'.split('/');
  for (const seg of key.split('/')) {
    if (seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/** A test file, by name rather than by folder. See the note above. */
const isTest = (key: string) => /\.test\.tsx?$/.test(key);

describe('the terminal skin stays parked', () => {
  it('is not offered anywhere in the interface', () => {
    const offenders = Object.entries(sources)
      .filter(([key]) => !isTest(key))
      .filter(([, src]) => src.includes('SkinToggle'))
      .map(([key]) => tidy(key));

    expect(
      offenders,
      `SkinToggle is back in ${offenders.join(', ')}. The skin switch was removed ` +
        `on purpose; putting it back needs the crt.css import restored too, or it ` +
        `toggles an attribute nothing reads.`,
    ).toEqual([]);
  });

  it('is not in the bundle', () => {
    /*
       Vite only emits a module something imports. So the single fact that
       keeps 435 lines of CRT out of the shipped CSS is that no file names it.
    */
    const importers = Object.entries(sources)
      /*
         An import, not a mention. `skin.ts` names crt.css in its own header
         comment to say where the parked half lives, and that sentence is worth
         keeping — a bare /crt\.css/ reported it as an importer and would have
         been "fixed" by deleting the only signpost to the prototype.
      */
      .filter(([, src]) => /\bfrom\s*['"][^'"]*crt\.css['"]|\bimport\s*['"][^'"]*crt\.css['"]/.test(src))
      .map(([key]) => tidy(key));

    expect(
      importers,
      `crt.css is imported by ${importers.join(', ')}, which ships the parked ` +
        `prototype to every player. It is meant to sit on disk unreferenced ` +
        `until somebody approves it.`,
    ).toEqual([]);
  });

  it('still has its prototype on disk, unreferenced', () => {
    /*
       The other half of the invariant, and the reason this is not simply a
       delete. Losing the file would be a quiet regression the two checks above
       would happily report as a pass.
    */
    expect(
      Object.keys(sources).some((key) => /(^|\/)skin\.ts$/.test(key)),
      'ui/skin.ts is gone. The terminal skin is parked, not abandoned — if it ' +
        'was deliberately deleted, delete styles/crt.css and this test with it.',
    ).toBe(true);
  });
});
