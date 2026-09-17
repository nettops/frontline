/**
 * The one thing the boss owns that is not supposed to earn.
 *
 * Every other asset in this game is a front: it launders, it pays upkeep, it
 * has an exposure number and a health number and a district. This has none of
 * those. It is bought with clean money, it never pays anything back, and the
 * only thing it produces is a place to be that is not work.
 *
 * And it does not stay that way. The crew finds out where he goes, and then
 * they are there too — with hot goods in the back, with somebody's brother
 * who needs a job, with the exact life the place was bought to be away from.
 * `contagion` is that drift, and the player's two answers are both bad: leave
 * it and the peace is worth less every week until a raid takes it, or ban his
 * own captains from the boss's spot and wear what they think about that.
 */

export interface PetProjectDef {
  id: string;
  name: string;
  blurb: string;
  /** Clean money only. A place like this is not bought with a bag of cash. */
  cost: number;
  /** Stress cleared each quiet week, before contagion eats into it. */
  weeklyStressRelief: number;
}

export const PET_PROJECTS: PetProjectDef[] = [
  {
    id: 'stables',
    name: 'Pie-O-My Stables',
    blurb:
      'A thoroughbred and a stall at a track an hour north. She knows your voice. You have stood ' +
      'in that barn at four in the morning for no reason at all.',
    cost: 22_000,
    weeklyStressRelief: 4,
  },
  {
    id: 'bakery',
    name: 'Classic Italian Bakery',
    blurb:
      'Pastry, espresso, and a counter your mother would have recognised. Open at five, shut by two, ' +
      'and nobody in it wants anything from you.',
    cost: 12_000,
    weeklyStressRelief: 3,
  },
  {
    id: 'jazz_club',
    name: 'Downtown Jazz Haven',
    blurb:
      'Velvet, brass, and a quartet on Thursdays. You sit at the back and do not talk to anybody ' +
      'for two hours.',
    cost: 28_000,
    weeklyStressRelief: 5,
  },
];

export const PET_PROJECT_BY_ID: Record<string, PetProjectDef> = Object.fromEntries(
  PET_PROJECTS.map((p) => [p.id, p]),
);

export const CONTAGION = {
  /**
   * Weekly drift with the crew left to their own devices.
   *
   * Three a week is twenty-five weeks from clean to the raid bar — half a
   * measured career, so a boss who buys the place on day 60 and never thinks
   * about it again meets the consequence inside the span anybody plays.
   */
  baseWeeklyDrift: 3,

  /** Extra drift per active capo. A bigger family finds the place faster. */
  driftPerCapo: 0.5,

  /** Contagion past which the place is worth raiding. */
  raidThreshold: 75,

  /** Weekly chance of a raid, once past the bar above. */
  raidChance: 0.18,

  /** Heat a raid leaves, on the street channel — this is not a paper case. */
  raidHeat: 9,

  /** And the paper it does leave. */
  raidEvidence: 7,

  /** Respect the boss spends telling his own captains they are not welcome. */
  sanitizeInfluenceCost: 2,

  /** What each active capo thinks about being banned from the boss's spot. */
  sanitizeCapoGrievance: 6,

  /** Days before a swept place is worth sweeping again. */
  sanitizeCooldownDays: 21,

  /** Stress cleared by an evening there, before contagion eats into it. */
  visitStressRelief: 15,
} as const;
