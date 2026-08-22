/**
 * The economy having its own decade.
 *
 * World conditions (config/world.ts) are weather: a month of something, then
 * back to normal. This is climate. A cycle runs for years, it moves slowly
 * enough that no single week feels different, and the only way to notice it is
 * to compare a figure now against the same figure four years ago.
 *
 * Two quantities come out of it:
 *
 *   prices   a compounding index every nominal figure in the game is quoted in
 *   rate     what borrowing costs this year
 *
 * The point of indexing prices is not to make numbers bigger. Wages, payouts,
 * front revenue and rank requirements all move together, so a player who keeps
 * earning never notices. What does not move is **cash already sitting in a
 * bag**, and that is the whole mechanic: a dirty pile you cannot wash is worth
 * measurably less every year you fail to wash it. Laundering stops being
 * bookkeeping and becomes a clock.
 */

export type CyclePhaseId = 'expansion' | 'peak' | 'contraction' | 'trough';

export interface CyclePhaseDef {
  id: CyclePhaseId;
  name: string;
  /** One line for the Finances panel. */
  summary: string;
  /** What the papers are calling it, for the log. */
  headline: string;
  /** Rolled from this range, in days. Years, roughly. */
  durationDays: [min: number, max: number];
  /** Annual change in the price index, as a fraction. Negative deflates. */
  inflationPerYear: number;
  /** Annual interest a lender wants, before their own margin. */
  baseRate: number;
  /**
   * Multiplies front revenue and operation payouts, on top of prices.
   *
   * This is the *real* movement — what a boom does beyond making the numbers
   * longer. Kept small, because world conditions already own the dramatic
   * version of this, and two systems shouting the same thing is how a
   * simulation stops being legible.
   */
  activity: number;
  /** Which phase follows. The cycle is a loop, not a random walk. */
  next: CyclePhaseId;
}

/*
 * Tuned over 24 worlds x 30 years.
 *
 * First pass ran inflation at 6% through expansion and 11% at the peak, which
 * is historically defensible and unplayable: prices at year 25 were 9x, every
 * figure on every panel was six digits, and the rank thresholds had walked far
 * enough that a competent player stalled at Underboss forever. At the numbers
 * below a 30-year game lands around 2.3x — enough that an old save feels like
 * a different decade, not enough to need another comma.
 */
export const CYCLE_PHASES: Record<CyclePhaseId, CyclePhaseDef> = {
  expansion: {
    id: 'expansion',
    name: 'Expansion',
    summary:
      'Money is moving. Everything costs a little more each year and everybody is earning.',
    headline: 'The city is building again. Cranes on the north side and nobody counting closely.',
    durationDays: [900, 1_700],
    inflationPerYear: 0.035,
    baseRate: 0.1,
    activity: 1.06,
    next: 'peak',
  },
  peak: {
    id: 'peak',
    name: 'The top of the market',
    summary: 'Everyone is certain it will last. Money is cheap and prices are running.',
    headline:
      'Nobody in this city has lost money on anything in two years. It is making them stupid.',
    durationDays: [400, 800],
    inflationPerYear: 0.062,
    baseRate: 0.08,
    activity: 1.13,
    next: 'contraction',
  },
  contraction: {
    id: 'contraction',
    name: 'Contraction',
    summary:
      'It has turned. Credit is dear, business is thin, and nobody will lend against a promise.',
    headline: 'Two banks and a shipping line inside a month. The word being used is correction.',
    durationDays: [500, 950],
    inflationPerYear: 0.008,
    baseRate: 0.17,
    activity: 0.9,
    next: 'trough',
  },
  trough: {
    id: 'trough',
    name: 'The bottom',
    summary: 'Nothing is worth what it was. Cash buys more than it did, if you have any.',
    headline: 'Boarded windows on Delacroix. The men on the corner will work for anything.',
    durationDays: [400, 800],
    // Deflation is the reward for having sat on clean money through a bad
    // decade, and the punishment for having borrowed at the top: the principal
    // does not shrink but everything you could sell to cover it does.
    inflationPerYear: -0.018,
    baseRate: 0.13,
    activity: 0.82,
    next: 'expansion',
  },
};

/** Where a new city starts. Mid-expansion, so the first turn is a peak. */
export const STARTING_PHASE: CyclePhaseId = 'expansion';

/**
 * Ceiling and floor on the price index.
 *
 * Less a balance knob than a guarantee: nothing downstream ever has to worry
 * about a multiplier that ran away over a 200-year Simulation game, and no
 * figure in the game can be driven to nothing by a long enough depression.
 */
export const PRICE_BOUNDS: [min: number, max: number] = [0.6, 8];

// ------------------------------------------------------------- borrowing ---

export type Collateral = 'violence' | 'paper' | 'obligation';

export interface LenderDef {
  id: string;
  name: string;
  blurb: string;
  /** What you are actually signing, said plainly. */
  terms: string;
  /** Most he will lend, at price level 1. Scaled by prices at the time. */
  ceiling: number;
  /** Added to the market rate. His margin, and his opinion of you. */
  margin: number;
  /** Weeks to clear it. */
  termWeeks: number;
  /** Standing needed before the conversation happens at all. */
  minRespect: number;
  /** Fronts you must be running. A bank does not lend against a reputation. */
  minBusinesses: number;
  /** What he does when you cannot pay. */
  collateral: Collateral;
}

/**
 * Three ways to get money you have not earned.
 *
 * The interesting axis is not the rate, it is what happens when it goes wrong
 * — that is the part the player is choosing between: a man who hurts somebody,
 * a paper trail that hands an agency a case, or a family that owns a piece of
 * you.
 */
export const LENDERS: LenderDef[] = [
  {
    id: 'shark',
    name: 'A man on Delacroix',
    blurb:
      'They have a table at the back of a restaurant and they are there every day between two and five. No paperwork, no questions, and no extensions.',
    terms: 'Cash today. They collect in person, and when they cannot collect they send somebody.',
    ceiling: 40_000,
    margin: 0.28,
    termWeeks: 26,
    minRespect: 0,
    minBusinesses: 0,
    collateral: 'violence',
  },
  {
    id: 'mercantile',
    name: 'The Mercantile Trust',
    blurb:
      'A vice-president who understands that the restaurant business is seasonal, and who has decided not to ask a second question.',
    terms:
      'Proper money at a proper rate, against your fronts. Every dollar of it exists in writing somewhere.',
    ceiling: 350_000,
    margin: 0.04,
    termWeeks: 78,
    minRespect: 140,
    minBusinesses: 2,
    // The trap. Cheapest money in the game, and a default writes financial
    // evidence straight into whatever the Financial Crimes Division is already
    // building — the one lender whose downside arrives as a case rather than as
    // something you can pay to make go away.
    collateral: 'paper',
  },
  {
    id: 'family',
    name: 'Somebody at the table',
    blurb:
      'One of the other families has money sitting idle and would rather it sat in your district earning than in their safe doing nothing.',
    terms:
      'Friendly terms, and the understanding — never stated — that you now owe them something that is not money.',
    ceiling: 220_000,
    margin: 0.12,
    termWeeks: 52,
    minRespect: 60,
    minBusinesses: 0,
    collateral: 'obligation',
  },
];

export const LENDER_BY_ID: Record<string, LenderDef> = Object.fromEntries(
  LENDERS.map((l) => [l.id, l]),
);

/** Share of the outstanding balance collected each payday. */
export const REPAYMENT_SHARE = 0.055;
/** ...but never less than this, so a large loan cannot be outlasted. */
export const REPAYMENT_MINIMUM = 350;
/** Below this the book is closed and everybody stops thinking about it. */
export const LOAN_SETTLED_BELOW = 250;

/** What happens when a payment is missed, and then missed again. */
export const DEFAULT_TERMS = {
  /** Payments you can miss before the collateral clause is invoked. */
  graceMissed: 3,
  /** The balance grows while you are not paying it. Per missed week. */
  penaltyPerMiss: 0.05,
  /** Standing lost each time you visibly cannot pay somebody. */
  respectPerMiss: -4,

  /** violence: somebody gets hurt, and it goes in a file. */
  violenceInjuryDays: [8, 20] as [min: number, max: number],
  violenceEvidence: 10,
  /** paper: the bank's lawyers hand somebody a very tidy case. */
  paperEvidence: 26,
  /** obligation: the grudge, and the ground they take instead. */
  obligationGrudge: 22,
  obligationInfluence: 12,
};
