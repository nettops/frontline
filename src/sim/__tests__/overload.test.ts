/**
 * Laundering capacity as a risk dial rather than a wall.
 *
 * Capacity used to be a hard ceiling: `moved = min(capacity, washable)`, and
 * anything past it simply sat in the room as dirty money. Measured across 36
 * careers of 300 days, that ceiling turned out to be the thing standing between
 * the contraband trade and the rest of the game — **once a trade is running the
 * fronts were saturated on 74% of paydays**, the trade earned a median
 * $1,632,268 and moved what the family is worth by 6.5%, and `estate` counts
 * clean money and never counts dirty. See HANDOFF F22.
 *
 * So the wall is gone. You can wash whatever you like through whatever you own.
 * What capacity buys now is **how hard you are leaning on the place**:
 *
 *     exposure += (moved / capacity) * exposureRate
 *
 * At or under capacity that is exactly the arithmetic it always was, so a
 * careful family sees no change at all. Past it the term goes above one and the
 * front ages at the rate you are pushing it — and exposure is already wired to
 * heat above 50, to `finance` evidence above 70, to the health pressure that
 * kills a front, and to which books a financial investigation subpoenas first.
 * Nothing new had to be built for the consequence; it was all already there,
 * behind a ceiling that stopped anybody reaching it.
 *
 * The trade being made, stated plainly so nobody rediscovers it as a bug: a
 * family with one small front and a large trade *can* wash all of it, and will
 * lose the front. More premises is the answer, and it is now a decision with a
 * number on both sides rather than a queue.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import {
  launderCapacity,
  launderCut,
  launderOutlook,
  ownedBusinesses,
  tickBusinesses,
} from '../business';
import { EXPOSURE_EVIDENCE_ABOVE } from '../../config/businesses';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { weeklyWageBill } from '../economy';
import { withFronts } from './helpers';
import type { Business, GameState } from '../types';

/** A family with premises, sitting on a payday, holding nothing but dirty cash. */
function laundry(fronts = 1, dirty = 40_000, lean = true, seed = 31): GameState {
  const state = newGame({
    name: 'Wash',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  const made = withFronts(state, fronts);
  expect(made.length, 'the board could not supply the fronts this test needs').toBe(fronts);
  // Leaning on them. The ceiling only comes off where the player has said so —
  // a front nobody has touched behaves exactly as it always did, which is the
  // subject of its own case below.
  if (lean) for (const b of made) b.pressure = 'hard';
  state.org.cash = 0;
  state.org.dirtyCash = dirty;
  // On the boundary. `tickBusinesses` is gated on the payday interval, and a
  // fixture that sits one day off it measures a week that never ran — the
  // clock trap this project has now met three times.
  state.day = PAYDAY_INTERVAL * (Math.floor(state.day / PAYDAY_INTERVAL) + 1);
  return state;
}

const totalCapacity = (state: GameState) =>
  ownedBusinesses(state).reduce((sum, b) => sum + launderCapacity(state, b), 0);

function wash(state: GameState): { laundered: number; capacity: number } {
  tickBusinesses(state, new Rng(state.rng));
  const r = state.lastLaunderReport!;
  return { laundered: r.laundered, capacity: r.capacity ?? 0 };
}

describe('capacity no longer stops money', () => {
  it('washes a pile far larger than the fronts could ever hold', () => {
    const state = laundry(1, 400_000);
    const capacity = totalCapacity(state);
    expect(capacity, 'the fixture has no capacity, so this proves nothing').toBeGreaterThan(0);
    expect(capacity, 'the pile is not actually larger than the capacity').toBeLessThan(400_000);

    const run = wash(state);
    expect(
      run.laundered,
      'the ceiling is still there — money past capacity did not move',
    ).toBeGreaterThan(capacity);
    expect(
      state.org.dirtyCash,
      'a week of washing left most of the pile in the room',
    ).toBeLessThan(40_000);
  });

  it('still holds the wage bill back, and still takes the cut', () => {
    // Two rules that were right before and are not what changed. Washing the
    // payroll means paying the cut on money that goes out the same day.
    const state = laundry(1, 400_000);
    const before = state.org.cash;
    const run = wash(state);
    expect(state.org.dirtyCash, 'the payroll was washed too').toBeGreaterThan(0);
    expect(
      state.org.cash - before,
      'the whole sum arrived clean, so nobody took a cut',
    ).toBeLessThan(run.laundered);
    expect(launderCut(state)).toBeGreaterThan(0);
  });
});

describe('what capacity buys instead', () => {
  it('ages a front in proportion to how hard it was pushed', () => {
    /*
       The feature, in one comparison. Same front, same week, two pile sizes:
       one comfortably inside capacity and one several times past it.
    */
    const easy = laundry(1, 0);
    easy.org.dirtyCash = weeklyWageBill(easy) + Math.round(totalCapacity(easy) * 0.5);
    const hard = laundry(1, 0);
    hard.org.dirtyCash = weeklyWageBill(hard) + Math.round(totalCapacity(hard) * 6);

    const front = (s: GameState) => ownedBusinesses(s)[0] as Business;
    const easyBefore = front(easy).exposure;
    const hardBefore = front(hard).exposure;
    wash(easy);
    wash(hard);

    const easyGain = front(easy).exposure - easyBefore;
    const hardGain = front(hard).exposure - hardBefore;
    expect(
      hardGain,
      'leaning six times as hard on a front costs no more than leaning half as hard',
    ).toBeGreaterThan(easyGain);
  });

  it('leaves a family inside its capacity exactly where it was', () => {
    /*
       The other half, and the one that makes this safe to ship. Under capacity
       the term is `moved / capacity` with `moved <= capacity`, which is the
       arithmetic that was always there. A careful family must not be able to
       tell that anything changed.
    */
    const state = laundry(1, 0);
    const capacity = totalCapacity(state);
    state.org.dirtyCash = weeklyWageBill(state) + Math.round(capacity * 0.4);
    const front = ownedBusinesses(state)[0];
    const before = front.exposure;
    const run = wash(state);

    expect(run.laundered, 'nothing moved, so the comparison is empty').toBeGreaterThan(0);
    expect(run.laundered, 'this week was meant to be inside capacity').toBeLessThanOrEqual(
      run.capacity,
    );
    // Under capacity a week can even cool a front off — what it must not do is
    // heat one up more than a hard week would.
    expect(front.exposure - before).toBeLessThan(2);
  });

  it('leaves a front nobody has touched exactly where it was', () => {
    /*
       The promise the whole design rests on, and the reason the first attempt
       was thrown away.

       Taking the wall off for everybody was measured across 36 careers: median
       peak estate fell 29% and trade income fell 85%, while cases opened,
       careers ended and fronts lost were *identical*. It did not deliver the
       risk and it did cost the player — the family paid the cut on money it
       was going to spend as dirty anyway, and every front sat permanently over
       the decay threshold. So the ceiling only lifts where the dial says to
       lean, and `config/pressure.ts` opens by promising that a front you never
       touch behaves exactly as it did before that file existed.
    */
    const state = laundry(1, 0, false);
    const capacity = totalCapacity(state);
    state.org.dirtyCash = weeklyWageBill(state) + capacity * 10;
    const run = wash(state);

    expect(run.laundered, 'the ceiling came off a front nobody leaned on').toBeLessThanOrEqual(
      run.capacity,
    );
    expect(
      state.org.dirtyCash,
      'the whole pile went through a front set to behave itself',
    ).toBeGreaterThan(capacity);
  });

  it('spreads the load across premises instead of burning the first one', () => {
    /*
       Written after the obvious implementation failed this on paper. The loop
       walks the fronts in order taking `washable - laundered` each time, so
       without a proportional split the first business in the list absorbs the
       entire pile and every other one records nothing — one front at maximum
       exposure and three untouched, from a family that owns four.
    */
    const state = laundry(3, 0);
    state.org.dirtyCash = weeklyWageBill(state) + Math.round(totalCapacity(state) * 5);
    wash(state);

    const moved = ownedBusinesses(state).map((b) => b.lastLaundered);
    expect(moved.every((m) => m > 0), 'a front carried none of it').toBe(true);
    const share = ownedBusinesses(state).map(
      (b) => b.lastLaundered / Math.max(1, launderCapacity(state, b)),
    );
    // Every front pushed to the same multiple of what it can comfortably hold.
    expect(Math.max(...share) - Math.min(...share)).toBeLessThan(0.5);
  });
});

describe('and the risk is real, not a number on a panel', () => {
  it('writes evidence against a family that keeps pushing', () => {
    /*
       End to end through the real tick, because a unit test on the exposure
       arithmetic would prove only that a number went up. Exposure over 70
       produces `finance` evidence at a quarter chance a week, and that is what
       an investigation reads.
    */
    const state = laundry(1, 0);
    const capacity = totalCapacity(state);
    let sawEvidence = false;
    for (let d = 0; d < 200 && !state.gameOver; d++) {
      state.org.dirtyCash = Math.max(state.org.dirtyCash, capacity * 8);
      advanceDay(state);
      if (Object.values(state.evidence).some((e) => e.source === 'finance')) {
        sawEvidence = true;
        break;
      }
    }
    const worst = Math.max(0, ...ownedBusinesses(state).map((b) => b.exposure));
    expect(
      worst > EXPOSURE_EVIDENCE_ABOVE || sawEvidence,
      'six months of washing eight times capacity through one front went unnoticed',
    ).toBe(true);
  });
});

describe('the outlook says which state you are in', () => {
  it('no longer claims capacity is a ceiling', () => {
    const state = laundry(1, 0);
    state.org.dirtyCash = weeklyWageBill(state) + Math.round(totalCapacity(state) * 4);
    const outlook = launderOutlook(state);
    expect(outlook.limit, 'the panel still calls capacity a wall').not.toBe('capacity');
    expect(
      outlook.washable,
      'the readout still caps what will move at what the fronts hold',
    ).toBeGreaterThan(outlook.capacity);
    expect(outlook.load, 'the readout does not say how hard this is leaning').toBeGreaterThan(1);
  });

  it('still says when nothing will move', () => {
    const state = laundry(1, 0);
    state.org.dirtyCash = 10;
    expect(launderOutlook(state).limit).toBe('nothing');
    expect(launderOutlook(state).clean).toBe(0);
  });
});
