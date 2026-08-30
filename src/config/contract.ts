/**
 * Sending people to kill somebody who is not yours.
 *
 * Nobody has ever died on a job. A blown operation injures or arrests, so the
 * five ways to die in this game were: you ordered it, a man who ran was found,
 * you decided somebody was the rat, a war clash, and old age. The operations
 * table reached none of them.
 *
 * Meanwhile `capos.ts` builds a full cast of named rivals with districts,
 * shares of their family's strength, loyalty and ambition — and
 * `approachCapo` lets you buy one. This is the other verb on the same man, and
 * it is deliberately the mirror image in every column:
 *
 *     approach   money · takes his district and his share · leaves a man who
 *                works for you · fails when he says no and tells his boss
 *     contract   money, a piece, and people · takes his share and their
 *                appetite · leaves a body · fails when he lives and knows
 *
 * ## Why this is not rows in the operations table
 *
 * An operation is abstract and untargeted. Killing nobody-in-particular fails
 * the bar the street scene had to pass: the drawn facts must be the fictional
 * facts. A contract points at somebody the player has been watching on the
 * Rivals panel for years, and every consequence it has already exists —
 * `warCasualty` removes a capo, `replaceLeader` changes a family,
 * `pressureWitness` moves a case.
 *
 * ## The one genuinely new thing
 *
 * `beliefs.ts` decides who a family blames, and takes a `care` measure from
 * whoever caused the harm. Nothing had ever handed it a reason to be wrong
 * that the *player* controlled. Provenance is that reason: a cold piece is a
 * careful job, and a family that cannot see clearly blames somebody plausible
 * instead. Two families going to war over something you did is already wired —
 * grudge drives the `ruin` agenda, pressure targeting and war declarations.
 *
 * That is the payoff for a $3,400 cold piece which `ladder.probe` said was
 * missing: on the three acts that existed, carefulness bought a smaller
 * evidence trace and nothing else.
 *
 * Measured over 60 careers a piece, one contract each against the same capo:
 *
 *     cold     36 of 60 blamed somebody else     43 of 60 landed
 *     house    25 of 60                          43 of 60
 *     crate    19 of 60                          43 of 60
 *
 * The landing rate is identical across all three, which is the check that
 * matters: provenance moves who gets blamed and touches the odds not at all.
 * Sixty per cent against thirty-two is the difference between a family with a
 * theory and a family with a certainty, and grudge is what declares wars.
 *
 * ---------------------------------------------------------------------------
 * Abstract game economy, like everything beside it. Costs, odds, durations and
 * consequences. Nothing here describes how anything is done.
 * ---------------------------------------------------------------------------
 */

/** What kind of thing you are sending people to do. */
export type ContractKind = 'capo' | 'boss' | 'witness';

/*
   Measured, and the finding is about *when* rather than whether.

   `ladder.probe`'s `sending people after somebody else's people` arm, 36
   careers each, against the same bot that never sends anybody:

       only at war     161 sent, 94 landed    median $0        17 of 36 ahead
       freely          294 sent, 162 landed   median −$288,425  9 of 36 ahead

   Inside a war it is a genuine choice — dead level on the estate with a wide
   spread either side, which is what a decision looks like. Used unprovoked it
   is ruinous, and the reason is not the money: crew ends at 30 against 31, and
   heat-weeks at 2,061 against 1,977. What it costs is the war it starts.

   That answers the question the autopilot's gate was written against. "Only at
   war" is protecting the player rather than costing them, so it stays — and it
   stays as a rule rather than a threshold, because the thing it prevents is
   not expensive, it is a different game.
*/
export const CONTRACT = {
  /**
   * How many go.
   *
   * Two, and it is the whole reason this competes with the work rather than
   * sitting beside it. A three-man outfit sending two men has sent everybody,
   * which is exactly the pressure `work_it_yourself` exists to relieve and
   * exactly the decision this is supposed to be.
   */
  crew: 2,

  /**
   * What it costs to put together, at price level 1.
   *
   * Read against `CAPO_APPROACH.cost` of $180,000, which is the other way to
   * take a man off the board. A quarter of it, because buying somebody is a
   * pension and this is a week's work — and because the rest of the price is
   * paid in people and in what the family does about it afterwards.
   */
  cost: 45_000,

  /**
   * Days between deciding and it happening.
   *
   * The waiting is most of what makes it frightening, and it is the same
   * reason `marks` plays itself: you decided once and now you read the record.
   * Five days is short enough to be this week's problem and long enough that
   * the men are gone while it matters.
   */
  days: 5,

  /** Before anything about who you sent or who they are going after. */
  base: 0.55,
  /** What the men you sent are worth, at full competence. */
  perCrewSkill: 0.3,
  /**
   * ...and how much harder a man with a neighbourhood around him is to reach.
   *
   * Read off his share of the family, which is the same number `capoWorth`
   * uses — being important is what makes somebody hard to get to, and it is
   * also what makes killing him worth doing. That tension is the decision.
   */
  perTargetShare: 0.45,
  minChance: 0.15,
  maxChance: 0.9,

  /**
   * Chance one of the men you sent does not come back.
   *
   * The first job in this game that can kill your own people, and without it a
   * contract is a button. Higher on a failure because the men who got it wrong
   * are the ones still standing there when it goes bad.
   */
  crewLostOnSuccess: 0.12,
  crewLostOnFailure: 0.35,

  /** What a killing in the street costs in attention. */
  heat: 18,
  /** ...and a botched one, which was seen and survived. Same shape as SILENCE. */
  heatOnFailure: 24,

  /**
   * The trace.
   *
   * Above `SILENCE.evidenceStrength` of 19, because this one had a car, a
   * street somebody else's people watch, and two men who are not from around
   * there. Multiplied by the piece's provenance like every other act.
   */
  evidence: 26,

  /** What burying somebody does to their appetite for continuing. */
  wearinessOnDeath: 12,
  /** What they hold against whoever they decide did it. */
  grudge: 45,
  /** ...and what a botched attempt earns, which is less and never nothing. */
  grudgeOnFailure: 18,

  /** The room watches, and so does the city. */
  fear: 12,
  fearOnFailure: 4,
  respect: 20,

  /** He will be careful for a long time afterwards. */
  cooldownDays: 300,
} as const;

/**
 * The boss, which is a different job wearing the same coat.
 *
 * Multipliers rather than a second table, so the two can never drift apart and
 * the comparison stays legible: harder, dearer, louder, and it earns a family
 * that will not forget. `replaceLeader` is the payoff — the only mechanism in
 * the game by which a family's character changes without waiting for a man to
 * get old.
 */
export const BOSS_CONTRACT = {
  costMultiplier: 3,
  /** He is never as easy to reach as one of his people. */
  chanceMultiplier: 0.6,
  heatMultiplier: 1.6,
  evidenceMultiplier: 1.4,
  /** They will believe it was somebody, and they will not let it go. */
  grudgeMultiplier: 1.6,
  respectMultiplier: 2.5,
  fearMultiplier: 2,
} as const;

/**
 * Somebody the law has lined up, which is the escalation of `pressureWitness`.
 *
 * Leaning on a witness moves a case; this ends one. Aimed at the case rather
 * than at the man, which is what separates it from `silence` — that is about
 * somebody of yours talking in general, and this is about one file.
 *
 * Cheaper and quieter than going after a made man, and it carries the risk
 * `pressureWitness` already documents from the other side: witness tampering
 * is exactly the kind of thing that makes a weak case strong. A dead witness
 * is that at volume.
 */
export const WITNESS_CONTRACT = {
  costMultiplier: 0.6,
  chanceMultiplier: 1.15,
  heatMultiplier: 1,
  evidenceMultiplier: 1,
  /** Case strength taken off when it works. */
  removed: [14, 26] as [number, number],
  /** ...and added when it does not, because now they know why he mattered. */
  backfire: 12,
} as const;
