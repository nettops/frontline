/**
 * The book. What came in, what went out, and what is left.
 *
 * The design lives in `config/ledger.ts`. This is the machine: a category
 * accumulator, a weekly close that snapshots the balances, and a
 * reconciliation that refuses to let an unlabelled movement disappear.
 *
 * ## Why it reconciles
 *
 * Money moves through more places than one pass will ever label. `economy.ts`
 * has the funnels most of the game uses; `contraband.ts` deliberately keeps its
 * own `pay`/`earn` because it must not import that module; events, cards,
 * loans and the partner all touch the pools directly. Categories get attached
 * at call sites one at a time.
 *
 * So the close compares what this module was *told* about against what the
 * wallet actually did, and books the difference as `unaccounted`. That number
 * is on the screen. A book that silently omits what it did not recognise would
 * be exactly the instrument this project keeps having to throw away — one that
 * returns believable figures while measuring something narrower than it claims.
 *
 * Nothing here can change an outcome. It records; the simulation does not read
 * it back.
 */

import type { GameState } from './types';
import { LEDGER, LEDGER_KEYS, type LedgerKey } from '../config/ledger';

export interface LedgerWeek {
  day: number;
  /** Flows recorded under each category this week. Income +, outgoings −. */
  by: Record<LedgerKey, number>;
  /** What the wallet did that nothing labelled. Can be either sign. */
  unaccounted: number;
  /** Balances at the close. */
  clean: number;
  dirty: number;
  holdings: number;
}

export interface Ledger {
  weeks: LedgerWeek[];
  lifetime: Record<LedgerKey, number>;
  /** This week so far, cleared at every close. */
  week: Record<LedgerKey, number>;
  /** Balances at the last close, so the next one can difference against them. */
  markClean: number;
  markDirty: number;
  markHoldings: number;
}

function blank(): Record<LedgerKey, number> {
  return Object.fromEntries(LEDGER_KEYS.map((k) => [k, 0])) as Record<LedgerKey, number>;
}

/**
 * The book, lazily.
 *
 * Optional state with a lazy initialiser — the idiom `promises`, `civic` and
 * `orders` all follow, so `SAVE_VERSION` does not move and a save written
 * before this existed loads with no history, which for those saves is true.
 */
export function ledger(state: GameState): Ledger {
  if (!state.ledger) {
    state.ledger = {
      weeks: [],
      lifetime: blank(),
      week: blank(),
      markClean: state.org.cash,
      markDirty: state.org.dirtyCash,
      markHoldings: state.org.holdings ?? 0,
    };
  }
  return state.ledger;
}

export function ledgerWeeks(state: GameState): LedgerWeek[] {
  return state.ledger?.weeks ?? [];
}

/**
 * Write a movement down.
 *
 * Income positive, outgoings negative, one convention with no exceptions —
 * a book where half the rows are magnitudes is a book whose total means
 * nothing, and the panel adds these up.
 *
 * Callers pass what they know. Anything they do not label is caught by the
 * reconciliation at the close rather than lost.
 */
export function note(state: GameState, key: LedgerKey, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const book = ledger(state);
  book.week[key] += amount;
  book.lifetime[key] += amount;
}

/**
 * Close the week: snapshot the balances, reconcile, start a new row.
 *
 * The difference between what the wallet did and what was written down is the
 * whole reason this function exists. `holdings` counts because money put away
 * left the wallet without leaving the family, and without it every deposit
 * would read as an unexplained loss.
 */
export function closeWeek(state: GameState): void {
  const book = ledger(state);
  const clean = state.org.cash;
  const dirty = state.org.dirtyCash;
  const holdings = state.org.holdings ?? 0;

  const moved = clean - book.markClean + (dirty - book.markDirty) + (holdings - book.markHoldings);
  const recorded = LEDGER_KEYS.reduce((sum, k) => sum + book.week[k], 0);

  book.weeks.push({
    day: state.day,
    by: { ...book.week },
    unaccounted: Math.round(moved - recorded),
    clean: Math.round(clean),
    dirty: Math.round(dirty),
    holdings: Math.round(holdings),
  });
  if (book.weeks.length > LEDGER.weeksKept) {
    book.weeks.splice(0, book.weeks.length - LEDGER.weeksKept);
  }

  book.week = blank();
  book.markClean = clean;
  book.markDirty = dirty;
  book.markHoldings = holdings;
}

// -------------------------------------------------------------- readouts ---

export interface LedgerRead {
  key: LedgerKey;
  /** Over the whole career. */
  lifetime: number;
  /** Over the last `weeks` closed weeks. */
  recent: number;
}

/** Every row, lifetime and lately, for the panel. */
export function readLedger(state: GameState, weeks = 12): LedgerRead[] {
  const book = ledger(state);
  const window = book.weeks.slice(-weeks);
  return LEDGER_KEYS.map((key) => ({
    key,
    lifetime: Math.round(book.lifetime[key]),
    recent: Math.round(window.reduce((sum, w) => sum + w.by[key], 0)),
  }));
}

/** What the book could not explain, lifetime and lately. */
export function unexplained(state: GameState, weeks = 12): { lifetime: number; recent: number } {
  const rows = ledgerWeeks(state);
  return {
    lifetime: Math.round(rows.reduce((sum, w) => sum + w.unaccounted, 0)),
    recent: Math.round(rows.slice(-weeks).reduce((sum, w) => sum + w.unaccounted, 0)),
  };
}
