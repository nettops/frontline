/**
 * The city.
 *
 * Twelve districts on a 3x4 board. Adjacency is what makes the map a map:
 * you can only work somewhere you already hold or somewhere next to it, so
 * expansion has a front line rather than being a shopping list.
 *
 * `col`/`row` are the schematic map layout. Adjacency is declared explicitly
 * rather than derived from the grid, so the board can grow an irregular shape
 * later without the rules changing.
 */

export interface TerritoryDef {
  id: string;
  name: string;
  blurb: string;
  col: number;
  row: number;
  adjacent: string[];
  /** Multiplies operation payouts run here. */
  wealth: number;
  /** Multiplies heat generated here, and shaves success. */
  policePresence: number;
  /** Caps how many businesses can exist here. */
  businessDensity: number;
  population: number;
  /** Weight for rank requirements and, from 4b, rival targeting. */
  strategicValue: number;
}

export const TERRITORIES: TerritoryDef[] = [
  // --- north ---------------------------------------------------------------
  {
    id: 'northside',
    name: 'Northside',
    blurb: 'Row houses and union halls. Everybody knows everybody, which cuts both ways.',
    col: 0,
    row: 0,
    adjacent: ['the_heights', 'old_quarter'],
    wealth: 60,
    policePresence: 55,
    businessDensity: 55,
    population: 51_000,
    strategicValue: 50,
  },
  {
    id: 'the_heights',
    name: 'The Heights',
    blurb: 'Money that arrived two generations ago and would rather not be reminded how.',
    col: 1,
    row: 0,
    adjacent: ['northside', 'fairgrounds', 'downtown'],
    wealth: 78,
    policePresence: 70,
    businessDensity: 60,
    population: 44_000,
    strategicValue: 75,
  },
  {
    id: 'fairgrounds',
    name: 'Fairgrounds',
    blurb: 'Half of it is empty nine months a year. The other half never closes.',
    col: 2,
    row: 0,
    adjacent: ['the_heights', 'garment_district'],
    wealth: 48,
    policePresence: 40,
    businessDensity: 45,
    population: 27_000,
    strategicValue: 40,
  },

  // --- centre --------------------------------------------------------------
  {
    id: 'old_quarter',
    name: 'Old Quarter',
    blurb: 'Narrow streets, long memories, and more back rooms than storefronts.',
    col: 0,
    row: 1,
    adjacent: ['northside', 'downtown', 'little_sicily'],
    wealth: 50,
    policePresence: 45,
    businessDensity: 65,
    population: 47_000,
    strategicValue: 45,
  },
  {
    id: 'downtown',
    name: 'Downtown',
    blurb: 'Where the real money is, and where they have the people to protect it.',
    col: 1,
    row: 1,
    adjacent: ['the_heights', 'old_quarter', 'garment_district', 'riverside'],
    wealth: 85,
    policePresence: 80,
    businessDensity: 90,
    population: 62_000,
    strategicValue: 95,
  },
  {
    id: 'garment_district',
    name: 'Garment District',
    blurb: 'Freight in, freight out, and nobody counting very carefully.',
    col: 2,
    row: 1,
    adjacent: ['fairgrounds', 'downtown', 'rail_yards'],
    wealth: 55,
    policePresence: 45,
    businessDensity: 75,
    population: 39_000,
    strategicValue: 50,
  },

  // --- inner south ---------------------------------------------------------
  {
    id: 'little_sicily',
    name: 'Little Sicily',
    blurb: 'Where you are from. People here will talk to you before they talk to anyone.',
    col: 0,
    row: 2,
    adjacent: ['old_quarter', 'riverside', 'the_docks'],
    wealth: 30,
    policePresence: 25,
    businessDensity: 45,
    population: 38_000,
    strategicValue: 30,
  },
  {
    id: 'riverside',
    name: 'Riverside',
    blurb: 'Respectable enough by daylight. Considerably less so after it.',
    col: 1,
    row: 2,
    adjacent: ['downtown', 'little_sicily', 'rail_yards', 'southport'],
    wealth: 40,
    policePresence: 35,
    businessDensity: 50,
    population: 41_000,
    strategicValue: 40,
  },
  {
    id: 'rail_yards',
    name: 'Rail Yards',
    blurb: 'Everything that enters the city touches this ground first.',
    col: 2,
    row: 2,
    adjacent: ['garment_district', 'riverside', 'warehouse_district'],
    wealth: 38,
    policePresence: 40,
    businessDensity: 60,
    population: 18_000,
    strategicValue: 55,
  },

  // --- waterfront ----------------------------------------------------------
  {
    id: 'the_docks',
    name: 'The Docks',
    blurb: 'Whoever holds this decides what the city gets and what it pays for it.',
    col: 0,
    row: 3,
    adjacent: ['little_sicily', 'southport'],
    wealth: 35,
    policePresence: 30,
    businessDensity: 55,
    population: 22_000,
    strategicValue: 70,
  },
  {
    id: 'southport',
    name: 'Southport',
    blurb: 'Nobody has looked closely at Southport in twenty years.',
    col: 1,
    row: 3,
    adjacent: ['riverside', 'the_docks', 'warehouse_district'],
    wealth: 28,
    policePresence: 22,
    businessDensity: 40,
    population: 31_000,
    strategicValue: 35,
  },
  {
    id: 'warehouse_district',
    name: 'Warehouse District',
    blurb: 'Acres of things belonging to people who are not here.',
    col: 2,
    row: 3,
    adjacent: ['rail_yards', 'southport'],
    wealth: 45,
    policePresence: 35,
    businessDensity: 70,
    population: 15_000,
    strategicValue: 65,
  },
];

export const TERRITORY_BY_ID: Record<string, TerritoryDef> = Object.fromEntries(
  TERRITORIES.map((t) => [t.id, t]),
);

/**
 * Where you are from. You start with a presence here and nothing anywhere
 * else — deliberately just short of the foothold that unlocks businesses, so
 * the first thing the territory system teaches you is that you have to earn it.
 */
export const HOME_TERRITORY = 'little_sicily';
export const STARTING_HOME_INFLUENCE = 20;

// ------------------------------------------------------------- influence ---

export type ControlLevel = 'none' | 'presence' | 'foothold' | 'control' | 'dominance';

export const CONTROL_THRESHOLDS: { level: ControlLevel; min: number }[] = [
  { level: 'dominance', min: 75 },
  { level: 'control', min: 50 },
  { level: 'foothold', min: 25 },
  { level: 'presence', min: 10 },
  { level: 'none', min: 0 },
];

export const CONTROL_LABEL: Record<ControlLevel, string> = {
  none: 'Nothing here',
  presence: 'Presence',
  foothold: 'Foothold',
  control: 'Control',
  dominance: 'Dominance',
};

/**
 * Control also requires being the strongest faction present — a 60 against a
 * rival's 70 is a fight, not a holding.
 */
export const CONTROL_REQUIRES_LEAD: ControlLevel[] = ['control', 'dominance'];

/** Influence lead below this and the district reads as contested. */
export const CONTESTED_MARGIN = 15;

/**
 * Business slots unlocked by control level, capped again by density.
 *
 * Was 0 / 0 / 1 / 2 / 3. A district you own outright allowed two shops, so a
 * family holding four districts — which is the most any measured career ever
 * held — could own eight fronts, and eight fronts is what the estate is made
 * of once the cash is spent. Measured: the estate ran to $244,295 at the
 * median against the $1,250,000 the rank table asks a Boss for.
 *
 * Owning a neighbourhood ought to mean owning what is in it. The reward for
 * consolidating was one extra shop per rung, which is not a reward, it is a
 * rounding. Now taking a district from foothold to dominance takes it from one
 * front to five, which is the difference between a corner and a borough.
 *
 * Density still caps it independently, so a quiet residential street does not
 * become a commercial strip because you took it. The two limits together are
 * what stop this becoming a licence to print an estate.
 */
export const SLOTS_BY_CONTROL: Record<ControlLevel, number> = {
  none: 0,
  presence: 0,
  foothold: 1,
  control: 3,
  dominance: 5,
};

/**
 * Heat generated in a district you hold is reduced — your people see them
 * coming.
 *
 * These were 1 / 1 / 0.95 / 0.85 / 0.7, which is a rounding error dressed as a
 * reward. Measured across 36 four-year careers: a family can run a job in 24%
 * of the weeks of a career, and 36% of all weeks are lost to heat sitting
 * above the line where any sensible boss stops working. Everything above Capo
 * compounds off that quarter — respect, money, ground, the estate — so heat is
 * the ceiling on the whole top half of the ladder, and holding ground was
 * doing almost nothing about it.
 *
 * A neighbourhood you own is one where the man on the corner tells you which
 * car has been parked there twice. That should be the difference between
 * working and not, and now it is: a district at dominance makes half the heat
 * of a street you have no claim on.
 *
 * This is deliberately the reward for consolidating rather than for spreading.
 * A family with a toe-hold in seven districts gets almost none of it; one that
 * holds four outright gets most of it. That is the shape the rank table has
 * always asked for and the economy never paid.
 */
export const HEAT_REDUCTION_BY_CONTROL: Record<ControlLevel, number> = {
  none: 1,
  presence: 0.95,
  foothold: 0.85,
  control: 0.68,
  dominance: 0.5,
};

// ------------------------------------------------- operation interactions ---

/**
 * Influence from a successful job: base + a step per tier of the job.
 *
 * Set against rivals that actively push back. The player's edge is
 * concentration — they work one district repeatedly while a family spreads
 * across the city — so these do not need to match rival expansion rates
 * one for one, but they do have to outpace being leaned on by one family.
 */
export const INFLUENCE_PER_OPERATION = 3;
export const INFLUENCE_PER_OPERATION_TIER = 2;
/** A failed job still puts your name on the district, but far less of it. */
export const INFLUENCE_ON_FAILURE_SHARE = 0.25;

/**
 * How much of what you take in a district comes off whoever was holding it.
 *
 * Until this existed, working a district only ever raised the player's own
 * number, and `controlLevel` will not call it control unless you are the
 * strongest family present. Measured across 35 four-year careers: ten of the
 * twelve districts end owned outright by a rival at 50 or more, the median
 * career finds *no* open ground at all, and in 420 district-observations the
 * player took a district off a family that held it three times. Boss asks for
 * five districts. It had never once been reached.
 *
 * The rival AI has had this move since it was written — `executePressure` in
 * `faction.ts` takes 3 to 8 points off whoever it leans on. The player had no
 * equivalent at any price, so the only route to a fifth district was a war,
 * and the ladder above Capo was gated on something the game did not afford.
 *
 * So showing up somewhere pushes the incumbent back, at half of what you gain.
 * It is deliberately slower than the rival's own move: they pay $25,000 and
 * take up to 8 at a stroke, you take about one and a half per successful job
 * and have to keep coming back. Muscling in is not an action here, it is a
 * campaign — which is also why it needs no new button, no new screen and no
 * new saved state.
 *
 * The rival notices. Losing ground is what makes you worth leaning on, so the
 * families push back through their own decision loop rather than through
 * anything written here.
 */
export const MUSCLE_IN_SHARE = 0.8;

/** Payout multiplier: wealth 0 pays 0.7x, 50 pays 1.0x, 100 pays 1.3x. */
export const WEALTH_PAYOUT_BASE = 0.7;
export const WEALTH_PAYOUT_RANGE = 0.6;

/** Heat multiplier: police 0 is 0.6x, 50 is 1.0x, 100 is 1.4x. */
export const POLICE_HEAT_BASE = 0.6;
export const POLICE_HEAT_RANGE = 0.8;

/** Success lost to a heavy police presence, at maximum. */
export const POLICE_SUCCESS_PENALTY = 0.08;

/** Working a district you have no presence in — adjacent only, and it shows. */
export const UNFAMILIAR_SUCCESS_PENALTY = 0.08;
export const UNFAMILIAR_HEAT_MULTIPLIER = 1.25;

/** Influence bleeds where you stop showing up. */
export const INFLUENCE_DECAY_PER_WEEK = 0.3;
export const DAYS_IDLE_BEFORE_DECAY = 14;

// -------------------------------------------------------------- sentiment ---

/**
 * How the neighbourhood feels about you. It does exactly two things: below the
 * floor it costs you success, and it blocks buying businesses. That is enough
 * to make violence in your own back yard a real cost.
 */
/**
 * Where a neighbourhood starts, and the ceiling its goodwill recovers to.
 *
 * This was 50, and three numbers were stacked inside five points of each
 * other: districts started at 50, recovery was capped at 50, and a front
 * begins dying when sentiment falls under `HEALTH.sentimentFine` of 45. So the
 * healthy case was the knife edge — any violence at all put a district below
 * the line that kills fronts, and nothing could ever climb back above it.
 *
 * Measured consequence: a hostile neighbourhood is the largest single thing
 * wearing fronts down at -1.42 a front-week, ahead of rivals and the city's
 * mood combined; 51% of the weeks before a family owns any front are weeks
 * where nobody in the district will sell to it; and 36% of all paydays happen
 * with no front operating at all. The laundering economy is gated on
 * neighbourhood goodwill at both ends, and goodwill had nowhere to live.
 *
 * Tried at 65 and put back. The band is real and so is the cost of widening
 * it here: `deep.test.ts` asserts that a district worked hard loses people,
 * and at 65 it stopped losing them — Little Sicily's population held above its
 * founding figure through the exact treatment the test applies. Population
 * follows sentiment, so lifting the floor under sentiment lifts it under the
 * consequence as well, and the strip-mining feedback is one of the few things
 * a blind tester has ever called out as landing.
 *
 * It also bought almost nothing: with the starting figure at 65 the amount
 * laundered per career *fell*, from $145,587 to $134,623. The gain that run
 * appeared to show came from a different change measured at the same time.
 *
 * If this band is worth opening, it should be opened where it does not also
 * move population — `HEALTH.sentimentFine` at 45 is the number that decides
 * whether a front survives, and lowering it is the untried version.
 */
export const SENTIMENT_START = 50;
export const SENTIMENT_ON_SUCCESS = 0.3;
export const SENTIMENT_ON_FAILURE = -2;
export const SENTIMENT_ON_VIOLENCE = -6;
/**
 * How fast a neighbourhood forgets, when you leave it alone.
 *
 * This was 0.6. Round 8's tester measured it from the chair and put it better
 * than any probe had: fourteen consecutive idle days moved three separate
 * districts by exactly one point each. From the 6 they had driven Riverside
 * down to, that is over four hundred idle days to become sellable again, in a
 * game they played for 157.
 *
 * The consequence is that wrecking a district was permanent, the refusal to
 * sell never named its cause, and the only fast repair was a memo that turned
 * out to be broken. They spent 125 of 157 days locked out of half the economy
 * while solvent.
 *
 * At 2.0 a district driven to the floor is sellable again in about three
 * months of being left alone. That is still a serious price — three months is
 * most of a season of a career — and it is a price rather than a wall.
 *
 * The rate rather than the ceiling, deliberately. `SENTIMENT_START` was tried
 * at 65 this morning and reverted: population follows sentiment, so lifting
 * the floor also lifted it under the consequence, and `deep.test.ts` holds
 * that a district worked hard loses its people. A faster recovery does not
 * touch what happens while you are still working the place.
 */
export const SENTIMENT_RECOVERY_PER_WEEK = 2.0;
export const SENTIMENT_HOSTILE_BELOW = 30;
export const SENTIMENT_HOSTILE_SUCCESS_PENALTY = 0.06;

// -------------------------------------------------- districts that change ---

/**
 * A district as a living place rather than a fixed set of modifiers.
 *
 * `wealth` and `population` above are now a *founding* character — where the
 * district stood on day one — and the numbers the game actually reads are
 * `prosperity` and `people` on the Territory, which move.
 *
 * The decision this exists to create is extraction against cultivation. Running
 * product through a district earns immediately and costs its prosperity; fronts
 * and a neighbourhood that likes you raise it. A player who strip-mines the
 * whole map ends up holding twelve poor districts and wondering why the same
 * jobs pay half what they used to — which is a consequence that arrives four
 * years after the decision that caused it, and is legible the whole way.
 */
export const DISTRICT_LIFE = {
  /** Share of the gap to its target a district closes each week. */
  drift: 0.02,
  /** ...and for people, who move house far more slowly than a shop closes. */
  peopleDrift: 0.004,

  /** Prosperity a front operating here is worth. */
  perBusiness: 6,
  /** ...and what a route running contraband through here costs it. */
  perRoute: -7,
  /*
   * Sentiment pushes prosperity around, above and below the midpoint.
   *
   * Measured at 0.30, 0.20, 0.15 and 0.10 against the two-bot guard. At 0.20
   * and above the reckless bot stops being merely punished and starts dying:
   * it fails half its jobs in one district, sentiment collapses, prosperity
   * follows it down, and the payout cut finishes a run that was already thin.
   * That is a real feedback loop and it should exist — it just should not be
   * the loudest thing in the system. 0.15 keeps the link legible over a decade
   * without turning a bad month into a spiral.
   */
  sentimentWeight: 0.15,
  /** Two families at war both standing here. Nobody opens anything. */
  warCost: -14,
  /** Influence a faction needs here before a war between them touches it. */
  warPresence: 20,

  /**
   * Floor and ceiling, as a share of the district's founding wealth.
   *
   * The floor is what stops the compounding from running away: a stripped
   * district gets much poorer and never becomes worthless, because a
   * worthless district is one the player simply stops looking at, and a board
   * position you ignore is not a consequence.
   */
  prosperityBounds: [0.35, 1.5] as [min: number, max: number],
  peopleBounds: [0.55, 1.35] as [min: number, max: number],
} as const;
