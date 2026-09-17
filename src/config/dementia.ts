/**
 * The capo who cannot be trusted with what he knows, and is owed everything.
 *
 * `aging.ts` already lets a man decline, retire, and die in his bed. What it
 * could not produce was the specific crisis this world is actually built for:
 * an old man who made you, who has been beside you for thirty years, and who
 * has started saying things in public that only four people alive were
 * supposed to know. He has not betrayed anybody. He is not an informant. He
 * is simply going, and every week he is out on his own is another two points
 * on a file with your name at the top of it.
 *
 * Three answers and the design is entirely in what each one costs:
 *
 * **Green Grove.** A private sanitarium, billed monthly, out of clean money.
 * It works completely — he is insulated from the public and from the wire,
 * because he is somewhere nobody can get to him and nobody can record him.
 * What it costs is a standing bill in the one pool `rank` progression is
 * gated on, forever, for a man who will never earn again.
 *
 * **A man on the door.** Free in money and expensive in bodies: a soldier
 * goes to sit in his house and is off the roster for as long as he is there.
 * That is the cheapest answer for a rich boss and the most painful one for a
 * small crew, which is the right way round.
 *
 * **The other thing.** Instant, total, free, and it detonates the half of
 * your organization that remembers who he was. Every relic on the roster
 * takes it personally, and they are exactly the men whose loyalty was
 * holding the place together.
 *
 * Doing nothing is a fourth answer and it is a real one: a slipped tongue is
 * a chance, not a certainty, and a boss with no open case has nothing for a
 * slipped tongue to land on. The bill only arrives once there is a file.
 */

/**
 * What is currently being done about him.
 *
 * `active` is the untended state and it is the one that costs — he is still
 * out, still in the social club, still talking. The other two are the answers
 * that cost money and bodies. The hit is not a care status because it is not
 * care: a man who has been dealt with is dead, and `Npc.status` already says
 * so without a second field agreeing with it.
 *
 * Declared here rather than in `sim/dementia.ts` so `types.ts` can name it
 * without importing a simulation module — the same shape `LightEnvelopeDilemma`
 * and `AutopilotRisk` already take. `sim/dementia.ts` re-exports it.
 */
export type DementiaCareStatus = 'active' | 'golden_cage' | 'house_guard';

export const DEMENTIA = {
  /**
   * Age from which the yearly pass starts asking.
   *
   * Above `AGING.declineFrom` and below `AGING.deathFrom`, so this occupies
   * the decade a man is visibly slowing but is nowhere near dying — the years
   * in which a boss would actually have to decide something rather than wait.
   */
  onsetAge: 60,

  /**
   * Chance per year, per eligible capo, once he is over `onsetAge`.
   *
   * Flat rather than rising with age, unlike `AGING`'s death and retirement
   * curves. Those model something that gets likelier every year; this models
   * something that either starts or does not, and a flat 12% already means
   * most men who live long enough in this job will face it — roughly even
   * odds inside six years, which for a capo made at forty is one career.
   */
  onsetChanceAnnual: 0.12,

  /**
   * What Green Grove bills, per month, in clean money.
   *
   * Sized against the weekly wage bill rather than against a score: this is a
   * recurring cost that has to be carried out of the legitimate side, and the
   * comparison a player actually makes is "what else could that clean money
   * have been doing". Roughly a made man's monthly wage for somebody who is
   * not on the roster at all.
   */
  goldenCageCostMonthly: 1_200,

  /** How often that bill arrives. Four weeks, on the weekly tick. */
  goldenCageIntervalDays: 28,

  /**
   * Evidence a slipped tongue puts on a file, when it happens.
   *
   * The same order as `CONFIDANT.wiretapEvidenceWeekly` (2.0) and
   * `TRADECRAFT.wiretapInterceptionEvidence` (2.5) — the three things in this
   * game that feed a case from outside the agency's own work all cost about
   * the same, which is deliberate. What makes this one frightening is not the
   * size, it is that it repeats every week until somebody does something.
   */
  slippedTongueEvidenceWeekly: 2.0,

  /**
   * How often the week actually produces one.
   *
   * Not every week, because a man going is not gone — he has good days. At
   * 35% a boss who ignores it entirely loses roughly one file's worth of
   * ground a month, which is slow enough to be a decision and fast enough to
   * be a real one.
   */
  slippedTongueChanceWeekly: 0.35,

  /**
   * What every relic on the roster carries after a hit on one of their own.
   *
   * Larger than anything else in the game that moves grievance in a single
   * step — `DELEGATION.recallGrievance` and `PROMOTION.grievanceRelief` are
   * both in the teens. That is the point: this is the worst thing a boss can
   * do to the men who made him, and the number has to say so without a
   * paragraph of prose to help it.
   */
  relicGrievanceOnHit: 35,

  /**
   * ...and what it takes off their loyalty, for the same reason. Negative, so
   * it reads at the call site as the thing it is.
   */
  relicLoyaltyHitOnHit: -25,
} as const;
