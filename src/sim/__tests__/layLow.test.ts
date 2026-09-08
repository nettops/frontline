/**
 * What going quiet actually does.
 *
 * Round 16's tester reproduced this twice and it cost them their run: the
 * confirmation line said *"at Major Investigation street heat only falls at
 * 55% of the usual rate, so this will not clear it"*, and then heat went 58 to
 * 16 in ten days. They put off going quiet from day 42 to day 78 because of
 * that sentence.
 *
 * The sentence was stale. `HeatTier.decayMultiplier` scales `HEAT_ABSORPTION`
 * and nothing else — the heat-ratchet rework took it off the decay rate on
 * purpose, because scaling decay by it was what made the meter a one-way door
 * — but the confirmation copy was never updated and kept quoting it.
 *
 * So these tests pin the behaviour the copy has to describe. They are about
 * the simulation, which is correct; the repair is in the words.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { setHeat, startLayLow, isLayingLow, channelHeat } from '../heat';
import { heatTier } from '../../config/heat';
import type { GameState } from '../types';

/*
   The screen's own source, read rather than described.

   `layLowHonesty.test.ts` already reads this file to check a different
   promise about the same button — that work already out still finishes. This
   is the second honesty bug on the same confirmation in five rounds, so the
   guard belongs beside the first.
*/
const DASHBOARD: string = (
  import.meta as unknown as { glob: (p: string, o: unknown) => Record<string, string> }
).glob('../../ui/panels/Dashboard.tsx', { query: '?raw', import: 'default', eager: true })[
  '../../ui/panels/Dashboard.tsx'
];

function game(seed = 6): GameState {
  return newGame({ name: 'Quiet', difficulty: 'normal', seed });
}

/** Run the clock without letting a memo block it. */
function days(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.pendingEvents = [];
    advanceDay(state);
  }
}

describe('going quiet', () => {
  /**
   * The tester's exact reproduction, as a test.
   *
   * Heat 58 is Major Investigation, whose `decayMultiplier` is 0.55 — the
   * number the old copy quoted while telling the player it would not work.
   */
  it('clears street heat from Major Investigation, which the copy denied', () => {
    const state = game();
    setHeat(state, 'street', 58);
    expect(heatTier(state.org.heat).name).toBe('Major Investigation');

    startLayLow(state);
    expect(isLayingLow(state)).toBe(true);
    days(state, 10);

    // The tester measured 58 -> 16. Assert the shape, not their exact seed.
    expect(channelHeat(state, 'street')).toBeLessThan(30);
  });

  it('works from the top of the scale too, where the copy was most discouraging', () => {
    const state = game(7);
    setHeat(state, 'street', 90);
    startLayLow(state);
    days(state, 5);
    expect(channelHeat(state, 'street')).toBeLessThan(75);
  });

  /**
   * The thing the warning should have been about all along.
   *
   * `LAY_LOW_BY_CHANNEL` is 4 for street, 1 for money and 0 for inside — so
   * going quiet is a specific tool, not a universal solvent, and a player
   * pinned by an informant has to deal with the informant. That is a true and
   * useful warning; the tier one was neither.
   */
  it('does nothing at all for heat that is inside the family', () => {
    const state = game(8);
    setHeat(state, 'inside', 60);
    const before = channelHeat(state, 'inside');
    startLayLow(state);
    days(state, 10);
    expect(channelHeat(state, 'inside')).toBe(before);
  });

  it('barely touches heat that is on the books', () => {
    const state = game(9);
    setHeat(state, 'money', 60);
    const before = channelHeat(state, 'money');
    startLayLow(state);
    days(state, 10);
    const after = channelHeat(state, 'money');
    expect(after).toBeLessThan(before);
    // ...but far less than the same heat on the street would have moved.
    const street = game(9);
    setHeat(street, 'street', 60);
    startLayLow(street);
    days(street, 10);
    expect(before - after).toBeLessThan(60 - channelHeat(street, 'street'));
  });

  /**
   * The guard that stops this regressing into a lie again.
   *
   * If a future change puts the tier multiplier back on the decay path, the
   * top of the scale would stop clearing and the copy would silently become
   * true-but-for-the-wrong-reason. Asserting that a high tier still clears
   * pins the design decision rather than the arithmetic.
   */
  it('is not slowed by the tier the old copy blamed', () => {
    const low = game(11);
    setHeat(low, 'street', 30);
    startLayLow(low);
    days(low, 6);
    const lowShare = (30 - channelHeat(low, 'street')) / 30;

    const high = game(11);
    setHeat(high, 'street', 90);
    startLayLow(high);
    days(high, 6);
    const highShare = (90 - channelHeat(high, 'street')) / 90;

    // Proportionally, the top of the scale clears at least as fast.
    expect(highShare).toBeGreaterThanOrEqual(lowShare * 0.95);
  });
});

/**
 * The file with its commentary taken out.
 *
 * This has to be code-only, and the first version of this guard was not:
 * `Dashboard.tsx` carries a comment describing the round-11 version of this
 * same bug, quoting the sentence it removed. A test that cannot tell a
 * warning from a note about a warning would forbid the project from recording
 * why it changed anything.
 */
const CODE: string = DASHBOARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('what the button tells you about it', () => {
  it('is reading the screen it is asserting about', () => {
    expect(DASHBOARD).toBeTruthy();
    expect(DASHBOARD).toContain('Lay low');
  });

  /**
   * The exact regression, pinned.
   *
   * `HeatTier.decayMultiplier` governs `HEAT_ABSORPTION` and nothing else.
   * Any sentence on this button that quotes it is describing a number that
   * does not apply, which is what cost round 16's tester 36 days.
   */
  it('never quotes the tier rate at the player again', () => {
    const offenders = CODE.split('\n').filter((l) => /decayMultiplier/.test(l));
    expect(
      offenders,
      `the button is quoting a rate that governs absorption, not decay:\n${offenders.join('\n')}`,
    ).toHaveLength(0);
  });

  it('does not tell the player it will not work', () => {
    expect(CODE).not.toContain('will not clear it');
    expect(CODE).not.toContain('will not clear this');
  });

  /**
   * And it still says the thing that is true.
   *
   * Removing a false warning and leaving nothing would be a different defect:
   * going quiet genuinely does nothing about somebody talking, and a player
   * pinned by an informant needs telling.
   */
  it('still warns when the heat is the kind going dark cannot touch', () => {
    expect(CODE).toContain('mostlyElsewhere');
    expect(CODE.toLowerCase()).toContain('talking');
  });
});
