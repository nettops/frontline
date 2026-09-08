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
 * ## What you put up decides the company
 *
 * There were three rooms with three fixed stakes and a respect bar on each,
 * and the ladder was doing two jobs badly. Round 21 cleared every bar in the
 * game — Respect 223 against a top room asking 180 — read the two shut rows,
 * and filed the whole system under *wanted to, was blocked*. The open row was
 * open the entire career and advertised itself as **"Nobody who decides
 * anything"**. A ladder whose bottom rung says there is nothing on it is a
 * ladder nobody climbs.
 *
 * So the rooms are gone and the bet is the lever. You name a number; what the
 * table will take off you grows with your name; and **the share of your own
 * ceiling you are willing to lose decides who is sitting opposite**. Put up
 * pocket money and it is a card game. Put up something that would hurt and the
 * people who decide things in this city are at the table, because that is who
 * plays for that.
 *
 * That makes the favour route expensive on purpose. Losing on purpose to a
 * judge was $2,500 at a fixed table; it is now whatever it costs to be in a
 * room with one, which is most of what you could lose.
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
 * **One hand a day, and no more.** The game used to run weekly and that was
 * the cap on everything below. It is a standing game now — there is a table
 * every night — so the cap moved onto the hand rather than the calendar, and
 * the two mechanisms underneath had to be re-clocked for a sevenfold
 * throughput. See `suspicion.decayPerDay` and `learnAtCeiling`.
 *
 * **Straight play cannot be made profitable.** `maxWin` × `payout` is under 1
 * at the ceiling of the attribute, checked by a test rather than by arithmetic
 * in a comment.
 *
 * **Playing hard gets you watched.** Suspicion rises every time you try it and
 * a great deal when it lands, so the profitable line is self-limiting. The
 * arithmetic: a hand is worth `(1-c)(0.62 x 1.4 - 0.38) - c` and turns
 * negative at a catch chance of 0.328, which `caughtBase` plus
 * `caughtPerSuspicion` reaches at 25 points of suspicion — three sharp hands
 * for a boss with no street smarts, seven for one at fifty. Against
 * `decayPerDay` that makes **about one sharp hand a week sustainable and
 * anything faster a spiral**, which is the cadence the weekly game used to
 * impose. It is chosen now instead of imposed, which is the whole point of
 * the change.
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

/**
 * What the table will take off you, and what that buys.
 *
 * The old ladder was three fixed stakes behind three respect bars — 400 at
 * nothing, 2,500 at 85, 12,000 at 180 — sized against a plotted distribution
 * of how many weeks a career spends above each bar. That distribution is still
 * the right instrument and the bars were the wrong shape for it, so the same
 * measurement is used to size a curve instead:
 *
 *     respect at least   25    55    85   120   150   180   220
 *     share of weeks     89%   77%   62%   46%   36%   27%   21%
 *
 * `ceiling(respect) = ceilingBase * 2 ** (respect / respectPerDoubling)`,
 * priced for the year like every other figure in the game:
 *
 *     respect     0     85    180    260    340     400
 *     ceiling   500  2,300 17,000 90,000 480,000 1,100,000
 *
 * A top career finishes on an estate around $2.1M, so the very top of this is
 * a night that can take half of everything. That is deliberate and it is the
 * answer to *"a sink with teeth"* — nothing else in the game lets a boss lose
 * half his estate on one decision he made himself.
 */
export const STAKES = {
  /** The smallest bet anybody bothers to deal you in for. */
  floor: 200,

  /** What somebody nobody has heard of can put on a table. */
  ceilingBase: 500,

  /**
   * Respect that doubles what the room will take.
   *
   * 35 rather than a rounder number because it puts the old top room's 12,000
   * at respect 160 — close to where it used to sit at 180 — so a career that
   * played the old game finds the same money at roughly the same point, and
   * everything past it is new road rather than a re-tuning of the old one.
   */
  respectPerDoubling: 35,

  /**
   * And where the curve stops, which the first version did not have.
   *
   * The table above was sized against `RESPECT_BARS` — 25 to 260 — read as the
   * range a career covers. It is not: that ladder is *the share of weeks spent
   * at or above each bar*, and the respect a career actually ends on runs
   * 565 / 666 / 807 across the four-year population. At 666 an uncapped curve
   * offers a table of **$262,000,000**, and the median 300-day career was
   * measured able to bet $1,049,203 before this line existed.
   *
   * That is the exact trap the note under `TableDef.respectAbove` recorded
   * when the three rooms were sized — a bar read off the wrong axis of the
   * right distribution — repeated on the curve that replaced them.
   *
   * The curve itself is unchanged, so every figure in the table above still
   * holds where a person plays: a human career finished round 21 on Respect
   * 223, which is a table of about $42,000. The cap sits just above the top of
   * that table and clips nothing inside it.
   */
  ceilingCap: 1_200_000,

  /**
   * Where the company changes, as a share of your own ceiling.
   *
   * Bands rather than absolute money, because the question is what *you* are
   * risking. A boss who can put up ninety thousand and bets two is playing for
   * pocket money and the room knows it; a nobody betting his whole ceiling of
   * five hundred is doing something that gets noticed. Both are true and only
   * a share can say both.
   */
  quietBelow: 0.15,
  seriousAbove: 0.6,
} as const;

/** The three bands `STAKES` cuts, in the order the mixes below are keyed. */
export type StakeBand = 'quiet' | 'middling' | 'serious';

export const STYLE_LABEL: Record<CardStyle, string> = {
  straight: 'Play it straight',
  lose: 'Lose to them',
  hard: 'Play hard',
};

export const CARDS = {
  /**
   * One hand a day.
   *
   * Was 7. A weekly game was the cap on every effect in this file, and taking
   * it out multiplied the throughput of all of them by seven — so `suspicion`,
   * the training and the respect on a win all moved with it rather than being
   * left to be found later by a probe. See each.
   */
  intervalDays: 1,

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
    /**
     * Was `decayPerWeek: 4`, which is 0.57 a day.
     *
     * Under a weekly game that put the sustainable cadence at exactly the
     * cadence the game allowed, so nobody ever had to choose. Under a nightly
     * one it would have meant a nineteen-week lockout from a single bad
     * fortnight — a punishment that takes the game away, which is the failure
     * round 13 recorded against lay-low and this project has not repeated
     * since.
     *
     * 1.5 a day makes the arithmetic in the header true: 8 in against 1.5 out
     * balances at a sharp hand every 5.3 days, so about one a week is
     * sustainable for ever and twice a week runs away to the cap. The cadence
     * the old clock imposed is now the cadence the player picks.
     */
    decayPerDay: 1.5,
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
    /*
       Uncapped by nothing but the clock, which is why these all moved.

       `civicFavourChance` is capped by `CIVIC.maxOwed` and did not need to
       move — a faster road to a favour, never a bigger stock of them, which is
       what that cap was put there to guarantee. Everything beside it is a raw
       addition per hand, sized when there were 52 hands in a year. There are
       365 now. See `straight` below, where leaving them alone turned out to be
       measurable rather than theoretical.
    */
    civicFavourChance: 0.45,
    /** Standing moves too, and washes out. That is honest rather than useless. */
    civicStanding: 1,
    /** With a rival, what you bought is the beginning of trust. */
    rivalTrust: 0.8,
    rivalGrudge: -0.6,
  },

  /**
   * Sitting down at all, whatever happens to the money.
   *
   * **These two were 2 and 1, and they were the thing that broke.** Straight
   * play loses about 1% of the stake a hand — near enough free — so a career
   * that sat down every night for three hundred nights collected six hundred
   * points of civic standing and three hundred of rival trust for almost
   * nothing. Measured, that took **Boss from 15 careers in 36 to 25**, while
   * the same careers held less respect, fewer favour-weeks and $925,260 less
   * estate. An arm that burnt the same money every night and never sat down
   * reached Boss in **0**, so it was not the bot playing a smaller safer
   * career — it was these two numbers, seven times over.
   */
  straight: {
    civicStanding: 0.3,
    rivalTrust: 0.15,
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
    /**
     * Respect, when the pot was worth talking about — as a share of what the
     * table would have taken, not a fixed sum.
     *
     * It was `respectAtStake: 6_000`, which worked while the stakes were three
     * fixed numbers and stops working the moment they are a curve: at Respect
     * 260 the ceiling is ninety thousand, so every hand a boss plays clears a
     * six-thousand bar and a nightly game becomes a reputation pump. A share
     * of your own ceiling says the thing the fixed figure was reaching for —
     * nobody hears about a man playing under himself.
     */
    respectAtShare: 0.5,
    respect: 0.6,
    civicStanding: -0.3,
  },

  /**
   * What a hand at the table teaches you, at the top of what you could lose.
   *
   * Scaled by the same share, and this is the one that would have been an
   * outright exploit. `trainAttribute` took a flat 1.2 a hand whatever was on
   * the table, and a nightly game turns that into 365 free points of street
   * smarts a year for two hundred dollars a night. A night where nothing was
   * at risk teaches nothing, which is both the fix and the truth.
   */
  learnAtCeiling: { straight: 0.2, hard: 0.3 },
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
export const SEATED: Record<StakeBand, { nobody: number; civic: number; rival: number }> = {
  quiet: { nobody: 0.7, civic: 0.15, rival: 0.15 },
  middling: { nobody: 0.35, civic: 0.4, rival: 0.25 },
  serious: { nobody: 0.1, civic: 0.5, rival: 0.4 },
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
