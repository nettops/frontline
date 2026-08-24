/**
 * Heat has to come off faster when there is more of it.
 *
 * Measured over 101,664 career-days, the meter takes in 1.295 points a day and
 * gives back 0.924 — a standing 40% surplus, small enough to look harmless in
 * any single week and large enough to walk every career to the ceiling and
 * hold it there. Median heat is 80, a third of all days sit in the top band of
 * seven, and 0.469 points a day are discarded at the clamp, which means over a
 * quarter of everything the player does registers nowhere at all.
 *
 * The cause is not the quiet-days gate. That runs on 70.1% of days and was
 * wrongly blamed once already. The cause is that removal is flat while
 * generation is not, and that `decayMultiplier` falls from 1.0 to 0.22 as heat
 * rises — so the meter clears slowest exactly where it is most overloaded.
 * That is the ratchet these tests exist to prevent coming back.
 *
 * The design rule the falling curve was protecting stays: you cannot idle your
 * way down from 80. It is expressed in time now rather than as a rate that
 * collapses — a month of doing nothing, not a permanent condition. The last
 * test is the guard on the other side, because a meter pinned at the bottom is
 * no more use than one pinned at the top.
 *
 * See `docs/superpowers/specs/2026-08-23-heat-ratchet-design.md`.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { setHeat, tickHeat } from '../heat';
import { QUIET_DAYS_BEFORE_DECAY, heatTier } from '../../config/heat';
import type { GameState } from '../types';

/**
 * A family sitting still at a given reading.
 *
 * `quietDays` is set past the gate deliberately. What is under test is the
 * shape of the decay curve, not whether the gate opens — the gate works, and
 * a test that had to wait two days for it would be measuring both at once.
 */
function quiet(heat: number, seed = 5): GameState {
  const state = newGame({ name: 'Quiet', difficulty: 'normal', seed });
  setHeat(state, 'street', heat);
  state.org.quietDays = QUIET_DAYS_BEFORE_DECAY;
  return state;
}

/** What one quiet day takes off, at this reading. */
function shed(heat: number): number {
  const state = quiet(heat);
  const before = state.org.heat;
  tickHeat(state);
  return before - state.org.heat;
}

describe('heat comes off in proportion to how much there is', () => {
  it('takes more off a family at 90 than one at 40', () => {
    /*
       The whole finding in one assertion.

       Today `decayMultiplier` is 0.22 in the top band and 0.7 at 40, so a
       family drowning in attention sheds 0.30 a day and one merely under
       investigation sheds 0.96. The meter is slowest where the surplus is
       largest, which is what makes it a one-way door.
    */
    const high = shed(90);
    const low = shed(40);
    expect(
      high,
      `at 90 the meter sheds ${high.toFixed(2)} a day, at 40 it sheds ${low.toFixed(2)} — ` +
        'the ratchet is back',
    ).toBeGreaterThan(low);
  });

  it('rises monotonically across the whole scale', () => {
    // Not just the two ends. A curve that dips anywhere is a band a career can
    // get stuck in, which is the same defect at a smaller scale.
    const readings = [20, 35, 50, 65, 80, 95];
    const shedBy = readings.map((h) => ({ heat: h, off: shed(h) }));
    for (let i = 1; i < shedBy.length; i++) {
      expect(
        shedBy[i].off,
        `${shedBy[i].heat} sheds ${shedBy[i].off.toFixed(2)}, ` +
          `${shedBy[i - 1].heat} sheds ${shedBy[i - 1].off.toFixed(2)}`,
      ).toBeGreaterThan(shedBy[i - 1].off);
    }
  });
});

describe('going quiet is expensive in time, not impossible', () => {
  it('brings a family off the ceiling within a season', () => {
    /*
       The player-facing claim, and the one round 11 paid $5,154 for and did
       not get.

       From a full meter, doing nothing at all for ninety days: today that
       reaches about 57, because each band it drops into decays a little
       faster but never fast enough. Below 40 means the family has genuinely
       come back down — out of Major Investigation and into the range where
       the law's own momentum gate can finally engage.
    */
    const state = quiet(100);
    for (let d = 0; d < 90; d++) {
      state.day += 1;
      state.org.quietDays += 1;
      tickHeat(state);
    }
    expect(
      state.org.heat,
      `ninety days of doing nothing left the family at ${state.org.heat.toFixed(1)} ` +
        `(${heatTier(state.org.heat).name})`,
    ).toBeLessThan(40);
  });

  it('does not empty the meter in a week', () => {
    /*
       The guard on the other side, and the reason the coefficient was plotted
       rather than picked.

       One candidate shape put 41% of all career-days in the bottom two bands
       and p10 at zero — a law system that is decorative rather than one that
       is escapable. A week of quiet should be a dent, not an amnesty.
    */
    const state = quiet(80);
    for (let d = 0; d < 7; d++) {
      state.day += 1;
      state.org.quietDays += 1;
      tickHeat(state);
    }
    expect(
      state.org.heat,
      `a week of quiet took a family from 80 to ${state.org.heat.toFixed(1)} — too cheap`,
    ).toBeGreaterThan(55);
  });
});
