/**
 * The other way somebody leaves.
 *
 * `dismiss` in `sim/crew.ts` was the only answer the organization screen had to
 * a man who kept costing money, and it has always had a real price: he goes out
 * onto the street knowing how you work, and the game files evidence for it —
 * `source: 'informant'`, scaled by how well he knew the operation. Cutting a bad
 * earner loose has never been free.
 *
 * But it was the *only* answer. The one killing this game offered was `accuse`,
 * which refuses unless something has already come back to you: *"Nothing has
 * come back to you yet."* That is correct for what it models — an accusation is
 * a read on a column of names — and it means a man could botch six jobs in a row
 * and the only available response was to hand the Bureau a witness.
 *
 * **Deliberately ungated.** Any man, any day, no precondition. The restraint is
 * the bill and not a rule, which is the same stance `config/delegation.ts`
 * takes: the game does not stop you doing something stupid, it charges you for
 * it and lets you read the record afterwards.
 *
 * Four prices, and the second is the one that makes the first worth paying:
 *
 * 1. **It can go wrong.** Then he lives, he leaves, and he knows exactly what
 *    you tried — which is strictly worse than never having tried.
 * 2. **It buys real silence.** No informant trace, ever. That is the purchase.
 * 3. **The room finds out.** Fear up across everybody, loyalty down among the
 *    men who were close to him. Both already drive wages, defection and
 *    informing, so this couples through paths that exist.
 * 4. **His people remember**, as `lost_a_friend` — weight 65, fading 7 a year
 *    to a floor of 14. It does not clear.
 */

export const SILENCE = {
  /**
   * The chance it goes the way you wanted, before anything about the man.
   *
   * **Swept, and the money could not choose.** Against the same 36 seeds, read
   * on both use-patterns, with `MARK.talksHeat` held at 2.5:
   *
   *     base    first-time   sparingly            freely
   *     0.60    41%          16/34 at −$14,454    7/36 at −$1,243,038
   *     0.72    53%          16/34 at −$29,919    7/36 at   −$790,433
   *     0.84    68%          20/34 at +$99,978   10/36 at   −$715,135
   *
   * 0.84 is disqualified outright: careful use at +$99,978 on 20 of 34 is a
   * free upgrade, which is the one thing this must never be.
   *
   * 0.60 and 0.72 are **indistinguishable on money** — a shade over 1% of a
   * $2.1M estate apart, on the identical 16 of 34. That is inside the noise
   * floor this instrument has hit three separate times, so the estate does not
   * get to choose and pretending otherwise would be reading tea leaves.
   *
   * So it is chosen on the direct quantity, the way `crewSkill.floor` decided
   * teaching when the estate could not. At 0.60 the act usually goes wrong and
   * silencing becomes a manhunt you start rather than a thing you do; at 0.72
   * it is a coin flip weighted slightly your way, which you can commit to and
   * still lose. That is the character it wants.
   */
  base: 0.72,

  /**
   * How much harder a careful man is to reach.
   *
   * Read off the same two stats `crewCompetence` reads and in the same
   * proportion, because being hard to get to is the same quality as being good
   * at the work — a man who notices things notices this. Subtracted at full
   * competence, so your best earner is also your most expensive to remove,
   * which is the trade worth having.
   */
  perCompetence: 0.34,

  /** Floor and ceiling, so it is never hopeless and never a formality. */
  minChance: 0.25,
  maxChance: 0.92,

  /** What a body on the street costs in attention. */
  heat: 9,

  /** What a botched attempt costs, which is louder — it was seen and survived. */
  heatOnFailure: 13,

  /**
   * The trace left when it works.
   *
   * `source: 'violence'`, which a different set of agencies work and which
   * decays on its own schedule. Sized above `INFORMANT.evidenceStrength` of 16
   * because that killing at least had a reason the street could see.
   */
  evidenceStrength: 19,

  /**
   * And when it does not work.
   *
   * He files what a dismissed man files and more, because he is not merely
   * somebody who knows how you operate — he is somebody who can say you tried
   * to have him killed, and he has every reason to. Added on top of the
   * ordinary dismissal trace rather than replacing it.
   */
  evidenceOnFailure: 14,

  /** What the room takes from watching it happen. */
  fear: 8,
  fearOnFailure: 5,

  /**
   * Loyalty taken from a man who was close to him, at the strongest tie.
   *
   * Scaled by trust, so somebody who merely worked beside him barely registers
   * it and somebody who came up with him does not forgive it.
   */
  loyaltyPerTrust: 0.22,

  /** Trust above which somebody counts as having been close to him. */
  closeAbove: 25,

  /**
   * How well you had to know him for his death to land as a loss.
   *
   * The perception system's own threshold for knowing a man at all. Below it
   * the crew register a killing and not a friend, which is what the fear term
   * is for.
   */
  knewHimAbove: 40,
} as const;

/**
 * And the family does not try once.
 *
 * `silence` shipped as a single roll — it landed, or the man walked away and
 * was never troubled again. Nothing about this world works that way. The
 * reason the answer is frightening is that it does not expire: a man who is
 * wanted stays wanted, and everybody involved knows it.
 *
 * So a botched attempt leaves a mark, and the mark keeps working on its own.
 * You decided once; from here you read the record. Same stance as a standing
 * order and the same stance as handing a man a district.
 *
 * **What stops it being a free retry is that he is talking the whole time.**
 * Every few days he is out there and breathing, he gives away more. A mark is
 * a race between your people finding him and his mouth burying you — not a
 * queue of rolls you eventually win. Two more things hold the shape: the odds
 * fall every time somebody misses, because he knows they are looking; and he
 * can get beyond reach altogether, at which point you did not get him and you
 * still paid for everything he said.
 */
export const MARK = {
  /** How often somebody goes looking. */
  everyDays: 9,

  /**
   * Where the odds start, against a man who has already survived one attempt.
   *
   * Below `SILENCE.base` because he is not sitting at home any more. He has
   * left the places he used to be, and the first thing he did was stop being
   * where you would look.
   */
  base: 0.34,

  /**
   * What each miss takes off, as a share of what is left.
   *
   * A share rather than a flat figure, the same repair the heat meter and the
   * teaching curve both carry: a flat rate would run to zero in a fixed number
   * of tries whoever he was, and the interesting cases are the ones where he
   * nearly got away.
   */
  colderPerMiss: 0.22,

  /**
   * Below this he is gone — relocated, protected, or simply somewhere nobody
   * you know has ever been. The mark lapses and everything he said stays on
   * the books.
   */
  hopelessBelow: 0.05,

  /** What one more crew of yours asking after him costs in attention. */
  heatPerTry: 4,

  /** And what it costs when they find him. Loud, and the street knows why. */
  heatOnLanding: 7,

  /** The trace a man in the ground leaves, same as any other killing of yours. */
  evidenceOnLanding: 19,

  // ---------------------------------------------------------- his mouth ---

  /** How often a man nobody has found yet tells somebody something. */
  talksEveryDays: 11,

  /**
   * The trace he leaves each time, which turned out to be decoration.
   *
   * **Swept at 2.5, 5 and 10 and it changed nothing to the dollar.** Both
   * use-patterns returned identical estates across a fourfold change, because
   * this feeds case-building and the case meter already reads 100 on every arm
   * — an ordinary career saturates it without any help. Evidence added to a
   * full meter goes nowhere.
   *
   * That is worth leaving here rather than deleting, because the header of
   * `marks.ts` claimed for a while that this was the property the whole
   * mechanic rested on. It was not. It is kept because a trace should exist
   * where a man has talked, and it is not what makes him expensive.
   */
  talksStrength: 5,

  /**
   * What actually costs you, and the symmetry that names it.
   *
   * `dismiss` takes `DISMISS_HEAT_REDUCTION` off the **inside** channel, on
   * the reasoning recorded there: cutting somebody loose cuts an inside
   * thread, and that is the one channel going quiet cannot touch. A man who
   * got away from you and is talking is the same thread being spliced back on.
   *
   * Heat rather than evidence because heat is not saturated — careers sit near
   * 47 of 100 after the decay repair — so this lands somewhere with room,
   * bites directly through `heatSuccessPenalty` and the lay-low decision, and
   * only then feeds the case system at the rate that system chooses.
   *
   * **Swept once it was routed somewhere that could feel it**, with
   * `SILENCE.base` held at 0.72:
   *
   *     talksHeat   sparingly            freely
   *     1.0         20/34 at +$63,728   10/36 at −$645,504
   *     2.5         16/34 at −$29,919    7/36 at −$790,433
   *     5.0         16/34 at −$99,745    6/36 at −$989,893
   *
   * Monotonic and real, where the evidence version returned the same figure to
   * the dollar across a fourfold change. At 1.0 careful use drifts to a free
   * upgrade; at 5.0 it becomes a trap worth avoiding entirely. 2.5 leaves it at
   * −$29,919 on 16 of 34 — 1.4% of an estate and a coin flip, which is as
   * close to free as this instrument can resolve.
   */
  talksHeat: 2.5,
} as const;
