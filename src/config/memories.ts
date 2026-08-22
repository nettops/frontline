/**
 * What people remember, as opposed to how much.
 *
 * The organization already had a grievance stat, and a grievance stat is a
 * summary of a thing that never existed: a man could be carrying 60 points of
 * resentment and there was nothing in the state that said what any of it was
 * about. He could not be reminded of it, could not be asked about it, and
 * could not weigh it against anything — which meant that when a rival came
 * with an offer, the only thing he brought to the decision was a number that
 * had been slowly accumulating for reasons nobody had kept.
 *
 * A memory is one thing that happened, to him, on a date, sometimes involving
 * somebody specific. It fades and it does not vanish — the weight drops away
 * over years but the fact stays on file, which is why a man can surprise you
 * eight years later.
 *
 * Deliberately *not* a second loyalty economy. Memories do not add their own
 * weekly drift; the events that create them already applied their
 * consequences at the time. What they add is recall: the ability of a later
 * decision to look back and find a specific reason.
 */

export type MemoryKind =
  | 'took_a_charge'
  | 'was_hurt'
  | 'went_unpaid'
  | 'passed_over'
  | 'promoted'
  | 'looked_after'
  | 'lost_a_friend'
  | 'was_leaned_on'
  | 'kept_his_mouth_shut'
  | 'was_believed'
  | 'word_kept'
  | 'word_broken'
  | 'carried_the_work'
  | 'left_on_the_bench';

export interface MemoryDef {
  kind: MemoryKind;
  /** How it reads on the crew sheet, once you know them well enough. */
  text: string;
  /** Good or bad, from his point of view. */
  tone: 'good' | 'bad';
  /** Starting weight, 0..100. How much it mattered at the time. */
  weight: number;
  /** Weight lost per year. Nothing ever reaches zero — see `floor`. */
  fadePerYear: number;
  /**
   * Below this it stops mattering and starts merely being true. A faded
   * memory still colours a decision fractionally, which is the difference
   * between forgetting and forgiving.
   */
  floor: number;
}

export const MEMORIES: Record<MemoryKind, MemoryDef> = {
  /*
     The two that come from who you send.

     `carried_the_work` is `tone: 'good'` because from his side of it, being
     the one who gets sent is recognition. That is not the same as loyalty, and
     it deliberately does not raise any: what it does to him — ambition, price,
     his claim on the chair when you are gone — is in `config/standing.ts`. The
     man who does the most work ends up the most expensive to keep and the most
     damaging to lose, which is the decision the whole mechanic exists to
     create.
  */
  carried_the_work: {
    kind: 'carried_the_work',
    text: 'have been the one you send, and know it',
    tone: 'good',
    weight: 45,
    fadePerYear: 15,
    floor: 6,
  },
  left_on_the_bench: {
    kind: 'left_on_the_bench',
    text: 'watched the work go to other people',
    tone: 'bad',
    weight: 35,
    fadePerYear: 16,
    floor: 5,
  },
  took_a_charge: {
    kind: 'took_a_charge',
    text: 'were arrested on a job you sent them on',
    tone: 'bad',
    weight: 70,
    fadePerYear: 9,
    floor: 12,
  },
  was_hurt: {
    kind: 'was_hurt',
    text: 'were hurt working for you',
    tone: 'bad',
    weight: 50,
    fadePerYear: 12,
    floor: 8,
  },
  went_unpaid: {
    kind: 'went_unpaid',
    text: 'were not paid, and remember the week',
    tone: 'bad',
    weight: 40,
    fadePerYear: 14,
    floor: 5,
  },
  passed_over: {
    kind: 'passed_over',
    text: 'watched somebody else get what they were owed',
    tone: 'bad',
    weight: 55,
    fadePerYear: 8,
    floor: 10,
  },
  lost_a_friend: {
    kind: 'lost_a_friend',
    text: 'lost somebody they were close to',
    tone: 'bad',
    weight: 65,
    fadePerYear: 7,
    floor: 14,
  },
  was_leaned_on: {
    kind: 'was_leaned_on',
    text: 'were reminded of their obligations, by you',
    tone: 'bad',
    weight: 60,
    fadePerYear: 10,
    floor: 12,
  },
  promoted: {
    kind: 'promoted',
    text: 'were moved up when it counted',
    tone: 'good',
    weight: 55,
    fadePerYear: 11,
    floor: 8,
  },
  looked_after: {
    kind: 'looked_after',
    text: 'were looked after when they needed it',
    tone: 'good',
    weight: 70,
    fadePerYear: 8,
    floor: 14,
  },
  kept_his_mouth_shut: {
    kind: 'kept_his_mouth_shut',
    text: 'had the chance to talk and did not',
    tone: 'good',
    weight: 75,
    fadePerYear: 6,
    floor: 18,
  },
  /*
     Being lied to by the man you work for.

     Heavier than a missed payday and heavier than being passed over, because
     both of those are things that happened to him and this is a thing that was
     done to him — and it fades more slowly than either. The floor is the
     highest in the file: a man forgives the week he went unpaid long before he
     forgives being told a thing that was not going to happen.
  */
  word_broken: {
    kind: 'word_broken',
    text: 'were told a thing by you that did not happen',
    tone: 'bad',
    weight: 68,
    fadePerYear: 5,
    floor: 16,
  },
  word_kept: {
    kind: 'word_kept',
    text: 'were told a thing by you that then happened',
    tone: 'good',
    weight: 45,
    fadePerYear: 6,
    floor: 8,
  },
  was_believed: {
    kind: 'was_believed',
    text: 'were taken at their word when it mattered',
    tone: 'good',
    weight: 45,
    fadePerYear: 12,
    floor: 6,
  },
};

/** Most memories one person carries. The faintest is dropped first. */
export const MAX_MEMORIES = 10;

/**
 * How recall reaches the decisions that read it.
 *
 * Kept small and multiplicative on purpose. Memories deliberately add no
 * weekly loyalty drift of their own — the events that created them already
 * charged for themselves at the time, and stacking a second slow drain on top
 * is exactly the mistake that made paying people properly stop working once
 * before.
 */
export const RECALL = {
  /** Multiplier on how buyable he is, at a full ledger of bad memories. */
  poachableAtWorst: 1.8,
  /** ...and at a full ledger of good ones. */
  poachableAtBest: 0.45,
  /** Multiplier on how likely he is to talk to an investigator. */
  informAtWorst: 2.1,
  informAtBest: 0.4,
  /** Shift to a succession claim, from what the room remembers of him. */
  claimSwing: 0.12,
  /** Weight at which the ledger counts as full, either way. */
  fullAt: 140,
  /** Familiarity before the player is told any of it. */
  visibleAbove: 55,
};
