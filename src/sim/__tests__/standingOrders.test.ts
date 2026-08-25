/**
 * Telling them to keep doing it.
 *
 * The one piece of real automation in this game's job loop, and the only one
 * that plays turns for you. Everything else added to cut the clicking — the
 * crew fills, the batch groundwork — removes the ticking and leaves every
 * decision where it was.
 *
 * **The property the whole thing rests on: a standing order does not read the
 * room.** It keeps sending men at a job whose odds have collapsed, because
 * that is what you told it to do. A player would have looked at the heat and
 * stopped. That is the cost that makes this a decision rather than a strictly
 * better way to play, and it is the same lesson `config/delegation.ts` already
 * teaches about handing a man a district: you give up the judgement call, and
 * you read the record afterwards.
 *
 * If that property ever stops holding, the correct play becomes setting one
 * and pressing +1 month, and the game has been automated out of itself.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList, generateNpc, availableCrew } from '../npc';
import { successBreakdown } from '../operations';
import {
  cancelStanding,
  liveStanding,
  patternDelta,
  patternHeat,
  patternOn,
  setStanding,
  standingFor,
  standingList,
  tickStandingOrders,
} from '../standingOrders';
import { OPERATION_BY_ID } from '../../config/operations';
import { HOME_TERRITORY } from '../../config/territories';
import { SAVE_VERSION } from '../state';
import type { GameState } from '../types';

const JOB = 'corner_shakedown';

function game(seed = 9): GameState {
  const state = newGame({ name: 'Standing', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 10) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

/** Somewhere the player can actually work, which is where they are from. */
const where = HOME_TERRITORY;

describe('setting one', () => {
  it('starts nothing on its own and says what it is for', () => {
    const state = game();
    expect(state.standing).toBeUndefined();

    const order = setStanding(state, JOB, where, 'best');
    expect(order).toBeTruthy();
    expect(liveStanding(state)).toHaveLength(1);
    expect(standingFor(state, JOB)).toBeTruthy();
  });

  it('refuses a second one on the same job', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    expect(setStanding(state, JOB, where, 'rested')).toBeNull();
    expect(liveStanding(state)).toHaveLength(1);
  });

  it('can be called off', () => {
    const state = game();
    const order = setStanding(state, JOB, where, 'best')!;
    cancelStanding(state, order.id);
    expect(liveStanding(state)).toHaveLength(0);
    expect(standingFor(state, JOB)).toBeUndefined();
  });
});

describe('what it does each day', () => {
  it('sends people without being asked', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    expect(Object.keys(state.activeOperations)).toHaveLength(0);

    tickStandingOrders(state);
    expect(Object.keys(state.activeOperations).length).toBeGreaterThan(0);
  });

  it('does not start a second one while the first is still out', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    tickStandingOrders(state);
    const running = Object.keys(state.activeOperations).length;
    tickStandingOrders(state);
    expect(Object.keys(state.activeOperations)).toHaveLength(running);
  });

  it('keeps going across days on its own', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    for (let d = 0; d < 12; d++) advanceDay(state);
    expect(state.operationHistory.filter((r) => r.defId === JOB).length).toBeGreaterThan(2);
  });

  it('stops when it is called off', () => {
    const state = game();
    const order = setStanding(state, JOB, where, 'best')!;
    for (let d = 0; d < 6; d++) advanceDay(state);
    cancelStanding(state, order.id);

    /*
       Two days to let whatever was already out come home. Calling it off is
       not a recall — men in the middle of a job cannot be pulled back, which
       is the same rule `startLayLow` records having got wrong once.
    */
    for (let d = 0; d < 2; d++) advanceDay(state);
    const ran = state.operationHistory.filter((r) => r.defId === JOB).length;

    for (let d = 0; d < 10; d++) advanceDay(state);
    expect(state.operationHistory.filter((r) => r.defId === JOB).length).toBe(ran);
  });

  it('waits rather than sending nobody when the bench is empty', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    for (const npc of crewList(state)) npc.status = 'busy';
    tickStandingOrders(state);
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
    // And it is still standing, waiting for somebody to come free.
    expect(liveStanding(state)).toHaveLength(1);
  });

  /*
     The property everything rests on.

     A player looking at odds this bad would stop. The order does not look.
  */
  it('keeps sending them at odds a player would have refused', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    state.org.heat = 100;

    const def = OPERATION_BY_ID[JOB];
    const odds = successBreakdown(
      state,
      def,
      availableCrew(state).slice(0, def.crewRequired),
      where,
    ).total;
    expect(odds, 'the fixture did not actually make the odds bad').toBeLessThan(0.6);

    tickStandingOrders(state);
    expect(
      Object.keys(state.activeOperations).length,
      'the order read the room, which is the one thing it must not do',
    ).toBeGreaterThan(0);
  });

  it('does not send anybody out into the dark', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    // Laying low refuses everything but quiet work, and the order is not
    // quiet — so it pauses on its own rather than needing a rule of its own.
    state.org.layLowUntilDay = state.day + 14;
    tickStandingOrders(state);
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
    expect(liveStanding(state)).toHaveLength(1);
  });
});

/**
 * What repetition costs.
 *
 * The order fires on the same job in the same district a median of 234 times
 * in a 300-day career, and until this existed nothing in the game noticed. Heat
 * registered each night and then decayed; two hundred and thirty-four identical
 * crimes on one block left no trace that they were the same crime.
 *
 * That is what made automation a switch rather than a decision. It was either
 * free or it was a trap, and which one it was never depended on anything the
 * player did. The pattern is the cost that grows with repetition and clears
 * when the order moves, so that "when do I move this?" becomes a question with
 * a right answer that changes.
 *
 * The order still does not read the room. **The player has to.** That is the
 * property this whole module exists to protect, and until now it cost nothing.
 */
describe('the groove it wears', () => {
  /* Somewhere else the player can work, for the half of this that is a map. */
  const elsewhere = 'downtown';

  function fired(state: GameState, times = 1): void {
    for (let n = 0; n < times; n++) {
      tickStandingOrders(state);
      // Bring them home, or the order will not send anybody again.
      for (const npc of crewList(state)) npc.status = 'active';
      state.activeOperations = {};
      state.day += 1;
    }
  }

  /*
     The instrument. A quantity that is never zero cannot be read, and one that
     is always zero is not reading anything.
  */
  it('is nothing at all for somebody who never sets one', () => {
    const state = game();
    expect(patternOn(state, JOB, where)).toBe(0);
    expect(patternDelta(0)).toBe(0);
    expect(patternHeat(0)).toBe(1);
  });

  it('wears in as the order keeps firing', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    expect(patternOn(state, JOB, where)).toBe(0);

    fired(state);
    const once = patternOn(state, JOB, where);
    expect(once).toBeGreaterThan(0);

    fired(state, 5);
    expect(patternOn(state, JOB, where)).toBeGreaterThan(once);
  });

  /*
     Keyed on the pair, which is the whole counterplay.

     A groove is worn in one place by one kind of work. If it followed the job
     everywhere, the only answer would be to stop; keyed on the pair, the answer
     is to go and stand somewhere else, and automation becomes a rotation
     instead of a countdown.
  */
  it('is worn in one place by one kind of work', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    fired(state, 6);

    expect(patternOn(state, JOB, where)).toBeGreaterThan(0);
    expect(patternOn(state, JOB, elsewhere), 'it followed the job to another district').toBe(0);
    expect(patternOn(state, 'boost_cars', where), 'it followed the district to another job').toBe(0);
  });

  /*
     And it does not wash off by taking the order back.

     Calling it off and setting the same one again is one click. If that
     cleared the groove, the mechanic would be a formality.
  */
  it('survives being called off and set again', () => {
    const state = game();
    const order = setStanding(state, JOB, where, 'best')!;
    fired(state, 6);
    const worn = patternOn(state, JOB, where);

    cancelStanding(state, order.id);
    expect(patternOn(state, JOB, where)).toBeCloseTo(worn, 5);

    setStanding(state, JOB, where, 'best');
    expect(patternOn(state, JOB, where)).toBeCloseTo(worn, 5);
  });

  it('fades once nobody is working the pair', () => {
    const state = game();
    const order = setStanding(state, JOB, where, 'best')!;
    fired(state, 10);
    const worn = patternOn(state, JOB, where);
    cancelStanding(state, order.id);

    for (let d = 0; d < 30; d++) advanceDay(state);
    const after = patternOn(state, JOB, where);
    expect(after).toBeLessThan(worn);
    expect(after, 'it went away entirely, so waiting is free').toBeGreaterThan(0);
  });

  /*
     What it costs, in the two places a cost can land.

     Heat carries the weight because heat is where a pattern belongs: street
     heat already feeds case-building through `agencyHeat`, so a grind that runs
     loud enough for long enough opens a file with nothing new plumbed in. The
     odds row exists to make the bill legible at the moment the decision is
     made, which is the whole difference between a cost and an ambush.
  */
  it('costs the odds, and says so where the decision is made', () => {
    const state = game();
    const def = OPERATION_BY_ID[JOB];
    const crew = availableCrew(state).slice(0, def.crewRequired);
    const clean = successBreakdown(state, def, crew, where);
    expect(clean.pattern).toBeCloseTo(0, 10);

    setStanding(state, JOB, where, 'best');
    fired(state, 12);

    const worn = successBreakdown(state, def, availableCrew(state).slice(0, def.crewRequired), where);
    expect(worn.pattern).toBeLessThan(0);
    expect(worn.total).toBeLessThan(clean.total);
  });

  it('costs heat, which is where a pattern belongs', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    fired(state, 12);
    expect(patternHeat(patternOn(state, JOB, where))).toBeGreaterThan(1);
  });

  /*
     And it is charged to anybody working the pair, not only to the order.

     The police are watching the pattern, not reading your minutes. Without
     this, the play is to set an order, let it wear the groove, and hand-run the
     same job past it for nothing.
  */
  it('is charged to the job whoever sent them', () => {
    const state = game();
    setStanding(state, JOB, where, 'best');
    fired(state, 12);

    const def = OPERATION_BY_ID[JOB];
    const byHand = successBreakdown(state, def, availableCrew(state).slice(0, def.crewRequired), where);
    expect(byHand.pattern).toBeLessThan(0);
  });
});

describe('the state it keeps', () => {
  it('is absent until one is set, and does not move the save format', () => {
    const state = game();
    expect(state.standing).toBeUndefined();
    expect(SAVE_VERSION).toBe(13);
    standingList(state);
    expect(state.standing).toEqual([]);
  });

  it('carries no pattern on an order written before patterns existed', () => {
    const state = game();
    const order = setStanding(state, JOB, where, 'best')!;
    delete (order as { pattern?: number }).pattern;
    expect(patternOn(state, JOB, where)).toBe(0);
  });
});
