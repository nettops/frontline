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
const CITY = src('../panels/CityPanel.tsx');

/**
 * What a reader sees, not how JSX happened to wrap it.
 *
 * The first version of this file asserted `contains('sit down')` against raw
 * source and failed, because the sentence is broken as "sit\n down with them".
 * A guard on player-facing prose that can be defeated by a line break is
 * testing the formatter.
 */
const flat = (t: string): string => t.replace(/\s+/g, ' ').toLowerCase();

/**
 * The file with its commentary taken out.
 *
 * Every repair in this file is explained in a comment directly above the code
 * that makes it, and those comments quote the copy they added — so a guard run
 * against raw source would be satisfied by its own justification. That is the
 * vacuous pass this project keeps catching in itself; the check below is only
 * worth having if it reads what a player reads.
 */
const prose = (t: string): string =>
  flat(t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '));

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

/**
 * The three lists on the Overview, and why they are three.
 *
 * "Wanting you" is the loop asking to be run, the doorway is a person in it,
 * and "What you have running" is the set of things already in motion. The last
 * of those exists because the game turned out to be full of arcs with nowhere
 * to see them as arcs: a score on Operations, a promise and a mark on the crew
 * sheet, a case on Law, so a boss with four things going had four screens to
 * remember to visit.
 */
describe('the way in to what you have running', () => {
  it('is on the Overview with the other two lists', () => {
    expect(DASHBOARD).toContain('arcs(state)');
    expect(flat(DASHBOARD)).toContain('what you have running');
  });

  /** Every row goes somewhere. A line you cannot act on is a notification. */
  it('sends you to the screen that owns each one', () => {
    const at = DASHBOARD.indexOf('What you have running');
    const block = DASHBOARD.slice(at, at + 900);
    expect(block).toContain('onNavigate(a.panel)');
  });

  /**
   * And says how each ends, which is the half a status line leaves out and the
   * thing that makes it an arc rather than a row of state.
   */
  it('says where each stands and how it ends', () => {
    const at = DASHBOARD.indexOf('What you have running');
    const block = DASHBOARD.slice(at, at + 900);
    expect(block).toContain('a.where');
    expect(block).toContain('a.ends');
  });
});

/**
 * A dead button that promises a reward.
 *
 * Two round-17 scorers described one fault from opposite sides: the hover on
 * "Ask for work" advertised *"Money now, and 9 standing off them"* on a button
 * that would not press, directly above the row saying why — and the two buttons
 * on that row look like a pair while doing opposite things, one spending a
 * favour and the other spending a favour *and* nine standing to sell it for
 * cash.
 *
 * The reason stays in body text, which is iteration 5's F10 and is not undone
 * here.
 */
describe('the favour buttons', () => {
  it('say nothing on hover when they cannot be pressed', () => {
    const at = CITY.indexOf('Ask for work');
    expect(at, 'the button has moved or been renamed').toBeGreaterThan(-1);
    const block = CITY.slice(Math.max(0, at - 900), at);
    expect(block, 'a disabled button still advertises its reward').toContain('p.blocked ?');
  });

  it('put the price where it can be read without hovering', () => {
    expect(flat(CITY)).toContain('ask for work ·');
    expect(CITY).toContain('CIVIC_WORK.standingCost');
  });

  /** And the reason is still prose in the row, not a tooltip. */
  it('keep the refusal in body text', () => {
    expect(CITY).toContain('{p.blocked}');
  });
});

/**
 * Every table row that is secretly a button says so.
 *
 * Round 16 found this in the crew dossier: the best screen in the game was one
 * click inside a `cursor: pointer` row with no other affordance, and three
 * testers reached it on days 32, 43 and 81. It was repaired by saying so in the
 * page-sub, and nobody checked whether the pattern existed anywhere else.
 *
 * It existed in three more places. All three round-17 scorers reported
 * Diplomacy as a read-only table with no actions — *"Diplomacy has no verbs"*,
 * *"it has never had a single clickable action in 184 days"* — while every verb
 * the system owns sat in a modal behind the row, and one of them had a rank
 * requirement pointing at it for 160 days.
 *
 * This guards the class rather than the three instances: a panel that renders
 * `clickable` rows has to tell the player, in the text at the top of the page,
 * that opening one does something.
 */
describe('rows that open something say so', () => {
  const panels = [
    'CrewPanel',
    'DiplomacyPanel',
    'RivalsPanel',
    'LawPanel',
    'TerritoryPanel',
    'OperationsPanel',
  ] as const;

  it('is reading the panels it asserts about', () => {
    for (const name of panels) {
      expect(src(`../panels/${name}.tsx`), `${name} not found`).toBeTruthy();
    }
  });

  /**
   * "Open" is the word, in the page-sub, above the fold.
   *
   * Checked as a word rather than a sentence because the sentence is the
   * panel's business — what must not happen again is a screen whose only
   * statement of its own interactivity is a CSS cursor.
   */
  it('names the door in the text at the top of the page', () => {
    const silent: string[] = [];
    for (const name of panels) {
      const file = src(`../panels/${name}.tsx`);
      /*
         Plainly, because the clever version matched nothing.

         The first attempt anchored on `className={...clickable` and every one
         of these panels writes it as a ternary — `selectedId ? 'clickable
         selected' : 'clickable'` — so the character class stopped at the first
         quote, no panel matched, and the guard skipped all six while reporting
         a pass. Caught by deleting the copy it was supposed to protect and
         watching it stay green.
      */
      if (!/'clickable/.test(file)) continue;

      const at = file.indexOf('page-sub');
      if (at === -1) {
        silent.push(`${name}: rows open something and there is no page-sub at all`);
        continue;
      }
      const sub = prose(file.slice(at, at + 900));
      if (!/\bopen\b|\bclick\b/.test(sub)) {
        silent.push(`${name}: rows open something and the page never says to open one`);
      }
    }
    expect(
      silent,
      `these panels hide every verb they have behind a cursor:\n${silent.join('\n')}`,
    ).toHaveLength(0);
  });
});
