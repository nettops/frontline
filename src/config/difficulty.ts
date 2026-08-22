/**
 * Difficulty multipliers.
 *
 * Every system reads these rather than branching on difficulty, so adding a
 * new mode is one entry here.
 */

import type { DifficultyId } from '../sim/types';

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

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'easy',
    name: 'Easy',
    blurb: 'Room to make mistakes. Law enforcement is slow and your people are patient.',
    heatGain: 0.7,
    heatDecay: 1.5,
    successModifier: 0.08,
    payout: 1.15,
    expenses: 0.85,
    loyaltyDecay: 0.6,
    eventPressure: 0.7,
    ironman: false,
  },
  {
    id: 'normal',
    name: 'Normal',
    blurb: 'The intended experience. Mistakes cost, but they do not end you.',
    heatGain: 1,
    heatDecay: 1,
    successModifier: 0,
    payout: 1,
    expenses: 1,
    loyaltyDecay: 1,
    eventPressure: 1,
    ironman: false,
  },
  {
    id: 'hard',
    name: 'Hard',
    blurb: 'Heat sticks, crews get restless, and the margins are thin.',
    heatGain: 1.3,
    heatDecay: 0.75,
    successModifier: -0.06,
    payout: 0.88,
    expenses: 1.2,
    loyaltyDecay: 1.4,
    eventPressure: 1.35,
    ironman: false,
  },
  {
    id: 'brutal',
    name: 'Brutal',
    blurb:
      'One bad run can end the organization. No manual saves — you live with every decision.',
    heatGain: 1.6,
    heatDecay: 0.55,
    successModifier: -0.12,
    payout: 0.78,
    expenses: 1.4,
    loyaltyDecay: 1.9,
    eventPressure: 1.7,
    ironman: true,
  },
];

export const DIFFICULTY_BY_ID: Record<DifficultyId, DifficultyDef> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.id, d]),
) as Record<DifficultyId, DifficultyDef>;
