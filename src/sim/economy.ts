/**
 * Money in, money out.
 *
 * Two pools from day one: clean cash and dirty cash. Criminal work pays dirty.
 * Dirty money spends fine on criminal business and wages, but it has nowhere
 * legitimate to go until fronts are laundering it — so a growing dirty
 * pile is intended pressure, not a missing feature.
 */

import { clamp } from './rng';
import type { GameState, Npc } from './types';
import { addLog } from './util';
import { addNote, crewList } from './npc';
import { remember } from './memory';
import { retainLawyer, weeklyLegalCost } from './investigation';
import { repaymentAgainst } from './market';
import { trainAttribute } from './player';
import { LAWYER_BY_LEVEL } from '../config/lawEnforcement';
import {
  ARREARS_CLEARED_LOYALTY,
  MISSED_PAY_GRIEVANCE,
  MISSED_PAY_LOYALTY_HIT,
  HOLDINGS,
  PAYDAY_INTERVAL,
  UNPAID_MEMORY_THRESHOLD,
  INFLUENCE_FROM,
} from '../config/economy';
import { DIFFICULTY_BY_ID } from '../config/difficulty';

export function totalFunds(state: GameState): number {
  return state.org.cash + state.org.dirtyCash;
}

export function canAfford(state: GameState, amount: number): boolean {
  return totalFunds(state) >= amount;
}

/**
 * Spends from dirty cash first — you pay for crime with the proceeds of crime,
 * and it keeps the clean pool intact for the legitimate economy later.
 * Returns false and spends nothing if the funds are not there.
 */
export function spend(state: GameState, amount: number): boolean {
  return spendSplit(state, amount) !== null;
}

/** What a payment actually came out of. */
export interface Payment {
  dirty: number;
  clean: number;
}

/**
 * The same payment as `spend`, reporting which pools it drew on.
 *
 * This exists because a refund is not the same shape as income. `spend` takes
 * dirty first, so a purchase made by a player with no dirty cash comes entirely
 * out of the clean pool — and handing that back with `earnDirty` quietly
 * launders the player's money in the wrong direction, costing them the clean
 * balance that rank progression is actually gated on. Anything that might have
 * to give money back should take it with this and return it with `refund`.
 */
export function spendSplit(state: GameState, amount: number): Payment | null {
  if (amount <= 0) return { dirty: 0, clean: 0 };
  if (!canAfford(state, amount)) return null;

  const dirty = Math.min(state.org.dirtyCash, amount);
  const clean = amount - dirty;
  state.org.dirtyCash -= dirty;
  state.org.cash -= clean;
  return { dirty, clean };
}

/** Puts a payment back exactly where it came from. */
export function refund(state: GameState, paid: Payment): void {
  state.org.dirtyCash += paid.dirty;
  state.org.cash += paid.clean;
}

// ---------------------------------------------------------------- holdings ---

/** What the organization is worth on paper, wallet plus everything put away. */
export function cleanWorth(state: GameState): number {
  return state.org.cash + (state.org.holdings ?? 0);
}

export interface MoneyMove {
  ok: boolean;
  message: string;
}

/**
 * Move clean money out of reach, on purpose.
 *
 * The rank table reads `cleanWorth`, so this loses nothing in standing. It
 * loses the money's availability — jobs, wages, lawyers and fronts all draw on
 * the wallet and none of them can touch this. That is the trade: a boss who
 * banks his Capo money cannot also spend it on the thing that keeps his
 * underboss out of prison.
 */
export function putAway(state: GameState, amount: number): MoneyMove {
  const sum = Math.floor(amount);
  if (sum < HOLDINGS.minimum) {
    return { ok: false, message: `Nothing under $${HOLDINGS.minimum.toLocaleString('en-US')} is worth the paperwork.` };
  }
  if (state.org.cash < sum) {
    return { ok: false, message: 'You do not have that in clean money.' };
  }
  state.org.cash -= sum;
  state.org.holdings = (state.org.holdings ?? 0) + sum;
  addLog(state, `$${sum.toLocaleString('en-US')} put somewhere it cannot be spent.`, 'money');
  return { ok: true, message: 'Put away.' };
}

/** Sell in a hurry. You get most of it back, which is what hurry costs. */
export function takeBack(state: GameState, amount: number): MoneyMove {
  const sum = Math.floor(amount);
  const held = state.org.holdings ?? 0;
  if (sum <= 0) return { ok: false, message: 'Nothing to take back.' };
  if (held < sum) return { ok: false, message: 'You have not got that much put away.' };
  const back = Math.floor(sum * HOLDINGS.withdrawReturn);
  state.org.holdings = held - sum;
  state.org.cash += back;
  addLog(
    state,
    `Sold $${sum.toLocaleString('en-US')} of holdings in a hurry. $${back.toLocaleString('en-US')} came back.`,
    'money',
  );
  return { ok: true, message: 'Sold.' };
}

/**
 * Weekly. What is put away earns, quietly, whatever else is happening.
 *
 * The only income in the game that does not need the boss to be alive, at
 * liberty or free this week. Everything else — jobs, fronts, stewards, tribute
 * — stops when the family stops, which is why a career that hits a bad year
 * never recovers from it.
 */
export function tickHoldings(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const held = state.org.holdings ?? 0;
  if (held <= 0) return;
  state.org.holdings = held * (1 + HOLDINGS.yieldPerWeek);
}

export function earnDirty(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.org.dirtyCash += amount;
}

export function earnClean(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.org.cash += amount;
}

/** Weekly wage bill for everyone currently on the books. */
export function weeklyWageBill(state: GameState): number {
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  return Math.round(
    crewList(state)
      .filter(payable)
      .reduce((sum, n) => sum + n.wage, 0) * diff.expenses,
  );
}

/**
 * What the bill becomes with one more name on it.
 *
 * Here rather than worked out in the panel because the difficulty multiplier
 * applies to the whole bill, so "current bill plus his wage" is wrong on every
 * setting except Normal — and a hiring screen that quietly understates the
 * commitment is the exact problem this exists to fix.
 */
export function wageBillWith(state: GameState, extraWage: number): number {
  const diff = DIFFICULTY_BY_ID[state.difficulty];
  return Math.round(
    (crewList(state)
      .filter(payable)
      .reduce((sum, n) => sum + n.wage, 0) +
      extraWage) *
      diff.expenses,
  );
}

/** Arrested people come off the payroll. Everyone else gets paid. */
function payable(npc: Npc): boolean {
  return npc.status !== 'arrested' && npc.status !== 'dead' && npc.status !== 'defected';
}

export interface PayrollForecast {
  /** Days until the next one lands. */
  daysAway: number;
  /** Wages, plus anything that comes out of the same pot ahead of them. */
  due: number;
  onHand: number;
  /** How far short you are today. Zero when it is covered. */
  shortfall: number;
}

/**
 * What Friday is going to cost, before Friday.
 *
 * Missing payroll is the most expensive thing that can happen to an
 * organization in this game — every hand takes a loyalty hit and a grievance
 * that keeps bleeding for weeks, and two misses in a row is how a crew comes
 * apart. Until now the only account of it was a line in the log written after
 * the money had already failed to move, which makes an avoidable mistake read
 * as an arbitrary one. A player who can see the bill coming can call off a
 * job, delay a purchase or take the loan; a player who cannot has been handed
 * a consequence with no decision attached to it.
 *
 * Deliberately mirrors *payday*, not `tickEconomy`. That distinction is the
 * whole of a bug this shipped with: `tickEconomy` is only the second half of a
 * payday, because `clock.ts` runs `tickLoans` before it and `tickLoans` spends.
 * A week with enough for wages and counsel but not for wages, counsel and the
 * repayment was reported "Covered? Yes" and then paid nobody — round 12 read
 * `Due that day $1,350 / Covered? Yes` with `Repayments $1,241` printed two rows
 * below it, and lost three people to the miss that followed.
 *
 * So the loan book is counted here, in the order the day actually takes it.
 * A forecast that disagrees with the event is worse than no forecast, and this
 * one was disagreeing in the single week the player most needed it right.
 */
export function payrollForecast(state: GameState): PayrollForecast {
  const daysAway = PAYDAY_INTERVAL - (state.day % PAYDAY_INTERVAL);
  const onHand = totalFunds(state);
  const crew = crewList(state).filter(payable);
  if (crew.length === 0) return { daysAway, due: 0, onHand, shortfall: 0 };

  // Arrears come off the top of the next payday, so a forecast that ignored
  // them would understate exactly the week a player most needs it right.
  //
  // The loan book is not part of the bill — it is taken out of the money before
  // the crew are paid, so it reduces what is available instead. And it is
  // `repaymentAgainst` rather than `weeklyRepayment` because a repayment that
  // cannot be met in full is not met at all: those weeks the creditor bounces
  // and the wages are fine, and a forecast counting the nominal figure would
  // report a shortfall that never arrives.
  const bill = weeklyWageBill(state);
  const arrears = state.org.wagesOwed ?? 0;
  const legal = weeklyLegalCost(state);

  /*
     Walk the day in the order the day happens, because two of its steps do not
     simply subtract.

     Creditors first, and `repaymentAgainst` rather than `weeklyRepayment`: a
     repayment that cannot be met in full is not met at all, so those weeks the
     book takes nothing and the wages are fine.

     Counsel second, and it is a cliff rather than a cost. `tickEconomy` drops
     the retainer when it cannot cover it — "You could not cover the retainer.
     Your counsel has withdrawn" — and that money then stays in the drawer and
     pays the crew. A forecast that simply added the retainer to the bill
     reported a shortfall on a week where everybody got paid; found at 120
     random states, not by reading, after the same function had already been
     wrong twice in opposite directions.
  */
  let left = onHand - repaymentAgainst(state, onHand);
  if (legal > 0 && left >= legal) left -= legal;

  /*
     `due` is what the day costs when it all goes to plan, which is the figure
     the panel labels "Due that day". `shortfall` answers a different question —
     whether the crew get paid — and the two legitimately disagree on a week
     where something ahead of the crew bounces. Do not "simplify" one into the
     other.
  */
  const due = bill + legal + arrears;
  return { daysAway, due, onHand, shortfall: Math.max(0, bill + arrears - left) };
}

/** How far back to look when asking what the organization actually earns. */
const TAKE_WINDOW_DAYS = 28;

/**
 * What the jobs have been bringing in, per week.
 *
 * The hiring screen already showed what a new wage does to the bill, and that
 * turned out to answer the wrong question: it compared the bill to the money
 * in the drawer, so a player sitting on one good score was told a permanent
 * commitment was comfortable. Cash on hand is a stock and a wage is a rate,
 * and comparing them is how a crew gets recruited into a hole.
 *
 * Four weeks rather than one, because a fortnight with no finished job is
 * normal and a rate computed off it would read as destitution. Businesses are
 * not counted here — `business.ts` owns that number and importing it would
 * close a cycle — so callers wanting total income add `totalWeeklyRevenue`.
 */
export function recentWeeklyTake(state: GameState): number {
  const since = state.day - TAKE_WINDOW_DAYS;
  const took = state.operationHistory
    .filter((r) => r.day > since)
    .reduce((sum, r) => sum + r.payout, 0);

  // Early on there is not a month of history to divide by, and dividing a
  // first week's takings by four reports a quarter of what is actually coming
  // in. Scale by the time actually played.
  const days = Math.max(1, Math.min(TAKE_WINDOW_DAYS, state.day));
  return Math.round((took / days) * 7);
}

/**
 * Payday. Missing it is one of the fastest ways to lose a crew — the loyalty
 * hit is large and it leaves a grievance that keeps bleeding for weeks.
 */
export function tickEconomy(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;

  const crew = crewList(state).filter(payable);
  if (crew.length === 0) return;

  // Lawyers are paid before the crew — they are the ones keeping you out of a
  // cell, and they do not accept late payment.
  const legal = weeklyLegalCost(state);
  if (legal > 0 && !spend(state, legal)) {
    retainLawyer(state, 'none');
    addLog(state, 'You could not cover the retainer. Your counsel has withdrawn.', 'failure');
  } else if (legal > 0) {
    /*
       A retainer that is actually being paid is a relationship, and it builds.

       `influence` gates the police contacts, city hall and two layers of the
       City panel, and was earnable in two places: a $25,000 event choice, and
       acquiring a contact that itself requires influence. Round 9's tester
       finished 150 days at exactly 0 with all of it sealed. Counsel is the one
       standing arrangement with somebody who matters that an ordinary career
       already keeps, which makes it the honest place for this to accrue.

       Scaled by the firm, because a man on $380 a week is not owed the same
       favours as one on $3,700.
    */
    trainAttribute(
      state,
      'influence',
      INFLUENCE_FROM.counselPerWeek * LAWYER_BY_LEVEL[state.law.lawyer].costMultiplier,
    );
  }

  /*
     Payroll is a debt, not a gate.

     This used to be `if (spend(bill))` — all of it or none of it. Being fifty
     dollars short on five thousand cost exactly as much as paying nobody, and
     the money stayed in the drawer while every hand took the full hit, which is
     the worst of both. Against job income that arrives in lumps on whatever day
     a job happens to finish, that cliff made missing payday close to
     unavoidable: a probe playing every job at its best expected value still
     missed in twenty-four worlds out of twenty-four.

     So: last week's arrears come off the top, you pay what you actually have,
     the men are aggrieved in proportion to what they did not get, and whatever
     is left over is carried. A crew that keeps going short still comes apart —
     the arrears make next week's bill larger, so the proportion gets worse on
     its own without needing a special case for it.
  */
  const bill = weeklyWageBill(state);
  const arrears = state.org.wagesOwed ?? 0;
  const due = bill + arrears;

  /*
     Wages are handed over in cash, so they come out of the dirty pile first —
     `spend` already does that. What matters here is the other end of it: the
     clean pile is money sitting in accounts and businesses, and it either
     covers the remainder or it does not move at all.

     Without that second rule this drained the clean balance to zero every time
     a week came up short, which quietly broke the thing laundering exists for.
     A probe caught it immediately: careful play stopped out-ranking reckless
     play, and the share of a careful organization's money that was clean fell
     from over half to a fifth. Rank is gated on clean cash, so emptying it on
     Fridays stalls the entire progression.
  */
  const fromDirty = Math.min(due, state.org.dirtyCash);
  const remainder = due - fromDirty;
  const fromClean = remainder > 0 && remainder <= state.org.cash ? remainder : 0;
  const paid = fromDirty + fromClean;
  if (paid > 0) spend(state, paid);
  state.org.wagesOwed = Math.max(0, Math.round(due - paid));

  if (state.org.wagesOwed === 0) {
    if (arrears > 0) {
      // Clearing what you owed is worth something. Not as much as never having
      // owed it, which is what the grievance already on the books represents.
      for (const npc of crew) {
        npc.stats.loyalty = clamp(npc.stats.loyalty + ARREARS_CLEARED_LOYALTY, 0, 100);
        addNote(npc, state.day, 'Was paid what they were owed from before.', 'good');
      }
      addLog(
        state,
        `Back wages cleared — $${Math.round(arrears).toLocaleString('en-US')} of them. ` +
          `The books are square.`,
        'money',
      );
    }
    addLog(
      state,
      `Payday. ${crew.length} on the books, $${Math.round(paid).toLocaleString('en-US')} out.`,
      'money',
    );
    return;
  }

  // Short. How short is the whole of what happens next.
  const covered = due > 0 ? paid / due : 1;
  const severity = 1 - covered;

  addLog(
    state,
    paid > 0
      ? `Payroll came up short. $${Math.round(due).toLocaleString('en-US')} due, ` +
        `$${Math.round(paid).toLocaleString('en-US')} paid. ` +
        `$${state.org.wagesOwed.toLocaleString('en-US')} is owed and they know it.`
      : `Nobody was paid. $${Math.round(due).toLocaleString('en-US')} owed and nothing in hand.`,
    'failure',
  );

  /*
     Who it cost you, said out loud.

     The line above has always reported the shortfall and never the
     consequence, and the consequence is the expensive half: every hand loses
     loyalty and picks up a grievance that keeps bleeding for weeks. All of
     that was written to the individual crew sheets, so a player could only
     find it by opening the Organization page and comparing each man against a
     reading they had taken before. A playtester noticed one man's loyalty had
     slipped from "steady enough" to "here for now" and only connected it to
     the missed payday by cross-referencing two pages themselves.

     Naming the worst-hit man rather than only counting heads, because "four
     men" is a statistic and "Salvatore has gone from steady to looking for the
     door" is the thing you act on.
  */
  let worst: Npc | null = null;
  for (const npc of crew) {
    npc.stats.loyalty = clamp(npc.stats.loyalty - MISSED_PAY_LOYALTY_HIT * severity, 0, 100);
    npc.stats.grievance = clamp(npc.stats.grievance + MISSED_PAY_GRIEVANCE * severity, 0, 100);
    // A memory does not fade for years and is read by every later decision
    // about whether to walk, so a week that was mostly covered must not write
    // one. Being short is a bad week; being unpaid is a thing that happened.
    if (severity >= UNPAID_MEMORY_THRESHOLD) remember(npc, state.day, 'went_unpaid');
    addNote(
      npc,
      state.day,
      severity >= UNPAID_MEMORY_THRESHOLD ? 'Was not paid this week.' : 'Was paid short this week.',
      'bad',
    );
    if (!worst || npc.stats.loyalty < worst.stats.loyalty) worst = npc;
  }

  addLog(
    state,
    crew.length === 1
      ? `${crew[0].name} is owed money, and they are holding it against you.`
      : `${crew.length} men are owed. Every one of them is further from you than they were` +
        (worst ? `, ${worst.name} furthest.` : '.'),
    'crew',
  );
}
