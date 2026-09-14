/**
 * What a real gap in organizational power does between two capos.
 *
 * `capoStanding.ts` gives each capo a 0..3 read of how much he has actually
 * built. This is the one number that read needed to earn its keep: how far
 * apart two of those reads have to be before the gap itself is a fact the
 * weaker man's own tie can carry, rather than a difference nobody in the
 * organization is presumed to notice.
 */

export const CAPO_TENSION = {
  /**
   * Tiers of `capoStanding` apart before a gap counts as real rather than
   * ordinary variation between two men doing the same job. `capoStanding`'s
   * own scale is 0..3, so this is already better than half the range —
   * title-only next to dangerous, or rising next to dangerous — not two men
   * one rung apart on the same ladder.
   */
  gapTiers: 2,

  /**
   * How often the pass looks at all. Same cadence `tickDelegation` and
   * `CAPO_PITCH.refreshIntervalDays` already use for a weekly organizational
   * check, reused rather than picked fresh — this is that same shape of
   * system, not a reason for a different number.
   */
  checkIntervalDays: 7,

  /**
   * How long a pair that has already registered the gap goes before it can
   * register again. `capoStanding`'s four inputs (headcount, leadership,
   * ground, earnings) all move slowly, so a gap once written is true for
   * months, not days — a weekly check with no cooldown would refire on the
   * same two men every week for as long as the gap holds, which is not a new
   * fact forty-odd times over.
   *
   * Sized off `eventgen.ts`'s own cooldown range for recurring organizational
   * beats (8-45 days) rather than `CAPO_VOUCH.cooldownDays` (14, a player's
   * own deferral) or `CAPO_APPROACH.cooldownDays` (400, a single big ask) —
   * neither of those is this shape of thing. Placed at the top of that range
   * because a standing gap is a slower-moving fact than a narrative beat.
   */
  cooldownDays: 45,
} as const;
