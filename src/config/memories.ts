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
  | 'vouch_soured'
  | 'vouch_paid_off'
  | 'handled_it_quietly'
  | 'promoted'
  | 'looked_after'
  | 'lost_a_friend'
  | 'was_leaned_on'
  | 'kept_his_mouth_shut'
  | 'was_believed'
  | 'word_kept'
  | 'word_broken'
  | 'carried_the_work'
  | 'left_on_the_bench'
  | 'went_unheard';

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
  /*
     A capo's own word coming back on him — not the same thing as being
     `passed_over`, which is watching somebody *else* get what he wanted.
     This is the reverse: a man he put his name behind turned out to be a
     mistake. `capoVouches.ts`'s `applyVoucherConsequence` used to write
     `passed_over` here, which conflated "denied a vouch" with "burned by
     one" — two different facts about a capo that a count could not tell
     apart. Same order of magnitude as `passed_over`, because both are a
     credibility hit of the kind a boss remembers about a man's judgment.
  */
  vouch_soured: {
    kind: 'vouch_soured',
    text: 'put their name behind a man who let them down',
    tone: 'bad',
    weight: 55,
    fadePerYear: 8,
    floor: 10,
  },
  /*
     The reverse of `vouch_soured` above — a man a capo put his name behind
     kept earning it, checkpointed at `crew.ts`'s `promote()` the day that man
     rises past the rung the vouch itself bought him. Same order of magnitude
     as `vouch_soured` on purpose: `voucherMistakeCount`'s net figure
     (`capoVouches.ts`) subtracts one from the other, and a comparison is only
     honest if neither side is thumbed.
  */
  vouch_paid_off: {
    kind: 'vouch_paid_off',
    text: 'put their name behind a man who proved them right',
    tone: 'good',
    weight: 55,
    fadePerYear: 8,
    floor: 10,
  },
  /*
     The Underboss's own side of `events.ts`'s `underbossFields` — Phase 8
     gave him a mechanism for fielding a capo's political tension quietly,
     and it left no countable trace that he had done it. This is that trace,
     checkpointed the day it happens rather than inferred after the fact.
     Same order of magnitude as `vouch_paid_off` on purpose: both are "one
     real thing this man did panned out", and `officers.ts`'s
     `underbossStanding` counts these the identical derived-not-stored way
     `capoVouches.ts` counts vouches.
  */
  handled_it_quietly: {
    kind: 'handled_it_quietly',
    text: 'talked a capo down before it ever reached you',
    tone: 'good',
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
  /*
     `events.ts`'s `capo_political_tension` — 'let_it_sit' — Phase 12 of the
     org-politics pass. The event is deliberately built so hearing a capo out
     and doing nothing costs him no live stat (see the choice's own comment:
     "an ignore that quietly costs the man who chose it is a worse option
     wearing a free one's label"), which left "Boss ignored a capo's
     complaint" (design brief §13) with no trace anywhere — not even one a
     later decision could find. A memory has no immediate effect either (see
     this file's own header), so it costs nothing the branch didn't already
     promise while still making the fact real.

     Deliberately not `left_on_the_bench` — that kind already means a specific
     other thing (a run of pitches going to somebody else, `capoFavoritism.ts`)
     and conflating "watched the work go elsewhere" with "was heard and
     dropped" would repeat the exact mistake `vouch_soured`'s own comment
     above records fixing. Lighter than `left_on_the_bench` on every axis:
     nothing concrete was lost, he was only left to notice that raising it
     changed nothing.
  */
  went_unheard: {
    kind: 'went_unheard',
    text: 'raised something with you and watched it go nowhere',
    tone: 'bad',
    weight: 30,
    fadePerYear: 18,
    floor: 4,
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
