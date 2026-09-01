/**
 * The screens nobody was finding.
 *
 * Round 16's three testers were unanimous on two things, and neither was a
 * broken system — both were working systems with no route to them.
 *
 * `Yourself` holds sixteen unspent points from the first morning. All three
 * found it by accident, on days 8, 18 and 25, and all three reported running
 * jobs at a deficit until they did. One called it "the one thing in the game a
 * player can be strictly wrong about for free".
 *
 * The crew dossier — traits, grudges, the job history, the sit-down — is one
 * click inside a table row that is `cursor: pointer` and nothing else. They
 * reached it on days 32, 43 and 81, and all three called what is behind it the
 * best screen in the game.
 *
 * These guard the routes rather than the screens. A test that opened the panel
 * and asserted its contents would have passed throughout the failure.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/state';
import { pointsLeft, spendPoint } from '../../sim/build';
import type { GameState } from '../../sim/types';

const src = (path: string): string =>
  (
    import.meta as unknown as { glob: (p: string, o: unknown) => Record<string, string> }
  ).glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true })[path];

const RAIL = src('../Rail.tsx');
const CREW = src('../panels/CrewPanel.tsx');
const DASHBOARD = src('../panels/Dashboard.tsx');
const SUCCESSION = src('../panels/SuccessionPanel.tsx');

/**
 * What a reader sees, not how JSX happened to wrap it.
 *
 * The first version of this file asserted `contains('sit down')` against raw
 * source and failed, because the sentence is broken as "sit\n down with them".
 * A guard on player-facing prose that can be defeated by a line break is
 * testing the formatter.
 */
const flat = (t: string): string => t.replace(/\s+/g, ' ').toLowerCase();

function game(seed = 4): GameState {
  return newGame({ name: 'Found', difficulty: 'normal', seed });
}

describe('the way in to the build screen', () => {
  it('is reading the files it asserts about', () => {
    expect(RAIL).toBeTruthy();
    expect(CREW).toBeTruthy();
  });

  it('starts with points that are worth telling somebody about', () => {
    expect(pointsLeft(game())).toBeGreaterThan(0);
  });

  it('puts a badge on the rail while any are unspent', () => {
    expect(RAIL).toContain("entry.id === 'player'");
    expect(RAIL).toContain('unspent');
  });

  /**
   * The Rail's own rule, which it states above its badges: a badge is a demand
   * for attention with no statement of what would satisfy it. A count on its
   * own would repeat the succession "!" that a tester carried for 179 days.
   */
  it('says what the badge wants, not just how many', () => {
    const at = RAIL.indexOf("entry.id === 'player'");
    const block = RAIL.slice(at, at + 400);
    expect(block).toContain('title=');
    expect(flat(block)).toContain('place');
  });

  /*
     Spread across stats, because each one caps at `BUILD.max`.

     Pouring every point into `method` stalls at the ceiling with five left,
     which is the build system working correctly and this test asking the
     wrong question.
  */
  it('stops asking once they are placed', () => {
    const state = game();
    const stats: Parameters<typeof spendPoint>[1][] = [
      'method', 'ledger', 'grip', 'word', 'muscle', 'instinct', 'stomach',
    ];
    let guard = 0;
    while (pointsLeft(state) > 0 && guard++ < 200) {
      for (const id of stats) if (pointsLeft(state) > 0) spendPoint(state, id);
    }
    expect(pointsLeft(state)).toBe(0);
  });
});

describe('the way in to a person', () => {
  /**
   * `cursor: pointer` is an affordance only a mouse can find. Two of round
   * 16's testers drove the game through text reads and neither had any way to
   * learn a row was a door.
   */
  it('says in words that a row opens somebody', () => {
    const at = CREW.indexOf('page-sub');
    expect(at).toBeGreaterThan(-1);
    const intro = flat(CREW.slice(at, at + 700));
    expect(intro).toContain('open somebody');
  });

  it('names what is behind it, so the click has a reason', () => {
    const at = CREW.indexOf('page-sub');
    const intro = flat(CREW.slice(at, at + 700));
    expect(intro).toContain('sit down with them');
  });

  it('still marks the rows clickable for the people using a mouse', () => {
    expect(CREW).toContain("'clickable selected' : 'clickable'");
  });
});

/**
 * The third screen nobody was finding, and the one that came to them.
 *
 * `approaches.ts` exists so that a man with a reason turns up instead of the
 * player having to go looking. It shipped rendering in exactly one place — a
 * panel on the Overview — and all three round-16 testers missed it for their
 * whole careers, which is the same fault as the two above with the extra sting
 * that this one was *built* to solve discoverability.
 *
 * The badge could not go on until the read was worth one. Measured before it
 * was added, the doorway was lit on 71% of days with the list pinned at its
 * cap of three, and a badge on that is the wallpaper this rail already has a
 * rule against. With the fear branch measured against a man's own nerve it
 * discriminates: 2% of days for a boss who hears people out, 10% for one who
 * grinds his crew, 59% for one who grinds them and refuses everybody.
 */
describe('the way in to the doorway', () => {
  it('is reading the files it asserts about', () => {
    expect(DASHBOARD).toBeTruthy();
  });

  it('still renders the doorway where the rail points', () => {
    expect(DASHBOARD).toContain('approaches(state)');
    expect(flat(DASHBOARD)).toContain('waiting');
  });

  it('puts a badge on the rail while anybody is standing there', () => {
    expect(RAIL).toContain("approaches");
    const at = RAIL.indexOf("entry.id === 'dashboard' && waiting.length > 0");
    expect(at, 'the doorway badge is not on the rail').toBeGreaterThan(-1);
  });

  /**
   * The Rail's own rule: a badge is a demand for attention with no statement
   * of what would satisfy it. This one has to name the people and the route.
   */
  it('says who is waiting and where to answer them', () => {
    const at = RAIL.indexOf("entry.id === 'dashboard' && waiting.length > 0");
    const block = flat(RAIL.slice(at, at + 700));
    expect(block).toContain('title=');
    expect(block).toContain('waiting to see you');
    expect(block).toContain('overview');
  });

  /**
   * And it is a read, not a copy of one.
   *
   * A rail that re-derived "who is waiting" from stats would be a second
   * answer to a question `approaches.ts` already answers, free to disagree
   * with the panel it points at — which is the fault `rank.ts` was written to
   * avoid and the one the duplicate memos were.
   */
  it('asks the same function the panel does', () => {
    expect(RAIL).toContain("from '../sim/approaches'");
    expect(RAIL, 'the rail re-derives the doorway instead of reading it').not.toMatch(
      /stats\.fear >=/,
    );
  });
});

/**
 * The half of the crew dossier that pointed the wrong way.
 *
 * `readTies` has always shown what a man thinks of everybody else, and ties
 * are stored on whoever's opinion changed — so that list could never say who
 * would follow *him*. `followDeparture` reads exactly that, and `ties.ts`
 * calls the compounding walkout one of the best consequences in the game and
 * notes that it was invisible until the afternoon it landed. It was legible
 * from every sheet except the one it is about.
 *
 * Guarded here rather than only in `whoFollows.test.ts` because the read
 * existing is not the same as it being on screen, which is the failure this
 * file was written for three times over.
 */
describe('the way in to who is behind somebody', () => {
  it('is on the sheet of the man it is about', () => {
    expect(CREW).toContain('whoWouldFollow');
    expect(flat(CREW)).toContain('who is behind them');
  });

  /**
   * With the count, which is the part a boss is deciding against. The names
   * are men he knows; the number includes people he has not got the measure
   * of, so they are separate claims and are said separately.
   */
  it('says how many would go, not only who', () => {
    expect(CREW).toContain('followRisk');
    expect(flat(CREW)).toContain('could go with them');
  });

  /**
   * And it reads the simulation rather than re-deriving it. A panel that
   * counted trust itself would be a second answer free to disagree with
   * `followDeparture` — the fault `rank.ts` exists to avoid.
   */
  it('asks the same functions the departure does', () => {
    expect(CREW, 'the panel re-derives the follow risk instead of reading it').not.toMatch(
      /followTrustAbove/,
    );
  });
});

/**
 * The family's own past, and the screen it is on.
 *
 * `addLog` keeps 400 entries and a career writes far more, so a 300-day boss
 * can see half his career and a 600-day boss a fifth of it — the founding of
 * the family is the first thing the game throws away. `chronicle.ts` derives
 * the whole of it from people the simulation keeps forever, and a derivation
 * nobody can reach is the failure this file exists for.
 */
describe('the way in to the family history', () => {
  it('is reading the file it asserts about', () => {
    expect(SUCCESSION).toBeTruthy();
  });

  it('is on the screen about the family across time', () => {
    expect(SUCCESSION).toContain('chronicle(state)');
    expect(flat(SUCCESSION)).toContain('what happened to this family');
  });

  /**
   * With the sentence before the list, because a bare column of dates does not
   * say how many people a career has been through.
   */
  it('says the shape of it before the detail', () => {
    expect(SUCCESSION).toContain('chronicleSummary');
  });

  /**
   * And reads the simulation rather than the log it replaces. A panel built on
   * `state.log` would inherit the cap this exists to escape.
   */
  it('does not rebuild it out of the feed it exists to outlive', () => {
    const at = SUCCESSION.indexOf('What happened to this family');
    const block = SUCCESSION.slice(at, at + 1600);
    expect(block, 'the history is built from the capped log').not.toContain('state.log');
  });
});
