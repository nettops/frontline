/**
 * Law-enforcement attention.
 *
 * Heat is deliberately sticky: it decays slowly, decays slower the higher it
 * is, and only decays at all after consecutive quiet days. You cannot idle
 * your way down from 80 — you have to actively change how you operate.
 *
 * The numbers live in `tuning/heat.json` so they can be changed without a
 * TypeScript toolchain. Everything that explains them stays here — JSON cannot
 * hold a comment, and most of this file is the record of what each figure was
 * before, what it measured, and why it moved.
 */

import { checkBands } from './tuning/check';
import data from './tuning/heat.json';

export interface HeatTier {
  min: number;
  max: number;
  name: string;
  /**
   * Scales `HEAT_ABSORPTION` — what the organization makes go away by being
   * large — so an outfit under siege gets less benefit from its own apparatus.
   *
   * This used to scale the base decay rate as well, and that is what made the
   * meter a one-way door. See `HEAT_DECAY_SHARE`.
   */
  decayMultiplier: number;
  /** Percentage points subtracted from operation success at this tier's peak. */
  description: string;
}

/*
   The last stretch of the table reads differently, because it used to read
   the same.

   81 to 100 was one band with one name, one description and one decay rate,
   and the number itself clamps at 100 — so a player at 96 saw exactly what a
   player at 82 saw, and every further mistake changed nothing on screen. A
   round-7 tester described heat as going inert near the top, which is what a
   gauge with no travel left looks like from the outside.

   Splitting the band costs nothing mechanically at 81-92 and gives the last
   eight points somewhere to say so. The decay is lower again, which is the
   honest continuation of a curve that has been falling the whole way up.
*/
export const HEAT_TIERS: HeatTier[] = data.tiers;

checkBands('tuning/heat.json', HEAT_TIERS);

/**
 * Which tier a reading falls in — by floor alone, because heat is not an integer.
 *
 * This matched `heat >= t.min && heat <= t.max` against ranges written as whole
 * numbers (0-10, 11-25, 26-40 ...) while `org.heat` is a sum of three floating
 * channels. Every value in a gap — 10.4, 25.6, 40.2, 60.8, 80.5 — matched no
 * tier at all and fell through to the `?? HEAT_TIERS[0]` at the end, which is
 * *Quiet*, the bottom of the scale.
 *
 * Round 9's tester found it from the outside and correctly called it
 * impossible: their log read `Attention on the organization has risen: Quiet.`
 * on a day the Overview said `INVESTIGATING · 28/100`, and twice in one day.
 * `addHeat` only writes that line when the tier name changes, so a reading that
 * flickers into Quiet and back manufactures two announcements out of nothing
 * happening. The same lookup feeds the stat bar's tooltip, so the description
 * under the number was wrong on those days too.
 *
 * Taking the last tier whose floor the reading has passed has no gaps by
 * construction. `max` stays on the table because it is what the panels print.
 */
export function heatTier(heat: number): HeatTier {
  const clamped = Math.max(0, Math.min(100, heat));
  let tier = HEAT_TIERS[0];
  for (const t of HEAT_TIERS) {
    if (clamped >= t.min) tier = t;
  }
  return tier;
}

/**
 * How bad a reading is, in the three colours anything drawing a scale has.
 *
 * Indexes into `HEAT_TIERS` rather than comparing against numbers, so the
 * bands and the colours can never drift apart. The gauge on the Overview
 * colours twenty segments with this; the obvious alternative was to split the
 * range into thirds, which would have put two colour changes inside a tier and
 * invented boundaries the simulation does not have.
 *
 * The `hot` edge sits at the fourth tier — 41, Major Investigation — because
 * that is where the rest of the interface already reddens. The stat bar has
 * used `heat > 40` since long before this function existed, and two parts of
 * one screen disagreeing about when heat is bad is worse than either of them
 * choosing the wrong point.
 */
export type HeatSeverity = 'ok' | 'warn' | 'hot';

export function heatSeverity(heat: number): HeatSeverity {
  const index = HEAT_TIERS.indexOf(heatTier(heat));
  if (index <= 1) return 'ok';
  if (index === 2) return 'warn';
  return 'hot';
}

/**
 * The share of current heat that comes off on a quiet day.
 *
 * This was `HEAT_DECAY_PER_DAY = 1.1`, a flat figure multiplied by
 * `HeatTier.decayMultiplier` — and that multiplier *falls* as heat rises, from
 * 1.0 down to 0.22. So the meter cleared slowest exactly where it was most
 * overloaded, and measured across the whole scale it ran backwards: a family
 * at 20 shed 1.17 points a day, one at 35 shed 0.96, one at 90 shed 0.44.
 *
 * Against that, generation scales with everything the player does — jobs,
 * districts worked, trade moved, weeks at war — and outflow scaled with
 * nothing. Measured over 101,664 career-days the meter took in 1.295 a day and
 * gave back 0.924. A standing 40% surplus walked every career to the ceiling
 * and held it: median heat 80, a third of all days in the top band of seven,
 * and 0.469 points a day discarded at the clamp, which is over a quarter of
 * everything the player did registering nowhere at all.
 *
 * A share of the load fixes both properties at once. Removal now rises with
 * what there is to remove, and it is strongest where the surplus is largest.
 *
 * **The rule the old curve was protecting survives.** "You cannot idle your way
 * down from 80" was written as a rate that collapsed; it is now a matter of
 * time. Street heat carries a channel multiplier of 1.25, so on normal
 * difficulty the effective rate is 0.0325 a day — a half-life of about three
 * weeks of decay, or a month of calendar given the quiet-days gate lets decay
 * run on 70% of days. Eighty down to forty is a month of doing nothing.
 *
 * Chosen by plotting seven values against the resulting distribution rather
 * than by eye; see section 3.2 of
 * `docs/superpowers/specs/2026-08-23-heat-ratchet-design.md`. Below about 0.018
 * the top band still holds a sixth of every career; above about 0.030 the
 * bottom two bands hold a quarter and the law system goes decorative.
 */
export const HEAT_DECAY_SHARE = data.decayShare;

/** Days of no heat-generating activity before decay starts at all. */
export const QUIET_DAYS_BEFORE_DECAY = data.quietDaysBeforeDecay;

/**
 * What an organization makes go away on its own, every day, working or not.
 *
 * The gate above has a consequence nobody intended. `addHeat` resets
 * `quietDays`, so an outfit that generates heat at least every other day never
 * decays at all — and the bigger the outfit, the more continuously it works. A
 * three-man crew gets quiet gaps between jobs by accident. A twelve-man crew
 * gets none. Attention therefore behaved *worse* the larger you got, which is
 * backwards, and it is why measurement found the economy resting at three
 * people: heat generated per day exceeded heat removed per day at any size, so
 * the duty cycle was fixed and income never grew with the payroll.
 *
 * Over four years and twelve careers, not one reached Capo. Capo needs ten
 * people. The median career ended with three.
 *
 * This is the other half of `heatDistance`. That made each job quieter the
 * more organization stood between you and it; this makes the organization
 * itself absorb attention continuously — the lawyers on retainer, the
 * detective who owes somebody, the alderman's office that loses a file. They
 * do not stop working because you had a busy week.
 *
 * Deliberately small per head. It is a floor that lets a large family sustain
 * work, not a licence: it still runs through the tier multiplier, so heat that
 * is already dangerous stays sticky, and it is capped so that no family ever
 * becomes immune.
 */
export const HEAT_ABSORPTION = {
  /**
   * People below which there is no apparatus at all.
   *
   * A man on his own has nobody making anything go away, and neither do three.
   * This keeps the early game exactly as it was — including the rule above
   * that you cannot idle your way out of trouble, which matters most when the
   * organization is small enough for one bad week to end it.
   */
  fromCrew: data.absorption.fromCrew,
  /**
   * Per person on the payroll beyond that floor, per day.
   *
   * 0.12 was set when twelve people was a large family. A Boss-sized outfit is
   * thirty and the apparatus has to grow with it or the same fault returns one
   * rank higher — measured at 0.12, a family ran a job in 24% of the weeks of
   * a career and mean heat sat at 67 against a working line of 70.
   *
   * Raised again from 0.17 after `heatTier` was fixed. That function matched
   * integer ranges against a floating number, so every reading in a gap —
   * 10.4, 25.6, 40.2 — reported *Quiet*, whose decay multiplier is 1.0, the
   * fastest on the table. The bug had been quietly accelerating heat decay for
   * the whole life of the project, and this figure had been tuned on top of
   * it: correcting the lookup took Boss from 17 careers in 36 to 9 without
   * anything about heat itself changing.
   *
   * So this is the first value for the absorption that has ever been measured
   * against heat behaving as the table describes.
   */
  perCrew: data.absorption.perCrew,
  /**
   * The most an organization can make go away by being large alone.
   *
   * Was 2, which at `perCrew` 0.12 is reached at twenty people — and twenty
   * people is exactly where the top of the ladder starts. Underboss asks for
   * eighteen and Boss for twenty-eight, so every man hired past the cap was a
   * wage, a grievance and another body generating attention, against an
   * apparatus that had stopped growing.
   *
   * That is the same fault this whole block was written to fix, reappearing
   * one rank higher. The comment above says attention behaved worse the larger
   * you got and that not one career in twelve reached Capo because of it; the
   * cap moved the wall from three people to twenty rather than removing it.
   * Measured after the move: 36% of all weeks in a career are lost to heat
   * sitting above the line where any sensible boss stops working, and a family
   * runs a job in 24% of the weeks it lives.
   *
   * Four covers a full Boss-sized family — thirty-six people at 0.12 is 3.84 —
   * so the apparatus now scales the whole length of the ladder instead of the
   * first half of it. It still runs through the tier multiplier, so heat that
   * is already dangerous stays sticky, and it still does nothing at all about
   * an informant.
   */
  max: data.absorption.max,
  /**
   * And it only works on the street.
   *
   * A first version absorbed every channel, which quietly said that hiring
   * more people does something about an informant already inside the
   * organization. It does not. A man talking to the Bureau is not made to go
   * away by having a larger payroll — he is the one thing a big family cannot
   * fix by being big, and `informants.ts` exists because of it.
   *
   * Street heat is what jobs generate and what a fixer, a lawyer on retainer
   * or a detective who owes somebody can actually make quieter.
   */
  channel: 'street',
} as const;

/** Laying low multiplies decay, but you cannot run operations while doing it. */
export const LAY_LOW_DURATION_DAYS = data.layLowDurationDays;
/**
 * Laying low costs respect — the street notices you went quiet. Kept modest
 * because heat management is a repeated action: at a steep cost, a player who
 * correctly goes quiet several times ends up with less standing than one who
 * never manages heat at all, which inverts the whole point of the system.
 */
export const LAY_LOW_RESPECT_COST = data.layLowRespectCost;

/**
 * How much heat hurts operations. At heat 100 this removes 38 percentage
 * points of success chance, which is what makes the doom loop real:
 * high heat causes failures, failures cause more heat.
 */
export const HEAT_SUCCESS_PENALTY_AT_MAX = data.successPenaltyAtMax;

/** Dismissing an exposed crew member cuts a thread — and their loyalty to you. */
export const DISMISS_HEAT_REDUCTION = data.dismissHeatReduction;

/** Heat added when an operation is cancelled mid-run (loose ends). */
export const CANCEL_OPERATION_HEAT = data.cancelOperationHeat;

// ------------------------------------------------------------- channels ---

/**
 * Heat, decomposed.
 *
 * It was one number for a long time and the criticism of that was fair: every
 * kind of trouble arrived in the same meter and every kind of trouble had the
 * same answer, which was to go quiet for a fortnight. Somebody talking to the
 * Bureau is not a problem you can solve by not doing anything for two weeks.
 *
 * Three channels, chosen to match the four evidence sources agencies already
 * read, so nothing new had to be invented to make them mean something:
 *
 *   street   violence and jobs        cools fast when you stop
 *   money    fronts, laundering, cash cools slowly, and never on its own
 *   inside   informants and arrests   does not cool for going quiet at all
 *
 * `org.heat` is still the sum, clamped, so every threshold, tier and penalty
 * tuned against the old single number means exactly what it always meant. The
 * channels change *who* is looking and *what you can do about it*, not how much
 * pressure a given week of work produces.
 */
export type HeatChannel = 'street' | 'money' | 'inside';

export const HEAT_CHANNELS: HeatChannel[] = ['street', 'money', 'inside'];

export const HEAT_CHANNEL_LABEL: Record<HeatChannel, string> = {
  street: 'On the street',
  money: 'On the books',
  inside: 'Inside the family',
};

/**
 * What would put something in a channel that currently has nothing in it.
 *
 * Three of these bars are usually flat at once, and a flat bar with no
 * explanation reads as a broken gauge rather than as a quiet week — a round-7
 * tester reported "Inside the family" as stuck at zero after four defections,
 * which was true and correct and told them nothing. The `inside` channel in
 * particular is written by a short list of specific events, so the honest
 * thing is to name them.
 */
export const HEAT_CHANNEL_EMPTY: Record<HeatChannel, string> = {
  street: 'Nothing you have done lately happened where anybody could see it.',
  money: 'Nothing on paper has gone unexplained yet.',
  inside:
    'Nobody has been caught reaching into the department, and nobody has fumbled a witness or a piece of evidence. This one stays empty until somebody does.',
};

export const HEAT_CHANNEL_BLURB: Record<HeatChannel, string> = {
  street: 'Bodies, jobs, and things that happened where people could see them.',
  money: 'Fronts, deposits, and money that has not explained where it came from.',
  inside: 'People who used to work for you and are now talking to somebody else.',
};

/** Which channel an evidence source belongs to. Agencies read their focus. */
export const CHANNEL_OF_SOURCE: Record<
  'operation' | 'violence' | 'finance' | 'informant' | 'disposal',
  HeatChannel
> = {
  operation: 'street',
  violence: 'street',
  finance: 'money',
  informant: 'inside',
  // Gear the police came away with is a thing found on a street, which is
  // exactly what going quiet cannot take back.
  disposal: 'street',
};

/**
 * How each channel responds to going quiet.
 *
 * This is the whole point of the split. Laying low was a universal solvent; now
 * it is a specific tool that does one thing very well and one thing not at all.
 * A player pinned by an informant has to deal with the informant.
 */
export const LAY_LOW_BY_CHANNEL: Record<HeatChannel, number> = data.layLowByChannel;

/** Ordinary decay speed per channel, before tier and difficulty. */
/*
   Paper does not go away because you stopped. It goes away because it got old,
   which is why `money` is slower than `street` and `inside` slower again.
*/
export const DECAY_BY_CHANNEL: Record<HeatChannel, number> = data.decayByChannel;
