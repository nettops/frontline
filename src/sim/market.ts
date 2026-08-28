/**
 * The cycle, the price index, and the people who lend money.
 *
 * This is a leaf, and it has to be: `priced()` is read by operations,
 * businesses, contraband, the economy, the crew and the rank check, so market
 * cannot import any of them. It touches state directly and imports only its
 * own config plus util — the same rule goals.ts and ties.ts follow.
 *
 * The one thing it cannot do alone is collect. Defaulting on a loan hurts a
 * person, writes evidence, or costs you a district, and all three of those
 * live above this file. They arrive as `LoanHooks`, supplied by clock.ts,
 * exactly the way aging.ts gets its hands on succession.
 */

import { Rng, clamp } from './rng';
import { note } from './ledger';
import type { GameState, Loan } from './types';
import { addLog, nextId } from './util';
import { DAYS_PER_YEAR } from '../config/economy';
import {
  CYCLE_PHASES,
  DEFAULT_TERMS,
  LENDER_BY_ID,
  LOAN_SETTLED_BELOW,
  PRICE_BOUNDS,
  REPAYMENT_MINIMUM,
  REPAYMENT_SHARE,
  STARTING_PHASE,
  type CyclePhaseDef,
  type LenderDef,
} from '../config/market';

export function newMarket(rng: Rng, day: number) {
  const phase = CYCLE_PHASES[STARTING_PHASE];
  return {
    phaseId: STARTING_PHASE,
    phaseSince: day,
    // Started partway in, so the first turn does not always land on the same
    // day of every game. A seed should not be able to tell you when the crash
    // is coming.
    phaseEnds:
      day +
      rng.int(Math.round(phase.durationDays[0] * 0.4), phase.durationDays[1]),
    prices: 1,
    loans: [] as Loan[],
  };
}

// ------------------------------------------------------------- accessors ---

export function phase(state: GameState): CyclePhaseDef {
  return CYCLE_PHASES[state.market?.phaseId ?? STARTING_PHASE];
}

/**
 * The price index. Every nominal figure in the game is quoted in this.
 *
 * Defensive about a missing market for one reason: the statistical harness and
 * a couple of tests build partial states, and a multiplier that can return
 * undefined would turn every one of those into a NaN two systems downstream,
 * where it would be very hard to trace back to here.
 */
export function prices(state: GameState): number {
  return state.market?.prices ?? 1;
}

/** Converts a figure written at price level 1 into today's money. */
export function priced(state: GameState, amount: number): number {
  return Math.round(amount * prices(state));
}

/** Real movement in what things earn, over and above prices. */
export function activity(state: GameState): number {
  return phase(state).activity;
}

/** Annual interest, before any lender's own margin. */
function marketRate(state: GameState): number {
  return phase(state).baseRate;
}

export function lenderRate(state: GameState, def: LenderDef): number {
  return marketRate(state) + def.margin;
}

/** What this lender will advance, at today's prices. */
export function lenderCeiling(state: GameState, def: LenderDef): number {
  return priced(state, def.ceiling);
}

export function loans(state: GameState): Loan[] {
  return state.market?.loans ?? [];
}

export function totalOwed(state: GameState): number {
  return loans(state).reduce((sum, l) => sum + l.owed, 0);
}

/** What the loan book costs this payday, for the panel. */
export function weeklyRepayment(state: GameState): number {
  return loans(state).reduce((sum, l) => sum + dueOn(l), 0);
}

function dueOn(loan: Loan): number {
  return Math.min(loan.owed, Math.max(REPAYMENT_MINIMUM, Math.round(loan.owed * REPAYMENT_SHARE)));
}

/**
 * What the loan book will actually take out of `funds` this payday.
 *
 * Not the same number as `weeklyRepayment`, and the difference is the whole
 * reason this exists. `tickLoans` pays each loan all-or-nothing: a creditor who
 * cannot be paid in full is not paid at all, the debt takes its penalty, and the
 * money stays in the drawer. So a week can owe $350, hold $325, and hand over
 * nothing.
 *
 * `payrollForecast` needs this rather than the nominal figure, because it is
 * asking a different question — not "what do I owe" but "what will be left when
 * the crew are paid". Counting the nominal amount would report a shortfall on
 * every week a repayment is about to bounce, which are weeks the wages get paid
 * in full. This file already knows that a forecast which cries wolf is worse
 * than no forecast; that applies to the wolf that never arrives too.
 *
 * Mirrors `tickLoans`'s order and its affordability rule deliberately. If the
 * two ever disagree the forecast is wrong, which is the defect this replaced.
 */
export function repaymentAgainst(state: GameState, funds: number): number {
  let left = funds;
  let taken = 0;
  for (const loan of loans(state)) {
    if (loan.owed <= 0) continue;
    const due = dueOn(loan);
    if (due > left) continue;
    left -= due;
    taken += due;
  }
  return taken;
}

// -------------------------------------------------------------- the tick ---

/**
 * Daily. Compounds the index, and turns the cycle when its time is up.
 *
 * Inflation is applied per day rather than per year deliberately: a yearly step
 * would make one day in three hundred and sixty-five visibly different from
 * every other, and the point of this system is that no single day is.
 */
export function tickMarket(state: GameState, rng: Rng): void {
  const market = state.market;
  if (!market) return;

  const def = CYCLE_PHASES[market.phaseId];
  const daily = Math.pow(1 + def.inflationPerYear, 1 / DAYS_PER_YEAR);
  market.prices = clamp(market.prices * daily, PRICE_BOUNDS[0], PRICE_BOUNDS[1]);

  if (state.day < market.phaseEnds) return;

  const nextDef = CYCLE_PHASES[def.next];
  market.phaseId = nextDef.id;
  market.phaseSince = state.day;
  market.phaseEnds = state.day + rng.int(nextDef.durationDays[0], nextDef.durationDays[1]);
  addLog(state, nextDef.headline, nextDef.activity >= 1 ? 'money' : 'neutral');
}

// ------------------------------------------------------------- borrowing ---

/**
 * What the caller has to tell this file about the borrower.
 *
 * Passed in rather than read, so market stays a leaf — the alternative is
 * importing business.ts and diplomacy.ts, which between them reach most of the
 * game.
 */
export interface BorrowerFacts {
  respect: number;
  businesses: number;
  /** The rival most likely to put money in, or null if nobody would. */
  friendlyFactionId: string | null;
}

/**
 * What a loan attempt did.
 *
 * `borrow` used to return a bare boolean, which every caller discarded — the
 * panel discarded it with an explicit `void`. It says why now, in the same
 * shape as every other action in the game, so a refusal can reach the player
 * instead of stopping at the call site.
 */
export interface LoanAction {
  ok: boolean;
  message: string;
}

export interface BorrowCheck {
  ok: boolean;
  message: string;
  /** Most this lender will advance right now, after what you already owe them. */
  available: number;
}

/**
 * Whether a lender will see you, and for how much.
 *
 * `businesses` and `respect` are passed in rather than read, so this stays a
 * leaf — the alternative is importing business.ts, which imports half the game.
 */
export function canBorrow(
  state: GameState,
  lenderId: string,
  facts: BorrowerFacts,
): BorrowCheck {
  const def = LENDER_BY_ID[lenderId];
  if (!def) return { ok: false, message: 'Nobody by that name.', available: 0 };
  if (def.collateral === 'obligation' && !facts.friendlyFactionId) {
    return {
      ok: false,
      message: 'Nobody at that table thinks well enough of you to put money in your district.',
      available: 0,
    };
  }

  const existing = loans(state).find((l) => l.lenderId === lenderId);
  if (existing) {
    return { ok: false, message: 'You already owe them. Clear it first.', available: 0 };
  }
  if (facts.respect < def.minRespect) {
    return {
      ok: false,
      message: 'They do not know who you are, and are not curious.',
      available: 0,
    };
  }
  if (facts.businesses < def.minBusinesses) {
    return {
      ok: false,
      message: `They lend against businesses. You would need ${def.minBusinesses}.`,
      available: 0,
    };
  }
  return { ok: true, message: 'They will take the meeting.', available: lenderCeiling(state, def) };
}

export interface LoanQuote {
  principal: number;
  /** The whole balance, fixed at signing. */
  owed: number;
  /** What it takes out of every payday until it is clear. */
  weekly: number;
  termWeeks: number;
  rate: number;
}

/**
 * What signing would actually cost, before signing.
 *
 * The panel used to show a rate and a slider, and a rate is the one number
 * nobody borrows on — the questions are "how much do I owe in total" and "can
 * my week carry the repayment", and both were only answerable after the money
 * had already landed. Runs the same arithmetic as `borrow` rather than
 * approximating it; a quote that disagrees with the contract is a lie.
 */
export function quoteLoan(state: GameState, lenderId: string, amount: number): LoanQuote | null {
  const def = LENDER_BY_ID[lenderId];
  if (!def) return null;
  const principal = Math.min(Math.round(amount), lenderCeiling(state, def));
  if (principal <= 0) return null;
  const rate = lenderRate(state, def);
  const owed = Math.round(principal * (1 + rate * (def.termWeeks / 52)));
  return {
    principal,
    owed,
    weekly: dueOn({ owed } as Loan),
    termWeeks: def.termWeeks,
    rate,
  };
}

/**
 * Take the money.
 *
 * The balance is fixed at signing — principal plus the whole term's interest —
 * rather than accruing. A rate that compounds weekly would be more accurate and
 * would make the figure on the panel change for reasons the player cannot see,
 * which is exactly the kind of honesty nobody thanks you for.
 */
export function borrow(
  state: GameState,
  lenderId: string,
  amount: number,
  factionId: string | null = null,
): LoanAction {
  const def = LENDER_BY_ID[lenderId];
  if (!def || !state.market) return { ok: false, message: 'Nobody by that name.' };
  const principal = Math.min(Math.round(amount), lenderCeiling(state, def));
  if (principal <= 0) {
    return { ok: false, message: `${def.name} will not advance anything right now.` };
  }
  if (loans(state).some((l) => l.lenderId === lenderId)) {
    return { ok: false, message: 'You already owe them. Clear it first.' };
  }

  const rate = lenderRate(state, def);
  const years = def.termWeeks / 52;
  const owed = Math.round(principal * (1 + rate * years));

  state.market.loans.push({
    id: nextId(state, 'loan'),
    lenderId,
    factionId,
    principal,
    owed,
    rate,
    openedDay: state.day,
    dueDay: state.day + def.termWeeks * 7,
    missed: 0,
  });

  // Clean, because it is a loan and not a robbery. It is also the only clean
  // money in the game that did not have to be washed, which is most of why
  // borrowing is worth doing at all.
  state.org.cash += principal;
  // Borrowed, not earned — but it is money arriving, and the book has to see
  // it or every loan reads as an unexplained windfall.
  note(state, 'other_in', principal);
  addLog(
    state,
    `${def.name}: $${principal.toLocaleString('en-US')} in hand, $${owed.toLocaleString('en-US')} owed.`,
    'money',
  );
  return {
    ok: true,
    message: `$${principal.toLocaleString('en-US')} in hand. $${owed.toLocaleString(
      'en-US',
    )} due inside ${def.termWeeks} weeks.`,
  };
}

/** Pay a chunk off early, out of whatever you have. */
export function repay(state: GameState, loanId: string, amount: number, spent: boolean): void {
  const loan = loans(state).find((l) => l.id === loanId);
  if (!loan || !spent) return;
  loan.owed = Math.max(0, loan.owed - amount);
  settle(state, loan);
}

function settle(state: GameState, loan: Loan): boolean {
  if (loan.owed >= LOAN_SETTLED_BELOW || !state.market) return false;
  state.market.loans = state.market.loans.filter((l) => l.id !== loan.id);
  addLog(state, `${LENDER_BY_ID[loan.lenderId].name}: settled. Nobody owes anybody.`, 'money');
  return true;
}

// ---------------------------------------------------------- what he does ---

/**
 * The three ways this goes wrong, handed down from clock.ts.
 *
 * Each of them lives in a system this file sits below. Keeping them as hooks is
 * what stops a config-shaped module from importing the crew, the evidence
 * chain and the diplomacy matrix in order to describe a missed payment.
 */
export interface LoanHooks {
  /** Somebody in the crew gets hurt, for a number of days. */
  onViolence(injuryDays: number, evidence: number): void;
  /** The bank's lawyers file, and an agency reads the filing. */
  onPaper(evidence: number): void;
  /** The family that lent it takes something instead. */
  onObligation(factionId: string | null, grudge: number, influence: number): void;
}

/**
 * Weekly, on payday, before wages.
 *
 * Lenders are paid first for the same reason the lawyer is: they are the two
 * creditors who do something about it. `pay` is passed in because spending is
 * economy.ts's job and this file cannot see it.
 */
export function tickLoans(
  state: GameState,
  rng: Rng,
  pay: (amount: number) => boolean,
  hooks: LoanHooks,
): void {
  if (!state.market || state.market.loans.length === 0) return;

  for (const loan of [...state.market.loans]) {
    if (settle(state, loan)) continue;

    const due = dueOn(loan);
    if (pay(due)) {
      loan.owed -= due;
      loan.missed = 0;
      settle(state, loan);
      continue;
    }

    const def = LENDER_BY_ID[loan.lenderId];
    loan.missed += 1;
    loan.owed = Math.round(loan.owed * (1 + DEFAULT_TERMS.penaltyPerMiss));
    state.org.respect = Math.max(0, state.org.respect + DEFAULT_TERMS.respectPerMiss);
    addLog(
      state,
      `${def.name} was not paid this week. They were very understanding about it.`,
      'failure',
    );

    if (loan.missed < DEFAULT_TERMS.graceMissed) continue;
    loan.missed = 0;
    invoke(state, rng, loan, def, hooks);
  }
}

function invoke(state: GameState, rng: Rng, loan: Loan, def: LenderDef, hooks: LoanHooks): void {
  switch (def.collateral) {
    case 'violence':
      hooks.onViolence(
        rng.int(DEFAULT_TERMS.violenceInjuryDays[0], DEFAULT_TERMS.violenceInjuryDays[1]),
        DEFAULT_TERMS.violenceEvidence,
      );
      break;
    case 'paper':
      // No violence, no drama, and by a distance the worst of the three. A
      // default here is a bank producing eighteen months of your accounts to
      // somebody who reads accounts for a living.
      hooks.onPaper(DEFAULT_TERMS.paperEvidence);
      addLog(
        state,
        'The Trust has referred the account to its lawyers. Nobody raised their voice.',
        'failure',
      );
      break;
    case 'obligation':
      hooks.onObligation(
        loan.factionId,
        DEFAULT_TERMS.obligationGrudge,
        DEFAULT_TERMS.obligationInfluence,
      );
      break;
  }
}
