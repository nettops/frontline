/**
 * The wire — the pure half of watching the game run.
 *
 * Live mode drives the identical `advanceDay` the +1 day button drives, one
 * day per timer tick, so a watched week and a pressed week are the same week
 * to the simulation. That is the whole fairness guarantee, and it is why
 * this file contains no stepping logic of its own: there is nothing here
 * that could diverge.
 *
 * What it does own is the two readings the component needs: which log
 * entries arrived since watching began, and whether the wire is allowed to
 * tick right now.
 */
import type { GameState, LogEntry } from '../sim/types';

/** Days per second at each speed. The wire ticks one day at a time. */
export const LIVE_SPEEDS = [
  { label: '1×', ms: 1100 },
  { label: '2×', ms: 550 },
  { label: '4×', ms: 240 },
] as const;

/**
 * Everything logged since `marker` was the newest entry, newest first.
 *
 * The marker is the entry object itself rather than a count or a day,
 * because the log is capped and prepended: a count goes wrong the moment
 * the cap trims the tail, and a day cannot separate the morning you
 * started watching from the afternoon. Identity survives both — and when
 * the marker itself has been trimmed away, everything still held is newer
 * than it by definition.
 */
export function newEntriesSince(log: LogEntry[], marker: LogEntry | null): LogEntry[] {
  if (!marker) return log;
  const at = log.indexOf(marker);
  return at === -1 ? [...log] : log.slice(0, at);
}

/**
 * The three things that stop the clock stop the wire, and nothing else
 * does. Same reasons as `step` in App.tsx: a memo and a sit-down are
 * questions, and a question answered a week late is a different question.
 */
export function liveBlocked(state: GameState): boolean {
  return !!state.gameOver || state.pendingEvents.length > 0 || !!state.sitdown;
}
