/**
 * One ability, one name; one button, one honest state.
 *
 * Round 16's three faults that were not about a system being wrong. All three
 * are a working system telling the player something that is not true.
 *
 * **"Case a job" and "Spend the week on it"** were one ability under two
 * names. `config/build.ts` sells the Method point as *Case a job*, and the
 * button that does it was labelled *Spend the week on it*. A tester bought the
 * point, searched five screens for the word "case", and found the button on
 * day 94 — 69 days of owning something they could not locate.
 *
 * **The shake button on a front deal** rendered enabled at any price. Clicking
 * it with too little money called `closeDeal`, discarded the `ok` it came back
 * with, played the success cue and charged a day.
 *
 * **A standing order's approach** was recorded at set-time and then invisible
 * forever. Set one while working quiet, switch the picker to Heavy for a
 * score, and nothing on any screen says the automated nights are still going
 * out quiet.
 *
 * These read the source, in the same idiom as `discoverable.test.ts` and for
 * the same reason: what is guarded is a property of the screens rather than of
 * a run, and a test that rendered the panel and asserted its contents would
 * have passed throughout every one of these failures.
 */
import { describe, expect, it } from 'vitest';
import { STAT_BY_ID } from '../../config/build';
import { APPROACHES } from '../../config/operations';

const src = (path: string): string =>
  (
    import.meta as unknown as { glob: (p: string, o: unknown) => Record<string, string> }
  ).glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true })[path];

const OPERATIONS = src('../panels/OperationsPanel.tsx');
const SITDOWN = src('../SitdownModal.tsx');

/** What a reader sees, not how JSX happened to wrap it. */
const flat = (t: string): string => t.replace(/\s+/g, ' ').toLowerCase();

/**
 * The file with its commentary taken out.
 *
 * The first run of the "no second name" guard below went red on this file's
 * own repair note, which quotes the old label in order to record why it went.
 * A guard on player-facing text that a comment can trip is testing the wrong
 * layer — and deleting the note to make it green would have thrown away the
 * only account of the fault.
 */
const prose = (t: string): string =>
  flat(t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '));

describe('the file scan', () => {
  it('is reading the files it asserts about', () => {
    expect(OPERATIONS).toBeTruthy();
    expect(SITDOWN).toBeTruthy();
  });
});

describe('one ability, one name', () => {
  /**
   * The button takes its label from the same table the point is sold from, so
   * the two cannot be given different names by two different people on two
   * different days. Asserted as *reads from config* rather than as *says the
   * right string*, because a matching literal would drift again the moment
   * somebody edits one of them.
   */
  it('labels the casing button from the config that promises it', () => {
    expect(OPERATIONS).toContain('STAT_BY_ID.method.verb');
    expect(OPERATIONS).toContain('STAT_BY_ID.method.verbBlurb');
  });

  /**
   * And the old name is gone rather than merely unused. A second name left in
   * the file is a second name a tester can find.
   */
  it('has no second name for it left anywhere on the screen', () => {
    expect(prose(OPERATIONS)).not.toContain('spend the week on it');
  });

  /**
   * The promise itself has to be findable, which is the half that made the
   * button matter. A verb nobody could search for would be the same fault
   * moved one screen over.
   */
  it('sells it as something a player could search for', () => {
    expect(STAT_BY_ID.method.verb.toLowerCase()).toContain('case');
  });
});

describe('the shake on a front deal', () => {
  /**
   * Disabled rather than silent. The failure mode being guarded is not a
   * missing purchase, it is a purchase that appears to have happened: the old
   * handler discarded `closeDeal`'s result, so a click nobody could afford
   * played the success cue and spent a day.
   */
  it('will not take a click at a price the player cannot cover', () => {
    const at = SITDOWN.indexOf('room-shake');
    expect(at, 'the shake button has moved or been renamed').toBeGreaterThan(-1);
    const block = SITDOWN.slice(at, at + 700);
    expect(block).toContain('disabled={short > 0}');
  });

  /** And says how far short, because a dead button with no reason is worse. */
  it('says what is missing rather than just refusing', () => {
    const at = SITDOWN.indexOf('room-shake');
    const block = flat(SITDOWN.slice(at, at + 700));
    expect(block).toContain('short');
    expect(block).toContain('title=');
  });

  /**
   * The handler reads the answer it is given.
   *
   * The disabled state above is a guard on the ordinary path; this is the one
   * that catches a purchase failing for a reason the button could not have
   * known about, which is what `closeDeal` returns `ok: false` for.
   */
  it('plays the cue the purchase actually earned', () => {
    const at = SITDOWN.indexOf('const shake =');
    expect(at, 'the shake handler has moved').toBeGreaterThan(-1);
    const block = SITDOWN.slice(at, at + 400);
    expect(block).toContain('closeDeal');
    expect(block).toMatch(/\.ok/);
  });
});

describe('a standing order', () => {
  /**
   * Says which approach it is running.
   *
   * The order reads the picker once and keeps it for life, so the picker is
   * not a display of what the order is doing — it is a display of what the
   * *next* order would do. Without this line there is nothing anywhere that
   * distinguishes the two.
   */
  it('shows the approach it was set with', () => {
    const at = OPERATIONS.indexOf('Runs itself');
    expect(at, 'the standing-order panel has moved or been renamed').toBeGreaterThan(-1);
    const block = OPERATIONS.slice(at, at + 1800);
    expect(block).toContain('approachOf(o)');
    expect(block).toContain('APPROACH_BY_ID');
  });

  /**
   * Through the safe accessor, because an order set before the field existed
   * has no approach and `undefined` would index the table to nothing.
   */
  it('reads it the way old saves survive', () => {
    const at = OPERATIONS.indexOf('Runs itself');
    const block = OPERATIONS.slice(at, at + 1800);
    expect(block, 'read o.approach directly — an old save has none').not.toMatch(
      /APPROACH_BY_ID\[o\.approach\]/,
    );
  });

  /** Every approach has a name to print, which is what the row relies on. */
  it('has a name for every way of working', () => {
    for (const a of APPROACHES) {
      expect(a.name.trim().length, `${a.id} has no name to show`).toBeGreaterThan(0);
    }
  });
});
