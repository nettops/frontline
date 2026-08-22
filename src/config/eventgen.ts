/**
 * Memos the simulation writes for itself.
 *
 * Round 14's second MUST FIX: *"The memo pool exhausts, and after Capo it is
 * the only source of new content. Between day 180 and day 300 I met exactly
 * one memo I had not seen before."* There are 22 authored events. Twenty-two
 * is a good number of well-written scenes and a hopeless number of
 * situations for a three-hundred-day game, and no amount of writing fixes
 * that — a twenty-third would be met once and then never again either.
 *
 * The supply problem is not that there are too few *shapes*. It is that a
 * shape is met once and then recognised. So the shapes below are deliberately
 * ordinary — a man wants a word, two of your people are not speaking, a front
 * is going under, a street is turning, somebody outside wants something, a
 * file is moving — and every one of them is instantiated against a real
 * subject drawn out of the state. Twenty men, eight districts, however many
 * fronts and four figures is a very large number of situations out of six
 * scenes, and it grows as the family does, which is the half of the game that
 * currently goes quiet.
 *
 * This is the same trick `whispers.ts` plays and it is the reason that system
 * measured healthy on its first contact with an instrument: the supply is the
 * simulation rather than a list somebody wrote.
 *
 * **These are not new mechanics.** Every outcome below moves a number some
 * existing system already owns — grievance, a tie, a front's health, a
 * district's feeling, civic standing, the lay-low timer. Nothing here is a
 * subsystem; it is the existing simulation given a mouth.
 */

/**
 * The chance of a generated memo on a day the authored pool produced nothing.
 *
 * A second, smaller roll rather than a share of the first. The two halves used
 * to draw from one table and there is only one memo slot a day, so every
 * generated memo cost an authored one: `scorecard.probe` measured Pacing
 * falling from 3.8 to 2.4, because the authored events are what carry a
 * career's firsts. Dropping the generated weights fixed the pacing and left
 * the generator supplying 15% of the new situations in a career's back half,
 * which is not worth having built.
 *
 * At 0.11 against the authored 0.16 this is roughly one generated memo every
 * nine days on the days the pool is empty — and by day 180 the pool is empty
 * most days, which is the whole of round 14's complaint.
 *
 * Measured across the rates that were tried, on 36 careers of 300 days and 12
 * of 1460:
 *
 *     rate    Pacing   generator's share of late situations
 *     0.07     3.0                27%
 *     0.11     3.3                28%
 *
 * The share plateaus because the authored pool also produces new situations in
 * the back half — the same memo about a different man is a different
 * situation, for them as much as for these. More volume does not buy much more
 * novelty, so the rate is set where it stops paying rather than pushed until a
 * number goes green.
 */
export const GEN_CHANCE_PER_DAY = 0.11;

/** Which part of the world a shape needs before it can be raised. */
export type GenSubject =
  | 'crew'
  | 'pair'
  | 'business'
  | 'district'
  | 'civic'
  | 'case'
  | 'home';

export interface GenShapeDef {
  id: string;
  subject: GenSubject;
  /**
   * Weight against the 22 authored events.
   *
   * Deliberately below the loudest authored ones. The authored memos are
   * better written and carry the set pieces; these are the texture between
   * them, and a generated memo crowding out `plea_offer` would be a bad trade.
   */
  weight: number;
  /**
   * Days before this shape can be raised again.
   *
   * Short compared to the authored events, because a repeat of the same shape
   * against a different subject is a different situation. Long enough that
   * the same shape does not arrive twice in a week.
   */
  cooldownDays: number;
}

export const GEN_SHAPES: GenShapeDef[] = [
  { id: 'gen_wants_a_word', subject: 'crew', weight: 6, cooldownDays: 9 },
  { id: 'gen_bad_blood', subject: 'pair', weight: 5, cooldownDays: 11 },
  { id: 'gen_front_trouble', subject: 'business', weight: 5, cooldownDays: 9 },
  { id: 'gen_street_turning', subject: 'district', weight: 5, cooldownDays: 11 },
  { id: 'gen_someone_outside', subject: 'civic', weight: 4, cooldownDays: 13 },
  { id: 'gen_paper_moving', subject: 'case', weight: 5, cooldownDays: 10 },
  /*
     The one shape that is not about the business.

     `config/personal.ts` argues that a pull toward home has to *arrive* rather
     than sit on a panel accruing a penalty while the player looks at other
     screens — a number that quietly costs you is a tax, and a memo with a name
     in it on a week when something else also wanted doing is a decision. This
     is the surface that layer lives on.
  */
  { id: 'gen_somebody_inside', subject: 'crew', weight: 6, cooldownDays: 8 },
  { id: 'gen_the_take_is_short', subject: 'district', weight: 5, cooldownDays: 10 },
  { id: 'gen_a_name_came_up', subject: 'crew', weight: 5, cooldownDays: 9 },
  /*
     Rarer than the rest, and a month apart, because it is the only shape whose
     subject is always there.

     The other six need a man who is aggrieved, a front that is failing, a
     street that has turned — states that come and go. The house is permanent,
     so at the same weight as the others this shape made the generated draw
     stop ever coming up empty and total memo volume rose with it.
     `scorecard.probe` measured Pacing falling from 3.1 to 2.2, with the
     longest stretch between firsts growing by 168 days. At weight 2 and a
     month's cooldown it is 3.3.
  */
  { id: 'gen_asked_for_you', subject: 'home', weight: 2, cooldownDays: 30 },
];

/**
 * The bars a subject has to clear before it is worth a memo.
 *
 * Every one of these is a state the player is already in and currently has to
 * find by reading a panel. The memo does not create the problem; it walks it
 * into the room.
 */
export const GEN_WHEN = {
  /**
   * Aggrieved enough to come and say so.
   *
   * 55 rather than 45, and the five points matter for a reason that has
   * nothing to do with this file. The crew-sheet tip about a man carrying a
   * grievance fires at 55 — so a memo that intercepted him at 45 and took the
   * edge off meant nobody ever reached the tip's bar, and `tips.reach` found
   * the advice had become unreachable. A system that quietly eats the state
   * another system warns about is worse than either of them alone.
   *
   * Sitting on the same bar means the warning gets its day first, and the memo
   * is what happens next.
   */
  grievance: 50,
  /** Or unhappy enough that it amounts to the same conversation. */
  loyaltyUnder: 40,
  /** Two of your people who genuinely cannot be in a room together. */
  resentment: 55,
  /** A front that is not going to last the year at this rate. */
  frontHealthUnder: 45,
  /** Or one that has become interesting to read about. */
  frontExposureOver: 60,
  /** A street where you work and are no longer welcome. */
  sentimentUnder: 35,
  /** You have to be actually working there for the feeling to be your problem. */
  districtInfluence: 15,
  /** A file with enough in it to be worth telling you about. */
  caseStrength: 30,
  /** A steward whose district has been quietly earning him more than you. */
  skimmed: 2_000,
  /** A whisper somebody has now brought you twice. */
  corroboratedConfidence: 55,
  /**
   * How long the house has to have noticed before anybody says anything.
   *
   * The same number as `HOME.depositionFrom`, which is where being away starts
   * to cost the boss anything — so the memo arrives exactly when it begins to
   * matter and not before.
   *
   * It was four weeks first, and four weeks is *always* true after the first
   * month: the shape became a standing candidate, the generated draw stopped
   * ever coming up empty, and total memo volume rose enough that
   * `scorecard.probe` put Pacing back under its floor at 2.5. A shape that is
   * permanently eligible is not an event, it is a subscription.
   */
  neglect: 45,
} as const;

/**
 * What each answer moves, and by how much.
 *
 * Sized against what the existing memos do rather than invented: the authored
 * grievance memo moves loyalty by 6 and grievance by 12, and these sit in the
 * same range so a generated memo cannot outweigh a written one.
 */
export const GEN_EFFECT = {
  /**
   * Hearing somebody out costs nothing and is worth something.
   *
   * It was worth -14 of grievance, and that was too much for a free answer.
   * Two other files caught it before any human could: `informants.probe` found
   * two worlds in thirty where nobody ever talked, and `tips.reach` found the
   * grievance tip had become unreachable — a crew whose resentment can be
   * wiped by listening is a crew that never produces an informant and never
   * needs the advice about one.
   *
   * Listening is not settling, and in the end it does not move the grievance
   * at all. Shaving even six off it was enough: the memo also fires on low
   * loyalty, so a disaffected man met it again and again and his grievance was
   * held permanently below the bar the crew-sheet tip watches. `tips.reach`
   * reported that advice as unreachable, which is F10's shape — a good thing
   * nobody can get to.
   *
   * It is not worth loyalty either. A free answer arriving every nine days
   * that adds loyalty to whoever is unhappiest is a faucet: `informants.probe`
   * watched worlds where nobody ever talked start appearing, because a crew
   * that can be made content for nothing does not produce informants. Being
   * heard is worth `respectForBoss` — they think better of you — and the thing
   * they are actually aggrieved about is still true tomorrow. Paying settles
   * it, and paying costs money. That is the trade.
   */
  heardLoyalty: 0,
  heardGrievance: 0,
  /** Money in a hand. The multiplier is on the man's weekly wage. */
  payWages: 3,
  paidLoyalty: 7,
  paidGrievance: -26,
  /** Turning somebody down. */
  refusedLoyalty: -6,
  refusedGrievance: 8,
  refusedFear: 2,

  /** Taking a side in somebody else's argument. */
  backedTrust: 12,
  backedResentment: -18,
  /** The other one notices. */
  passedOverResentment: 10,
  /** Staying out of it, which is also a decision. */
  ignoredResentment: 3,

  /** Money into a front that is failing. Multiplier on its weekly revenue. */
  frontRepairWeeks: 4,
  frontRepairHealth: 22,
  /** Running it clean for a while instead. */
  frontQuietExposure: -18,
  frontQuietHealth: 6,

  /** Money into a street. */
  streetSpend: 6_000,
  streetSentiment: 14,
  /** Or the other way of settling it. */
  streetLeanSentiment: -6,
  streetLeanFear: 4,
  streetLeanHeat: 5,

  /** Doing a small service for somebody who does not use the word favour. */
  outsideSpend: 9_000,
  outsideStanding: 12,
  outsideDeclineStanding: -6,

  /** What counsel is worth against a file that is moving. */
  paperLayLow: true,
  paperRideRespect: 2,

  /** Somebody of yours is in a cell. */
  insideBailWeeks: 6,
  insideLoyalty: 9,
  insideAbandonedLoyalty: -12,
  insideAbandonedFear: 3,

  /** A steward who has been helping himself. */
  callItInLoyalty: -8,
  callItInFear: 3,
  letItGoLoyalty: 4,
  letItGoTakes: 1,

  /** A name that has come round twice. */
  askedAboutGrievance: 10,
  askedAboutFear: 6,
  ignoredItRespect: 1,
} as const;
