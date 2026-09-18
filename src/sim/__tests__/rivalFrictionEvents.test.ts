import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { EVENT_DEF_BY_ID } from '../events';
import { setRelationship } from '../diplomacy';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function fresh(seed = 909): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

describe('Rival border friction events', () => {
  it('triggers rival_incursion across adjacent border districts past day 90', () => {
    const state = fresh();
    state.day = 95;
    const rng = new Rng({ seed: 1, calls: 0 });

    const incursionDef = EVENT_DEF_BY_ID['rival_incursion'];
    expect(incursionDef).toBeDefined();

    // With default fresh state, player has Little Sicily, rivals have their starting spots.
    // Little Sicily is adjacent to Old Quarter, Riverside, The Docks.
    // Set vasari in the_docks
    state.territories['the_docks'].influence['vasari'] = 60;
    state.territories['little_sicily'].influence['player'] = 50;
    state.territories['little_sicily'].influence['vasari'] = 0;
    // Set relationship to chilly/hostile
    setRelationship(state, 'vasari', 'player', 0);

    const result = incursionDef.applies(state, rng);
    expect(result).not.toBeNull();
    expect(result?.faction).toBeDefined();
    expect(RIVAL_IDS).toContain(result!.faction!.id);
    expect(result?.territory).toBeDefined();
  });

  it('triggers rival_overture across adjacent border districts past day 75', () => {
    const state = fresh();
    state.day = 80;
    const rng = new Rng({ seed: 1, calls: 0 });

    const overtureDef = EVENT_DEF_BY_ID['rival_overture'];
    expect(overtureDef).toBeDefined();

    state.territories['the_docks'].influence['vasari'] = 60;
    state.territories['little_sicily'].influence['player'] = 50;
    state.territories['little_sicily'].influence['vasari'] = 0;
    // Friendly/neutral relationship
    setRelationship(state, 'vasari', 'player', 10);

    const result = overtureDef.applies(state, rng);
    expect(result).not.toBeNull();
    expect(result?.faction).toBeDefined();
    expect(RIVAL_IDS).toContain(result!.faction!.id);
  });
});
