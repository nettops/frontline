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

  /**
   * How many times the Boss can let `capo_political_tension` sit — on this
   * exact pair — before its own next legitimate re-fire (still gated by its
   * own `cooldownDays`) stops treating the complaint as a first-time thing:
   * open text instead of sideways, `danger` instead of `warning`, and a real
   * cost to letting it go again where the first time cost nothing. Same
   * count `CAPO_FAVORITISM.pitchDisfavorAfter` and `seedFollowup`'s other two
   * call sites (`events.ts`'s `tolerated_skimming`, `eventgen.ts`'s
   * `let_take_go`) already use for "not a first offense, but not a whole
   * pattern either" — reused rather than picked fresh. Addressing it resets
   * the count to zero; only `let_it_sit` grows it.
   */
  escalateAfter: 2,

  /**
   * Age from which a capo reads as a relic whether or not he carries the
   * `old_school` trait.
   *
   * `AGING.declineFrom` is where a man's hands start going and the yearly
   * pass begins taking skill off him; this is deliberately the same
   * neighbourhood. A capo who has been doing this long enough to be visibly
   * declining is a man whose way of doing it predates the thing the young
   * ones are doing, and the trait is then a description of him rather than
   * the only route in. Below `capo` it does not apply at all — a fifty-
   * year-old soldier is not anybody's institution.
   */
  relicAge: 50,

  /**
   * ...and the age below which a man reads as a tracksuit without the trait,
   * given the disposition to go with it.
   *
   * Age alone is not enough and is not supposed to be. A disciplined young
   * man is simply a young man; what makes him the other half of the fracture
   * is wanting a great deal quickly and not much minding how it looks, which
   * is the two stats below.
   */
  tracksuitAge: 35,

  /** Greed at or above this, with the age, reads as a modern earner. */
  tracksuitGreedAbove: 60,

  /** ...and discipline below this. Same bar `TRADECRAFT` uses for the phone. */
  tracksuitDisciplineBelow: 45,
} as const;
