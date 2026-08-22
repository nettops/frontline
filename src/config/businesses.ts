/**
 * Legitimate fronts.
 *
 * The trade-off is built into the stats rather than into logic: a laundromat
 * moves a little money and looks like nothing, a casino moves enormous amounts
 * and is a permanent address for anyone building a case. Legitimacy and
 * launder capacity pull against each other on purpose.
 */

import type { ControlLevel } from './territories';

export interface BusinessDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Clean income per week, before territory wealth scaling. */
  revenue: number;
  /** Dirty cash it can absorb per week, before wealth scaling. */
  launderCapacity: number;
  /** Exposure gained per week at full laundering throughput. */
  exposureRate: number;
  /** How unremarkable it looks. High legitimacy decays exposure faster. */
  legitimacy: number;
  minControl: ControlLevel;
}

export const BUSINESSES: BusinessDef[] = [
  {
    id: 'laundromat',
    name: 'Laundromat',
    description:
      'Coin-operated, cash-only, open at hours nobody questions. Small, dull and almost invisible.',
    cost: 12_000,
    revenue: 560,
    launderCapacity: 3_000,
    exposureRate: 1.2,
    legitimacy: 60,
    minControl: 'foothold',
  },
  {
    id: 'social_club',
    name: 'Social Club',
    description:
      'A room with a card table and a coffee machine. Nobody can say exactly what it earns, including you.',
    cost: 18_000,
    revenue: 700,
    launderCapacity: 4_500,
    exposureRate: 1.4,
    legitimacy: 45,
    minControl: 'foothold',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Real food, real customers, and a great many covers that were never served.',
    cost: 25_000,
    revenue: 1_250,
    launderCapacity: 5_000,
    exposureRate: 1.0,
    legitimacy: 75,
    minControl: 'foothold',
  },
  {
    id: 'auto_shop',
    name: 'Auto Shop',
    description: 'Parts in, parts out, invoices for work that happened in a manner of speaking.',
    cost: 30_000,
    revenue: 1_500,
    launderCapacity: 6_000,
    exposureRate: 1.3,
    legitimacy: 65,
    minControl: 'foothold',
  },
  {
    id: 'trucking',
    name: 'Trucking Company',
    description: 'Freight, routes and a fleet that explains a lot of movement.',
    cost: 60_000,
    revenue: 3_000,
    launderCapacity: 14_000,
    exposureRate: 1.5,
    legitimacy: 60,
    minControl: 'control',
  },
  {
    id: 'nightclub',
    name: 'Nightclub',
    description:
      'Enormous cash volume and a door everybody in the city walks through, including people you would rather not meet.',
    cost: 75_000,
    revenue: 3_800,
    launderCapacity: 20_000,
    exposureRate: 2.0,
    legitimacy: 40,
    minControl: 'control',
  },
  {
    id: 'construction',
    name: 'Construction Firm',
    description:
      'Contracts, materials, overruns. The most forgiving paperwork in the legitimate world.',
    cost: 90_000,
    revenue: 4_600,
    launderCapacity: 22_000,
    exposureRate: 1.6,
    legitimacy: 55,
    minControl: 'control',
  },
  {
    id: 'hotel',
    name: 'Hotel',
    description: 'Rooms nobody stayed in, paid for in cash by guests who left no name.',
    cost: 140_000,
    revenue: 6_000,
    launderCapacity: 30_000,
    exposureRate: 1.5,
    legitimacy: 70,
    minControl: 'control',
  },
  {
    id: 'real_estate',
    name: 'Real Estate Office',
    description:
      'Property moving between people who are all, in the end, the same person.',
    cost: 180_000,
    revenue: 6_800,
    launderCapacity: 45_000,
    exposureRate: 1.3,
    legitimacy: 80,
    minControl: 'dominance',
  },
  {
    id: 'casino',
    name: 'Casino',
    description:
      'The most efficient way ever devised to explain where money came from, and the least discreet.',
    cost: 260_000,
    revenue: 12_000,
    launderCapacity: 80_000,
    exposureRate: 2.6,
    legitimacy: 25,
    minControl: 'dominance',
  },
];

export const BUSINESS_BY_ID: Record<string, BusinessDef> = Object.fromEntries(
  BUSINESSES.map((b) => [b.id, b]),
);

// ------------------------------------------------------------ laundering ---

/**
 * The cut taken to make dirty money look clean. Your Business attribute buys
 * this down — at Business 12 you are at the floor.
 *
 * Measured against the career, not chosen.
 *
 * A crew-week produces $1,013 and costs $255 in wages, so the criminal economy
 * is four times profitable and growth pays for itself. But only $97 of that
 * $1,013 is *new clean money* — under a tenth — and every rank above Crew
 * Leader is gated on clean cash held, so the ladder is gated on a tenth of the
 * economy while the other nine tenths sit in a pool that cannot satisfy it.
 *
 * Raising `LEGITIMATE_REVENUE_SCALE` was the obvious lever and it is the wrong
 * one: the note above it records a balance pass where fronts out-earning jobs
 * made this a business simulator with a crime setting. Crime stays the engine.
 * What was wrong is the exchange rate — a third of everything the engine
 * produced was disappearing on the way to being usable, and the same dollar
 * was often washed and then spent back into the dirty economy, paying the cut
 * again on the next trip.
 *
 * At 0.24 a boss keeps three quarters of what he washes at no Business skill
 * at all, and the attribute still buys it down to the floor.
 */

export const LAUNDER_CUT_BASE = 0.24;
export const LAUNDER_CUT_PER_BUSINESS_POINT = 0.01;
export const LAUNDER_CUT_MIN = 0.12;

/** Revenue and capacity both scale with how wealthy the district is. */
export const WEALTH_REVENUE_BASE = 0.7;
export const WEALTH_REVENUE_RANGE = 0.6;

/**
 * A global dial on legitimate income, separate from laundering capacity.
 *
 * The two used to share one scale, which meant the only way to stop fronts
 * out-earning the jobs was to make them worse at washing money — the opposite
 * of the intended trade. Measured across the eight balance seeds, careful play
 * was ending two years with more legitimate income than criminal income on six
 * of them, which quietly makes this a business simulator with a crime setting.
 *
 * Crime is the engine. Fronts convert what it produces and pay for themselves
 * doing it; they do not replace it.
 */
export const LEGITIMATE_REVENUE_SCALE = 0.72;

/**
 * What running the laundry teaches you about running a laundry.
 *
 * The Yourself panel says attributes improve by use. Every `trainAttribute`
 * call in this game was inside `events.ts`, so they improved by answering
 * memos and by nothing else — and round 11 finished 303 days at **Business
 * 1/20** having operated five fronts for 265 of them, while Business buys down
 * the laundering cut it had spent the whole career paying.
 *
 * Sized against a career a person actually plays, which is the correction the
 * two failed iterations before this one both needed. `attributeProgressNeeded`
 * is 3 + level * 1.6, so 22 points reaches Business 4. Thirty-eight weeks —
 * round 11's five fronts over 265 days — at this rate lands there.
 *
 * Scaled by how much of the capacity was actually used, so a token front in a
 * dead district does not teach the same as a working pipeline. Owning a
 * building is not a skill.
 */
export const BUSINESS_FROM = {
  /** Per week, at full use of the capacity the fronts have. */
  launderingPerWeek: 0.75,
};

// -------------------------------------------------------------- exposure ---

/** Exposure bled off each week, scaled by how legitimate the front looks. */
export const EXPOSURE_DECAY_BASE = 0.4;
export const EXPOSURE_DECAY_PER_LEGITIMACY = 0.02;

/** Above this, a business starts generating heat and evidence on its own. */
export const EXPOSURE_ALARMING_ABOVE = 50;
export const EXPOSURE_HEAT_AT_MAX = 2.5;
export const EXPOSURE_EVIDENCE_ABOVE = 70;
export const EXPOSURE_EVIDENCE_CHANCE = 0.25;

/**
 * A front going under on its own.
 *
 * Until now the only way a business ever closed was the player closing it,
 * which made ten businesses ten permanent annuities — buy it once and it earns
 * forever. That is not a legitimate business, it is a subscription, and it
 * quietly removed the one risk that makes the legitimate economy a decision
 * rather than a purchase.
 *
 * Health is a running number, not a die roll. It falls when the neighbourhood
 * has turned against you, when the front is being hammered for laundering,
 * when a rival is running the same racket on the same street, and when the
 * whole city has stopped spending. It recovers when none of those is true, so
 * a front in trouble can be saved — which is the point of telling the player
 * before it closes rather than after.
 */
export const HEALTH = {
  start: 100,
  /** Below this the player is warned. Below zero it closes. */
  warnBelow: 45,

  /** Weekly recovery when nothing is going wrong. */
  recoverPerWeek: 2.2,

  /** How much a hostile neighbourhood costs it per week, at zero sentiment. */
  fromSentimentAtWorst: -4.5,
  /** Sentiment above this is not a problem at all. */
  sentimentFine: 45,

  /** Being leaned on as a laundry, per week at full exposure. */
  fromExposureAtMax: -3.2,
  exposureFine: 40,

  /**
   * Rivals running the same kind of thing on the same street. Read from their
   * business count in districts they hold — organized crime is a competitive
   * industry and the game had no competition in it anywhere.
   */
  fromRivalPerFront: -0.55,

  /** A city that has stopped spending, at full outrage. */
  fromOutrageAtMax: -1.6,

  /** What a failing front earns, as a share, at zero health. */
  revenueAtZero: 0.35,

  /** Closing on its own returns less than closing it deliberately would. */
  collapseRefundShare: 0.15,
} as const;

/** Shuttering a business deliberately dumps its exposure but forfeits most of the price. */
export const SHUTTER_REFUND_SHARE = 0.35;

/** Buying costs more where you are weaker — you are paying somebody off. */
export const ACQUISITION_PREMIUM_CONTESTED = 1.35;

/**
 * What a small organization can actually get in at.
 *
 * F15, and the one number in the game that decides the middle of it.
 *
 * Front income is paid into holdings, where it compounds. So the *second*
 * front is the step that decides a career, and `ladder.probe` measures 30
 * careers in 36 finishing under $100,000 holding exactly one, against six that
 * hold five. Across every week a career owns no front the blocker is **money
 * in 97% of them** — not control, not slots, not public feeling. Round 15 said
 * the same thing in prose after 245 days: *"the two things that would have
 * opened new decisions were both gated behind capital I could no longer
 * accumulate."*
 *
 * The catalogue price is what a going concern is worth to a real buyer. It is
 * not what a man with two soldiers and a laundromat is being sold. He is being
 * sold a share of something struggling, by somebody who wants out, and the
 * price reflects who is standing in the room — which is exactly what
 * `wealthScale` already does for the district and `haggle` already does for
 * negotiation.
 *
 * So the discount is largest for a family that has never been worth anything
 * and gone by the time one is. It reads the **high-water mark** rather than
 * today's balance, for the same reason the rank table does: a family that has
 * been somebody does not get to be sold to as though it has not.
 *
 * Deliberately not a discount on the first front. That one already arrives on
 * day 42 in 35 careers of 36 and needs no help; this is priced on what the
 * family has *ever* been worth, so it fades exactly as the organization stops
 * being small.
 */
export const ACQUISITION_SCALE = {
  /** High-water estate at which a family pays the catalogue price. */
  fullPriceAt: 150_000,
  /** The most that can come off, for a family that has never held anything. */
  maxDiscount: 0.45,
} as const;
