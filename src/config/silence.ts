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
   * Not near-certain, because a certainty is not a decision — and not a coin
   * flip either, because at even odds the expected cost of trying exceeds
   * dismissal against almost anybody and the button would be decoration.
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
   * And how much, each time.
   *
   * Deliberately smaller than the lump he left on the way out and deliberately
   * unbounded in total. One week of him being at large is survivable; a year
   * of it is a case with your name on the front, which is what makes calling
   * a mark off a decision rather than a saving.
   */
  talksStrength: 5,
} as const;
