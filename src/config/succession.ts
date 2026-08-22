/**
 * Succession: what happens to the organization when it stops being yours.
 *
 * Every number here answers one of three questions — who has a claim, what
 * naming an heir costs you while you are alive, and how much of what you built
 * survives the handover. No logic in this file.
 */

import type { RoleId } from '../sim/types';

// ------------------------------------------------------------- the claim ---

/**
 * What makes somebody a plausible boss.
 *
 * Deliberately not loyalty. Loyalty is how somebody feels about *you*, and you
 * are the one who is gone — the room is choosing who they will follow next.
 * The weights sum to 1 so a claim reads as a fraction, which is what makes two
 * claims comparable at all.
 */
export const CLAIM = {
  /** Where they sit in the organization. The single biggest term. */
  role: 0.4,
  /** Can they hold a room: leadership, with skill and nerve behind it. */
  standing: 0.28,
  /** What they have actually done. */
  record: 0.18,
  /** How long they have been here. Nobody follows a stranger. */
  tenure: 0.14,

  /** Ops counted before `record` is full. */
  recordFullAt: 25,
  /** Days counted before `tenure` is full. */
  tenureFullAt: 365,

  /**
   * Ambition gates the whole claim. A man with no wish to run anything is not
   * a candidate however senior he is — but the floor is not zero, because the
   * room can hand it to somebody who never asked.
   */
  willFloor: 0.35,

  /** Being the named heir. Large, and still not decisive on its own. */
  heirBonus: 0.22,

  /** Below this nobody in the room is a serious candidate. */
  seriousAt: 0.18,

  /** Lowest role that can be named heir at all. */
  minRole: 'soldier' as RoleId,

  /** Claim roll variance at the crisis — the room is not a spreadsheet. */
  variance: [0.82, 1.18] as [number, number],
} as const;

// ------------------------------------------------ naming an heir, in life ---

/**
 * Naming a successor is not free. You have told one man he is next and every
 * other senior man that he is not, and both of them heard you.
 */
export const NAMING = {
  /** The heir can suddenly see the top of the ladder. */
  heirAmbition: 10,
  heirRespectForBoss: 8,
  heirLoyalty: 5,
  /** Everyone senior enough to have hoped. */
  passedOverGrievance: 9,
  passedOverLoyalty: -4,
  /** Changing your mind is worse than never naming anyone. */
  demotedHeirGrievance: 22,
  demotedHeirLoyalty: -14,
} as const;

// ---------------------------------------------------------- the handover ---

/**
 * What survives. The organization continues, but a succession is the most
 * expensive week it will ever have — and it should be cheaper than starting
 * over, or naming an heir is just a slower death.
 */
export const HANDOVER = {
  /** Standing is personal. The new man inherits a fraction of it. */
  respectKept: 0.45,
  /*
     Lawyers, funerals, and the people who take their share on the way out.

     These were 0.7 and 0.55, and they were charging the organization for
     something that happened to a man. Measured across 36 careers: 19 of the 20
     that ended did so after a handover, a median of eight weeks later, and
     "broke and alone" was the leading ending by three to one. A family that
     hands over three times — which is the median — kept 34% of its clean money
     and 17% of its dirty across a career, and it was already living on less
     than one Friday.

     The line this now draws is between what the man had and what the family
     owns. Standing is his and stays at 0.45: nobody transfers a reputation.
     The money in the drawer is the organization's, and a boss dying should not
     empty it. Holdings were never touched by any of this, which is the same
     principle written down earlier and applied to only one of the three
     accounts.
  */
  cleanCashKept: 0.9,
  dirtyCashKept: 0.75,
  /** The name on the file is gone. Attention drops but does not vanish. */
  heatKept: 0.5,
  /**
   * ...unless the name came off the file because they were convicted.
   *
   * `heatKept` is the right rule for a chair that empties on its own: the
   * agencies were watching a man, the man is gone, and a successor should not
   * inherit the full weight of somebody else's work. Applied to *every*
   * removal, it made the state's own ultimate sanction the cheapest heat cure
   * in the game.
   *
   * Measured over twelve careers with a bot that never lays low: mean heat
   * 95.3, 85% of weeks above 90, the Bureau reaching trial in six careers and
   * convicting in nine — and four careers ending. A convicted boss handed over
   * at half the heat, keeping nine tenths of the money, the districts, and the
   * rank in 99 of 114 handovers. Round 10's tester found the other half of it
   * independently: laying low sheds 3.8 heat a day at 57 and 0.6 a day at 100,
   * so conviction was not merely the cheapest cure, it was close to the only
   * working one. There was no reason to manage heat, buy a contact, or care who
   * was informing.
   *
   * So a conviction keeps all of it. The city watched it happen. What does not
   * change is `caseStrengthKept` below — the convicted file closes in
   * `resolveTrial` regardless, and the *other* open cases genuinely did lose
   * the man they were built around, which is what that number is about.
   */
  heatKeptWhenConvicted: 1,
  /*
     Ground is held by presence, and presence just took a shock.

     0.78 across a median three handovers is 47% of every district gone by the
     end of a career, which is the same money argument in a different currency:
     the streets belong to the family, and the corner does not forget who has
     been collecting there because the man at the top changed. It still costs
     something, because a new boss does get tested.
  */
  influenceKept: 0.9,

  /** Open cases lose the man they were built around. */
  caseStrengthKept: 0.4,

  /**
   * Anyone this unconvinced by the new boss walks. Measured on respect for the
   * *predecessor* — the people who were here for you specifically.
   */
  walkOutLoyaltyBelow: 45,
  /** ...and even then it is a chance, not a rule. */
  walkOutChance: 0.55,
  /** A challenger who loses rarely stays to watch. */
  loserLeavesChance: 0.7,

  /**
   * However badly it goes, this many people stay.
   *
   * Measured across 36 careers once removals started handing over instead of
   * ending the run: 14 of the 20 careers that ended did so a median of four
   * weeks after a handover, and the handovers themselves read 13 people to 2,
   * 8 to 2, 6 to 1, 1 to 0. `checkGameOver` then fires on an empty room with
   * no money to hire with, so the walk-out was not a cost, it was a delayed
   * game over screen.
   *
   * The exodus is the right mechanic and it keeps its full rate above this
   * floor. What it may no longer do is leave nobody, because "leave something
   * behind that outlives you" is the thing the game is about and a boss who
   * inherits an empty room has inherited a countdown. The people who stay are
   * the most loyal, which is who would.
   *
   * This cannot save a family that was already one man — the winner becomes
   * the boss and the room behind him is genuinely empty. That ending is
   * honest and it still happens.
   */
  keepAtLeast: 2,

  /** How the room reads it. Rivals smell blood — they revise what you can do
   *  about them, which is not the same as deciding they dislike you. */
  rivalRespectHit: -14,
  /** The new boss starts one rung below the man he replaces. */
  ranksLost: 1,
} as const;

/**
 * The successor's attributes, derived from who he was as an NPC.
 *
 * Each player attribute is a weighted blend of hidden stats, scaled onto the
 * attribute scale. This is the payoff for the perception system: you have been
 * guessing at these numbers for years and now you have to live inside them.
 */
export const INHERITED_ATTRIBUTES: Record<string, Partial<Record<string, number>>> = {
  leadership: { leadership: 0.8, respectForBoss: 0.2 },
  intimidation: { courage: 0.6, skill: 0.4 },
  negotiation: { intelligence: 0.5, leadership: 0.5 },
  intelligence: { intelligence: 1 },
  streetSmarts: { skill: 0.6, discipline: 0.4 },
  business: { intelligence: 0.6, discipline: 0.4 },
  strategy: { intelligence: 0.5, discipline: 0.5 },
  influence: { leadership: 0.5, respectForBoss: 0.5 },
};

/** Stat 0..100 maps onto attribute 0..this. A 100 in nothing is still human. */
export const INHERITED_ATTRIBUTE_CEILING = 12;

// -------------------------------------------------------------- removal ---

/**
 * Getting older.
 *
 * `age` was rolled at generation and never touched again, so an organization
 * had no clock of its own: every crisis had to be caused by the player or by
 * an agency, and a man hired at fifty-eight was still fifty-eight after
 * fifteen years of measured play. Time passing is the cheapest source of
 * pressure a simulation has and this one was not using it.
 */
export const AGING = {
  /** Where the body starts arguing. Stats decline slowly past this. */
  declineFrom: 55,
  /** Points of skill and courage lost per year over the threshold. */
  skillPerYear: -0.9,
  couragePerYear: -0.7,
  /** ...and what is gained. Nobody gets old in this business by being stupid. */
  intelligencePerYear: 0.25,
  disciplinePerYear: 0.35,
  /** Ambition cools. A man of sixty-five rarely wants your chair. */
  ambitionPerYear: -1.2,

  /** Old men want out. Chance per year of asking, from the decline age. */
  retireFrom: 60,
  retireBase: 0.05,
  retirePerYear: 0.03,
  /** A man with a real position is harder to lose and harder to keep. */
  retireSeniorMultiplier: 0.6,

  /** And the other way out. Chance per year, from the same age. */
  deathFrom: 64,
  deathBase: 0.03,
  deathPerYear: 0.022,
} as const;

export const REMOVAL = {
  /**
   * Being killed in a war you are losing.
   *
   * Three gates, not one, and the first draft had only the last of them. At a
   * 7% roll on any heavy weekly defeat, a war lasting three months put the
   * player's life on the table a dozen times and killed them about a third of
   * the time — which quietly punished the only style of play that takes
   * ground, since holding ground is what starts wars in the first place.
   *
   * A decapitation should be how a war you were always losing finally ends,
   * not a lottery somebody runs at you every Sunday. So: you have to be
   * genuinely outmatched, the week has to be a rout, and it is still unlikely.
   */
  assassinationOutmatchedBelow: 0.6,
  assassinationMarginAbove: 0.6,
  assassinationChance: 0.03,
  /** Below this many people you have no bodyguard worth the name. */
  assassinationUnguardedBelow: 5,
  assassinationUnguardedMultiplier: 2.2,

  /** Years inside on a conviction, for the epitaph. */
  sentenceYears: [12, 25] as [number, number],
} as const;

/**
 * The room taking it off you.
 *
 * Everything above this is something done to the player from outside: an agency
 * that built a case, a family that won a war, or a body that got old. All three
 * are real, and none of them is reachable by the player who is careful — which
 * meant the entire generational half of this game sat behind a door most
 * careers never walk through. A boss who starts at thirty needs twenty-five
 * years of calendar before the aging clock can reach him.
 *
 * This is the door a young boss can open, and he opens it himself. It is caused
 * by exactly one thing: how you have treated the people who work for you.
 *
 * Three gates, deliberately mirroring the assassination roll rather than
 * inventing a new shape:
 *
 * 1. **Somebody wants it and does not think much of you.** Ambition alone is
 *    not a coup — half the organization is ambitious. It is ambition plus
 *    having stopped believing in the man in the chair.
 *
 * 2. **The room would let him.** A coup is not one man's decision. Enough of
 *    the senior people have to be carrying something themselves, or he is one
 *    man with a grievance and no support, which is a resignation.
 *
 * 3. **It is still unlikely in any given week.** Everything above can be true
 *    for a year without it happening, because the point is a standing risk you
 *    can see coming and reduce, not a die roll that ends careers.
 *
 * All three are readable in advance from the crew sheet — perceived ambition,
 * perceived regard, what men are carrying — which is what makes this the
 * longest-range use of the perception system in the game.
 */
export const DEPOSITION = {
  /** He has to want it. */
  ambitionAbove: 62,
  /** ...and to have stopped thinking much of you. */
  respectBelow: 34,
  /** ...and be carrying something. */
  grievanceAbove: 45,
  /** ...and be somebody the room would actually accept. */
  claimAbove: 0.34,

  /**
   * How many other senior men have to be disaffected before it is a room
   * rather than a man. Counted among everyone eligible to be an heir.
   */
  backersNeeded: 2,
  backerRespectBelow: 45,
  backerGrievanceAbove: 35,

  /** Rolled weekly once all of the above holds. */
  chancePerWeek: 0.035,
  /**
   * Doubled when the man who would take it is the one you named.
   *
   * Naming an heir is supposed to be a real decision with a real cost, and
   * until now the cost was entirely social. This is the other half: you have
   * told a man he gets it eventually, and made waiting the only thing between
   * him and it.
   */
  namedHeirMultiplier: 2,

  /**
   * How long before it happens the room stops being able to hide it.
   *
   * A coup you could not have seen coming is a coin flip with extra steps. Once
   * the conditions hold, the player gets told that something is being talked
   * about — not by whom — and has this long to do something about it.
   */
  rumourAfterWeeks: 3,
} as const;
