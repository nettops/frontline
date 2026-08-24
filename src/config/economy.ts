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

/**
 * What a rung of the old ladder was called.
 *
 * Everything that made this a ladder is gone. `requires` gated promotion,
 * `maxCrew` gated the payroll and `maxRole` gated who you could name — all
 * three were replaced (by `opens` on the job table, by `CREW_BASE` and the
 * per-district and per-front terms above, and by the board respectively), and
 * `player.rank` has been pinned at the first rung ever since.
 *
 * The three fields survived the deletion of `nextRank` and `rankRequirements`
 * because an audit that greps for references finds them: four probes and a
 * `foresight` assertion were still reading a table that gated nothing, and
 * reporting distances to it. That is what is being removed here.
 *
 * What is left is a name. Saves record it, the succession line records what a
 * predecessor was called, and the title bar prints it. Nothing reads it as a
 * gate, and there is no code path that changes it.
 */
export interface RankDef {
  id: RankId;
  name: string;
  blurb: string;
}

/**
 * How many people the outfit can hold: a base, plus this for every district.
 *
 * Replaces `RankDef.maxCrew`. See `maxCrew` in `sim/player.ts` for the arrival
 * curves these were sized against — the point was to land on the old ladder's
 * shape at the same days rather than to change what a career can afford.
 */
export const CREW_BASE = 3;
export const CREW_PER_DISTRICT = 4;
/**
 * Premises feed people too, and leaving them out starved a whole play style.
 *
 * The first version of this counted ground alone at 5 a district. Measured on
 * `ladder.probe`, whose bot works one neighbourhood hard rather than spreading
 * — which is a perfectly ordinary way to play, and the way the fiction points
 * — that bot holds one district and two fronts at day 300, so its ceiling fell
 * from 36 people to 8 and everything downstream of a crew starved with it.
 *
 * A front is a payroll a man can plausibly be on, so it counts. Ground counts
 * for more because it is harder to get and it is what a crew is *for*.
 */
export const CREW_PER_FRONT = 2;

export const RANKS: RankDef[] = [
  {
    id: 'street_criminal',
    name: 'Street Criminal',
    blurb: 'Nobody knows your name. Nobody is looking for you either.',
  },
  {
    id: 'enforcer',
    name: 'Enforcer',
    blurb: 'People on the block know what happens when you show up.',
  },
  {
    id: 'crew_leader',
    name: 'Crew Leader',
    blurb: 'You give the orders now. The mistakes are yours too.',
  },
  {
    id: 'capo',
    name: 'Capo',
    blurb: 'A seat at the table, and everyone at it counting your earnings.',
  },
  {
    id: 'underboss',
    name: 'Underboss',
    blurb: 'Second in the room. First in the indictment.',
  },
  {
    id: 'boss',
    name: 'Boss',
    blurb: 'Your family. Your rules. Your problem when it goes wrong.',
  },
  {
    id: 'crime_lord',
    name: 'Crime Lord',
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
  /*
     The only attribute whose blurb has to say how to earn it.

     Every other one is trained by doing the obvious matching thing —
     shakedowns raise intimidation, complex jobs raise strategy — and a
     player works that out inside an hour. Influence is trained by keeping
     counsel on retainer and by going and talking to the other families,
     neither of which is a guess anybody makes.

     Round 15: "I could never find out how to raise Influence. It sat at
     0/20 for 190 days while gating the judge, city hall, and two of the
     four inside men. It eventually went to 7 through some mechanism I
     still cannot identify." That is the fourth round to circle this.
  */
  influence:
    'Pull with people who matter. Contacts, counsel, favours. Grows while you keep a lawyer on retainer, and every time you go and talk to another family.',
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
  /*
     Per week on a real retainer, scaled by how serious the firm is.

     This was 0.12, which against a cost curve of `3 + current * 1.6` put the
     patron's bar of 9 about thirteen years away. Four blind rounds never saw a
     player exceed 2, and round 13 kept the top tier at $5,863 a week for a
     career and finished at 0. The comment above this one already recorded one
     failed attempt to unwall this attribute; that attempt added the approach
     credit, and the approach is measured shut — see below.

     Sized against the 300-day window per HANDOFF section 5, not against the
     four-year probe. Measured over 36 careers, influence at day 300 as
     40th / median / 75th:

         0.12   0 / 0 / 3        the reported state
         1.2    2 / 3 / 6
         2.4    4 / 5 / 9        the door opens for the median career

     **Re-plotted after the heat work, and 2.4 no longer means what it meant.**
     Making decay a share of the load tripled what a family holds, so it keeps
     counsel for far more of the career, and the same rate paid out far more
     often. Counsel is 84% of all influence earned — measured by counting the
     calls, after two guesses at the source that were both wrong. At 2.4 the
     median reached 10 against a patron who wants 9, so the political vertical
     went from walled to free:

         2.4    8 / 10 / 14      city hall for nearly everybody
         1.4    8 /  9 / 11
         0.9    6 /  8 /  9      the shape above, restored
         0.7    6 /  7 /  8      median safer, but nobody reaches the patron
         0.5    6 /  6 /  8

     0.9 is the one that keeps both halves of the intent: the median career
     opens a door and still has to work for city hall, and the top quartile
     gets there. It sits exactly on the pre-committed ceiling of 8 with no
     margin, which is worth knowing the next time anything moves the economy.

     The response is shallow because `attributeProgressNeeded` is a rising
     curve — `3 + current * 1.6` — so raw training compresses hard at the top.
     Two and a half times the rate is two points of influence.

     All three re-measured under the final probe. An earlier version of this
     table was taken while the bot was also paying $25,000 courtesies, which
     moved the economy underneath it — the numbers here are the ones the
     shipped instrument produces.

     The pre-committed target in `ladder.probe` is a median of 4 to 8: the
     career that keeps counsel opens one political door and still has to work
     for city hall. The median lands on 5 and the top quartile reaches 9, so a
     career that invests hard in representation does get to city hall — which
     is the shape wanted, and is a distribution rather than a guarantee.

     **What this does not fix, and it is the larger half.** Both diplomatic
     routes are closed to an ordinary career, measured rather than assumed. The
     free demand is refused every time with "you lead them by -72 strength and
     would need 15 — or 55 standing, against 29", and the paid courtesy wants
     $25,000 spare in an economy where the bot is money-blocked in 97% of its
     idle weeks. So this number is carrying a vertical it should be sharing,
     and the consequence is that a boss who is never investigated keeps no
     lawyer and earns no pull at all. That is backwards and it is the next
     finding, not this one.
  */
  counselPerWeek: 0.9,
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
