/**
 * What the seven verbs cost and what they are worth.
 *
 * See `config/build.ts` for the design. Each of these belongs to one stat and
 * is reachable only by having put the points there, so none of them is sized
 * against "is this worth doing" in the way a purchase would be — the player
 * already paid, in the only currency a build has.
 *
 * What they are sized against is **not being obviously correct**. A verb that
 * every build would want if it could is a tax on the six stats that did not
 * take it, and the allocation screen stops being a decision.
 */

export const VERBS = {
  // ----------------------------------------------------------------- grip --

  /**
   * How often a family meeting means anything.
   *
   * A fortnight. Short enough that a boss with Grip uses it as a tool rather
   * than a ceremony, long enough that it cannot be a grievance dial held down
   * with a brick. The refusal says how long it has been rather than how long
   * is left, because the first is a fact about the family and the second is a
   * fact about the rule.
   */
  meetingEveryDays: 14,
  /**
   * What comes out of the room.
   *
   * Grievance only. Measured across the crew, grievance is -0.20 loyalty per
   * crew-week against stagnation's -0.60 and heat's -0.46 — so this is
   * deliberately aimed at the smallest of the three, because it is the only
   * one a conversation can honestly address. Stagnation is answered by giving
   * somebody something and heat by laying low, and a room that fixed all three
   * would delete two systems.
   */
  meetingClears: 14,
  /** And being spoken to by the boss, which is the cheapest standing there is. */
  meetingRegard: 3,

  // --------------------------------------------------------------- muscle --

  /**
   * What a district on the card pays a week, before anybody is frightened.
   *
   * Against a median career purse this is real money and not a living — the
   * point is that it arrives whether or not anybody worked, which is the one
   * thing no other income in this game does. Jobs need bodies, fronts need
   * capacity, stewards need a man. A card needs a reputation.
   */
  cardPerDistrict: 1_400,
  /**
   * ...and the share of it a family with no reputation still collects.
   *
   * Not zero, because a district you hold outright pays something to somebody
   * standing in it regardless. But most of the take is the fear, which is the
   * whole reason this verb exists: measured twice, being feared had no
   * reachable supply and bought almost nothing, and this is the demand.
   */
  cardFloor: 0.25,
  /** What the neighbourhood thinks of it, per district per week. */
  cardSentiment: -1.1,
  /**
   * And what collecting is worth as a reminder, per district per week.
   *
   * The only source of fear in the game that does not require a job to have
   * gone well — see the measurement on `FEAR.onFailure`. Small on purpose: a
   * card is a reason to *be* frightening, not a way to become it.
   */
  cardFear: 0.6,

  // ------------------------------------------------------------- instinct --

  /** How many people you can have placed and still keep track of them. */
  plantsAtOnce: 2,
  /** And how many hands you need spare before you can afford to lose one. */
  plantNeedsCrew: 4,

  // -------------------------------------------------------------- stomach --

  /**
   * The least time the boss can go away for.
   *
   * Even a short sentence has to be long enough to matter, or taking the
   * weight is a button that buys loyalty for a fortnight of nothing. Six weeks
   * is long enough for the succession machinery to become interesting, which
   * is the real reason this verb is worth having in the game.
   */
  weightMinimumDays: 42,
  /** What it is worth to the man it saved. */
  weightLoyalty: 30,
  weightRegard: 25,
  /**
   * ...and to everybody watching, which is the larger half.
   *
   * A family decides what it believes about the boss by watching what happens
   * to the man who got caught. Applied to the whole roster because that is
   * where the value is: 291 of 343 hires walk out over a career, and nothing
   * else in this game moves loyalty across everybody at once.
   */
  weightLoyaltyOthers: 8,
  weightRegardOthers: 6,

  // --------------------------------------------------------------- method --

  /** A week, because that is what "spend the week on it" means. */
  casingDays: 7,
  /**
   * Points on the odds for a job that was actually looked at.
   *
   * Sized against `prepDelta`, which is what a full score's groundwork buys,
   * and deliberately smaller. A month of planning a big target has to be worth
   * more than a week of watching a shop, or opening a score is never the right
   * call.
   */
  casedOdds: 8,

  // --------------------------------------------------------------- ledger --

  /**
   * The share of somebody else's business you end up with.
   *
   * A minority piece, and it has to stay one: at half or more this becomes a
   * cheaper way of owning a front, and `acquireBusiness` — with its slots,
   * its control requirement and its public feeling gate — stops being the way
   * the legitimate economy is entered. What is bought here is not the income.
   * It is that your name is on nothing.
   */
  stakeShare: 0.3,
} as const;
