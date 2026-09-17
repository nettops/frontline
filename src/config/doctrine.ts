/**
 * What kind of thing this is, declared out loud.
 *
 * Every other choice in this game is about a week — which job, which man,
 * which district. This is the one that is about the whole organization, and
 * it is the only place the player gets to answer the question the setting has
 * been asking since day one: is this still your father's outfit, or is it a
 * holding company that happens to own a card room.
 *
 * Two doctrines, and neither of them is the good one. The Iron Hand earns
 * more on the street and carries more attention from the people who build
 * federal cases; the Holding Company earns more over the counter and is much
 * harder to make a RICO case against — and the men who made you take it as a
 * personal insult, because it is one.
 *
 * **There is no default.** A career that has never declared one runs exactly
 * as it always did, and `sim/doctrine.ts` returns 1 from every modifier. That
 * is not timidity about baselines, it is the honest state: a boss who has not
 * said what this is has not said what this is. Declaring it is the beat.
 *
 * The switch is on a long cooldown (`switchCooldownDays`) for the same reason
 * `DELEGATION.recallGrievance` exists: an answer you can take back the same
 * afternoon is not an answer. It also closes the obvious exploit — the relic
 * loyalty step below is a one-time consequence of declaring, and a free toggle
 * would let a boss farm it twice a week.
 */

export type DoctrineId = 'traditional' | 'corporate';

export interface DoctrineDef {
  id: DoctrineId;
  name: string;
  /** What the player is actually choosing, in one line. */
  blurb: string;
  /** Added to the attribute the job is scored on, where that attribute is fear. */
  intimidationBonus: number;
  /** Multiplies `heatScale` — the attention a job draws from the people who file. */
  federalHeat: number;
  /** Multiplies what a front takes over the counter. */
  cleanYield: number;
  /** Multiplies `FEAR.decayShare`. Above 1 means a claim to violence expires faster. */
  fearDecay: number;
  /** One-time, on declaring it, to every relic on the roster. */
  relicLoyalty: number;
  /** ...and the other half of the same step. */
  relicGrievance: number;
  /** What the log says the day it is declared. */
  beat: string;
}

export const DOCTRINES: Record<DoctrineId, DoctrineDef> = {
  /**
   * The Father's Path.
   *
   * +2 intimidation is small against `ATTRIBUTE_MAX` and it is not nothing:
   * on the operations success formula it is worth roughly two points of
   * chance on any job scored on fear, permanently, for free. What it costs is
   * a quarter more attention on every job in the game — which is the trade
   * the setting is about. The old men love you for it.
   */
  traditional: {
    id: 'traditional',
    name: "The Father's Path",
    blurb:
      'Rule the way he did. Fear, violence, and a man’s word. It works, and ' +
      'everybody who builds federal cases knows exactly what it looks like.',
    intimidationBonus: 2,
    federalHeat: 1.25,
    cleanYield: 0.85,
    fearDecay: 1,
    relicLoyalty: 10,
    relicGrievance: 0,
    beat:
      'You said it in front of the whole table: nothing changes. The older men did ' +
      'not cheer. They just sat back.',
  },
  /**
   * The Modern Era.
   *
   * The mirror, and deliberately not a straight inverse: the clean side pays
   * a quarter more and the federal rate drops a fifth rather than a quarter,
   * because the thing this doctrine actually buys is *insulation*, and
   * insulation that was strictly better than the alternative would make the
   * choice arithmetic. What it costs is the half of the organization that
   * only ever understood the other way of doing it — +15 grievance on every
   * relic, larger than `DELEGATION.recallGrievance` and smaller than
   * `DEMENTIA.relicGrievanceOnHit`, which is about right for "you insulted
   * them" against "you killed one of them".
   *
   * And fear expires half again as fast, because nobody is out there earning
   * it. That is the quiet cost: a corporate family stops being frightening
   * within about a season of stopping the work that made it frightening.
   */
  corporate: {
    id: 'corporate',
    name: 'The Holding Company',
    blurb:
      'Fronts, accountants, and quiet influence. Harder to prove, better over the ' +
      'counter, and the men who made you will never forgive it.',
    intimidationBonus: 0,
    federalHeat: 0.8,
    cleanYield: 1.25,
    fearDecay: 1.5,
    relicLoyalty: 0,
    relicGrievance: 15,
    beat:
      'You told them what the accountants had told you. One of the older men asked ' +
      'whether he was supposed to call you Mister now.',
  },
};

export const DOCTRINE = {
  /**
   * How long a declaration stands before it can be taken back.
   *
   * Half a year. Long enough that the relic step cannot be farmed, long enough
   * that a boss lives with the consequence for at least two quarters of fronts
   * and cases, and short enough that a long career can genuinely change what it
   * is once or twice.
   */
  switchCooldownDays: 180,
} as const;

// ------------------------------------------------------- the father's debts --

/**
 * Old business, arriving at your table with your father's name on it.
 *
 * The one piece of the past that is not a stat. These are not crew, not
 * factions, and not civic figures — they are men who were owed something
 * thirty years ago by somebody who is dead, and the only reason they are
 * standing in your social club is that you took his chair.
 *
 * Raised as a generated memo (`gen_ancestral_ghost`), and gated on the
 * doctrine having been declared: the ghost only turns up once you have said
 * out loud what you are going to do with what he left you. That gate is also
 * what keeps every career written before this existed bit-identical — an
 * `applies` that returns null before touching the stream never enters the
 * day's pool at all.
 */
export interface AncestralGhostDef {
  id: string;
  /** What he was to your father, in a phrase. */
  who: string;
  /** What he says he is owed, in his own framing. */
  claim: string;
  /** What settling it costs, before `priced()`. */
  settlement: number;
}

export const ANCESTRAL_GHOSTS: AncestralGhostDef[] = [
  {
    id: 'the_dock_loan',
    who: 'a man who drove for your father before you were born',
    claim: 'four thousand dollars lent on a Tuesday in 1961 and never spoken of again',
    settlement: 6_000,
  },
  {
    id: 'the_widow',
    who: 'the widow of somebody who went away and did not say a word for eleven years',
    claim: 'the envelope that stopped coming the month your father died',
    settlement: 4_500,
  },
  {
    id: 'the_partner',
    who: 'an old man who says he was a partner in the first place your father ever held',
    claim: 'half of a building that has been sold twice since',
    settlement: 9_000,
  },
  {
    id: 'the_bagman',
    who: 'somebody who carried money for your father for nine years',
    claim: 'a pension that was promised at a table where everybody else is dead',
    settlement: 5_500,
  },
];

export const ANCESTRAL_GHOST = {
  /** What settling one is worth on the street. Word gets around that you paid. */
  settleRespect: 6,
  /** ...and to the men who remember him, if you are running it his way. */
  settleRelicLoyalty: 5,
  /** What turning one away costs in standing. Word gets around about that too. */
  refuseRespect: -8,
  /** ...and what it buys instead. Turning away your father's people is a statement. */
  refuseFear: 4,
  /** ...and what every relic on the roster makes of it. */
  refuseRelicGrievance: 8,
} as const;
