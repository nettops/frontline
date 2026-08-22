/**
 * A memo must not stop the clock to offer something the game refuses to sell.
 *
 * Round 11, days 157 and 291: "A place in Little Sicily is for sale — Buy it —
 * $9,777", with the buy button disabled and its own subtitle reading "No room
 * for another front in Little Sicily. Take more of the district." Reproduced
 * 134 days apart, with $146,000 in hand the second time, so it was never about
 * affordability.
 *
 * `applies` took the first district at foothold or better and never asked
 * whether it had a slot free. The result is an interruption whose only live
 * option is Pass — the game demanding a click to tell you no.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { canRecruit, recruit, recruitCost } from '../crew';
import { totalFunds } from '../economy';
import { availableOperations, launchOperation } from '../operations';
import { operableTerritories, playerInfluence, controlledTerritories } from '../territory';
import { availableCrew } from '../npc';
import { acquireBusiness, canAcquire } from '../business';
import { BUSINESSES } from '../../config/businesses';

describe('offers the game will not honour', () => {
  it('never raises a front offer in a district with no room for one', () => {
    const offenders: string[] = [];
    let offersSeen = 0;

    for (let seed = 1; seed <= 6; seed++) {
      const state = newGame({ name: 'Offer', difficulty: 'normal', seed });
      const rng = new Rng(state.rng);
      // Money is not the constraint under test, so remove it as one — this is
      // round 11's day-291 state, holding $146,000 with every slot full.
      state.org.cash = 200_000;

      for (let day = 0; day < 500; day++) {
        state.org.cash = Math.max(state.org.cash, 200_000);
        if (totalFunds(state) > recruitCost(state)) {
          for (const id of Object.keys(state.recruits)) {
            if (canRecruit(state, id).ok) {
              recruit(state, id);
              break;
            }
          }
        }
        // Fill every slot it can, which is what creates the state.
        for (const t of controlledTerritories(state)) {
          for (const def of BUSINESSES) {
            if (canAcquire(state, def.id, t.id).ok) {
              acquireBusiness(state, def.id, t.id);
              break;
            }
          }
        }
        const where = [...operableTerritories(state)].sort(
          (a, b) => playerInfluence(b.territory) - playerInfluence(a.territory),
        )[0]?.territory.id;
        if (where) {
          for (const def of availableOperations(state)) {
            if (availableCrew(state).length < def.crewRequired) continue;
            launchOperation(
              state,
              def.id,
              availableCrew(state).slice(0, def.crewRequired).map((n) => n.id),
              where,
            );
          }
        }

        let guard = 0;
        while (state.pendingEvents.length > 0 && guard++ < 20) {
          const event = state.pendingEvents[0];
          if (event.defId === 'business_offer') {
            offersSeen += 1;
            const buy = event.choices.find((c) => c.id === 'buy');
            if (buy?.disabledReason && /no room/i.test(buy.disabledReason)) {
              offenders.push(`day ${state.day}: ${buy.disabledReason}`);
            }
          }
          const pick = event.choices.find((c) => !c.disabledReason) ?? event.choices[0];
          resolveEvent(state, rng, event.id, pick.id);
        }
        advanceDay(state);
        if (state.gameOver) break;
      }
    }

    // Guard against the test proving nothing: if the offer never fires, it
    // cannot have been checked. Round 11 saw it twice in 303 days.
    expect(offersSeen).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
