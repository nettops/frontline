/**
 * The two halves of the answer: a boss rises and falls, a family goes on.
 *
 * The seven ranks were a personal ladder and the organization outlives the
 * person climbing it. Those two facts used to cancel each other — a successor
 * inherited the crew and the districts, and then the rank table asked him what
 * *he* held, so three years of work stopped counting the day somebody shot the
 * boss. Measured: Capo arrived on day 673 without succession and day 1,177
 * with it, which is a treadmill rather than a dynasty.
 *
 * The table is gone and `org.record` — the family's high-water marks — is what
 * survived it. It is still read, by the front-health floor in `business.ts`
 * and by `legacy.ts`, so the claims below moved off the deleted
 * `rankRequirements` rows and onto the record itself. That is the more direct
 * assertion anyway: the rows were a proxy one step removed from the quantity
 * they reported.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { tickRecord } from '../player';
import { inheritRank } from '../succession';
import { putAway } from '../economy';
import { RANKS } from '../../config/economy';
import type { GameState } from '../types';

function world(): GameState {
  return newGame({ name: 'Dynasty', difficulty: 'normal', seed: 21 });
}

/** The best the family has ever been worth, which is the thing that persists. */
const everWorth = (state: GameState) => state.org.record?.estate;

describe('what the family has ever managed', () => {
  it('remembers a peak the organization no longer holds', () => {
    const state = world();
    state.org.cash = 40_000;
    tickRecord(state);
    expect(state.org.record?.estate).toBe(40_000);

    // Spent it all on a bad week.
    state.org.cash = 0;
    tickRecord(state);
    expect(everWorth(state)).toBe(40_000);
  });

  /*
     The trade this makes, stated so nobody rediscovers it as a bug.

     The old rank table could move away from a player who stopped earning, and
     a comment in player.ts called that the point. A high-water mark gives that
     up on purpose: a rung once earned stays earned, because the alternative is
     a family that cannot climb across generations.
  */
  it('does not take a rung back when the money goes', () => {
    const state = world();
    state.org.cash = 40_000;
    tickRecord(state);
    const before = everWorth(state);
    state.org.cash = 12;
    tickRecord(state);
    expect(everWorth(state)).toBe(before);
  });

  it('counts money put away as well as money in the wallet', () => {
    const state = world();
    state.org.cash = 30_000;
    putAway(state, 25_000);
    tickRecord(state);
    // The wallet plus what was put away, plus whatever ground the starting
    // district is worth — so at least the money, and never less for having
    // moved some of it somewhere safe.
    expect(state.org.record?.estate).toBeGreaterThanOrEqual(30_000);
  });

  /*
     Operations accumulate across bosses rather than peaking.

     `player.opsCompleted` is replaced by the successor's own count at a
     handover, so a maximum would freeze the family total the moment a boss
     with a long record was replaced by a soldier with a short one.
  */
  it('adds up operations across a change of boss', () => {
    const state = world();
    state.player.opsCompleted = 30;
    tickRecord(state);
    expect(state.org.record?.ops).toBe(30);

    // A handover: the new man brings his own, much smaller, record.
    state.player.opsCompleted = 4;
    tickRecord(state);
    expect(state.org.record?.ops).toBe(30);

    state.player.opsCompleted = 9;
    tickRecord(state);
    expect(state.org.record?.ops).toBe(35);
  });

  it('starts keeping a record on a save that has none', () => {
    const state = world();
    // Narrowed by hand: `delete` on an optional field leaves TypeScript
    // certain it is undefined for the rest of the block.
    delete state.org.record;
    state.org.respect = 77;
    tickRecord(state);
    const kept = state.org.record as GameState['org']['record'];
    expect(kept?.respect).toBe(77);
  });
});

describe('a rung is lost only by a boss who left no plan', () => {
  /*
     The rung is not what a bad handover costs any more. The ground is.

     `HANDOVER.ranksLost` docked the successor a rung back when a rung decided
     what work they could take, what they could trade in and how many people
     they could hold. All of that reads the board now, so docking a title would
     be a cosmetic punishment for the one event in the game that most needs a
     real one — and the real one was already there: `influenceKept` takes
     districts off them, and the job table, the trades and the crew cap all
     narrow the moment those fall. Losing ground *is* losing rank.

     So the claim moves to where it now lives, and is checked end to end in
     `succession.test.ts` rather than on a pure function of a title.
  */
  it('leaves the title alone, because the title no longer costs anything', () => {
    expect(inheritRank('capo')).toBe('capo');
    expect(inheritRank(RANKS[0].id)).toBe(RANKS[0].id);
  });
});
