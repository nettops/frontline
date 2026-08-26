/**
 * What a district is actually for.
 *
 * Twelve districts, and until now every one of them was mechanically the same
 * object: some business slots and a discount on heat. They differ by four
 * scalars — wealth, police, density, population — which change how much a job
 * pays and how loud it is, and nothing else. Hold Northside or hold the Docks
 * and the game does the same thing either way, in different amounts.
 *
 * Meanwhile every blurb in `territories.ts` has been saying what the place is
 * for the whole time:
 *
 *     Northside            "Row houses and union halls."
 *     Garment District     "Freight in, freight out, and nobody counting."
 *     The Docks            "Whoever holds this decides what the city gets."
 *     Southport            "Nobody has looked closely at Southport in twenty years."
 *     Little Sicily        "People here will talk to you before they talk to anyone."
 *
 * The fiction has been doing the design work and the simulation never listened.
 * That is the whole of the complaint that started this: the territory screen
 * tells you what and who, and nothing else.
 *
 * So a district you hold at `control` yields the thing its own blurb promises.
 * Six kinds across twelve places rather than twelve bespoke effects, because
 * twelve one-off couplings is how a system becomes impossible to balance and
 * this one has to be readable before it can be tuned.
 *
 * **A yield needs somebody standing in it.** `delegation.ts` already models
 * handing a district to a man and it is the least-used system in this game;
 * a district with nobody in it holds its ground and yields nothing. That is
 * what makes holding everything impractical — not a rule forbidding it, but
 * the fact that every district you want the use of costs you a man out of the
 * same crew your jobs are drawn from. Hold the map and nobody is earning.
 *
 * Said out loud because the player asked for it: **you are not supposed to end
 * up holding everything.** The old design achieved that by apathy, since
 * nothing rewarded expansion and nothing punished sitting still. This achieves
 * it by making each district a thing you wanted for a reason, and the reasons
 * compete for the same men.
 */

/** What holding a place gets you. One per district; several places share a kind. */
export type YieldKind = 'labour' | 'washing' | 'trade' | 'civic' | 'quiet' | 'takings';

export interface YieldDef {
  kind: YieldKind;
  /** What the player calls it. */
  label: string;
  /** What it does, in the words somebody would actually use. */
  blurb: string;
}

export const YIELDS: Record<YieldKind, YieldDef> = {
  labour: {
    kind: 'labour',
    label: 'People who will work',
    blurb: 'Hiring here is cheaper, and the men who come to you are better.',
  },
  washing: {
    kind: 'washing',
    label: 'Freight nobody counts',
    blurb: 'Money moved through this district comes back cleaner for less.',
  },
  trade: {
    kind: 'trade',
    label: 'What the city pays',
    blurb: 'You buy lower and sell higher than anybody without this ground.',
  },
  civic: {
    kind: 'civic',
    label: 'People worth knowing',
    blurb: 'Favours from the people who run the city come faster and last longer.',
  },
  quiet: {
    kind: 'quiet',
    label: 'Nobody looking',
    blurb: 'Attention on the whole family fades faster while you hold this.',
  },
  takings: {
    kind: 'takings',
    label: 'Somewhere to put it',
    blurb: 'Work run out of here pays more, and a score staged here needs less.',
  },
};

/**
 * Which place gives which, read off the blurbs rather than invented.
 *
 * Each of the six appears twice, so no single yield is locked behind one
 * district and every one of them has a cheaper and a dearer way in. Which is
 * which falls out of `policePresence` and adjacency — the Docks and Downtown
 * are hard ground, Southport and the Fairgrounds are not.
 */
export const DISTRICT_YIELD: Record<string, YieldKind> = {
  // "Row houses and union halls. Everybody knows everybody."
  northside: 'labour',
  // "People here will talk to you before they talk to anyone."
  little_sicily: 'labour',

  // "Freight in, freight out, and nobody counting very carefully."
  garment_district: 'washing',
  // "Respectable enough by daylight. Considerably less so after it."
  riverside: 'washing',

  // "Whoever holds this decides what the city gets and what it pays for it."
  the_docks: 'trade',
  // "Everything that enters the city touches this ground first."
  rail_yards: 'trade',

  // "Where the real money is, and where they have the people to protect it."
  downtown: 'civic',
  // "Money that arrived two generations ago."
  the_heights: 'civic',

  // "Nobody has looked closely at Southport in twenty years."
  southport: 'quiet',
  // "Narrow streets, long memories, and more back rooms than storefronts."
  old_quarter: 'quiet',

  // "Acres of things belonging to people who are not here."
  warehouse_district: 'takings',
  // "Half of it is empty nine months a year. The other half never closes."
  fairgrounds: 'takings',
};

export const HOLDING = {
  /**
   * What a yield is worth, as a share.
   *
   * One figure for all six on purpose, for now. They land on six different
   * systems with six different scales, and picking six numbers before any of
   * them has been measured is how a config becomes a pile of guesses nobody
   * can reason about. This is the dial the sweep will turn.
   *
   * Not chosen against the estate — see the note in `config/silence.ts` about
   * what that instrument can and cannot resolve. It is sized to be worth
   * crossing a district for and not worth reorganising a career around.
   */
  share: 0.2,

  /**
   * Holding two of the same kind is worth less than holding two kinds.
   *
   * Multiplied on the second and later district of a yield you already have.
   * Without this the answer is always "take the two cheapest of whichever
   * yield you like best", and the map stops being a set of choices.
   */
  secondShare: 0.4,
} as const;
