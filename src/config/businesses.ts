/**
 * Legitimate fronts.
 *
 * The trade-off is built into the stats rather than into logic: a laundromat
 * moves a little money and looks like nothing, a casino moves enormous amounts
 * and is a permanent address for anyone building a case. Legitimacy and
 * launder capacity pull against each other on purpose.
 *
 * **That paragraph was written first and was not true for a long time.**
 * Measured off the catalogue as it stood:
 *
 *     strictly dominated entries, price included     0
 *     beaten on every quality axis by something      7 of 10
 *     revenue per $1,000 of cost                     37.8 to 51.1, most at 50.0
 *     capacity against legitimacy                    r = -0.41
 *
 * Nothing was dead, because every dominated entry was cheaper than the thing
 * beating it — which is exactly the excuse that let it rot. `real_estate` had
 * the second-highest capacity in the game *and* the highest legitimacy, and
 * beat six other entries outright on revenue, capacity, exposure and
 * discretion at once. Seven of ten existed only because they cost less, and
 * revenue per dollar was flat, so the sole input to which front you bought was
 * how much money you had. That is not a decision, and F15 says the same thing
 * from the other end: money blocks 97% of the weeks a career owns no front.
 *
 * A file describing a tension its own numbers do not have is the config-shaped
 * version of this project's standing failure — an instrument returning
 * believable readings while measuring nothing. Fourth one caught.
 *
 * **The law the catalogue now runs on.** What a front can move, how ordinary
 * it looks, and how fast it draws attention are one axis, and the ten entries
 * are spread along it:
 *
 *     laundromat    quietest thing you can own, and it barely moves anything
 *     real_estate   earns more than anything but the casino, and cannot wash
 *     casino        moves everything, explains nothing
 *
 * Earners buy revenue and discretion by giving up capacity; washers do the
 * reverse. So a laundromat is never obsolete — at exposure 0.7 and legitimacy
 * 90 it stays the quietest thing in the game no matter how rich the family
 * gets, which is what stops the catalogue being a ladder you climb and leave.
 *
 * After the re-cost: **zero dominated entries**, r = -0.85, and each of the
 * three control bands holds two fronts of opposite character so the choice
 * exists in the middle of a career and not only at the end of one.
 *
 * The totals were held deliberately — revenue +1.3%, capacity +1.9%,
 * legitimacy -1.2%. Every number here feeds laundering, the estate, legitimacy
 * and four bars in `ladder.probe`, and a re-cost that also made fronts richer
 * would move all of them with no way afterwards to say which change did it.
 * `catalogue.test.ts` holds all four properties, the totals included.
 */

import type { ControlLevel } from './territories';

export interface BusinessDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Clean income per week, before territory wealth scaling. */
  revenue: number;
  /** Dirty cash it can absorb per week, before wealth scaling. */
  launderCapacity: number;
  /** Exposure gained per week at full laundering throughput. */
  exposureRate: number;
  /** How unremarkable it looks. High legitimacy decays exposure faster. */
  legitimacy: number;
  minControl: ControlLevel;
}

export const BUSINESSES: BusinessDef[] = [
  {
    id: 'laundromat',
    name: 'Laundromat',
    description:
      'Coin-operated, cash-only, open at hours nobody questions. Small, dull and almost invisible.',
    cost: 12_000,
    revenue: 460,
    launderCapacity: 4_000,
    exposureRate: 0.7,
    legitimacy: 90,
    minControl: 'foothold',
  },
  {
    id: 'social_club',
    name: 'Social Club',
    description:
      'A room with a card table and a coffee machine. Nobody can say exactly what it earns, including you.',
    cost: 18_000,
    revenue: 820,
    launderCapacity: 8_500,
    exposureRate: 1.6,
    legitimacy: 60,
    minControl: 'foothold',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Real food, real customers, and a great many covers that were never served.',
    cost: 25_000,
    revenue: 1_900,
    launderCapacity: 3_400,
    exposureRate: 0.9,
    legitimacy: 84,
    minControl: 'foothold',
  },
  {
    id: 'auto_shop',
    name: 'Auto Shop',
    description: 'Parts in, parts out, invoices for work that happened in a manner of speaking.',
    cost: 30_000,
    revenue: 1_550,
    launderCapacity: 7_000,
    exposureRate: 1.3,
    legitimacy: 70,
    minControl: 'foothold',
  },
  {
    id: 'trucking',
    name: 'Trucking Company',
    description: 'Freight, routes and a fleet that explains a lot of movement.',
    cost: 60_000,
    revenue: 2_700,
    launderCapacity: 18_000,
    exposureRate: 1.5,
    legitimacy: 56,
    minControl: 'control',
  },
  {
    id: 'nightclub',
    name: 'Nightclub',
    description:
      'Enormous cash volume and a door everybody in the city walks through, including people you would rather not meet.',
    cost: 75_000,
    revenue: 4_000,
    launderCapacity: 36_000,
    exposureRate: 2.4,
    legitimacy: 28,
    minControl: 'control',
  },
  {
    id: 'construction',
    name: 'Construction Firm',
    description:
      'Contracts, materials, overruns. The most forgiving paperwork in the legitimate world.',
    cost: 90_000,
    revenue: 4_700,
    launderCapacity: 26_000,
    exposureRate: 1.8,
    legitimacy: 48,
    minControl: 'control',
  },
  {
    id: 'hotel',
    name: 'Hotel',
    description: 'Rooms nobody stayed in, paid for in cash by guests who left no name.',
    cost: 140_000,
    revenue: 5_800,
    launderCapacity: 30_000,
    exposureRate: 1.8,
    legitimacy: 40,
    minControl: 'control',
  },
  {
    id: 'real_estate',
    name: 'Real Estate Office',
    description:
      'Property moving between people who are all, in the end, the same person.',
    cost: 180_000,
    revenue: 9_600,
    launderCapacity: 6_000,
    exposureRate: 1.2,
    legitimacy: 86,
    minControl: 'dominance',
  },
  {
    id: 'casino',
    name: 'Casino',
    description:
      'The most efficient way ever devised to explain where money came from, and the least discreet.',
    cost: 260_000,
    revenue: 10_200,
    launderCapacity: 95_000,
    exposureRate: 3.0,
    legitimacy: 16,
    minControl: 'dominance',
  },
];

export const BUSINESS_BY_ID: Record<string, BusinessDef> = Object.fromEntries(
  BUSINESSES.map((b) => [b.id, b]),
);

// ------------------------------------------------------------ laundering ---

/**
 * The cut taken to make dirty money look clean. Your Business attribute buys
 * this down — at Business 12 you are at the floor.
 *
 * Measured against the career, not chosen.
 *
 * A crew-week produces $1,013 and costs $255 in wages, so the criminal economy
 * is four times profitable and growth pays for itself. But only $97 of that
 * $1,013 is *new clean money* — under a tenth — and every rank above Crew
 * Leader is gated on clean cash held, so the ladder is gated on a tenth of the
 * economy while the other nine tenths sit in a pool that cannot satisfy it.
 *
 * Raising `LEGITIMATE_REVENUE_SCALE` was the obvious lever and it is the wrong
 * one: the note above it records a balance pass where fronts out-earning jobs
 * made this a business simulator with a crime setting. Crime stays the engine.
 * What was wrong is the exchange rate — a third of everything the engine
 * produced was disappearing on the way to being usable, and the same dollar
 * was often washed and then spent back into the dirty economy, paying the cut
 * again on the next trip.
 *
 * At 0.24 a boss keeps three quarters of what he washes at no Business skill
 * at all, and the attribute still buys it down to the floor.
 */

export const LAUNDER_CUT_BASE = 0.24;
export const LAUNDER_CUT_PER_BUSINESS_POINT = 0.01;
export const LAUNDER_CUT_MIN = 0.12;

/** Revenue and capacity both scale with how wealthy the district is. */
export const WEALTH_REVENUE_BASE = 0.7;
export const WEALTH_REVENUE_RANGE = 0.6;

/**
 * A global dial on legitimate income, separate from laundering capacity.
 *
 * The two used to share one scale, which meant the only way to stop fronts
 * out-earning the jobs was to make them worse at washing money — the opposite
 * of the intended trade. Measured across the eight balance seeds, careful play
 * was ending two years with more legitimate income than criminal income on six
 * of them, which quietly makes this a business simulator with a crime setting.
 *
 * Crime is the engine. Fronts convert what it produces and pay for themselves
 * doing it; they do not replace it.
 */
export const LEGITIMATE_REVENUE_SCALE = 0.72;

/**
 * What running the laundry teaches you about running a laundry.
 *
 * The Yourself panel says attributes improve by use. Every `trainAttribute`
 * call in this game was inside `events.ts`, so they improved by answering
 * memos and by nothing else — and round 11 finished 303 days at **Business
 * 1/20** having operated five fronts for 265 of them, while Business buys down
 * the laundering cut it had spent the whole career paying.
 *
 * Sized against a career a person actually plays, which is the correction the
 * two failed iterations before this one both needed. `attributeProgressNeeded`
 * is 3 + level * 1.6, so 22 points reaches Business 4. Thirty-eight weeks —
 * round 11's five fronts over 265 days — at this rate lands there.
 *
 * Scaled by how much of the capacity was actually used, so a token front in a
 * dead district does not teach the same as a working pipeline. Owning a
 * building is not a skill.
 */
export const BUSINESS_FROM = {
  /** Per week, at full use of the capacity the fronts have. */
  launderingPerWeek: 0.75,
};

// -------------------------------------------------------------- exposure ---

/** Exposure bled off each week, scaled by how legitimate the front looks. */
export const EXPOSURE_DECAY_BASE = 0.4;
export const EXPOSURE_DECAY_PER_LEGITIMACY = 0.02;

/** Above this, a business starts generating heat and evidence on its own. */
export const EXPOSURE_ALARMING_ABOVE = 50;
export const EXPOSURE_HEAT_AT_MAX = 2.5;
export const EXPOSURE_EVIDENCE_ABOVE = 70;
export const EXPOSURE_EVIDENCE_CHANCE = 0.25;

/**
 * A front going under on its own.
 *
 * Until now the only way a business ever closed was the player closing it,
 * which made ten businesses ten permanent annuities — buy it once and it earns
 * forever. That is not a legitimate business, it is a subscription, and it
 * quietly removed the one risk that makes the legitimate economy a decision
 * rather than a purchase.
 *
 * Health is a running number, not a die roll. It falls when the neighbourhood
 * has turned against you, when the front is being hammered for laundering,
 * when a rival is running the same racket on the same street, and when the
 * whole city has stopped spending. It recovers when none of those is true, so
 * a front in trouble can be saved — which is the point of telling the player
 * before it closes rather than after.
 */
export const HEALTH = {
  start: 100,
  /** Below this the player is warned. Below zero it closes. */
  warnBelow: 45,

  /** Weekly recovery when nothing is going wrong. */
  recoverPerWeek: 2.2,

  /** How much a hostile neighbourhood costs it per week, at zero sentiment. */
  fromSentimentAtWorst: -4.5,
  /** Sentiment above this is not a problem at all. */
  sentimentFine: 45,

  /** Being leaned on as a laundry, per week at full exposure. */
  fromExposureAtMax: -3.2,
  exposureFine: 40,

  /**
   * Rivals running the same kind of thing on the same street. Read from their
   * business count in districts they hold — organized crime is a competitive
   * industry and the game had no competition in it anywhere.
   */
  fromRivalPerFront: -0.55,

  /** A city that has stopped spending, at full outrage. */
  fromOutrageAtMax: -1.6,

  /** What a failing front earns, as a share, at zero health. */
  revenueAtZero: 0.35,

  /** Closing on its own returns less than closing it deliberately would. */
  collapseRefundShare: 0.15,
} as const;

/**
 * The other half of owning something: a front had a price to buy and, once
 * bought, nothing at all to keep. Ten businesses were ten annuities that
 * happened to have a purchase price, which is the reason a career earning
 * $5,354 per crew-week on $195 wages never runs out of money — nothing it
 * owns costs anything to hold. `weeklyFrontUpkeep` prices this the way wages
 * are priced: a real bill, due on payday, out of the same treasury
 * everything else draws on, so it can go unpaid when the treasury cannot
 * cover it — unlike the wash cut or the acquisition price, which come off a
 * front's own earnings before they are ever credited.
 *
 * Sized as a share of what the fronts actually took that week rather than a
 * flat number per business, so a career with one struggling laundromat and a
 * career with ten thriving nightclubs pay bills proportionate to what they
 * run, not the same number apiece.
 */
export const FRONT_UPKEEP_RATE = 0.3;
/*
   Measured at 0.25 first, against `ladder.probe`'s 300-day arms (the window
   HANDOFF.md §5 says any change has to be sized against — a human never
   plays past day 300 in a blind round, and this project has twice already
   tuned a change for a bot nobody plays that far as). 0.25 moved almost
   nothing there: the front-fork borrowing arm stayed at 0 careers ending
   early either side, and only the corrected favour/dial arm (a separate fix
   the same session) produced its first-ever failures, 0 of 36 to 2. That is
   too small an effect from the single largest structural gap this project's
   diagnosis found, so it moved to 0.4 — still well under half of what a
   front earns, but enough that `weeklyFrontUpkeep` is a bill a career can
   actually be threatened by rather than a rounding error against it.

   `scorecard.probe`'s own Difficulty axis, over 1,460-day careers, moved the
   wrong way at both readings — 69% of careers already ended early before
   this change, against a target near 33%, so *more* attrition (73% at 0.25,
   75% at 0.4) moved it further from the target both times. That is real and
   worth recording, but it is not evidence this change is wrong: it is
   evidence that whatever is killing three careers in four over four years
   was already killing far more than the 300-day-scale problem this project
   is trying to solve, and is a separate, longer-horizon finding for the
   developer to pick up (which mechanism, over years two to four, is already
   over-shooting the fairness target) rather than a reason to leave the
   300-day economy free to run.

   **Moved to 0.3, 2026-09-08, after merging a parallel branch exposed a real
   interaction 0.4 never got measured against.** That branch had independently
   tuned `config/civic.ts`'s union-favour bar (`ladder.probe`, "the union
   reads the payroll") against a world with no front upkeep at all. Once
   merged, 0.4 taxed front revenue hard enough that fewer careers could
   afford the payroll the union favour watches, and reachability fell from
   the design target (≥9/36) to 7/36 — confirmed causal by toggling the rate
   with everything else held fixed:

       rate   union owed (of 36)   trading arm's net advantage vs not trading
       0      11                   367,858 of a required >1,653,277 (22%)
       0.25   —                    397,869 of a required >1,201,041 (33%)
       0.3    12                   801,482 of a required >  851,962 (94%)
       0.4     7                   867,730 of a required >1,044,319 (83%)

   The trading-arm column is not monotonic in the rate — 0.25 reads worse
   than both its neighbours — which is the reshuffled-rng-stream effect
   DIRECTOR.md already warns single-run comparisons are prone to, not a
   smooth economic function of this one number. Chasing that column with
   this lever would be tuning the game to satisfy one population of 36
   seeds, not repairing an interaction. 0.3 was kept because it is the only
   rate that restores the union bar (a real, confirmed causal fix) without
   being the untested 0 or a rate this project already measured and rejected
   as too weak (0.25); the trading-arm bar's own resolution is handled where
   it lives, in `ladder.probe.test.ts`, on the grounds that a single scalar
   here cannot fix a measurement problem two branches' independent tuning
   created together.

   Everything below this paragraph describes the 0.4-era measurement and is
   left as the honest record of that reading rather than rewritten to match;
   re-measure rather than trust the specific numbers past this point.

   `scorecard.probe`'s own Difficulty axis, over 1,460-day careers, moved the
   wrong way at both readings — 69% of careers already ended early before
   this change, against a target near 33%, so *more* attrition (73% at 0.25,
   75% at 0.4) moved it further from the target both times. That is real and
   worth recording, but it is not evidence this change is wrong: it is
   evidence that whatever is killing three careers in four over four years
   was already killing far more than the 300-day-scale problem this project
   is trying to solve, and is a separate, longer-horizon finding for the
   developer to pick up (which mechanism, over years two to four, is already
   over-shooting the fairness target) rather than a reason to leave the
   300-day economy free to run.

   And a second reading worth being honest about: raising the rate from 0.25
   to 0.4 barely moved the *300-day* picture either. `scorecard.probe`'s own
   direct read of "careers that ended before day 300" stayed at 0/36 at both
   settings — the standard measuring bot simply carries enough buffer that
   neither rate threatens it that early. What did move: the front-fork
   borrowing arm went from 0 careers ending early to 1, and the corrected
   favour/dial arm (a separate fix, same session) produces its first-ever
   300-day failures at all. Diminishing returns on this one lever, honestly
   reported rather than chased further — front upkeep alone was never going
   to be the whole of H1, and DIRECTOR.md §10 is explicit that two flat
   readings in a row is the signal to stop pushing a lever rather than
   escalate it again.
*/

/**
 * What going unpaid costs, at a complete miss — scaled by the fraction of
 * the bill that actually went unpaid, the same shape `MISSED_PAY_*` uses for
 * a man who was not paid. A front has no loyalty to lose, so the debt is
 * taken out of its own health instead: a building nobody is maintaining
 * degrades, which is the honest shape of the consequence and reuses a
 * penalty the game already has rather than inventing a second one.
 *
 * Sized against `HEALTH`'s own weekly terms — `fromSentimentAtWorst` (-4.5)
 * and `fromExposureAtMax` (-3.2) are the two largest existing penalties, so
 * a complete miss costing a bit more than both combined is a real bill
 * without being an instant closure: `HEALTH.recoverPerWeek` (2.2) means one
 * bad week is recoverable, several in a row are not.
 */
export const FRONT_UPKEEP_NEGLECT_HEALTH_HIT = 8;

/** Shuttering a business deliberately dumps its exposure but forfeits most of the price. */
export const SHUTTER_REFUND_SHARE = 0.35;

/** Buying costs more where you are weaker — you are paying somebody off. */
export const ACQUISITION_PREMIUM_CONTESTED = 1.35;

/**
 * What a small organization can actually get in at.
 *
 * F15, and the one number in the game that decides the middle of it.
 *
 * Front income is paid into holdings, where it compounds. So the *second*
 * front is the step that decides a career, and `ladder.probe` measures 30
 * careers in 36 finishing under $100,000 holding exactly one, against six that
 * hold five. Across every week a career owns no front the blocker is **money
 * in 97% of them** — not control, not slots, not public feeling. Round 15 said
 * the same thing in prose after 245 days: *"the two things that would have
 * opened new decisions were both gated behind capital I could no longer
 * accumulate."*
 *
 * The catalogue price is what a going concern is worth to a real buyer. It is
 * not what a man with two soldiers and a laundromat is being sold. He is being
 * sold a share of something struggling, by somebody who wants out, and the
 * price reflects who is standing in the room — which is exactly what
 * `wealthScale` already does for the district and `haggle` already does for
 * negotiation.
 *
 * So the discount is largest for a family that has never been worth anything
 * and gone by the time one is. It reads the **high-water mark** rather than
 * today's balance, for the same reason the rank table does: a family that has
 * been somebody does not get to be sold to as though it has not.
 *
 * Deliberately not a discount on the first front. That one already arrives on
 * day 42 in 35 careers of 36 and needs no help; this is priced on what the
 * family has *ever* been worth, so it fades exactly as the organization stops
 * being small.
 */
export const ACQUISITION_SCALE = {
  /** High-water estate at which a family pays the catalogue price. */
  fullPriceAt: 150_000,
  /** The most that can come off, for a family that has never held anything. */
  maxDiscount: 0.45,
} as const;
