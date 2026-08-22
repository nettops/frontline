/**
 * Law enforcement.
 *
 * The agencies are not omniscient and they do not react to a hidden "wanted
 * level". They read the evidence the player has actually left behind — every
 * failed job, arrest, dismissal, act of violence and over-exposed front has
 * been writing `EvidenceTrace` records since Phase 2, and this is the system
 * that finally consumes them.
 *
 * A case is therefore always explicable: something specific caused it, and the
 * player could in principle have avoided leaving it.
 */

import type { EvidenceTrace } from '../sim/types';

export type EvidenceSource = EvidenceTrace['source'];

// ---------------------------------------------------------------- stages ---

export type StageId =
  | 'suspicion'
  | 'intelligence'
  | 'surveillance'
  | 'witnesses'
  | 'financial'
  | 'warrants'
  | 'arrests'
  | 'indictment'
  | 'trial';

export interface StageDef {
  id: StageId;
  name: string;
  /** What is happening to you, in plain terms. */
  blurb: string;
  /** Case strength needed before it can move here. */
  minEvidence: number;
  /** Days the case must have spent in the previous stage. */
  minDays: number;
}

/** Ordered. A case walks this list and never skips. */
export const STAGES: StageDef[] = [
  {
    id: 'suspicion',
    name: 'Suspicion',
    blurb: 'Your name has come up. That is all, so far.',
    minEvidence: 0,
    minDays: 0,
  },
  {
    id: 'intelligence',
    name: 'Intelligence Gathering',
    blurb: 'Somebody is pulling records and asking quiet questions about you.',
    minEvidence: 12,
    minDays: 10,
  },
  {
    id: 'surveillance',
    name: 'Surveillance',
    blurb: 'Cars that do not belong. Your people are being followed and photographed.',
    minEvidence: 25,
    minDays: 14,
  },
  {
    id: 'witnesses',
    name: 'Witness Identification',
    blurb: 'They have started approaching people who know things about you.',
    minEvidence: 40,
    minDays: 18,
  },
  {
    id: 'financial',
    name: 'Financial Investigation',
    blurb: 'Subpoenas on your accounts. Every dollar has to explain itself.',
    minEvidence: 52,
    minDays: 20,
  },
  {
    id: 'warrants',
    name: 'Search Warrants',
    blurb: 'A judge has signed. They can come through any door they have named.',
    minEvidence: 65,
    minDays: 16,
  },
  {
    id: 'arrests',
    name: 'Arrests',
    blurb: 'They are taking people off the street and offering them terms.',
    minEvidence: 75,
    minDays: 14,
  },
  {
    id: 'indictment',
    name: 'Indictment',
    blurb: 'A grand jury has returned charges. Your name is on them.',
    minEvidence: 85,
    minDays: 20,
  },
  {
    id: 'trial',
    name: 'Trial',
    blurb: 'It is out of your hands and in front of twelve people.',
    minEvidence: 92,
    minDays: 25,
  },
];

export const STAGE_BY_ID: Record<StageId, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageDef>;

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((s) => s.id === id);
}

// -------------------------------------------------------------- agencies ---

export interface AgencyDef {
  id: string;
  name: string;
  shortName: string;
  blurb: string;
  /** Evidence sources this agency cares about. */
  focus: EvidenceSource[];
  /** Below this heat they are not interested in you at all. */
  heatFloor: number;
  /**
   * How big you have to look from outside before they are interested.
   *
   * Agencies investigate organizations proportionate to themselves: a federal
   * task force does not convene over an eight-man crew, and gating on heat
   * alone meant they did exactly that, arriving long before the player could
   * afford any of the defence the game sells them.
   *
   * This used to be a rank, which was the wrong instrument for a subtle reason.
   * A rank in this game is a conjunction — respect *and* crew *and* clean money
   * *and* jobs *and* districts — so it moves at the speed of whichever of the
   * five is slowest. An organization of twenty men holding six districts with
   * nothing laundered is still an Enforcer, and the Task Force could not see
   * it. What an agency can actually see is bodies, ground, fronts, and the size
   * of the file they have already got, which is what `footprint` counts.
   */
  noticesAbove: number;
  /** Unattached matching evidence needed before they open a case. */
  openThreshold: number;
  /** Weekly case-strength gain from their own investigative work. */
  skill: number;
  /** How far they can take a case. Local police cannot indict a boss. */
  maxStage: StageId;
  /** Multiplies how quickly they clear the time gate between stages. */
  pace: number;
  /**
   * Cost per week of a competent lawyer against this agency.
   *
   * Set against the payroll the ladder probe actually reports, which is about
   * $1,460 a week. The target is that `local` is a bill a working boss pays
   * without much thought, `firm` is a real decision, and `best` is the ruinous
   * thing its own blurb says it is. The previous figures put a firm at six
   * times the entire wage bill and representation was retained in 14 weeks out
   * of 145 under investigation — a counterplay nobody could buy.
   */
  legalCostPerWeek: number;
  /** Cost of buying somebody inside. Federal people are expensive. */
  contactCost: number;
  /** Influence attribute needed before anybody inside will take a meeting. */
  contactInfluenceRequired: number;
}

export const AGENCIES: AgencyDef[] = [
  {
    id: 'city_police',
    name: 'City Police Department',
    shortName: 'City Police',
    blurb:
      'They are close, they are fast, and half of them grew up on the same streets you did. They can ruin a month. They cannot end you.',
    focus: ['violence', 'operation'],
    heatFloor: 15,
    noticesAbove: 0,
    openThreshold: 25,
    skill: 2.4,
    maxStage: 'arrests',
    pace: 1.3,
    legalCostPerWeek: 380,
    contactCost: 30_000,
    contactInfluenceRequired: 0,
  },
  {
    id: 'state_taskforce',
    name: 'State Organized Crime Task Force',
    shortName: 'Task Force',
    blurb:
      'Assembled specifically for organizations like yours. Patient, and interested in the shape of the thing rather than any single job.',
    focus: ['operation', 'informant', 'violence'],
    heatFloor: 35,
    noticesAbove: 22,
    openThreshold: 45,
    skill: 2.0,
    maxStage: 'indictment',
    pace: 1,
    legalCostPerWeek: 900,
    contactCost: 85_000,
    contactInfluenceRequired: 5,
  },
  {
    id: 'treasury',
    name: 'Financial Crimes Division',
    shortName: 'Financial Crimes',
    blurb:
      'They never come to your door. They come to your accountant, and they are never in a hurry.',
    focus: ['finance'],
    heatFloor: 20,
    noticesAbove: 22,
    openThreshold: 35,
    skill: 1.8,
    maxStage: 'indictment',
    pace: 0.85,
    legalCostPerWeek: 1_050,
    contactCost: 110_000,
    contactInfluenceRequired: 7,
  },
  {
    id: 'federal_bureau',
    name: 'Federal Bureau of Investigation',
    shortName: 'Federal Bureau',
    blurb:
      'They will spend four years on you and consider it time well spent. When they move, it is because they have already won.',
    focus: ['operation', 'informant', 'finance', 'violence'],
    heatFloor: 55,
    noticesAbove: 52,
    openThreshold: 70,
    skill: 1.6,
    maxStage: 'trial',
    pace: 0.7,
    legalCostPerWeek: 1_250,
    contactCost: 150_000,
    contactInfluenceRequired: 11,
  },
];

export const AGENCY_BY_ID: Record<string, AgencyDef> = Object.fromEntries(
  AGENCIES.map((a) => [a.id, a]),
);

// -------------------------------------------------------------- evidence ---

/** How much of a trace's strength lands on a case that absorbs it. */
export const EVIDENCE_ABSORPTION = 0.55;

/** Old crimes go cold. Traces lose this much strength per week once stale. */
export const EVIDENCE_DECAY_PER_WEEK = 0.55;
export const EVIDENCE_STALE_AFTER_DAYS = 45;
/** Below this a trace is worthless and is dropped entirely. */
export const EVIDENCE_WORTHLESS_BELOW = 1.5;

/** Heat feeds a live case: being loud while under investigation is fatal. */
export const HEAT_EVIDENCE_CONTRIBUTION = 0.035;

/**
 * A case with nothing new to chew on loses momentum. This is what makes going
 * quiet a real answer to an investigation rather than a delaying tactic.
 */
/**
 * Below this heat, a case with no fresh evidence gets no traction from the
 * player's visibility at all. Without a floor, "managed" heat around 40 still
 * fed every case indefinitely and no amount of discipline could starve one.
 */
export const MOMENTUM_HEAT_FLOOR = 20;

export const COLD_CASE_AFTER_DAYS = 35;
export const COLD_CASE_DECAY_PER_WEEK = 1.8;
/** Below this strength, a stalled case is closed for good. */
export const CASE_CLOSED_BELOW = 6;

/**
 * What each case after the first adds to the legal bill.
 *
 * `weeklyLegalCost` charged every active case at full rate and then multiplied
 * the whole sum by the lawyer's `costMultiplier`, so two agencies did not cost
 * twice as much, they cost twice as much *times* 2.6. Measured over 36 careers
 * that put a serious firm at $8,380 a week against a payroll of $1,373, and
 * the ladder probe's bot could afford representation in 14 weeks out of the
 * 145 it spent under investigation.
 *
 * A retainer is a relationship with a firm, not an invoice per file. The
 * second agency is more work and it is not a second firm.
 */
export const ADDITIONAL_CASE_SHARE = 0.4;

// ------------------------------------------------------- consequences ------

/** Success chance lost to being actively watched, by stage index. */
export const SURVEILLANCE_OPERATION_PENALTY = 0.1;
/** Laundering capacity lost once they are inside your books. */
export const FINANCIAL_LAUNDER_PENALTY = 0.55;
/** Share of clean cash a search warrant can take. */
export const WARRANT_SEIZURE_SHARE: [number, number] = [0.15, 0.4];
/** How many of your people get taken when the arrests stage lands. */
export const ARREST_SWEEP_COUNT: [number, number] = [1, 2];
export const ARREST_SWEEP_DAYS: [number, number] = [30, 90];

/**
 * How much luck there is in who a sweep takes, in nights-worked units.
 *
 * A sweep used to be `rng.sample` over the whole payroll — a lottery, which is
 * both wrong about how a case is built and the reason a playtester read losing
 * a soldier for forty-five days as bad luck rather than as the bill for
 * sending the same man on everything.
 *
 * Nights worked is what a case actually accumulates against somebody, so it is
 * what decides who gets taken. This is the noise on top of it. Without it the
 * same three men are taken every single time, which is a lookup rather than a
 * risk; with it, doing all the work makes you far likelier to be taken and
 * never certain.
 */
export const SWEEP_JITTER = 3;

/**
 * A case that has hit its agency's ceiling keeps doing the last thing it can.
 * City Police cannot indict you, but they can keep taking your people.
 */
export const PARKED_CASE_REPEAT_CHANCE = 0.06;

/**
 * How long a case sits at its ceiling before the agency takes what it has and
 * moves on. Without this, City Police reach Arrests against any active player
 * and stay there forever, which is not a crisis to survive — it is permanent
 * background attrition that quietly caps the size of every organization.
 */
export const PARKED_CASE_RESOLVES_AFTER_DAYS = 70;

/** Every stage advance frightens the organization. */
export const STAGE_ADVANCE_FEAR = 8;
export const STAGE_ADVANCE_LOYALTY = -3;

// ------------------------------------------------------------ counterplay ---

export type LawyerLevel = 'none' | 'local' | 'firm' | 'best';

export interface LawyerDef {
  level: LawyerLevel;
  name: string;
  blurb: string;
  /** Multiplies the weekly retainer of every agency you are facing. */
  costMultiplier: number;
  /** Multiplies case-strength growth. */
  evidenceMultiplier: number;
  /** Added to your chances at trial. */
  trialBonus: number;
  /**
   * Multiplies how long a man stays inside when he is picked up.
   *
   * A playtester lost their whole crew to arrests, watched thirty to a hundred
   * and twenty days go by with no lever of any kind, and filed it as the game
   * going away for a while. They were right that there was nothing to do about
   * it — a retainer bought a slower case and a better trial, and did nothing
   * whatever for the man in the cell, which is not what a lawyer is for.
   *
   * Deliberately hung on the existing retainer rather than added as a new
   * per-arrest purchase. It gives an existing decision a second consequence
   * instead of giving the player a new screen, and it means the counsel you
   * were already paying for turns out to matter on the worst week you have.
   */
  sentenceMultiplier: number;
}

export const LAWYERS: LawyerDef[] = [
  {
    level: 'none',
    name: 'No representation',
    blurb: 'Whatever the state provides, if it comes to that.',
    costMultiplier: 0,
    evidenceMultiplier: 1,
    trialBonus: 0,
    sentenceMultiplier: 1,
  },
  {
    level: 'local',
    name: 'A local attorney',
    blurb: 'Knows the courthouse and which clerks answer the phone. Slows things down.',
    costMultiplier: 1,
    evidenceMultiplier: 0.82,
    trialBonus: 0.1,
    sentenceMultiplier: 0.82,
  },
  {
    level: 'firm',
    name: 'A serious firm',
    blurb: 'Paper for every request, an objection for every subpoena, and a bill to match.',
    costMultiplier: 2.6,
    evidenceMultiplier: 0.66,
    trialBonus: 0.22,
    sentenceMultiplier: 0.66,
  },
  {
    level: 'best',
    name: 'The best money can buy',
    blurb:
      'The kind of counsel that makes prosecutors reconsider whether they have enough. Ruinously expensive.',
    costMultiplier: 5.5,
    evidenceMultiplier: 0.5,
    trialBonus: 0.34,
    sentenceMultiplier: 0.5,
  },
];

export const LAWYER_BY_LEVEL: Record<LawyerLevel, LawyerDef> = Object.fromEntries(
  LAWYERS.map((l) => [l.level, l]),
) as Record<LawyerLevel, LawyerDef>;

/**
 * Somebody inside an agency. Buys you sight of what they have, and slows them
 * down — but a contact is a person who knows you are paying them, which is its
 * own kind of evidence.
 */
export const CONTACT = {
  /** Weekly retainer as a share of what they cost to turn. */
  upkeepShare: 0.04,
  /** Case-strength growth multiplier while the contact holds. */
  evidenceMultiplier: 0.78,
  /** Chance per week a contact is discovered, which is very bad. */
  exposureChancePerWeek: 0.012,
  /** Evidence created when a contact is burned. */
  exposureEvidence: 30,
  /** Intel level a contact provides, 0..100. */
  intelValue: 70,
};

/** Destroying what they have already collected. High risk, high reward. */
export const DESTROY_EVIDENCE = {
  cost: 20_000,
  /** Case strength removed on success. */
  removed: [8, 18] as [number, number],
  /** Base chance it works before Street Smarts. */
  baseSuccess: 0.55,
  successPerStreetSmarts: 0.02,
  /** Case strength added when it goes wrong, plus heat. */
  backfireEvidence: 12,
  backfireHeat: 10,
};

/** Leaning on somebody they have identified as a witness. */
export const PRESSURE_WITNESS = {
  cost: 12_000,
  /** Case strength removed when the witness stops cooperating. */
  removed: [6, 14] as [number, number],
  baseSuccess: 0.5,
  successPerIntimidation: 0.025,
  backfireEvidence: 16,
  backfireHeat: 12,
};

// ------------------------------------------------------------------ trial ---

/**
 * The verdict. Conviction chance is the case's strength against everything you
 * have put between yourself and it.
 */
export const TRIAL = {
  /**
   * Case strength maps to this much conviction chance per point.
   *
   * Kept well below 0.01 deliberately. At 0.011 a strong case convicted on
   * essentially any roll, which left no room for the defence the player spent
   * the whole game buying — lawyers and contacts became decoration and every
   * trial was a formality. A maximal case against an undefended boss should be
   * near-certain; against the best money can buy it should be a real question.
   */
  strengthWeight: 0.0065,
  /** Every witness they still have makes it worse. */
  perSuspect: 0.015,
  /** Floor and ceiling — nothing is ever certain, in either direction. */
  minConviction: 0.05,
  maxConviction: 0.95,
  /** Days from indictment to verdict. */
  daysToVerdict: 25,
  /** Acquittal is not free — it still cost you everything you spent. */
  acquittalRespect: 15,
};

/** What the player can see about a case without somebody on the inside. */
export const CASE_INTEL_STAGE_ABOVE = 25;
export const CASE_INTEL_STRENGTH_ABOVE = 55;
export const CASE_INTEL_SUSPECTS_ABOVE = 70;

/** Surveillance and arrests are impossible to miss, whatever your intel. */
export const OBVIOUS_STAGES: StageId[] = [
  'surveillance',
  'warrants',
  'arrests',
  'indictment',
  'trial',
];
