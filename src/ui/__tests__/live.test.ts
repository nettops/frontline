/**
 * The wire's two pure pieces. The pacing is a timer in the component and not
 * testable worth a damn; what is testable is that the feed shows exactly what
 * happened since you started watching, and that the wire pauses for the same
 * three reasons the clock already stops.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/state';
import type { GameState, LogEntry } from '../../sim/types';
import { liveBlocked, newEntriesSince } from '../live';

function fresh(seed = 11): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

const entry = (text: string): LogEntry => ({ day: 1, text, kind: 'event' });

describe('the wire feed', () => {
  it('returns everything newer than the marker, newest first', () => {
    const marker = entry('old news');
    const log = [entry('third'), entry('second'), entry('first'), marker, entry('older')];
    expect(newEntriesSince(log, marker).map((e) => e.text)).toEqual([
      'third',
      'second',
      'first',
    ]);
  });

  it('returns the whole log when the marker has been trimmed off the end', () => {
    const marker = entry('gone');
    const log = [entry('b'), entry('a')];
    expect(newEntriesSince(log, marker)).toHaveLength(2);
  });

  it('returns nothing when nothing has happened yet', () => {
    const marker = entry('now');
    expect(newEntriesSince([marker, entry('older')], marker)).toEqual([]);
    expect(newEntriesSince([], null)).toEqual([]);
  });
});

describe('what stops the wire', () => {
  it('pauses for a memo, a sit-down, and the end of the game — nothing else', () => {
    const state = fresh();
    expect(liveBlocked(state)).toBe(false);
    state.pendingEvents.push({} as never);
    expect(liveBlocked(state)).toBe(true);
    state.pendingEvents.length = 0;
    state.sitdown = {} as never;
    expect(liveBlocked(state)).toBe(true);
    state.sitdown = null;
    state.gameOver = { day: 1, reason: 'test' } as never;
    expect(liveBlocked(state)).toBe(true);
  });
});
