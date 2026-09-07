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

/*
   The same class, one layer down: a config settings object with a key nothing
   reads. This is the third time it has shipped — the round-11 repo audit
   found six, and a 2026-09-07 diagnosis pass found three more
   (`WORLD.gripSkim`, `AI.weights.declareWarMaxRelationship`, `SCORE.minTier`)
   sitting in files nobody had scanned for it. `gripSkim` is now wired; the
   other two named a mechanic the sim had already moved past and are deleted.
   This guards against a fourth.

   Scoped to plain object-literal exports — `export const NAME = { ... }` with
   no type annotation — because those are settings bags read as `NAME.key`.
   An id-indexed catalogue (`Record<Id, Def>`, built with `Object.fromEntries`
   or written as an array) is looked up dynamically and would false-positive
   on every entry, which is why the regex below requires the literal `= {`
   immediately after the name.
*/
const CONFIG_SOURCES = import.meta.glob('../../config/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Two calls rather than one glob with an array pattern — this project's glob
// typings only cover the single-pattern overload.
const NON_CONFIG_SOURCES = {
  ...(import.meta.glob('../../sim/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
  ...(import.meta.glob('../../ui/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
};

/*
   The corpus a key must appear in to count as read: production code only,
   comments stripped. Without this a key is "read" the moment this very file
   names it in a doc comment — the first version of this guard did exactly
   that, since `NON_CONFIG_SOURCES` includes `__tests__/`, and the comment
   two blocks up naming `WORLD.gripSkim` and `SCORE.minTier` as examples would
   have made both read forever regardless of what the game actually does.
*/
const PRODUCTION_TEXT = Object.entries(NON_CONFIG_SOURCES)
  .filter(([file]) => !file.includes('__tests__'))
  .map(([, text]) => stripComments(text));

interface ConfigObject {
  file: string;
  name: string;
  keys: string[];
}

/*
   Comments stripped in a separate first pass, reusing `voice.test.ts`'s
   helper rather than a per-line "does this look like a comment" heuristic —
   the first version of this scanner used exactly that heuristic and mistook
   a word-wrapped design comment for a key, because a block comment without a
   leading star on every continuation line happened to wrap onto "is: this
   is the only door..." in `config/diplomacy.ts`. Stripping comments before
   parsing removes the whole class rather than one instance of it.
*/
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      out += '\n';
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

/** Every plain settings-object export in every config file. */
function configObjects(): ConfigObject[] {
  const out: ConfigObject[] = [];
  const declRe = /export const ([A-Z][A-Za-z0-9_]*)\s*=\s*\{/g;
  for (const [file, rawText] of Object.entries(CONFIG_SOURCES)) {
    const text = stripComments(rawText);
    for (const m of text.matchAll(declRe)) {
      const name = m[1];
      const bodyStart = m.index! + m[0].length;
      // Depth-tracked, same idiom as orgFields: only keys at the object's own
      // top level. Comments are already gone, so a line is a key or it isn't.
      let depth = 1;
      let i = bodyStart;
      let lineStart = bodyStart;
      const keys: string[] = [];
      while (depth > 0 && i < text.length) {
        const ch = text[i];
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (ch === '\n' || depth === 0) {
          const line = text.slice(lineStart, i).trim();
          if (depth === 1) {
            const km = /^([a-zA-Z][a-zA-Z0-9]*)\??\s*:/.exec(line);
            if (km) keys.push(km[1]);
          }
          lineStart = i + 1;
        }
        i++;
      }
      out.push({ file, name, keys });
    }
  }
  return out;
}

function configKeyIsRead(name: string, key: string): boolean {
  const target = `${name}.${key}`;
  /*
     Sim and UI first, and config too — a config file legitimately derives a
     value off its own sibling export (`operations.ts` computes `heatDistance`
     by reading `HEAT_DISTANCE.perRank` inside the same file, same for
     `TRAINING.pointBase` in `training.ts`), which is real use rather than the
     defining line, since the declaration itself reads `key:` and never
     `NAME.key`. Both corpora are production text with comments already
     stripped, `__tests__` excluded from the sim/ui half — see
     `PRODUCTION_TEXT`.
  */
  return (
    PRODUCTION_TEXT.some((text) => text.includes(target)) ||
    Object.values(CONFIG_SOURCES).some((text) => stripComments(text).includes(target))
  );
}

/**
 * Whole object read via `{...NAME}` rather than by any one property name.
 *
 * `sim/contract.ts` builds its per-target multipliers as
 * `{...CAPO_SHAPE, ...BOSS_CONTRACT}` and reads the merged result, so no key
 * of `BOSS_CONTRACT` is ever written as `BOSS_CONTRACT.x` anywhere — the
 * object is the unit of use, not the field. That is a real, structural
 * exception (a spread pattern this project uses more than once), not a name
 * exempted because it was inconvenient to explain.
 */
function configObjectIsSpread(name: string): boolean {
  const target = `...${name}`;
  return PRODUCTION_TEXT.some((text) => text.includes(target));
}

describe('config settings objects have no dead keys', () => {
  it('parsed a plausible number of objects and keys', () => {
    const objects = configObjects();
    expect(objects.length, 'the glob or the regex read nothing').toBeGreaterThan(50);
    const totalKeys = objects.reduce((n, o) => n + o.keys.length, 0);
    expect(totalKeys, 'no keys parsed out of any object').toBeGreaterThan(200);
  });

  /*
     Two keys the tightened scanner found and neither is the bug this file
     hunts. Both are kept as identity functions on purpose, and both say so
     in a comment right beside the code that would have read them:

       HANDOVER.ranksLost   succession.ts:488 — "Kept as an identity function
                            rather than deleted so the Succession panel still
                            has something to show, and so a save written
                            before this reads back the same."
       DEAL.moveOnMiss      frontDeal.ts:201 — "A miss costs nothing here on
                            purpose — see DEAL.moveOnMiss." Documenting a
                            deliberate zero, not a forgotten one.

     Unlike every other entry this guard has ever found, both are already
     explained in prose at the point where a reader would look for them —
     the round-11 audit's own distinction between a config key nobody
     remembers and one somebody consciously decided to keep. A key added
     here needs the same standard: a comment at its own use-site naming it,
     not a note in this test explaining why it gets a pass.
  */
  const DELIBERATELY_UNREAD = new Set(['HANDOVER.ranksLost', 'DEAL.moveOnMiss']);

  it('reads every key it declares', () => {
    const dead = configObjects()
      .filter((o) => !configObjectIsSpread(o.name))
      .flatMap((o) =>
        o.keys
          .filter((k) => !configKeyIsRead(o.name, k) && !DELIBERATELY_UNREAD.has(`${o.name}.${k}`))
          .map((k) => `${o.name}.${k}  (${o.file})`),
      );

    expect(
      dead,
      'these config keys are defined and read by nothing outside config/ — ' +
        'the screen or the sim may be claiming a mechanic that does not exist:' +
        String.fromCharCode(10) +
        dead.join(String.fromCharCode(10)),
    ).toEqual([]);
  });
});

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
