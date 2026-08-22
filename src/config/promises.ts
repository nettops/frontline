/**
 * Things you said you would do.
 *
 * The sit-down could already put a man's grievance on the table and answer it
 * with a promise — "you have the next one", "you are covered" — and the promise
 * cost nothing, because nothing in the simulation ever came back to check. A
 * flag was written and never read. That made the strongest register in the
 * conversation the cheapest thing in the game: you could say it to everybody,
 * every fortnight, forever.
 *
 * A promise is only a promise if it can be broken. So each one now has a
 * subject, a deadline, and a way of being kept that is something you would have
 * done anyway if you meant it — you keep "the next one" by putting him on the
 * next job, and you keep "you are covered" by getting him through the month.
 *
 * The two rules that keep this from being a punishment mechanic:
 *
 * 1. **It is always visible before it lapses.** The crew sheet says what is
 *    outstanding and how long is left. A promise the player forgot about is a
 *    fair loss; a promise the player was never shown is a trick.
 *
 * 2. **Breaking one writes a memory, not a stat.** The whole memory system
 *    exists so a man can tell you *why* — and a broken word feeds the informant
 *    gate through exactly the same channel a missed payday does, without a line
 *    of special-case code.
 */

export type PromiseKind = 'next_job' | 'covered';

export interface PromiseDef {
  kind: PromiseKind;
  /** How it reads on the crew sheet while it is still outstanding. */
  outstanding: string;
  /** The note he writes about you when it lapses. */
  broken: string;
  /** ...and the line in the day's log, which never says the word promise. */
  brokenLog: string;
  /** How long you have. */
  days: number;
  /**
   * Whether letting the clock run out is the failure or the success.
   *
   * "The next one" is kept by an act, so silence breaks it. "You are covered"
   * is kept by an absence — a month in which nothing happened to him — so
   * silence keeps it. Both are real promises; they just fail in opposite
   * directions, and encoding that here is what stops the tick needing to know
   * which is which.
   */
  keptByDoing: boolean;
}

export const PROMISES: Record<PromiseKind, PromiseDef> = {
  next_job: {
    kind: 'next_job',
    outstanding: 'Waiting to be named on a job',
    broken: 'Was told they had the next one. There were three after that.',
    brokenLog: 'has stopped asking when the next one is.',
    days: 21,
    keptByDoing: true,
  },
  covered: {
    kind: 'covered',
    outstanding: 'Was told they are covered',
    broken: 'Was told they were covered, and then found out what that was worth.',
    brokenLog: 'found out what being covered is worth.',
    days: 30,
    keptByDoing: false,
  },
};

export const PROMISE = {
  /**
   * What keeping your word is worth, and what breaking it costs.
   *
   * Deliberately lopsided. Keeping a promise buys back roughly half of what
   * breaking one takes away, because that is how it works: nobody is ever as
   * pleased that you did the thing as they were angry that you did not.
   */
  keptLoyalty: 9,
  keptGrievance: -7,
  brokenLoyalty: -16,
  brokenGrievance: 24,
  brokenRespect: -8,

  /** Days left at which the crew sheet starts saying it in a warmer colour. */
  urgentWithin: 7,
} as const;
