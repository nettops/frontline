/**
 * The tutorial.
 *
 * What is worth testing here is not the prose, it is the two properties that
 * make a hint system either a tutorial or a nag: a tip disappears when the
 * thing it is teaching has been done, and it never comes back once it has
 * been understood. Everything else is content.
 *
 * The last test in the file is the one that matters over time — every `when`
 * is a predicate over the whole game state, so a field renamed in `sim/` two
 * years from now should fail here rather than throw in front of a player.
 */

import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { runDaysSolvent } from '../../sim/__tests__/helpers';
import { recruit } from '../../sim/crew';
import {
  TIPS,
  dismissTip,
  markShown,
  nextTip,
  restoreAllTips,
  restoreTip,
  retiredOn,
  setTipsOff,
  shownOn,
} from '../tips';
import type { GameState } from '../../sim/types';

function fresh(mode: GameState['mode'] = 'career', seed = 7): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', mode, seed });
}

/** Brings in whoever is first in the recruit pool. */
function hire(state: GameState): void {
  const id = Object.keys(state.recruits)[0];
  const result = recruit(state, id);
  expect(result.ok).toBe(true);
}

/**
 * A job in the books. Written by hand rather than run, because the chain reads
 * nothing about it but the fact that one has finished — and running a real one
 * would make these tests depend on a die roll.
 */
function finishAJob(state: GameState): void {
  state.operationHistory.push({
    id: 'op_test',
    defId: 'corner_shakedown',
    name: 'Corner Shakedown',
    territoryId: Object.keys(state.territories)[0],
    day: state.day,
    success: true,
    margin: 0.2,
    payout: 400,
    heat: 1.5,
    crewIds: [],
    consequence: null,
  });
}

describe('the opening chain walks a new player forward', () => {
  it('starts by pointing at the first job', () => {
    const tip = nextTip(fresh());
    expect(tip?.id).toBe('first_job');
    expect(tip?.panel).toBe('operations');
  });

  it('moves on by itself once a job has been run', () => {
    const state = fresh();
    finishAJob(state);
    const tip = nextTip(state);
    expect(tip?.id).toBe('more_crew');
    expect(tip?.panel).toBe('crew');
  });

  it('stops asking for a second man once there is one', () => {
    const state = fresh();
    finishAJob(state);
    hire(state);
    expect(nextTip(state)?.id).not.toBe('more_crew');
  });

  it('does not teach a career to somebody who is only watching', () => {
    const tip = nextTip(fresh('simulation'));
    expect(tip?.id).toBe('watching');
  });

  it('leaves the opening out of a sandbox, where nobody starts from nothing', () => {
    const opening = TIPS.filter((t) => t.label === 'First steps').map((t) => t.id);
    const state = fresh('sandbox');
    // Walked forward rather than checked once: the chain is four deep, and
    // only asking about day one would pass even if the last three leaked.
    for (let i = 0; i < 6; i++) {
      expect(opening).not.toContain(nextTip(state)?.id);
      const tip = nextTip(state);
      if (!tip) break;
      dismissTip(state, tip.id);
    }
  });
});

describe('a tip that has landed stays gone', () => {
  it('is not offered again after it is dismissed', () => {
    const state = fresh();
    expect(nextTip(state)?.id).toBe('first_job');
    dismissTip(state, 'first_job');
    expect(nextTip(state)?.id).not.toBe('first_job');
  });

  it('says nothing at all when tips are switched off', () => {
    const state = fresh();
    setTipsOff(state, true);
    expect(nextTip(state)).toBeNull();
    setTipsOff(state, false);
    expect(nextTip(state)).not.toBeNull();
  });

  it('says nothing after the game is over', () => {
    const state = fresh();
    state.gameOver = { reason: 'Testing.', day: state.day };
    expect(nextTip(state)).toBeNull();
  });
});

describe('but nothing is actually lost', () => {
  it('can be put back on the strip', () => {
    const state = fresh();
    dismissTip(state, 'first_job');
    expect(nextTip(state)?.id).not.toBe('first_job');
    restoreTip(state, 'first_job');
    expect(nextTip(state)?.id).toBe('first_job');
  });

  it('can be put back all at once', () => {
    const state = fresh();
    for (const tip of TIPS) dismissTip(state, tip.id);
    expect(nextTip(state)).toBeNull();
    restoreAllTips(state);
    expect(nextTip(state)?.id).toBe('first_job');
  });

  it('records that a tip went past, even when nobody dismissed it', () => {
    // The whole opening chain works this way: it advances because the game
    // state moved, not because anybody clicked anything. Tracking only
    // dismissals would leave the page claiming the tutorial never happened.
    const state = fresh();
    state.day = 12;
    markShown(state, 'first_job');
    finishAJob(state);
    expect(nextTip(state)?.id).not.toBe('first_job');
    expect(shownOn(state, 'first_job')).toBe(12);
    expect(retiredOn(state, 'first_job')).toBeNull();
  });

  it('records the day a tip was retired, for the page that keeps them', () => {
    const state = fresh();
    state.day = 40;
    expect(retiredOn(state, 'first_job')).toBeNull();
    dismissTip(state, 'first_job');
    expect(retiredOn(state, 'first_job')).toBe(40);
  });

  it('stops offering the basics to an old organization', () => {
    const state = fresh();
    const capped = TIPS.filter((t) => t.ceiling !== undefined);
    expect(capped.length).toBeGreaterThan(0);
    // Everything the ceiling covers is still true on the day it stops being
    // said — the ceiling is about age, not about the condition going away.
    state.day = 400;
    for (const tip of capped) {
      expect(nextTip(state)?.id).not.toBe(tip.id);
    }
  });
});

describe('urgency', () => {
  it('puts heat ahead of the opening chain', () => {
    const state = fresh();
    expect(nextTip(state)?.id).toBe('first_job');
    state.org.heat = 60;
    expect(nextTip(state)?.id).toBe('heat');
  });
});

describe('the list itself', () => {
  it('has no duplicate ids', () => {
    const ids = TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads every state a game can be in without throwing', () => {
    for (const mode of ['career', 'sandbox', 'simulation'] as const) {
      const state = fresh(mode, 31);
      runDaysSolvent(state, 400);
      for (const tip of TIPS) {
        expect(() => tip.when(state)).not.toThrow();
      }
    }
  });
});
