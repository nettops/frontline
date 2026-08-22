/**
 * Money, wages and rank progression.
 * Tune the game's pacing here — no logic in this file.
 */

import type { AttributeId, Attributes, RankId, RoleId } from '../sim/types';

/**
 * Fear and standing, kept apart.
 *
 * They used to be one number called respect, which meant the optimal play was
 * always violence and the word "respect" was doing no work — every act of
 * intimidation bought exactly the same currency as beating a case in court.
 *
 * Now they are earned by different things and spent on different things.
 * Standing is what people do for you because they want to: it gates rank,
 * recruiting, alliances and who the room will follow when you are gone. Fear
 * is what they do because of the alternative: it makes witnesses reconsider,
 * shakedowns land and defection expensive — and it costs you with the city,
 * with the neighbourhood, and with anybody who had a choice.
 */
export const FEAR = {
  /** Fear bleeds off if you stop reminding people. Faster than standing does. */
  decayPerWeek: 1.4,
  /** Ceiling, on the same scale as heat. */
  max: 100,

  /** What violence buys, per act. */
  fromViolence: 6,
  fromWarClash: 4,
  fromIntimidation: 4,
  /** What a public failure costs. Being feared is a claim; failing tests it. */
  onFailure: -3,

  /** Fear suppresses defection: multiplier on the weekly chance, at maximum. */
  defectionAtMax: 0.45,
  /** ...and adds to witness pressure and shakedown success. */
  witnessBonusAtMax: 0.25,
  /** But frightened people are not loyal people. Loyalty drift, at maximum. */
  loyaltyPerWeekAtMax: -1.1,
  /** Sentiment across districts you hold, per week at maximum. */
  sentimentPerWeekAtMax: -0.55,
  /** Recruits are harder to find when the job is frightening. */
  recruitCostAtMax: 1.6,
};

/**
 * Standing earned by what the family holds, rather than by what it did.
 *
 * Every point of respect in the game was paid for an act — a job that landed,
 * a war declared, an acquittal. Nothing was ever paid for holding a district
 * for a year or keeping four shops open, which is the thing the game says it
 * is about.
 *
 * That was not a flavour problem, it was the ceiling on the ladder. Boss asks
 * for 500 and across 35 four-year careers the best any family ever reached was
 * 497, with a median of 304 — and running the same probe over fifteen years
 * changed neither number, because only 2 careers in 35 last that long. The
 * jobs that pay real standing cost 28, 30 and 50 a time and a family whose
 * median weekly purse is under $2,000 cannot stake them, so a career runs a
 * hundred small jobs at two or three apiece and stops.
 *
 * The rate: a district held for a year is worth about half of one serious job,
 * a front about a fifth of that. Slow enough that it cannot replace working —
 * a family sitting still still needs a hundred jobs — and steady enough that a
 * boss who *keeps* what he takes ends up ahead of one who only ever takes.
 *
 * Shuttered fronts are not counted. `ownedBusinesses` filters them out before
 * this sees them, so a boarded-up shop is worth exactly what it looks like.
 */
export const STANDING_HELD = {
  perDistrictPerWeek: 0.55,
  perFrontPerWeek: 0.2,
};

export const STARTING_CASH = 2_500;
export const STARTING_DIRTY_CASH = 0;
export const STARTING_RESPECT = 0;
export const STARTING_FEAR = 0;

/** Wages are paid every 7 days, on days where day % 7 === 0. */
/**
 * Putting clean money somewhere it stops being spendable.
 *
 * Property, a stake in something, a box at a bank. It counts as standing
 * because the people whose opinion decides rank can see it, and it is not
 * liquid because that is the entire point.
 *
 * The discount is what makes it a decision rather than a switch. A boss who
 * locks away his Capo money and then needs a lawyer next week gets most of it
 * back, not all of it — selling in a hurry is not selling well.
 */
export const HOLDINGS = {
  /** Nothing smaller is worth the paperwork. */
  minimum: 1_000,
  /** What you get back per dollar when you sell in a hurry. */
  withdrawReturn: 0.85,
  /**
   * What it earns while it sits there, per week.
   *
   * Holdings were dead money with an exit fee: the only reason to use them was
   * that the rank table counts them, and the only consequence was a 15% loss
   * whenever the family needed the money back. Measured, that made banking a
   * losing move — a bot following the obvious careful policy put $119,260 away
   * across a career and sold $262,969 back.
   *
   * The financial rework set out to make the top of the ladder "reachable by
   * compounding" and then shipped nothing that compounds. This is the missing
   * half. Property appreciates, a stake in something pays a dividend, and
   * money in a box at a bank at least keeps pace — none of which needs the
   * boss to be alive, out of prison or free that week, which is exactly what
   * distinguishes it from every other income in the game.
   *
   * 0.45% a week is about 26% a year, which sounds generous until you notice
   * that a front in the same catalogue pays for itself in twenty weeks. It is
   * deliberately the *worst* return available and the only safe one.
   */
  yieldPerWeek: 0.0045,
} as const;

export const PAYDAY_INTERVAL = 7;

/**
 * Length of a year, for everything that happens annually.
 *
 * The calendar in util.ts is real, so this is a working approximation rather
 * than an astronomical one — nothing in the simulation cares about a leap day,
 * and a fixed number keeps the yearly tick reachable from day % YEAR === 0.
 */
export const DAYS_PER_YEAR = 365;

/** Weekly wage by role. Underpaying a greedy NPC erodes loyalty fast. */
/**
 * The most anybody is ever paid for a job, as a multiple of the going rate.
 *
 * Was a bare `* 4` inside the clamp in `setWage`, which meant nothing outside
 * that function could ask where the ceiling was — and the UI, unable to ask,
 * offered a raise that could not happen and charged the man grievance for it.
 */
export const WAGE_CEILING_MULTIPLE = 4;

export const ROLE_WAGE: Record<RoleId, number> = {
  associate: 150,
  soldier: 300,
  enforcer: 450,
  lieutenant: 700,
  capo: 1_200,
  consigliere: 1_500,
  underboss: 2_000,
};

export const ROLE_LABEL: Record<RoleId, string> = {
  associate: 'Associate',
  soldier: 'Soldier',
  enforcer: 'Enforcer',
  lieutenant: 'Lieutenant',
  capo: 'Capo',
  consigliere: 'Consigliere',
  underboss: 'Underboss',
};

/** Promotion path. A role's index is also its authority level. */
export const ROLE_ORDER: RoleId[] = [
  'associate',
  'soldier',
  'enforcer',
  'lieutenant',
  'capo',
  'consigliere',
  'underboss',
];

/** Cost to bring someone in, on top of their wage. */
export const RECRUIT_COST = 500;

/** Missing a payday costs loyalty and adds a grievance. */
/**
 * What a *completely* unpaid week costs each man.
 *
 * These used to be flat: any shortfall at all, however small, applied the whole
 * figure. Measuring the game found a bot playing every job at its best expected
 * value still missing payday in 24 worlds out of 24, because the cliff turned
 * ordinary timing — a job landing a day after Friday — into the full penalty.
 *
 * They are now the hit at a total miss, scaled by the fraction of the wage bill
 * that actually went unpaid. Covering nine tenths of it costs a tenth of this.
 */
export const MISSED_PAY_LOYALTY_HIT = 12;
export const MISSED_PAY_GRIEVANCE = 15;

/**
 * How short a week has to be before a man files it as a thing that happened to
 * him rather than a bad week.
 *
 * Memories do not fade for years and are read by every later decision about
 * whether to walk, so writing one for a payday that was 95% covered would make
 * a rounding error permanent.
 */
export const UNPAID_MEMORY_THRESHOLD = 0.35;

/** Goodwill returned per man when back wages are finally cleared. */
export const ARREARS_CLEARED_LOYALTY = 5;

// ----------------------------------------------------------------- ranks ---

export interface RankDef {
  id: RankId;
  name: string;
  /**
   * Everything must be met before the promotion is offered.
   *
   * `cleanCash` is deliberately clean, not total — laundering is load-bearing
   * for progression rather than an optional convenience. The first rung is set
   * below the starting balance so the early game is not gated on a system the
   * player has not unlocked yet.
   */
  requires: {
    respect: number;
    crew: number;
    cleanCash: number;
    opsCompleted: number;
    /** Districts held at control level or better. */
    territories: number;
  };
  /** You cannot command more people than your standing supports. */
  maxCrew: number;
  /** Highest role you may promote someone to. */
  maxRole: RoleId;
  blurb: string;
}

/*
   The top four rungs, set against the window a person actually plays.

   Everything above Crew Leader was previously calibrated against the best each
   of 35 *four-year* careers ever reached, taken between the median and the
   75th percentile. The method is right. The window was wrong, and wrong in the
   exact way HANDOFF §5 exists to stop: the instruments measure 1,460-day
   careers and every blind round this project has ever run is one year.

   What that cost, measured over 36 careers at 300 days under the old table:

     Street Criminal  36/36  day 0        Capo         11/36  day 212
     Enforcer         34/36  day 21       Underboss     3/36  day 221
     Crew Leader      29/36  day 60       Boss          0/36  never
                                          Crime Lord    0/36  never

   Three rungs inside the first ten weeks, then nothing for the next thirty-
   three. Two of the seven ranks were never reached by any career inside the
   span of a human game. Round 12's *informed* run — a tester who already knew
   what he was doing — reached Capo on day 324, past the end of the round.

   That gap is almost certainly what F1 has been reporting as "decisions stop
   changing around day 90-119". The loop did not close. The ladder stopped
   answering and nothing else was scheduled to.

   Re-sized by the original method against the day each rung should land — 130,
   220, 285 — with the same division of labour the old comment described: the
   three columns that say what a family *built* carry the rank, and the two
   that say how it got there sit low enough to be implied. Five requirements
   joined by AND is a product, not a ladder.

   The money column is the exception and could not be sized freely. Two
   pre-existing invariants own it: `foresight.test.ts` requires each paying
   rung to be three to six times the one below, and `balance.test.ts` requires
   that nobody coast to the top rung in two years. Both are older than this
   change and both are right, so the money ladder is set at the bottom of the
   band they allow — 12,500, 40,000, 130,000, 420,000, 1,400,000 — rather than
   at what a 300-day career can actually hold.

   What that leaves, over the same 36 careers at 300 days:

     Capo   11/36 day 86    Underboss 9/36 day 211    Boss 7/36 day 260

   The rungs arrive far earlier and Boss becomes reachable at all. The *share*
   of careers reaching them barely moves, and the probe says why in one line:
   `furthest requirement at the end: clean money 34, respect 2`. Thirty-four of
   thirty-six careers are held by the money line at whatever rung they are
   pushing at.

   So the table was a symptom, and the first reading of why it was one was
   wrong. "A career earns $5.4M and peaks at a balance of $45,470" compares a
   mean against a median on a distribution whose mean is nearly ten times its
   median, which is not a ratio at all. There is no leak.

   What is actually there, sorted across 36 careers at day 300: twenty-five
   careers end between $8,677 and $47,667, and eleven end between $133,975 and
   $2,827,037. The population splits, and it splits on fronts — the flat
   twenty-five hold a median of one, the compounding eleven hold a median of
   seven. Front income is paid into holdings, which compound; a family that
   never gets a second front never starts.

   Which puts the money rung, and so the whole top of this table, downstream of
   the front gate — the system F10 was about and F12 still is. The honest
   record is that this change improved the pacing, did not reach the
   pre-committed target, and located what does.
   `ladder.probe.test.ts` fails on that target on purpose.
*/
export const RANKS: RankDef[] = [
  {
    id: 'street_criminal',
    name: 'Street Criminal',
    requires: { respect: 0, crew: 0, cleanCash: 0, opsCompleted: 0, territories: 0 },
    maxCrew: 3,
    maxRole: 'soldier',
    blurb: 'Nobody knows your name. Nobody is looking for you either.',
  },
  {
    id: 'enforcer',
    name: 'Enforcer',
    // No clean-money requirement at all: wages erode the starting balance, so
    // any figure here gates the first promotion on laundering, which the
    // player cannot have unlocked yet. The clean economy starts mattering at
    // Crew Leader, by which point a foothold and a front are reachable.
    requires: { respect: 20, crew: 2, cleanCash: 0, opsCompleted: 5, territories: 0 },
    maxCrew: 6,
    maxRole: 'enforcer',
    blurb: 'People on the block know what happens when you show up.',
  },
  {
    id: 'crew_leader',
    name: 'Crew Leader',
    requires: { respect: 60, crew: 5, cleanCash: 12_500, opsCompleted: 15, territories: 1 },
    maxCrew: 12,
    maxRole: 'lieutenant',
    blurb: 'You give the orders now. The mistakes are yours too.',
  },
  {
    id: 'capo',
    name: 'Capo',
    requires: { respect: 120, crew: 8, cleanCash: 40_000, opsCompleted: 24, territories: 1 },
    maxCrew: 22,
    maxRole: 'capo',
    blurb: 'A seat at the table, and everyone at it counting your earnings.',
  },
  {
    id: 'underboss',
    name: 'Underboss',
    requires: { respect: 180, crew: 11, cleanCash: 130_000, opsCompleted: 34, territories: 2 },
    maxCrew: 36,
    maxRole: 'consigliere',
    blurb: 'Second in the room. First in the indictment.',
  },
  {
    id: 'boss',
    name: 'Boss',
    requires: { respect: 260, crew: 14, cleanCash: 420_000, opsCompleted: 46, territories: 3 },
    maxCrew: 55,
    maxRole: 'underboss',
    blurb: 'Your family. Your rules. Your problem when it goes wrong.',
  },
  {
    id: 'crime_lord',
    name: 'Crime Lord',
    requires: { respect: 600, crew: 26, cleanCash: 1_400_000, opsCompleted: 120, territories: 5 },
    maxCrew: 120,
    maxRole: 'underboss',
    blurb: 'Cities move around you. So do task forces.',
  },
];

export const RANK_BY_ID: Record<RankId, RankDef> = Object.fromEntries(
  RANKS.map((r) => [r.id, r]),
) as Record<RankId, RankDef>;

export function rankIndex(id: RankId): number {
  return RANKS.findIndex((r) => r.id === id);
}

// ------------------------------------------------------------ attributes ---

export const ATTRIBUTE_IDS: AttributeId[] = [
  'leadership',
  'intimidation',
  'negotiation',
  'intelligence',
  'streetSmarts',
  'business',
  'strategy',
  'influence',
];

export const ATTRIBUTE_LABEL: Record<AttributeId, string> = {
  leadership: 'Leadership',
  intimidation: 'Intimidation',
  negotiation: 'Negotiation',
  intelligence: 'Intelligence',
  streetSmarts: 'Street Smarts',
  business: 'Business',
  strategy: 'Strategy',
  influence: 'Influence',
};

export const ATTRIBUTE_BLURB: Record<AttributeId, string> = {
  leadership: 'Holds a crew together. Slows loyalty decay.',
  intimidation: 'Shakedowns and threats land harder.',
  negotiation: 'Better terms, cheaper recruits, calmer disputes.',
  intelligence: 'Planning-heavy jobs go smoother.',
  streetSmarts: 'Reading a room, spotting a setup, staying clean.',
  business: 'Legitimate fronts, laundering throughput and exposure.',
  strategy: 'Large, complex operations.',
  influence: 'Pull with people who matter. Contacts, counsel, favours.',
};

export const STARTING_ATTRIBUTES: Attributes = {
  leadership: 2,
  intimidation: 3,
  negotiation: 2,
  intelligence: 3,
  streetSmarts: 4,
  business: 1,
  strategy: 2,
  influence: 0,
};

export const ATTRIBUTE_MAX = 20;

/**
 * What builds pull with people who matter, and why it had to be added.
 *
 * `influence` gates the police contacts, the seat at city hall, and two layers
 * of what the City panel will tell you. Round 9's tester played 150 days and
 * reported it at exactly 0 the whole way, with three subsystems sealed behind
 * it and no way to tell whether that was their failure or a wall.
 *
 * It was a wall, and a circular one. The attribute was trained in two places
 * in the entire game: a $25,000 choice inside one heat event, and acquiring a
 * police contact — which itself requires influence 5, 7 or 11 for three of the
 * four agencies. So the main way to earn influence was to already have it. The
 * Yourself panel meanwhile says attributes improve by use, which for this one
 * was simply untrue.
 *
 * These are the two things a player already does that the attribute's own
 * description — "Contacts, counsel, favours" — is about. Keeping a firm on
 * retainer is a standing relationship with somebody who matters, and sitting
 * down with another family is the favour economy itself. Neither is a new
 * mechanic and neither needs a new screen.
 *
 * Sized against `attributeProgressNeeded`: at these rates a boss who keeps
 * ordinary counsel for a year and talks to his neighbours occasionally arrives
 * at the first contact threshold rather than at the fourth. It is meant to open
 * the door, not walk through it.
 */
export const INFLUENCE_FROM = {
  /** Per week on a real retainer, scaled by how serious the firm is. */
  counselPerWeek: 0.12,
  /** Per diplomatic approach that is made and paid for, refused or not. */
  approach: 0.6,
  /*
     Days before the same family builds you any more pull.

     `demand_tribute` costs nothing, and the credit above was paid per call
     with nothing in `canDo` rate-limiting it — twenty demands in one afternoon
     were credited ten times over, on the attribute the game presents as the
     hard one to train. Anybody optimising would have found it in a minute.

     A fortnight, and it limits the *credit* rather than the action: you may
     talk as often as you like, and the tribute or the refusal lands either
     way. Standing in the same room twice in a week is simply not twice the
     standing.

     Sized against the window a person plays, per HANDOFF section 5. Three
     families across 300 days is about twenty rooms a family, which is a real
     route to the middle of the scale and nowhere near the top of it.
  */
  approachCooldownDays: 14,
};

/**
 * Attributes improve by use. Each successful use adds progress; progress
 * needed per point scales with the current value, so 3→4 is quick and
 * 15→16 is a grind.
 */
export function attributeProgressNeeded(current: number): number {
  return 3 + current * 1.6;
}
