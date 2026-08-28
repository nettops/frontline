/**
 * The way back up from nothing, and what it costs.
 *
 * This is F15's fun problem rather than its balance problem: a career decided
 * by day 60 that runs for another 240 days. The partner is a decision offered
 * to somebody who has no money, which is the one position this game currently
 * has nothing to say to.
 *
 * Three things have to be true at once or it is not worth building:
 *
 * 1. It is **reachable** from the bottom. An offer gated on anything you lose
 *    when you stall is an offer that never arrives.
 * 2. It **costs** something forever. A bail-out with no price is a cheat code
 *    with a story attached, and the run stops being a run.
 * 3. You can **get out**. Without the buy-out this is a permanent tax and the
 *    late game is worse than it was, not better.
 *
 * The fourth test is the one that would catch the version of this that looks
 * finished and is not: taking a share of money that was never income.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { earnDirty, refundDirty } from '../economy';
import { cancelOperation, launchOperation } from '../operations';
import { operableTerritories } from '../territory';
import { OPERATION_BY_ID } from '../../config/operations';
import {
  buyOutPartner,
  buyOutPrice,
  partnerOffer,
  partnerShare,
  takePartner,
} from '../partner';
import { PARTNER } from '../../config/partner';
import { rivals } from '../faction';
import { crewList } from '../npc';
import { recruit } from '../crew';
import type { GameState } from '../types';

function stalled(seed = 4, day = 120): GameState {
  const state = newGame({ name: 'Nobody', difficulty: 'normal', seed });
  state.day = day;
  state.org.cash = 200;
  state.org.dirtyCash = 0;
  state.org.holdings = 0;
  return state;
}

describe('the offer', () => {
  it('arrives when the career has actually stopped', () => {
    const state = stalled();
    expect(
      partnerOffer(state),
      'a boss with $200 on day 120 was offered nothing, which is the position ' +
        'F15 describes and the one the game has no answer for',
    ).not.toBeNull();
  });

  it('does not arrive while you can still pay your way', () => {
    const state = stalled();
    state.org.cash = 50_000;
    expect(partnerOffer(state)).toBeNull();
  });

  it('does not arrive in the first month', () => {
    // Everybody is broke on day 3, and that is the game working.
    const state = stalled(4, PARTNER.notBeforeDay - 1);
    expect(partnerOffer(state)).toBeNull();
  });

  it('comes from a family that is actually still standing', () => {
    const state = stalled();
    const offer = partnerOffer(state);
    expect(offer).not.toBeNull();
    const who = rivals(state).find((f) => f.id === offer!.factionId);
    expect(who, 'the offer came from nobody').toBeDefined();
    expect(who!.strength, 'a finished family is not buying anything').toBeGreaterThan(0);
  });

  it('stops arriving once you already have one', () => {
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    expect(partnerOffer(state), 'two families own a piece of the same outfit').toBeNull();
  });
});

describe('what it costs', () => {
  it('pays out the stake and takes a permanent share', () => {
    const state = stalled();
    const before = state.org.cash + state.org.dirtyCash;
    takePartner(state, partnerOffer(state)!);

    expect(
      state.org.cash + state.org.dirtyCash,
      'the stake never arrived',
    ).toBeGreaterThan(before);
    expect(partnerShare(state)).toBeCloseTo(PARTNER.share, 5);
  });

  it('takes its cut off every job, by name', () => {
    const state = stalled();
    takePartner(state, partnerOffer(state)!);

    const before = state.org.dirtyCash;
    earnDirty(state, 1_000);
    const kept = state.org.dirtyCash - before;

    expect(
      kept,
      `a $1,000 job put ${kept} in the drawer; the partner holds ` +
        `${Math.round(PARTNER.share * 100)}% and should have taken their end`,
    ).toBeCloseTo(1_000 * (1 - PARTNER.share), 0);
    expect(state.org.partner!.taken).toBeCloseTo(1_000 * PARTNER.share, 0);
  });

  it('takes nothing at all when there is no partner', () => {
    const state = stalled();
    const before = state.org.dirtyCash;
    earnDirty(state, 1_000);
    expect(state.org.dirtyCash - before).toBe(1_000);
  });

  it('does not take a cut of money that was never income', () => {
    /*
       The defect this file exists to catch. `earnDirty` is the funnel for
       everything, and two of its callers are handing back an investment that
       failed to spend — `operations.ts` refunds 70% of the outlay on a
       cancelled job. Skimming a returned stake is not a partnership, it is a
       bug that looks like a fee, and it would only ever be noticed by a
       player already having a bad week.
    */
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    const before = state.org.dirtyCash;
    const takenBefore = state.org.partner!.taken;

    refundDirty(state, 1_000);

    expect(state.org.dirtyCash - before, 'a refund was skimmed').toBe(1_000);
    expect(state.org.partner!.taken, 'a refund counted as their earnings').toBe(takenBefore);
  });
});

describe('the wiring, not the function', () => {
  /*
     The test above proves `refundDirty` does not skim. It does not prove the
     game calls it — the refund paths in `operations.ts` were still on
     `earnDirty` when that test first went green, so the leak was live and
     covered at the same time. This project has shipped that exact gap before:
     sixteen possessions tests passed while the warrant path called nothing.

     So this one cancels a real job and reads the drawer.
  */
  it('does not skim a cancelled job through the real cancel path', () => {
    const state = stalled(4, 120);
    // Sign first, while still broke — the offer only exists down there. Then
    // fund the job, or there is nothing to cancel.
    takePartner(state, partnerOffer(state)!);
    state.org.dirtyCash += 40_000;

    /*
       Every step below asserts rather than returning early, and that is the
       whole lesson of the first draft. It guarded each precondition with
       `if (!x) return`, `burglary_run` turned out to want two crew, `[]` was
       passed, `launchOperation` returned null — and the test reported green
       while executing none of itself. Reverting the fix it claims to guard
       left it green too.
    */
    const paid = OPERATION_BY_ID['burglary_run'];
    expect(paid, 'burglary_run is gone; pick another job with an outlay').toBeDefined();
    expect(paid.investment, 'the job has no outlay, so there is no refund to skim').toBeGreaterThan(0);

    // Every paid job at the opening rank wants two hands and a fresh career
    // has one. Hire up to the requirement rather than picking a cheaper job:
    // there is no paid job with a smaller crew, so there is nothing to pick.
    while (crewList(state).filter((n) => n.status === 'active').length < paid.crewRequired) {
      const who = Object.values(state.recruits)[0];
      expect(who, 'nobody to hire, so the job can never be staffed').toBeDefined();
      recruit(state, who.id);
    }
    const crew = crewList(state).filter((n) => n.status === 'active');

    const where = operableTerritories(state)[0];
    expect(where, 'nowhere to run a job').toBeDefined();

    const live = launchOperation(
      state,
      paid.id,
      crew.slice(0, paid.crewRequired).map((n) => n.id),
      where.territory.id,
    );
    expect(live, 'the job never started, so nothing below was measured').not.toBeNull();

    const before = state.org.dirtyCash;
    const takenBefore = state.org.partner!.taken;
    cancelOperation(state, live!.id);

    expect(
      state.org.dirtyCash - before,
      'the refund came back short, so the partner took a cut of the outlay',
    ).toBe(Math.round(paid.investment * 0.7));
    expect(state.org.partner!.taken, 'a refund counted as their earnings').toBe(takenBefore);
  });
});

describe('getting out', () => {
  it('is priced off the stake, not off what they have taken', () => {
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    const price = buyOutPrice(state);
    expect(price).toBeCloseTo(state.org.partner!.stake * PARTNER.buyoutMultiple, 0);

    // Their take must not move the price, or working harder makes freedom
    // more expensive and the player is punished for playing.
    earnDirty(state, 50_000);
    expect(buyOutPrice(state)).toBeCloseTo(price, 0);
  });

  it('refuses when you cannot cover it', () => {
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    state.org.cash = 10;
    state.org.dirtyCash = 10;
    expect(buyOutPartner(state)).toBe(false);
    expect(state.org.partner, 'they left without being paid').not.toBeUndefined();
  });

  it('ends the arrangement, and the cut stops', () => {
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    state.org.cash = buyOutPrice(state) + 1_000;

    expect(buyOutPartner(state)).toBe(true);
    expect(state.org.partner, 'they are still on the books').toBeUndefined();

    const before = state.org.dirtyCash;
    earnDirty(state, 1_000);
    expect(state.org.dirtyCash - before, 'they are gone and still taking a cut').toBe(1_000);
  });

  it('can be reached by working, from the day you sign', () => {
    // Not a balance claim — only that the exit is not sealed by its own price.
    const state = stalled();
    takePartner(state, partnerOffer(state)!);
    const price = buyOutPrice(state);
    // Everything they will ever take on the way to the price is still less
    // than the price, so earning it is possible in principle.
    expect(price * PARTNER.share).toBeLessThan(price);
    expect(price).toBeGreaterThan(0);
  });
});
