/**
 * The people running the other families.
 *
 * A family used to be four personality numbers that never changed. The Kestler
 * were reckless on day one and identically reckless thirty years later,
 * because there was nobody in the organization for time to happen to — the
 * player aged (badly), the player's crew aged (not at all, until recently),
 * and the three organizations that make up most of the world were constants.
 *
 * A boss is a name, an age and a deviation from the family's temperament. When
 * he dies or steps down the deviation is re-rolled, and the family that has
 * been cautious for fifteen years becomes something else. That is the only
 * mechanism in the game by which the city changes character without the player
 * making it happen.
 */

export const LEADER_FIRST_NAMES = [
  'Salvatore', 'Emilio', 'Rosalia', 'Augusto', 'Cesare', 'Vittoria', 'Ignazio',
  'Rafaele', 'Ottavia', 'Bartolo', 'Ludovico', 'Serafina', 'Guido', 'Massimo',
  'Concetta', 'Ubaldo', 'Ilaria', 'Ferdinando', 'Marcello', 'Assunta',
];

/**
 * How a new boss is spoken about before you know anything concrete. Paired
 * with the personality bias at generation so the line and the behaviour agree.
 */
export const LEADER_REPUTATIONS: { text: string; suits: 'hard' | 'careful' | 'greedy' | 'quiet' }[] =
  [
    { text: 'Came up doing the work themselves, and has not forgotten how.', suits: 'hard' },
    { text: 'Settles things in the street because it is faster.', suits: 'hard' },
    { text: 'Nobody has heard them raise their voice. Nobody wants to.', suits: 'quiet' },
    { text: 'Reads the books personally. Every week, all of them.', suits: 'greedy' },
    { text: 'Would rather buy a district than take one.', suits: 'greedy' },
    { text: 'Has outlasted three men who were supposed to replace them.', suits: 'careful' },
    { text: 'Moves slowly and has never once had to move twice.', suits: 'careful' },
    { text: 'Keeps a lawyer closer than a bodyguard.', suits: 'careful' },
    { text: 'Took it young and is in a hurry about everything.', suits: 'hard' },
    { text: 'Goes to mass, gives to the parish, and is not pretending.', suits: 'quiet' },
  ];

/** Personality deviation applied on top of the family's config weights. */
export const LEADER_BIAS: Record<
  'hard' | 'careful' | 'greedy' | 'quiet',
  { aggression: number; ambition: number; commerce: number; caution: number }
> = {
  hard: { aggression: 0.3, ambition: 0.15, commerce: -0.15, caution: -0.25 },
  careful: { aggression: -0.2, ambition: -0.1, commerce: 0.05, caution: 0.35 },
  greedy: { aggression: -0.1, ambition: 0.1, commerce: 0.35, caution: 0.05 },
  quiet: { aggression: -0.15, ambition: -0.15, commerce: 0.1, caution: 0.2 },
};

/**
 * How old a man is when he takes it.
 *
 * The range used to start at 38, which put every founding boss two decades
 * short of the age where anything can happen to him — so across twenty-four
 * measured worlds only six ever changed hands in twelve years, and a mechanic
 * that exists to make the city change character was invisible in the length of
 * an ordinary career. Some of them should already be old on day one.
 */
export const LEADER_AGE_ON_TAKING: [min: number, max: number] = [44, 67];

/**
 * When a boss stops being the boss.
 *
 * Deliberately a long tail rather than a hard age. A family led by a
 * seventy-four-year-old who will not let go is a more interesting board state
 * than one that swaps leaders on a timer, and both should be reachable.
 */
export const LEADER_DECLINE_FROM = 62;
/** Chance per year of dying or standing down, at the age where it begins. */
export const LEADER_EXIT_BASE = 0.06;
/** ...rising this much per year over the threshold. */
export const LEADER_EXIT_PER_YEAR = 0.035;

/** A handover is a wobble: strength and standing both take a knock. */
export const LEADER_HANDOVER = {
  strengthLost: 8,
  /**
   * How the other families read a house between bosses.
   *
   * Respect, not grudge — they have not done anything to anybody, they have
   * become an unknown quantity. Trust goes too, because whatever understanding
   * existed was with the last man.
   */
  respectHit: -10,
  trustHit: -8,
  /** Weariness forgiven — a new man is not carrying the last man's war. */
  wearinessForgiven: 20,
};
