/**
 * The advancement table and the rest of the game must not disagree about a word.
 *
 * Round 11, day 201: ADVANCEMENT read "What the family is worth $92,017" while
 * the panel beside it read "In all $80,917". Day 303: ADVANCEMENT read
 * "Crew 13 / 16" while the Overview read "Crew 8 of 22", and STANDING read
 * "Influence 0" against "Influence 2/20" forty pixels below.
 *
 * The rule is right — a rung once earned stays earned, so the table measures
 * the best the family has ever done. It is stated once, in small text, and then
 * never distinguished at the point of use. That tester twice misjudged how far
 * they were from a promotion.
 *
 * So each row carries both figures and the screen can show both.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { rankRequirements } from '../player';
import { crewList } from '../npc';

describe('rank requirement rows', () => {
  it('carry today alongside the best ever, and gate on the best', () => {
    const state = newGame({ name: 'Rows', difficulty: 'normal', seed: 4 });
    state.org.record = {
      respect: 400,
      crew: 13,
      estate: 92_017,
      ops: 120,
      districts: 4,
      opsSeen: 0,
    };
    state.org.respect = 40;

    const rows = rankRequirements(state);
    const crewRow = rows.find((r) => r.label === 'Crew');
    const respectRow = rows.find((r) => r.label === 'Respect');

    expect(crewRow).toBeDefined();
    expect(respectRow).toBeDefined();

    // The gate still reads the high-water mark.
    expect(crewRow!.current).toBe(13);
    expect(respectRow!.current).toBe(400);

    // And the live figure is available, so the screen can say which is which.
    expect(crewRow!.now).toBe(crewList(state).length);
    expect(respectRow!.now).toBe(40);
    expect(crewRow!.now).toBeLessThan(crewRow!.current);
  });

  it('reports now equal to current when the family is at its best', () => {
    const state = newGame({ name: 'Rows', difficulty: 'normal', seed: 4 });
    state.org.record = undefined;

    for (const row of rankRequirements(state)) {
      expect(row.now).toBe(row.current);
    }
  });
});
