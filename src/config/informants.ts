/**
 * Somebody is talking.
 *
 * The third arrangement of the thing this game is actually about. The sit-down
 * is one man across a table and the answer arrives three beats later.
 * Delegation is one man holding a district and the answer arrives over a
 * season. This is the same lesson with the answer withheld altogether: you work
 * out who is talking from what the other side turns out to know, and you have
 * to act on it before you are sure, because waiting is also a decision.
 *
 * What makes it a read rather than a puzzle with an answer in the back:
 *
 * 1. **He only gives away what he was there for.** A leak is about a specific
 *    job, and the game already knows exactly who was on it. That is the
 *    substrate — a column of nights and a list of names each time, and the same
 *    name recurring is the only evidence there will ever be. It also means a man
 *    you never use never gives you away, which is a real strategy and one the
 *    player has to find.
 *
 * 2. **Not every leak is a person.** Agencies do their own work. A case that
 *    turns out to know about a night nobody talked about is the noise the whole
 *    mechanic depends on: without it, three leaks intersect to exactly one man
 *    and the answer is arithmetic. With it, the same three leaks intersect to
 *    one man who might be innocent.
 *
 * 3. **Being wrong has to be worse than being slow.** An accusation is not a
 *    question, and there is no half of one. Kill the right man and the leaking
 *    stops. Kill the wrong man and you have lost him, told the room what you
 *    are prepared to do on a hunch, and taught the real informant to be careful
 *    — and the game still does not tell you which of those two things you did.
 */

export const INFORMANT = {
  /** How often anybody decides anything here. */
  intervalDays: 7,

  // ------------------------------------------------------------- turning ---

  /**
   * Nobody flips out of nowhere.
   *
   * The three gates are the ones the informant-scare event has always used —
   * frightened, unconvinced, and carrying something specific — plus the one it
   * could not check: somebody has to actually be building a case, because a man
   * with nothing to be frightened of has nobody to talk to.
   */
  /**
   * ...and the one of the three that decides nothing.
   *
   * Measured across twelve careers at the weekly check, as the share of
   * man-weeks each gate lets through **on its own**:
   *
   *     boss who...          fear>55   loyalty<38   memory>=1   all three
   *     grinds them daily        76%          18%         85%         15%
   *     works them every 3rd     51%          15%         87%          8%
   *
   * **Loyalty is the binding gate and fear is nearly free.** Fear is the only
   * thing stopping a man in 3% of man-weeks for the first boss and 7% for the
   * second, so moving this number is close to a no-op: it cannot turn anybody
   * who is not already disloyal and carrying something.
   *
   * That is written here because it looks like the opposite. Crew fear rests
   * at a median of 71 for a working crew once `settleFear` is doing its job,
   * which reads as "everybody clears the bar" — true, and not the same thing
   * as "the bar decides who talks". Raising it makes an already-rare mechanic
   * rarer and changes nothing else.
   *
   * **And the rate is fine, which took a probe to establish.** Counting
   * informants alive says nothing — `tickInformants` runs the flip loop only
   * while nobody is talking, so one at a time is the designed ceiling and not
   * a rate. Measured properly by *occupancy*, over 24 careers each with
   * nothing planted:
   *
   *     boss who...          ever had one   days somebody was talking   first turned
   *     grinds them daily          24/24                         65%         day 105
   *     works them every 4th       21/24                         40%         day 182
   *
   * So the mechanic reaches nearly every career, occupies a large part of it,
   * and answers strongly to how the crew is worked. It is not rare and it was
   * never the thing that needed fixing. See `informants.probe`, which had only
   * ever measured whether a *planted* informant could be read.
   */
  fearAbove: 55,
  loyaltyBelow: 38,
  /** Weight from what he is carrying, via `informFromMemory`. */
  memoryAtLeast: 1,
  flipChancePerWeek: 0.055,
  /** Multiplied in when he has been arrested and let go — the classic route. */
  arrestedMultiplier: 2.4,

  // -------------------------------------------------------------- talking --

  /** Chance per week that an active informant hands over a specific night. */
  leakChancePerWeek: 0.5,
  /**
   * How far back a job stays worth talking about — and, because it is the same
   * number, how far back the page goes. Both columns the player compares are
   * measured over this one window, or they are not comparable at all.
   */
  recallDays: 180,
  /** Evidence a leak is worth, before the agency's own absorption. */
  leakStrength: [10, 20] as [number, number],

  /**
   * Chance per week that a case learns something with nobody behind it.
   *
   * The number the whole mechanic turns on, swept in `informants.probe.test.ts`
   * over 30 worlds each, measuring whether the plainest possible reading of the
   * page — whichever name appears on the most of the nights — lands on the man
   * who was actually talking after forty weeks:
   *
   *   0.15   named him in 16 of 31
   *   0.30   named him in 15 of 29
   *   0.55   named him in 11 of 30
   *
   * Roughly half, against a one-in-ten base rate for picking a crew member out
   * of the air. That is the whole design in one figure: the record is worth
   * five times a guess and is still a coin flip, so it is evidence rather than
   * an answer, and acting on it alone is a real risk rather than a formality.
   *
   * 0.30 over 0.15 because the difference between them is inside the noise at
   * thirty worlds, and the higher figure is the one that keeps a quiet, careful
   * player's page from resolving to a single name by arithmetic.
   */
  coldLeakChancePerWeek: 0.3,
  coldLeakStrength: [5, 12] as [number, number],

  /** Leaks kept. More than `recallDays` can hold, so the window does the work. */
  ledgerLength: 40,

  // ----------------------------------------------------------- the accusation --

  /** He is gone either way. What differs is everything after. */
  correctRespect: 14,
  correctFear: 9,
  /** What the room takes from watching you do it, right or wrong. */
  anyLoyaltyHit: -5,
  anyFearGain: 6,

  /**
   * ...and what it takes from watching you do it to somebody who was not.
   *
   * Deliberately heavier than the correct case by a multiple rather than a
   * margin. This is the cost that makes waiting worth something, and the player
   * is never told which one they paid.
   */
  wrongLoyaltyHit: -16,
  wrongGrievance: 20,
  wrongRespect: -10,
  /** Men who were close to him take it as a bereavement, because it is one. */
  closeTrustAbove: 55,
  wrongCloseLoyaltyHit: -14,

  /** Killing one of your own, whoever he was. */
  heat: 7,
  evidenceStrength: 16,

  /**
   * How long the real informant goes quiet after you kill somebody else.
   *
   * He has just watched what happens to whoever you decide it is. He does not
   * stop; he stops for a while, which is worse, because the record goes quiet
   * and quiet reads like having solved it.
   */
  cautiousDays: 56,
} as const;
