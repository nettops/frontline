/**
 * The men under the other bosses.
 *
 * A rival family used to be four numbers and a name. It made decisions, it
 * fought wars, it could be talked to — but there was nothing *inside* it, so
 * the only way to hurt one was to take its ground, and the only thing that ever
 * changed its character was the boss dying of old age.
 *
 * A capo is a small, specific handle on a large organization:
 *
 *   he holds a district        so taking it from him is personal
 *   he holds a share of them   so losing him costs them measurably
 *   he wants the top job       so a weak boss is a real problem for them
 *   he can be bought           so there is a way in that is not a war
 *
 * Deliberately *not* a full roster. Three to five named men per family, not
 * forty — the player is going to read this list on one panel, and a rival with
 * a hundred nobodies is a spreadsheet rather than an organization.
 */

export const CAPO_COUNT: [min: number, max: number] = [3, 5];

/** Age on being made. They age with everybody else. */
export const CAPO_AGE: [min: number, max: number] = [31, 58];

/**
 * How much of the family a capo is.
 *
 * Rolled per man and then normalised so the crew never adds up to more than
 * the family. At the top of this range one man walking out takes better than a
 * quarter of an organization with him, which is what makes turning one worth
 * the money it costs.
 */
export const CAPO_SHARE: [min: number, max: number] = [0.1, 0.28];

/** Weekly drift in what he thinks of the man above him. */
export const CAPO_DRIFT = {
  /** Baseline pull back toward content. Most weeks, nothing happens. */
  settle: 0.35,
  /** A war that is not going well. */
  atWarLosing: -1.6,
  /** ...and one that is. Nothing binds a family like winning. */
  atWarWinning: 0.7,
  /** A boss with no money is a boss who is not paying anybody. */
  brokeBelow: 60_000,
  brokePenalty: -1.1,
  /** An ambitious man in a family that is doing nothing gets restless. */
  idleAmbitionWeight: -0.012,
  /** Somebody took his district off him. He does not blame them. */
  districtLostPenalty: -9,
};

/**
 * When he goes, and where.
 *
 * The threshold is low on purpose. A defection should be the end of two or
 * three years of a family going wrong, not a coin flip every quarter — which is
 * why the drift above settles toward contentment by default and only moves on
 * facts the player could have seen.
 */
export const CAPO_DEFECTION = {
  /** Below this he starts looking around. */
  loyaltyBelow: 22,
  /** Weekly chance once he is, scaled by how far below and how ambitious. */
  baseChance: 0.02,
  perPointBelow: 0.0025,
  ambitionWeight: 0.03,

  /** He does not go to somebody who is losing. Minimum strength to receive. */
  receiverMinStrength: 25,
  /** What the family he left thinks of the family that took him. */
  grudge: 26,
  /** ...and what it does to the boss he walked out on. */
  standingHit: 8,
};

/**
 * Buying one.
 *
 * The only route into a rival organization that is not a war, and the most
 * expensive single action in the game. It is priced against the whole point of
 * it: a successful approach is worth a district and a fifth of a family, and a
 * failed one hands them a grievance with your name written on it in a
 * legible hand.
 */
export const CAPO_APPROACH = {
  /** Cost at price level 1, before what he thinks of his boss. */
  cost: 180_000,
  /** A contented man is not cheaper to buy, he is dearer. */
  costPerLoyaltyPoint: 4_200,
  /** Standing you need before he will meet you at all. */
  minRespect: 200,
  /** Intel you need on his family before you know who to ask for. */
  minIntel: 45,

  /** Base chance, before everything below. */
  baseChance: 0.25,
  /** Every point of disloyalty helps. */
  perPointDisloyal: 0.009,
  /** Being feared helps here more than being liked does. */
  fearWeight: 0.2,
  standingWeight: 0.1,
  /** An ambitious man likes being offered something. */
  ambitionWeight: 0.15,

  /** He is a made man walking into your organization. They notice. */
  onSuccessGrudge: 34,
  onSuccessFear: 6,
  /** And when he says no, he tells his boss, because that is what loyalty is. */
  onFailureGrudge: 20,
  onFailureRespect: -12,
  /** He will not take another meeting for a long time. */
  cooldownDays: 400,
};

/** Their share of the family comes with them, and some of their district. */
export const CAPO_TRANSFER = {
  /*
   * Share of his district influence that moves with him.
   *
   * Measured at 0.60, 0.45, 0.35 and 0.25 across 24 worlds x 12 years. At 0.45
   * and above, ground concentrates faster than any family can be made to spend
   * — the worst world ended with one organization on eleven districts and
   * $7.2m, against a game that had never previously let anybody past seven.
   * 0.35 keeps a defection worth having without turning it into a bloodless
   * conquest: he takes his people, not his neighbourhood.
   */
  influenceShare: 0.35,
  /** Strength the receiving family gains, as a share of what he was worth. */
  strengthKept: 0.75,
};

/** A war can reach a named man, which is what makes one legible. */
export const CAPO_WAR = {
  /** Chance per losing clash that the loser loses a capo rather than points. */
  deathChance: 0.06,
  /** What burying him does to the family's appetite for the war. */
  wearinessOnDeath: 14,
  /** A family this weak keeps the men it has left. See warCasualty. */
  protectedBelow: 30,
};

/**
 * Who takes over when the boss stops.
 *
 * Claim is what everybody in the room can see: how long he has been there, how
 * much of the family answers to him, and whether he ever looked like he wanted
 * it. The man with the strongest claim becomes the boss; if the runner-up was
 * close, he does not take it well, and that is a defection two years from now
 * with a reason behind it.
 */
export const CAPO_SUCCESSION = {
  yearsWeight: 1.2,
  shareWeight: 90,
  ambitionWeight: 0.3,
  /** Within this much of the winner and he considers himself passed over. */
  closeMargin: 12,
  passedOverLoyalty: -30,
};
