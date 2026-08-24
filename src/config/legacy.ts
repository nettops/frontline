/**
 * What a career turns out to have been.
 *
 * The game has a ladder and no destination. Round 14 played 300 days, met four
 * of five Capo conditions, and stopped because the brief said to rather than
 * because anything concluded — and scored Fun 5 while scoring seven other axes
 * at their high-water mark. The last hundred and eighty days were "grinding a
 * position I could not win".
 *
 * A rank is not an ending. "Crew Leader" is the same word whether you got there
 * with seven fronts and no violence or at heat 99 with two men left, and the
 * game currently tells both of those the same way.
 *
 * So: no new win button, and nothing to opt into. Every shape below is read out
 * of numbers the simulation already keeps, and the career is named for whichever
 * one it fits best. A player does not choose to be the Ghost; they find out they
 * were.
 *
 * The one rule that keeps this honest: **a shape must be able to fail to
 * match.** `unremarkable` exists because most careers are, and a system that
 * always finds something flattering to say is a horoscope.
 */

/** Which quantity a shape is mostly about, for the evidence line. */
export type ShapeEvidence =
  | 'ground'
  | 'estate'
  | 'legitimacy'
  | 'fear'
  | 'respect'
  | 'network'
  | 'obscurity'
  | 'collapse';

export interface CareerShapeDef {
  id: string;
  name: string;
  /** Said to the player. Second person, past tense — it is over. */
  verdict: string;
  evidence: ShapeEvidence;
  /**
   * How strongly this shape is claimed when its terms are met.
   *
   * Ties are broken by this rather than by list order, so adding a shape
   * cannot silently outrank an existing one by being declared earlier.
   */
  weight: number;
}

export const CAREER_SHAPES: CareerShapeDef[] = [
  {
    id: 'tragic',
    name: 'The Tragic Boss',
    verdict:
      'You had it. Everything the family was worth at its best is gone, and the record of what it used to be is the only part that survived you.',
    evidence: 'collapse',
    // Highest weight on purpose. Losing it all is the loudest thing that can
    // happen to a career and it should not be filed under something else
    // because the numbers also fit a quieter story.
    weight: 100,
  },
  {
    id: 'kingpin',
    name: 'The Kingpin',
    verdict: 'The city moved around you. Whoever comes next inherits a map you drew.',
    evidence: 'ground',
    weight: 90,
  },
  {
    id: 'legitimate',
    name: 'The Legitimate Boss',
    verdict:
      'On paper you were a man with businesses. The paper was not lying, exactly — it was just not the whole of it.',
    evidence: 'legitimacy',
    weight: 80,
  },
  {
    id: 'financier',
    name: 'The Financial Boss',
    verdict:
      'You turned it into money and the money into things nobody can take. Very little of what you own has to be explained.',
    evidence: 'estate',
    weight: 70,
  },
  {
    id: 'don',
    name: 'The Old-School Don',
    verdict:
      'People asked you to settle things that had nothing to do with you. That is what the word used to mean.',
    evidence: 'respect',
    weight: 65,
  },
  {
    id: 'diplomat',
    name: 'The Diplomat',
    verdict:
      'You were owed favours by people who do not use the word. Very little of what you got was taken.',
    evidence: 'network',
    weight: 60,
  },
  {
    id: 'street_king',
    name: 'The Street King',
    verdict: 'Nobody on your streets had to be told twice. That was the whole arrangement.',
    evidence: 'fear',
    weight: 55,
  },
  {
    id: 'ghost',
    name: 'The Ghost',
    verdict:
      'There is almost nothing on paper. A few people know exactly who you were and none of them are going to say.',
    evidence: 'obscurity',
    weight: 50,
  },
  {
    id: 'unremarkable',
    name: 'A Name On A Short List',
    verdict:
      'You were somebody, for a while, to a small number of people. Most of them have moved on.',
    evidence: 'respect',
    // Floor. Always matches, always loses to anything else.
    weight: 0,
  },
];


/**
 * The bars each shape is tested against.
 *
 * Sized against `ladder.probe`'s 300-day distribution rather than against the
 * four-year one, per HANDOFF section 5. At day 300 the median career holds one
 * front and about $30,000, and the top eleven of thirty-six hold seven fronts
 * and anything from $134,000 to $2.8M — so a bar at $250,000 names the
 * compounding group without naming all of it.
 */
export const SHAPE_BARS = {
  /** Districts held for the Kingpin. The 75th percentile at day 300 is 4. */
  kingpinDistricts: 4,
  /**
   * Estate for the Financial Boss.
   *
   * Was 250,000, sized against a day-300 distribution whose median career
   * held one front and about $30,000. Restaking the job table above the
   * street tier moved that distribution a long way: `ladder.probe` now reads
   * the estate at 120,067 / 483,657 / 852,354 for the 40th, median and 75th,
   * so the old bar had fallen *below the median career* and handed 15 of 36
   * careers the same name — the horoscope this file's header forbids, and the
   * same way `legitimateAbove` failed before it.
   *
   * 750,000 was just under the 75th when it was set, which is where that bar
   * was put and for the same reason: the quarter of careers that really did
   * compound.
   *
   * **Re-plotted.** The heat work made decay a share of the load, and the
   * estate distribution moved out from under this figure — 40th / median /
   * 75th went from 476,920 / 541,253 / 863,865 to
   * 1,300,875 / 1,484,565 / 2,261,574. A bar at 750,000 now sits well below
   * the median, so "The Financial Boss" was the verdict on 15 careers in 36
   * and the horoscope condition this file's header forbids had quietly come
   * true again.
   *
   * Re-derived rather than nudged, and placed by DIRECTOR section 5 — between
   * the median and the 75th — rather than by the original "just under the
   * 75th". At the 75th the shape went nearly extinct, 1 career in 36, because
   * the heavier-weighted shapes take most of the careers that clear it. This
   * lands it at 3, with the most common shape at 14 of 36 and the horoscope
   * bar clear.
   */
  financierEstate: 1_850_000,
  /**
   * Legitimacy for the Legitimate Boss, 0..100.
   *
   * Was 55, and it made this the verdict on 22 of 36 careers.
   *
   * The bar was set by eye rather than against the reading. `ladder.probe`
   * measures legitimacy across the population at 63 / 66 / 73 for the 40th,
   * median and 75th — so a bar of 55 sat *below the median career* and handed
   * 61% of the game the same name. That is the horoscope this file's header
   * says a shape must not be, arriving at the population level where no
   * single-career test could see it.
   *
   * 72 is just under the 75th percentile, which makes it what it was supposed
   * to be: the quarter of careers that really did look like a man with
   * businesses.
   */
  legitimateAbove: 72,
  /** Respect for the Old-School Don. */
  donRespect: 260,
  /** Fear for the Street King. */
  streetKingFear: 55,
  /**
   * The Diplomat, and why it takes two terms rather than one.
   *
   * Favours accrue from how the family is run, and a police captain watches
   * how quiet you keep things — so a career that does *nothing at all* has
   * heat 0, a captain who likes it, and favours in hand. Found on the live
   * screen: a boss with 0 operations and 0 respect was being told they were
   * shaping into The Diplomat.
   *
   * That is the horoscope failure this whole file has a test against, and it
   * got past it. Being owed favours by accident is not a network; the pull to
   * have gone and got them is the other half.
   */
  diplomatOwed: 3,
  diplomatInfluence: 3,
  /** Notoriety must sit under this for the Ghost, and the estate above. */
  ghostNotorietyUnder: 12,
  ghostEstate: 60_000,
  /**
   * Share of peak worth that must be gone for the Tragic Boss.
   *
   * And a floor under the peak, because a family that never had anything
   * cannot have lost it — without that, every early failure reads as tragedy
   * and the loudest verdict in the game becomes the most common one.
   */
  tragicLostShare: 0.75,
  tragicPeakAbove: 120_000,
} as const;

/**
 * What legitimacy is made of.
 *
 * A reading, not a stored stat — derived on demand like `estate`, for the same
 * reason: it is an opinion about the world rather than a fact in it, and a
 * stored copy is a second thing to keep true.
 *
 * The four terms are the four things a person outside the family would
 * actually notice: what you visibly own, whether the police are interested,
 * whether the papers use your name, and whether your money can be explained.
 */
export const LEGITIMACY = {
  /** Weight on the share of the estate held as businesses and ground. */
  visibleHoldings: 0.35,
  /** Weight on being uninteresting to law enforcement. */
  quiet: 0.25,
  /** Weight on not being in the paper. */
  unnamed: 0.2,
  /** Weight on the clean share of money on hand. */
  explainable: 0.2,
} as const;
