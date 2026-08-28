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
export type PossessionKind = 'home' | 'car' | 'jewellery' | 'vessel' | 'club' | 'institution';

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
  /**
   * What it costs to keep, per week. Absent means nothing.
   *
   * The nine original items are bought once and held for free, and that is why
   * they stopped being a decision the moment they were bought. Measured, a
   * family earns $1,128,015 of clean money across a career and spends $142,297
   * of it; the rest ends up in a savings account paying 26% a year. A one-off
   * price cannot absorb a flow — it absorbs a few months and then the pile
   * resumes.
   *
   * So the new tier costs money to hold, at 0.6% to 1.2% of its price a week.
   * That is 30% to 60% a year, deliberately *worse* than what the same money
   * would earn sitting in `holdings`, and the gap is the entire trade: you turn
   * something that compounds into something that depreciates, and buy standing
   * with the difference. A yacht has to be worth wanting again every quarter.
   *
   * Optional, so the original nine keep their terms exactly.
   */
  upkeep?: number;
  /**
   * What owning it does to the world, per week.
   *
   * One key so far. A second gets added when something earns it, not in
   * anticipation.
   */
  effect?: { sentimentPerWeek?: number };
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

  /*
     The tier above, and the first things in this game that cost money to keep.

     Priced off the plotted distribution rather than by eye. Peak clean purse
     per career, 36 careers: 10th $190,234, 25th $455,551, median $982,554,
     75th $1,678,087, 90th $1,908,305. Careers ever over $250,000: 31 of 36.
     Over $750,000: 23. Over $2,000,000: two — which is why nothing here goes
     near it, and why the aircraft, the hospital and the newspaper are deferred
     until these four are measured as bought and lived with.

     The other number that shaped this: the peak arrives on **day 294 of 300**.
     Anything dear enough to need the whole career is affordable for a
     fortnight, which is content priced for a run that has already succeeded.

     So these are set against the purse *curve*, not against its peak. Median
     clean purse reads 62k at day 120, 329k at 180, 418k at 210 and 700k at
     240 — and the count of careers whose purse ever passes a figure by day 200
     runs 150k:25, 250k:21, 400k:19, 500k:16, 700k:6 of 36.

     The first draft priced this tier at 220k / 350k / 400k / 700k against the
     peak, and the yacht was bought **zero times in thirty-six careers**. Every
     figure below is the corrected one, chosen so an ordinary family reaches
     each rung around day 180 to 210 and has a third of a career left to keep
     it.
  */
  {
    id: 'boat',
    kind: 'vessel',
    name: 'A boat at the marina',
    cost: 120_000,
    upkeep: 800,
    visibility: 0.5,
    blurb:
      'Forty feet of teak and brass with a mooring somebody had to be persuaded to give up. You will use it four times a year and think about it constantly.',
  },
  {
    id: 'country_club',
    kind: 'club',
    name: 'A membership at the country club',
    cost: 250_000,
    upkeep: 1_800,
    visibility: 0.7,
    blurb:
      'Two men on the committee voted against you and one of them shook your hand afterwards. The golf is incidental; the eighteen holes are where the city decides things.',
  },
  {
    id: 'yacht',
    kind: 'vessel',
    name: 'The yacht',
    cost: 400_000,
    upkeep: 3_200,
    visibility: 0.9,
    blurb:
      'A crew of four, a name painted on the stern, and a berth that costs more than most men earn. Nobody buys one of these quietly and nobody is meant to.',
  },
  {
    id: 'foundation',
    kind: 'institution',
    /*
       The one thing on this tier that does something, and the only route into
       the favour network the design permits.

       `civic.ts` refuses purchased standing outright — "Nothing in this file is
       spent or bought, which is the thing that distinguishes it from the
       `contactCost` shop it replaces." A foundation does not buy the alderman.
       It moves public sentiment in the districts the family works, and the
       alderman watches sentiment, so his opinion drifts toward a world you
       changed. That is the difference between a bribe and a reputation.

       Sentiment is not only his. It feeds front health, territory control and
       what the trades can move through a district, so this is an economic
       instrument as much as a political one.

       It costs nearly as much to run as the yacht at half the price, because
       it works and the yacht does not.
    */
    name: 'A charitable foundation',
    cost: 200_000,
    upkeep: 3_000,
    visibility: 0.6,
    effect: { sentimentPerWeek: 1.2 },
    blurb:
      'Scholarships, a soup kitchen, a wing with your mother\'s name over the door. Everybody knows where the money came from and everybody takes it anyway.',
  },
];

export const POSSESSION_BY_ID: Record<string, PossessionDef> = Object.fromEntries(
  POSSESSIONS.map((p) => [p.id, p]),
);

export const POSSESSION_KIND_LABEL: Record<PossessionKind, string> = {
  home: 'Property',
  car: 'Cars',
  jewellery: 'Jewellery',
  vessel: 'On the water',
  club: 'Memberships',
  institution: 'Institutions',
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

  /**
   * How much of a score's take comes home as a thing.
   *
   * The crew did not go shopping with the money — they came back carrying
   * something, and the something is worth less than the haul. A fifth is
   * enough that a serious score produces a car and an ordinary one produces
   * nothing, which is the distinction worth drawing: a possession should mark
   * a job somebody would still be talking about.
   *
   * Not tuned against the estate. `SCORE_TARGETS` pay from the tens of
   * thousands into the hundreds, and the catalogue runs $2,400 to $220,000, so
   * this is the figure that decides where on the catalogue an ordinary career
   * ever reaches. It is the dial to turn if the answer is "everything" or
   * "nothing".
   */
  fromTakeShare: 0.2,
} as const;
