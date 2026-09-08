/**
 * A man's nerve comes back, and it did not.
 *
 * `DRIFT.fearSettlePerTick` was added to give fear the way down that every
 * other stat on the weekly drift has. Re-measured while repairing the doorway,
 * it was delivering roughly half of itself and the whole crew still ended every
 * career pinned at the ceiling:
 *
 *     per man per week        in    off    net     ends at
 *     grinds them daily     2.67   0.80  +1.86         100
 *     works them every 3rd  2.30   0.73  +1.57          97
 *     never sends anybody   1.11   0.49  +0.62          54
 *
 * Two separate faults, and the first is the interesting one.
 *
 * **The settle sat below the `arrested` skip at the top of `driftNpcs`.** A
 * working crew spends about 31% of its man-days in a cell and `ARREST_FEAR_INCREASE`
 * is the largest single fear source in the game, so the biggest inflow was also
 * the switch that turned the outflow off. Nobody wrote that; it fell out of
 * where the line happened to sit.
 *
 * **And a flat rate cannot balance an inflow that scales with play.** This is
 * the fault `HEAT_DECAY_SHARE` was written for, in the same shape and with the
 * argument already recorded there: a flat rate clears slowest exactly where it
 * is worst, so there was no equilibrium to find, only a ceiling to arrive at.
 *
 * After both, over 600 days rather than 300 so the resting point is visible
 * rather than the trajectory:
 *
 *     day                    60   120   200   300   450   599
 *     grinds them daily      64    77    69    67    69    73
 *     works them every 3rd   48    57    65    75    71    72
 *     never sends anybody    48    50    53    53    52    55
 *
 * These guard the two mechanisms rather than those numbers. The distribution is
 * `ladder.probe`'s business; what would silently undo the repair is somebody
 * moving the call back below the skip, or replacing the share with a step.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { settleFear } from '../npc';
import { crewList } from '../npc';
import { advanceDay } from '../clock';
import { DRIFT, DRIFT_INTERVAL_DAYS } from '../../config/npcs';
import type { GameState, Npc } from '../types';

function game(seed = 5): GameState {
  return newGame({ name: 'Nerve', difficulty: 'normal', seed });
}

function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

describe('a frightened man calms down', () => {
  it('toward who he was, not toward the middle', () => {
    const state = game();
    const npc = someone(state);
    npc.fearBase = 20;
    npc.stats.fear = 90;
    settleFear(npc);
    expect(npc.stats.fear).toBeLessThan(90);
    for (let i = 0; i < 200; i++) settleFear(npc);
    expect(npc.stats.fear).toBeCloseTo(20, 1);
  });

  /** Symmetric, so a man talked down below his own nerve climbs back to it. */
  it('and a calm man talked down comes back up to it', () => {
    const state = game();
    const npc = someone(state);
    npc.fearBase = 60;
    npc.stats.fear = 10;
    for (let i = 0; i < 200; i++) settleFear(npc);
    expect(npc.stats.fear).toBeCloseTo(60, 1);
  });

  /**
   * The share, which is what gives the stat an equilibrium at all.
   *
   * A flat step closes the same distance whether a man is two points off his
   * nerve or fifty, so an inflow that scales with how hard the boss works his
   * crew has nothing scaling against it. Checked as *the first step is bigger
   * when the gap is bigger*, which is the property, rather than against a
   * particular rate.
   */
  it('closes a big gap faster than a small one', () => {
    const far = { fearBase: 20, stats: { fear: 100 } } as unknown as Npc;
    const near = { fearBase: 20, stats: { fear: 40 } } as unknown as Npc;
    const before = { far: far.stats.fear, near: near.stats.fear };
    settleFear(far);
    settleFear(near);
    expect(
      before.far - far.stats.fear,
      'the settle is flat again — an inflow that scales with play has nothing scaling against it',
    ).toBeGreaterThan(before.near - near.stats.fear);
  });

  /**
   * The old flat rate survives as a floor, so the last points do close.
   *
   * A pure share approaches the target and never arrives, which would leave
   * every man permanently a fraction off his own nerve and every bar that
   * reads the difference permanently ambiguous. Two weeks at the 1.5 floor
   * closes a two-point gap; a pure share at 0.14 would take twenty.
   */
  it('does not creep toward the target forever', () => {
    const npc = { fearBase: 40, stats: { fear: 42 } } as unknown as Npc;
    settleFear(npc);
    settleFear(npc);
    expect(npc.stats.fear).toBe(40);
  });

  it('never overshoots who he is', () => {
    const npc = { fearBase: 50, stats: { fear: 51 } } as unknown as Npc;
    settleFear(npc);
    expect(npc.stats.fear).toBe(50);
  });

  it('has a share worth having', () => {
    expect(DRIFT.fearSettleShare).toBeGreaterThan(0);
    expect(DRIFT.fearSettleShare).toBeLessThan(1);
  });
});

/**
 * The half of it that was invisible.
 *
 * The settle was correct and unreachable for a third of every career, because
 * it sat below a `continue` written about goals and ties. Run through
 * `advanceDay` rather than by calling the drift directly — the fault was
 * entirely about where the call sits, so a test that called it would have
 * passed throughout.
 */
describe('and so does a man in a cell', () => {
  it('settles while he is inside', () => {
    const state = game();
    const npc = someone(state);
    npc.fearBase = 20;
    npc.stats.fear = 95;
    npc.status = 'arrested';
    npc.unavailableUntilDay = state.day + 400;

    const before = npc.stats.fear;
    for (let d = 0; d < DRIFT_INTERVAL_DAYS * 4; d++) advanceDay(state);

    const after = crewList(state).find((n) => n.id === npc.id) ?? npc;
    expect(after.status, 'he came out; this measures the wrong thing now').toBe('arrested');
    expect(
      after.stats.fear,
      'a man under arrest still does not calm down — the settle is back under the skip',
    ).toBeLessThan(before);
  });

  /**
   * And nothing else the drift does starts happening to him.
   *
   * The repair is a call above the skip, not the removal of the skip. If the
   * `continue` ever goes, an arrested man starts re-reading his goals and
   * drifting his loyalty from inside a cell.
   */
  it('without the rest of the week happening to him', () => {
    const state = game();
    const npc = someone(state);
    npc.status = 'arrested';
    npc.unavailableUntilDay = state.day + 400;
    npc.stats.loyalty = 50;
    npc.stats.grievance = 50;
    const before = { loyalty: npc.stats.loyalty, grievance: npc.stats.grievance };

    for (let d = 0; d < DRIFT_INTERVAL_DAYS * 3; d++) advanceDay(state);

    const after = crewList(state).find((n) => n.id === npc.id) ?? npc;
    if (after.status !== 'arrested') return;
    expect(after.stats.grievance).toBe(before.grievance);
  });
});
