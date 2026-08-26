/**
 * People: generation, traits, and the vocabulary the player reads them through.
 *
 * The player never sees a number for a hidden stat. They see a phrase from
 * these bands, blurred by how little they know the person. Everything that
 * makes trust a decision instead of a lookup is configured here.
 */

import type { NpcStatId, NpcStats } from '../sim/types';
import { f, m, namesOf, type GivenName } from './names';

// ----------------------------------------------------------------- names ---

/**
 * The pool was already thirty-two men followed by sixteen women and had been
 * since it was written. The split was real and only the ordering recorded it,
 * which is not somewhere a program can read — so the portraits could not tell,
 * and drew beards on everybody at the same rate. Same names, same order, same
 * indices: `FIRST_NAMES` below is derived, so no draw anywhere moved.
 */
export const GIVEN_NAMES: GivenName[] = [
  ...m(
    'Sal', 'Vincent', 'Tommy', 'Gino', 'Marco', 'Dominic', 'Angelo', 'Rocco',
    'Nico', 'Franco', 'Luca', 'Carmine', 'Enzo', 'Bruno', 'Matteo', 'Silvio',
    'Duke', 'Ray', 'Eddie', 'Joey', 'Frankie', 'Mickey', 'Petey', 'Charlie',
    'Aldo', 'Renzo', 'Gus', 'Milo', 'Vito', 'Paolo', 'Emilio', 'Rico',
  ),
  ...f(
    'Maria', 'Gina', 'Rosa', 'Lucia', 'Bianca', 'Nadia', 'Carla', 'Sofia',
    'Elena', 'Vera', 'Cate', 'Dana', 'Roxy', 'Nina', 'Toni', 'Jo',
  ),
];

export const FIRST_NAMES = namesOf(GIVEN_NAMES);

export const LAST_NAMES = [
  'Corveti', 'Marchetti', 'Bellandi', 'Falcone', 'Ricci', 'Adderly', 'Sabino',
  'Danton', 'Mercuri', 'Vasari', 'Panetta', 'Loscalzo', 'Brannock', 'Ferraro',
  'Delgato', 'Trentini', 'Kovac', 'Marsh', 'Delaney', 'Petrosino', 'Ianello',
  'Barone', 'Cordova', 'Vaccaro', 'Sultana', 'Rinaldi', 'Moreno', 'Quill',
  'Serafini', 'Bracco', 'Oduya', 'Nardi', 'Salvatore', 'Kestler', 'Vance',
  'Amato', 'Gallo', 'Rizzo', 'Testa', 'Bonanno', 'Cutrone', 'Vitale',
];

/** Applied to a minority of NPCs. Nicknames stick, and the player remembers them. */
export const NICKNAMES = [
  'the Nail', 'Cufflinks', 'Two Phones', 'Quiet', 'the Priest', 'Sunday',
  'Half-Pint', 'Ledger', 'the Mechanic', 'Knuckles', 'Whisper', 'Sandpaper',
  'the Accountant', 'Cousin', 'Bricks', 'Tuesday', 'the Barber', 'Slow Hand',
];
export const NICKNAME_CHANCE = 0.22;

// ---------------------------------------------------------------- traits ---

/**
 * What a trait does once the person exists.
 *
 * Every key here is read by a system that was already running, which is the
 * whole point: a trait is not a new mechanic, it is a thumb on an existing
 * one. For a long time `bias` was the only field and traits were therefore
 * decoration — sixteen behavioural descriptions that biased a stat roll once
 * and were then read by nothing but the crew panel. A man described as
 * escalating situations that did not need escalating escalated nothing.
 *
 * Multipliers default to 1 and are multiplied together across a person's
 * traits; additive keys default to 0 and are summed.
 */
export interface TraitEffects {
  /** Added to the weekly loyalty drift, before difficulty and leadership. */
  loyaltyPerWeek?: number;
  /** Multiplies heat from any job this person was on. */
  heat?: number;
  /** Multiplies the weight of violent outcomes when their job goes wrong. */
  escalation?: number;
  /** Multiplies a rival's chance of turning them. */
  poachable?: number;
  /** Multiplies evidence they leave behind, by any route. */
  exposure?: number;
  /** Multiplies what they think they are worth. */
  wageExpectation?: number;
}

export interface TraitDef {
  id: string;
  name: string;
  description: string;
  /** Pushes stats at generation time. Applied after the base roll. */
  bias: Partial<NpcStats>;
  /** Traits the player can eventually observe are marked visible. */
  obvious: boolean;
  /** What it does for the rest of their life. */
  effects: TraitEffects;
}

export const TRAITS: TraitDef[] = [
  {
    id: 'hot_headed',
    name: 'Hot-Headed',
    description: 'Escalates situations that did not need escalating.',
    bias: { courage: 15, discipline: -20, fear: -10 },
    obvious: true,
    effects: { escalation: 1.8, heat: 1.25, loyaltyPerWeek: -0.3 },
  },
  {
    id: 'calculating',
    name: 'Calculating',
    description: 'Thinks three moves out. Including moves against you.',
    bias: { intelligence: 18, discipline: 12, ambition: 10 },
    obvious: false,
    effects: { exposure: 0.8, poachable: 1.25, loyaltyPerWeek: -0.4 },
  },
  {
    id: 'greedy',
    name: 'Greedy',
    description: 'The number is never the number.',
    bias: { greed: 25, loyalty: -8 },
    obvious: false,
    effects: { wageExpectation: 1.2, poachable: 1.35 },
  },
  {
    id: 'loyalist',
    name: 'Loyalist',
    description: 'Believes in the thing, not just the money.',
    bias: { loyalty: 22, respectForBoss: 15, greed: -10 },
    obvious: false,
    effects: { loyaltyPerWeek: 1.2, poachable: 0.4 },
  },
  {
    id: 'ambitious',
    name: 'Ambitious',
    description: 'Wants your chair. Will wait for it, or will not.',
    bias: { ambition: 25, leadership: 10 },
    obvious: false,
    effects: { loyaltyPerWeek: -0.5, poachable: 1.3 },
  },
  {
    id: 'cowardly',
    name: 'Cowardly',
    description: 'Folds under pressure. Pressure always comes.',
    bias: { fear: 25, courage: -22, loyalty: -5 },
    obvious: false,
    effects: { exposure: 1.3, escalation: 0.6, poachable: 1.15 },
  },
  {
    id: 'fearless',
    name: 'Fearless',
    description: 'Does not flinch, which is not always a good thing.',
    bias: { courage: 25, fear: -25 },
    obvious: true,
    effects: { escalation: 1.3, exposure: 0.85 },
  },
  {
    id: 'disciplined',
    name: 'Disciplined',
    description: 'Follows the plan. Leaves nothing behind.',
    bias: { discipline: 25, skill: 8 },
    obvious: true,
    effects: { heat: 0.8, exposure: 0.7 },
  },
  {
    id: 'sloppy',
    name: 'Sloppy',
    description: 'Leaves things behind. Talks in the wrong rooms.',
    bias: { discipline: -25, skill: -8 },
    obvious: true,
    effects: { heat: 1.3, exposure: 1.5 },
  },
  {
    id: 'charismatic',
    name: 'Charismatic',
    description: 'People follow them. That cuts both ways.',
    bias: { leadership: 22, ambition: 8 },
    obvious: true,
    effects: { poachable: 1.15 },
  },
  {
    id: 'paranoid',
    name: 'Paranoid',
    description: 'Sees rats everywhere. Occasionally right.',
    bias: { fear: 15, discipline: 10, loyalty: -6 },
    obvious: false,
    effects: { exposure: 0.75, loyaltyPerWeek: -0.3 },
  },
  {
    id: 'gambler',
    name: 'Gambler',
    description: 'Owes somebody, usually. Debt makes people useful to others.',
    bias: { greed: 18, discipline: -12 },
    obvious: false,
    effects: { poachable: 1.5, exposure: 1.2, wageExpectation: 1.15 },
  },
  {
    id: 'old_school',
    name: 'Old School',
    description: 'Does it the way it was done. Will not talk, on principle.',
    bias: { loyalty: 18, fear: -12, ambition: -10 },
    obvious: true,
    effects: { exposure: 0.5, poachable: 0.5, loyaltyPerWeek: 0.6 },
  },
  {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    description: 'Talks people into things. Including out of trouble.',
    bias: { leadership: 12, intelligence: 10, skill: 8 },
    obvious: true,
    effects: { heat: 0.9, exposure: 0.85 },
  },
  {
    id: 'brutal',
    name: 'Brutal',
    description: 'Effective, memorable, and expensive in attention.',
    bias: { courage: 18, discipline: -10, skill: 10 },
    obvious: true,
    effects: { escalation: 1.6, heat: 1.35 },
  },
  {
    id: 'family_man',
    name: 'Family Man',
    description: 'Has people to protect. That is leverage someone can use.',
    bias: { loyalty: 10, fear: 15, ambition: -8 },
    obvious: true,
    effects: { poachable: 0.7, exposure: 1.25, loyaltyPerWeek: 0.4 },
  },
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(
  TRAITS.map((t) => [t.id, t]),
);

export const TRAIT_COUNT: [min: number, max: number] = [1, 3];

// --------------------------------------------------------------- secrets ---

/**
 * Hidden until an event or high familiarity exposes it. Secrets are the seeds
 * of Phase 5 informants and Phase 6 rival leverage.
 */
export const SECRETS = [
  'Owes a great deal of money to people outside your organization.',
  'Has spoken to an investigator once already, about something small.',
  'Keeps a second family in another city.',
  'Skimmed from a previous employer and was never caught.',
  'Has a cousin inside a rival organization.',
  'Is using more of the product than they sell.',
  'Was an informant years ago, under a different name.',
  'Keeps written records of everything. Everything.',
  'Blames you, quietly, for something that happened before you noticed them.',
];
export const SECRET_CHANCE = 0.4;

// ------------------------------------------------------ stat generation ---

/** Base roll range for every hidden stat, before trait bias. */
export const STAT_RANGE: Record<NpcStatId, [min: number, max: number]> = {
  loyalty: [35, 80],
  greed: [20, 80],
  ambition: [15, 80],
  fear: [15, 70],
  courage: [20, 80],
  intelligence: [15, 85],
  discipline: [20, 80],
  skill: [10, 70],
  leadership: [10, 70],
  respectForBoss: [30, 70],
  grievance: [0, 10],
};

export const AGE_RANGE: [min: number, max: number] = [19, 62];

/** New recruits start unknown. Perception is near-useless until this rises. */
export const STARTING_FAMILIARITY = 5;
/** Familiarity gained per day in the crew and per operation together. */
export const FAMILIARITY_PER_DAY = 0.12;
export const FAMILIARITY_PER_OPERATION = 4;
export const FAMILIARITY_MAX = 100;

// ------------------------------------------------------------ perception ---

/** Five bands per stat, low to high. Index = Math.floor(value / 20). */
export const STAT_BANDS: Record<NpcStatId, [string, string, string, string, string]> = {
  loyalty: [
    'looking for the door',
    'here for now',
    'steady enough',
    'solid',
    'would take a charge for you',
  ],
  greed: [
    'indifferent to money',
    'modest',
    'wants their share',
    'hungry',
    'never satisfied',
  ],
  ambition: [
    'content where they are',
    'not in a hurry',
    'wants to move up',
    'impatient',
    'wants your chair',
  ],
  fear: [
    'does not scare',
    'hard to rattle',
    'normal nerves',
    'jumpy',
    'terrified of something',
  ],
  courage: [
    'folds',
    'hesitant',
    'holds up',
    'steady under fire',
    'walks into anything',
  ],
  intelligence: ['slow', 'plain', 'sharp enough', 'clever', 'dangerous mind'],
  discipline: ['reckless', 'careless', 'reliable', 'careful', 'leaves nothing'],
  skill: ['green', 'learning', 'competent', 'very good', 'exceptional'],
  leadership: [
    'follows',
    'no presence',
    'people listen',
    'commands a room',
    'born to lead',
  ],
  respectForBoss: [
    'does not respect you',
    'unconvinced',
    'respects the position',
    'respects you',
    'reveres you',
  ],
  grievance: [
    'no complaints',
    'minor gripes',
    'holding something',
    'resentful',
    'nursing a real wound',
  ],
};

/** Which stats appear on the crew screen, in order. */
export const READABLE_STATS: NpcStatId[] = [
  'loyalty',
  'skill',
  'discipline',
  'ambition',
  'greed',
  'courage',
  'intelligence',
  'leadership',
];

/**
 * Perception noise, in stat points, by familiarity. Below the first threshold
 * you get no read at all. This is the whole trust mechanic: early reads are
 * guesses, and by the time you know someone you may already be exposed.
 */
export const PERCEPTION_TIERS = [
  { minFamiliarity: 0, noise: 999, label: 'You barely know them' },
  { minFamiliarity: 15, noise: 28, label: 'First impressions only' },
  { minFamiliarity: 35, noise: 18, label: 'Getting a read' },
  { minFamiliarity: 60, noise: 10, label: 'You know them well' },
  { minFamiliarity: 85, noise: 4, label: 'You know exactly who they are' },
];

// -------------------------------------------------------- loyalty drift ---

/** Loyalty and friends are re-evaluated every this many days. */
export const DRIFT_INTERVAL_DAYS = 7;

export const DRIFT = {
  /**
   * What someone thinks they are worth, as a multiple of their role's wage:
   * `wageExpectationBase + greed/100 * wageExpectationFromGreed`.
   *
   * These must straddle 1.0. An average-greed person has to be satisfied by
   * the standard wage, or the whole crew erodes no matter how you play.
   * Greed 0 wants 0.75x, greed 50 wants the going rate, greed 100 wants 1.25x.
   */
  wageExpectationBase: 0.75,
  wageExpectationFromGreed: 0.5,
  /**
   * How much of the price level a man re-prices himself against.
   *
   * At 1 — the first version — a wage set in a cheap year is fully obsolete a
   * decade later, and three unmanaged sandbox worlds ran six years and ended
   * with nobody left in any of them. That is a one-way ratchet with no prompt
   * attached to it: the game never asks for a raise, it simply empties.
   *
   * At 0.5 the gap opens at half the rate, which is slow enough that a player
   * who reviews pay every few years never feels it and a player who never
   * looks at the crew sheet loses their oldest hands first. That is the right
   * shape — a man who has been on the same money since 1931 has a grievance,
   * and it should take him years to act on it.
   */
  wageIndexation: 0.5,
  /** Loyalty change per drift tick when well paid / underpaid. */
  wellPaidLoyalty: 2.5,
  underpaidLoyalty: -4,
  /** Ambition unmet: loyalty lost per tick, scaled by ambition and time in role. */
  stagnationLoyaltyPerTick: -3,
  daysInRoleBeforeStagnation: 60,
  /**
   * Fearful people under heat start looking for exits.
   *
   * This was 45, and careers spend most of their days above whatever it is
   * set to, so the term was close to always on. Swept over twelve four-year
   * careers at 30, 45 and 60: the weekly fear drain reads -1.94, -1.18 and
   * -0.64, and the crew-weeks a career actually lives through read 9426, 9585
   * and 11785. At 60 the drain halves and the family holds together 23%
   * longer, which is the point of the change.
   *
   * It buys nothing on the rank ladder — Capo did not arrive any more often —
   * because the wall there is clean money rather than headcount. Do not read
   * this number as a difficulty dial for progression.
   */
  heatFearThreshold: 60,
  heatFearLoyalty: -3.5,
  /** Grievance bleeds loyalty continuously and only decays slowly. */
  grievanceLoyaltyFactor: -0.06,
  grievanceDecayPerTick: 1.5,
  /**
   * How fast a man's nerve returns to whatever it was before.
   *
   * Fear had no return path at all. Seventeen places in the simulation add to
   * it and five event choices subtract, so across 36 four-year careers the
   * median crew member read 76 on a stat rolled between 15 and 70 by day 91,
   * and 90 from then on. That fed `heatFearLoyalty`, whose whole scaling term
   * is `fear / 100`, which is why every crew in the game sat at the full
   * weekly drain regardless of who was in it.
   *
   * Set at the same rate as `grievanceDecayPerTick` for the same reason: a
   * bad night should still be in a man weeks later, and gone by the season.
   * Symmetric, so a man talked down below his own baseline climbs back to it
   * as well — the number is who he is, not a floor on how bad it can get.
   */
  fearSettlePerTick: 1.5,
  /** Player leadership resists all decay. At leadership 20, ~+3 per tick. */
  leadershipResistFactor: 0.16,
  /** Respect for the boss climbs with successful operations and rank. */
  respectDriftPerRank: 1.2,
  /** Ambition creeps up in people who taste success. */
  ambitionPerSuccess: 0.4,

  /**
   * How much who somebody *is* moves their loyalty, against how they are
   * treated.
   *
   * Traits, goals and grudges each contribute to the weekly drift, and at full
   * strength the three of them together reach about -2.2 a week for an
   * unhappy man — against +2.5 for being well paid. That is not a modifier,
   * that is a second economy, and it cancelled the main lever the player has:
   * paying people properly stopped working, crews quietly emptied, and the
   * balance bot began losing whole runs to nothing it could see.
   *
   * Character should colour the drift, not decide it.
   */
  characterWeight: 0.45,
};

/** Behaviour thresholds. Crossing these fires events. */
export const BEHAVIOUR = {
  skimLoyaltyBelow: 45,
  skimGreedAbove: 55,
  skimChancePerTick: 0.18,
  /** Share of a payout a skimmer takes. */
  skimShare: [0.04, 0.12] as [number, number],

  demandLoyaltyBelow: 60,
  demandAmbitionAbove: 65,

  informantLoyaltyBelow: 32,
  informantFearAbove: 60,
  informantHeatAbove: 45,

  defectLoyaltyBelow: 18,
  defectChancePerTick: 0.2,
};

/** Promotion effects. */
export const PROMOTION = {
  loyaltyGain: 10,
  respectForBossGain: 8,
  ambitionRelief: 12,
  grievanceRelief: 10,
};

/** Dismissal effects on the person you cut loose. */
export const DISMISSAL = {
  /** They leave knowing things. Phase 5 turns this into a real liability. */
  evidenceStrength: 6,
};

// --------------------------------------------------------- recruit pool ---

export const RECRUIT_POOL_SIZE = 4;
/** Days before the available recruits refresh. */
export const RECRUIT_REFRESH_DAYS = 10;
