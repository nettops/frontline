/**
 * Scores: the month in front of the job.
 *
 * The design note is `docs/superpowers/specs/2026-08-23-scores-and-setups-design.md`.
 * What follows is the table it asks for, and three decisions in it are worth
 * saying out loud because they are the ones that keep this from becoming a
 * money printer.
 *
 * **Setups yield things, not multipliers.** An earlier draft had them grant an
 * abstract bag — some success, some payout, some crew. Payout is gone from the
 * design entirely. None of the five things below is naturally "you get paid
 * more": a car is about getting out, masks are about not being identified,
 * clean guns are about not leaving a trail. Letting the fiction pick the lever
 * is what stopped prep dragging toward being an income multiplier.
 *
 * **Gear does not persist.** It is used on the night and then got rid of, so
 * the second target costs as much work as the first and a career cannot solve
 * prep once. There is no permanent kit to assemble.
 *
 * **Every setup is an ordinary job.** These are `OperationDef`s and they run
 * through `launchOperation` unchanged — same crew, same district, same
 * approach, same consequence table when they go wrong. They pay nothing, they
 * never reach the job board, and they are excluded from the lifetime
 * operations count two live gates read. That exclusion is `scores.test.ts`'s
 * business and it is the one risk this feature carries into existing systems.
 */

import type { AttributeId, OperationDef } from '../sim/types';

export type GearId = 'wheels' | 'masks' | 'clean_guns' | 'floor_plan' | 'inside_man';

export interface GearDef {
  id: GearId;
  name: string;
  /** What having it means, on the panel. */
  blurb: string;
  /** Added to the odds on the job at the end of it. */
  success: number;
  /** Bodies the job no longer needs. Never takes a job below one man. */
  crewRelief: number;
  /** Multiplies the attention the job draws. Below 1 is quieter. */
  heat: number;
  /**
   * How much of it there is to get rid of afterwards.
   *
   * A car is the hardest thing in this list to lose and a floor plan is the
   * easiest, which is why the piece that helps the least on the night costs
   * the most three days later. That is the trade the disposal phase exists to
   * make.
   */
  bulk: number;
}

export const GEAR: GearDef[] = [
  {
    id: 'floor_plan',
    name: 'A floor plan',
    blurb: 'Somebody walked it, counted the doors, and drew it out. Nobody has to guess.',
    success: 0.1,
    crewRelief: 1,
    heat: 1,
    bulk: 0.25,
  },
  {
    id: 'inside_man',
    name: 'Somebody inside',
    blurb: 'Somebody who works there and would rather be paid twice.',
    success: 0.12,
    crewRelief: 2,
    heat: 1,
    bulk: 0.35,
  },
  {
    id: 'wheels',
    name: 'A car',
    blurb: 'Nobody has reported it missing yet, and the plates came off a wreck.',
    success: 0.08,
    crewRelief: 0,
    heat: 0.9,
    bulk: 1,
  },
  {
    id: 'masks',
    name: 'Outfits and masks',
    blurb: 'Nobody who sees you can say afterwards which of you was which.',
    success: 0.06,
    crewRelief: 0,
    heat: 0.75,
    bulk: 0.5,
  },
  {
    id: 'clean_guns',
    name: 'Clean guns',
    blurb: 'Nothing that has been fired before, and nothing that goes home with anybody.',
    success: 0.07,
    crewRelief: 1,
    heat: 0.9,
    bulk: 0.8,
  },
];

export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(
  GEAR.map((g) => [g.id, g]),
);

/**
 * A setup is an operation that pays nothing and comes away with a thing.
 *
 * Five of them, shared across every target rather than written out per job.
 * Twenty-five near-identical rows would be the same table with more places for
 * it to drift, and the texture the design wants comes from `SCORE_TARGETS`
 * below deciding which of the five each job can actually use.
 *
 * Tier 2 on purpose. `heatScale` reads the gap between the player's standing
 * and the job's tier, so preparing a Port Operation draws roughly what a
 * middling job draws — which is the point of doing it in pieces.
 */
export interface SetupDef extends OperationDef {
  /** What you come away with. */
  yields: GearId;
}

export const SETUPS: SetupDef[] = [
  {
    id: 'setup_case',
    name: 'Case the Place',
    description:
      'Two weeks of somebody sitting across the street with a newspaper, writing down when the doors open.',
    tier: 2,
    risk: 'low',
    crewRequired: 1,
    investment: 400,
    payout: [0, 0],
    durationDays: 4,
    baseSuccess: 0.92,
    heatOnSuccess: 2,
    heatOnFailure: 5,
    attribute: 'strategy' as AttributeId,
    respect: 0,
    yields: 'floor_plan',
  },
  {
    id: 'setup_inside',
    name: 'Turn Somebody Inside',
    description:
      'Find whoever is behind on something, and make being helpful the cheaper way out.',
    tier: 2,
    risk: 'low',
    crewRequired: 2,
    investment: 1_800,
    payout: [0, 0],
    durationDays: 5,
    baseSuccess: 0.84,
    heatOnSuccess: 3,
    heatOnFailure: 9,
    attribute: 'negotiation' as AttributeId,
    respect: 0,
    yields: 'inside_man',
  },
  {
    id: 'setup_wheels',
    name: 'Steal a Car',
    description: 'Something ordinary, taken from somewhere nobody will look, plated off a wreck.',
    tier: 2,
    risk: 'low',
    crewRequired: 2,
    investment: 500,
    payout: [0, 0],
    durationDays: 3,
    baseSuccess: 0.88,
    heatOnSuccess: 3,
    heatOnFailure: 7,
    attribute: 'streetSmarts' as AttributeId,
    respect: 0,
    yields: 'wheels',
  },
  {
    id: 'setup_masks',
    name: 'Outfits and Masks',
    description: 'Work clothes, gloves and something over the face. Bought in four different shops.',
    tier: 2,
    risk: 'low',
    crewRequired: 1,
    investment: 300,
    payout: [0, 0],
    durationDays: 2,
    baseSuccess: 0.92,
    heatOnSuccess: 1.5,
    heatOnFailure: 4,
    attribute: 'streetSmarts' as AttributeId,
    respect: 0,
    yields: 'masks',
  },
  {
    id: 'setup_guns',
    name: 'Buy Clean Guns',
    description: 'Nothing with a history, from somebody who does not ask and does not remember.',
    tier: 2,
    risk: 'low',
    crewRequired: 2,
    investment: 2_500,
    payout: [0, 0],
    durationDays: 3,
    baseSuccess: 0.86,
    heatOnSuccess: 4,
    heatOnFailure: 11,
    attribute: 'streetSmarts' as AttributeId,
    respect: 0,
    yields: 'clean_guns',
  },
];

export const SETUP_BY_ID: Record<string, SetupDef> = Object.fromEntries(
  SETUPS.map((s) => [s.id, s]),
);

/**
 * Which jobs can carry a score, and what preparing each one looks like.
 *
 * All five tier-4 and tier-5 jobs, including the two with no stake. §0.2:
 * putting scores only on the paid jobs would push first contact out to day
 * 140, and prep is never free anyway — it costs a man for the whole window,
 * which is the one bill a broke player can still pay.
 *
 * The subsets are fiction rather than balance. Turning somebody inside makes
 * sense against a bank's books and against a dock; it does not mean anything
 * when the job is going round everyone who owes you and asking for it.
 */
export const SCORE_TARGETS: Record<string, string[]> = {
  financial_scheme: ['setup_case', 'setup_inside', 'setup_masks'],
  port_operation: ['setup_case', 'setup_inside', 'setup_wheels', 'setup_masks', 'setup_guns'],
  call_in_tribute: ['setup_wheels', 'setup_masks', 'setup_guns'],
  citywide_network: ['setup_case', 'setup_inside', 'setup_wheels', 'setup_masks', 'setup_guns'],
  enforce_the_peace: ['setup_case', 'setup_inside', 'setup_guns'],
};

export const SCORE = {
  /**
   * How long a score stands.
   *
   * Careers hold the paid tier-4 jobs in the open-and-affordable state for a
   * median of 68 days, 25th percentile 36. A 42-day window would outrun
   * affordability for a quarter of careers; 28 fits inside the 25th, so a
   * window expires because the player was slow and never because the game
   * moved the job out from under them.
   */
  windowDays: 28,
  /**
   * The stake, in this year's money, drawn dirty first.
   *
   * Deliberately a token. At day 93 the median career holds $3,499 dirty, so
   * any fee large enough to be felt is unpayable by half the careers this
   * exists for — which is the `PATRON` shape by another door. The bill that
   * bites is the man, below.
   */
  openCost: 2_000,
  /**
   * Scores open at once.
   *
   * The median career has nine idle crew at day 93, so one man per score bites
   * at three or four and not before. This is the ceiling that makes the body
   * cost mean something rather than a number chosen for its own sake.
   */
  maxLive: 3,
  /** What one blown setup adds to how closely the place is being watched, 0..100. */
  alertnessPerBotch: 14,
  /** Alertness against the odds. Two blown setups cost about five points. */
  alertnessWeight: 0.004,
  /** Jobs below this are not worth a month of planning. */
  minTier: 4,
};

/**
 * Whether the gear went in the river or into an evidence locker.
 *
 * Three things decide it and all three read state that already exists, which
 * is the whole reason this phase is worth having: it gives ground a job it did
 * not have, it puts a tail on the approach three days after the night, and it
 * makes a blown score punish twice.
 */
export const DISPOSAL = {
  /** Before anything about where, how, or whether it worked. */
  base: 0.55,
  /** Added at full influence in the district the job ran in. */
  perControl: 0.35,
  /** Heavy uses more of it and leaves more witnesses to it going in the river. */
  byApproach: { quiet: 1.1, standard: 1, heavy: 0.75 } as Record<string, number>,
  /** Eight men running from a blown job are not carefully burning overalls. */
  onFailure: 0.55,
  /** Evidence strength per unit of bulk the police come away with. */
  strengthPerBulk: 16,
};
