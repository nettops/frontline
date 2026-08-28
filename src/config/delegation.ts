/**
 * Giving a man a district.
 *
 * The game's second real verb was the sit-down: read one man, face to face,
 * with the answer three beats later. This is the same lesson at a longer
 * range. You hand somebody authority *before* you know what he is, and then
 * you find out from what he does with it over a season.
 *
 * That is the whole design. A steward is not a stat bonus applied to a
 * district — he is an actor who decides for himself, weekly, using the numbers
 * you are not allowed to see. What reaches the player is a record of what he
 * did, never a score and never a reason. You read the man off the pattern.
 *
 * Three rules, each guarding against a specific way this could fail:
 *
 * 1. **What he does depends on his situation, not only on his stats.** A
 *    greedy man who is paid well and thinks well of you does not steal. If
 *    greed alone decided it, one look at the crew sheet would answer the
 *    question forever and the mechanic would be a lookup table.
 *
 * 2. **Delegating has to pay.** A district nobody works decays. You cannot be
 *    everywhere, and by Capo there are more districts than weeks. If keeping
 *    everything under your own hand were optimal, nobody would ever take the
 *    bet the lesson lives in.
 *
 * 3. **Taking it back costs.** A man who is given a thing and has it removed
 *    remembers. Without that, delegation is a free trial rather than a
 *    decision.
 */

import type { NpcStatId } from '../sim/types';

export type StewardActionId =
  | 'work'
  | 'quiet'
  | 'squeeze'
  | 'skim'
  | 'build'
  | 'caretake';

export interface StewardActionDef {
  id: StewardActionId;
  /** What the ledger says he did. Never says why. */
  label: string;
  /** The line under it, in his district's voice. */
  note: string;
  /**
   * What pulls him toward it, as stat weights. Read against his true numbers.
   */
  wants: Partial<Record<NpcStatId, number>>;
  /** Baseline appetite before anything about him is considered. */
  base: number;
  /** Only available when he thinks nobody is counting. */
  needsOpportunity?: true;
  /** Effects, applied per week he spends doing it. */
  influence: number;
  sentiment: number;
  heat: number;
  /** Multiple of the district's weekly worth that reaches you. */
  earn: number;
  /** ...and the share of that he keeps for himself. */
  takes: number;
}

/**
 * The menu.
 *
 * Deliberately small. Six options a week over a season is enough signal to
 * read a man from and few enough that the player can hold them all in their
 * head — which they must, because the whole game is comparing what he did
 * against what he might have.
 */
export const STEWARD_ACTIONS: StewardActionDef[] = [
  {
    id: 'work',
    label: 'Worked it',
    note: 'Out every night, talking to people who matter and some who do not.',
    base: 1,
    wants: { loyalty: 0.9, discipline: 0.7, respectForBoss: 0.6, ambition: 0.3 },
    influence: 1.6,
    sentiment: 0,
    heat: 1.2,
    /*
       Everything reaches you, because nobody is taking anything.

       This was 0.9 — a tenth of the money gone every week with no character
       responsible. The ledger is the one instrument a player has for catching
       a thief, and a permanent unexplained shrinkage on every honest week is
       the noise that makes it useless.
    */
    earn: 1,
    takes: 0,
  },
  {
    id: 'quiet',
    label: 'Kept it quiet',
    note: 'Nothing moved. Nothing was noticed either.',
    base: 1,
    wants: { fear: 1.1, discipline: 0.5, courage: -0.6 },
    influence: 0,
    sentiment: 3,
    heat: -2.2,
    earn: 0.35,
    takes: 0,
  },
  {
    id: 'squeeze',
    label: 'Squeezed it',
    note: 'Everybody paid, and everybody remembers being made to.',
    base: 0.9,
    wants: { greed: 1.0, courage: 0.6, ambition: 0.4, loyalty: -0.3 },
    influence: 0.4,
    sentiment: -7,
    heat: 2.6,
    earn: 1.9,
    takes: 0,
  },
  /*
     Note the label and the note: identical to `work`, word for word, and that
     is the most important line in this file.

     A man taking a cut does not write it in the ledger. What you see is a man
     working his district, because that is exactly what it looks like from
     where you are standing. The only thing that separates the two in the
     record is the money — a district that earns a little less than its
     neighbours, every week, for reasons nobody can point at.

     So the ledger cannot be read as a confession. It has to be read as a
     column of figures next to a column of claims, which is the whole lesson at
     this range.
  */
  {
    id: 'skim',
    label: 'Worked it',
    note: 'Out every night, talking to people who matter and some who do not.',
    base: 0.5,
    // Loyalty and regard hold a greedy man honest; grievance removes the brake.
    wants: { greed: 1.3, grievance: 0.7, loyalty: -1.4, respectForBoss: -0.8 },
    needsOpportunity: true,
    influence: 1.2,
    sentiment: 0,
    heat: 1,
    // Same work, same take. Theft is the only reason anything goes missing.
    earn: 1,
    /*
       The share he keeps, and the number this whole pattern turns on.

       Measured against an honest steward on an identical district — the most
       favourable case a player will ever get, since in a real game there is no
       matched control to compare against:

         30%  caught in 19 of 20 worlds, median week 2
         24%  caught in 17 of 20 worlds, median week 5
         18%  caught in 14 of 20 worlds, median week 8

       24% is the one worth having. Five weeks of record before the takings
       separate, and three thieves in twenty are still getting away with it at
       the end of a season — which is what makes the suspicion real rather than
       a reveal on a timer.
    */
    takes: 0.24,
  },
  {
    id: 'build',
    label: 'Made themselves useful',
    note: 'The people here have started going to them first.',
    base: 0.6,
    wants: { ambition: 1.3, leadership: 0.7, respectForBoss: -0.5 },
    influence: 1.1,
    sentiment: 4,
    heat: 0.6,
    earn: 0.7,
    takes: 0,
  },
  {
    id: 'caretake',
    label: 'Held the line',
    note: 'Kept what was there. Did not reach for anything.',
    base: 1.1,
    wants: { discipline: 0.6, ambition: -0.7, courage: -0.3 },
    influence: 0.3,
    sentiment: 1,
    heat: 0.2,
    earn: 0.6,
    takes: 0,
  },
];

export const STEWARD_ACTION_BY_ID: Record<string, StewardActionDef> =
  Object.fromEntries(STEWARD_ACTIONS.map((a) => [a.id, a]));

export const DELEGATION = {
  /** He decides this often. Long enough that a season is a readable sample. */
  intervalDays: 7,

  /**
   * Nobody below this role is given a district of his own.
   *
   * Was 2 — enforcer. A steward is the only income in this game that does not
   * occupy a body you could otherwise send out on a job, which makes handing a
   * district over the only way an organization grows past what its boss can
   * personally work. Measured: a family can run a job in 24% of the weeks of a
   * career, the other three quarters being lost to heat, laying low and having
   * nobody free. Everything above Capo compounds off that quarter.
   *
   * So delegation is the answer the game already has, and enforcer put it out
   * of reach. An enforcer costs $450 a week against a soldier's $300, and a
   * family whose median weekly purse is under $2,000 cannot carry five of
   * them: promoting hard enough to fill the rank took careers ending early
   * from 16 in 36 to 24.
   *
   * A soldier is a made man who can be handed a street. That is not a
   * concession, it is what a soldier is.
   */
  minRoleIndex: 1,

  /**
   * How much of a district has to be yours before handing it over is worth
   * suggesting. Below this there is not enough there for a man to run.
   */
  promptAboveInfluence: 20,

  /**
   * How much of a district's weekly worth passes through a steward's hands.
   *
   * Was 420, which is why holding ground never felt worth doing. At good
   * influence that returned about **$370 a week** against a soldier's $300
   * wage — so handing a man a district netted you seventy dollars and cost you
   * a body off the board, in a game where one job pays $4,000 to $9,000. It
   * was a donation with a ledger attached.
   */
  worthPerWeek: 950,

  /**
   * What the word on the screen is worth.
   *
   * `districtWorth` read raw influence on a straight line, so crossing from a
   * foothold into control — the thing the whole territory system is about —
   * moved the money by two per cent. `controlLevel` did not appear anywhere in
   * `sim/delegation.ts`. Steps rather than a slope, so the threshold is felt.
   */
  worthByControl: {
    none: 0,
    presence: 0.45,
    foothold: 0.7,
    control: 1,
    dominance: 1.35,
  } as Record<string, number>,

  /**
   * And what the man is worth.
   *
   * Nothing in the payout read leadership or discipline: a capable steward and
   * a useless one returned the identical multiplier for the identical action.
   * Loyalty is deliberately absent — that decides whether he steals, which is
   * already modelled and must not be paid for twice.
   */
  stewardSwing: 0.3,

  /**
   * How much a week's takings swing on their own, honest steward or not.
   *
   * This is the number that decides whether the mechanic is a read or a
   * lookup. At zero, two identical districts side by side name the thief from
   * the first entry. At this figure his cut hides inside the ordinary variance
   * of the place, and it takes a run of weeks before the average separates —
   * which is the horizon the whole pattern is pitched at.
   */
  worthSwing: 0.45,

  /**
   * Random weight added to every option before the best is taken.
   *
   * Without it a man's ledger is a straight readout of his largest stat, and
   * the player learns everything from the first two entries. With it they need
   * a season, which is the horizon this pattern is supposed to teach at.
   */
  jitter: 0.55,

  /**
   * How much better paid than his expectation a man has to be before greed
   * stops driving him, and how much grievance undoes that again.
   */
  paidWellBonus: 1.1,
  grievanceUnbrake: 0.9,

  /**
   * Watching a man use authority teaches you about him, more slowly than
   * sitting in a room with him.
   */
  familiarityPerWeek: 1.4,

  /** Being handed a district, and having it taken away again. */
  appointLoyalty: 6,
  appointRespect: 5,
  recallLoyalty: -12,
  recallGrievance: 18,

  /** A steward keeps your name alive here, so the district stops decaying. */
  keepsDistrictWarm: true,

  /** Ledger entries kept per district. A season is thirteen. */
  ledgerLength: 16,
} as const;
