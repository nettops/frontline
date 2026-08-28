/**
 * What a boss is made of.
 *
 * The eight attributes this replaces improved by use, which sounds like
 * character and produces none: everything crept upward, nobody was ever bad at
 * anything, and there was no decision in it anywhere. Measured on how often
 * each was read outside the panel that displays them —
 *
 *     leadership 7 · influence 6 · negotiation 5 · streetSmarts 5
 *     business 1 · intimidation 1 · intelligence 0 · strategy 0
 *
 * — two of the eight were read by nothing at all.
 *
 * The properties this file holds:
 *
 * 1. **The pool is finite**, so a build is a set of things you gave up.
 * 2. **A verb is a threshold, not a slope.** At 5 you can do the thing and at
 *    4 you cannot, and nothing but points crosses it.
 * 3. **The world half turns on earlier than the verb**, so a middling score is
 *    worth something and the screen is a distribution rather than a checklist.
 * 4. **A save written before any of this loads**, with a build nobody chose.
 */
import { describe, expect, it } from 'vitest';
import { newGame, SAVE_VERSION } from '../state';
import {
  buildOf,
  canSpendPoint,
  hasVerb,
  pointsLeft,
  spendPoint,
  statLevel,
  worldPull,
} from '../build';
import { BUILD, STAT_IDS, VERB_AT, WORLD_AT, type StatId } from '../../config/build';
import type { GameState } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Build', difficulty: 'normal', seed });
}

describe('the pool', () => {
  it('starts every stat at the floor with the whole pool unspent', () => {
    const state = game();
    for (const id of STAT_IDS) expect(statLevel(state, id)).toBe(BUILD.min);
    expect(pointsLeft(state)).toBe(BUILD.startingPoints);
  });

  it('spends a point where it is put', () => {
    const state = game();
    expect(spendPoint(state, 'word').ok).toBe(true);
    expect(statLevel(state, 'word')).toBe(BUILD.min + 1);
    expect(pointsLeft(state)).toBe(BUILD.startingPoints - 1);
  });

  /*
     The property the whole thing rests on. A pool you cannot exhaust is not a
     build, it is a settings screen — and the old system's real defect was that
     nothing was ever given up.
  */
  it('runs out, and says so rather than quietly refusing', () => {
    const state = game();
    /*
       Spread rather than poured into one stat, because the ceiling gets there
       first: `word` runs 1 to 10, so nine of the fourteen fit and the first
       version of this test asserted an empty pool while five points were still
       in hand. The ceiling was right and the test was wrong.
    */
    for (let i = 0; i < BUILD.startingPoints; i++) {
      spendPoint(state, STAT_IDS[i % STAT_IDS.length]);
    }
    expect(pointsLeft(state)).toBe(0);

    const no = canSpendPoint(state, 'grip');
    expect(no.ok).toBe(false);
    expect(no.reason, 'the refusal did not say what was missing').toMatch(/point/i);
  });

  it('will not push a stat past the ceiling', () => {
    const state = game();
    state.player.points = 99;
    for (let i = 0; i < 20; i++) spendPoint(state, 'muscle');
    expect(statLevel(state, 'muscle')).toBe(BUILD.max);
  });

  /*
     A save written before any of this existed has to load, and it has to load
     as somebody. The idiom every optional field in this state uses.
  */
  it('reads a save that never had a build at all', () => {
    const state = game();
    delete (state.player as { build?: unknown }).build;
    for (const id of STAT_IDS) expect(statLevel(state, id)).toBe(BUILD.min);
    expect(buildOf(state).word).toBe(BUILD.min);
  });

  it('does not move the save format', () => {
    expect(SAVE_VERSION).toBe(13);
  });
});

describe('what a stat does', () => {
  const put = (state: GameState, id: StatId, to: number) => {
    state.player.points = 99;
    while (statLevel(state, id) < to) spendPoint(state, id);
  };

  /*
     A verb is a door, not a slope. This is the difference between a build and
     a set of multipliers, and it is the thing the first draft of this design
     got wrong: seven multipliers with doors on them is the old system with
     better names.
  */
  it('opens the verb at its threshold and not one point before', () => {
    for (const id of STAT_IDS) {
      const under = game();
      put(under, id, VERB_AT[id] - 1);
      expect(hasVerb(under, id), `${id} handed over its verb early`).toBe(false);

      const at = game();
      put(at, id, VERB_AT[id]);
      expect(hasVerb(at, id), `${id} never opens its verb`).toBe(true);
    }
  });

  /*
     And the half that makes a middling score worth having. Without this every
     point below a threshold is dead weight and the screen stops being a
     distribution.
  */
  it('starts changing the world before it hands over the verb', () => {
    for (const id of STAT_IDS) {
      expect(WORLD_AT, `${id}'s verb arrives before the world notices`).toBeLessThan(VERB_AT[id]);
    }
    const state = game();
    put(state, 'grip', WORLD_AT);
    expect(worldPull(state, 'grip')).toBeGreaterThanOrEqual(0);
    expect(hasVerb(state, 'grip'), 'the world half handed over the verb').toBe(false);
  });

  it('gives nothing to a stat left at the floor', () => {
    const state = game();
    for (const id of STAT_IDS) {
      expect(worldPull(state, id), `${id} pays out at the floor`).toBe(0);
      expect(hasVerb(state, id), `${id} has its verb at the floor`).toBe(false);
    }
  });

  it('pays more the further past the threshold it goes', () => {
    const some = game();
    put(some, 'muscle', WORLD_AT + 2);
    const lots = game();
    put(lots, 'muscle', BUILD.max);
    expect(worldPull(lots, 'muscle')).toBeGreaterThan(worldPull(some, 'muscle'));
    expect(worldPull(lots, 'muscle')).toBeCloseTo(1, 5);
  });

  /*
     The arithmetic that makes it a decision. Seven stats cannot all be good.
  */
  it('cannot afford every verb', () => {
    const needed = STAT_IDS.reduce((sum, id) => sum + (VERB_AT[id] - BUILD.min), 0);
    expect(
      needed,
      'the starting pool buys every verb in the game, so nothing was given up',
    ).toBeGreaterThan(BUILD.startingPoints);
  });
});
