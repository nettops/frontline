/**
 * A status the player believes they hold, quietly untrue.
 *
 * Round 19's tester reached Crime Lord on day 147. By day 300 two of his men
 * had been arrested, the rank had gone with them, and the Overview read *Boss ·
 * Crime Lord wants 2 more bodies on the books* — with no log entry, no memo and
 * no badge. He found it by chance and filed it as the round's only MUST FIX:
 * *"the log has no entry for the demotion at all, while it logs everything else
 * down to a single failed job."*
 *
 * The same round lost the entire trade to the other half of the same fault. He
 * met it on day 114 two fronts short, bought fronts later for unrelated
 * reasons, and *"nothing on screen reminded me it had opened, so I never went
 * back."*
 *
 * Both are consequences of deriving rather than storing, which is right and is
 * staying: `rankNow` reads the same board the job table gates on, so what you
 * are called and what you may do cannot come apart. A derived value simply has
 * no moment of change to hang a message on, and this is that moment.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDay } from '../clock';
import { rankNow } from '../rank';
import { tradeUnlocked } from '../contraband';
import {
  availableOperations,
  crewNeeded,
  operationCost,
  outgrewStreetWork,
  STREET_WORK_IDS,
} from '../operations';
import { availableCrew } from '../npc';
import { totalFunds } from '../economy';
import { putInCharge } from '../delegation';
import { crewList } from '../npc';
import { territoryList } from '../territory';
import { TRADES } from '../../config/contraband';
import { RANK_BY_ID } from '../../config/economy';
import { withFronts } from './helpers';
import type { GameState } from '../types';

function game(seed = 7): GameState {
  return newGame({ name: 'Said', difficulty: 'normal', seed });
}

function seated(seed = 7): GameState {
  return newGame({
    name: 'Said',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
}

/** Log lines added by one day, newest first. */
function dayOf(state: GameState): string[] {
  const before = state.log[0];
  advanceDay(state);
  const at = before ? state.log.indexOf(before) : state.log.length;
  return state.log.slice(0, at === -1 ? state.log.length : at).map((l) => l.text);
}

describe('what the game says about you', () => {
  it('says nothing on the first day, because you are what you were', () => {
    const state = game();
    const said = dayOf(state);
    expect(said.some((t) => /the family has (come up|slipped)/i.test(t))).toBe(false);
    expect(state.org.rankSaid).toBe(rankNow(state).id);
  });

  it('says so when the name changes', () => {
    const state = seated(11);
    withFronts(state, 3);
    advanceDay(state);
    const climbed = rankNow(state);
    expect(climbed.id, 'the fixture never left the bottom rung, so a rise is unmeasurable')
      .not.toBe('street_criminal');

    // Put them somewhere else on the ladder without touching the announcer.
    state.org.rankSaid = 'street_criminal';
    const said = dayOf(state);

    expect(said.join(' '), 'a rank rise went unremarked').toMatch(
      new RegExp(`the family has come up: ${climbed.name}\\.`, 'i'),
    );
    expect(state.org.rankSaid).toBe(climbed.id);
  });

  it('and says so going down, which is the half that was missing', () => {
    /*
       The tester's exact case. `rank.ts` is explicit that rank falls — "lose
       two districts and you are what you are now, not what you were in June" —
       so a version that only announced rises would be a trophy cabinet with
       the losses filed somewhere else.
    */
    const state = seated(12);
    advanceDay(state);
    const held = rankNow(state);

    // Claim they were higher than they are, and let the day catch up.
    state.org.rankSaid = 'crime_lord';
    const said = dayOf(state);

    expect(said.join(' ')).toMatch(/the family has slipped/i);
    expect(said.join(' ')).toMatch(new RegExp(`it was ${RANK_BY_ID.crime_lord.name}`, 'i'));
    expect(said.join(' ')).toMatch(new RegExp(`and is ${held.name} now`, 'i'));
  });
});

describe('a door that opened while you were looking elsewhere', () => {
  it('says the trade is reachable on the day it becomes reachable', () => {
    const state = seated(21);
    // Below the bar, and marked as such, which is where a career starts.
    advanceDay(state);
    expect(tradeUnlocked(state, 'product')).toBe(false);
    expect(state.org.tradeSaid?.product).toBe(false);

    withFronts(state, TRADES.product.minFronts);
    const said = dayOf(state);

    expect(tradeUnlocked(state, 'product')).toBe(true);
    expect(said.join(' '), 'the gate lifted and nothing said so').toMatch(
      new RegExp(TRADES.product.name, 'i'),
    );
  });

  it('says it once, not every day after', () => {
    // A standing reminder that something is available is a nag.
    const state = seated(22);
    advanceDay(state);
    withFronts(state, TRADES.product.minFronts);
    const opened = dayOf(state);
    expect(opened.join(' ')).toMatch(new RegExp(TRADES.product.name, 'i'));

    for (let i = 0; i < 5; i++) {
      expect(dayOf(state).join(' ')).not.toMatch(new RegExp(TRADES.product.name, 'i'));
    }
  });
});

/**
 * A pitch the boss could take today, so the gate has something to live off.
 *
 * Round 30's MUST FIX 3: street work only comes off the board while a capo has
 * brought him something he could actually run, so the day it retires is the day
 * that is true, not the day a steward is named.
 */
function pitchedFor(state: GameState, territoryId: string): void {
  const op = availableOperations(state).find(
    (o) =>
      o.tier > 0 &&
      !STREET_WORK_IDS.has(o.id) &&
      operationCost(state, o) <= totalFunds(state) &&
      crewNeeded(state, o) <= availableCrew(state).length,
  );
  expect(op, 'the setup has nothing a capo could pitch').toBeTruthy();
  state.capoPitches = [
    {
      id: 'pitch_setup',
      defId: op!.id,
      territoryId,
      capoId: crewList(state)[0].id,
      offeredDay: state.day,
      status: 'open',
    },
  ];
}

const RETIRED_LINE = /corners yourself|hands do that|young man/i;

describe('street work, the day it actually comes off the board', () => {
  /*
     The blind round's own MUST FIX: delegating a district silently dropped
     work_it_yourself and its neighbors off the manual board, with nothing on
     screen explaining why — the tester traced it back to the decision only by
     accident, days later. This is the other half of what the steward panel
     already says about a hand's worth before the decision.
  */
  it('says nothing on the first day, because there is nothing to outgrow yet', () => {
    const state = game();
    const said = dayOf(state);
    expect(said.some((t) => /corners|hands are full|young man/i.test(t))).toBe(false);
    expect(state.org.streetWorkRetiredSaid).toBe(false);
  });

  it('says so the day a steward actually takes street work off the board', () => {
    const state = game();
    const t = territoryList(state)[0];
    t.influence = { ...t.influence, player: 95 };
    state.org.cash = 500_000;
    const steward = crewList(state)[0];
    steward.role = 'soldier';
    state.npcs['n2'] = { ...steward, id: 'n2', name: 'Second Hand', status: 'active' };
    advanceDay(state); // first tick, records the false baseline

    expect(outgrewStreetWork(state)).toBe(false);
    pitchedFor(state, t.id);
    putInCharge(state, steward.id, t.id);
    expect(outgrewStreetWork(state)).toBe(true);

    const said = dayOf(state);
    expect(said.some((t) => /corners|hands are full|young man/i.test(t))).toBe(true);
    expect(state.org.streetWorkRetiredSaid).toBe(true);
  });

  it('says it once, not every day after', () => {
    const state = game();
    const t = territoryList(state)[0];
    t.influence = { ...t.influence, player: 95 };
    state.org.cash = 500_000;
    const steward = crewList(state)[0];
    steward.role = 'soldier';
    state.npcs['n2'] = { ...steward, id: 'n2', name: 'Second Hand', status: 'active' };
    advanceDay(state);
    pitchedFor(state, t.id);
    putInCharge(state, steward.id, t.id);

    const said = dayOf(state);
    expect(said.some((t) => /corners|hands are full|young man/i.test(t))).toBe(true);

    for (let i = 0; i < 5; i++) {
      expect(dayOf(state).some((t) => /corners|hands are full|young man/i.test(t))).toBe(false);
    }
  });

  it('does not say it again when the pitches lapse and come back', () => {
    // All three of `announceStreetWorkRetired`'s variants, not just the ones the
    // older tests here happen to draw on their days.
    // Round 30's MUST FIX 3 tied the gate to what the capos have brought, and
    // pitches arrive and lapse weekly, so the gate can flip on, off and on.
    // Being told once that the corners are not his any more is the whole of
    // the announcement; the same line every time a pitch lands is the
    // repetition a blind tester filed about this one.
    const state = game();
    const t = territoryList(state)[0];
    t.influence = { ...t.influence, player: 95 };
    state.org.cash = 500_000;
    const steward = crewList(state)[0];
    steward.role = 'soldier';
    state.npcs['n2'] = { ...steward, id: 'n2', name: 'Second Hand', status: 'active' };
    advanceDay(state);
    pitchedFor(state, t.id);
    putInCharge(state, steward.id, t.id);
    expect(dayOf(state).some((x) => RETIRED_LINE.test(x))).toBe(true);

    // The pitch lapses: the corners are his again, in silence.
    for (const p of state.capoPitches ?? []) p.status = 'expired';
    expect(dayOf(state).some((x) => RETIRED_LINE.test(x))).toBe(false);
    expect(outgrewStreetWork(state)).toBe(false);

    // A new one lands, and the gate rises again.
    pitchedFor(state, t.id);
    expect(dayOf(state).some((x) => RETIRED_LINE.test(x))).toBe(false);
    expect(outgrewStreetWork(state)).toBe(true);
  });
});
