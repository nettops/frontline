/**
 * Diplomacy and war.
 *
 * War is not a separate state machine bolted onto relationships — it *is* the
 * bottom of the relationship scale. Two organizations are at war when they hate
 * each other enough, and peace is made by raising that number, not by flipping
 * a flag. That keeps one source of truth and means every existing thing that
 * moves relationships (taking ground, pressure, tribute, betrayal) can start or
 * end a war on its own.
 */

/**
 * What one organization holds toward another.
 *
 * Three dimensions rather than one number, because the single score conflated
 * things that are not the same and routinely disagree. A family can loathe you
 * and still take you seriously enough to negotiate properly. It can bear you no
 * ill will at all and take your ground because you are weak. It can have
 * nothing against you and still not sign anything, because the last person who
 * shook your hand regretted it.
 *
 * Each is written by a different set of events, which is what stops them being
 * three names for the same thing:
 *
 *   grudge   what they hold against you  — harm they attribute to you, decays
 *   respect  whether you are taken seriously — strength, wins, beating a case
 *   trust    whether a deal with you holds — kept peace, honoured alliances
 *
 * War is no longer the bottom of the grudge scale. It is a date, because it is
 * a decision — the old model spent a long comment apologising for the fact
 * that accumulated resentment kept tipping organizations into wars nobody had
 * chosen to start, and then clamped its way around the problem.
 */
export const BOND = {
  /**
   * How the dimensions collapse into the single "how do they feel about us"
   * figure the UI shows and the AI's coarser judgements read.
   *
   * Respect is deliberately *not* in it. That was the first version and it was
   * the same conflation this refactor exists to remove: respect is an
   * assessment, not a feeling, and folding it in made a family you had never
   * crossed read as warm toward you simply because it was strong. It is read
   * directly by the things that actually care — whether a demand lands,
   * whether they will negotiate seriously, how much of a lead they want before
   * starting something.
   *
   * The two that remain are 1:1 on purpose. Standing is simply trust minus
   * grudge, so a signed nudge through `adjustRelationship` moves the derived
   * figure by exactly what it used to move the single score by — which means
   * every threshold in this game still means what it was tuned to mean, and
   * this refactor is not a rebalance wearing a disguise.
   */
  weightTrust: 1,
  weightGrudge: 1,

  /** Weekly fade, when nothing is feeding them. */
  /**
   * Deliberately the old RELATIONSHIP_RECOVERY_PER_WEEK to the decimal. A
   * grudge fading is the same process the single score's drift back toward
   * indifference used to be, and changing its speed while restructuring the
   * model would have been a rebalance smuggled in as a refactor. Measured: at
   * 0.55 it cut wars between the families from 19 worlds in 24 to 4.
   */
  grudgeDecayPerWeek: 0.4,
  trustDecayPerWeek: 0.15,

  /** Trust earned per week of peace with somebody. Slow: it is earned. */
  trustPerPeacefulWeek: 0.22,
  /** ...and per week of an alliance that is actually holding. */
  trustPerAlliedWeek: 0.5,

  /**
   * Being taken seriously.
   *
   * Respect tracks what you can actually do, so it is recomputed toward a
   * target each week rather than accumulated — an organization that was
   * frightening in 1978 and is four men in 1985 does not keep the reputation.
   */
  respectFromStrength: 0.6,
  respectFromDistricts: 4,
  /**
   * ...and having been looked at and walked away from it.
   *
   * The third term this comment always claimed was here. Strength and ground
   * are both the war player's axis, so a career that ran fronts, kept quiet
   * and never fought could not move a rival's opinion of it at all — the best
   * respect any of thirty-six careers ever reached was 29, 29 and 31 at the
   * 40th, median and 75th, which is not a distribution, it is a constant with
   * noise on it.
   *
   * Capped, because a boss who has beaten nine cases is a boss the other
   * families have been watching get investigated nine times, and there is a
   * point past which that stops being impressive.
   */
  respectFromCaseBeaten: 5,
  respectFromCasesCap: 20,
  /**
   * ...and what the street says about you, which is the only continuous term.
   *
   * Districts move in whole numbers and cases move in whole numbers, so a
   * target built only from those lands on the same handful of values for most
   * careers: the measured distribution was 27 / 27 / 36 and a bar at 28 caught
   * thirteen careers while a bar at 27 caught all thirty-six. That is a cliff,
   * not a threshold, and no number placed on it is a decision.
   *
   * `org.respect` is standing — what people will do for you because they want
   * to — and it moves a point at a time. A family reading the street to decide
   * how seriously to take somebody is the plainest possible reading of the
   * word this field is named after.
   */
  respectFromStanding: 0.04,
  /**
   * How fast respect walks toward that target.
   *
   * Was 1.4, which is twenty-one weeks to cross the twenty-nine points between
   * nothing and the demand-tribute bar. A career that takes its fifth district
   * on day 200 therefore never arrives, and the probe duly reported the door
   * open in twelve careers out of thirty-six while the *target* was met by
   * half of them. A quantity that cannot reach its own target inside the
   * horizon a person plays is the same defect as a bar set above the range.
   *
   * 2.6 crosses it in a season, which is the pace the rest of this file works
   * at — `driftPerWeek` in the civic network, the sentiment recovery, the
   * grudge decay.
   */
  respectSettlePerWeek: 2.6,

  /** Alliance needs somebody you can rely on, not merely somebody you like. */
  allianceTrust: 40,
  allianceStanding: 55,

  /**
   * Grudge a family needs before it will start a war.
   *
   * Gated on the grudge rather than on the blended standing, which is the
   * point of having separated them: an organization goes to war over a
   * grievance, not because an average came out low. It also fixes a real
   * regression this refactor introduced — peace now *earns* trust every week,
   * which lifts the blended figure and quietly pushed families away from the
   * war threshold no matter how much they had against each other.
   */
  warGrudge: 45,

  /**
   * Betrayal.
   *
   * The one thing the old single score could not represent at all, and the
   * reason this refactor was worth doing. Starting a war on somebody you were
   * at peace with costs you trust with *everybody who saw it* — a reputation
   * for treachery is a thing you carry around the whole board, and it is why
   * nobody will sign anything with you two years later.
   */
  betrayalTrust: -45,
  betrayalWitnessTrust: -18,
  /** Refusing an ally who asked for help. Same idea, smaller. */
  letDownTrust: -25,
} as const;

/**
 * Derived standing at or below this and the two of them are enemies.
 *
 * No longer the definition of war — see `Faction.bonds[].warSince` — but still
 * the point at which the relationship reads as hostile, and still the gate the
 * rival AI uses before it will consider declaring one.
 */
export const AT_WAR_BELOW = -70;

/** Grudge a war leaves behind when peace is made. Nobody forgets. */
export const PEACE_GRUDGE = 52;

// ------------------------------------------------------------------- war ---

export const WAR = {
  /** How much of the strength difference decides a weekly clash. */
  clashVariance: [0.7, 1.3] as [number, number],
  /** Holding the ground you are fighting over is worth this much. */
  homeAdvantage: 1.2,

  /** Strength a losing rival sheds per clash, scaled by the margin. */
  rivalCasualties: [3, 11] as [number, number],
  /** Strength recovered per quiet week once a war ends. */
  rivalRecoveryPerWeek: 1.2,

  /** Crew hurt when the player loses a clash. */
  playerInjured: [1, 2] as [number, number],
  playerInjuryDays: [10, 35] as [number, number],
  /** Chance a losing clash kills somebody outright rather than hurting them. */
  fatalityChance: 0.1,

  /** Influence the winner takes in a district both sides stand in. */
  territorySwing: [2, 5] as [number, number],

  /** Weekly cost of keeping people armed and moving. */
  playerWarCostPerCrew: 120,
  rivalWarCost: 45_000,

  /** War is loud. Every clash feeds heat and the evidence pile. */
  heatPerClash: 6,
  evidencePerClash: 9,

  /** Losses accumulate into weariness, which makes peace attractive. */
  wearinessPerLoss: 8,
  /**
   * ...to a point. Every consumer of weariness clamps it, so an uncapped
   * counter only makes the signal saturate: measured at 911 in a six-year war,
   * by which stage "took two bad months" and "has been destroyed for a decade"
   * were the same number to everything that reads it.
   */
  wearinessMax: 120,
  wearinessDecayPerWeek: 1.5,
  /** Above this a faction actively wants out. */
  wearinessSuesForPeace: 45,
};

/**
 * Allies turning up.
 *
 * The alliance offer has always promised they "will come in on your side
 * against a common enemy", and for a long time the only thing behind that
 * sentence was a relationship adjustment. An alliance you cannot feel in a
 * fight is not an alliance, it is a colour on a screen.
 *
 * Two tiers, because there are two different things an ally can be. One who is
 * in the war lends most of what they have and bleeds for it. One who is merely
 * your friend sends quieter help — men, money, somewhere to keep things — which
 * costs them nothing directly and costs them plenty indirectly, because the
 * other side notices and remembers.
 *
 * That second tier is the interesting one: it is how a two-way war becomes a
 * four-way war without anybody deciding to make it one.
 */
export const ALLIANCE = {
  /** Share of their strength an ally already in the war brings to a clash. */
  committedShare: 0.4,
  /** Share sent by an ally who is not in the war and would rather stay out. */
  quietShare: 0.16,
  /**
   * Share of the losing side's damage a committed ally absorbs instead of the
   * principal. Being in a war means taking some of the beating.
   */
  casualtyShare: 0.45,
  /** What being seen helping costs a quiet ally with the other side. */
  quietHelpRelationship: -7,
  /** Too tired to be any use to anybody. */
  wearinessStaysHome: 55,
  /** An ally fighting a war of their own has less to spare for yours. */
  stretchedShare: 0.5,
};

// ------------------------------------------------- player diplomatic acts ---

export type DiplomaticActionId =
  | 'sue_for_peace'
  | 'offer_tribute'
  | 'demand_tribute'
  | 'propose_alliance'
  | 'declare_war';

export interface DiplomaticActionDef {
  id: DiplomaticActionId;
  name: string;
  blurb: string;
  /** Base cost; several scale with the target's wealth or your standing. */
  cost: number;
  /** Relationship needed before the other side will even hear it. */
  minRelationship: number;
  /** Only offered when you are at war (or specifically not at war). */
  requiresWar: boolean | null;
}

export const DIPLOMATIC_ACTIONS: DiplomaticActionDef[] = [
  {
    id: 'sue_for_peace',
    name: 'Sue for peace',
    blurb:
      'Send somebody they respect to say it has gone far enough. Costs money and standing, and works better when they are tired of it too.',
    cost: 60_000,
    minRelationship: -100,
    requiresWar: true,
  },
  {
    id: 'offer_tribute',
    name: 'Offer a tribute',
    blurb: 'Money, framed as respect. The cheapest way to make somebody less interested in you.',
    cost: 25_000,
    minRelationship: -69,
    requiresWar: false,
  },
  {
    id: 'demand_tribute',
    name: 'Demand a tribute',
    blurb:
      'Ask them to acknowledge you in cash. They pay if you are clearly stronger, and resent it either way.',
    cost: 0,
    minRelationship: -100,
    requiresWar: false,
  },
  {
    id: 'propose_alliance',
    name: 'Propose an alliance',
    blurb:
      'A standing arrangement. They stop taking your districts, and will come in on your side against a common enemy.',
    /*
       Was $100,000 against a relationship of 40, and **open in zero careers
       out of thirty-six**.

       Two walls stacked, both sized for a career that has already succeeded.
       `ladder.probe` measures the best standing any family ever reaches at
       9 / 20 / 22 for the 40th, median and 75th, and the best estate a career
       ever holds at day 300 at a median of $28,870. Forty was above the range
       of the quantity; a hundred thousand was above the range of the wallet.
       Round 13 read this screen four times and wrote *"I never found anything
       on it I could press"*.

       Sized the way `config/economy.ts` sizes the rank table: standing just
       under the 75th of the measured distribution — 9 / 9 / 21 for the 40th,
       median and 75th — which makes it the top quarter of careers on the axis
       the action is actually about. At 22 it was open in one career out of
       thirty-six, which is dead content wearing a button. The money comes down to something the same careers
       can hold, so there is **one** gate rather than three — an alliance
       should be a thing you have earned with the other family, not a thing you
       have earned with the other family and also happen to be rich enough for.
    */
    cost: 15_000,
    minRelationship: 20,
    requiresWar: false,
  },
  {
    id: 'declare_war',
    name: 'Declare war',
    blurb: 'Say it plainly and start it on your terms rather than theirs.',
    cost: 0,
    minRelationship: -100,
    requiresWar: false,
  },
];

export const DIPLOMATIC_ACTION_BY_ID: Record<DiplomaticActionId, DiplomaticActionDef> =
  Object.fromEntries(DIPLOMATIC_ACTIONS.map((a) => [a.id, a])) as Record<
    DiplomaticActionId,
    DiplomaticActionDef
  >;

export const DIPLOMACY = {
  /** Negotiation buys this much success chance per point. */
  negotiationPerPoint: 0.025,
  /** Base chance a peace offer is accepted before everything else. */
  peaceBaseChance: 0.3,
  /** Their weariness makes them far more willing. */
  peacePerWeariness: 0.008,
  /** Being clearly stronger than them helps too. */
  peacePerStrengthLead: 0.004,

  /** Relationship bought per dollar of tribute, and the ceiling on it. */
  tributeRelationshipPer10k: 6,
  tributeMaxRelationship: 30,

  /** Demanding tribute: what they pay, as a share of their wealth. */
  demandShare: 0.06,
  demandRelationshipHit: -18,
  /** Strength lead needed before they take the demand seriously. */
  demandStrengthLead: 15,
  /**
   * ...or enough standing that they do not need to be shown.
   *
   * This is what respect is for. An organization that has beaten a case,
   * survived a war and holds half the city does not have to prove the point
   * every time it asks for something, and one that has never done anything
   * does — even at the same headcount.
   */
  /*
     Was 55, and reachable in two careers out of thirty-six.

     Three things were wrong and the first two hid the third.

     `ladder.probe` had never looked at this quantity, so nobody knew that the
     best respect any family holds for a player runs 27 / 35 / 44 across the
     population. The bar sat above the 75th of a distribution nobody had
     plotted.

     The distribution itself was nearly flat — 29 / 29 / 31 before the two
     repairs below — because the target respect settles toward was built only
     from strength and districts, both of which are the war player's axis and
     both of which move in whole numbers. A career that ran fronts and kept
     quiet could not move it at all, and no bar on a constant is a decision.

     And `STARTING_RESPECT_FOR` is **30**. Every family begins with that much
     respect for a boss who has done nothing, so any bar under thirty opens the
     door on the first morning — which is what a bar of 28 did, and what
     `diplomacy.test.ts` caught within the minute.

     35 is the median of the measured distribution — 32 / 35 / 48 — and sits
     above the starting 30, so it is a thing a career earns back after the
     opening months rather than a thing it is handed. The lower end of the
     sanctioned band on purpose, for the same reason the police captain's bar
     is: **this is the only door a career that never goes to war has.** At the
     75th it was open in thirteen careers out of thirty-six, which is a door
     for the quarter of players who least need one. The
     other way over — being clearly stronger — stays at 15: the median career
     trails the families it is talking to by forty, and that route is meant to
     be the hard one.
  */
  demandRespect: 35,

  /**
   * Peace is a promise, and they price it on whether your promises hold.
   *
   * Weariness gets them to the table; trust decides whether they believe
   * anything said at it. A player who has broken a peace before finds the next
   * one very expensive — which is the whole point of tracking it separately.
   */
  peacePerTrust: 0.004,

  allianceRelationship: 25,

  /**
   * Turning down an offer of terms. They stop asking for a while — weariness
   * is what made them ask — and the street reads refusing a war you are in as
   * confidence, whether or not it is.
   */
  refusedPeaceWeariness: 18,
  refusedPeaceRespect: 5,

  declareWarRespect: 6,
};

// ------------------------------------------------------------- poaching ---

/**
 * Rivals recruiting the player's people. This is what the loyalty drift system
 * has been building toward since Phase 3 — an unhappy man is not just a risk of
 * leaving, he is somebody else's opportunity.
 */
export const POACH = {
  /** They only approach people who are already unhappy. */
  loyaltyBelow: 45,
  /** What it costs a rival to make the approach. */
  cost: 60_000,
  /** Chance the approach works, before loyalty and pay are considered. */
  baseChance: 0.22,
  /** Every point of loyalty below the threshold makes it likelier. */
  perLoyaltyPoint: 0.012,
  /** Taking somebody's man is an insult. */
  relationshipHit: -12,
  /** Evidence: a man who changes sides knows things about both. */
  evidenceStrength: 14,
  /** How much loyalty the approach buys back when he says no and tells you. */
  refusedLoyalty: 12,
};
