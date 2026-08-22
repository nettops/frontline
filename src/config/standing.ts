/**
 * What carrying the work does to somebody, and what being left out of it does.
 *
 * The recurring decision in this game was "which two or three jobs can I
 * afford, and who is free". A blind playtester played a hundred and
 * seventy-nine days of it and put the moment their decisions stopped changing
 * at day sixty. What was missing was any consequence to *who* went.
 *
 * The thresholds are ratios rather than counts, because the raw number of
 * nights is small and moves with how busy the whole organization is. A man who
 * went out twice in eight weeks is being worked hard in a quiet season and
 * ignored in a busy one, and the crew average is the only thing that knows
 * which. Measured before any of this was written: a median of 3 nights per
 * person per eight-week window, 84% of readings above zero, and a spread from
 * 0 to 33 — so the ratio has something to read even though the median is low.
 *
 * Every number here is set against the `spread` probe rather than by feel. Its
 * whole job is to show whether a boss who always sends the same three men ends
 * up somewhere different from one who rotates. If it does not, these numbers
 * are wrong, and no amount of adjusting the prose above them will help.
 */
export const STANDING = {
  /** How far back "lately" reaches. Eight weeks. */
  windowDays: 56,

  /**
   * Above this share of the crew average, a man knows he is load-bearing.
   *
   * The pre-check put 17% of person-readings above this line, which is often
   * enough to be a mechanic and rare enough to mean something when it happens.
   */
  carryAbove: 1.6,

  /**
   * Below this share, a man knows he is not being used.
   *
   * The same pre-check put 25% of readings below this line. That is a quarter
   * of the crew aggrieved every week, which is closer to relentless than to
   * pointed, so this is the first number the `spread` probe should be asked
   * about.
   */
  benchBelow: 0.4,

  /** Days in the crew before the bench mark applies. A new hire is not snubbed. */
  settledAfterDays: 21,

  /**
   * What carrying it does.
   *
   * He does not get more loyal for it, and that is the whole point. The man
   * who does the most work is at the same time the most expensive to keep and
   * the most damaging to lose. Greed rather than a new field, because
   * `wageExpectation` in npc.ts already reads greed — raising it *is* raising
   * his price, through the path that exists.
   */
  carry: {
    ambition: 1.5,
    greed: 1.2,
  },

  /** What being left out does. Not because you did anything to him. */
  bench: {
    loyalty: -2,
    grievance: 3,
  },
} as const;
