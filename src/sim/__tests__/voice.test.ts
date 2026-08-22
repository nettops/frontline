/**
 * The way the game talks about people.
 *
 * Two rules, both found by a playtester rather than by a test, which is why
 * they are now tests.
 *
 * The first is that the game does not assume anybody's gender. The NPC
 * generator produces Carla, Rosa, Bianca, Gina and Nadia alongside Sal, Rocco
 * and Joey, and every one of them used to be "he" — in the flavour text, in the
 * crew sheet, in the sit-down, in 441 separate strings. The tester caught one.
 * Nothing in the state has ever recorded a gender, so they/them is not a
 * compromise here; it is the only thing the game actually knows.
 *
 * The second is agreement. A mechanical he→they rewrite produces "they is" and
 * "they has" unless somebody is careful, and one bad automated pass turned "He
 * was not young" into "They were young" — a sentence meaning the opposite.
 *
 * These read the source rather than the behaviour, because what is guarded is a
 * property of the text: that somebody adding an event next year writes it the
 * same way.
 *
 * ---
 *
 * The first version of this file checked eight files by hand-written list, and
 * missed the crew sheet's own section headings — the most visible instance of
 * the bug, on the screen a player looks at most. Hand-written lists of what to
 * check are how a guard ends up guarding the wrong thing. It now walks
 * everything.
 */
import { describe, expect, it } from 'vitest';
/*
   Every source file in the project, read as text.

   `import.meta.glob` is resolved by Vite at build time, so this cannot drift
   out of date the way a hand-written import list did — a file added next year
   is checked the day it lands, with nobody having to remember.
*/
const sources = import.meta.glob('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Comments are stripped in a separate first pass, and that ordering is the
 * whole reason this works.
 *
 * Doing it in one pass — deciding at each character whether it opens a comment
 * or a string — breaks on an apostrophe in JSX text. `don't` opens a fake
 * string span that runs to the next apostrophe, swallowing any comment in
 * between and reporting design prose as something the player reads. Two real
 * bugs hid behind exactly that noise.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      i = j === -1 ? n : j;
    } else if (src[i] === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      i = j === -1 ? n : j + 2;
    } else {
      out += src[i++];
    }
  }
  return out;
}

/**
 * Everything the player can read: string and template literals, plus JSX text.
 *
 * JSX text is not a string literal — it is bare text between tags — which is
 * how every heading on the crew sheet survived the rewrite that was supposed to
 * fix them. Apostrophes in JSX text make the string scanner produce spans that
 * are not really strings; that is harmless here, because what those spans
 * contain is JSX text, which is exactly what needs checking too.
 */
function playerFacing(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];

  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      const start = ++i;
      while (i < n) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === quote) break;
        i++;
      }
      out.push(code.slice(start, i));
      i++;
    } else if (c === '>') {
      // JSX text: everything up to the next tag.
      const j = code.indexOf('<', i);
      if (j > i + 1) out.push(code.slice(i + 1, j));
      i = j === -1 ? n : j;
    } else {
      i++;
    }
  }
  return out;
}

const FILES: [string, string][] = Object.entries(sources)
  // Tests talk about the bug in order to guard it, which is not the same as
  // committing it.
  /*
     Tests talk about the bug in order to guard it, which is not the same as
     committing it. Filtered on the filename rather than on the directory,
     because the keys a glob hands back are relative to the importing file and
     their exact shape is not something worth depending on.
  */
  .filter(([path]) => !/\.test\.tsx?$/.test(path))
  .map(([path, text]) => [path.replace(/^(\.\.\/)+/, ''), text]);

describe('the game does not decide anybody is a man', () => {
  it('is reading the whole codebase, not a list somebody kept up to date', () => {
    /*
       The guard on the guard, twice over. Both rules below pass perfectly if
       the parser returns nothing, and the previous version of this file passed
       while ignoring three quarters of the game.
    */
    expect(FILES.length).toBeGreaterThan(60);
    const all = FILES.flatMap(([, src]) => playerFacing(src));
    expect(all.length).toBeGreaterThan(1500);
    expect(all.filter((t) => /\bthey\b/i.test(t)).length).toBeGreaterThan(150);
  });

  it('uses no gendered pronoun in anything the player reads', () => {
    const offenders: string[] = [];
    for (const [name, src] of FILES) {
      for (const text of playerFacing(src)) {
        const hit = /\b(he|him|his|himself|she|her|hers|herself)\b/i.exec(text);
        if (hit) {
          const from = Math.max(0, hit.index - 45);
          offenders.push(`${name}: "…${text.slice(from, hit.index + 45).trim()}…"`);
        }
      }
    }
    expect(
      offenders,
      `the game has decided somebody's gender:\n${offenders.slice(0, 12).join('\n')}`,
    ).toHaveLength(0);
  });

  it('agrees its verbs with the plural it now uses', () => {
    const offenders: string[] = [];
    for (const [name, src] of FILES) {
      for (const text of playerFacing(src)) {
        const bad = /\bthey\s+(is|was|has|does|isn't|wasn't|hasn't|doesn't)\b/i.exec(text);
        if (bad) {
          const from = Math.max(0, bad.index - 45);
          offenders.push(`${name}: "…${text.slice(from, bad.index + 55).trim()}…"`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });
});
