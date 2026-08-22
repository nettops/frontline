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
    owesAbove: 40,
    needsInfluence: 0,
  },
  {
    id: 'union',
    title: 'A union boss',
    blurb:
      'Owns who gets hired on every site in three districts. Wants to know the ground is held by somebody who answers.',
    watches: 'ground',
    grants: 'quiet_the_street',
    owesAbove: 40,
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
    owesAbove: 60,
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
   * `decayPerWeek` this is 3.7 a week, so thirteen quiet weeks reach 48 and a
   * captain at 40 owes you one inside a season. At 3.5 it reached 35.1 and the
   * whole network opened after a person had stopped playing, which is the
   * defect it exists to fix.
   */
  driftPerWeek: 4.5,

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
export const CIVIC_ATTRIBUTE: AttributeId = 'influence';
