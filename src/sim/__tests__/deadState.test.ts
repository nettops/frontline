/**
 * Every field on the organization has to be written by something.
 *
 * `org.influence` was initialised to 0 in `newGame` and never assigned again
 * anywhere in the codebase, while `PlayerPanel` rendered it under the label
 * "Influence" on the Standing block — a few rows above a *different* Influence,
 * the player attribute, which is what every gate in the game actually reads.
 * So the boss's own screen showed two numbers with one name, and the one with
 * top billing was a constant zero nothing could move.
 *
 * Four blind rounds reported not understanding Influence. Round 13: "a whole
 * vertical of the game was invisible to me for 300 days because of one
 * attribute I had no idea how to train."
 *
 * This is the second time this class has shipped. The repo audit after round 11
 * deleted seven config keys that were defined, commented, and read by nothing —
 * six of which named a mechanic with no implementation anywhere. A field the
 * simulation never touches is not dead weight, it is a claim the game makes and
 * cannot keep.
 *
 * Scans the source rather than the running game because the failure is a
 * missing assignment, and there is no jsdom here to catch it at the other end.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob('../*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The `Org` interface body, lifted out of types.ts. */
function orgFields(): string[] {
  const types = SOURCES['../types.ts'];
  const start = types.indexOf('export interface Org {');
  const end = types.indexOf('\n}', start);
  const body = types.slice(start, end);

  const fields: string[] = [];
  let inBlock = false;
  /*
     Depth, because `record?: { crew, estate, ops, districts, opsSeen }` is an
     inline object and the first draft happily reported all five of its keys as
     dead fields of `Org`. They are not fields of `Org` at all, and nothing
     writes `org.crew` because nothing should. The instrument was wrong before
     the finding was right.
  */
  let depth = 0;
  for (const line of body.split(String.fromCharCode(10))) {
    const code = line.trim();
    const opens = code.includes('/*');
    const closes = code.includes('*/');
    const wasInBlock = inBlock;
    if (opens && !closes) inBlock = true;
    if (closes) inBlock = false;
    if (wasInBlock || opens || code.startsWith('//') || code.startsWith('*')) continue;

    const wasAtTop = depth <= 1;
    for (const ch of code) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }

    // `name: T;` or `name?: T;` — the optional marker is not part of the name.
    const match = /^([a-zA-Z][a-zA-Z0-9]*)\??\s*:/.exec(code);
    if (match && wasAtTop) fields.push(match[1]);
  }
  return fields;
}

/**
 * Somewhere other than the one line in `newGame` that creates the object.
 *
 * `state.ts` is excluded rather than special-cased: an initialiser is not a
 * writer, and a field only ever set at day zero is exactly the thing being
 * hunted here.
 */
function writtenOutsideInit(field: string): boolean {
  /*
     Plain substring forms rather than one regex.

     The first draft built the pattern with `new RegExp`, and every operator it
     cares about — `+=`, `*=`, `??=` — is a metacharacter needing escapes that
     have to survive a template string. It threw `Nothing to repeat` on the
     first field it tried. These are the five ways this codebase assigns to an
     org field, written out.
  */
  const target = `org.${field}`;
  const forms = [
    `${target} =`,
    `${target} +=`,
    `${target} -=`,
    `${target} *=`,
    `${target} ??=`,
  ];
  return Object.entries(SOURCES).some(
    ([file, text]) => !file.endsWith('/state.ts') && forms.some((f) => text.includes(f)),
  );
}

describe('the organization has no dead fields', () => {
  it('reads the Org interface it is asserting about', () => {
    // The instrument first. An empty field list passes the real test in silence.
    const fields = orgFields();
    expect(Object.keys(SOURCES).length, 'the glob read nothing').toBeGreaterThan(20);
    expect(fields.length, 'no fields parsed out of the Org interface').toBeGreaterThan(8);
    expect(fields, 'the parser lost a field it should have found').toContain('cash');
    expect(fields).toContain('heat');
  });

  it('writes every field it declares', () => {
    const dead = orgFields().filter((f) => !writtenOutsideInit(f));

    expect(
      dead,
      'these fields on Org are created and never assigned again — the game shows ' +
        'numbers it has no way to change:' +
        String.fromCharCode(10) +
        dead.map((f) => `  org.${f}`).join(String.fromCharCode(10)),
    ).toEqual([]);
  });
});
