/**
 * The gap `frontUpkeepOwed` closed for businesses, closed here for ground:
 * a district held at `control` or better cost nothing to keep, forever,
 * while rivals pay `AI.upkeepPerDistrict` for the same thing. See
 * `DISTRICT_HOLDING_UPKEEP_PER_WEEK` (`config/territories.ts`) for the
 * sizing and the favour-network check.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import {
  controlLevel,
  tickDistrictUpkeep,
  weeklyDistrictUpkeep,
} from '../territory';
import {
  DISTRICT_HOLDING_UPKEEP_PER_WEEK,
  HOME_TERRITORY,
} from '../../config/territories';
import { PAYDAY_INTERVAL } from '../../config/economy';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function funded(seed = 9): GameState {
  const state = newGame({ name: 'Upkeep', difficulty: 'normal', seed });
  state.org.cash = 500_000;
  state.org.dirtyCash = 0;
  return state;
}

function held(state: GameState, id = HOME_TERRITORY): void {
  state.territories[id].influence.player = 60;
  for (const rid of RIVAL_IDS) state.territories[id].influence[rid] = 0;
}

// Same reason pressure.test.ts and frontUpkeep.test.ts step this way: the
// tick is gated on the calendar, and stepping by seven from a day-1 start
// never lands on a payday by accident.
function runWeeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / PAYDAY_INTERVAL) + 1) * PAYDAY_INTERVAL;
    tickDistrictUpkeep(state);
  }
}

describe('district upkeep', () => {
  it('holding no district at control costs nothing', () => {
    const state = funded();
    // A fresh game's home territory starts at presence, not control.
    expect(controlLevel(state.territories[HOME_TERRITORY])).not.toBe('control');
    const before = state.org.cash;
    runWeeks(state, 4);
    expect(state.org.cash).toBe(before);
    expect(state.org.districtUpkeepOwed ?? 0).toBe(0);
  });

  it('charges a flat bill per district actually held', () => {
    const state = funded();
    held(state);
    expect(controlLevel(state.territories[HOME_TERRITORY])).toBe('control');

    expect(weeklyDistrictUpkeep(state)).toBe(DISTRICT_HOLDING_UPKEEP_PER_WEEK);
    const before = state.org.cash + state.org.dirtyCash;
    runWeeks(state, 1);
    expect(state.org.cash + state.org.dirtyCash).toBe(before - DISTRICT_HOLDING_UPKEEP_PER_WEEK);
    expect(state.org.districtUpkeepOwed ?? 0).toBe(0);
  });

  it('carries a shortfall rather than a cliff, and it costs the district influence', () => {
    const state = funded();
    held(state);
    const startInfluence = state.territories[HOME_TERRITORY].influence.player;
    state.org.cash = 0;
    state.org.dirtyCash = 0;

    runWeeks(state, 1);

    expect(
      state.org.districtUpkeepOwed ?? 0,
      'a complete miss should carry the whole bill forward',
    ).toBeGreaterThan(0);
    expect(
      state.territories[HOME_TERRITORY].influence.player,
      'ground nobody paid to hold should not still read full strength',
    ).toBeLessThan(startInfluence);
  });

  it('does not touch a district that is being kept up', () => {
    const state = funded();
    held(state);
    const startInfluence = state.territories[HOME_TERRITORY].influence.player;

    runWeeks(state, 4);

    expect(state.org.districtUpkeepOwed ?? 0).toBe(0);
    expect(state.territories[HOME_TERRITORY].influence.player).toBe(startInfluence);
  });

  it('a save from before this existed loads with nothing owed', () => {
    const state = funded();
    expect(state.org.districtUpkeepOwed).toBeUndefined();
  });
});
