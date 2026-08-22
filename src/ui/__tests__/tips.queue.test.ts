/**
 * One tip must not be able to starve the other twenty-four.
 *
 * `nextTip` returns the first unseen tip whose predicate holds, and skips on
 * `seenKey` — which only `dismissTip` writes, from the "got it" button.
 * `markShown` writes a different key. So a tip whose condition stays true, on a
 * player who never clicks the button, sits at the head of the queue forever and
 * every later non-urgent tip is unreachable.
 *
 * Round 11 finished a 303-day career with "5 OF 25 SAID", all five inside the
 * first 42 days, and the same THE LAW tip pinned "ON SCREEN NOW" for 258 days.
 * `tips.reach.test.ts` says eighteen predicates become true in an ordinary
 * career, and it is right — they become true behind a tip nobody dismissed.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { markShown, nextTip, TIP_LINGER_DAYS } from '../tips';

describe('the tip queue', () => {
  it('moves past a tip that has been on screen long enough to have been read', () => {
    const state = newGame({ name: 'Tips', difficulty: 'normal', seed: 2 });

    const first = nextTip(state);
    expect(first).not.toBeNull();

    markShown(state, first!.id);
    // Same day: it is still the current advice and should not have moved on.
    expect(nextTip(state)?.id).toBe(first!.id);

    state.day += TIP_LINGER_DAYS + 1;
    const later = nextTip(state);
    expect(later?.id).not.toBe(first!.id);
  });

  it('does not retire a tip the player has not had time to read', () => {
    const state = newGame({ name: 'Tips', difficulty: 'normal', seed: 2 });
    const first = nextTip(state);
    markShown(state, first!.id);

    state.day += Math.max(1, TIP_LINGER_DAYS - 1);
    expect(nextTip(state)?.id).toBe(first!.id);
  });
});
