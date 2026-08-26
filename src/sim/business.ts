/**
 * Legitimate fronts and the laundering pipeline.
 *
 *   dirty cash → capacity → cut → clean cash
 *                    ↓
 *                 exposure → heat and evidence
 *
 * The decision this system exists to create: throughput is what makes dirty
 * money usable, and throughput is exactly what gets a business noticed.
 */

import { Rng, clamp } from './rng';
import type { Business, GameState, Id, Territory } from './types';
import { addEvidence, addLog, formatMoney, nextId } from './util';
import { canAfford, earnClean, spend, weeklyWageBill } from './economy';
import { trainAttribute } from './player';
import { addHeat } from './heat';
import { launderRestriction } from './investigation';
import { launderer, laundererRate } from './launderers';
import { holdingShare } from './holdings';
import { note } from './ledger';
import { worldMod } from './world';
import {
  DEFAULT_PRESSURE,
  INSPECTION,
  PRESSURE_BY_ID,
  type PressureDef,
} from '../config/pressure';
import { activity, priced } from './market';
import { outrageBusinessMultiplier } from './perception';
import {
  businessSlots,
  controlLevel,
  isContested,
  prosperity,
  territoryDef,
  usedSlots,
} from './territory';
import { RIVAL_IDS } from '../config/factions';
import {
  ACQUISITION_PREMIUM_CONTESTED,
  ACQUISITION_SCALE,
  BUSINESSES,
  BUSINESS_BY_ID,
  HEALTH,
  EXPOSURE_ALARMING_ABOVE,
  EXPOSURE_DECAY_BASE,
  EXPOSURE_DECAY_PER_LEGITIMACY,
  EXPOSURE_EVIDENCE_ABOVE,
  EXPOSURE_EVIDENCE_CHANCE,
  EXPOSURE_HEAT_AT_MAX,
  LAUNDER_CUT_BASE,
  LAUNDER_CUT_MIN,
  LAUNDER_CUT_PER_BUSINESS_POINT,
  BUSINESS_FROM,
  LEGITIMATE_REVENUE_SCALE,
  SHUTTER_REFUND_SHARE,
  WEALTH_REVENUE_BASE,
  WEALTH_REVENUE_RANGE,
  type BusinessDef,
} from '../config/businesses';
import { CONTROL_THRESHOLDS, SENTIMENT_HOSTILE_BELOW } from '../config/territories';
import { PAYDAY_INTERVAL } from '../config/economy';
import type { ControlLevel } from '../config/territories';

export function businessDef(business: Business): BusinessDef {
  return BUSINESS_BY_ID[business.defId];
}

export function ownedBusinesses(state: GameState): Business[] {
  return Object.values(state.businesses).filter((b) => b.status === 'operating');
}

/** A district's wealth scales both what a front earns and what it can absorb. */
function wealthScale(state: GameState, territoryId: string): number {
  return WEALTH_REVENUE_BASE + (prosperity(state, territoryId) / 100) * WEALTH_REVENUE_RANGE;
}

/**
 * What a front would earn here, before you own it.
 *
 * The Businesses panel used to quote `def.revenue` straight from the config —
 * the catalogue number, before the legitimate-income scale, before the
 * district's wealth, and before what the city is doing that month. Measured
 * across twelve careers, a front realises 74-79% of that figure, so every row
 * in the buy table overstated its own income by about a quarter.
 *
 * That is the same defect as the savings yield round 9 caught: a number that is
 * honest in the config and wrong on the screen. It matters more here than it
 * looks, because the buy table *is* the ladder — a player deciding whether to
 * save for the next tier up is comparing two numbers that are both inflated,
 * and unequally, since the multipliers differ by district.
 *
 * Health is assumed to start where a new front starts, which is what will
 * actually happen on the day it opens.
 */
export function revenueIfBought(
  state: GameState,
  def: BusinessDef,
  territoryId: string,
): number {
  return Math.round(
    priced(state, def.revenue) *
      wealthScale(state, territoryId) *
      LEGITIMATE_REVENUE_SCALE *
      (HEALTH.revenueAtZero +
        (1 - HEALTH.revenueAtZero) * clamp(HEALTH.start / 100, 0, 1)) *
      activity(state),
  );
}

export function weeklyRevenue(state: GameState, business: Business): number {
  // A struggling front earns like a struggling front, which is the warning the
  // player gets before it closes.
  const health = clamp((business.health ?? HEALTH.start) / 100, 0, 1);
  const scale = HEALTH.revenueAtZero + (1 - HEALTH.revenueAtZero) * health;
  return Math.round(
    priced(state, businessDef(business).revenue) *
      wealthScale(state, business.territoryId) *
      LEGITIMATE_REVENUE_SCALE *
      scale *
      // The cycle. A front is the most exposed thing you own to what the city
      // is actually doing — it is the only income in the game that comes from
      // people choosing to walk in.
      activity(state),
  );
}

/**
 * How the business itself is doing this week, before rounding.
 *
 * Exposed so the Businesses panel can show the player *why* a front is in
 * trouble rather than only that it is — the four terms are four different
 * problems with four different answers, and a number on its own would tell
 * them nothing they could act on.
 */
export function healthPressure(
  state: GameState,
  business: Business,
): { sentiment: number; exposure: number; rivals: number; city: number; total: number } {
  const t = state.territories[business.territoryId];
  const sentiment =
    t && t.sentiment < HEALTH.sentimentFine
      ? ((HEALTH.sentimentFine - t.sentiment) / HEALTH.sentimentFine) *
        HEALTH.fromSentimentAtWorst
      : 0;

  const exposure =
    business.exposure > HEALTH.exposureFine
      ? ((business.exposure - HEALTH.exposureFine) / (100 - HEALTH.exposureFine)) *
        HEALTH.fromExposureAtMax
      : 0;

  // Somebody else running the same kind of thing where you are running yours.
  let competition = 0;
  for (const id of RIVAL_IDS) {
    if ((t?.influence[id] ?? 0) < 25) continue;
    competition += (state.factions[id]?.businessCount ?? 0) * HEALTH.fromRivalPerFront;
  }

  const city = (state.city.outrage / 100) * HEALTH.fromOutrageAtMax;

  /*
     Recovery is a rate, not a prize for being untouched.

     This used to read `total < 0 ? total : HEALTH.recoverPerWeek`, which gave
     the whole +2.2 to a front with no pressure at all and none of it to a
     front with any. A district one point below `sentimentFine` cost a business
     its entire recovery, so there was no state in which a front was leaned on
     a little and still stood. Twelve four-year careers bought four fronts each
     and buried four each, and 22% of all paydays happened with every front the
     player owned already shuttered.

     Adding it means light pressure is survivable and real pressure still
     kills: a front holds its ground up to -2.2 a week and goes under above it,
     which is the trade the health readout in the panel has always described.
  */
  const total = sentiment + exposure + competition + city + HEALTH.recoverPerWeek;
  return {
    sentiment,
    exposure,
    rivals: competition,
    city,
    total,
  };
}

/** How hard this front is being leaned on. Absent reads as the old behaviour. */
export function pressureOf(business: Business): PressureDef {
  return PRESSURE_BY_ID[business.pressure ?? DEFAULT_PRESSURE];
}

export function launderCapacity(state: GameState, business: Business): number {
  return Math.round(
    businessDef(business).launderCapacity *
      wealthScale(state, business.territoryId) *
      pressureOf(business).launder,
  );
}

export function totalLaunderCapacity(state: GameState): number {
  return ownedBusinesses(state).reduce((sum, b) => sum + launderCapacity(state, b), 0);
}

export function totalWeeklyRevenue(state: GameState): number {
  return ownedBusinesses(state).reduce((sum, b) => sum + weeklyRevenue(state, b), 0);
}

/** The share taken to make dirty money look clean. Business ability buys it down. */
export interface LaunderOutlook {
  /** Total weekly capacity across every front you own. */
  capacity: number;
  /** Dirty cash held back to meet the coming payroll. */
  heldBack: number;
  /** What will go through this week. No longer capped by `capacity`. */
  washable: number;
  /** What would come out clean at the end of it. */
  clean: number;
  /**
   * How hard that leans on the premises: what is going through, over what they
   * comfortably hold. One is a full week. Two is twice as fast a way to lose a
   * front.
   */
  load: number;
  /**
   * What is actually deciding the week.
   *
   * `'capacity'` still means "you have more dirty money than these fronts will
   * take, and the rest waits" — which is true of any front you have not told
   * to lean. `'pushing'` is the new one: the ceiling is off because something
   * is set to `hard`, all of it is going through, and the premises are aging
   * at the rate you are pushing them.
   */
  limit: 'pushing' | 'capacity' | 'dirty' | 'nothing';
}

/**
 * What the washing machine will actually do this week, and why.
 *
 * There is a rule in `tickBusinesses` that nobody could see: the coming wage
 * bill is held back out of dirty cash rather than laundered, because paying
 * the cut on money that goes straight out the door the same day is a pure
 * loss. Correct, and invisible — a playtester with one front watched clean
 * money crawl in at four hundred a week against a three-thousand capacity and
 * concluded the gate was simply too expensive, when the real answer was that
 * almost everything they earned was spoken for before it reached the front.
 *
 * That makes the wage bill a laundering decision, which is a genuinely good
 * one and was being made blind. This is the readout for it.
 */
export function launderOutlook(state: GameState): LaunderOutlook {
  const capacity = Math.round(
    totalLaunderCapacity(state) * launderRestriction(state) * worldMod(state, 'launderCapacity'),
  );
  const heldBack = weeklyWageBill(state);
  /*
     Everything the payroll has not already spoken for, and no ceiling on it.

     This was `Math.min(capacity, surplus)`. Capacity is a risk dial now rather
     than a wall — see the comment on the laundering block in `tickBusinesses`
     — so the readout has to stop promising a limit the simulation no longer
     enforces.
  */
  /*
     The ceiling is gone on any front being leaned on, and nowhere else — see
     the allocation comment in `tickBusinesses`. So the readout has to ask the
     same question the tick asks: is anything set to `hard`?
  */
  const leaning = ownedBusinesses(state).some(
    (b) => b.status === 'operating' && pressureOf(b).id === 'hard',
  );
  const surplus = Math.max(0, state.org.dirtyCash - heldBack);
  const washable = capacity <= 0 ? 0 : leaning ? surplus : Math.min(capacity, surplus);
  const clean = Math.round(washable * (1 - launderCut(state)));
  const load = capacity > 0 ? washable / capacity : 0;
  return {
    capacity,
    heldBack,
    washable,
    clean,
    load,
    limit:
      washable <= 0
        ? 'nothing'
        : load > 1
          ? 'pushing'
          : surplus > capacity
            ? 'capacity'
            : 'dirty',
  };
}

/**
 * What the wash takes, this week.
 *
 * `LAUNDER_CUT_BASE` is 0.24 and it used to be the whole answer — the single
 * most punitive charge in the game and the only one that buys nothing.
 * Measured over 36 careers of 300 days a trading family sold $1,632,268, paid
 * $694,777 for stock, $105,821 in wages and **$156,255 to nobody at all**.
 *
 * So the base is what a *stranger* charges. Somebody who handles it for you
 * charges less, and charges less again the longer you keep them — see
 * `config/launderers.ts`. The Business attribute still buys the rate down on
 * top of whichever of the two applies, because that lever was right and is not
 * what changed.
 *
 * `LAUNDER_CUT_MIN` still floors a family dealing with strangers. A retained
 * arrangement is floored by its own `bestCut` instead, which is the whole
 * reason to have one.
 */
export function launderCut(state: GameState): number {
  const skill = state.player.attributes.business * LAUNDER_CUT_PER_BUSINESS_POINT;
  /*
     Freight in, freight out, and nobody counting very carefully.

     Ground where the paperwork is not examined takes a share off whatever the
     washing costs you — the launderer's rate is unchanged, the district simply
     means less of it sticks. See `config/holdings.ts`.
  */
  const cover = 1 - holdingShare(state, 'washing');
  const held = launderer(state);
  if (!held) return Math.max(LAUNDER_CUT_MIN, (LAUNDER_CUT_BASE - skill) * cover);
  return Math.max(held.bestCut, (laundererRate(state, held) - skill) * cover);
}

// ----------------------------------------------------------- acquisition ---

const CONTROL_RANK: ControlLevel[] = ['none', 'presence', 'foothold', 'control', 'dominance'];

function meetsControl(level: ControlLevel, required: ControlLevel): boolean {
  return CONTROL_RANK.indexOf(level) >= CONTROL_RANK.indexOf(required);
}

export function acquisitionCost(state: GameState, def: BusinessDef, t: Territory): number {
  const base = priced(state, def.cost) * wealthScale(state, t.id);
  // Buying in somewhere you do not securely hold means paying somebody off.
  const premium = isContested(t) ? ACQUISITION_PREMIUM_CONTESTED : 1;
  const haggle = 1 - Math.min(0.2, state.player.attributes.negotiation * 0.01);
  /*
     And who is standing in the room. See `ACQUISITION_SCALE`.

     Reads `org.record.estate` — the high-water mark — rather than calling
     `estate()`, and that is not only about the fiction. `estate.ts` imports
     `acquisitionCost` from this file to value a front, so asking it what the
     family is worth from inside the pricing function would be a cycle.
  */
  const ever = state.org.record?.estate ?? 0;
  const grown = clamp(ever / ACQUISITION_SCALE.fullPriceAt, 0, 1);
  const small = 1 - ACQUISITION_SCALE.maxDiscount * (1 - grown);
  return Math.round(base * premium * haggle * small);
}

export interface AcquireCheck {
  ok: boolean;
  reason: string | null;
  cost: number;
}

export function canAcquire(
  state: GameState,
  defId: string,
  territoryId: string,
): AcquireCheck {
  const def = BUSINESS_BY_ID[defId];
  const t = state.territories[territoryId];
  if (!def || !t) return { ok: false, reason: 'No such business or district.', cost: 0 };

  const cost = acquisitionCost(state, def, t);
  const level = controlLevel(t);

  if (!meetsControl(level, def.minControl)) {
    const label = CONTROL_THRESHOLDS.find((c) => c.level === def.minControl);
    return {
      ok: false,
      reason: `Needs ${def.minControl} in ${territoryDef(t.id).name} (${label?.min ?? '?'} influence).`,
      cost,
    };
  }
  if (usedSlots(state, t) >= businessSlots(t)) {
    return {
      ok: false,
      reason: `No room for another front in ${territoryDef(t.id).name}. Take more of the district.`,
      cost,
    };
  }
  /*
     The three refusals above each name the requirement and the number attached
     to it. This one used to say "Nobody in X will sell to you right now" and
     stop, which is the same sentence a district uses when it has decided about
     you — atmospheric, and useless to somebody trying to work out what to do.

     It cost two careers four rounds apart. Round 7 was refused every business
     in Little Sicily for ninety days and never learned why; the repair then was
     a label and a tooltip on the Territory panel, which is the screen holding
     the number rather than the screen making the refusal, and round 12 walked
     into the identical wall and did not own a front until day 200. A front is
     the only tap between the dirty economy and the clean one, so being silently
     held off one holds the player out of half the game.

     So it names the figure, the bar, and the way back. The way back was already
     free — `SENTIMENT_RECOVERY_PER_WEEK` runs whether or not anybody knows it
     is running — which is what made the silence expensive rather than merely
     unhelpful: the player was one piece of information short of a remedy they
     already had.

     Every caller reads `reason`, so the event that offers a front it cannot
     sell you (events.ts) explains itself now too, from this one string.
  */
  if (t.sentiment < SENTIMENT_HOSTILE_BELOW) {
    return {
      ok: false,
      reason:
        `Public feeling in ${territoryDef(t.id).name} is ${Math.round(t.sentiment)}; ` +
        `nobody there sells below ${SENTIMENT_HOSTILE_BELOW}. ` +
        `Leaving the district alone brings it back.`,
      cost,
    };
  }
  /*
     Holdings count towards a front, because a front is what they buy.

     Front income is paid into holdings so it compounds rather than being spent
     on the next job, and `acquireBusiness` draws on it directly. If this check
     kept reading only the wallet, a family with every dollar of its legitimate
     earnings put away would be told it could not afford the thing that money
     exists to buy.
  */
  /*
     And it names both halves of the subtraction.

     This said "You cannot cover the purchase." and stopped — no price, no
     balance, on the refusal that gates the only tap between the dirty economy
     and the clean one. `refusals.test.ts` walked past it for the same reason
     it walked past the memo pricing: its detector wants a comparison against a
     *named constant*, and this one compares against a local. A scanner that
     reads guards cannot see a guard whose bar is a variable.

     The shortfall is spelled out rather than left as arithmetic, because it is
     the number that decides whether the answer is "wait a fortnight" or "go
     and borrow it" — and somebody on Delacroix will lend against nothing.
  */
  const inHand = state.org.cash + state.org.dirtyCash + (state.org.holdings ?? 0);
  if (inHand < cost) {
    return {
      ok: false,
      reason:
        `${def.name} in ${territoryDef(t.id).name} is ${formatMoney(cost)} and you have ` +
        `${formatMoney(inHand)} — ${formatMoney(cost - inHand)} short.`,
      cost,
    };
  }
  return { ok: true, reason: null, cost };
}

export function acquireBusiness(
  state: GameState,
  defId: string,
  territoryId: string,
): Business | null {
  const check = canAcquire(state, defId, territoryId);
  if (!check.ok) return null;
  /*
     Holdings first, because this is the one thing they are for.

     Moving money from a box at a bank into a building is not selling in a
     hurry, so it does not pay the hurry price. Without this the previous
     change would tax every reinvestment fifteen per cent through `takeBack`
     and fight the design it exists to serve: front income would land somewhere
     it could only be spent on fronts at a discount.

     Everything else in the game still has to draw on the wallet.
  */
  const fromHoldings = Math.min(state.org.holdings ?? 0, check.cost);
  const rest = check.cost - fromHoldings;
  if (rest > 0 && !canAfford(state, rest)) return null;
  state.org.holdings = (state.org.holdings ?? 0) - fromHoldings;
  if (rest > 0 && !spend(state, rest, 'premises')) {
    // Put it back rather than losing it to a failed purchase.
    state.org.holdings = (state.org.holdings ?? 0) + fromHoldings;
    return null;
  }

  const business: Business = {
    id: nextId(state, 'biz'),
    defId,
    territoryId,
    purchasedDay: state.day,
    exposure: 0,
    health: HEALTH.start,
    revenueTotal: 0,
    launderedTotal: 0,
    lastLaundered: 0,
    status: 'operating',
  };
  state.businesses[business.id] = business;
  state.territories[territoryId].businessIds.push(business.id);

  addLog(
    state,
    `You now own ${BUSINESS_BY_ID[defId].name.toLowerCase()} in ${territoryDef(territoryId).name}. On paper, anyway.`,
    'money',
  );
  return business;
}

/**
 * Closing a front dumps its exposure and returns part of the purchase price.
 * The usual reason to do it is that it has become the most interesting thing
 * about you.
 */
export function shutterBusiness(state: GameState, businessId: string): void {
  const business = state.businesses[businessId];
  if (!business || business.status !== 'operating') return;
  const def = businessDef(business);

  business.status = 'shuttered';
  earnClean(state, Math.round(priced(state, def.cost) * SHUTTER_REFUND_SHARE));
  addLog(
    state,
    `${def.name} in ${territoryDef(business.territoryId).name} is closed. Whatever it was carrying goes with it.`,
    'money',
  );
}

// ------------------------------------------------------------------ tick ---

/**
 * Weekly, on payday, before wages — so a business can pay for the crew it
 * takes to hold the district it sits in.
 *
 * Returns what moved, for the log and the finances panel.
 */
export function tickBusinesses(
  state: GameState,
  rng: Rng,
): { revenue: number; laundered: number; cut: number } {
  if (state.day % PAYDAY_INTERVAL !== 0) return { revenue: 0, laundered: 0, cut: 0 };

  const operating = ownedBusinesses(state);
  if (operating.length === 0) {
    state.lastLaunderReport = null;
    return { revenue: 0, laundered: 0, cut: 0 };
  }

  let revenue = 0;
  let laundered = 0;
  let capacityTotal = 0;
  const cutShare = launderCut(state);

  /*
   * Keep the coming payroll back in dirty cash rather than washing it.
   *
   * Wages are paid from dirty first, so laundering the whole pile means paying
   * the cut on money that goes straight back out the door the same day — a
   * pure loss, and exposure on the business for nothing. You launder what you
   * intend to keep.
   */
  const keepBack = weeklyWageBill(state);
  const washable = Math.max(0, state.org.dirtyCash - keepBack);

  /*
     What each front will carry, worked out before any of them carries it.

     ## Why the ceiling is off, and off only where you asked for it

     Capacity was a hard wall — `moved = min(capacity, washable - laundered)`,
     walking the fronts in order until the pile ran out — and measured across
     36 careers of 300 days that wall was what stood between the contraband
     trade and the rest of the game: **once a trade is running the fronts were
     saturated on 74% of paydays**, the trade earned a median $1,632,268 and
     moved what the family is worth by 6.5%, because `estate` counts clean
     money and never counts dirty. HANDOFF F22.

     The first attempt took the wall away for everybody. Measured, that made
     every career worse, including careers with no trade at all: median peak
     estate fell 29% and trade income fell 85%, while cases opened, careers
     ended and fronts lost stayed **identical**. So it did not deliver the risk
     and it did cost the player. Two reasons, and neither was the raid:

     - the family paid the 22% cut on money it was going to spend as dirty
       anyway. Wages are held back; stock, retainers and job costs are not, and
       `pay` spends dirty first. Washing the lot every week is a leak.
     - every front sat permanently over the decay threshold, so health — and
       with it front revenue and front value, which *is* most of the estate —
       ground down everywhere at once.

     So the wall comes off where the player has said to lean on the place, and
     nowhere else. `hard` on the pressure dial already means "how dirty do I
     want this business", already multiplies capacity, already adds exposure
     and wear and an inspection chance. It now also means there is no ceiling:
     everything goes through, and `exposure` below is `moved / capacity`, which
     the wall used to bound at one and no longer does. A front run at three
     times what it comfortably takes ages three times as fast, and exposure is
     already wired to heat above 50, to `finance` evidence above 70, to the
     health pressure that kills a front, and to whose books a financial
     investigation subpoenas first. None of that had to be built.

     A front nobody has touched behaves exactly as it did before this comment
     existed, which is the promise `config/pressure.ts` opens with.
  */
  const room = new Map<Id, number>();
  for (const business of operating) {
    room.set(
      business.id,
      Math.max(
        1,
        Math.round(
          launderCapacity(state, business) *
            launderRestriction(state) *
            worldMod(state, 'launderCapacity'),
        ),
      ),
    );
  }

  /*
     Filled to capacity in order, exactly as it always was, and then the
     remainder handed to whichever fronts are being leaned on.

     Split among those in proportion to what they hold rather than given to the
     first one in the list: otherwise a family with four hard fronts puts one
     of them at maximum exposure and leaves three untouched, which is not what
     the dial is being asked for.
  */
  const alloc = new Map<Id, number>();
  let left = washable;
  for (const business of operating) {
    const take = Math.min(room.get(business.id)!, Math.max(0, left));
    alloc.set(business.id, take);
    left -= take;
  }
  const leaning = operating.filter((b) => pressureOf(b).id === 'hard');
  if (left > 0 && leaning.length > 0) {
    const leaningRoom = leaning.reduce((sum, b) => sum + room.get(b.id)!, 0);
    for (const business of leaning) {
      alloc.set(
        business.id,
        alloc.get(business.id)! + Math.round(left * (room.get(business.id)! / leaningRoom)),
      );
    }
  }

  for (const business of operating) {
    const def = businessDef(business);

    // Clean income arrives regardless of what you push through it.
    // Legitimate trade is worse in a city that feels unsafe — which is a cost
    // of violence that finally lands somewhere other than a heat meter.
    const earned = Math.round(
      weeklyRevenue(state, business) *
        worldMod(state, 'businessRevenue') *
        outrageBusinessMultiplier(state),
    );
    revenue += earned;
    business.revenueTotal += earned;

    // `capacity` is still reduced sharply once investigators are inside the
    // books, and again when the whole city's books are being looked at. On a
    // front being leaned on it decides the risk rather than the ceiling; on
    // every other front it is still both.
    const capacity = room.get(business.id)!;
    capacityTotal += capacity;
    const moved = alloc.get(business.id) ?? 0;
    business.lastLaundered = moved;

    if (moved > 0) {
      laundered += moved;
      business.launderedTotal += moved;
      /*
         Exposure tracks how hard you leaned on it, not how much it holds — and
         since the ceiling came off, that ratio can go above one. A front run
         at three times what it comfortably takes ages three times as fast.
         That is the entire price of the wall being gone.
      */
      business.exposure = clamp(
        business.exposure + (moved / capacity) * def.exposureRate,
        0,
        100,
      );
    }

    /*
       And how it is being run, on top of how much went through it.

       Applied every week rather than only on weeks something moved, because
       "keep it clean" has to be worth something to a front that is idle — a
       restaurant nobody is washing through is quietly becoming a restaurant.
    */
    const lean = pressureOf(business);
    business.exposure = clamp(business.exposure + lean.exposure, 0, 100);

    // Quiet weeks let a front cool off, faster the more ordinary it looks.
    const decay = EXPOSURE_DECAY_BASE + def.legitimacy * EXPOSURE_DECAY_PER_LEGITIMACY;
    if (moved < capacity * 0.5) {
      business.exposure = clamp(business.exposure - decay, 0, 100);
    }

    // A front that has become interesting starts costing you on its own.
    if (business.exposure > EXPOSURE_ALARMING_ABOVE) {
      const over = (business.exposure - EXPOSURE_ALARMING_ABOVE) / (100 - EXPOSURE_ALARMING_ABOVE);
      addHeat(state, over * EXPOSURE_HEAT_AT_MAX, 'money', `${def.name} finances`);
    }
    /*
     * How the business itself is doing, which is not the same question as how
     * interesting it is to an investigator. A front can be perfectly clean and
     * dying because the neighbourhood has turned and somebody opened the same
     * thing two streets over.
     */
    const pressure = healthPressure(state, business);
    const before = business.health ?? HEALTH.start;
    business.health = clamp(before + pressure.total - lean.wear, 0, 100);

    /*
       Somebody official takes an interest.

       The roll is only half of it: a front in decent condition passes, so the
       risk of leaning on a place is a risk you have already decided the size
       of by how well you have been running it. A dice roll the player cannot
       affect would be a tax, not a decision.
    */
    if (lean.inspectionChance > 0 && rng.chance(lean.inspectionChance)) {
      if (business.health >= INSPECTION.survivesAbove) {
        addLog(
          state,
          `Somebody came round ${def.name} in ${territoryDef(business.territoryId).name} with a clipboard and left again.`,
          'crew',
        );
      } else {
        business.health = clamp(business.health - INSPECTION.healthCost, 0, 100);
        business.exposure = clamp(business.exposure + INSPECTION.exposureCost, 0, 100);
        addLog(
          state,
          `${def.name} in ${territoryDef(business.territoryId).name} failed an inspection. There is a file with the address on it now.`,
          'failure',
        );
      }
    }

    if (before >= HEALTH.warnBelow && business.health < HEALTH.warnBelow) {
      addLog(
        state,
        `${def.name} in ${territoryDef(business.territoryId).name} is in trouble. Takings are down and it is not the season.`,
        'failure',
      );
    }

    if (business.health <= 0) {
      business.status = 'shuttered';
      earnClean(state, Math.round(priced(state, def.cost) * HEALTH.collapseRefundShare));
      addLog(
        state,
        `${def.name} in ${territoryDef(business.territoryId).name} has gone under. You get the fittings and the lease back, which is not much.`,
        'failure',
      );
      continue;
    }

    if (business.exposure > EXPOSURE_EVIDENCE_ABOVE && rng.chance(EXPOSURE_EVIDENCE_CHANCE)) {
      addEvidence(state, {
        day: state.day,
        source: 'finance',
        strength: Math.round(business.exposure / 4),
        npcIds: [],
        detail: `Irregular accounts at ${def.name.toLowerCase()} in ${territoryDef(business.territoryId).name}.`,
      });
    }
  }

  const cut = Math.round(laundered * cutShare);
  const cleaned = laundered - cut;

  state.org.dirtyCash = Math.max(0, state.org.dirtyCash - laundered);
  /*
     The takings go somewhere they can compound. What was washed stays liquid.

     These are two different kinds of money and paying them into the same pool
     was why the legitimate side never grew. Over four years a family earns
     $184,077 of clean money and spends $85,137 of it on job costs, because
     clean is the pool every cost falls back on the moment dirty runs out — so
     the fronts' own income was funding hijackings, and the family reinvested
     two per cent of its earnings into the thing earning them.

     `revenue` is what the businesses took over the counter. It is the
     reinvestment capital of an organization that intends to own more of them,
     so it goes where it cannot be quietly spent, and `acquireBusiness` can
     reach it. Drawing it out for anything else costs the hurry price, which is
     the decision this is meant to create.

     `cleaned` is dirty money the player *chose* to wash, at a cut they paid on
     purpose. That is spending money by definition — for the lawyer, the
     contact, the payroll — and it stays in the wallet.
  */
  earnClean(state, cleaned, 'transfer');
  // The share the wash took, which is the only cost in this game that buys
  // nothing — see F23. It never touched the wallet, so it has to be written
  // down here or the book would show the family losing it to nobody.
  note(state, 'wash', -cut);
  /*
     All of it, and the withdrawal cost is a real decision rather than a bug.

     Tried the other way — takings meeting the week's bills in the wallet and
     only the surplus compounding — on the reasoning that it would stop a
     family paying the hurry price to reach its own earnings. It measured
     worse on every figure: best estate across 36 careers fell from $218,386 to
     $143,222 and the median from $24,229 to $13,034, because money that lands
     in the wallet is money that goes on the next job. Paying the bills out of
     the takings hands the compounding pool straight back to the leak it exists
     to escape.

     So the takings go where they compound, in full. A boss who has to sell
     holdings to make payroll is a boss who over-hired, and the fifteen per
     cent is what that costs. The probe's bot pays it constantly because its
     rule is crude; a player watching the payroll forecast need not.
  */
  if (revenue > 0) {
    state.org.holdings = (state.org.holdings ?? 0) + revenue;
    // The legitimate side's own takings, which is the one row on the ledger
    // that never has to be explained to anybody.
    note(state, 'fronts', revenue);
  }

  /*
     The work teaches the trade. See config/businesses.ts:BUSINESS_FROM.

     Scaled by how much of the available capacity actually moved, so a front
     standing idle in a dead district teaches nothing and a pipeline running at
     the limit teaches the full rate.
  */
  if (capacityTotal > 0 && laundered > 0) {
    trainAttribute(
      state,
      'business',
      BUSINESS_FROM.launderingPerWeek * clamp(laundered / capacityTotal, 0, 1),
    );
  }

  state.lastLaunderReport = { laundered, cut, revenue, capacity: capacityTotal, washable };

  /*
     Both lines name where the takings went, which neither used to.

     The revenue was logged and its destination was not, so `Put away` grew on
     its own — round 11 reached $57,452 having never pressed the button, found
     no log line in 303 days that mentioned money moving there, and ended up
     selling the lot at the hurry price to survive a payroll. That is a large
     decision about money the player did not know they had.
  */
  if (laundered > 0) {
    addLog(
      state,
      `Businesses took in $${revenue.toLocaleString('en-US')}, put away rather than banked, ` +
        `and moved $${laundered.toLocaleString('en-US')} through, ` +
        `$${cut.toLocaleString('en-US')} lost in the washing.`,
      'money',
    );
  } else if (revenue > 0) {
    addLog(
      state,
      `Businesses took in $${revenue.toLocaleString('en-US')}. It goes to what is put away.`,
      'money',
    );
  }

  return { revenue, laundered, cut };
}

/** Everything the player could buy right now, for the businesses panel. */
export function acquisitionOptions(
  state: GameState,
): { def: BusinessDef; territory: Territory; check: AcquireCheck }[] {
  const out: { def: BusinessDef; territory: Territory; check: AcquireCheck }[] = [];
  for (const t of Object.values(state.territories)) {
    if (controlLevel(t) === 'none' || controlLevel(t) === 'presence') continue;
    for (const def of BUSINESSES) {
      out.push({ def, territory: t, check: canAcquire(state, def.id, t.id) });
    }
  }
  return out.sort((a, b) => Number(b.check.ok) - Number(a.check.ok) || a.def.cost - b.def.cost);
}
