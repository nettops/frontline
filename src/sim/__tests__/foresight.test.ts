/**
 * The things the player is now allowed to see coming.
 *
 * A playtest found that this game's two worst experiences were not unfair, they
 * were unforeseeable: payroll failed by thirty-three dollars with no warning and
 * took three of five crew over the following month, and a heat number pinned at
 * 100 sat next to a police case that had not started. Both are now readable in
 * advance.
 *
 * What is worth testing about a forecast is only ever one property — that it
 * agrees with the event it forecasts. A warning that is merely plausible is
 * worse than none, because the player will trust it.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import { payrollForecast, totalFunds, wageBillWith, weeklyWageBill } from '../economy';
import { arrestRisk, retainLawyer, weeklyLegalCost } from '../investigation';
import { quoteLoan, borrow, loans, weeklyRepayment } from '../market';
import { launderOutlook, ownedBusinesses } from '../business';
import { BUSINESSES } from '../../config/businesses';
import { RANK_BY_ID, RANKS } from '../../config/economy';
import { PAYDAY_INTERVAL } from '../../config/economy';
import type { GameState } from '../types';

function fresh(seed = 5): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

/** Moves to the day before the next payday, keeping everything else still. */
function eveOfPayday(state: GameState): void {
  while ((state.day + 1) % PAYDAY_INTERVAL !== 0) advanceDay(state);
}

describe('the payroll forecast agrees with payday', () => {
  it('counts down to the day the money actually moves', () => {
    const state = fresh();
    for (let i = 0; i < 20; i++) {
      const before = payrollForecast(state);
      advanceDay(state);
      // The day the forecast said was next is the day the bill was taken.
      if (before.daysAway === 1) expect(state.day % PAYDAY_INTERVAL).toBe(0);
    }
  });

  it('says short exactly when payday is about to fail', () => {
    const state = fresh();
    eveOfPayday(state);
    // A pound under the bill, and nothing else touching the books.
    const bill = weeklyWageBill(state);
    state.org.cash = bill - 1;
    state.org.dirtyCash = 0;
    expect(payrollForecast(state).shortfall).toBeGreaterThan(0);

    advanceDay(state);
    // Payroll is a debt rather than a gate now — a pound short pays everybody
    // very nearly in full and carries the pound, so the line to look for is
    // the shortfall, not a failure to pay anyone.
    // Wages are handed over in cash from the dirty pile; a clean balance that
    // cannot cover the whole remainder does not move. So a pound short with
    // nothing dirty pays nobody, and the debt is the thing to assert on.
    expect(
      state.log.some((e) => /came up short|Nobody was paid/.test(e.text)),
    ).toBe(true);
    expect(state.org.wagesOwed).toBeGreaterThan(0);
  });

  it('says covered exactly when payday is about to succeed', () => {
    const state = fresh();
    eveOfPayday(state);
    state.org.cash = weeklyWageBill(state) + 1;
    state.org.dirtyCash = 0;
    expect(payrollForecast(state).shortfall).toBe(0);

    advanceDay(state);
    expect(state.log.some((e) => e.text.includes('came up short'))).toBe(false);
    expect(state.org.wagesOwed ?? 0).toBe(0);
  });

  it('asks for nothing when there is nobody to pay', () => {
    const state = fresh();
    for (const npc of crewList(state)) npc.status = 'dead';
    expect(payrollForecast(state).due).toBe(0);
    expect(payrollForecast(state).shortfall).toBe(0);
  });

  it('prices a hire at what the hire would actually cost', () => {
    const state = fresh();
    const before = weeklyWageBill(state);
    // The difficulty multiplier applies to the whole bill, so this is not
    // simply the old bill plus the wage — which is the reason it exists.
    expect(wageBillWith(state, 0)).toBe(before);
    expect(wageBillWith(state, 500)).toBeGreaterThan(before);
  });
});

describe('the arrest risk tells the truth about the case, not the heat', () => {
  it('says you are clear when nothing has been opened and nothing was left behind', () => {
    const state = fresh();
    expect(arrestRisk(state).level).toBe('clear');
  });

  it('does not call a loud week an investigation', () => {
    const state = fresh();
    // The exact situation a playtester hit on Brutal: attention at the ceiling
    // with no case in existence. Heat is not a case and must not read as one.
    state.org.heat = 100;
    state.org.heatBy.street = 100;
    expect(arrestRisk(state).level).toBe('clear');
    expect(arrestRisk(state).line).toContain('Nobody');
  });

  it('mentions evidence lying around before anybody has picked it up', () => {
    const state = fresh();
    state.evidence['e1'] = {
      id: 'e1',
      day: state.day,
      source: 'operation',
      strength: 20,
      attachedTo: [],
      npcIds: [],
      detail: 'A job that went wrong.',
    };
    const risk = arrestRisk(state);
    expect(risk.level).toBe('traces');
  });
});

/*
   The forecast has to mirror the whole of payday, not the part economy.ts owns.

   `payrollForecast` documents itself as mirroring the event rather than
   approximating it, and it did — but `tickEconomy` is not all of a payday.
   `clock.ts` runs `tickLoans` first, and `tickLoans` spends. So a week whose
   money covered wages and counsel but not wages, counsel and the repayment was
   reported "Covered? Yes" and then paid nobody. Round 12 read
   `Due that day $1,350 / Covered? Yes` with `Repayments $1,241` printed two rows
   underneath, and lost three people to the miss that followed.

   Three cases, because the obvious fix is wrong in the third. `tickLoans` pays
   each loan all-or-nothing, so a repayment that cannot be met in full is not met
   at all and the wages are fine that week. Adding the nominal repayment to the
   bill would have cried wolf on exactly those weeks — the same defect pointing
   the other way, and this file exists because a warning the player learns to
   distrust is worse than none.
*/
describe('the payroll forecast counts what the loan book actually takes', () => {
  /** A shark loan, sitting on the eve of a payday, with the books quiet. */
  function withLoan(): { state: GameState; wages: number; repayment: number } {
    const state = fresh();
    state.org.respect = 500;
    borrow(state, 'shark', 5_000);
    expect(loans(state)[0]).toBeTruthy();
    eveOfPayday(state);
    const wages = weeklyWageBill(state) + weeklyLegalCost(state);
    const repayment = weeklyRepayment(state);
    expect(wages).toBeGreaterThan(0);
    expect(repayment).toBeGreaterThan(0);
    return { state, wages, repayment };
  }

  it('says short when the repayment is affordable and leaves the wages short', () => {
    const { state, wages, repayment } = withLoan();
    // Enough for the creditor, a pound short for the crew afterwards.
    state.org.cash = repayment + wages - 1;
    state.org.dirtyCash = 0;

    expect(payrollForecast(state).shortfall).toBeGreaterThan(0);

    advanceDay(state);
    expect(state.org.wagesOwed ?? 0).toBeGreaterThan(0);
  });

  it('does not cry wolf on a week the repayment will bounce', () => {
    const { state, wages, repayment } = withLoan();
    /*
       Short of the creditor by a pound, so `tickLoans` takes nothing at all and
       the wage bill is met in full. The nominal-repayment version of this fix
       reported a shortfall here, which is the week the player is fine.
    */
    state.org.cash = repayment - 1;
    state.org.dirtyCash = 0;
    /*
       Guard the setup, because the first draft of this test got it wrong: the
       money has to be under the creditor's number and over the crew's, or it is
       not testing a bounce at all.
    */
    expect(state.org.cash).toBeLessThan(repayment);
    expect(state.org.cash).toBeGreaterThanOrEqual(wages);

    expect(payrollForecast(state).shortfall).toBe(0);

    advanceDay(state);
    expect(state.org.wagesOwed ?? 0).toBe(0);
  });

  it('still says covered when there is enough for both', () => {
    const { state, wages, repayment } = withLoan();
    state.org.cash = wages + repayment + 1_000;
    state.org.dirtyCash = 0;

    expect(payrollForecast(state).shortfall).toBe(0);

    advanceDay(state);
    expect(state.org.wagesOwed ?? 0).toBe(0);
  });
});

describe('a loan quote matches the loan', () => {
  it('quotes the balance the contract goes on to record', () => {
    const state = fresh();
    state.org.respect = 500;
    const quote = quoteLoan(state, 'shark', 5_000);
    expect(quote).not.toBeNull();
    borrow(state, 'shark', 5_000);
    const taken = loans(state)[0];
    expect(taken).toBeTruthy();
    expect(taken.owed).toBe(quote!.owed);
    expect(taken.principal).toBe(quote!.principal);
  });

  it('never quotes more than the borrower could be given', () => {
    const state = fresh();
    const quote = quoteLoan(state, 'shark', 99_999_999);
    expect(quote).not.toBeNull();
    if (!quote) return;
    expect(quote.principal).toBeLessThan(99_999_999);
    expect(quote.owed).toBeGreaterThanOrEqual(quote.principal);
    expect(totalFunds(state)).toBeGreaterThanOrEqual(0);
  });
});

describe('the ceiling on how bad it can get', () => {
  it('names how far the worst interested agency could take it', () => {
    const state = fresh();
    const risk = arrestRisk(state);
    // A street criminal is only of interest to the city police, and the city
    // police cannot indict anybody. Two playtesters read 100/100 heat as
    // maximum peril at this rank; it is not, and the readout has to say so.
    expect(risk.ceiling).toBeTruthy();
    expect(risk.ceiling!.toLowerCase()).toContain('arrests');
  });

  it('raises the ceiling as the organization becomes worth prosecuting', () => {
    /*
       Worth prosecuting is a matter of size, not standing. Promoting the player
       used to be enough to summon a federal ceiling over a four-man crew,
       because the gate was a rank; now it takes an organization somebody at a
       federal desk could see from where they are sitting.
    */
    const state = fresh();
    const seed = Object.values(state.npcs)[0]!;
    for (let i = 0; i < 30; i++) {
      const id = `big_${i}`;
      state.npcs[id] = { ...seed, id, name: `Hand ${i}`, stats: { ...seed.stats } };
    }
    for (const t of Object.values(state.territories)) t.influence.player = 40;

    const risk = arrestRisk(state);
    expect(risk.ceiling!.toLowerCase()).toContain('trial');
  });
});

describe('the laundering outlook explains which ceiling is biting', () => {
  it('says nothing will wash when wages have spoken for everything', () => {
    const state = fresh();
    state.org.dirtyCash = 10;
    const outlook = launderOutlook(state);
    expect(outlook.limit).toBe('nothing');
    expect(outlook.clean).toBe(0);
  });

  it('blames earnings, not capacity, when the surplus is the smaller number', () => {
    const state = fresh();
    // Capacity is irrelevant with no fronts; give it some dirty cash and the
    // outlook should still not pretend money is moving.
    state.org.dirtyCash = 50_000;
    const outlook = launderOutlook(state);
    expect(outlook.capacity).toBe(0);
    expect(outlook.washable).toBe(0);
  });
});

describe('the first money gate is reachable', () => {
  /*
     Rewritten because the quantity changed, not because the number was
     inconvenient.

     The original asserted `cleanCash <= 10_000` and explained itself as "the
     gate must stay inside what one or two fronts can produce in a few months"
     — a statement about *laundering throughput*, because the requirement used
     to read clean cash held. It now reads the estate: the wallet, what has
     been put away, what the fronts would fetch and what the ground is worth.

     Under that measure a family does not wait a season for the gate. It buys a
     laundromat and the gate is most of the way met, because the building is
     the thing being counted. Nudging 10,000 up to 12,500 and leaving the
     comment would have kept a passing test that no longer described anything.

     The intent that survives, stated against the new measure: the first gate
     must be payable by the cheapest thing on the shelf. A boss who can afford
     one front can reach Crew Leader.
  */
  it('asks for no more than the cheapest front on the shelf', () => {
    const cheapest = Math.min(...BUSINESSES.map((b) => b.cost));
    expect(RANK_BY_ID.crew_leader.requires.cleanCash).toBeLessThanOrEqual(cheapest * 1.1);
    expect(RANK_BY_ID.crew_leader.requires.cleanCash).toBeGreaterThan(cheapest * 0.5);
  });

  /*
     And the rungs above it keep their shape.

     Each is roughly four times the one below — the same ratio the front
     catalogue's own prices climb at — so the ladder cannot quietly become
     flat at the top or vertical in the middle.
  */
  it('keeps roughly a fourfold step between the paying rungs', () => {
    const paying = RANKS.filter((r) => r.requires.cleanCash > 0);
    for (let i = 1; i < paying.length; i++) {
      const ratio = paying[i].requires.cleanCash / paying[i - 1].requires.cleanCash;
      expect(ratio, `${paying[i].id} against ${paying[i - 1].id}`).toBeGreaterThanOrEqual(3);
      expect(ratio, `${paying[i].id} against ${paying[i - 1].id}`).toBeLessThanOrEqual(6);
    }
  });
});

/*
   The forecast against the payday, over a spread of states rather than three.

   The three cases above are the ones that were wrong, written from a real
   report. This is the general property they are instances of, and it exists
   because the specific fix for `Covered? Yes` was itself wrong the first time:
   the obvious repair passed the shortfall test and would have reported a
   shortfall on every week a repayment was about to bounce. One example each way
   is not enough to pin a rule that has now been wrong in both directions.

   What it holds still, and why. `advanceDay` moves money in three places before
   wages — `tickOperations`, `tickContraband` and `tickBusinesses` — so a state
   with any of those live is not testing the forecast, it is testing whether a
   job happened to land that morning. All three are empty here by construction.

   And it deliberately does not test the razor edge. `tickMarket` re-prices the
   day before wages are read, so a bill quoted on the eve can differ by a few
   dollars from the bill taken on the day. A margin keeps that from arriving
   later as a flake nobody can reproduce, and the exact boundary is already
   covered by name above.
*/
describe('the forecast agrees with the payday it forecasts', () => {
  const MARGIN = 50;

  it('across a spread of money, debt and counsel', () => {
    let shortCases = 0;
    let coveredCases = 0;

    for (let seed = 1; seed <= 120; seed++) {
      const state = fresh(seed);
      const pick = new Rng({ seed, calls: 0 });

      if (pick.next() < 0.6) {
        state.org.respect = 500;
        borrow(state, 'shark', pick.int(2_000, 20_000));
      }
      if (pick.next() < 0.4) retainLawyer(state, pick.next() < 0.5 ? 'local' : 'firm');

      eveOfPayday(state);

      // Nothing may move money between the reading and the event.
      expect(Object.keys(state.activeOperations)).toHaveLength(0);
      expect(ownedBusinesses(state)).toHaveLength(0);

      /*
         Money scaled to the bill, not to a flat range.

         The first draft drew cash from $0-12,000 against a starting wage bill of
         about $150, so 118 of 120 seeds were comfortably covered and only two
         ever went short. The coverage guard at the bottom caught it, which is
         the entire reason that guard is there — the test would otherwise have
         passed while exercising one arm of the branch.
      */
      const bill =
        weeklyWageBill(state) + weeklyLegalCost(state) + weeklyRepayment(state);
      state.org.cash = pick.int(0, Math.max(1, Math.round(bill * 1.6)));
      state.org.dirtyCash = pick.int(0, Math.max(1, Math.round(bill * 0.4)));
      state.org.holdings = 0;

      const forecast = payrollForecast(state);
      const owedBefore = state.org.wagesOwed ?? 0;
      advanceDay(state);
      const missed = (state.org.wagesOwed ?? 0) > owedBefore;

      if (forecast.shortfall > MARGIN) {
        shortCases++;
        expect(missed, `seed ${seed}: forecast said short ${forecast.shortfall}`).toBe(true);
      } else if (forecast.shortfall === 0 && forecast.onHand - forecast.due > MARGIN) {
        coveredCases++;
        expect(missed, `seed ${seed}: forecast said covered`).toBe(false);
      }
    }

    // A property test that exercised only one side of the branch would pass
    // while proving half of what it claims. Both arms have to have fired.
    expect(shortCases).toBeGreaterThan(5);
    expect(coveredCases).toBeGreaterThan(5);
  });
});
