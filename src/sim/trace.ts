/**
 * Why did that happen?
 *
 * Until this file existed the honest answer was "open faction.ts and read the
 * scoring functions, then set a breakpoint". The simulation made hundreds of
 * weighted decisions a year and kept only the winner — `currentObjective`
 * records what a family chose and nothing about what it beat, which is exactly
 * the half that would have explained it.
 *
 * A trace records the losing scores alongside the winning one. It is a ring
 * buffer, it is capped, and it is never read by the simulation: writing to it
 * must not be able to change an outcome, or the debugger becomes part of the
 * thing being debugged.
 */

import type { DecisionTrace, GameState } from './types';

/**
 * How many decisions to keep.
 *
 * Small on purpose. This lives in the save file, and a hundred years of rival
 * decisions would be several megabytes of diagnostics attached to a game
 * nobody is debugging. Two hundred is roughly a year of rival weeks.
 */
export const TRACE_LIMIT = 200;

export function record(
  state: GameState,
  entry: Omit<DecisionTrace, 'day'>,
): void {
  if (!state.trace) return;
  state.trace.unshift({ day: state.day, ...entry });
  if (state.trace.length > TRACE_LIMIT) state.trace.length = TRACE_LIMIT;
}

/**
 * The common case: a set of scored options where the highest wins.
 *
 * Takes the options already sorted or not, sorts a copy, and stores them
 * rounded — three decimal places is more than enough to answer "why did
 * pressure beat expand" and keeps the save small.
 */
export function recordChoice(
  state: GameState,
  actor: string,
  kind: string,
  options: { label: string; score: number }[],
  chose: string,
  because: string,
): void {
  const sorted = [...options]
    .sort((a, b) => b.score - a.score)
    .map((o) => ({ label: o.label, score: Math.round(o.score * 1000) / 1000 }));
  record(state, { actor, kind, chose, options: sorted, because });
}

/**
 * One decision as a sentence.
 *
 * The debug panel could print the numbers and leave the reader to it, but the
 * useful output of a tracer is the comparison — "chose pressure at 0.84, over
 * expand at 0.31" is the answer; a column of floats is the raw material for it.
 */
export function explain(trace: DecisionTrace): string {
  const [winner, runnerUp] = trace.options;
  if (!winner) return trace.because;
  const margin = runnerUp
    ? `, over ${runnerUp.label} at ${runnerUp.score.toFixed(2)}`
    : ' (nothing else scored)';
  return `${trace.chose} at ${winner.score.toFixed(2)}${margin}. ${trace.because}`;
}
