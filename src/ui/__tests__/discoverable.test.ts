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
