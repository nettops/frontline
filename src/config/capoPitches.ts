/**
 * The board a boss with people under him actually looks at.
 *
 * The static table listed every open Tier 1+ job as a permanent row and left
 * the picking to the player, every time, no matter how large the organization
 * had grown — a boss who has outgrown the corner should not still be
 * personally reading a twenty-row menu. This is what replaces it: a short,
 * live list of what capos are bringing him, refreshed on the same weekly
 * cadence `DELEGATION.intervalDays` and `VERBS.casingDays` already use.
 *
 * Tier 0 is untouched — see `sim/operations.ts`'s `outgrewStreetWork`. Street
 * work is either gone or the plain manual board; it never becomes a pitch.
 */

export const CAPO_PITCH = {
  /** How many are on the board at once. Few enough to read in one look. */
  count: 3,

  /** He brings you something new this often — the same week `tickDelegation` uses. */
  refreshIntervalDays: 7,

  /**
   * How long an unanswered pitch stays live before he stops waiting on you and
   * takes it elsewhere. Two refresh cycles, the same order of magnitude as
   * `call_in_tribute`'s `cooldownDays: 14` — the one other number in this game
   * that prices "how long before this comes round again".
   */
  windowDays: 14,

  /**
   * How much more often an ambitious capo's pitch gets drafted, next to a man
   * content running his crew — the design brief's "wants more responsibility"
   * read as a standing bias rather than a one-off scripted ask. A capo at 0
   * ambition keeps weight 1 (the old even odds); one at 100 gets weight 2, so
   * the most ambitious man in a two-capo pool brings you roughly twice as many
   * pitches as the least ambitious, not a guarantee, never a lock-out.
   */
  ambitionWeight: 1,

  /**
   * How much a capo who has registered as disfavored `CAPO_FAVORITISM.
   * pitchDisfavorAfter` times over — `capoFavoritism.ts`'s `isPitchDisfavored`
   * — has his own weekly weight cut, for as long as that read stays true.
   * The design brief's "he stops bringing you his best," modeled as bringing
   * you less of it rather than a second stat penalty stacked on the grievance
   * `applyFavoritism` already charges. Halves rather than zeroes: `ambitionWeight`
   * above only ever doubles a man's odds for wanting more, never locks another
   * man out entirely, and this is that same restraint run the other way.
   */
  disfavoredWeight: 0.5,
} as const;

/**
 * How much a passed-over capo's own temperament changes what watching a
 * pitch go to somebody else costs him.
 *
 * The base charge is still `DELEGATION.recallLoyalty`/`recallGrievance` — the
 * same one `capoVouches.ts`'s `Deny` already reuses for the identical snub —
 * this only says whether a *particular* man takes it hard or shrugs it off,
 * the same idiom `sitdown.ts`'s `lands` reads a stat as help and an opposing
 * one as resistance. A man who wants it (ambition) and does not trust you to
 * make it right (loyalty) pays close to double the base charge; a content,
 * loyal one pays a fraction of it. The job's own tier (1..5, tier 3 neutral)
 * nudges the same number a little further — losing the corner store stings
 * less than losing the job he was building his whole career toward.
 */
export const PITCH_REACTION = {
  /** How much wanting it (ambition) adds to the multiplier, at 100 ambition. */
  ambitionWeight: 0.7,
  /** ...and how much trusting you (loyalty) takes back off, at 100 loyalty. */
  loyaltyWeight: 0.7,
  /** How far the job's own tier pushes the same multiplier, tier 3 neutral. */
  importanceWeight: 0.3,
  /** Below this multiplier the snub barely registers. */
  quietBelow: 0.6,
  /** Above this it reads as open resentment rather than a quiet withdrawal. */
  openAbove: 1.2,
} as const;
