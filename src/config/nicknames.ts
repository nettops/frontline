/**
 * What the street decides to call you.
 *
 * You do not pick it. That is the entire design: a nickname in this world is
 * something other people started saying, and the only input you have is what
 * you spent four years doing where they could see you. A name chosen from a
 * menu is a cosmetic; a name you were *given* is the street's opinion of you
 * with a mechanical consequence attached.
 *
 * So every entry has a condition, and the roll only ever draws from names the
 * career has actually earned. A boss who never hurt anybody cannot come out of
 * this called The Hammer, however the dice fall.
 *
 * ## Why it grants what it grants
 *
 * A point in a stat, or a share of what comes in. Nothing else, and nothing
 * negative — the name is the reward for having been legible, and a career that
 * has been one thing consistently for long enough that the city has a word for
 * it has already paid for the boost in the way it was forced to play.
 *
 * The stat grants matter more than they look. `BUILD.startingPoints` is 14 and
 * a verb costs between three and six points above the floor, so a single
 * granted point can be the difference between having a verb and not — which is
 * the strongest thing any reward in this game could be, and the reason the
 * conditions below are demanding.
 *
 * **The cap still holds.** A name cannot push a stat past `BUILD.max`; see
 * `grantOf` in `sim/nicknames.ts`. A reward that breaks the ceiling every other
 * rule respects is how a build system stops meaning anything.
 */

import type { StatId } from './build';

export interface NicknameDef {
  id: string;
  /** What they call you. Rendered after the name, so it reads as a byname. */
  name: string;
  /** Why, in the words somebody would use. Shown when it arrives. */
  blurb: string;
  /**
   * What has to be true of the career before the street would say it.
   *
   * Read off facts the game already keeps rather than off a counter invented
   * for this. If a name needs a quantity nothing else measures, it is a name
   * about a thing the game does not model.
   */
  needs: (facts: CareerFacts) => boolean;
  /** How likely it is among the names that fit. Ties are broken by this. */
  weight: number;
  /** A point in something, or a share of what comes in. Exactly one. */
  grants: { stat: StatId; points: number } | { earnings: number };
}

/**
 * What the street has actually seen.
 *
 * Gathered once and passed in, so every `needs` is a pure function of the same
 * snapshot and two names cannot disagree about the same career.
 */
export interface CareerFacts {
  day: number;
  fear: number;
  respect: number;
  notoriety: number;
  legitimacy: number;
  heat: number;
  /** How many jobs have landed, and how many went wrong. */
  done: number;
  failed: number;
  /** What the family holds. */
  districts: number;
  fronts: number;
  crew: number;
  /** Money, as the record keeps it. */
  laundered: number;
  estate: number;
  /** People dealt with, and people who left. */
  silenced: number;
  walked: number;
  /** Whether the boss has ever done time for one of his own. */
  wentInside: boolean;
}

export const NICKNAMES: NicknameDef[] = [
  {
    id: 'the_hammer',
    name: 'The Hammer',
    blurb: 'Nobody remembers who said it first. Nobody argues with it either.',
    needs: (f) => f.fear >= 55,
    weight: 10,
    grants: { stat: 'muscle', points: 1 },
  },
  {
    id: 'knuckles',
    name: 'Knuckles',
    blurb: 'It started as a joke about your hands. It stopped being one.',
    needs: (f) => f.fear >= 40 && f.silenced >= 2,
    weight: 8,
    grants: { stat: 'muscle', points: 1 },
  },
  {
    id: 'the_ghost',
    name: 'The Ghost',
    blurb: 'Four years of it and there is almost nothing on paper anywhere.',
    needs: (f) => f.notoriety <= 25 && f.done >= 60,
    weight: 9,
    grants: { stat: 'method', points: 1 },
  },
  {
    id: 'whispers',
    name: 'Whispers',
    blurb: 'You are told things. Nobody is entirely sure why they told you.',
    needs: (f) => f.notoriety <= 40 && f.crew >= 12,
    weight: 7,
    grants: { stat: 'instinct', points: 1 },
  },
  {
    id: 'the_professor',
    name: 'The Professor',
    blurb: 'They say you have never once walked into anything you had not read first.',
    needs: (f) => f.done >= 80 && f.failed <= f.done * 0.35,
    weight: 8,
    grants: { stat: 'method', points: 1 },
  },
  {
    id: 'clockwork',
    name: 'Clockwork',
    blurb: 'Same day, same hour, same result. It unnerves people.',
    needs: (f) => f.done >= 120,
    weight: 6,
    grants: { earnings: 0.06 },
  },
  {
    id: 'the_gentleman',
    name: 'The Gentleman',
    blurb: 'You have never raised your voice at anybody who mattered.',
    needs: (f) => f.respect >= 300 && f.fear <= 25,
    weight: 9,
    grants: { stat: 'word', points: 1 },
  },
  {
    id: 'smiles',
    name: 'Smiles',
    blurb: 'People come away from you feeling better about things. They should not.',
    needs: (f) => f.respect >= 200 && f.walked <= 40,
    weight: 6,
    grants: { stat: 'grip', points: 1 },
  },
  {
    id: 'the_banker',
    name: 'The Banker',
    blurb: 'More of what you touch comes back explainable than anybody thinks is normal.',
    needs: (f) => f.laundered >= 1_500_000,
    weight: 9,
    grants: { stat: 'ledger', points: 1 },
  },
  {
    id: 'the_landlord',
    name: 'The Landlord',
    blurb: 'Half the city pays somebody, and a great deal of that somebody is you.',
    needs: (f) => f.districts >= 4 && f.fronts >= 6,
    weight: 8,
    grants: { earnings: 0.08 },
  },
  {
    id: 'the_mayor',
    name: 'The Mayor',
    blurb: 'It is a joke about how many doors open. It is not entirely a joke.',
    needs: (f) => f.districts >= 5 && f.legitimacy >= 55,
    weight: 7,
    grants: { stat: 'word', points: 1 },
  },
  {
    id: 'the_ant',
    name: 'The Ant',
    blurb: 'Small, apparently. Carrying a great deal more than looks possible.',
    needs: (f) => f.estate >= 1_000_000 && f.notoriety <= 45,
    weight: 6,
    grants: { earnings: 0.07 },
  },
  {
    id: 'the_bull',
    name: 'The Bull',
    blurb: 'You went through it rather than round it, every time, and it worked.',
    needs: (f) => f.heat >= 55 && f.done >= 70,
    weight: 7,
    grants: { stat: 'stomach', points: 1 },
  },
  {
    id: 'the_stand_up',
    name: 'The Stand-Up',
    blurb:
      'There is one story about you and every single person in this city has heard it.',
    needs: (f) => f.wentInside,
    weight: 20,
    grants: { stat: 'grip', points: 2 },
  },
];

export const NICKNAME_BY_ID: Record<string, NicknameDef> = Object.fromEntries(
  NICKNAMES.map((n) => [n.id, n]),
);

export const NICKNAME = {
  /**
   * How long the street takes to settle on anything.
   *
   * Nobody gets a name in the first month. This is checked weekly and the
   * first roll cannot happen before it, so a name always arrives as a comment
   * on a career rather than as a starting bonus.
   */
  notBeforeDay: 120,

  /**
   * ...and how established you have to be for anybody to bother.
   *
   * Respect rather than money, because a name is what people say about you and
   * not what you are worth. Sized against the measured distribution: the
   * probe's median career reaches 882 respect, so this is comfortably reachable
   * and not automatic.
   */
  respectFrom: 260,

  /** How often the street reconsiders. Weekly, like everything else. */
  everyDays: 7,

  /**
   * The chance it lands on any given week once it could.
   *
   * Low, so the name arrives at an unpredictable moment rather than on a
   * schedule the player can count down to. At 8% a qualifying career waits a
   * couple of months on average, which is about right for something that is
   * supposed to feel like other people made their minds up.
   */
  chance: 0.08,

  /**
   * Whether a second name can replace the first.
   *
   * It can, once, and only for a name the career has earned *since*. A boss
   * who was The Banker and then spent two years hurting people does become
   * something else, and a game that refused to notice would be pretending the
   * first thousand days were the whole story.
   */
  canBeRenamedAfterDays: 365,
} as const;
