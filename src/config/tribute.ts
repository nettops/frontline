/**
 * The Soprano Operations Loop: Autonomous Delegation, Weekly Envelopes, and Capo Tribute.
 *
 * In a real crime family, the Boss does not browse a board of 15 petty jobs
 * and schedule soldiers on delivery trucks. Money flows UP. Capos run their
 * own crews and rackets, delivering a weekly tribute envelope.
 *
 * This file configures:
 * 1. Autonomous pitch execution (Boss's cut, insulation).
 * 2. Weekly tribute envelopes and the "Light Envelope" squeeze dilemma.
 * 3. The Earner Leaderboard (Top Earner vs Dead Weight / Ralphie vs Paulie).
 * 4. High-rank street work penalties (a Boss seen shaking down corners loses respect).
 * 5. Special Mob Ventures (Waste Management & Pork Store).
 */

export const TRIBUTE = {
  /** Share of gross payout delivered to the Boss when an operation is run autonomously by a Capo. */
  bossAutonomousCut: 0.45,

  /** Base weekly tribute envelope expected per active capo. Capos without ground or volume read as dead weight. */
  baseEnvelope: 1_200,

  /** Bonus envelope cash per territory controlled by the capo or his crew. */
  perControlledDistrict: 1_200,

  /** Bonus envelope cash per completed operation credited to the capo's crew inside `earnerHistoryDays`. */
  perRecentOpVolume: 150,

  /**
   * Chance per week that a capo's envelope comes up "Light".
   * Procedurally drawn from generatedStream(state).
   */
  lightEnvelopeBaseChance: 0.18,

  /**
   * Days before the same capo's envelope can come up light again by chance.
   *
   * A man who is actually skimming (`Npc.isSkimming`) is not held by this —
   * he is short every week until somebody catches him, which is the whole
   * difference between a bad month and a thief. Four weeks so that an honest
   * capo's light envelope reads as an event rather than as weather.
   */
  lightEnvelopeCooldownDays: 28,

  /** How much a light envelope is short by (percentage of expected envelope). */
  lightShortageFraction: [0.35, 0.65] as [number, number],

  /** Grievance added to a capo when the Boss squeezes them for the balance. */
  squeezeGrievance: 12,

  /** Loyalty lost when squeezed. */
  squeezeLoyaltyHit: -6,

  /** Respect lost by the Boss when letting a light envelope slide without consequence. */
  letSlideRespectHit: 2,

  /** Loyalty gained by a capo when the Boss graciously lets a light envelope slide. */
  letSlideLoyaltyBonus: 5,

  /** Cost to dispatch an enforcer/investigator to audit a capo's crew and books. */
  auditCost: 400,

  /** Penalty when a Boss at rank Capo or above personally runs Tier 0 street work while having liquid funds. */
  handsOnStreetWorkRespectPenalty: 8,

  /** Minimum liquid cash below which a Boss is excused for running street work personally. */
  handsOnPovertyExemptionFunds: 2_500,

  /** Days considered for recent earner volume. */
  earnerHistoryDays: 45,

  /** Weekly tribute threshold to be considered a "Top Earner". */
  topEarnerWeeklyThreshold: 3_500,

  /** Weekly tribute threshold below which a Capo is considered "Dead Weight". */
  deadWeightWeeklyThreshold: 1_500,
} as const;

export type EarnerStatus = 'top_earner' | 'steady_earner' | 'dead_weight';

export interface LightEnvelopeDilemma {
  id: string;
  capoId: string;
  capoName: string;
  expected: number;
  offered: number;
  shortage: number;
  excuse: string;
  day: number;
}

export interface SpecialVentureDef {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  weeklyRevenue: number;
  legitimacy: number;
  perk: string;
}

/**
 * Signature Mob Covers that define the prestige boss lifestyle.
 * Kept separate from `BUSINESSES` to preserve `catalogue.test.ts` and `ladder.probe` invariants.
 */
export const SPECIAL_VENTURES: SpecialVentureDef[] = [
  {
    id: 'waste_management',
    name: 'Sanitation Transfer Station',
    blurb:
      'Barone Sanitation. A legitimate payroll, an office with your name on the door as "Special Consultant", and trucks that can carry anything without questions.',
    cost: 45_000,
    weeklyRevenue: 2_200,
    legitimacy: 88,
    perk: 'Evidence traces from violence and body disposals are reduced by 30%.',
  },
  {
    id: 'pork_store',
    name: 'Neighborhood Pork Store',
    blurb:
      'Satriale’s Meat Market. An espresso machine, cold cuts on the counter, and a back room where nobody wears a wire. The neighbourhood knows who sits outside.',
    cost: 16_000,
    weeklyRevenue: 850,
    legitimacy: 75,
    perk: 'Increases home district sentiment recovery and insulates capos against rival poaching.',
  },
];

/**
 * What owning one of them actually does, as numbers rather than as prose.
 *
 * Every figure here is read by exactly one place in the sim, and the blurbs
 * above quote these rather than the other way round — rule 3 is the reason
 * this file grew a second half at all. A perk described in `SpecialVentureDef.perk`
 * and implemented nowhere is a panel telling the player something untrue.
 */
export const VENTURE_PERKS = {
  /**
   * How much of a violence or disposal trace the transfer station swallows.
   *
   * Applied at `addEvidence`, which is the single funnel every trace in the
   * game goes through, so there is no second call site to miss. Deliberately
   * a reduction rather than a suppression: a truck that can carry anything
   * makes a body harder to find, not impossible.
   */
  wasteEvidenceReduction: 0.3,

  /**
   * Extra weekly sentiment recovery in the neighbourhood the pork store sits in.
   *
   * On top of `SENTIMENT_RECOVERY_PER_WEEK` and bounded by the same ceiling,
   * so it makes the block forgive faster and never makes it love you.
   */
  porkStoreHomeSentiment: 2,

  /**
   * What a poach offer is worth against a crew that drinks coffee outside
   * Satriale's every morning. A multiplier on the offer landing, not on it
   * being made — a rival can still try, and still tells you when he fails.
   */
  porkStorePoachResist: 0.65,

  /** The minimum rung that can put its name on a legitimate payroll. */
  minRank: 'capo',
} as const;
