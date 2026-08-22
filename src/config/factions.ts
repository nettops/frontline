/**
 * The other families.
 *
 * They run the same decision loop the player does — look at the board, price
 * the options, act. What makes them behave like different organizations is
 * `personality`: four weights that change which options score well. The
 * Falcone sit on what they have, the Kestler take whatever is unwatched, and
 * neither of those is a script. Change the weights and the family changes.
 */

import type { FactionAgendaKind } from '../sim/types';

export type FactionId = 'player' | 'falcone' | 'vasari' | 'kestler';

export const RIVAL_IDS: FactionId[] = ['falcone', 'vasari', 'kestler'];
export const ALL_FACTIONS: FactionId[] = ['player', ...RIVAL_IDS];

/**
 * What a family wants, as weights rather than rules.
 *
 * Every rival scores the same four options each week; these multiply those
 * scores. A high-aggression, low-caution family will move on a weak neighbour
 * while a cautious one is still counting its money — from one code path.
 */
export interface FactionPersonality {
  /** Weights moving against somebody. */
  aggression: number;
  /** Weights taking new ground. */
  ambition: number;
  /** Weights buying fronts and earning quietly. */
  commerce: number;
  /** Weights going quiet, and how much their own heat frightens them. */
  caution: number;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  shortName: string;
  blurb: string;
  /** How they are spoken about — shown before you know anything concrete. */
  reputation: string;
  /** Map and table colour. */
  colour: string;
  /** Starting influence by territory id. Everything unlisted is zero. */
  influence: Record<string, number>;
  personality: FactionPersonality;
  startingWealth: number;
  startingStrength: number;
}

const FACTIONS: FactionDef[] = [
  {
    id: 'player',
    name: 'Your organization',
    shortName: 'You',
    blurb: 'Whatever this turns out to be.',
    reputation: '',
    colour: '#c9a227',
    influence: {},
    personality: { aggression: 0, ambition: 0, commerce: 0, caution: 0 },
    startingWealth: 0,
    startingStrength: 0,
  },
  {
    id: 'falcone',
    name: 'The Falcone Family',
    shortName: 'Falcone',
    blurb:
      'The oldest outfit in the city and the most comfortable. They hold the centre and they have held it a long time.',
    reputation:
      'Everybody knows the Falcone. Nobody can remember the last time they had to prove anything.',
    colour: '#8f4a3c',
    influence: {
      downtown: 62,
      the_heights: 48,
      old_quarter: 40,
      northside: 30,
      garment_district: 22,
    },
    // Rich, established, and mostly interested in staying that way. They react
    // to encroachment rather than seeking ground.
    personality: { aggression: 0.55, ambition: 0.35, commerce: 0.8, caution: 0.9 },
    startingWealth: 900_000,
    startingStrength: 78,
  },
  {
    id: 'vasari',
    name: 'The Vasari Organization',
    shortName: 'Vasari',
    blurb:
      'Waterfront people. Everything that moves through the port has been counted by somebody who answers to them.',
    reputation:
      'Dock people. Practical, patient, and they own more of the waterfront than anyone admits.',
    colour: '#4a6f7a',
    influence: {
      the_docks: 55,
      southport: 44,
      warehouse_district: 38,
      riverside: 24,
      little_sicily: 12,
    },
    // Traders first. They would rather buy a district than fight for it.
    personality: { aggression: 0.4, ambition: 0.6, commerce: 1.0, caution: 0.6 },
    startingWealth: 620_000,
    startingStrength: 62,
  },
  {
    id: 'kestler',
    name: 'The Kestler Crew',
    shortName: 'Kestler',
    blurb:
      'Newer, smaller, and less interested in how things have always been done. They take what nobody is watching.',
    reputation:
      'Nobody had heard of them five years ago. They are not careful and it has not cost them yet.',
    colour: '#6b7f4a',
    influence: {
      rail_yards: 42,
      fairgrounds: 36,
      garment_district: 30,
      warehouse_district: 20,
    },
    // Hungry and reckless. The family most likely to come at the player early.
    personality: { aggression: 1.0, ambition: 0.95, commerce: 0.4, caution: 0.3 },
    startingWealth: 240_000,
    startingStrength: 45,
  },
];

export const FACTION_BY_ID: Record<FactionId, FactionDef> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
) as Record<FactionId, FactionDef>;

/**
 * How clearly you can read a district's balance of power.
 *
 * Same principle as reading a person: you know what you are close to. A
 * district you have never worked shows that somebody is active, not who or
 * how much.
 */
export const INTEL_PRECISE_ABOVE = 25;
export const INTEL_ROUGH_ABOVE = 10;

// ------------------------------------------------------------- rival AI ---

/** How often each family reconsiders its position. */
export const FACTION_DECISION_INTERVAL_DAYS = 7;

/**
 * Scoring weights for the four things a family can do in a week. These are
 * multiplied by personality, so they set the baseline shape of rival
 * behaviour and personality sets each family's deviation from it.
 */
export const AI = {
  /** Random jitter added to every score, so identical boards do not loop. */
  scoreJitter: 0.12,
  /** Below this score nothing is worth doing and they sit still. */
  actionThreshold: 0.12,

  /**
   * How appealing each class of action is at all, before situation and
   * personality. Without these the four scores have no common scale and
   * whichever formula happens to produce bigger numbers wins every time —
   * taking new ground always beat fighting for it, so rivals never actually
   * threatened anybody. Tune these to change what rival behaviour feels like.
   */
  weights: {
    expand: 1,
    pressure: 2,
    // Deliberately the least attractive: buying fronts is the one action the
    // player never sees or feels. A rival that mostly invests is a rival that
    // may as well not be in the game.
    invest: 0.9,
    consolidate: 1,
    /** Suing for peace, which should be readily reachable when losing. */
    diplomacy: 1.4,
    /** Starting a war. Deliberately a high bar — wars ruin everybody. */
    declareWar: 0.7,
    /**
     * Nobody goes to war with a two-man crew; they just push it around, which
     * is what `pressure` is for. Without a floor here the families declared war
     * on the player in their first year every time and ground them down before
     * they could build anything.
     */
    declareWarMinTargetStrength: 22,
    /** And it takes a real grievance, not mild dislike. */
    declareWarMaxRelationship: -45,
    /**
     * Strength lead needed before a family will start a war.
     *
     * Was a flat 20 points, which three evenly matched organizations could
     * never reach — the measured cause of zero rival wars across thirty years
     * and six seeds. It is now a ceiling that a real grievance eats into: at
     * the bottom of the scale a family will go at somebody it merely matches,
     * because by then it is not a calculation any more.
     */
    declareWarLead: 20,
    declareWarLeadFloor: 2,
    /** Relationship at which the lead requirement has fully collapsed. */
    declareWarDesperateAt: -66,
    /** Taking somebody's unhappy man. Quiet and nasty, but not constant. */
    poach: 0.8,
  },

  /**
   * Span of control: a family holding a lot of ground finds another district
   * less attractive than its first. This is what makes organizations stop
   * growing and start consolidating without being told to.
   */
  comfortableDistricts: 6,

  expand: {
    /** Influence gained in the target district. */
    gain: [3, 6] as [number, number],
    costPerPoint: 9_000,
    heat: 2.5,
    /** How much of a district's appeal is position versus money. */
    strategicWeight: 0.4,
    wealthWeight: 0.3,
    quietWeight: 0.3,
    /**
     * How much an ambitious family will still want a district somebody else
     * already owns.
     *
     * The room-to-expand term used to fall to zero against a full district,
     * which read as sensible and was quietly fatal. Simulation mode made it
     * visible: left alone for eight years the three families partitioned the
     * city perfectly, twelve districts at 100/0/0, and then stopped. With no
     * district shared by anybody there was nothing to pressure, so no
     * relationship ever moved off zero, so no war ever started, so nobody ever
     * lost the strength that would have let somebody else move — a dead
     * equilibrium reached in year one and held forever.
     *
     * A floor, scaled by ambition, means a family with nothing left to take at
     * home eventually looks at a neighbour's. That is the only thing keeping
     * the map alive when there is no player in it stirring things up.
     */
    contestedFloor: 0.16,
  },

  pressure: {
    /** Influence taken from the target, and taken up by the aggressor. */
    damage: [3, 8] as [number, number],
    selfGain: 2,
    cost: 25_000,
    heat: 7,
    /** Relationship damage when the target is the player. */
    relationshipHit: [10, 20] as [number, number],
    /** They only move on somebody they are already stronger than. */
    requiredLead: 5,
    /** Appetite for a fight with nobody to avenge, and with a real grudge. */
    grudgeBase: 0.7,
    grudgeFromHostility: 0.5,
    /**
     * Influence at which a target is worth the trip. Below it the approach
     * still happens but scores far lower.
     *
     * Without this the player — always the weakest presence on the board — was
     * the most attractive target for every family every week, so the three
     * rivals never once moved against each other and the city revolved
     * entirely around a two-man crew.
     */
    significantAt: 30,
    insignificantFloor: 0.25,
    /**
     * Influence a family needs in a district it is *aggrieved* in, as against
     * the flat 20 it needs anywhere else.
     *
     * Being pushed out is the thing that produces the grievance, so requiring
     * a full presence to answer for it made the whole case unreachable: the
     * player drives a family below 20 on the way to holding the district, and
     * from that moment the family cannot consider the street at all.
     */
    grievingPresence: 8,
  },

  invest: {
    cost: 70_000,
    /** Weekly income per front they own. */
    incomePerBusiness: 3_500,
    /** They will not stack fronts beyond this per district held. */
    perDistrict: 2,
  },

  consolidate: {
    heatReduction: 6,
    /** Influence shored up in districts they already hold. */
    influenceGain: 1,
    /**
     * Going quiet earns, in the sense that not spending is a kind of earning.
     *
     * Was 40,000 — more than a district produces — which made sitting still
     * the single most profitable thing a family could do and was the largest
     * single contributor to the measured $137M. It should be a saving, not a
     * salary.
     */
    wealthGain: 12_000,
  },

  /** Baseline weekly income before fronts, scaled by districts held. */
  incomeBase: 12_000,
  incomePerDistrict: 9_000,

  /**
   * What it costs them to be an organization.
   *
   * Without this a family's balance sheet only ever goes up: income every
   * week, spending that stops the moment the board is settled, and
   * `consolidate` actually paying them to do nothing. Measured at $137M after
   * thirty years, which is not a number any system in the game can read
   * meaningfully — and worse, it meant money never constrained a decision
   * after about year three.
   *
   * People have to be paid whether or not there is anything for them to do.
   */
  upkeepBase: 9_000,
  upkeepPerDistrict: 7_000,
  /**
   * How much dearer each additional district is than the last.
   *
   * A flat per-district cost makes every district after the first a fixed
   * $2,000 a week of profit, which is an empire with no ceiling: 24 worlds x
   * 12 years produced a family on eleven districts and $9.3m, at which point
   * money has stopped constraining any decision it makes. Scaling the cost
   * means the seventh district roughly pays for itself and the tenth is a
   * liability — an organization can outgrow what it can actually hold, which
   * is both true and the only thing in this game that stops a winner winning.
   *
   * Measured at 0.02, 0.03, 0.04 and 0.06 across 24 worlds x 12 years. 0.06
   * makes the families so poor they stop acting at all — the belief system
   * goes quiet because nothing happens for anybody to have a theory about.
   * 0.04 costs a war: 19 of 24 worlds see one, against a floor of 20. 0.02
   * does not bind. 0.03 holds the wealth ceiling and every other measure.
   */
  upkeepDistrictScale: 0.03,
  upkeepPerBusiness: 2_400,
  /**
   * Muscle costs money to keep on the street, per point of strength.
   *
   * Measured across the same 24 worlds at three settings, because this one
   * number trades early-game rival activity against long-run war frequency and
   * neither end is obvious:
   *
   *     55  →  20/24 worlds saw a war, median family wealth $1.1M
   *     85  →  19/24 worlds saw a war, median family wealth $30k
   *     120 →  15/24 worlds saw a war, median family wealth $33k
   *
   * At 55 the wars are there but money has stopped constraining anybody, which
   * is the problem the upkeep exists to solve. At 120 the families are so poor
   * that pressure — which costs 25,000 — is unaffordable for most of the early
   * game, and the city goes quiet exactly when a new player should be feeling
   * it. 85 keeps almost all of the conflict and all of the constraint.
   */
  upkeepPerStrength: 85,
  /**
   * What happens when they cannot cover the bill.
   *
   * The first version simply let wealth bottom out at zero, which paralysed
   * two of the three families permanently — every action costs money, so a
   * broke family cannot expand, pressure, invest or poach, and the city went
   * quiet again by a completely different route than before. Shedding muscle
   * instead means being broke is a spiral rather than a freeze: strength per
   * dollar of shortfall.
   */
  shortfallStrengthPer: 0.00035,

  /**
   * Rebuilding after a war is a purchase, not a law of nature.
   *
   * Peacetime recovery used to be unconditional, so every family sat pegged at
   * strength 100 forever and the 20-point lead that `declareWar` requires was
   * unreachable by construction — the direct cause of zero rival wars in
   * thirty measured years. A family that cannot pay does not recover.
   */
  recoveryCostPerPoint: 14_000,

  /** Their own heat decays when they are not doing anything loud. */
  heatDecayPerWeek: 2.5,
  /** Above this a family gets frightened of itself regardless of personality. */
  heatAlarmAbove: 60,
};

/**
 * A standing agenda: what a family is trying to do this season.
 *
 * The four verbs in the weekly scorer are all opportunistic — they answer
 * "what is worth doing right now" and, once the obvious moves are taken, the
 * honest answer is nothing. Measured over twenty years, two of the three
 * families were idle in 65% and 90% of weeks respectively.
 *
 * An agenda is the thing an organization has instead of an opportunity. It
 * lasts months, it biases the weekly scores toward itself, and it is what
 * makes a settled family go looking for trouble rather than sitting on its
 * money until the player turns up.
 */
/**
 * What each agenda is called where a player can read it.
 *
 * The Why panel prints `trace.chose`, and the two decisions that write an
 * agenda or a blame wrote the raw id — so the page listed `take_district` and
 * `be_respectable` beside sentences in plain English, and named the family
 * doing the blaming as `kestler`. A round-7 tester wrote all four down. The
 * simulation never reads this table; it exists so the one screen that shows
 * the machinery does not show it in the machine's own words.
 */
export const AGENDA_LABEL: Record<FactionAgendaKind, string> = {
  take_district: 'take a district',
  ruin: 'ruin somebody',
  get_rich: 'get rich',
  go_quiet: 'go quiet',
  be_respectable: 'become respectable',
};

export const AGENDA = {
  /** How long they hold one before reconsidering. */
  durationDays: [180, 420] as [number, number],
  /** How much an agenda multiplies the score of an action that serves it. */
  boost: 2.2,
  /** ...and how much it suppresses one that does not. */
  suppress: 0.75,
  /**
   * Score floor while an agenda is running. A family with an agenda will act
   * on a weak option rather than sit still, which is exactly the behaviour
   * that was missing.
   */
  actionThreshold: 0.05,

  /** Weights for picking a new agenda, before personality. */
  weights: {
    take_district: 1,
    ruin: 0.8,
    get_rich: 0.7,
    go_quiet: 0.6,
    be_respectable: 0.5,
  },
  /** Relationship at or below which `ruin` becomes available against somebody. */
  ruinBelow: -25,
  /** Heat at or above which going quiet starts to appeal regardless. */
  quietAbove: 45,

  /**
   * What pursuing a grudge does to the grudge, per week.
   *
   * Without this an agenda to ruin somebody was purely a scoring bias, and the
   * relationship it was built on drifted back toward indifference underneath
   * it at the usual rate — so families circled each other for years and only
   * reached the war threshold by accident. A family working against somebody
   * is doing things that make it worse, continuously, and that is the
   * difference between a rivalry and a mood.
   */
  ruinPerWeek: -1.1,

  /** Their own heat decays when they are not doing anything loud. */
  heatDecayPerWeek: 2.5,
  /** Above this a family gets frightened of itself regardless of personality. */
  heatAlarmAbove: 60,
};

// ---------------------------------------------------------- relationships ---

export type RelationshipState =
  | 'at_war'
  | 'hostile'
  | 'cold_war'
  | 'neutral'
  | 'friendly'
  | 'partners'
  | 'alliance';

/** Ordered worst to best; the first whose `min` the value clears wins. */
export const RELATIONSHIP_STATES: {
  state: RelationshipState;
  min: number;
  label: string;
}[] = [
  { state: 'alliance', min: 70, label: 'Alliance' },
  { state: 'partners', min: 40, label: 'Business partners' },
  { state: 'friendly', min: 15, label: 'Friendly' },
  { state: 'neutral', min: -15, label: 'Neutral' },
  { state: 'cold_war', min: -40, label: 'Cold war' },
  { state: 'hostile', min: -70, label: 'Hostile' },
  { state: 'at_war', min: -100, label: 'At war' },
];

/**
 * What every organization starts thinking of every other.
 *
 * Nothing held against anybody and nobody proven either way — but a baseline of
 * respect, because these are three established families who know perfectly well
 * what the others are capable of. It is the player who has to earn it.
 */
export const STARTING_RESPECT_FOR = 30;

/**
 * Taking ground a family holds is noticed and resented — but gently. A player
 * runs hundreds of operations, so anything steeper makes every family
 * permanently hostile within a year, which in turn makes the player everybody's
 * preferred target and produces a death spiral out of ordinary play.
 * Hostility should be something you provoke, not something you accrue.
 */
export const RELATIONSHIP_PER_INFLUENCE_TAKEN = -0.08;

/**
 * Losing a street, as opposed to losing a corner.
 *
 * `RELATIONSHIP_PER_INFLUENCE_TAKEN` above is the drip, and it is deliberately
 * gentle. Measured, that gentleness is not the problem it looks like. The real
 * one is that the player's characteristic act — taking ground — produced no
 * *memory* anywhere. A rival that had been pushed out of a district could not
 * recall having been pushed out of it, so the only thing it could weigh was
 * today's board, on which it was simply behind and therefore uninterested.
 *
 * The consequence was measurable. Over twelve four-year careers the families
 * ran 526 pressure actions against each other and 65 against the player — one
 * every nine months — while the number of districts a rival could have leaned
 * on grew from 0.84 to 4.20 a week. Opportunity was never the constraint.
 *
 * So a family keeps a ledger of ground lost, per culprit per district. It
 * fades, because a grievance should be about what is happening to you rather
 * than what once did, and it is what `scorePressure` weighs in place of a lead
 * it does not have.
 *
 * There is deliberately **no relationship penalty attached to it.** That was
 * the first version and it was the wrong lever twice over: it moved the mood
 * without changing a single decision — `ruin` against the player stayed at
 * zero weeks in 2,000 — and it took careers ending early from 4 in 12 to 6.
 * The note above records the same lesson from further back: a steeper price on
 * ground makes every family permanently hostile and produces a death spiral
 * out of ordinary play. Feelings were never the missing part. Memory was.
 */
export const GROUND_LOST = {
  /**
   * Ground lost at which a grievance weighs as much as total dominance would.
   * Roughly a control level: a street changing hands, not a bad week.
   */
  full: 25,
  /** Weekly fade, against BOND.grudgeDecayPerWeek of 0.4 on the mood itself. */
  decayPerWeek: 0.5,
  /**
   * Points of the ledger a tribute settles, per $10,000 paid.
   *
   * The counterplay has to answer the actual mechanism. `offer_tribute` buys
   * relationship, and relationship is only a multiplier on how attractive a
   * target looks — so without this a player could pay a family off and watch
   * them keep taking the same street, which is a worse game than the one where
   * nobody pushes back at all. Its own blurb already promises this: "the
   * cheapest way to make somebody less interested in you".
   *
   * Priced per dollar rather than as a clean wipe, and deliberately less than
   * a district's worth per payment, so a family aggrieved in three places
   * cannot be settled with one envelope. Paying the danegeld is a decision,
   * not a switch.
   */
  settledPer10k: 12,
};

/*
 * The weekly drift back toward indifference used to live here as a single
 * number. It is now three, in config/diplomacy.ts:BOND, because a grudge
 * fading, trust being earned by peace holding, and respect settling toward
 * what an organization can currently do are not the same process at the same
 * speed — which is the whole reason the single score was worth replacing.
 */

/**
 * How well you can read a family: driven by how many districts you actually
 * share with them. You learn about people by standing near them.
 */
export const FACTION_INTEL_PER_SHARED_DISTRICT = 22;
export const FACTION_INTEL_PRECISE_ABOVE = 60;
export const FACTION_INTEL_ROUGH_ABOVE = 25;
