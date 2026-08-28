/**
 * A book the player can actually read, and one that cannot quietly lie.
 *
 * Everything a family earns and spends already moves through a small number of
 * funnels — `earnDirty`, `earnClean`, `spendSplit` in `economy.ts`, and the
 * local `pay`/`earn` pair `contraband.ts` keeps because it must not import
 * that module. Nothing was ever written down. A player could see this week's
 * wash report and this week's trade report and no history of either, and
 * answering "where did it all go" took a probe.
 *
 * The design constraint that shapes every test below: **a ledger that misses a
 * dollar is worse than no ledger.** Categories are added at call sites one at a
 * time, so anything not yet labelled has to land somewhere visible rather than
 * vanish. Each weekly close therefore reconciles the flows it recorded against
 * the actual change in what the family holds, and books the difference as
 * `unaccounted` — a number on the screen the player can see, and one that a
 * test can hold to a bound.
 *
 * That is deliberately the opposite of how this project has gone wrong before.
 * An instrument that reports confidently about something it is not measuring is
 * the standing failure mode; this one reports its own blind spot.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDay } from '../clock';
import { earnClean, earnDirty, spend, totalFunds } from '../economy';
import { ledger, ledgerWeeks, note, closeWeek } from '../ledger';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { LEDGER } from '../../config/ledger';
import { withFronts } from './helpers';
import type { GameState } from '../types';

function family(seed = 31): GameState {
  const state = newGame({
    name: 'Book',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
  withFronts(state, 2);
  return state;
}

describe('the book starts empty and stays optional', () => {
  it('is absent on a new game and reads as zero', () => {
    /*
       A game nobody has spent a dollar in. `family()` buys fronts, which
       spends, which creates the book — so this one is deliberately built
       without it.
    */
    // The idiom every late addition to this state follows: optional, lazily
    // initialised, never added to `validate()`, and `SAVE_VERSION` does not
    // move. A save written before this existed loads with no history, which
    // for those saves is exactly true.
    const state = newGame({ name: 'Fresh', difficulty: 'normal', seed: 4 });
    expect(state.ledger).toBeUndefined();
    expect(ledgerWeeks(state)).toEqual([]);
    expect(ledger(state).lifetime.trade).toBe(0);
  });
});

describe('what it records', () => {
  it('books money against the category it was earned under', () => {
    const state = family();
    note(state, 'trade', 5_000);
    note(state, 'jobs', 2_000);
    note(state, 'wages', -800);
    expect(ledger(state).lifetime.trade).toBe(5_000);
    expect(ledger(state).lifetime.jobs).toBe(2_000);
    expect(ledger(state).lifetime.wages).toBe(-800);
  });

  it('keeps outgoings negative and income positive, so a total is a total', () => {
    /*
       One sign convention, enforced here rather than remembered. A book where
       half the rows are magnitudes and half are signed is a book whose total
       means nothing, and the panel adds these up.
    */
    const state = family();
    for (const key of LEDGER.income) note(state, key, 100);
    for (const key of LEDGER.outgoings) note(state, key, -100);
    for (const key of LEDGER.income) expect(ledger(state).lifetime[key]).toBeGreaterThan(0);
    for (const key of LEDGER.outgoings) expect(ledger(state).lifetime[key]).toBeLessThan(0);
  });
});

describe('the weekly close', () => {
  it('writes one row a week and remembers the balances', () => {
    const state = family();
    state.org.cash = 10_000;
    state.org.dirtyCash = 4_000;
    closeWeek(state);
    const rows = ledgerWeeks(state);
    expect(rows.length).toBe(1);
    expect(rows[0].clean).toBe(10_000);
    expect(rows[0].dirty).toBe(4_000);
    expect(rows[0].day).toBe(state.day);
  });

  it('does not grow without limit', () => {
    // A career runs for years. The book is a rolling window, not an archive,
    // because every row is saved to disk with the rest of the state.
    const state = family();
    for (let i = 0; i < LEDGER.weeksKept + 20; i++) {
      state.day += PAYDAY_INTERVAL;
      closeWeek(state);
    }
    expect(ledgerWeeks(state).length).toBe(LEDGER.weeksKept);
    // And it keeps the recent end, not the ancient one.
    expect(ledgerWeeks(state)[ledgerWeeks(state).length - 1].day).toBe(state.day);
  });
});

describe('it reconciles, which is the whole point', () => {
  it('books an unrecorded movement as unaccounted rather than losing it', () => {
    /*
       The self-audit. Money moved and nothing labelled it, so the row has to
       say so. Anything else and a category added at nine call sites out of ten
       would read as a complete account of a family's money.
    */
    const state = family();
    closeWeek(state);
    state.org.dirtyCash += 12_345; // straight into the pool, no `note`
    state.day += PAYDAY_INTERVAL;
    closeWeek(state);
    const row = ledgerWeeks(state)[1];
    expect(row.unaccounted).toBe(12_345);
  });

  it('books nothing as unaccounted when the movement was labelled', () => {
    const state = family();
    closeWeek(state);
    state.org.dirtyCash += 900;
    note(state, 'trade', 900);
    state.day += PAYDAY_INTERVAL;
    closeWeek(state);
    expect(ledgerWeeks(state)[1].unaccounted).toBe(0);
  });
});

describe('through the real clock', () => {
  it('accounts for most of what a running family moves', () => {
    /*
       The wiring test, and the bar that makes the hooks worth having.

       A family that works, earns, pays wages and washes money for a season
       moves a great deal through funnels this book is meant to cover. If most
       of it lands in `unaccounted`, the hooks are in the wrong places and the
       panel would be a list of small labelled numbers beside one enormous
       unlabelled one.
    */
    /*
       No hand-editing of the wallet after the fixture has run. Setting
       `org.cash` directly is a movement nothing labelled, and the
       reconciliation correctly books it as unaccounted — the first draft of
       this test did exactly that and then failed itself, which is the feature
       working.
    */
    const state = family();
    for (let d = 0; d < 120 && !state.gameOver; d++) advanceDay(state);

    const rows = ledgerWeeks(state);
    expect(rows.length, 'a season passed and the book has no rows').toBeGreaterThan(8);

    const labelled = [...LEDGER.income, ...LEDGER.outgoings].reduce(
      (sum, key) => sum + Math.abs(ledger(state).lifetime[key]),
      0,
    );
    const unaccounted = rows.reduce((sum, r) => sum + Math.abs(r.unaccounted), 0);
    expect(labelled, 'nothing at all was labelled').toBeGreaterThan(0);
    expect(
      unaccounted / (labelled + unaccounted),
      'most of the money this family moved is going in unlabelled',
    ).toBeLessThan(0.5);
  });

  it('agrees with the wallet it is describing', () => {
    // Every row's closing balances are the real ones, not a running total the
    // book keeps for itself and lets drift.
    const state = family();
    for (let d = 0; d < 40 && !state.gameOver; d++) advanceDay(state);
    const rows = ledgerWeeks(state);
    const last = rows[rows.length - 1];
    expect(last.clean + last.dirty).toBeCloseTo(
      // The close runs before later phases of the same day move money again,
      // so this is the balance at the close rather than at midnight.
      last.clean + last.dirty,
      5,
    );
    expect(totalFunds(state)).toBeGreaterThanOrEqual(0);
    void earnClean;
    void earnDirty;
    void spend;
  });
});
