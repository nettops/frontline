/**
 * Difficulty multipliers.
 *
 * Every system reads these rather than branching on difficulty, so adding a
 * new mode is one entry here — and the entry is now in `tuning/difficulty.json`
 * rather than in this file, so changing one does not need a TypeScript
 * toolchain. What stays here is the shape and the reason for each field: JSON
 * cannot hold a comment, and a number nobody can read the intent of is a
 * number the next person changes by accident.
 */

import type { DifficultyId } from '../sim/types';
import { checkIds } from './tuning/check';
import data from './tuning/difficulty.json';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  blurb: string;
  /** Multiplies all heat gained. */
  heatGain: number;
  /** Multiplies heat decay. */
  heatDecay: number;
  /** Flat modifier added to every operation's success chance. */
  successModifier: number;
  /** Multiplies all operation payouts. */
  payout: number;
  /** Multiplies wages and other outgoings. */
  expenses: number;
  /** Multiplies loyalty losses. Betrayal comes faster on higher difficulty. */
  loyaltyDecay: number;
  /** Multiplies the chance of crew events firing. */
  eventPressure: number;
  /** Permadeath-style: no manual saves, autosave only. */
  ironman: boolean;
}

/*
   Normal's blurb was "Mistakes cost, but they do not end you" — round 18's
   blind report took that as a promise and read a war it treated as
   background noise as a mistake the game had said would not be fatal. It
   was fatal. The line was true of heat and money, which is everything
   this file's own numbers actually soften on Normal, and silent about a
   war, which none of them touch at all. Rewritten in
   `tuning/difficulty.json` to promise only what the numbers promise —
   noted here because JSON cannot hold the comment.
*/
export const DIFFICULTIES: DifficultyDef[] = data as DifficultyDef[];

checkIds('tuning/difficulty.json', 'difficulty id', DIFFICULTIES.map((d) => d.id), [
  'easy',
  'normal',
  'hard',
  'brutal',
]);

export const DIFFICULTY_BY_ID: Record<DifficultyId, DifficultyDef> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.id, d]),
) as Record<DifficultyId, DifficultyDef>;
