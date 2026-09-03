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
 * Both rows have since grown a second door, and neither door collapses that
 * distinction. Arms can be *bought* in finished crates at a worse unit price
 * (ARMS_SUPPLIERS), and product can be *made* in a plant that produces no
 * units at all — it only changes what a unit costs and takes away the
 * arrangement's ability to walk out (PLANT). A workshop makes things. A plant
 * changes terms. That is deliberate: the day both trades are "spend capital,
 * receive units" is the day there is only one trade here.
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

export type TradeId = 'product' | 'arms';

export interface TradeDef {
  id: TradeId;
  name: string;
  /** What a unit is called, singular and plural, for the panel. */
  unit: [one: string, many: string];
  blurb: string;
  /** Lowest rank that can run it at all. */
  /** Fronts you must be running before anyone will sell into this trade. */
  minFronts: number;
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
    /*
       Two fronts to move it through, rather than a rank.

       This read `minRank: 'crew_leader'`, which was a clean-money threshold
       wearing a title — and the title came off the screen the day the player
       became the boss from the first morning. Fronts are the honest
       requirement anyway: the product moves through premises, and a career
       reaches two of them around day 90, which is where Crew Leader used to
       land.
    */
    minFronts: 2,
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
    /*
     * The reason this is not simply the best thing in the game. A district you
     * run product through turns on you, and sentiment gates businesses,
     * operation success and eventually whether anybody will sell to you at all.
     *
     * That was the claim. It was false for the life of the feature, and it was
     * false by an order of magnitude.
     *
     * A district recovers `SENTIMENT_RECOVERY_PER_WEEK` = 2.0 a week toward
     * indifference. Downtown — the largest district on the board — held at
     * dominance and saturated with product carries 6.6 units a week, which at
     * -0.11 is 0.73. Every street in the city therefore got *happier*, at
     * +1.27 a week net, while narcotics ran through it. The four biggest
     * districts, at their ceilings:
     *
     *     Downtown     6.6 units/wk   -0.73   net +1.27
     *     Northside    5.2            -0.57   net +1.43
     *     The Heights  5.1            -0.57   net +1.43
     *     Old Quarter  4.7            -0.51   net +1.49
     *
     * A blind tester ran product through his own neighbourhood for 348 days,
     * at $101,099 a week, and reported its feeling at 50 out of 100 — the
     * value it started at. Meanwhile a single standing-order Protection Racket
     * had taken another district to 2. The trade was the most profitable thing
     * in the game and also the safest, and its own blurb said the opposite.
     *
     * -0.88, and the drain settles rather than racing, which is the other half
     * of the repair. The first attempt was a flat -0.45 against a flat +2.0,
     * and a flat cost against a flat recovery has no equilibrium in it — it is
     * a linear race, so the loser bottoms out. Measured over 36 trading
     * careers: worst feeling in a district they ran through, **median 1**, and
     * 36 of 36 took one below `SENTIMENT_HOSTILE_BELOW`. That is a cliff, not
     * a price, and it is the same failure as the original in the other
     * direction — the district's state stopped mattering.
     *
     * So the cost scales by how much room is left above `TRADE_SENTIMENT_FLOOR`
     * (see there), which gives every district an equilibrium instead: the
     * biggest, most saturated ground settles lowest, a trickle through a small
     * district never turns it at all, and *which street you run it through*
     * becomes the decision it was always described as. Downtown at dominance
     * settles near 27 — under the bar that stops people selling you premises.
     * Stopping still heals at +2.0, which the second half of the guard in
     * `deep.test.ts` holds.
     */
    sentimentPerUnit: -0.88,
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
    // A district actually under your control, plus somewhere to keep it. The
    // old `minRank: 'capo'` is gone with the rest of the ladder; `minControl`
    // below was always doing most of this gate's work.
    minFronts: 3,
    minControl: 'control',

    // Manufacture rather than purchase — see WORKSHOP. The cost here is
    // materials and wages per unit produced.
    unitCost: 5_200,
    unitValue: 16_500,

    districtCapacity: 2.5,
    wealthWeight: 0.6,
    populationWeight: 0.4,

    heatPerUnit: 0.34,
    /*
     * Nobody on the street can see it happening, which is most of the appeal.
     *
     * Raised with product and by the same factor, so the 5.5x contrast between
     * the two — the whole reason a boss picks one over the other — is the
     * thing that survives rather than a number. At a district ceiling of 2.3
     * crates this is 0.37 a week against a 2.0 recovery, which never turns a
     * street on its own: arms stays a problem with the law, priced in
     * `heatPerUnit` and `evidencePerUnit`, not a problem with the
     * neighbourhood.
     */
    sentimentPerUnit: -0.16,
    evidence: 'violence',
    evidencePerUnit: 0.5,

    wastagePerWeek: 0.01,
    stockCap: 120,
  },
};

/**
 * How low the trade alone will take a street.
 *
 * `sentimentPerUnit` is scaled by the room left above this, so the drain
 * weakens as a district sours and stops at the floor. Two reasons it is here
 * rather than at zero.
 *
 * The first is measurement. A flat drain against the flat
 * `SENTIMENT_RECOVERY_PER_WEEK` is a race with no equilibrium, and 36 careers
 * of it put the median worst district at 1 out of 100 with every career taking
 * one below the hostile bar. Nothing in the game was left to decide.
 *
 * The second is what it says. A neighbourhood that resents what you move
 * through it is not a neighbourhood in revolt; it is one that will not sell
 * you premises and will not help when something goes wrong. Getting past that
 * takes something the trade does not do on its own — a job that goes badly, a
 * body, a standing order grinding the same corner. Those still push below it.
 * The floor is what *this* cause is worth, not a limit on how bad a street can
 * get.
 */
export const TRADE_SENTIMENT_FLOOR = 15;

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

// ----------------------------------------------------------- own supply ---

/**
 * Making it yourself, instead of buying it from somebody.
 *
 * The obvious version of this is a second WORKSHOP — spend capital, receive
 * units — and it is the wrong build. The header above states the asymmetry
 * between the two trades as a design position: product is a *relationship* you
 * have to maintain and arms are a *capital asset* somebody can raid. Give
 * product a unit-producing facility and both rows collapse into the same
 * thing, `supplierTrust` becomes flavour a player can buy their way out of,
 * and the one structural difference between the trades is gone.
 *
 * So a plant does not produce units. It **changes the terms**:
 *
 *     keep buying   the supplier's price, moving with whoever holds the water,
 *                   and a weekly chance they simply stop
 *     build one     materially lower and fixed, nobody to walk out on you, and
 *                   an address a warrant can point at
 *
 * Neither dominates, and the ceiling is what keeps that true. One plant covers
 * `supplyPerWeek` and no more, which is well under what any of the three
 * arrangements can deliver — so a plant is the cheap base load and a supplier
 * is still how a large operation is fed. The arrangement survives the
 * facility, which is the constraint this was designed against.
 *
 * ## Every number here off a plotted distribution
 *
 * Measured on `ladder.probe`'s bot — the project's standard career — over 144
 * careers. Peak funds inside the first year *after* the trade opened, which is
 * the state a player is actually in when this becomes a question:
 *
 *     reached the trade   131/144
 *     peak funds          p10 $38,690   median $236,014   p75 $766,036
 *
 * `cost` sits just above the median, per DIRECTOR §5, which puts a plant
 * inside reach of about half the careers that get as far as running the trade
 * — measured directly, 84 of 131 ever hold $185,000 and 64 of 131 ever hold
 * $260,000.
 *
 * The first pass priced this at $185,000 off a bot written for the feature,
 * which reported a median peak of $176,843. That bot opened a supply in 14
 * careers of 36 where the standard one reaches two fronts in 132 of 144: F7,
 * and the third time in this cycle an instrument written alongside a feature
 * has flattered it. The figure above is the standard bot's.
 *
 * Dearer than the arms workshop on purpose. The workshop was the PATRON shape
 * at $120,000 against a p90 of $94,345; this is priced against the careers
 * that can actually ask the question.
 */
export const PLANT = {
  cost: 250_000,
  /**
   * What a unit costs here, as a share of the trade's own base figure.
   *
   * Against the three arrangements — 0.85, 1.15 and 1.40 — this is roughly
   * half the cheapest of them and a third of the dearest. Large enough to be
   * worth $185,000 and a weekly bill; small enough that it does not make the
   * margin so fat that the district capacity stops being the thing that
   * matters.
   */
  unitCostShare: 0.45,
  /**
   * Units a week one plant will cover, at the cheap price.
   *
   * The whole reason the supplier survives. Measured weekly throughput while a
   * supply is open runs a median of 9 and a p90 of 27.8, so one plant carries
   * a median operation and three of them still fall short of what the
   * waterfront alone can deliver.
   */
  supplyPerWeek: 10,
  /** Weekly running cost, whether or not a single unit moves. */
  upkeep: 2_600,
  /** Control needed in the district. A foothold is not somewhere to put this. */
  minControl: 'control' as ControlLevel,
  /** Most you can run, total. */
  max: 3,
  /**
   * Evidence per week, each.
   *
   * Higher than any of the three arrangements — the dearest of those is the
   * waterfront at 1.4 — because this is the one that cannot be walked away
   * from. A delivery pattern stops when the deliveries stop. A building does
   * not.
   */
  exposure: 1.6,
  /** What survives a warrant. Same share a workshop gets. */
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
  /** ...and the same again for a plant, which is equally an address. */
  plantChance: 0.35,
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
