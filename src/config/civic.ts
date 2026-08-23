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
  /** Public feeling across the districts you work. Higher is better. */
  | 'standing'
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
    */
    owesAbove: 55,
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

       32 sits between the median and the ground the compounding half of the
       population actually holds, which is the same method the other three
       were re-sized by.
    */
    owesAbove: 32,
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
    watches: 'standing',
    grants: 'lose_the_paperwork',
    /*
       Was 60, and never once reached in 36 careers.

       The alderman reads the average public feeling across the districts you
       work, and `ladder.probe` measures that at 38 across the population, with
       the best week of the median career at 46. A bar of 60 was not demanding,
       it was outside the range of the quantity it was set against — the figure
       was unreachable content in every career the probe has ever run.

       45 sits just above the median career's best, so keeping a neighbourhood
       on side is what buys it, which is what the figure is for.
    */
    owesAbove: 45,
    needsInfluence: 6,
  },
];

export const CIVIC_BY_ID: Record<string, CivicFigureDef> = Object.fromEntries(
  CIVIC_FIGURES.map((f) => [f.id, f]),
);

export const CIVIC = {
  /** Everybody decides how they feel about you once a week. */
  intervalDays: 7,

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
  driftPerWeek: 5.2,

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
