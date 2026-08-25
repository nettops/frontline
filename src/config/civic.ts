/**
 * The people who are not in your family and decide things anyway.
 *
 * The game already had two of these and did not know it. `PATRON` in
 * `config/perception.ts` is a man in the building who holds off political
 * pressure for ninety days, and the four `contactCost` entries in
 * `config/lawEnforcement.ts` are named institutions you buy a standing
 * relationship with. Both are one-off special cases: a price, a boolean, and
 * a timer.
 *
 * What neither has is the thing that makes a network a network — somebody who
 * *owes you*, because of something you did, that you can spend once.
 *
 * Round 14 wanted this and could not reach it: "People on the inside. $30,240
 * for City Police... Never affordable at the moment of asking. This is the
 * system I most wanted and it is priced for a run that has already succeeded."
 *
 * Two rules shape everything below.
 *
 * **You do not buy these relationships, you accumulate them.** Every figure
 * reads a number the simulation already produces — how quiet you keep things,
 * how much ground you hold, what the papers say. A player who never opens this
 * screen still builds standing with somebody, because standing with a police
 * captain *is* a low heat number seen from the other side. That is the
 * difference between a network and a shop.
 *
 * **A favour is spent on a problem, not on a stat.** Each one does something
 * the game already does to you: cools a case, opens a district that has turned
 * against you, gets somebody out. Nothing here adds a number to a bar.
 */

import type { AttributeId } from '../sim/types';

/** What a favour from this person actually does when you spend it. */
export type FavourKind =
  /** Cools an open case and takes weight off its evidence. */
  | 'bury_a_case'
  /** Gets one of your people out of custody today. */
  | 'open_the_door'
  /** Brings a district's public feeling back over the bar fronts need. */
  | 'quiet_the_street'
  /** Holds city-hall pressure down for a season. */
  | 'lose_the_paperwork';

/**
 * The number a figure watches, and which direction they like it.
 *
 * Read rather than written: these are all quantities the simulation maintains
 * for its own reasons, so a relationship here is a consequence of how the
 * family is run rather than a second thing to manage.
 */
export type CivicWatches =
  /** Street heat. Lower is better — a captain wants a quiet division. */
  | 'quiet'
  /** Districts held. More is better — a union boss counts halls. */
  | 'ground'
  /**
   * Legitimate businesses standing in ground that does not resent you.
   * Higher is better — somebody in office needs people to be seen with.
   */
  | 'respectability'
  /** Notoriety in the papers. Lower is better — a judge cannot be seen. */
  | 'discretion';

export interface CivicFigureDef {
  id: string;
  /** What they are, not who — the name is drawn per world. */
  title: string;
  blurb: string;
  watches: CivicWatches;
  grants: FavourKind;
  /**
   * Standing you need before they owe you anything at all.
   *
   * Deliberately below the midpoint. A relationship that only pays at 80 is a
   * relationship nobody in a 300-day career ever sees, which is the mistake
   * `PATRON` makes at Influence 9 — see `HANDOFF.md` F2.
   */
  owesAbove: number;
  /**
   * Pull needed before they will take a meeting.
   *
   * Zero for most of them on purpose. Influence gates the *top* of this
   * network, not the bottom, because four blind rounds could not reach the
   * bottom of the old one.
   */
  needsInfluence: number;
}

/*
   Re-derived after the heat and evidence work, all four together.

   `owesAbove` is where somebody decides they owe you one, and every one of
   these was plotted against a game whose heat sat at a median of 80 and whose
   families held two districts. Making heat decay a share of the load took heat
   to 49 and ground to three, so the people watching those two things thought
   well of nearly everybody:

       captain   watches quiet      owed by 35/36
       union     watches ground     owed by 36/36
       judge     watches discretion owed by 15/36
       alderman  watches standing   owed by 34/36

   A figure who owes every career is not a favour network, it is a
   subscription. `ladder.probe` holds each of them to between 9 and 33 of 36.

   ## Three of the four needed the thing they watch fixed, not the bar moved

   Raising the bars alone was tried first and reverted, because `civic.test`
   states the promise directly — thirteen weeks at heat 5 must earn the captain
   — and any bar an exemplary quiet season can clear was being cleared by
   thirty-two careers in thirty-six.

   So the bar and the drift moved together, which is the same move this file
   records making once before when the captain went from 40 to 55:

     - `driftPerWeek` 5.2 -> 6.2, keeping the thirteen-week promise intact at a
       higher bar. It is a harder thirteen weeks.
     - captain `owesAbove` 48 -> 68. He reads `100 - heat`, and heat now spans
       p25 27 to p75 71, so the bar sits where a genuinely quiet family is
       rather than where the median one is.
     - alderman `owesAbove` 45 -> 50. He was sitting *exactly* on the mean
       sentiment his own score reads, which is a coin flip rather than a bar.
     - the union counts **controlled** ground now, not footholds. `ground` read
       influence at 25, and a family with three districts under control has a
       toe in six or seven besides — so he was reading a number nearly every
       career maxed out. Divisor 4 -> 6 with it.

   After:  captain 23/36 · union 30/36 · judge 21/36 · alderman 15/36

   The alderman is still the fragile one. His interquartile range was one point
   before this and the repair here is a bar placement rather than a better
   reading; mean sentiment across worked districts remains a nearly constant
   number, and if it is ever asked to carry more it will need a sharper input.

   ## And every figure above was plotted against a family that had stopped working

   `ladder.probe`'s bot ended its job loop on a `break` against a list sorted by
   expected value, so one job it could not crew stopped every cheaper job below
   it being considered. It stood still on two days in five, and the freeze
   deepened as the board opened — 46 jobs before day 90 falling to 21 after day
   180. Every figure in the tables above is a reading of that family.

   With the bot fixed and given the heat counterplay it never had, the same
   four read:

       captain   24/36     union   36/36     judge   16/36     alderman  0/36

   The captain and the judge held. The other two broke in opposite directions
   and both are the reading rather than the bar:

     - **The union owes everybody.** 36 of 36, whatever they do. Counting
       controlled ground was the right correction and it is still a number a
       working family maxes out; it is a subscription again.

     - **The alderman owes nobody.** 0 of 36. Mean sentiment where working fell
       from 44 to 35 the moment the family started working, because working a
       district is what costs sentiment. That makes him the one figure in this
       game whose favour gets *further away* the more you play, which is
       backwards, and it is the sharper input the paragraph above said he would
       need. A bar placement cannot fix a reading that runs the wrong way.

   ## The alderman, fixed

   Plotted first. Five candidate readings across 36 careers at day 300, as the
   25th / median / 75th:

       mean sentiment where working   34.6 / 37.2 / 38.3   (max 40.7)
       best sentiment where working   49.1 / 50.0 / 50.0   (max 50.0)
       districts above 50                0 /    0 /    0
       fronts in non-hostile ground    7.0 /  8.0 /  9.0   (max 10)
       legitimacy                       35 /   42 /   48   (max 71)

   The first three say the same thing: public feeling has **no upside**.
   `SENTIMENT_RECOVERY_PER_WEEK` climbs back only as far as `SENTIMENT_START`,
   and not one career in thirty-six ever had a single district above it. Every
   bar this figure has carried — 60, then 45, then 50 — was outside the range
   of the quantity it was set against.

   He reads fronts in ground that is not hostile now, over `respectableFronts`.
   Feeling stays in it as a gate rather than as the whole of it, so the
   foundation and the rest of the sentiment economy still matter to him, and a
   business nobody there can stand still does not count.

   After: captain 24/36 · union 36/36 · judge 16/36 · **alderman 13/36**, with
   his median best standing at 79 against a bar of 85 — a stretch a third of
   careers make, which is what the figure is for.

   The union is still open and its bar does not move. `ladder.probe` stays red
   on it, which is what that file's own comment says to do with a target for
   this config.
*/
export const CIVIC_FIGURES: CivicFigureDef[] = [
  {
    id: 'captain',
    title: 'A police captain',
    blurb:
      'Runs a division and would like it to be boring. Nothing you do is their business until it is in the paper.',
    watches: 'quiet',
    grants: 'bury_a_case',
    /*
       Was 40, and the generated memos moved the ground under it.

       `gen_paper_moving` walks in and offers to put everybody indoors for a
       while, and the probe's bot — which never laid low in its life, F7's
       oldest complaint — takes it, because it is free. Heat across a career
       fell, the captain reads `100 - heat`, and the figure went from a median
       best standing of 52 to 69 against a bar of 40. Owed in 34 careers out of
       36: a fixture rather than a relationship.

       Sized the way `config/economy.ts` sizes the rank table — between the
       median and the 75th of the measured distribution — rather than by eye,
       which is how it came to be 40.

       Down to 48 when the rank ladder came out, and the mirror image of what
       happened to the union on the same day. The captain reads `100 - heat`,
       and a career that now expands across three districts instead of sitting
       on one is a busier and louder career: the same bar that made this a
       fixture at 34 of 36 made it unreachable at 7, against a floor of 9 that
       `ladder.probe` holds as content nobody would otherwise see.

       Both edits are the same method applied to a quantity that moved, in
       opposite directions, which is what that method is for.

       Left at 48 when orders went in, and worth recording why. Wiring
       `tickOrders` into the pipeline drew one number a week from the shared
       stream, every seeded career diverged, and this read 8 of 36 against a
       floor of 9. Re-plotting put the bar at 44 — and then the draw was moved
       onto a stream of its own (see `offerStream` in `sim/orders.ts`), the
       populations came back, and 48 was correct again. The bar was never
       wrong; the measurement had been disturbed by the thing being measured
       against it.
    */
    owesAbove: 68,
    needsInfluence: 0,
  },
  {
    id: 'union',
    title: 'A union boss',
    blurb:
      'Owns who gets hired on every site in three districts. Wants to know the ground is held by somebody who answers.',
    watches: 'ground',
    grants: 'quiet_the_street',
    /*
       Was 40, against a quantity whose median best is 24.

       The union counts the districts you hold at Foothold or better, over
       four — so a bar of 40 wants roughly two districts held, and the median
       career at day 300 holds one. It was the last of the four figures still
       sized by eye rather than against the distribution, and it survived the
       first pass only because it happened to read 14 careers out of 36 that
       afternoon; after the rival and economy work it read 8.

       32 sat between the median and the ground the compounding half of the
       population actually held, which is the same method the other three were
       re-sized by.

       Re-sized again when the rank ladder came out, by that same method and
       for the same reason it was wrong at 40: the quantity underneath it
       moved. `standingFor('ground')` is districts at influence 25 or better
       over four, so 25 a district — and the measured career now holds 2 / 2 / 3
       at the 40th, median and 75th, where it held one. Every one of the
       thirty-six cleared 32, and `ladder.probe` calls that out directly: a
       figure every career reaches whatever they do is not a relationship, it
       is a fixture.

       60 wants three districts, which is the 75th of the new distribution and
       so sits where 32 sat in the old one.
    */
    owesAbove: 60,
    needsInfluence: 0,
  },
  {
    id: 'judge',
    title: 'A judge',
    blurb: 'Has a docket and a reputation, and the reputation is the one that matters to them.',
    watches: 'discretion',
    grants: 'open_the_door',
    owesAbove: 55,
    needsInfluence: 3,
  },
  {
    id: 'alderman',
    title: 'Somebody in office',
    blurb:
      'The building takes their calls. The same arrangement the City screen sells for money, reached the other way.',
    watches: 'respectability',
    grants: 'lose_the_paperwork',
    /*
       Twice sized against a quantity that could not carry a bar, and now
       sized against one that can.

       It was 60, then 45, then 50, all against the average public feeling in
       the districts you work. That reading tops out at 40.7 across 36 careers
       and *falls* as you play, so every one of those numbers was outside the
       range of the thing it was measuring; see the note in `scoreFor`.

       He reads fronts in ground that is not hostile now, and `ladder.probe`
       measures those at 7 / 8 / 9 of a possible 10 at day 300. Against
       `respectableFronts` of 10 that is a score of 70 / 80 / 90, so this sits
       between the median and the 75th, which is where DIRECTOR section 5 puts
       a bar and where the other three figures were placed.
    */
    owesAbove: 85,
    needsInfluence: 6,
  },
];

export const CIVIC_BY_ID: Record<string, CivicFigureDef> = Object.fromEntries(
  CIVIC_FIGURES.map((f) => [f.id, f]),
);

export const CIVIC = {
  /**
   * Fronts in non-hostile ground that read as a full civic presence.
   *
   * The same shape as the union's four districts: a ceiling past which the
   * figure is not impressed further. Ten is what the compounding career holds
   * at day 300, so the bar above can sit inside the distribution rather than
   * beyond it.
   */
  respectableFronts: 10,
  /** Everybody decides how they feel about you once a week. */
  intervalDays: 7,
  /**
   * Days before doing the same man a favour counts for anything again.
   *
   * A generated memo offers to fix a civic figure's problem for $9,000, and it
   * paid +12 standing every time it was answered. The memo pool regenerates,
   * so there was no ceiling on it at all — which is precisely the shop this
   * file exists to refuse, wearing a memo's clothes.
   *
   * Nobody found it until the heat work tripled what a family holds and the
   * probe bot started paying every time. `INFLUENCE_FROM` records the same
   * bug in another form and fixed it the same way: a fortnight on the credit,
   * not on the action. You may help as often as you like, and the money goes
   * either way — what is capped is how often it *counts*.
   */
  helpCooldownDays: 14,

  /**
   * How fast standing moves toward what they see, per week.
   *
   * Slow, because this is the one relationship in the game the player cannot
   * address directly — there is no sit-down with a judge. A season of running
   * the family a particular way should be visible here and a good fortnight
   * should not.
   *
   * Sized against `owesAbove` and the 300-day window, not picked. Net of
   * `decayPerWeek` this is 4.4 a week, so thirteen quiet weeks reach 57 and a
   * captain at 55 owes you one inside a season. At 3.5 it reached 35.1 and the
   * whole network opened after a person had stopped playing, which is the
   * defect it exists to fix.
   *
   * Was 4.5, against a captain who wanted 40. Both moved together: the probe
   * found the captain owing 34 careers out of 36 and raising the bar to 55
   * would otherwise have pushed the first favour past the season this number
   * exists to guarantee. The promise is unchanged — a quiet family has
   * somebody in the division inside thirteen weeks — and it is now a harder
   * thirteen weeks.
   */
  driftPerWeek: 6.2,

  /**
   * Standing lost each week they are not owed anything and nothing is going
   * their way. People forget.
   */
  decayPerWeek: 0.8,

  /** Days between a figure being willing to owe you another one. */
  favourIntervalDays: 30,

  /**
   * The most anybody will owe you at once.
   *
   * Two, so the network is a thing you spend rather than a thing you hoard.
   * A stockpile turns every crisis into the same answer.
   */
  maxOwed: 2,

  /** Standing below which they stop taking your calls at all. */
  coldBelow: 15,

  /**
   * How much an open case counts against you in the judge's reading.
   *
   * The judge used to watch notoriety alone. `ladder.probe` measures peak
   * notoriety at **3** across a 300-day career, so `100 - notoriety` read 97
   * every week of every game and the judge owed all 36 careers in the
   * population regardless of how any of them were played. A relationship
   * nothing can move is a fixture.
   *
   * A judge's actual exposure is not the newspaper, it is whether there is a
   * live file with your name in it. That number does move — case strength runs
   * the full range across this population — so it is the half of discretion
   * that makes the figure a relationship. Weighted rather than subtracted
   * outright, because a boss under investigation should become harder for a
   * judge to know, not radioactive.
   */
  discretionCaseWeight: 0.6,
} as const;

/**
 * What each favour is worth when it lands.
 *
 * Sized against the systems they act on rather than against each other: a
 * buried case has to actually change what happens next week, and a district
 * brought back over the bar has to clear `SENTIMENT_HOSTILE_BELOW` with room,
 * or the favour reads as having done nothing.
 */
export const FAVOUR_EFFECT = {
  /** Evidence struck off an open case, and the days of quiet that follow. */
  buryEvidence: 35,
  buryColdDays: 21,
  /** Public feeling added to one district. */
  quietSentiment: 30,
  /** Days city-hall pressure is held down, matching the old arrangement. */
  paperworkDays: 90,
} as const;

/**
 * The attribute the top of this network reads.
 *
 * One place, so the gate cannot drift away from the thing the panel says.
 */
/**
 * Asking the people who owe you for money rather than for protection.
 *
 * A second thing to spend a favour on, added because the first one was not
 * being spent at all. Measured over 36 careers: favours are granted about six
 * times in 300 days and **held at six** — identical numbers, so across every
 * career in the sample not one favour was ever called in. The network accrues
 * to near its ceiling and sits there.
 *
 * That is what makes this additive rather than a new system. The currency
 * already exists and is idle; this is somewhere to spend it.
 *
 * The price is standing, not the favour, and that distinction is the whole
 * design. Because `owed` pegs at `maxOwed` and regenerates, consuming one
 * costs nothing anybody feels — so the trade has to be against the
 * relationship itself. Standing at day 300 runs p25 4, median 24, p75 34, so
 * nine points is better than a third of a typical relationship and the choice
 * between money tonight and the judge next spring is a real one.
 */
export const CIVIC_WORK = {
  /** Base payout before the price index and the figure's own weight. */
  basePay: 5_000,
  /** Added per point of their `owesAbove`, so bigger people bring bigger work. */
  payPerOwesAbove: 130,
  /** What it costs you with them. See the distribution above. */
  standingCost: 9,
} as const;

export const CIVIC_ATTRIBUTE: AttributeId = 'influence';
