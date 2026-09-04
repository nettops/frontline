/**
 * Money, wages and rank progression.
 * Tune the game's pacing here — no logic in this file.
 *
 * The figures themselves live in `tuning/economy.json` so they can be changed
 * without a TypeScript toolchain. What stays here is everything JSON cannot
 * carry: the shapes, the labels, the ordering that encodes authority, and the
 * long reasons — most of this file is the record of what a number used to be
 * and what measurement did to it, which is the part worth reading before
 * changing one.
 */

import type { AttributeId, Attributes, RankId, RoleId } from '../sim/types';
import { checkIds } from './tuning/check';
import data from './tuning/economy.json';

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
  /**
   * Fear bleeds off if you stop reminding people, as a share of what is there.
   *
   * **Was 1.4 a week, flat, and flat was the defect.** A constant drain has no
   * settling point: any sustained positive income climbs to the ceiling and
   * any deficit falls to zero, so the level a family lives at is decided by
   * the sign of a subtraction rather than by how hard it is working. A share
   * settles where the weekly income matches it, which is what makes "how
   * frightening are you" a readable consequence of how you play.
   *
   * The same repair `config/heat.ts` made for heat decay, and the note there
   * about why a flat rate is wrong applies here word for word.
   *
   *     settled level = weekly income / decayShare
   *
   * At 0.08 a family running every job loud settles near 75, and one picking
   * its moments settles near 8. That gap is the design: being feared is a way
   * of running a family, not a garnish.
   */
  decayShare: data.fear.decayShare,
  /** Ceiling, on the same scale as heat. */
  max: data.fear.max,

  /** What violence buys, per act. */
  fromViolence: data.fear.fromViolence,
  fromWarClash: data.fear.fromWarClash,
  fromIntimidation: data.fear.fromIntimidation,
  /**
   * What a public failure costs. Being feared is a claim; failing tests it.
   *
   * **Was -3 and charged on every failed job, and both halves were wrong.**
   *
   * Measured, the first time this project ever looked: fear is granted +2 only
   * when a *loud* job succeeds and taken away 3 whenever *any* job fails, so
   * the break-even success rate was
   *
   *     loss / (gain + loss) = 3 / (2 + 3) = 60%
   *
   * and the work actually runs at **52% heavy, 58% straight**. Every career in
   * this game was below the line. Fear did not accumulate slowly; it drained,
   * always, for everybody, which is why 36 careers of 36 peaked at 11 and
   * ended at 2 and why an arm that ran every job heavy for 300 days still only
   * reached 34 of 100.
   *
   * Worse, the asymmetry made selective use impossible in principle: the gain
   * counted loud jobs and the loss counted all of them, so a family running
   * one loud job a week paid the penalty on the nine quiet failures beside it.
   *
   * So: -2, and only on jobs actually run loud. Break-even falls to
   * 2 / (3 + 2) = 40%, comfortably under where the work runs. The idea in the
   * sentence above is kept and is the reason this is not simply deleted — a
   * loud job that goes wrong in front of everybody really is the claim being
   * tested. A quiet burglary going wrong is not.
   */
  onFailure: data.fear.onFailure,

  /** Fear suppresses defection: multiplier on the weekly chance, at maximum. */
  defectionAtMax: data.fear.defectionAtMax,
  /** ...and adds to witness pressure and shakedown success. */
  witnessBonusAtMax: data.fear.witnessBonusAtMax,
  /** But frightened people are not loyal people. Loyalty drift, at maximum. */
  loyaltyPerWeekAtMax: data.fear.loyaltyPerWeekAtMax,
  /** Sentiment across districts you hold, per week at maximum. */
  sentimentPerWeekAtMax: data.fear.sentimentPerWeekAtMax,
  /** Recruits are harder to find when the job is frightening. */
  recruitCostAtMax: data.fear.recruitCostAtMax,
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
export const STANDING_HELD = data.standingHeld;

export const STARTING_CASH = data.starting.cash;
export const STARTING_DIRTY_CASH = data.starting.dirtyCash;
export const STARTING_RESPECT = data.starting.respect;
export const STARTING_FEAR = data.starting.fear;

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
  minimum: data.holdings.minimum,
  /** What you get back per dollar when you sell in a hurry. */
  withdrawReturn: data.holdings.withdrawReturn,
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
  yieldPerWeek: data.holdings.yieldPerWeek,
} as const;

export const PAYDAY_INTERVAL = data.paydayInterval;

/**
 * Length of a year, for everything that happens annually.
 *
 * The calendar in util.ts is real, so this is a working approximation rather
 * than an astronomical one — nothing in the simulation cares about a leap day,
 * and a fixed number keeps the yearly tick reachable from day % YEAR === 0.
 */
export const DAYS_PER_YEAR = data.daysPerYear;

/** Weekly wage by role. Underpaying a greedy NPC erodes loyalty fast. */
/**
 * The most anybody is ever paid for a job, as a multiple of the going rate.
 *
 * Was a bare `* 4` inside the clamp in `setWage`, which meant nothing outside
 * that function could ask where the ceiling was — and the UI, unable to ask,
 * offered a raise that could not happen and charged the man grievance for it.
 */
export const WAGE_CEILING_MULTIPLE = data.wageCeilingMultiple;

export const ROLE_WAGE: Record<RoleId, number> = data.roleWage;

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
export const RECRUIT_COST = data.recruitCost;

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
export const MISSED_PAY_LOYALTY_HIT = data.missedPayLoyaltyHit;
export const MISSED_PAY_GRIEVANCE = data.missedPayGrievance;

/**
 * How short a week has to be before a man files it as a thing that happened to
 * him rather than a bad week.
 *
 * Memories do not fade for years and are read by every later decision about
 * whether to walk, so writing one for a payday that was 95% covered would make
 * a rounding error permanent.
 */
export const UNPAID_MEMORY_THRESHOLD = data.unpaidMemoryThreshold;

/** Goodwill returned per man when back wages are finally cleared. */
export const ARREARS_CLEARED_LOYALTY = data.arrearsClearedLoyalty;

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
  /**
   * What the organization has to be for this to be what people call you.
   *
   * Read against the same `OpsBoard` the job table gates on, deliberately, so
   * that what you are called and what you are allowed to do can never
   * disagree. A rank derived from one set of facts and a ladder gated on
   * another is how the old `requires` field went wrong twice.
   *
   * Absent on the first rung, which is where everybody starts.
   */
  needs?: {
    /** Districts held at Control or better — the slow signal. */
    districtsControlled?: number;
    fronts?: number;
    crew?: number;
    /** Favours owed to you across every civic figure. */
    owedTotal?: number;
    /** Best trust any surviving rival family holds toward you. */
    bestRivalTrust?: number;
  };
}

/**
 * How many people the outfit can hold: a base, plus this for every district.
 *
 * Replaces `RankDef.maxCrew`. See `maxCrew` in `sim/player.ts` for the arrival
 * curves these were sized against — the point was to land on the old ladder's
 * shape at the same days rather than to change what a career can afford.
 */
export const CREW_BASE = data.crew.base;
export const CREW_PER_DISTRICT = data.crew.perDistrict;
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
export const CREW_PER_FRONT = data.crew.perFront;

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
    /*
       Deliberately cheap, and reachable inside the first month.

       Round 16 had three testers play 120 days and finish on the rung they
       started on, because nothing in the game ever moved it. The first move
       has to arrive while a player is still forming the idea that moving is
       possible — so this asks for a crew and somewhere to put them, which is
       what the opening twenty days are about anyway.
    */
    needs: { crew: 4, fronts: 1 },
  },
  {
    id: 'crew_leader',
    name: 'Crew Leader',
    blurb: 'You give the orders now. The mistakes are yours too.',
    needs: { districtsControlled: 1, fronts: 2, crew: 6 },
  },
  {
    id: 'capo',
    name: 'Capo',
    blurb: 'A seat at the table, and everyone at it counting your earnings.',
    /*
       Sized against measured careers rather than against a feeling.

       `districtsControlled` reaches a median of two at day 210 over 24
       careers, and round 16's three testers were at two or three by day 120 —
       so this is a rung a good hundred-day career reaches and a slow one does
       not, which is the distribution a middle rung should have.
    */
    needs: { districtsControlled: 2, fronts: 3, crew: 9 },
  },
  {
    id: 'underboss',
    name: 'Underboss',
    blurb: 'Second in the room. First in the indictment.',
    /*
       The first rung that asks for something other than growth.

       Everything below is more — more ground, more shops, more people. From
       here it wants somebody outside the family to owe you, because that is
       what the top half of this game is actually about and a ladder made only
       of quantities would never say so.
    */
    needs: { districtsControlled: 3, fronts: 5, crew: 13, owedTotal: 1 },
  },
  {
    id: 'boss',
    name: 'Boss',
    blurb: 'Your family. Your rules. Your problem when it goes wrong.',
    needs: { districtsControlled: 4, fronts: 7, crew: 18, owedTotal: 2 },
  },
  {
    id: 'crime_lord',
    name: 'Crime Lord',
    blurb: 'Cities move around you. So do task forces.',
    /*
       The only rung that needs a rival to think well of you.

       `districtsControlled` never reached four in 24 measured careers, so this
       is deliberately beyond what has been observed — a rung that exists to be
       visible from below rather than to be commonly reached. The trust term is
       what stops it being purely a matter of outlasting everybody.
    */
    needs: { districtsControlled: 5, fronts: 9, crew: 24, owedTotal: 3, bestRivalTrust: 55 },
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

export const STARTING_ATTRIBUTES: Attributes = data.startingAttributes;

export const ATTRIBUTE_MAX = data.attributeMax;

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
  counselPerWeek: data.influenceFrom.counselPerWeek,
  /** Per diplomatic approach that is made and paid for, refused or not. */
  approach: data.influenceFrom.approach,
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
  approachCooldownDays: data.influenceFrom.approachCooldownDays,
};

/**
 * Attributes improve by use. Each successful use adds progress; progress
 * needed per point scales with the current value, so 3→4 is quick and
 * 15→16 is a grind.
 */
export function attributeProgressNeeded(current: number): number {
  return data.attributeProgress.base + current * data.attributeProgress.perPoint;
}

/*
   The ids in the JSON must be the ids the types name.

   `resolveJsonModule` checks every shape in `tuning/economy.json` against the
   declarations above — a missing key or a number written as a string fails the
   build. What it cannot check is that `"soldeir"` is not a `RoleId`, because an
   imported JSON key is a `string`. These two calls are that check, and they run
   last because they read the id lists declared throughout this file.
*/
checkIds('tuning/economy.json', 'role', Object.keys(data.roleWage), ROLE_ORDER);
checkIds('tuning/economy.json', 'attribute', Object.keys(data.startingAttributes), ATTRIBUTE_IDS);
