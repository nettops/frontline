import type { MemoryKind } from './memories';

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

export type PromiseKind =
  | 'next_job'
  | 'covered'
  | 'promoted'
  | 'territory'
  | 'next_in_line'
  | 'handled';

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
   * Memories that break it before the deadline, for the promises kept by an
   * absence rather than an act.
   *
   * This was a constant in `sim/promises.ts` naming three memory kinds, which
   * was correct while `covered` was the only promise of its shape and wrong
   * the moment a second one existed — "I will handle it" and "you are covered"
   * both fail on silence, and they fail on *different* silences. Declared per
   * promise so the tick keeps knowing nothing about which is which.
   *
   * Read from the man's own memories rather than hooked into the paths that
   * could hurt him, so a route added next year breaks the promise without
   * knowing promises exist. Only meaningful when `keptByDoing` is false.
   */
  brokenBy?: MemoryKind[];
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
    brokenBy: ['took_a_charge', 'was_hurt', 'went_unpaid'],
  },

  /*
     The four below are the same machine with a wider vocabulary.

     Two kinds was not a design, it was where the work stopped: the sit-down
     could say "you have the next one" and "you are covered" and nothing else,
     so the strongest register in the conversation had two sentences in it. A
     man who wants the rung above him, or the district he has been running
     without the title, or to know where he stands when you are gone, could be
     told none of those things — and those are the three things the crew sheet
     says people want.

     Each is kept by the act you would have performed anyway if you meant it,
     which is the rule the first two established. Promotion is kept by
     promoting him. Ground is kept by putting him in charge of some. The line
     is kept by naming him. None of them needs a new verb.
  */

  promoted: {
    kind: 'promoted',
    outstanding: 'Was told the next rung is theirs',
    broken: 'Was told they were going up. Watched somebody else go instead.',
    brokenLog: 'has stopped mentioning the promotion.',
    /*
       Shorter than "the next one", and deliberately.

       A job comes round every week and a rung does not, so a month is a long
       time to be told you are nearly there and a season is an insult. This is
       the promise most likely to be made carelessly — it costs nothing to say
       and it is what everybody wants — so it is also the one that should come
       due while the boss still remembers saying it.
    */
    days: 28,
    keptByDoing: true,
  },

  territory: {
    kind: 'territory',
    outstanding: 'Was told they would get ground of their own',
    broken: 'Was promised a district. Is still working somebody else\'s.',
    brokenLog: 'has stopped asking which district was supposed to be theirs.',
    days: 35,
    keptByDoing: true,
  },

  next_in_line: {
    kind: 'next_in_line',
    outstanding: 'Was told they are next',
    broken: 'Was told they were next. Found out what that was worth.',
    brokenLog: 'has worked out that being next was a figure of speech.',
    /*
       The longest window in the table, because it is the longest promise.

       Nobody expects to be named heir this month. What they expect is that
       the question has been settled, and a season is how long a man will wait
       before concluding it has not been.
    */
    days: 60,
    keptByDoing: true,
  },

  handled: {
    kind: 'handled',
    outstanding: 'Was told you would deal with it',
    broken: 'Was told it would be dealt with. It was not.',
    brokenLog: 'has stopped waiting for you to deal with it.',
    days: 21,
    /*
       Kept by an absence, like `covered`, but a different absence.

       "You are covered" fails when something happens *to* him. "I will handle
       it" fails when the thing he brought you happens *again* — he is passed
       over once more, leaned on again, left on the bench he was complaining
       about. So the two share a shape and not a list, which is why the list
       moved into the table.
    */
    keptByDoing: false,
    brokenBy: ['passed_over', 'was_leaned_on', 'left_on_the_bench'],
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
