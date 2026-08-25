/**
 * People who want a quantity of something by a date.
 *
 * `ARMS_SALE` already sells crates to a rival family: you have stock, they
 * will buy, done. That is a spot transaction, and it is the whole of the
 * "somebody else wants what you have" idea in this game. An **order** is the
 * other shape of the same thing and a different decision — a named buyer wants
 * *n* units **by a given day**, and saying yes is a promise.
 *
 * What that buys is scheduling. Accepting reserves the units out of
 * distribution and raises what the weekly buy is aiming at, so a commitment
 * costs source ceiling and cash before it costs stock. That is what gives a
 * plant, or a second arrangement, something to be for beyond a better margin —
 * and it is why this was specified alongside the plant rather than instead of
 * it.
 *
 * ---------------------------------------------------------------------------
 * The same rule as the rest of the trade. This is an abstract economy: units,
 * quantities, deadlines, prices, and what a buyer does with what they bought.
 * Nothing here describes how anything is made, moved or concealed in the real
 * world, and nothing here should be added that does.
 * ---------------------------------------------------------------------------
 */

import type { TradeId } from './contraband';

// ------------------------------------------------------------------ gangs --

/**
 * Buyers who are not families, and why they cannot be.
 *
 * `FactionId` is a closed four-member union — `'player' | 'falcone' | 'vasari'
 * | 'kestler'` — and it doubles as a save-format slot key. A street gang has
 * no capos, no strength, no wealth, no agenda and no weekly AI turn, so making
 * one a faction would mean carrying five sixths of a family's machinery empty
 * and changing the save format to do it.
 *
 * So a gang is a lightweight thing of its own: a name, a neighbourhood, an
 * appetite, and what supplying them does to that neighbourhood. Every one of
 * those consequences is a number that already exists on a panel the player
 * reads — district sentiment, heat, and how much of the street is actually
 * theirs. A gang is not a rival organization and must not start pretending to
 * be one.
 */
export type GangId = 'river_boys' | 'yard_crew' | 'southport_men';

export interface GangDef {
  id: GangId;
  name: string;
  blurb: string;
  /** The neighbourhood they are from, and where the consequence lands. */
  territoryId: string;
  wants: TradeId;
  /**
   * Multiplier on unit value.
   *
   * Above what a family pays, and the reason is not generosity: they have
   * nowhere else to go, and the cost of supplying them is not money. See
   * `sentimentPerUnit` below.
   */
  pays: number;
  /**
   * What their neighbourhood thinks of you, per unit supplied.
   *
   * Heavier than running the trade there yourself — `TRADES.product` charges
   * 0.11 a unit — because it is not your people doing it and you have no say
   * in how they do it. This is the whole price of the transaction. A player
   * who fills every order the river asks for will find the river will not hold
   * a business, and nothing will have said so at the time.
   */
  sentimentPerUnit: number;
  /** Attention, per unit. Somebody else's arrests still name your streets. */
  heatPerUnit: number;
  /**
   * Ground, per unit.
   *
   * The quiet one. Supplying the people who already stand on that corner is
   * paying them to keep standing there, and influence in a district is the
   * thing every other system in the game reads.
   */
  influencePerUnit: number;
}

export const GANGS: GangDef[] = [
  {
    id: 'river_boys',
    name: 'The river boys',
    blurb:
      'Twenty-odd of them, most under twenty-five, and they have the whole waterfront end of Riverside between them. They pay in cash and they do not negotiate.',
    territoryId: 'riverside',
    wants: 'product',
    pays: 1.75,
    sentimentPerUnit: -0.3,
    heatPerUnit: 0.2,
    influencePerUnit: -0.09,
  },
  {
    id: 'yard_crew',
    name: 'The crew off the yards',
    blurb:
      'Not organized enough to be a problem and not small enough to ignore. They want crates and they are not going to say what for.',
    territoryId: 'rail_yards',
    wants: 'arms',
    pays: 1.9,
    sentimentPerUnit: -0.55,
    heatPerUnit: 0.5,
    influencePerUnit: -0.22,
  },
  {
    id: 'southport_men',
    name: 'The Southport men',
    blurb:
      'Older, quieter, and they have been doing this since before you had a name. They buy in size and they expect it on the day they said.',
    territoryId: 'southport',
    wants: 'product',
    pays: 1.72,
    sentimentPerUnit: -0.22,
    heatPerUnit: 0.14,
    influencePerUnit: -0.06,
  },
];

export const GANG_BY_ID: Record<string, GangDef> = Object.fromEntries(
  GANGS.map((g) => [g.id, g]),
);

// ----------------------------------------------------------------- orders --

export const ORDERS = {
  /**
   * Chance a week that somebody asks, when anybody is in a position to.
   *
   * Deliberately low. An order is a decision with a deadline attached, and a
   * screen with one of them on it every week is a chore rather than a
   * decision. At 0.16 a career running both trades sees roughly eight offers a
   * year and can turn most of them down.
   */
  offerChancePerWeek: 0.16,
  /** Offers and commitments live at once, across both trades. */
  maxLive: 3,
  /** Days an unanswered offer stands before the buyer goes elsewhere. */
  offerStands: 10,
  /** Days to fill one, once accepted. */
  daysToFill: [21, 42] as [number, number],
  /**
   * Size, as a multiple of what a week of that trade currently moves.
   *
   * Scaled off the player's own throughput rather than fixed, because a fixed
   * quantity is either trivial for a large outfit or impossible for a small
   * one, and both of those are the same bug. Above one week on purpose: an
   * order the existing flow already covers is not a commitment, it is a
   * rounding error with a countdown on it.
   */
  scaleOfWeekly: [1.6, 4] as [number, number],
  /** Floor, so an outfit with almost no flow is still asked for something real. */
  minUnits: { product: 12, arms: 6 } as Record<TradeId, number>,
  /**
   * What a family pays, as a multiplier on unit value.
   *
   * Above the 1.45 of a spot sale, because the spot sale carries no penalty
   * for changing your mind and this does. That is the fork between the two:
   * sell what is on the shelf today at the lower figure, or commit to a
   * quantity you do not have yet at the higher one.
   */
  familyPays: 1.65,
  /**
   * The most a finished-early order adds, as a share of its value.
   *
   * Paid on a straight line against how much of the window was left, so
   * delivering in the first week of a six-week order is worth materially more
   * than scraping in on the last day. Without it, every order is filled at the
   * deadline and the deadline is the only number that matters.
   */
  earlyBonusShare: 0.15,
} as const;

/**
 * What it costs to say yes and then not do it.
 *
 * A promise with no consequence for breaking it is a payout table with extra
 * clicking. These are deliberately relationship figures rather than money: the
 * units already delivered are paid for, so failing an order does not cost the
 * player a dollar they had. It costs them the buyer, and the buyer was the
 * point.
 */
export const ORDER_FAILURE = {
  /** Standing, for being somebody whose word did not hold. */
  respect: 6,
  /** A family remembers. Both figures are on the bond they already have. */
  grudge: 12,
  trust: 10,
  /** A neighbourhood remembers too, and it was their people who were let down. */
  sentiment: 5,
} as const;
