/**
 * What each person is actually after.
 *
 * Until now a member of the organization was a bundle of eleven stats and a
 * set of thresholds: cross a loyalty line and an event fires. That produces
 * behaviour, but it does not produce a *reason* — nobody in the crew wanted
 * anything, they only reacted to how the numbers had drifted.
 *
 * A goal is one string per person, chosen from this catalogue by the same
 * condition-and-weight machinery the event system uses, and re-picked weekly
 * as their situation changes. It does three things: it biases their loyalty
 * drift, it changes how attractive a rival's offer is, and it changes what
 * they will do in the room when you are gone.
 *
 * The player does not get a list of these. A goal reads through the same fog
 * as every hidden stat — see `perceivedGoal` — so what you get is a phrase
 * that may or may not be what the man is really doing.
 */

import type { GoalBoard, GoalSubject } from '../sim/types';

export interface GoalEffects {
  /** Added to the weekly loyalty drift. */
  loyaltyPerWeek?: number;
  /** Multiplies a rival's chance of turning them. */
  poachable?: number;
  /** Multiplies their claim on the chair when you are removed. */
  claim?: number;
  /** Added to ambition each week, so a goal can grow into a problem. */
  ambitionPerWeek?: number;
  /** Multiplies evidence they leave. Somebody looking for an exit is careless. */
  exposure?: number;
}

export interface GoalDef {
  id: string;
  /** How it reads to a player who knows them well. Never a stat. */
  label: string;
  /** The longer line, for the crew sheet. */
  blurb: string;
  weight: number;
  /**
   * Whether this is a live possibility for this person right now. Reads a
   * small summary of the person and the board rather than GameState, so this
   * file stays config and cannot import the simulation.
   */
  applies(s: GoalSubject, b: GoalBoard): boolean;
  effects: GoalEffects;
}

export const GOALS: GoalDef[] = [
  {
    id: 'earn',
    label: 'Wants to earn',
    blurb: 'They are here for the money and have never pretended otherwise.',
    weight: 30,
    applies: (s) => s.greed > 45,
    effects: { poachable: 1.25, loyaltyPerWeek: -0.2 },
  },
  {
    id: 'move_up',
    label: 'Wants the next rung',
    blurb: 'They can see the job above theirs and have started measuring it.',
    weight: 28,
    applies: (s) => s.ambition > 45 && !s.senior,
    effects: { ambitionPerWeek: 0.3, poachable: 1.2, claim: 1.1, loyaltyPerWeek: -0.3 },
  },
  {
    id: 'run_it',
    label: 'Wants the chair',
    blurb: 'Not a promotion. The whole thing.',
    weight: 14,
    applies: (s) => s.ambition > 68 && s.senior,
    effects: { claim: 1.35, ambitionPerWeek: 0.5, loyaltyPerWeek: -0.7, poachable: 0.8 },
  },
  {
    id: 'belong',
    label: 'Wants to belong to something',
    blurb: 'The organization is the point. They would be lost without it.',
    weight: 22,
    applies: (s) => s.loyalty > 55 && s.ambition < 55,
    effects: { loyaltyPerWeek: 0.9, poachable: 0.45, claim: 0.9 },
  },
  {
    id: 'protect',
    label: 'Wants to keep their people safe',
    blurb: 'They have somebody at home and everything else is arithmetic around that.',
    weight: 20,
    applies: (s) => s.fear > 45 || s.familyMan,
    effects: { loyaltyPerWeek: 0.2, poachable: 0.75, claim: 0.85 },
  },
  {
    id: 'survive',
    label: 'Wants to get through this',
    blurb: 'They are frightened and it is not abstract. They are counting doors.',
    weight: 26,
    applies: (s, b) => s.fear > 50 && (b.heat > 45 || b.worstCaseStage >= 3),
    effects: { loyaltyPerWeek: -0.8, exposure: 1.3, poachable: 1.15, claim: 0.7 },
  },
  {
    id: 'get_out',
    label: 'Wants out',
    blurb: 'They have stopped arguing in meetings, which is not agreement.',
    weight: 18,
    applies: (s) => s.loyalty < 38 || s.grievance > 45,
    effects: { loyaltyPerWeek: -1.2, poachable: 1.7, exposure: 1.4, claim: 0.5 },
  },
  {
    id: 'settle_up',
    label: 'Wants somebody to answer for something',
    blurb: 'There is a name they do not say, and they have not let it go.',
    weight: 16,
    applies: (s) => s.worstTieResentment > 40,
    effects: { loyaltyPerWeek: -0.4, ambitionPerWeek: 0.2, claim: 1.05 },
  },
  {
    id: 'be_known',
    label: 'Wants a name on the street',
    blurb: 'Money is fine. Being somebody is the actual objective.',
    weight: 16,
    applies: (s) => s.leadership > 50 && s.courage > 45,
    effects: { claim: 1.2, ambitionPerWeek: 0.25, poachable: 1.1 },
  },
  {
    id: 'go_straight',
    label: 'Wants a quiet life',
    blurb: 'They talk about a business. A real one. They may even mean it.',
    weight: 10,
    applies: (s) => s.age > 52 && s.ambition < 45,
    effects: { loyaltyPerWeek: -0.3, poachable: 0.6, claim: 0.4, exposure: 0.8 },
  },
];

export const GOAL_BY_ID: Record<string, GoalDef> = Object.fromEntries(
  GOALS.map((g) => [g.id, g]),
);

/**
 * How long somebody sticks with a goal before the weekly re-evaluation is
 * allowed to move them off it.
 *
 * Without a floor, a man whose stats sit near a threshold flips between two
 * goals every week and reads as having no character at all — the same failure
 * mode a random event table has, arrived at from the other direction.
 */
export const GOAL_MIN_DAYS = 42;

/** Familiarity needed before the player gets any read on what somebody wants. */
export const GOAL_VISIBLE_ABOVE = 35;
/** ...and before the read is the truth rather than the obvious guess. */
export const GOAL_CERTAIN_ABOVE = 70;
