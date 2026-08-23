/**
 * The two trades that are businesses rather than jobs.
 *
 * Everything else the organization does is an *operation*: pay up front, commit
 * people for a fortnight, roll once, collect. That is the right shape for a
 * hijacking and the wrong shape for a trade, because a trade is a standing
 * thing you have to keep running — a source you can lose, stock sitting
 * somewhere that can be taken off you, and a set of streets that will carry it
 * only as far as you actually hold them.
 *
 * Two of them, sharing one chain:
 *
 *     source or manufacture  →  stock  →  distribution  →  dirty cash
 *                                  ↓            ↓
 *                             seizable    sentiment, heat, evidence
 *
 * They differ in every number and in one structural way: product is *bought*
 * from somebody outside the city, and arms are *made* in a workshop you own.
 * That makes the first a relationship you have to maintain and the second a
 * capital asset somebody can raid.
 *
 * ---------------------------------------------------------------------------
 * As with laundering, this is deliberately an abstract economy and nothing
 * else. Units, routes, capacity, spoilage, exposure. Nothing here describes how
 * anything is made, moved or concealed in the real world, and nothing here
 * should be added that does.
 * ---------------------------------------------------------------------------
 */

import type { EvidenceSource } from './lawEnforcement';
import type { ControlLevel } from './territories';
import type { RankId } from '../sim/types';

export type TradeId = 'product' | 'arms';

export interface TradeDef {
  id: TradeId;
  name: string;
  /** What a unit is called, singular and plural, for the panel. */
  unit: [one: string, many: string];
  blurb: string;
  /** Lowest rank that can run it at all. */
  minRank: RankId;
  /** Control needed in a district before it will carry anything. */
  minControl: ControlLevel;

  /** What a unit costs to obtain, before supplier and world modifiers. */
  unitCost: number;
  /** What a unit fetches, before district wealth. */
  unitValue: number;

  /** Units a district will absorb per week at full control, before scaling. */
  districtCapacity: number;
  /** How much of that is decided by how rich the district is. */
  wealthWeight: number;
  /** ...and how much by how many people live there. */
  populationWeight: number;

  /** Heat per unit moved. */
  heatPerUnit: number;
  /** What it does to the neighbourhood, per unit moved there. */
  sentimentPerUnit: number;
  /** Which agencies will care about the traces it leaves. */
  evidence: EvidenceSource;
  /** Evidence written per week of a trade running, scaled by volume. */
  evidencePerUnit: number;

  /** Stock lost per week to spoilage, theft and people helping themselves. */
  wastagePerWeek: number;
  /** Most units you can hold at once, before storage. */
  stockCap: number;
}

export const TRADES: Record<TradeId, TradeDef> = {
  product: {
    id: 'product',
    name: 'The product trade',
    unit: ['load', 'loads'],
    blurb:
      'Bought outside the city, carried in through the port, and moved on the same streets your people already stand on. It earns more than anything else you can do and the neighbourhood knows exactly what it is.',
    minRank: 'crew_leader',
    minControl: 'foothold',

    /*
     * Margin and volume both tuned down from the first pass.
     *
     * At 14 units a district and 7,400 a unit, a player who came to dominate
     * the whole map would have been earning around 500,000 a week from the
     * trade alone — more than the largest operation in the game pays, forever,
     * with no roll. The trade should be the steady thing that funds the spiky
     * things, not a replacement for them.
     */
    unitCost: 2_600,
    unitValue: 6_400,

    districtCapacity: 7,
    wealthWeight: 0.35,
    populationWeight: 0.65,

    heatPerUnit: 0.16,
    // The reason this is not simply the best thing in the game. A district you
    // run product through turns on you, and sentiment gates businesses,
    // operation success and eventually whether anybody will sell to you at all.
    sentimentPerUnit: -0.11,
    evidence: 'operation',
    evidencePerUnit: 0.22,

    wastagePerWeek: 0.04,
    stockCap: 400,
  },

  arms: {
    id: 'arms',
    name: 'The arms trade',
    unit: ['crate', 'crates'],
    blurb:
      'A machine shop that makes parts nobody asks about, or a freight agent who will sell you crates already full. Lower volume, far higher value, and the only trade whose customers can point it back at you.',
    minRank: 'capo',
    minControl: 'control',

    // Manufacture rather than purchase — see WORKSHOP. The cost here is
    // materials and wages per unit produced.
    unitCost: 5_200,
    unitValue: 16_500,

    districtCapacity: 2.5,
    wealthWeight: 0.6,
    populationWeight: 0.4,

    heatPerUnit: 0.34,
    // Nobody on the street can see it happening, which is most of the appeal.
    sentimentPerUnit: -0.02,
    evidence: 'violence',
    evidencePerUnit: 0.5,

    wastagePerWeek: 0.01,
    stockCap: 120,
  },
};

export const TRADE_IDS: TradeId[] = ['product', 'arms'];

// --------------------------------------------------------------- supply ---

export interface SupplierDef {
  id: string;
  name: string;
  blurb: string;
  /** Multiplies the unit cost. Cheap suppliers are cheap for a reason. */
  priceMultiplier: number;
  /** Units a week they can actually deliver. */
  ceiling: number;
  /** What it costs to open the arrangement. */
  retainer: number;
  /** Chance per week the arrangement simply falls over. */
  failureChancePerWeek: number;
  /** Evidence they leave behind by existing. */
  exposure: number;
}

/**
 * Where product comes from.
 *
 * Three of them, and the choice is the usual one in this game: cheap, reliable,
 * or quiet, and you get two at most. None of them is a person you control —
 * every one can stop delivering, which is what makes the trade a thing you
 * maintain rather than a switch you flick.
 */
export const SUPPLIERS: SupplierDef[] = [
  {
    id: 'dockside',
    name: 'Somebody on the waterfront',
    blurb:
      'Comes in through the port with everything else. Cheap, plentiful, and it arrives on ground somebody else has counted twice.',
    priceMultiplier: 0.85,
    ceiling: 90,
    retainer: 40_000,
    failureChancePerWeek: 0.05,
    exposure: 1.4,
  },
  {
    id: 'overland',
    name: 'A long road south',
    blurb:
      'Trucks, distance, and a great many hands. Dearer than the water and nobody in this city has any leverage over it.',
    priceMultiplier: 1.15,
    ceiling: 55,
    retainer: 65_000,
    failureChancePerWeek: 0.03,
    exposure: 0.8,
  },
  {
    id: 'quiet',
    name: 'A very careful arrangement',
    blurb:
      'Small, slow, and almost invisible. You will never get rich on it and you will never explain it to a grand jury either.',
    priceMultiplier: 1.4,
    ceiling: 28,
    retainer: 90_000,
    failureChancePerWeek: 0.015,
    exposure: 0.25,
  },
];

/**
 * What a supplier who has kept you thinks of you.
 *
 * `failureChancePerWeek` was a flat number and a flat number is not a
 * relationship. Measured over 24 careers running each arrangement for a year:
 * dockside lasted a mean of 18.4 weeks and was gone inside the year in 21 of
 * 24 of them. Pay $40,000, buy for four months, and one morning a coin comes
 * up. Nothing the player did caused it and nothing could have prevented it.
 *
 * ## Trust only ever helps, and that is a measurement rather than a mercy
 *
 * Three inputs were plotted and all three are degenerate under the probe's
 * bot: volume runs 3% to 4% of the supplier's own ceiling, heat sits pegged at
 * a median of 100, and time is the same for everybody. The bot cannot be told
 * apart from any other career on any axis this reads.
 *
 * So trust reduces the chance they walk and can never raise it. A loud career
 * earns none and behaves exactly as it does today — which is why no probe can
 * move — and a careful one gets an arrangement that holds. The price of being
 * loud is losing something good rather than being handed something worse, and
 * once you have had it that is a real price.
 *
 * Accrual is time, because time is the one input the plot did not find
 * degenerate, and heat is the gate on it. That makes the lever the thing a
 * player controls and the bot never does: keeping your head down.
 */
export const SUPPLY_TRUST = {
  /**
   * Weeks of an unbroken, quiet arrangement to reach full trust.
   *
   * Sized against the measured lifetime, and the first attempt was not. At 26
   * this sat *past* dockside's mean life of 18.4 weeks, so the reward was
   * beyond the median arrangement and almost nobody would ever have collected
   * it — a discount for surviving longer than most arrangements survive. The
   * measured lives are 18.4, 26.9 and 28.8 weeks, so twelve puts full trust
   * comfortably inside all three and lets it do the thing it is for, which is
   * to extend them.
   */
  weeksToFull: 12,
  /**
   * The most trust can cut the weekly chance they walk.
   *
   * At 0.8 a maintained dockside arrangement runs at 1% a week rather than 5%,
   * which turns a mean life of 18 weeks into something worth defending. Below
   * about a half the discount is not worth protecting and the lever is
   * decoration.
   */
  maxReduction: 0.8,
  /** Heat at or above this holds trust at nothing, however long you have dealt. */
  heatCeiling: 60,
  /**
   * Points trust moves toward its target each week.
   *
   * Ten rather than six because at six the drift, not the target, was the
   * binding constraint — full trust took seventeen weeks however short
   * `weeksToFull` was set, which quietly undid the retune above.
   */
  driftPerWeek: 10,
  /** Trust lost outright when a raid takes stock off you. */
  seizureCost: 35,
} as const;

export const SUPPLIER_BY_ID: Record<string, SupplierDef> = Object.fromEntries(
  SUPPLIERS.map((s) => [s.id, s]),
);

/**
 * Somewhere to buy finished crates, instead of building somewhere to make them.
 *
 * Arms are still *made* in a workshop and that is still the good way to run the
 * trade — the structural difference the header defends is intact. What this
 * adds is a second door, because the first one is priced for a career that has
 * already won. Measured peak funds over 24 careers that play: p75 $69,175,
 * p90 $94,345. A workshop is $120,000, and the trade wants Capo before that.
 * Under one career in ten can ever open it.
 *
 * The fork, and neither side dominates:
 *
 *     making   $120,000 up front, $5,200 a crate, and a building with an
 *              address a warrant can name
 *     buying   a small retainer, a much worse unit price, and nothing anybody
 *              can raid
 *
 * Cheap in and thin margins against dear in and fat margins. A buyer gets into
 * the trade in the middle of a career and never gets rich on it; a maker needs
 * the fortune first and then owns the whole spread. The exposure numbers say
 * the same thing from the other side — a workshop is a fixed address and this
 * is not, which is the one respect in which buying is strictly better.
 */
export const ARMS_SUPPLIERS: SupplierDef[] = [
  {
    id: 'crated',
    name: 'A freight agent with a loose manifest',
    blurb:
      'Sells finished crates by the pallet and asks nothing. Dear per unit, nothing to raid, and gone the moment it stops being worth their while.',
    /*
       Above 1 on purpose. `unitCost` multiplies the trade's own figure, so a
       multiplier under one would make buying cheaper than making in every
       respect and no career would ever build a workshop again.
    */
    priceMultiplier: 1.55,
    ceiling: 14,
    retainer: 26_000,
    failureChancePerWeek: 0.045,
    exposure: 0.9,
  },
  {
    id: 'surplus',
    name: 'A quartermaster with a paperwork problem',
    blurb:
      'Crates that were written off somewhere else. Steadier and dearer, and every one of them is on a list in a filing cabinet.',
    priceMultiplier: 1.85,
    ceiling: 22,
    retainer: 48_000,
    failureChancePerWeek: 0.02,
    exposure: 1.6,
  },
];

export const ARMS_SUPPLIER_BY_ID: Record<string, SupplierDef> = Object.fromEntries(
  ARMS_SUPPLIERS.map((s) => [s.id, s]),
);

/**
 * Coming in through the port.
 *
 * The waterfront supplier is cheapest and sits on ground somebody else owns,
 * which is the whole point: whoever holds the docks holds this trade, and a
 * trade that depends on their water is a trade they can price. This is the first
 * thing in the game where a diplomatic position has a direct number attached to
 * it.
 *
 * Neither this comment nor the blurb names the family any more. A career draws
 * its three rivals from a longer roster, so the Vasari are often not in the
 * city at all — rounds 12 and 13 both independently reported being told about a
 * family they had never met. Config cannot look up who actually holds the
 * waterfront without importing sim, and it must not, so the copy says
 * "somebody else" and lets the diplomacy screens name them.
 */
export const PORT = {
  supplierId: 'dockside',
  /** Multiplies the price while at war with whoever holds the waterfront. */
  atWarMultiplier: 2.4,
  /** ...and while merely on bad terms. */
  hostileMultiplier: 1.5,
  /** Holding the docks yourself takes the question away. */
  ownedMultiplier: 0.8,
};

// ------------------------------------------------------------ workshops ---

/**
 * Where crates come from.
 *
 * Arms are made rather than bought, which is the structural difference between
 * the two trades. A workshop is capital: it sits in a district, it produces
 * every week whether or not you have anywhere to send the output, and it is a
 * building with an address that a warrant can name.
 */
export const WORKSHOP = {
  cost: 120_000,
  /** Crates produced per week, each. */
  outputPerWeek: 6,
  /** Weekly running cost whether or not you sell anything. */
  upkeep: 4_400,
  /** Control needed in the district to run one. */
  minControl: 'control' as ControlLevel,
  /** Most you can run, total. */
  max: 4,
  /** Evidence per week, each. A workshop is a fixed address. */
  exposure: 1.1,
  /** What is lost when a raid takes one. */
  raidRefundShare: 0.1,
};

// -------------------------------------------------------- selling to them --

/**
 * Selling crates to another family.
 *
 * The most double-edged thing in the game, and the reason the arms trade is
 * worth building separately from the product trade. They pay well above street
 * value because they are buying capability rather than goods — and what they do
 * with it is become measurably harder to fight.
 *
 * A player who funds their war with arms sales is arming the people they will
 * be at war with in eighteen months. Nothing warns them. The strength number on
 * the Rivals panel simply goes up.
 */
export const ARMS_SALE = {
  /** Multiplier on unit value when the buyer is an organization. */
  priceMultiplier: 1.45,
  /** Strength the buyer gains per crate. */
  strengthPerCrate: 0.55,
  /** They think better of somebody who supplies them. */
  trustPerSale: 4,
  respectPerSale: 3,
  /** Minimum they will bother with. */
  minCrates: 5,
  /** Nobody buys from somebody they are shooting at. */
  requiresPeace: true,
  /** Evidence: a crate with your name on it in somebody else's hands. */
  evidence: 12,
};

/**
 * Crates you did not sell.
 *
 * `ARMS_SALE` above gives a buyer `strengthPerCrate` of strength and says, in
 * as many words, that a player funding a war with arms sales is arming the
 * people they will fight. That was only half a mechanic: keeping the crates
 * did nothing. `playerStrength` counts bodies and their quality and reads no
 * stock at all, so an armoury was inventory waiting for a buyer.
 *
 * The rate is deliberately the same number a buyer gets. A crate cannot be
 * worth one thing in a rival's hands and another in yours, and pinning the two
 * together is what makes the sale a genuine trade rather than free money —
 * every crate sold moves the same quantity from your column to theirs.
 *
 * Capped, and the cap is the important part. A stockpile is meant to make a
 * crew harder to beat, not to replace one; without a ceiling the answer to
 * every war is a warehouse. `armsStrength` also returns nothing when there is
 * nobody left to carry any of it, which is enforced where strength is summed
 * rather than here.
 */
export const ARMED = {
  /** Strength per crate on hand. Same rate a buyer gets — see above. */
  strengthPerCrate: ARMS_SALE.strengthPerCrate,
  /**
   * The most an armoury can ever be worth.
   *
   * `playerStrength` is clamped to 100 and a serious crew sits well under it,
   * so this is a meaningful supplement without being the whole answer. Forty
   * crates reaches the ceiling; everything past that is stock for selling.
   */
  maxStrength: 22,
  /** Crates burned per week, per war being fought. */
  spentPerWarWeek: 3,
} as const;

// ------------------------------------------------------------- pressure ---

/** What a search warrant does to stock, on top of everything else it does. */
export const SEIZURE = {
  /** Share of stock taken when a warrant lands. */
  stockShare: [0.4, 0.9] as [number, number],
  /** Evidence written by finding it. */
  evidence: 22,
  /** Chance a raid also takes a workshop. */
  workshopChance: 0.35,
};

/** How much a district's control level lets through. */
export const CONTROL_THROUGHPUT: Record<ControlLevel, number> = {
  none: 0,
  presence: 0,
  foothold: 0.35,
  control: 0.75,
  dominance: 1,
};

/**
 * Distribution needs people, not only ground.
 *
 * Units one available crew member can move in a week. Without this the trade
 * is free money for an organization of three, and the whole point is that it
 * competes with operations for the same bodies.
 */
export const UNITS_PER_CREW = 9;
