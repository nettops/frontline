/**
 * The seven, and what a boss is made of.
 *
 * Replaces eight attributes that improved by use. That system had one good
 * idea in it — a boss becomes what he did — and it produced no character at
 * all: everything crept upward, nobody was ever bad at anything, and there was
 * no decision anywhere in it. Measured before a line of this was written, on
 * how often each of the eight was read anywhere outside the panel that
 * displays them:
 *
 *     leadership 7 · influence 6 · negotiation 5 · streetSmarts 5
 *     business 1 · intimidation 1 · intelligence 0 · strategy 0
 *
 * **Two of the eight were read by nothing.** Two more were read once. Half the
 * system was decoration, and the game had been showing players a screen of
 * eight numbers where four of them did nothing whatsoever.
 *
 * What replaces it is finite. Points at the start are the build; more arrive as
 * the family climbs. The scarcity is the point — a boss is *definitely* weak
 * somewhere, and he chose where.
 *
 * ## What a point does
 *
 * Not a multiplier. The first draft of this was seven multipliers with doors
 * on them, which is the exact failure the old system had, restated with better
 * names. Each of the seven does two things instead:
 *
 * 1. **It unlocks a verb nobody else has.** An activity, not a bonus — the
 *    thing a build of that shape can do and other builds cannot.
 * 2. **It changes how the world behaves toward you.** Same board, different
 *    reactions: who comes to you, what you are warned about, who the law works
 *    down to last.
 *
 * ## No luck
 *
 * Deliberately six of the seven are things a boss *is*, and none of them is
 * chance. Every mechanic in this project has to be measurable, and a stat that
 * quietly rerolls outcomes is the one thing nobody here could write a bar for.
 * If it ever goes in, the honest version widens the tails without moving the
 * average.
 */

export type StatId =
  | 'method'
  | 'grip'
  | 'muscle'
  | 'instinct'
  | 'word'
  | 'ledger'
  | 'stomach';

export type Build = Record<StatId, number>;

export interface StatDef {
  id: StatId;
  label: string;
  /** What it is, in the words somebody would use. */
  blurb: string;
  /** The verb it unlocks, named for the panel that offers it. */
  verb: string;
  /** And what that verb is, so the allocation screen is a real decision. */
  verbBlurb: string;
  /** How the world starts behaving toward you. */
  world: string;
}

export const STATS: StatDef[] = [
  {
    id: 'method',
    label: 'Method',
    blurb: 'How a job gets planned, and how the crew comes home from it.',
    verb: 'Case a job',
    verbBlurb:
      'Spend a week looking at an ordinary job properly, and run it like a planned one.',
    world: 'Crews come back clean. The work gets attributed to nobody.',
  },
  {
    id: 'grip',
    label: 'Grip',
    blurb: 'Your hold on your own people, and what they do when you are not there.',
    verb: 'Call everybody in',
    verbBlurb:
      'The whole family in one room. Grievances come out, and you see who did not come.',
    world: 'Stewards report honestly. Men bring you problems instead of leaving with them.',
  },
  {
    id: 'muscle',
    label: 'Muscle',
    blurb: 'Force you can back, and what people believe you are willing to do.',
    verb: 'Put a district on the card',
    verbBlurb:
      'A standing weekly take from ground you hold. Paid for in public feeling.',
    world: 'Rivals think twice. People who cross you leave town instead of talking.',
  },
  {
    id: 'instinct',
    label: 'Instinct',
    blurb: 'Reading a room, and knowing which of them is already talking.',
    verb: 'Plant somebody',
    verbBlurb: 'Your own man inside a rival house, or inside the department.',
    world: 'You get warned. Raids and defections reach you before they land.',
  },
  {
    id: 'word',
    label: 'Word',
    blurb: 'What you are worth to people who are not yours.',
    verb: 'Call a table',
    verbBlurb: 'Sit down with anybody, whenever you decide to, without being asked.',
    world: 'Houses come to you with offers. The people who run the city take your call.',
  },
  {
    id: 'ledger',
    label: 'Ledger',
    blurb: 'Money, paper, and who can explain where it came from.',
    verb: 'Buy into somebody else',
    verbBlurb: "Take a piece of a rival's business rather than opening your own.",
    world: 'Launderers approach you with better terms. Money arrives looking for a home.',
  },
  {
    id: 'stomach',
    label: 'Stomach',
    blurb: 'What you personally absorb, and how long you last doing it.',
    verb: 'Take the weight',
    verbBlurb: 'Go inside yourself, so that one of yours does not have to.',
    world: 'Your people do not panic when it gets hot. The law works down to you last.',
  },
];

export const STAT_BY_ID: Record<StatId, StatDef> = Object.fromEntries(
  STATS.map((s) => [s.id, s]),
) as Record<StatId, StatDef>;

export const STAT_IDS: StatId[] = STATS.map((s) => s.id);

export const BUILD = {
  /**
   * Where every stat starts, and the ceiling.
   *
   * One to ten, like the system this borrows its shape from. A wider range
   * would imply a precision the effects do not have — every threshold below is
   * a small integer, and a 0..100 scale would invite tuning at a resolution
   * nothing here can measure.
   */
  min: 1,
  max: 10,

  /**
   * The pool at the start, above the floor.
   *
   * Seven stats at 1 is 7 spent before the player touches anything, and 14
   * more to place. That is enough to take two stats to 6, or one to 10 and
   * leave the rest at the floor, or spread evenly at 3 — three genuinely
   * different families, which is the least a build system has to offer.
   */
  startingPoints: 14,

  /**
   * And what climbing buys.
   *
   * Paid on reaching each tier of the job table, which is the progression the
   * game actually has now that the rank ladder is gone. `bestOps` in the probe
   * says a career opens three to four tiers, so a long career places another
   * six to eight points — enough to finish a build, not enough to have every
   * verb.
   */
  pointsPerTier: 2,
} as const;

/**
 * What each verb costs to reach.
 *
 * Deliberately not evenly spaced. `callTable` and `callEverybodyIn` are cheap
 * because they are conversations — a boss with any presence at all can ask
 * people into a room, and gating them high would mean most careers never see
 * the two verbs that cost nothing to implement. `takeTheWeight` and
 * `plantSomebody` are dear because they are the two that change what the law
 * does to a family, which is the most powerful thing on this board.
 *
 * A threshold rather than a scale, because that is what makes a build a build:
 * at 5 you have the verb and at 4 you do not, and no amount of playing well
 * gets you across it. Points do.
 */
export const VERB_AT: Record<StatId, number> = {
  word: 4,
  grip: 4,
  method: 5,
  muscle: 6,
  ledger: 6,
  instinct: 7,
  stomach: 7,
};

/**
 * Where the world starts treating you differently.
 *
 * Lower than the verb on purpose, and this is the half that makes a middling
 * score worth having. A stat you have put four points into should do
 * *something* before it does the big thing, or every point below the threshold
 * is dead weight and the allocation screen becomes a checklist of seven
 * thresholds rather than a distribution.
 */
export const WORLD_AT = 3;

/**
 * How strongly the world half scales once it is on.
 *
 * A share of the way from `WORLD_AT` to `BUILD.max`, so every consumer
 * multiplies it into a quantity it already understands rather than having a
 * number handed to it from here. Same idiom as `holdingShare`.
 */
export function worldShare(level: number): number {
  if (level < WORLD_AT) return 0;
  return (level - WORLD_AT) / (BUILD.max - WORLD_AT);
}

/**
 * The other half of every stat: how the world starts behaving toward you.
 *
 * Each of these is multiplied by `worldShare`, so a stat at the floor pays
 * nothing and a stat at ten pays all of it. They are the reason a middling
 * score is worth having — without them every point below a verb threshold is
 * dead weight and the allocation screen is a checklist rather than a
 * distribution.
 *
 * Sized to be worth noticing and not worth reorganising a career around. None
 * of them was chosen against the estate: see the note in `config/silence.ts`
 * about what that instrument can and cannot resolve.
 */
export const WORLD = {
  /**
   * Grip: loyalty added to every man, every week.
   *
   * Aimed at the largest measured problem in the game. Across 36 careers a
   * family hires 343 people and 291 walk out, and the weekly loyalty pushes
   * are stagnation -0.60, heat -0.46, grievance -0.20 and underpaid -0.17,
   * totalling -1.45. At full Grip this returns most of a stagnation, which is
   * the largest single drain and the one with the least counterplay.
   *
   * Deliberately not enough to cancel the lot. A boss who never promotes
   * anybody and never lays low should still lose people.
   */
  gripLoyaltyPerWeek: 0.55,

  /**
   * Grip: how much less a steward takes.
   *
   * A share off the chance a man on a district skims, because that is the
   * other half of holding your own people — `delegation.ts` already models it
   * and `averageTake` is already the tell.
   */
  gripSkim: 0.6,

  /** Muscle: rivals think twice before moving on you. A share off their appetite. */
  muscleRivalChill: 0.45,

  /** Instinct: how much earlier a raid or a defection shows up in the memos. */
  instinctWarnDays: 6,

  /** Word: what sellers and houses open at, as a share off the asking price. */
  wordOpensLower: 0.12,

  /** Ledger: how far the laundering cut comes down beyond what the district gives. */
  ledgerCut: 0.25,

  /** Stomach: extra heat carried before the family has to go dark. */
  stomachHeatRoom: 18,

  /** Method: how much less of a trace a job leaves when it goes well. */
  methodQuiet: 0.3,
} as const;

