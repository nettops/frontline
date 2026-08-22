/**
 * Where Influence comes from, and whether it arrives at a rate.
 *
 * Four blind rounds have never seen a player exceed Influence 2. Round 13: "a
 * whole vertical of the game was invisible to me for 300 days because of one
 * attribute I had no idea how to train." Round 14 finished at 0/20 after 300
 * days while deliberately keeping a firm on retainer the whole way.
 *
 * `config/economy.ts` already carries a comment saying this attribute used to
 * be circular — earnable only by buying the contacts that required it — and
 * that `INFLUENCE_FROM.approach` was added to unwall it. This file exists
 * because that is not what happened.
 *
 * What is actually there, on inspection:
 *
 *   counsel on retainer   0.12 per week
 *   a diplomatic approach 0.6, credited on the approach, refused or not
 *
 * against a cost curve of `3 + current * 1.6`. Reaching the patron's bar of 9
 * costs 80 points of progress. At 0.12 a week that is thirteen years, so
 * counsel is not a route. The approach is — and `canDo` rate-limits nothing.
 *
 * So the supply is not low. It is a wall with a hole in it: unreachable until
 * you can clear a strength bar, then unbounded, because `demand_tribute` costs
 * nothing and the credit is paid per call.
 *
 * Both halves are asserted here. A fix that closes the hole without opening the
 * wall has made the reported problem worse.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { canDo, doDiplomacy, setRelationship } from '../diplomacy';
import { tickEconomy } from '../economy';
import { retainLawyer, weeklyLegalCost } from '../investigation';
import { crewList } from '../npc';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { DIPLOMACY } from '../../config/diplomacy';
import { RIVAL_IDS } from '../../config/factions';
import { INFLUENCE_FROM } from '../../config/economy';
import type { GameState } from '../types';

function game(seed = 31): GameState {
  return newGame({ name: 'Pull', difficulty: 'normal', seed });
}

/**
 * A player standing where a free demand is allowed.
 *
 * `demand_tribute` takes either a strength lead or standing, so this buys the
 * second — it is the cheaper of the two to arrange in a test and it is the one
 * a talking player would actually have.
 */
function respected(state: GameState, target: string): void {
  setRelationship(state, 'player', target as never, 80);
  const b = state.factions[target].bonds['player'];
  b.respect = DIPLOMACY.demandRespect + 10;
}

describe('the free approach is not an unlimited tap', () => {
  it('is genuinely free and genuinely available', () => {
    // The instrument first. If the demand were refused or priced, the test
    // below would pass while measuring nothing at all.
    const state = game();
    const target = RIVAL_IDS[0];
    respected(state, target);

    const check = canDo(state, 'demand_tribute', target);
    expect(check.ok, `the setup did not make a demand available: ${check.message}`).toBe(true);
    expect(INFLUENCE_FROM.approach).toBeGreaterThan(0);
  });

  /*
     The property, stated as a rate rather than as a number.

     Twenty demands inside a single day is not a play anybody would make by
     hand, and that is the point — nothing in the game stops it, and a bot
     written to pursue this vertical would find it immediately. What the
     assertion cares about is that the tap has *some* limit, not what the limit
     is: a cooldown, a diminishing return and a hard daily cap would all pass.
  */
  it('does not pay for the same approach over and over in one day', () => {
    const state = game();
    const target = RIVAL_IDS[0];
    respected(state, target);
    const rng = new Rng(state.rng);

    const before = state.player.attributes.influence + state.player.attributeProgress.influence;
    for (let i = 0; i < 20; i++) doDiplomacy(state, rng, 'demand_tribute', target);
    const after = state.player.attributes.influence + state.player.attributeProgress.influence;

    const paid = (after - before) / INFLUENCE_FROM.approach;
    expect(
      paid,
      `twenty free demands in one day were credited ${paid.toFixed(1)} times over. ` +
        'Influence is described as the hard attribute to train and this is an unlimited ' +
        'tap on it, gated only by a strength bar the same rounds never cleared.',
    ).toBeLessThanOrEqual(3);
  });

  /*
     And the other direction, which is the one the rounds actually reported.

     A fix that simply refuses repeats would leave counsel at 0.12 a week as the
     only route, which is thirteen years to the patron's bar. Talking to the
     three families across a season has to be a real way to build pull.
  */
  it('still pays a player who talks to everybody over a season', () => {
    const state = game();
    for (const id of RIVAL_IDS) respected(state, id);
    const rng = new Rng(state.rng);

    const before = state.player.attributes.influence + state.player.attributeProgress.influence;
    // Thirteen weeks, one approach to each family a week.
    for (let week = 0; week < 13; week++) {
      state.day += 7;
      for (const id of RIVAL_IDS) doDiplomacy(state, rng, 'demand_tribute', id);
    }
    const after = state.player.attributes.influence + state.player.attributeProgress.influence;

    expect(
      after - before,
      'a season of talking to all three families bought almost no pull, which leaves ' +
        'counsel at 0.12 a week as the only route and the patron thirteen years away',
    ).toBeGreaterThan(INFLUENCE_FROM.approach * 8);
  });
});

/*
   And the retainer is yours, not your crew's.

   `tickEconomy` opens with a payroll guard — no payable crew, nothing to do,
   return. The legal payment and the influence credit are written below it, so
   a boss whose people are all in a cell stops paying the firm that is trying
   to get them out, and stops building the one relationship the game offers as
   a route to Influence.

   That is the exact state a player with counsel is in. Round 14 had five of
   six men in custody on day 153 and a lawyer on retainer.
*/
describe('counsel is paid whether or not anybody is on the payroll', () => {
  function withLawyerAndNobodyPayable(): GameState {
    const state = game(88);
    state.org.cash = 500_000;
    retainLawyer(state, 'local');
    // Everybody inside. Not dead, not gone — the position the lawyer is for.
    for (const npc of crewList(state)) npc.status = 'arrested';
    state.day = PAYDAY_INTERVAL * 4;
    return state;
  }

  it('sets up a payday with a retainer and nobody to pay', () => {
    // The instrument first: no retainer, or a stray payable body, and the
    // assertions below pass while measuring nothing.
    const state = withLawyerAndNobodyPayable();
    expect(weeklyLegalCost(state), 'no retainer was actually taken out').toBeGreaterThan(0);
    expect(
      crewList(state).filter((n) => n.status !== 'arrested').length,
      'somebody was still payable, so the guard under test never fires',
    ).toBe(0);
    expect(state.day % PAYDAY_INTERVAL).toBe(0);
  });

  it('takes the retainer', () => {
    const state = withLawyerAndNobodyPayable();
    const before = state.org.cash;
    tickEconomy(state);

    expect(
      before - state.org.cash,
      'the firm was not paid on a week when every client was in custody',
    ).toBe(weeklyLegalCost(state));
  });

  it('still builds pull for the week it was paid', () => {
    const state = withLawyerAndNobodyPayable();
    const before =
      state.player.attributes.influence + state.player.attributeProgress.influence;
    tickEconomy(state);
    const after =
      state.player.attributes.influence + state.player.attributeProgress.influence;

    expect(
      after - before,
      'a paid retainer built no pull because the payroll guard returned first',
    ).toBeGreaterThan(0);
  });
});
