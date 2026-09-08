/**
 * The city's weather, and the one thing a boss can do about it.
 *
 * Nine world conditions, each with real effects across payouts, odds, heat,
 * front revenue and how readily the other families move — and every one of them
 * arrived with a single button:
 *
 *     { id: 'acknowledge', label: 'Note it',
 *       hint: 'Nothing to decide. Only to work around' }
 *
 * That is honest about most weather and wrong about some of it. Round 17's
 * three scorers all reported the late game as having nothing left to decide,
 * at days 120, 130 and 180, and the largest events in the game were the
 * clearest case: they arrive, they cost you for weeks, and nothing is asked of
 * you.
 *
 * `endEarly` is on the five a boss could actually reach and absent on the four
 * he could not — a recession is not bought off, and a good summer does not want
 * ending. The guards below are about that split, about the price never being
 * clickable when it cannot be paid, and about the clearing living in one place.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { endConditionEarly, activeCondition } from '../world';
import { totalFunds } from '../economy';
import { resolveEvent } from '../events';
import { tickWorld } from '../world';
import { WORLD_CONDITIONS, WORLD_CONDITION_BY_ID, CONDITION_GAP_DAYS } from '../../config/world';
import type { GameState } from '../types';

function game(seed = 5): GameState {
  const state = newGame({ name: 'Weather', difficulty: 'normal', seed });
  state.org.cash = 500_000;
  return state;
}

/** Put a named condition on the city without waiting for the dice. */
function impose(state: GameState, id: string): void {
  state.world.conditionId = id;
  state.world.startedDay = state.day;
  state.world.endsDay = state.day + 30;
}

describe('which weather can be answered', () => {
  it('is some of it and not all of it', () => {
    const answerable = WORLD_CONDITIONS.filter((c) => c.endEarly).map((c) => c.id);
    expect(answerable.length, 'nothing can be answered, so nothing changed').toBeGreaterThan(0);
    expect(
      answerable.length,
      'everything can be bought off, which makes the weather a shop',
    ).toBeLessThan(WORLD_CONDITIONS.length);
  });

  /**
   * The ones that must stay unanswerable, named rather than counted. A boss who
   * can buy his way out of a recession is a boss the economy cannot touch.
   */
  it('leaves the weather that is only weather alone', () => {
    for (const id of ['recession', 'boom', 'quiet_summer']) {
      expect(WORLD_CONDITION_BY_ID[id]?.endEarly, `${id} can be bought off`).toBeUndefined();
    }
  });

  it('asks a real price for the ones that can', () => {
    for (const c of WORLD_CONDITIONS) {
      if (!c.endEarly) continue;
      expect(c.endEarly.cost, `${c.id} is free`).toBeGreaterThan(5_000);
      expect(c.endEarly.label.length).toBeGreaterThan(4);
      expect(c.endEarly.hint.length).toBeGreaterThan(10);
    }
  });
});

describe('buying it out', () => {
  const answerable = WORLD_CONDITIONS.find((c) => c.endEarly)!;

  it('ends it today and takes the money', () => {
    const state = game();
    impose(state, answerable.id);
    const before = totalFunds(state);

    expect(endConditionEarly(state)).toBe(true);
    expect(activeCondition(state), 'the condition is still running').toBeNull();
    expect(totalFunds(state)).toBeLessThan(before);
  });

  /**
   * And does not buy the right to have the next one arrive sooner. `tickWorld`
   * gates on `CONDITION_GAP_DAYS` since the last one ended, and paying stamps
   * that day like any other ending.
   */
  it('does not shorten the quiet after it', () => {
    const state = game();
    impose(state, answerable.id);
    endConditionEarly(state);
    expect(state.world.lastEndedDay).toBe(state.day);

    // Nothing new inside the gap, however the dice fall.
    for (let i = 0; i < CONDITION_GAP_DAYS - 1; i++) {
      state.day += 1;
      tickWorld(state, new Rng({ seed: 9, calls: i }));
    }
    expect(activeCondition(state)).toBeNull();
  });

  it('refuses when the money is not there, and changes nothing', () => {
    const state = game();
    state.org.cash = 10;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;
    impose(state, answerable.id);

    expect(endConditionEarly(state)).toBe(false);
    expect(activeCondition(state)?.id, 'it ended anyway').toBe(answerable.id);
  });

  it('does nothing when the weather cannot be answered', () => {
    const state = game();
    const plain = WORLD_CONDITIONS.find((c) => !c.endEarly)!;
    impose(state, plain.id);
    expect(endConditionEarly(state)).toBe(false);
    expect(activeCondition(state)?.id).toBe(plain.id);
  });

  it('does nothing when there is no weather at all', () => {
    const state = game();
    state.world.conditionId = null;
    expect(endConditionEarly(state)).toBe(false);
  });

  /** And the memo's own button reaches it. */
  it('is what the memo does when you press it', () => {
    const state = game();
    impose(state, answerable.id);
    const before = totalFunds(state);
    state.pendingEvents.push({
      id: 'ev_test',
      day: state.day,
      defId: 'world_condition',
      title: 'x',
      body: 'x',
      severity: 'warning',
      npcId: null,
      data: { conditionId: answerable.id },
      choices: [{ id: 'end_early', label: 'x', hint: 'x' }],
    });
    resolveEvent(state, new Rng({ seed: 2, calls: 0 }), 'ev_test', 'end_early');

    expect(activeCondition(state)).toBeNull();
    expect(totalFunds(state)).toBeLessThan(before);
  });
});
