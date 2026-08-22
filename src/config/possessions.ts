/**
 * The things a boss owns that are theirs rather than the organization's.
 *
 * Round 15 was asked what they would have lost if it had all gone, and the
 * answer is the best line in the report:
 *
 *   *"Honestly: not much, and that is the damning part."* $673, a laundromat
 *   worth half what they paid, one district, six men.
 *
 * Then they corrected themselves:
 *
 *   *"What I would actually have lost was Little Sicily... a neighbourhood I
 *   had ruined and was trying to repair, and four men whose loyalty readings I
 *   could recite from memory. The money and the rank I would not have missed
 *   at all."*
 *
 * The game already makes people and places matter. It made **property** matter
 * not at all: `estate.ts` valued a wallet, a savings account, and the fronts
 * the organization trades out of. There was no such thing as a thing that was
 * *yours*.
 *
 * ## The trade, and why it needs no new machinery
 *
 * A possession is standing bought with liquidity, and the whole of it falls out
 * of four numbers the game already keeps:
 *
 * - **It counts at face in the estate**, exactly as `holdings` does, so buying
 *   one moves rank not at all. What you gave up is the ability to spend it.
 * - **It sells back at a loss**, and a worse one than holdings: a bond is a
 *   bond and a two-year-old car is a two-year-old car.
 * - **The visible share of it raises legitimacy**, because `legitimacy` already
 *   asks what proportion of your worth is out where people can see it.
 * - **And the same visibility puts your name in the paper**, which raises
 *   notoriety, which lowers legitimacy's `unnamed` term *and* the discretion
 *   every civic figure extends you.
 *
 * So the flashy car is genuinely two-sided and nothing had to be built to make
 * it so. A watch nobody notices is a safe place to put money. An Italian car
 * that nobody else in the city owns is a statement, and statements get printed.
 *
 * ## Deliberately no upkeep
 *
 * The obvious fifth number is a weekly cost, and it is not here. The cost of a
 * possession is that the money has stopped being money — that is a real price,
 * it is paid the moment you buy, and it is the one the resale share enforces. A
 * weekly drain on top would make the whole catalogue a trap rather than a
 * decision, and the middle game already has enough numbers that only fall.
 *
 * ## Bought with clean money only
 *
 * The one rule that is not derived from an existing system, and the reason the
 * catalogue works at all. You cannot buy a house on the hill out of a suitcase.
 * `spend()` takes dirty first by design, so possessions do not use it — see
 * `sim/possessions.ts`. This is also what stops a possession being a laundry:
 * dirty money still has to go through a front to become the sort of money that
 * buys a car in your own name.
 */

/** What sort of thing it is. Cars and jewellery can be driven away by a raid. */
export type PossessionKind = 'home' | 'car' | 'jewellery';

export interface PossessionDef {
  id: string;
  kind: PossessionKind;
  /** As the player would say it, not as a catalogue would list it. */
  name: string;
  /** Catalogue price in founding-year money. Run through `priced()` at the till. */
  cost: number;
  /**
   * How much of it the city can see, 0..1.
   *
   * Does two jobs on purpose. It is the share of the thing's worth that counts
   * as *visible* holdings in `legitimacy`, and it scales the newspaper item
   * that runs when you buy it. One number, both halves of the same fact: a
   * thing people can see is a thing people can see.
   */
  visibility: number;
  blurb: string;
}

/**
 * Nine things, across three rungs of money.
 *
 * The bottom rung matters more than the top. Thirty of thirty-six careers
 * finish under $100,000, and a catalogue that opens at $20,000 would be
 * content for the sixth of players who least need content — which is precisely
 * the mistake this project made putting the diplomatic doors at the 75th
 * percentile of a distribution nobody had plotted, and had to correct twice.
 * So the watch is $1,800 and the sedan is $4,200, and a boss who has had one
 * good month can own something.
 */
export const POSSESSIONS: PossessionDef[] = [
  // -- jewellery: the quiet end, and the loudest single item -----------------
  {
    id: 'watch',
    kind: 'jewellery',
    name: 'A good watch',
    cost: 1_800,
    visibility: 0.15,
    blurb:
      'Swiss, thin, and older than you are. Nobody across a table has ever mentioned it and everybody has seen it.',
  },
  {
    id: 'ring',
    kind: 'jewellery',
    name: 'A ring, and not a small one',
    cost: 6_500,
    // Above the "people notice" band on purpose: the blurb says it is seen
    // across a table, and a row that reads "Nobody much" beside that sentence
    // is the screen disagreeing with itself.
    visibility: 0.45,
    blurb:
      'The kind of thing that is noticed when you put your hand on the table, which is either the point or the problem.',
  },
  {
    id: 'necklace',
    kind: 'jewellery',
    name: 'A necklace with a history',
    cost: 26_000,
    visibility: 0.6,
    blurb:
      'It belonged to somebody whose name is still in the society pages. The dealer was careful not to say how it came to be for sale.',
  },

  // -- cars: the rung most careers can actually reach ------------------------
  {
    id: 'sedan',
    kind: 'car',
    name: 'A quiet sedan',
    cost: 4_200,
    visibility: 0.2,
    blurb:
      'Dark, four doors, nothing about it worth writing down. A car for somebody who would rather arrive than be seen arriving.',
  },
  {
    id: 'lincoln',
    kind: 'car',
    name: 'A Lincoln Continental',
    cost: 14_000,
    visibility: 0.55,
    blurb:
      'Long, black, and unmistakable at the end of a street. People stand up when it stops outside.',
  },
  {
    id: 'roadster',
    kind: 'car',
    name: 'An Italian car nobody else in this city owns',
    cost: 38_000,
    visibility: 0.95,
    blurb:
      'Impractical, loud, and the only one for four hundred miles. Everybody who sees it will remember where.',
  },

  // -- homes: the personal half of the property the game already had ---------
  {
    id: 'apartment',
    kind: 'home',
    name: 'A place of your own above the avenue',
    /*
       Sized against the plotted distribution, and it was $22,000 first.

       `ladder.probe` measures the dearest catalogue item a career could ever
       afford in clean cash: **median $14,000**, best $75,000, across 36
       careers of 300 days. So an apartment at $22,000 sat above the median,
       which means half of all careers never reach the one item that hooks
       into the personal-life layer — and a hook half the players never touch
       is the thing this project has now put at the 75th percentile of an
       unplotted distribution three times and had to correct twice.

       Deliberately not blind: the number was moved after seeing the reading,
       which is why `ladder.probe` carries a standing condition on home
       reachability rather than trusting this comment.

       Cheaper than the Lincoln, which looks wrong for a fortnight and is
       right: this is three rooms over a shop in a poor district, and the
       Lincoln is the most conspicuous car on the street. The catalogue prices
       what a thing says about you as much as what it is.
    */
    cost: 13_000,
    visibility: 0.3,
    blurb:
      'Three rooms, a door that locks properly, and nobody else’s name on any of it. The first thing you have ever owned that is not working for you.',
  },
  {
    id: 'house_hill',
    kind: 'home',
    name: 'A house on the hill',
    cost: 75_000,
    visibility: 0.8,
    blurb:
      'Set back from the road behind a wall, with room for everybody and then some. The neighbours will look it up.',
  },
  {
    id: 'old_place',
    kind: 'home',
    name: 'The old Merriweather place',
    cost: 160_000,
    visibility: 1,
    blurb:
      'Eleven rooms and a name the whole city knows, sold by a family that ran out of money before it ran out of pride. Buying it is a statement whether you meant one or not.',
  },
];

export const POSSESSION_BY_ID: Record<string, PossessionDef> = Object.fromEntries(
  POSSESSIONS.map((p) => [p.id, p]),
);

export const POSSESSION_KIND_LABEL: Record<PossessionKind, string> = {
  home: 'Property',
  car: 'Cars',
  jewellery: 'Jewellery',
};

export const POSSESSION = {
  /**
   * What comes back when you sell.
   *
   * Worse than `HOLDINGS.withdrawReturn` (0.85) on purpose, and the gap is the
   * whole distinction between the two. Holdings are money that has been put
   * somewhere sensible; a possession is money that has been turned into a
   * thing, and the thing is worth what somebody in a hurry will pay for it.
   */
  sellBackShare: 0.6,

  /**
   * How loud the newspaper item is when a boss buys something visible.
   *
   * Runs through `cover()` like everything else that reaches the papers, so it
   * obeys the two-stories-a-day rule and cannot turn a shopping trip into a
   * front page every time. Scaled by `visibility`, so the watch prints nothing
   * anybody reads and the Merriweather place prints at full volume.
   */
  coverageScale: 1,

  /**
   * How much more a visit clears when the boss owns the roof they are under.
   *
   * The one place possessions reach into the personal layer, and the smallest
   * hook that is not decoration: `HOME.clearedByVisit` is 22, and a home of
   * your own makes an evening there worth this instead. A rented room you are
   * never in is not the same as a house with everybody's things in it.
   */
  clearedByVisitAtHome: 32,
} as const;
