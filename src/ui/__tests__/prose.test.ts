/**
 * The writing linter.
 *
 * Everything a player reads goes through a handful of shapes — `addLog`, an
 * event `body`, a refusal `reason`, a `hint`, a string in a panel — and until
 * now nothing looked at any of it as prose. `scorecard.probe` counts how often
 * a line repeats, which is one real property measured well; this reads the
 * catalogue itself and looks for the other four.
 *
 * It is a test rather than a script because the failure mode of a prose rule is
 * silence: the strings still render, the types still check, and the game slowly
 * starts sounding like a status report again. Round 21 scored Writing 9 and the
 * same round measured 36% of everything a player reads as a line they had
 * already read. Those two facts sat beside each other for months because only
 * one of them had an instrument.
 *
 * The rules are deliberately narrow, and were tuned until they had **no** false
 * positives on this codebase. The first version had nine, every one a good
 * concrete sentence that happened to contain the word "city" or "room" — and a
 * linter that flags the writing the game is good at is one somebody switches
 * off in a week.
 *
 *   vague     reports a change without saying what changed. "Something has
 *             shifted", "tensions are rising". The test is whether a player
 *             could act differently after reading it.
 *   abstract  a simulation noun handed over raw — exposure, disposition. Fine
 *             inside the model, not on a screen; the fix is the consequence.
 *   hedged    "seems to", "appears to", on top of a perception system that
 *             already hedges. That hides meaning rather than information.
 *   portent   "only time will tell", "sooner or later". Atmosphere carrying
 *             nothing.
 *   long      a player-facing sentence over 30 words.
 *
 * Duplicates are counted and reported but not asserted on: the loudest entries
 * are shared refusal helpers whose whole job is to say the same thing in the
 * same words everywhere, which is correct.
 */
import { describe, expect, it } from 'vitest';

/* Every source file, as text. The idiom `discoverable.test.ts` established. */
const SOURCES = (
  import.meta as unknown as { glob: (p: string, o: unknown) => Record<string, string> }
).glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

/*
   The fields a string reaches a player through. `label` and `name` are left
   out: a two-word button is not prose and the rules below would only produce
   noise on them.
*/
const FIELDS = [
  'body', 'title', 'hint', 'blurb', 'text', 'reason', 'message', 'note',
  'headline', 'line', 'summary', 'detail', 'said', 'says', 'ask', 'answer',
];
const FIELD_RE = new RegExp(`\\b(${FIELDS.join('|')})\\s*:\\s*(['"\`])`);
const EMITS = /addLog\(|pushEvent\(|say\(|message:|reason:/;

/*
   Added on the second pass, from patterns the first one did not think to look
   for and a sweep of the repository found anyway.

   `unnamed` is the brief's own complaint in its purest form: a sentence whose
   subject is "something". Twelve of them were in the game, and the ones with a
   referent available — evidence left at a scene, a memo on the desk — were
   simply not using it. The exceptions are deliberate and are matched around:
   a bribe that goes unspoken is *supposed* to say "Nothing was said. Something
   was understood."

   `tic` is the one rhetorical move this game reaches for when it has nothing
   more to add — "which is its own answer", "that is the shape a thing takes".
   Thirty-four instances, most of them earning their place. The rule catches
   only the empty form: the move with no noun after it.
*/
const UNNAMED = [
  /\bsomething (is|was) (waiting|left behind|being discussed)\b/i,
  /\bsomething (has|had) (happened|come up|gone wrong)\b(?! that| which)/i,
];

const TIC = [
  /\bwhich is its own (answer|kind of \w+)\b/i,
  /\bthat is the shape (a|the) \w+ takes\b/i,
];

const VAGUE = [
  /\bsomething (has|had)?\s*(changed|shifted|is (wrong|different|off))/i,
  /\bthings (have|are) (changed|different|getting)/i,
  /\bthe (situation|balance|mood|atmosphere) (has|is|feels|seems)\b/i,
  /\bthe (air|room|city|streets?) (feels?|seems?) \w+\b/i,
  /\btensions? (are|is|have|has)\b/i,
  /\b(people|everyone|everybody|the streets?) (are|is|have) (talking|noticing|watching|restless)/i,
  /\bwhispers? (are|is|spread)/i,
  /\b(has|have) (begun|started) to (waver|shift|change|slip)\b/i,
  /\b(loyalty|ambition|trust|patience) (is|are|has|have) (beginning|starting|slipping|wavering)\b/i,
  /\bthe weight of (it|that|this|everything)\b/i,
  /\ba shadow (hangs|falls|over)\b/i,
  /\bthe question remains\b/i,
  /\bonly time will tell\b/i,
  /\bthe city remembers\b/i,
  /\beyes are watching\b/i,
  /\bfeels? colder\b/i,
];

const ABSTRACT = [
  'exposure', 'attribution', 'disposition', 'alignment', 'dynamics',
  'instability', 'friction', 'momentum', 'propensity', 'aggregate', 'metric',
];

const HEDGE = [
  /\bseems? to be\b/i, /\bappears? to be\b/i, /\bthere is a sense (that|of)\b/i,
  /\bsomewhat\b/i, /\bin some ways\b/i, /\bmay or may not\b/i, /\bit would appear\b/i,
];

const PORTENT = [
  /\bthe streets have a way of\b/i,
  /\bnothing (lasts|stays) forever\b/i,
  /\bone way or another\b/i,
  /\bsooner or later\b/i,
];

interface Finding { where: string; rule: string; text: string; why: string }

/** A string long enough to be a sentence rather than an id or a class list. */
function looksLikeProse(s: string): boolean {
  if (s.length < 24 || !/\s/.test(s) || !/[a-z]/.test(s)) return false;
  if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && !/[.,!?]/.test(s)) return false;
  if (/^[\w./-]+$/.test(s)) return false;
  if (/^(https?:|\.\/|\.\.\/|src\/|#)/.test(s)) return false;
  return /[a-z]{3,}\s+[a-z]{2,}/i.test(s);
}

/*
   Quoted strings, skipping comments.

   Hand-rolled rather than parsed: the only question is whether a run of
   characters is inside quotes, and an AST for that would be a dependency and a
   build step. The comment-stripping matters — half this project's best writing
   is in its comments and none of it is player-facing.
*/
function strings(src: string): { line: number; value: string; raw: string }[] {
  const out: { line: number; value: string; raw: string }[] = [];
  const lines = src.split('\n');
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (inBlock) {
      if (line.includes('*/')) { line = line.slice(line.indexOf('*/') + 2); inBlock = false; }
      else continue;
    }
    const blockAt = line.indexOf('/*');
    if (blockAt >= 0 && !line.slice(0, blockAt).includes('//')) {
      if (!line.includes('*/', blockAt)) inBlock = true;
      line = line.slice(0, blockAt);
    }
    const lineAt = line.indexOf('//');
    if (lineAt >= 0 && !/["'`].*\/\//.test(line)) line = line.slice(0, lineAt);

    const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const value = m[2].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (looksLikeProse(value)) out.push({ line: i + 1, value, raw: line });
    }
  }
  return out;
}

/*
   Abstract nouns are tested against what a player reads, not the expression.

   The first version matched `${Math.round(t.sentiment)}` and reported the
   refusal "Public feeling in Dockside is 27" as a simulation noun on screen.
   The visible words there are "Public feeling", and the number is the
   threshold `refusals.test.ts` requires that line to name.
*/
function shown(s: string): string {
  return s.replace(/\$\{[^}]*\}/g, ' ');
}

function longest(s: string): number {
  return Math.max(...s.split(/(?<=[.!?])\s+/).map((x) => x.split(/\s+/).length));
}

function audit(): { findings: Finding[]; dupes: [string, number][] } {
  const findings: Finding[] = [];
  const seen = new Map<string, number>();
  for (const [path, src] of Object.entries(SOURCES)) {
    if (/__tests__|probes|\.test\./.test(path)) continue;
    if (!/(config|sim|ui)\//.test(path)) continue;
    for (const { line, value, raw } of strings(src)) {
      if (!FIELD_RE.test(raw) && !EMITS.test(raw) && !/^\s*['"`]/.test(raw) && !/,\s*$/.test(raw)) {
        continue;
      }
      const where = `${path.replace('../../', 'src/')}:${line}`;
      if (VAGUE.some((re) => re.test(value))) {
        findings.push({ where, rule: 'vague', text: value, why: 'reports a change without saying what changed' });
      }
      if (UNNAMED.some((re) => re.test(value))) {
        findings.push({ where, rule: 'unnamed', text: value, why: 'the subject of the sentence is "something"' });
      }
      if (TIC.some((re) => re.test(value))) {
        findings.push({ where, rule: 'tic', text: value, why: 'the rhetorical move with nothing after it' });
      }
      if (HEDGE.some((re) => re.test(value))) {
        findings.push({ where, rule: 'hedged', text: value, why: 'hedges on top of the perception system' });
      }
      if (PORTENT.some((re) => re.test(value))) {
        findings.push({ where, rule: 'portent', text: value, why: 'atmosphere carrying no information' });
      }
      const abs = ABSTRACT.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(shown(value)));
      if (abs.length) {
        findings.push({ where, rule: 'abstract', text: value, why: `simulation noun on screen: ${abs.join(', ')}` });
      }
      const words = longest(value);
      if (words > 30) {
        findings.push({ where, rule: 'long', text: value, why: `${words}-word sentence` });
      }
      const key = value.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return { findings, dupes: [...seen.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]) };
}

describe('the writing', () => {
  const { findings, dupes } = audit();

  it('has no vague, abstract, hedged, portentous or overlong player-facing lines', () => {
    const report = findings
      .map((f) => `\n  ${f.rule.padEnd(9)} ${f.where}\n    ${f.text.slice(0, 140)}\n    ^ ${f.why}`)
      .join('');
    expect(findings.map((f) => `${f.rule} ${f.where}`), report).toEqual([]);
  });

  it('reads enough of the game to be worth running', () => {
    /*
       The guard on the instrument rather than on the game. A scanner that
       silently stopped matching would report zero findings for ever, which is
       indistinguishable from success — this project has shipped that mistake
       before and calls it an instrument reporting a fact about itself.
    */
    const files = Object.keys(SOURCES).filter((p) => /(config|sim|ui)\//.test(p));
    expect(files.length).toBeGreaterThan(100);
    const total = files.reduce((n, p) => n + strings(SOURCES[p]).length, 0);
    expect(total, 'the scanner stopped finding player-facing prose').toBeGreaterThan(500);
  });

  it('reports duplicate strings without failing on them', () => {
    // Shared refusal helpers are supposed to say the same thing everywhere.
    expect(dupes.length).toBeLessThan(60);
  });
});
