/**
 * Entity types for the whole simulation.
 *
 * Kept separate from state.ts so config modules can import types without
 * pulling in newGame() and creating an import cycle.
 */

import type { RngState } from './rng';
import type { FactionId, FactionPersonality } from '../config/factions';
import type { LawyerLevel, StageId } from '../config/lawEnforcement';
import type { TieCause } from '../config/ties';
import type { IncidentKind } from '../config/beliefs';
import type { MemoryKind } from '../config/memories';
import type { PromiseKind } from '../config/promises';
import type { TradeId } from '../config/contraband';
import type { CyclePhaseId } from '../config/market';
import type { ApproachId } from '../config/operations';
import type { HeatChannel } from '../config/heat';

export type Id = string;

// ---------------------------------------------------------------- player ---

export type RankId =
  | 'street_criminal'
  | 'enforcer'
  | 'crew_leader'
  | 'capo'
  | 'underboss'
  | 'boss'
  | 'crime_lord';

export type AttributeId =
  | 'leadership'
  | 'intimidation'
  | 'negotiation'
  | 'intelligence'
  | 'streetSmarts'
  | 'business'
  | 'strategy'
  | 'influence';

export type Attributes = Record<AttributeId, number>;

export interface Player {
  name: string;
  rank: RankId;
  attributes: Attributes;
  /** Progress toward the next point in each attribute, 0..1. */
  attributeProgress: Attributes;
  opsCompleted: number;
  opsFailed: number;
  /** Rank the player has been offered but not yet accepted. */
  pendingRank: RankId | null;
}

// ---------------------------------------------------- organization state ---

export interface Org {
  /**
   * Wages owed and not yet paid.
   *
   * Payroll used to be all-or-nothing: short by a dollar and every hand took
   * the same hit as being paid nothing at all. That cliff, against job income
   * that arrives in lumps on whatever day a job happens to finish, made
   * missing payday close to unavoidable for any crew sized near its earnings.
   *
   * Now the shortfall is carried. You pay what you have, the men are aggrieved
   * in proportion to what they did not get, and the remainder is a debt to your
   * own organization that comes off the top of next week. Optional so every
   * save written before this loads with nothing owed, which is correct.
   */
  wagesOwed?: number;
  /** Laundered, freely spendable. */
  cash: number;
  /**
   * Clean money that has been put somewhere it cannot be reached.
   *
   * A career earns $189,469 of clean money across four years, needs to hold
   * $45,000 of it at one moment to make Capo, and peaks at $28,711 — because
   * `spend` falls back to the clean pool the instant dirty runs out, and 46%
   * of every clean dollar left again through job costs. The savings account
   * was the petty cash tin.
   *
   * Protecting the clean pool outright was the wrong answer: money nobody ever
   * spends is not a decision. Moving it out of the wallet on purpose is. What
   * is in here counts toward rank, pays for nothing, and comes back at a
   * discount, so a boss chooses between standing and liquidity rather than
   * being handed both.
   *
   * Optional so every save written before this loads holding nothing.
   */
  holdings?: number;
  /**
   * What the family has ever managed, as against what this boss holds today.
   *
   * The seven ranks are a personal ladder and the organization outlives the
   * person climbing it, which is a contradiction the game used to resolve by
   * throwing progress away: a successor inherited the crew and the districts
   * but the rank table read his balance, his respect and his own operations,
   * so three years of work stopped counting the day somebody shot the boss.
   *
   * These are high-water marks, kept by the organization and never touched by
   * a handover. A rung once earned stays earned. What it costs is that rank
   * can no longer move away from a player who stops earning — a deliberate
   * property of the old design, traded on purpose for a ladder a family can
   * climb across generations.
   *
   * Optional, so every save written before this loads with no record and
   * starts keeping one from that day.
   */
  record?: {
    respect: number;
    crew: number;
    /** The most the family was ever worth — wallet, holdings, fronts, ground. */
    estate: number;
    /** Operations the whole family has completed, across every boss. */
    ops: number;
    districts: number;
    /**
     * The predecessor's operation count, so the family total can keep rising
     * across a handover that resets `player.opsCompleted` to the new man's own.
     */
    opsSeen: number;
  };
  /** Criminal proceeds. Spendable on criminal work, but carries exposure. */
  dirtyCash: number;
  /**
   * Standing. What people will do for you because they want to.
   *
   * Deliberately no longer the only social currency — see `fear`. The two are
   * earned by different actions and spent on different things, because
   * collapsing them produced the classic problem where the optimal play is
   * always violence and the word "respect" is doing no work.
   */
  respect: number;
  /** What people will do for you because of what happens if they do not. */
  fear: number;
  /**
   * 0..100 law-enforcement attention. Always the clamped sum of `heatBy`.
   *
   * Kept as a stored field rather than derived on read because roughly forty
   * places consume it — tiers, penalties, world conditions, the stat bar and
   * the save file — and turning all of them into a function call would be a
   * very large diff for no behaviour.
   */
  heat: number;
  /** Where the attention came from, and what will get rid of it. */
  heatBy: Record<HeatChannel, number>;
  /** Days since the last heat-generating action, drives decay. */
  quietDays: number;
  /** Player has ordered a lay-low period; ends on this day. */
  layLowUntilDay: number | null;
}

// ------------------------------------------------------------------- npcs ---

export type RoleId =
  | 'associate'
  | 'soldier'
  | 'enforcer'
  | 'lieutenant'
  | 'capo'
  | 'consigliere'
  | 'underboss';

export type NpcStatId =
  | 'loyalty'
  | 'greed'
  | 'ambition'
  | 'fear'
  | 'courage'
  | 'intelligence'
  | 'discipline'
  | 'skill'
  | 'leadership'
  | 'respectForBoss'
  | 'grievance';

export type NpcStats = Record<NpcStatId, number>;

export type NpcStatus =
  | 'active'
  | 'busy'
  | 'injured'
  | 'arrested'
  | 'dead'
  | 'defected'
  /** Took over and became the player. Kept on file rather than deleted, so
   *  every evidence trace and suspect list that names them still resolves. */
  | 'boss';

export interface Npc {
  id: Id;
  name: string;
  age: number;
  role: RoleId;
  traits: string[];
  secret: string | null;
  /** The truth. Never rendered directly — always go through perceive(). */
  stats: NpcStats;
  /** 0..100. How well the player knows them; shrinks perception noise. */
  familiarity: number;
  daysInCrew: number;
  opsCompleted: number;
  opsFailed: number;
  /** Weekly pay. Too low against greed erodes loyalty. */
  wage: number;
  status: NpcStatus;
  /** Set when busy/injured/arrested — status reverts on this day. */
  unavailableUntilDay: number | null;
  /** Player-visible history. This is how you learn who someone is. */
  notes: NpcNote[];
  /**
   * What they are currently after. An id from config/goals.ts, re-picked on
   * the weekly drift tick. Read through `perceivedGoal`, never directly.
   */
  goal: string | null;
  goalSince: number;
  /**
   * What they think of specific other people here. Sparse and incident-created
   * — see config/ties.ts. An empty list is the normal state for a new man.
   */
  ties: Tie[];
  /**
   * Specific things that happened to him, newest first.
   *
   * The organization already had a grievance stat, which is a summary of
   * something that never existed: a man could be carrying sixty points of
   * resentment with nothing in the state saying what any of it was about. A
   * memory is one event, on a date, sometimes involving somebody in
   * particular, and it can be recalled by a decision years later.
   */
  memories: Memory[];
  /**
   * How frightened he is when nothing in particular is happening.
   *
   * `stats.fear` is written by seventeen things — an arrest, a stage of an
   * investigation, a war, a body in the street, the org's own fear rubbing off
   * every payday — and until this existed it was read back by nothing that
   * could lower it. Measured over 36 four-year careers: the roll at generation
   * runs 15 to 70, and the median man on the crew sheet was at 76 by day 91
   * and 90 for the rest of his life. A disposition that only ratchets is not a
   * disposition, and it dragged `heatFearLoyalty` to near-full strength for
   * everybody at once.
   *
   * So fear now settles back toward this, which is who he was when you met
   * him. What happened to him still moves him; it stops being permanent.
   *
   * Optional so a save written before this loads without one, in which case
   * the drift uses the middle of the generation range rather than inventing a
   * history for a man who already has one.
   */
  fearBase?: number;
  /** Skim, betrayal and defection flags set by the drift system. */
  isSkimming: boolean;
  skimTotal: number;
  joinedDay: number;
  /**
   * The day he started talking to somebody, if he has.
   *
   * The single most consequential hidden field in the game, and the one the
   * player has no reading of at all — `perceive` will not tell you, familiarity
   * will not tell you, and a sit-down will not tell you. What reaches the
   * player is what the other side turns out to know; this is only here so the
   * simulation can be consistent about who knew what.
   *
   * Optional so every save written before informants existed loads with nobody
   * talking, which for those saves is true.
   */
  informingSince?: number;
  /** Set after somebody else was killed for it. He is not stupid. */
  carefulUntilDay?: number;
}

export interface NpcNote {
  day: number;
  text: string;
  kind: 'neutral' | 'good' | 'bad';
}

/**
 * One person's view of one other person. Three independent dimensions rather
 * than a single score, because "I rate him, and he owes me, and I have not
 * forgiven him" is a normal thing to be true all at once.
 */
export interface Tie {
  /** The other person. Always an id in state.npcs. */
  id: Id;
  /** Would work with him, would follow him, would not sell him. 0..100. */
  trust: number;
  /** Holds something against him. 0..100. */
  resentment: number;
  /** Owes him — money, a favour, or a charge he took. 0..100. */
  debt: number;
  /** Last thing that happened between them, for the crew sheet. */
  cause: TieCause;
  since: number;
}

/**
 * One thing that happened to somebody. Fades toward a floor rather than to
 * nothing — the gap between forgetting and forgiving.
 */
export interface Memory {
  kind: MemoryKind;
  day: number;
  /** The other person involved, where there was one. */
  aboutId: Id | null;
  /** What it was worth when it happened, 0..100. */
  weight: number;
}

/**
 * The person, flattened for the goal catalogue.
 *
 * config/goals.ts must not import the simulation, so goal conditions read this
 * summary rather than an Npc. Same trick the world conditions use.
 */
export interface GoalSubject {
  loyalty: number;
  greed: number;
  ambition: number;
  fear: number;
  courage: number;
  leadership: number;
  grievance: number;
  age: number;
  /** Lieutenant or above — somebody with a floor to look down from. */
  senior: boolean;
  familyMan: boolean;
  /** Their strongest grudge against anybody still in the organization. */
  worstTieResentment: number;
}

/** The handful of facts about the organization a goal is allowed to care about. */
export interface GoalBoard {
  heat: number;
  worstCaseStage: number;
  crewSize: number;
  atWar: boolean;
}

// ------------------------------------------------------------ operations ---

export type OperationRisk = 'low' | 'moderate' | 'high' | 'extreme';

/**
 * The board, flattened, so a job's unlock condition can live in config.
 *
 * The same trick `config/goals.ts` and the world conditions use: config
 * declares a predicate over a small summary rather than over `GameState`,
 * which keeps `src/config` from importing `src/sim` and keeps the condition
 * readable directly above the job it gates.
 */
export interface OpsBoard {
  /** `rankIndex` of the player's current rank. */
  rank: number;
  districtsHeld: number;
  fronts: number;
  crew: number;
  /** Times each job has been run, keyed by `OperationDef.id`. */
  opsBy: Record<string, number>;
}

export interface OperationDef {
  id: string;
  name: string;
  description: string;
  /** Lowest rank that can run it. */
  minRank: RankId;
  /**
   * A second way in, for a player who has done the work without holding the
   * rank.
   *
   * Rank is a clean-money threshold as much as anything, and a probe of
   * twenty-four careers reached Crew Leader in none of them before the heat
   * work and eight of them after — which still leaves two thirds of careers
   * with the whole back half of the content sealed off. `need` is what the
   * locked row says; `met` is what actually opens it. Absent, a job opens on
   * rank alone, exactly as before.
   */
  opens?: {
    need: string;
    met: (board: OpsBoard) => boolean;
  };
  risk: OperationRisk;
  crewRequired: number;
  /** Up-front cost, paid from dirty cash first. */
  investment: number;
  payout: [min: number, max: number];
  durationDays: number;
  /** 0..1 before crew, player and heat modifiers. */
  baseSuccess: number;
  heatOnSuccess: number;
  heatOnFailure: number;
  /** Player attribute that helps this kind of work. */
  attribute: AttributeId;
  respect: number;
}

export interface ActiveOperation {
  id: Id;
  defId: string;
  /** Where the job is being run. Drives payout, heat and influence. */
  territoryId: string;
  crewIds: Id[];
  startDay: number;
  endDay: number;
  investment: number;
  /** Success chance snapshotted at launch, so the UI can't lie after the fact. */
  successChance: number;
  projectedPayout: number;
  /**
   * How it is being done. Optional because saves written before approaches
   * existed do not have one; read it through `approachOf`, never directly.
   */
  approach?: ApproachId;
}

export interface OperationResult {
  /** How it was done. Absent on results from before approaches existed. */
  approach?: ApproachId;
  id: Id;
  defId: string;
  name: string;
  territoryId: string;
  day: number;
  success: boolean;
  /** How far the roll landed from the threshold, -1..1. Scales payout. */
  margin: number;
  payout: number;
  heat: number;
  crewIds: Id[];
  consequence: string | null;
}

/**
 * A night the other side turned out to know about.
 *
 * `knewIds` is the whole mechanic and the only part the player ever sees: the
 * men who were on that job, which the game already recorded when the job was
 * launched. `sourceId` is who actually said so, or null when the agency worked
 * it out on its own — and it is never rendered anywhere, by anything.
 */
export interface Leak {
  day: number;
  /** The job, for the record. */
  opId: Id;
  opName: string;
  territoryId: string;
  /** Everybody who could have told them. */
  knewIds: Id[];
  /** Hidden. Null means nobody talked. */
  sourceId: Id | null;
}

/**
 * A thing you said you would do, with a date on it.
 *
 * Kept as a flat list rather than a field on the man, because the interesting
 * query is "what have I got outstanding" — a boss with nine promises out is in
 * a different position from one with nine men, and only this shape says so.
 */
/** One person outside the family, and where you stand with them. */
export interface CivicStanding {
  id: string;
  /** 0..100. Drifts toward what they watch; never set directly. */
  standing: number;
  /** How many they owe you right now. Capped by CIVIC.maxOwed. */
  owed: number;
  /** Last day they decided they owed you one, for the interval gate. */
  lastFavourDay: number;
}

export interface Promised {
  npcId: Id;
  kind: PromiseKind;
  madeDay: number;
  dueDay: number;
}

// -------------------------------------------------------------- evidence ---

/**
 * Investigation fuel. Every case is built out of these, which is what makes a
 * case explicable and — in hindsight — avoidable. Written by the failure paths
 * across operations, violence, finance and anybody who left on bad terms.
 */
export interface EvidenceTrace {
  id: Id;
  day: number;
  source: 'operation' | 'violence' | 'finance' | 'informant';
  /** 0..100 contribution to a future case. Decays once the trail goes cold. */
  strength: number;
  npcIds: Id[];
  detail: string;
  /**
   * Cases holding this trace. Not exclusive: several agencies can build on the
   * same underlying facts, and making it exclusive meant whichever agency was
   * checked first vacuumed up everything and the rest could never open a case.
   */
  attachedTo: Id[];
}

// ------------------------------------------------------- law enforcement ---

export interface CaseEvent {
  day: number;
  text: string;
  /** True when the player could not have missed it. */
  obvious: boolean;
}

export interface Investigation {
  id: Id;
  agencyId: string;
  stage: StageId;
  openedDay: number;
  /** Day the current stage began, for the time gate. */
  stageSince: number;
  /** 0..100. How much of a case they actually have. */
  strength: number;
  /** Crew they have identified and are working on. */
  suspectIds: Id[];
  /** Businesses under financial scrutiny. */
  businessIds: Id[];
  /** Last day anything new landed on it. */
  lastProgressDay: number;
  status: 'open' | 'cold' | 'closed' | 'resolved';
  /** Set when the case reaches trial. */
  verdict: 'convicted' | 'acquitted' | null;
  verdictDay: number | null;
  history: CaseEvent[];
}

/** Somebody inside an agency who tells you things and slows them down. */
export interface Contact {
  agencyId: string;
  since: number;
  /** Weekly cost of keeping them sweet. */
  upkeep: number;
  burned: boolean;
}

export interface LawEnforcement {
  investigations: Record<Id, Investigation>;
  contacts: Record<string, Contact>;
  lawyer: LawyerLevel;
  /** Lifetime counters for the panel. */
  casesOpened: number;
  casesClosed: number;
  /**
   * What actually moved every case, summed over the career.
   *
   * The open-case strength sits at 86 of 100 across whole careers and nobody
   * could say which of the three things holding it there was responsible:
   * evidence coming in, the agency's own work, or decay never getting a
   * chance to run. These are the terms of `tickInvestigations` recorded as it
   * applies them, rather than a reconstruction from outside that would drift
   * away from the code the first time somebody edited it.
   *
   * Optional so that saves written before it existed still load.
   */
  ledger?: {
    absorbed: number;
    work: number;
    visibility: number;
    decayed: number;
    /** Case-weeks counted, so the sums can be turned into rates. */
    caseWeeks: number;
    /** Case-weeks spent cold, where decay is the only thing that can happen. */
    coldWeeks: number;
    /** Cases that fell under `CASE_CLOSED_BELOW` rather than resolving. */
    closedByDecay: number;
  };
}

// ------------------------------------------------------------- territory ---

export interface Territory {
  id: string;
  /**
   * How this city's version of this district differs from the archetype.
   *
   * Rolled once at world creation and never changed. Everything that reads a
   * district's character multiplies the config figure by this, so a Riverside
   * that came up 14% rich in this game stays 14% rich — it is who the place is,
   * not a deviation for the simulation to correct back to.
   */
  character: number;
  /**
   * What the district is worth *now*, against the founding `wealth` in config.
   *
   * Moves weekly with what is being done to it — fronts and a neighbourhood
   * that likes you raise it, contraband routes and a war fought on the street
   * lower it. Everything that used to read the config figure reads this.
   */
  prosperity: number;
  /** How many people actually live here now. Moves at a fifth of the rate. */
  people: number;
  /** Influence per faction, each 0..100 and independent of the others. */
  influence: Record<FactionId, number>;
  /** How the neighbourhood feels about you, 0..100. */
  sentiment: number;
  /** Businesses located here. */
  businessIds: Id[];
  /** Last day the player did anything here — drives influence decay. */
  lastActionDay: number;
  /** Set once the player has ever operated here, for map fog. */
  visited: boolean;
  /**
   * The man who holds this district, if you have given it to anybody.
   *
   * Optional, so every save written before delegation existed loads with
   * nobody holding anything — which is correct rather than a migration.
   */
  stewardId?: Id | null;
  stewardSince?: number | null;
  /** What he has been seen to do here, newest first. */
  ledger?: StewardEntry[];
}

// --------------------------------------------------------------- factions ---

export type FactionActionKind =
  | 'expand'
  | 'pressure'
  | 'invest'
  | 'consolidate'
  | 'diplomacy'
  | 'poach';

export interface FactionAction {
  day: number;
  kind: FactionActionKind;
  /** District it happened in, when it had one. */
  territoryId: string | null;
  /** Who it was aimed at, for `pressure`. */
  targetFactionId: FactionId | null;
  /** One line for the player-facing log, when they can see it. */
  detail: string;
  /** True when the player had presence to witness it. */
  observed: boolean;
}

/**
 * The person running a family.
 *
 * A family used to be four personality weights that never changed, which meant
 * the Kestler were reckless in 1978 and identically reckless in 2008. A boss
 * ages, dies and is replaced by somebody with different weights, and that is
 * the only thing that makes the other organizations change character over a
 * long game without the player doing it to them.
 */
/**
 * One organization's standing with another. Symmetric: two families do not
 * privately disagree about whether they are at war, and keeping one record per
 * pair removes a whole class of desync bugs.
 */
export interface FactionBond {
  /** What they hold against them. 0..100, decays. */
  grudge: number;
  /** Whether they are taken seriously. -100..100, tracks what they can do. */
  respect: number;
  /** Whether a deal with them would hold. -100..100, slow to earn. */
  trust: number;
  /**
   * The day the shooting started, or null.
   *
   * War used to be the bottom of the relationship scale, which kept one source
   * of truth and cost a great deal of clamping to stop accumulated resentment
   * tipping people into wars nobody had decided to start. It is a date because
   * it is a decision.
   */
  warSince: number | null;
  /**
   * The last day an approach to them was credited as pull.
   *
   * Optional, so a save written before this loads — an absent day reads as
   * "you have never stood in a room with them", which for those saves is
   * either true or close enough that one free credit is not worth a version
   * bump.
   *
   * Here rather than on the player because pull is built with *somebody*.
   * Talking to three families in a week is three rooms; walking back into the
   * same one twice is one.
   */
  lastApproachDay?: number;
}

/**
 * One of the men under a rival boss.
 *
 * Small on purpose. Everything here is either public (his name, his street,
 * roughly how big his crew is) or readable by somebody paying attention (has he
 * been passed over, is his family losing) — there are no hidden stats in a
 * rival organization the player has no way to learn about.
 */
export interface Capo {
  id: Id;
  name: string;
  age: number;
  /** The district he runs, or null while he has nothing of his own. */
  territoryId: string | null;
  /** His share of the family's strength, 0..1. */
  share: number;
  /** What he thinks of the man above him. Falls on facts, not on dice. */
  loyalty: number;
  ambition: number;
  /** Day he was made, which is most of his claim on the chair. */
  since: number;
  /** Last time the player made him an offer. He remembers. */
  approachedDay: number | null;
}

export interface FactionLeader {
  name: string;
  age: number;
  /** Day they took over. */
  since: number;
  /**
   * Deviation from the family's config personality, applied on top of it.
   * A cautious boss of an aggressive family is a real and interesting thing.
   */
  bias: { aggression: number; ambition: number; commerce: number; caution: number };
  /** How they are spoken about, once you know them well enough to hear it. */
  reputation: string;
}

/**
 * One thing a family believes happened to them, and who they think did it.
 *
 * Not a record of the truth. `mistaken` is stored so tests and the decision
 * tracer can tell the difference, and is never rendered — the player finds out
 * a family has the wrong idea by watching what they do about it.
 */
export interface Suspicion {
  /** Who they blame. May not be who did it. */
  actorId: FactionId;
  kind: IncidentKind;
  territoryId: string | null;
  day: number;
  /** How sure they are, 0..1. Independent of whether they are right. */
  confidence: number;
  /** Diagnostic only. Never shown to the player, by anything, ever. */
  mistaken: boolean;
}

export interface Faction {
  id: FactionId;
  /**
   * Which house is sitting in this slot, drawn per seed.
   *
   * The ids stay `falcone` / `vasari` / `kestler` because they are slots in a
   * bond matrix and a save format, not names. What the player sees comes from
   * here — see sim/houses.ts, which falls back to the config definition for the
   * player's own entry and for partially built test states.
   */
  name: string;
  shortName: string;
  colour: string;
  blurb: string;
  reputation: string;
  personality: FactionPersonality;
  wealth: number;
  /** Muscle, 0..100. Spent in war and recovered slowly in peace. */
  strength: number;
  /** Their own law-enforcement attention, on the same 0..100 scale. */
  heat: number;
  /**
   * How they stand with everybody, keyed by faction id including 'player'.
   *
   * A full matrix rather than a single number toward the player, so the
   * families can fall out with each other without you involved — and three
   * dimensions per pair rather than one score, because "hates us", "takes us
   * seriously" and "would sign something with us" are different questions with
   * different answers. See config/diplomacy.ts:BOND.
   */
  bonds: Record<string, FactionBond>;
  /** Accumulated losses. High weariness makes a faction want out of a war. */
  warWeariness: number;
  businessCount: number;
  /** Who is running it, and for how long. */
  leader: FactionLeader;
  /** The three to five men under him. Empty only for the player's entry. */
  capos: Capo[];
  /**
   * What they think has been done to them, newest first.
   *
   * The relationship matrix records how they feel; this records why they think
   * they feel it. The two can disagree with reality independently, which is
   * the entire point — a family acting on a wrong belief behaves exactly like
   * a family acting on a right one, and that is what makes it worth having.
   */
  suspicions: Suspicion[];
  /** What they decided to do most recently, and why it scored. */
  currentObjective: {
    kind: FactionActionKind;
    territoryId: string | null;
    targetFactionId: FactionId | null;
    since: number;
  } | null;
  /**
   * The standing goal, held for months rather than a week.
   *
   * Without one, a family whose obvious moves were all taken scored every
   * option below the action threshold and simply stopped — measured at ninety
   * per cent of weeks idle over twenty years. An agenda is what a settled
   * organization has instead of an opportunity.
   */
  agenda: FactionAgenda | null;
  history: FactionAction[];
  /**
   * Ground this family believes it has lost, keyed `culprit:territoryId`.
   *
   * A running total rather than a rate, because losing a street and losing a
   * corner are different events and the per-point drip cannot tell them apart.
   * Reset by `config/factions.ts:GROUND_LOST.lumpAt` each time it is charged,
   * so it is a tally toward the next insult and not a permanent record.
   *
   * Keyed by who they *think* did it, so a family that blames the wrong
   * neighbour carries the grudge to the wrong door — same as everything else
   * downstream of `attribute`.
   *
   * Optional: saves written before this existed load without it.
   */
  groundLost?: Record<string, number>;
}

export type FactionAgendaKind =
  | 'take_district'
  | 'ruin'
  | 'get_rich'
  | 'go_quiet'
  | 'be_respectable';

export interface FactionAgenda {
  kind: FactionAgendaKind;
  /** The district they want, for `take_district`. */
  territoryId: string | null;
  /** Who they have decided is the problem, for `ruin`. */
  targetFactionId: FactionId | null;
  since: number;
  /** Day they give up on it if it has not happened. */
  until: number;
}

// ------------------------------------------------------------- businesses ---

export interface Business {
  id: Id;
  defId: string;
  territoryId: string;
  purchasedDay: number;
  /** 0..100. Rises with laundering throughput, decays with legitimacy. */
  exposure: number;
  /** Lifetime totals, for the finances screen. */
  revenueTotal: number;
  launderedTotal: number;
  /** What it moved last week, for the UI. */
  lastLaundered: number;
  /**
   * How the business itself is doing, 0..100.
   *
   * Separate from exposure, which is how interesting it is to investigators. A
   * front can be perfectly clean and dying because the neighbourhood hates you
   * and somebody else opened the same thing two streets over.
   */
  health: number;
  status: 'operating' | 'shuttered';
}

// ------------------------------------------------------------ contraband ---

/**
 * The two trades that are businesses rather than jobs.
 *
 * Stock is the only asset in this game that physically exists somewhere, which
 * is why it is the only one a warrant can take off you. Everything else here
 * is the machinery around that: where it comes from, which streets carry it,
 * and what all of it has earned.
 */
export interface Contraband {
  /** Units on hand, by trade. */
  stock: Record<TradeId, number>;
  /** The product arrangement, or null. Arms are made, not bought. */
  supplierId: string | null;
  supplierSince: number;
  /** Machine shops. Capital with an address. */
  workshops: { territoryId: string; since: number }[];
  /** Districts each trade is running through. */
  routes: Record<TradeId, string[]>;
  /** What last week did, for the panel. */
  lastRun: Record<
    TradeId,
    { moved: number; earned: number; bought: number; seized: number }
  > | null;
  lifetime: Record<TradeId, number>;
}

// ------------------------------------------------------------ succession ---

/** Somebody who used to run this. Written when they stop running it. */
export interface Predecessor {
  name: string;
  rank: RankId;
  fromDay: number;
  toDay: number;
  /** How it ended for them, in one line. */
  fate: string;
}

export interface Succession {
  /** The person you have said is next. Null until you say so. */
  heirId: Id | null;
  heirNamedDay: number | null;
  /** 1 for the founder. Increments on every handover. */
  generation: number;
  line: Predecessor[];
}

// ----------------------------------------------------------------- world ---

/**
 * The city as an audience.
 *
 * Wars, arrests, trials and violence generate coverage; coverage moves what
 * the city thinks; what the city thinks decides how much political pressure
 * sits behind the agencies. Three sections of the design brief — media, public
 * opinion and politics — are one feedback loop rather than three systems, and
 * building them separately would have produced three meters and no mechanic.
 *
 * None of these numbers is shown raw. The player reads them the way they read
 * a person: as a phrase, through what they can actually see.
 */
export interface CityState {
  /**
   * What the city thinks of organized crime this season, 0..100.
   * Low is indifference, which is the state you want. High is outrage.
   */
  outrage: number;
  /** How much of that outrage is specifically about you, 0..100. */
  notoriety: number;
  /**
   * Political will pointed at the problem, 0..100. Lags outrage, and is what
   * actually reaches the agencies — a city can be furious for a fortnight
   * without anybody in an office doing anything about it.
   */
  pressure: number;
  /** Headlines, newest first. The player-facing face of all three numbers. */
  stories: NewsStory[];
  /** Day the last story ran, so a quiet week reads as quiet. */
  lastStoryDay: number;
  /** Set while somebody in office is being paid to look elsewhere. */
  patronUntilDay: number | null;
}

export interface NewsStory {
  day: number;
  headline: string;
  /** How loud it was, 0..100. Drives how much outrage it moved. */
  prominence: number;
  /** Whether the organization was named. Unnamed coverage still moves the city. */
  named: boolean;
  tone: 'crime' | 'law' | 'politics';
}

/** A city-wide condition. One at a time, so the board stays legible. */
export interface WorldState {
  conditionId: string | null;
  startedDay: number;
  endsDay: number;
  /** Day the last condition ended, so they do not run back to back. */
  lastEndedDay: number;
}

// ---------------------------------------------------------------- market ---

export interface Loan {
  id: Id;
  lenderId: string;
  /**
   * Which family's money it actually is, for the lender who is one.
   *
   * Null for the other two. It exists so that the day they call it in, the
   * memo can name them and the grudge can land on the right bond — "somebody
   * took a district off you" is not a consequence anybody can act on.
   */
  factionId: string | null;
  /** What was handed over. Never changes — it is what inflation erodes. */
  principal: number;
  /** What is left to pay, fixed at signing and grown by every missed week. */
  owed: number;
  /** Annual rate at the time it was signed, kept for the panel. */
  rate: number;
  openedDay: number;
  dueDay: number;
  /** Consecutive missed paydays. Resets on payment and on collection. */
  missed: number;
}

/**
 * The long economy: which part of the cycle the city is in, what a dollar is
 * worth against day one, and who is owed money.
 */
export interface MarketState {
  phaseId: CyclePhaseId;
  phaseSince: number;
  phaseEnds: number;
  /** Compounding price index. Every nominal figure is quoted in this. */
  prices: number;
  loans: Loan[];
}

// ---------------------------------------------------------------- events ---

export interface EventChoice {
  id: string;
  label: string;
  /** Shown under the button — the player should understand the trade. */
  hint: string;
  /** Disabled with this reason when the choice isn't affordable/possible. */
  disabledReason?: string;
  /**
   * What this choice costs, when it costs money.
   *
   * `disabledReason` is decided once, when the memo is built, and a memo then
   * sits in the queue while payroll drains the balance that justified it —
   * measured at six enabled-but-unaffordable choices across eight careers,
   * several within a hundred dollars. Keeping the figure lets the screen
   * re-check it at the moment the player is actually looking at the button,
   * which is the only moment that matters.
   */
  cost?: number;
}

export interface PendingEvent {
  id: Id;
  defId: string;
  day: number;
  title: string;
  body: string;
  severity: 'info' | 'opportunity' | 'warning' | 'danger';
  choices: EventChoice[];
  /** NPC the event is about, when there is one. */
  npcId: Id | null;
  /** Free-form payload the resolver reads (amounts, targets). */
  data: Record<string, number | string>;
}

export type LogKind =
  | 'neutral'
  | 'money'
  | 'success'
  | 'failure'
  | 'heat'
  | 'crew'
  | 'event';

/** One exchange in a sit-down: what you did and how it went. */
export interface SitdownBeat {
  registerId: string;
  landed: boolean;
  text: string;
}

/**
 * A conversation in progress. Serialisable like everything else, so walking
 * out of the room and reloading puts you back in it.
 */
export interface Sitdown {
  kind: 'crew' | 'rival';
  reasonId: string;
  npcId: Id | null;
  factionId: string | null;
  beats: SitdownBeat[];
  /** Tags learned in this conversation. These are what unlock registers. */
  revealed: string[];
  familiarityBefore: number;
  done: boolean;
  /** Set when the room empties. What it was all worth, in a sentence. */
  outcome: string | null;
}

export interface LogEntry {
  day: number;
  text: string;
  kind: LogKind;
}

// ----------------------------------------------------------- game state ----

/** One decision, with its losing alternatives. Diagnostic only. */
/**
 * One week of a steward's work, as the record shows it.
 *
 * Stores the action he actually took, not the label — two actions share a
 * label deliberately, and flattening them here would throw away the only thing
 * that lets the simulation tell an honest week from a dishonest one.
 */
export interface StewardEntry {
  day: number;
  action: string;
  /** What reached you. Not what the district produced. */
  earned: number;
}

export interface DecisionTrace {
  day: number;
  /** Who decided. A faction id, an npc id, or a system name. */
  actor: string;
  kind: string;
  /** The option that won, and everything it beat, highest first. */
  chose: string;
  options: { label: string; score: number }[];
  /** One line of plain English about why, where the system can say it. */
  because: string;
}

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'brutal';

/**
 * Which of the three ways of playing this is.
 *
 * Read in four places and nowhere else: the two that can end a game, and the
 * two steps of the tick pipeline that only exist because there is a player.
 * Everything else in the simulation is deliberately unaware of it — a mode
 * that had to be handled system by system would be three games to maintain
 * instead of one.
 */
export type GameMode = 'career' | 'sandbox' | 'simulation';

export interface GameState {
  /** Save schema version. Bump when the shape changes incompatibly. */
  version: number;
  rng: RngState;
  difficulty: DifficultyId;
  mode: GameMode;
  /** Days elapsed since game start. Day 1 is the first day. */
  day: number;
  gameOver: { reason: string; day: number } | null;

  player: Player;
  org: Org;

  /** Everyone in the organization, past and present. */
  npcs: Record<Id, Npc>;
  /** People available to bring in. Kept separate so they are never crew. */
  recruits: Record<Id, Npc>;
  /** Day the recruit pool was last refreshed. */
  recruitsRefreshedDay: number;

  activeOperations: Record<Id, ActiveOperation>;
  operationHistory: OperationResult[];

  territories: Record<string, Territory>;
  businesses: Record<Id, Business>;
  /** Rival organizations. Keyed by faction id; the player is not in here. */
  factions: Record<string, Faction>;
  /** What the last payday moved, so the finances panel can show it. */
  lastLaunderReport: {
    laundered: number;
    cut: number;
    revenue: number;
    /**
     * What the machine could have taken, and what there was to put in it.
     *
     * The panel could say how much went through and `launderOutlook` could
     * predict next week, but nothing recorded which of the two ran out on the
     * week that actually happened. Optional because saves written before this
     * existed are still perfectly good ones.
     */
    capacity?: number;
    washable?: number;
  } | null;

  evidence: Record<Id, EvidenceTrace>;
  law: LawEnforcement;
  succession: Succession;
  world: WorldState;
  market: MarketState;
  city: CityState;
  contraband: Contraband;
  pendingEvents: PendingEvent[];
  log: LogEntry[];
  /**
   * Why things happened. A ring buffer of decisions with the scores that lost
   * as well as the one that won, so "why did the Kestler do that?" is
   * answerable from the debug panel instead of from a debugger. Never read by
   * the simulation — writing to it must not be able to change an outcome.
   */
  trace: DecisionTrace[];

  /**
   * The conversation currently on, if any.
   *
   * Optional so every save written before the sit-down existed still loads —
   * an absent field reads as "nobody is in the room", which is correct.
   */
  sitdown?: Sitdown | null;

  /**
   * Everything you have told somebody you would do.
   *
   * Optional, so a save written before promises existed still loads — an
   * absent list reads as "you have not said anything to anybody", which for
   * those saves is exactly true.
   */
  promises?: Promised[];

  /**
   * People outside the family, and what they owe you.
   *
   * Optional, so a save written before the favour network existed still loads
   * — an absent list reads as nobody outside the family knowing who you are,
   * which for those saves is exactly true.
   *
   * A flat list rather than a field on anything, because the interesting
   * question is "who owes me one" and that is a question about all of them at
   * once. Same reasoning as `promises` above.
   */
  civic?: CivicStanding[];

  /**
   * What the other side has turned out to know, newest first.
   *
   * Optional for the same reason as `promises`: a save from before this existed
   * has never had anybody talking, so an absent list is the truth rather than
   * missing data.
   */
  leaks?: Leak[];

  /** Counters and one-off markers. Cheaper than adding a field per flag. */
  flags: Record<string, number>;
  nextId: number;
}
