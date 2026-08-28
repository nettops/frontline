/**
 * The card game, and why it is not a slot machine.
 *
 * The blueprint asked for gambling as *"a sink with teeth, once there is money
 * to sink"*. A sink is easy: take money, return less. That on its own would be
 * a button, and this project's own list of prohibitions opens with **do not add
 * features because they sound cool**.
 *
 * What makes a card game interesting in a story about this is not the cards. It
 * is **who is at the table**. So the whole design is one sentence:
 *
 *   > You choose the room, you choose how to play it, and somebody specific is
 *   > sitting opposite you.
 *
 * ## Three ways to sit, and they are genuinely different
 *
 * - **Straight.** Near a coin flip, paying less than even money. A sink, and
 *   the only one of the three with no reputational edge either way.
 * - **Lose on purpose.** You will lose the stake. That is the point: it is how
 *   money reaches a judge without either of you having said anything. The
 *   oldest arrangement in the book, and the game had no way to express it.
 * - **Play hard.** Push every edge. It pays better than straight *in money* —
 *   deliberately, because otherwise nobody would ever pick it — and the price
 *   is paid in the other currency. Get caught and the man opposite you tells
 *   people.
 *
 * That third row is the one worth defending. A positive money return looks
 * wrong in a section headed "sink" until you read what it costs, which is
 * exactly the design language the obstacles work established: **every real
 * choice in this game is priced in something, and money is only one of the
 * six things a boss can spend.**
 *
 * ## What stops it being ground
 *
 * Three things, and it needs all three.
 *
 * **The game runs weekly.** It is a standing game, not a machine. One hand
 * every seven days caps the throughput of every effect below.
 *
 * **Straight play cannot be made profitable.** `maxWin` × `payout` is under 1
 * at the ceiling of the attribute, checked by a test rather than by arithmetic
 * in a comment.
 *
 * **Playing hard gets you watched.** Suspicion rises every time you try it and
 * a great deal when it lands, so the profitable line is self-limiting: a boss
 * who plays sharp every week ends up being caught most weeks. It decays, so a
 * player who does it twice a year never meets the mechanism at all.
 *
 * ## And the reason a broke boss can still sit down
 *
 * You may put a possession on the table when you cannot cover the stake in
 * cash. Losing your father's watch at cards is the correct fiction and it is
 * also the obstacles rule — *an obstacle a broke boss cannot answer is not an
 * obstacle* — applied to an opportunity instead of a threat.
 */

/** How you sat. See the design note above. */
export type CardStyle = 'straight' | 'lose' | 'hard';

export interface TableDef {
  id: string;
  /** As somebody would say it, not as a listing would. */
  name: string;
  /** Catalogue stake in founding-year money. Run through `priced()`. */
  stake: number;
  /**
   * Respect needed to be welcome.
   *
   * The tiers are the only progression here, and they are the reason this
   * belongs in the middle of the game rather than the start: the back room is
   * open on day one and the room upstairs is a thing you are eventually
   * invited to.
   *
   * **Sized against a plotted distribution, and the first attempt was not.**
   * These went in at 0 / 25 / 55 on intuition. `ladder.probe` prints the share
   * of weeks a career spends at or above a ladder of respect bars, and against
   * that the top room's 55 was cleared in **77% of weeks** — an invitation
   * almost everybody already had. The measured shape is:
   *
   *     respect at least   25    55    85   120   150   180   220
   *     share of weeks     89%   77%   62%   46%   36%   27%   21%
   *
   * So the club sits at 85 and the room upstairs at 180: roughly three weeks
   * in five for the middle room, and rather more than one in four for the top
   * one. The bar is on the distribution rather than beside it, which is the
   * thing `demandRespect` failed to do when it went in at 28 against a
   * starting value of 30.
   */
  respectAbove: number;
  blurb: string;
}

/**
 * Three rooms.
 *
 * The bottom one is open from the first morning at $400, for the same reason
 * the possessions catalogue opens at $1,800: 24 careers in 36 finish under
 * $100,000, and a game whose cheapest table is priced for the other twelve is
 * a panel.
 */
export const TABLES: TableDef[] = [
  {
    id: 'back_room',
    name: 'The back room on Prospect',
    stake: 400,
    respectAbove: 0,
    blurb:
      'Four men, a bare bulb and a folding table. Nobody here is anybody, which is restful and occasionally useful.',
  },
  {
    id: 'the_club',
    name: 'The Amaranth Club',
    stake: 2_500,
    respectAbove: 85,
    blurb:
      'A members’ room with a doorman who knows faces. People come here to be seen not minding about money.',
  },
  {
    id: 'upstairs',
    name: 'The room upstairs',
    stake: 12_000,
    respectAbove: 180,
    blurb:
      'No sign, no doorman, and an invitation you cannot ask for. Everything decided in this city gets discussed here first.',
  },
];

export const TABLE_BY_ID: Record<string, TableDef> = Object.fromEntries(
  TABLES.map((t) => [t.id, t]),
);

export const STYLE_LABEL: Record<CardStyle, string> = {
  straight: 'Play it straight',
  lose: 'Lose to them',
  hard: 'Play hard',
};

export const CARDS = {
  /** A standing weekly game. The cap on everything below. */
  intervalDays: 7,

  /**
   * Straight play: near a coin flip, paying less than even money.
   *
   * `maxWin * payout` must stay under 1 or a patient player has an income
   * rather than a vice. At the ceiling that is 0.55 × 0.8 = 0.44 against a
   * 0.45 chance of losing the lot, so the house edge survives a boss with
   * street smarts at maximum. Asserted in `cards.test.ts`, because an
   * invariant defended by a comment is an invariant nobody is defending.
   */
  baseWin: 0.46,
  perStreetSmarts: 0.006,
  maxWin: 0.55,
  payout: 0.8,

  hard: {
    /** Better than straight, conditional on getting away with it. */
    win: 0.62,
    /**
     * And it pays properly when it lands.
     *
     * Above even money on purpose. A "risky option" that returns less than the
     * safe one in every currency is not a choice, it is a trap with a label,
     * and this project has spent four rounds learning to tell those apart. The
     * price of this row is standing, notoriety and being watched — see
     * `suspicion` below.
     */
    payout: 1.4,
    caughtBase: 0.18,
    /** Every point of suspicion makes the next attempt worse. */
    caughtPerSuspicion: 0.006,
    /** Street smarts keep your hands quiet, up to a point. */
    caughtPerStreetSmarts: 0.004,
  },

  /**
   * How closely people are watching your hands.
   *
   * The whole anti-grind mechanism, and deliberately not a hard limit: a boss
   * who plays sharp twice a year never meets it, and one who does it every
   * week is caught most weeks. Same shape as heat, for the same reason.
   */
  suspicion: {
    perHardHand: 8,
    perCatch: 25,
    decayPerWeek: 4,
    max: 100,
  },

  /**
   * Losing on purpose.
   *
   * `civicFavourChance` is the mechanic. Civic standing *drifts toward a
   * target* every week in `tickCivic`, so a one-off boost to standing would be
   * gone inside a fortnight — the durable thing a figure can give you is a
   * favour owed, and that is what this buys. Capped by `CIVIC.maxOwed` like
   * every other route to one, so this is a *faster* road to a favour and never
   * a bigger stock of them.
   *
   * The chance is a share rather than a certainty because a man who takes your
   * money at cards has not agreed to anything, and both of you know it.
   */
  lose: {
    civicFavourChance: 0.45,
    /** Standing moves too, and washes out. That is honest rather than useless. */
    civicStanding: 6,
    /** With a rival, what you bought is the beginning of trust. */
    rivalTrust: 5,
    rivalGrudge: -4,
  },

  /** Sitting down at all, whatever happens to the money. */
  straight: {
    civicStanding: 2,
    rivalTrust: 1,
  },

  /** Being seen to be sharp. */
  caught: {
    civicStanding: -14,
    rivalTrust: -8,
    rivalGrudge: 6,
    respect: -6,
    fear: 3,
    notorietyScale: 0.8,
  },

  /** Taking a big pot off somebody in a room where it is noticed. */
  won: {
    /** Respect, at the top table only — nobody hears about the back room. */
    respectAtStake: 6_000,
    respect: 4,
    civicStanding: -2,
  },

  /** What a hand at the table teaches you. */
  trainStraight: 1.2,
  trainHard: 2,
} as const;

/**
 * Who is sitting opposite, by table.
 *
 * Drawn from `stableNoise` rather than the causal stream, so the screen can
 * say who is at the game before you decide whether to sit — reading the world
 * must never change it, the rule `perceive`, `legitimacy`, `authority` and the
 * whisper feed all follow.
 *
 * The weighting is the progression. The back room is mostly nobody and the
 * room upstairs is mostly somebody, which is what makes the top table worth
 * being invited to beyond the size of the pot.
 */
export const SEATED: Record<string, { nobody: number; civic: number; rival: number }> = {
  back_room: { nobody: 0.7, civic: 0.15, rival: 0.15 },
  the_club: { nobody: 0.35, civic: 0.4, rival: 0.25 },
  upstairs: { nobody: 0.1, civic: 0.5, rival: 0.4 },
};

/** Nobody in particular, for the weeks when it is just a card game. */
export const NOBODIES = [
  'a man who owns three laundries and talks about all of them',
  'somebody’s brother-in-law, in over his head and enjoying it',
  'a wholesaler from the fruit market who never blinks',
  'an off-duty fireman with more money than the job pays',
  'a quiet woman nobody introduced who plays better than anybody here',
  'a bookmaker taking a night off from the other side of it',
];
