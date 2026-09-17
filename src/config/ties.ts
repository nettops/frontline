/**
 * What the people in your organization think of each other.
 *
 * The story the design document asks for — A wants a promotion, B blocks him,
 * A resents B, a rival offers A protection, A defects and takes a district
 * with him — was not representable before this file existed. There was nowhere
 * in the state to put "resents B". Every relationship in the game ran through
 * the player or through the faction matrix, and the crew was a set of isolated
 * people who happened to share an employer.
 *
 * The implementation is deliberately sparse. Not an all-pairs matrix: an edge
 * exists only because something happened between those two, it carries three
 * dimensions rather than one score, and each person holds at most `MAX_TIES`
 * of them. That keeps a forty-man organization at a few hundred numbers
 * instead of sixteen hundred, and — more importantly — means every tie in the
 * game can be traced back to an incident the player could have witnessed.
 */

/**
 * Why a tie exists. Stored on the edge so the crew sheet can say what happened
 * rather than printing three numbers at the player.
 */
export type TieCause =
  | 'worked_together'
  | 'passed_over'
  | 'dispute'
  | 'took_the_blame'
  | 'owes_money'
  | 'lost_the_room'
  | 'saved_him'
  | 'crowded_ground'
  | 'generational_clash';

export const TIE_CAUSE_TEXT: Record<TieCause, string> = {
  worked_together: 'have worked together',
  passed_over: 'watched them take something they wanted',
  dispute: 'fell out badly',
  took_the_blame: 'carried something for them',
  owes_money: 'owes them money',
  lost_the_room: 'lost the room to them',
  saved_him: 'got them out of something',
  crowded_ground: 'has ground that runs up against theirs',
  generational_clash: 'is from a different era of this business',
};

/** Most ties one person can hold. The oldest and weakest is dropped first. */
export const MAX_TIES = 8;

/**
 * What each kind of incident writes. Trust and resentment are independent —
 * two men can rate each other highly and still be owed something, which is
 * most of the interesting cases.
 */
export const TIE_EVENTS: Record<
  TieCause,
  { trust?: number; resentment?: number; debt?: number; mutual?: boolean }
> = {
  /** A job that went well together. Slow, small, and the most common edge. */
  worked_together: { trust: 6, mutual: true },
  /** Somebody else got the promotion, the naming, or the district. */
  passed_over: { resentment: 22, trust: -8 },
  /** The crew dispute event, resolved in somebody's favour. */
  dispute: { resentment: 18, trust: -14 },
  /** He was arrested or hurt on a job that was somebody else's idea. */
  took_the_blame: { resentment: 14, debt: 20 },
  /** Straightforward. Debt inside an organization is leverage. */
  owes_money: { debt: 30 },
  /** A succession contest that went the other way. */
  lost_the_room: { resentment: 30, trust: -18 },
  /** Pulled him out of something. The strongest positive edge there is. */
  saved_him: { trust: 24, debt: -25, mutual: false },
  /**
   * Two capos whose ground shares a border. Unlike `lost_the_room`, neither
   * man outranks the other here — proximity is the fact, not a result — so
   * this lands on both ties at once. Smaller than `lost_the_room`'s 30/-18:
   * a shared border is a standing irritant, not a real defeat.
   */
  crowded_ground: { resentment: 20, trust: -6, mutual: true },
  /**
   * A relic and a tracksuit, in the same chain of command. Mutual like
   * `crowded_ground` and for the same reason — neither man outranks the
   * other in the thing they disagree about, and both of them think the other
   * one is going to get everybody arrested.
   *
   * Smaller than `crowded_ground`'s 20, larger on trust than its -6: two
   * capos sharing a border is an irritant about ground, and this is an
   * irritant about judgement. A man who thinks you are reckless does not
   * resent you more for it; he trusts you less.
   */
  generational_clash: { resentment: 16, trust: -10, mutual: true },
};

/**
 * How ties feed back into the weekly drift.
 *
 * Kept small per point. These are read every week for every tie a person
 * holds, so anything larger turns an ordinary organization into a civil war
 * inside two months — which the first tuning pass did, and it read as
 * everybody hating everybody for no visible reason.
 */
export const TIE_DRIFT = {
  /** Loyalty lost per week per point of resentment toward somebody still here. */
  resentmentLoyalty: -0.012,
  /** ...and gained for having people here he actually rates. */
  trustLoyalty: 0.008,
  /** Resentment fades if nothing feeds it. Slower than a grievance does. */
  resentmentDecayPerWeek: 0.6,
  /** Trust fades faster, because it needs upkeep and grudges do not. */
  trustDecayPerWeek: 0.35,
  /** Below this a tie is not worth keeping in the save. */
  forgetBelow: 3,
};

/** What ties do at the moment the chair is empty. */
export const TIE_SUCCESSION = {
  /** Claim added per point of trust held by *other* senior people in him. */
  claimPerTrust: 0.0022,
  /** ...and lost per point of resentment they hold toward him. */
  claimPerResentment: -0.0026,
};

/** What ties do when somebody leaves. */
export const TIE_DEPARTURE = {
  /**
   * Trust points needed in a leaver before it is worth trying to follow him.
   *
   * Was 45, which measured out as just above the ceiling: two years of real
   * play with the same men on the same jobs produced a maximum trust of 42, so
   * the most consequential thing the tie system does — a defector taking
   * people with him — could not actually happen. A threshold nothing reaches
   * is a feature that does not exist.
   */
  followTrustAbove: 34,
  /** Chance a man who trusts a defector that much goes with him. */
  followChance: 0.3,
  /**
   * Most of the organization one man can take with him, as a share.
   *
   * Uncapped, this was fine in a large organization and fatal in a small one:
   * losing four of twenty is a crisis, losing four of six is the end, and the
   * balance bot started losing whole runs to a single defection cascade. An
   * organization does not evaporate because one capo left.
   */
  followMaxShare: 0.34,
  /** Loyalty knocked off everybody who trusted him and stayed. */
  stayerLoyalty: -6,
};

/** Chance a completed job writes a `worked_together` edge between two of the crew. */
export const TIE_FROM_OPERATION = 0.45;

/**
 * How much who two people *are* changes what a shared job builds between them.
 *
 * `worked_together` used to land identically on any pair — a `loyalist` and a
 * `greedy` man built exactly the same trust from the same job as two
 * `old_school` men. Sparse on purpose: most trait pairs are simply different,
 * not opposed, and `TraitDef.clashesWith` is only populated for the pairs that
 * genuinely read as a clash. New, conservative, not yet probe-measured.
 */
export const TIE_COMPAT = {
  /** Multiplies a tie event when both people share a trait. */
  sameTraitMult: 1.25,
  /** Multiplies a tie event when one holds a trait the other's clashes with. */
  clashTraitMult: 0.65,

  /**
   * Peer contagion: a job that already found two well-trusted people together
   * lets one's grievance nudge the other's — a real grapevine, rather than
   * every tie being a static, independent modifier. Trust needed, both
   * directions, before this fires at all.
   */
  contagionTrustAbove: 40,
  /** How far the junior of the pair moves toward the senior's reading. */
  contagionJuniorPull: 0.05,
  /** ...and how far the senior moves toward the junior's — inertia, not none. */
  contagionSeniorPull: 0.015,
};
