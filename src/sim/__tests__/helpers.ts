/**
 * Shared test helpers.
 */

import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { crewList } from '../npc';
import type { GameState, Npc } from '../types';

/**
 * Answers every pending event with its first open choice.
 *
 * grok.probe's bot models a curious player rather than an optimiser: it takes
 * every kind of move open to it rather than hunting for the cheapest, so the
 * record of what it did is a record of what the game was offering. Also the
 * default drain for `runDays`/`runDaysSolvent` below — it was a third inline
 * copy of this exact loop before this existed.
 */
export function answerFirst(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.pendingEvents.length && guard++ < 20) {
    const e = state.pendingEvents[0];
    const pick = e.choices.find((c) => !c.disabledReason) ?? e.choices[0];
    resolveEvent(state, rng, e.id, pick.id);
  }
}

/** A day's play, for the `onDay` hook below. `rng` is whichever one the run is using. */
type DayFn = (state: GameState, day: number, rng: Rng) => void;

interface RunDaysOptions {
  /** How to answer each day's events. Defaults to `answerFirst`. */
  answer?: (state: GameState, rng: Rng) => void;
  /** Runs once per day, after events are answered and before the day advances. */
  onDay?: DayFn;
}

/**
 * Advances `days` days, answering any event that comes up.
 *
 * Use this instead of `advanceDays` whenever a test means to cover a long
 * span. `advanceDays` deliberately stops the moment a new event needs the
 * player — correct for the UI, quietly disastrous in a test, where it turns
 * "run two years" into "run until the first thing happens", often two days.
 * Several invariant tests were doing exactly that before this existed.
 *
 * `options.onDay` is for a probe with its own per-day play — recruiting,
 * launching operations, whatever it's testing — so it doesn't have to
 * reimplement the surrounding loop, the event drain, and the gameOver guard
 * to get one. Omit it and this is exactly what it always was.
 */
export function runDays(
  state: GameState,
  days: number,
  rng = new Rng(state.rng),
  options?: RunDaysOptions,
): number {
  const answer = options?.answer ?? answerFirst;
  for (let i = 0; i < days; i++) {
    answer(state, rng);
    options?.onDay?.(state, i, rng);
    advanceDay(state);
    if (state.gameOver) return i + 1;
  }
  return days;
}

/**
 * Advances `days` while keeping the player solvent, so the world keeps
 * turning. For testing what happens around the player rather than to them.
 *
 * `options.floor` is the cash floor — 1,000,000 unless a probe needs its own,
 * because "keep it solvent" doesn't mean the same amount to every bot. See
 * `runDays` for `onDay`.
 */
export function runDaysSolvent(
  state: GameState,
  days: number,
  options?: RunDaysOptions & { floor?: number },
): number {
  const rng = new Rng(state.rng);
  const floor = options?.floor ?? 1_000_000;
  const answer = options?.answer ?? answerFirst;
  for (let i = 0; i < days; i++) {
    state.org.cash = Math.max(state.org.cash, floor);
    answer(state, rng);
    options?.onDay?.(state, i, rng);
    advanceDay(state);
    if (state.gameOver) return i + 1;
  }
  return days;
}

/** Middle value of a sample. Every probe reports medians rather than means. */
export function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/**
 * Answers every pending event with its cheapest open choice.
 *
 * The honest model of somebody trying not to go broke, and the policy a
 * player under financial pressure actually follows. Taking the first enabled
 * choice instead answers "send a real lawyer, $20,000" on a treasury of nine
 * hundred dollars, then reports the empty drawer as a flaw in the game.
 *
 * Was five byte-identical copies across the probe files before this. spread.
 * probe keeps its own — its header says why — everything else routes here.
 */
export function answerCheaply(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.pendingEvents.length && guard++ < 20) {
    const e = state.pendingEvents[0];
    const open = e.choices.filter((c) => !c.disabledReason);
    const priced = (c: { hint?: string }) => {
      const m = /\$([\d,]+)/.exec(c.hint ?? '');
      return m ? Number(m[1].replace(/,/g, '')) : 0;
    };
    const pick = open.length
      ? open.reduce((a, b) => (priced(a) <= priced(b) ? a : b))
      : e.choices[0];
    resolveEvent(state, rng, e.id, pick.id);
  }
}

/** Crew members free to be sent on something. */
export function idle(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

/**
 * Expected money per crew-day: payout times odds, over the time it locks up.
 *
 * Solo work occupies you rather than a crew member, so it is costed as one
 * body for the purpose of comparing it against everything else. Without the
 * floor, a zero-crew job (`work_it_yourself`) divides by zero and sorts first
 * unconditionally — the bug one uncoupled copy of this function carried.
 */
export function ev(o: {
  payout: [number, number];
  baseSuccess: number;
  crewRequired: number;
  durationDays: number;
}): number {
  const bodies = Math.max(1, o.crewRequired);
  return (((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess) / (bodies * o.durationDays);
}
