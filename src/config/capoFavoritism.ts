/**
 * How favoritism reads off the boss's own pitch decisions.
 *
 * `state.capoPitches` is already a full, growing history of who brought what
 * and whether the boss said yes to it — a real track record that costs
 * nothing new to read. This sizes how far apart two capos' approval rates
 * have to be before that gap is a fact the disfavored man's own feelings can
 * carry, the same shape of question `capoTension.ts` asks of `capoStanding`.
 */

import { CAPO_TENSION } from './capoTension';

export const CAPO_FAVORITISM = {
  /**
   * Settled pitches (`approved`, `rejected`, or `expired` — `open` has no
   * verdict yet) a capo needs on the books before his approval rate means
   * anything. `CAPO_PITCH.count` is 3, the board at any one time, so 4 is
   * already more than a single week's board could produce on its own — one
   * lucky or unlucky pitch can no longer be the whole sample.
   */
  minSettled: 4,

  /**
   * How far apart two capos' approved shares (0..1) have to be before the
   * gap counts as favoritism rather than ordinary variance in what got
   * pitched. `capoTension.ts`'s `gapTiers: 2` is already better than half of
   * `capoStanding`'s 0..3 range; this is the same order of magnitude, read
   * onto a 0..1 share instead of a 4-step tier.
   */
  shareGap: 0.6,

  /** Same weekly cadence every other organizational check in this pass uses. */
  checkIntervalDays: 7,

  /**
   * How long a capo who has already registered as disfavored goes before he
   * can register again. An approval-rate gap moves only as fast as pitches
   * settle — a handful of weeks per capo, the identical slow-moving shape
   * `CAPO_TENSION.cooldownDays` was sized for — so this reuses that number
   * rather than inventing a second one for the same kind of fact.
   */
  cooldownDays: CAPO_TENSION.cooldownDays,
} as const;
