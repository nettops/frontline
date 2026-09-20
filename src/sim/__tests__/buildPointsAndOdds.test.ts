/**
 * A point placed in the build never moves the odds of a job.
 *
 * The Yourself page says so ("not the odds on tonight's job") and, until round
 * 30, its own coach banner said the opposite. Which of the two is true is a
 * question about `successBreakdown`, so it is asked of `successBreakdown`: the
 * same crew, the same district and the same approach are priced before and
 * after every stat is raised, for every job on the table, and the totals must be
 * identical. If a stat ever does start to move odds, this fails and the page has
 * to be told — a sentence that is true today is a promise to keep, not a fact.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { buildOf, spendPoint } from '../build';
import { successBreakdown } from '../operations';
import { crewList } from '../npc';
import { territoryList } from '../territory';
import { OPERATIONS } from '../../config/operations';
import { BUILD, STAT_IDS } from '../../config/build';

describe('what a point buys', () => {
  it('leaves the odds of every job exactly where they were', () => {
    const state = newGame({ name: 'Points', difficulty: 'normal', seed: 71 });
    const crew = crewList(state).filter((n) => n.status === 'active').slice(0, 2);
    const district = territoryList(state)[0].id;
    const totals = () => OPERATIONS.map((def) => successBreakdown(state, def, crew, district).total);

    const before = totals();
    state.player.points = BUILD.max * STAT_IDS.length;
    for (const id of STAT_IDS) {
      let guard = 0;
      while (buildOf(state)[id] < BUILD.max && guard++ < 50) spendPoint(state, id);
      expect(buildOf(state)[id], `${id} never reached the cap, so it was not really tested`).toBe(
        BUILD.max,
      );
    }
    expect(totals()).toEqual(before);
  });
});
