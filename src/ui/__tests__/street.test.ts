/**
 * The street is a pure reading of state — like the briefing and the board,
 * never saved, deciding nothing, and never touching the seeded RNG. These
 * tests pin the two properties that make it trustworthy: every drawn fact
 * appears exactly when its state exists, and provably not before — the leak
 * test matters more than the presence test, because a street that shows an
 * unmarked car with no case behind it is lying about the law.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/state';
import type { GameState } from '../../sim/types';
import { HOME_TERRITORY } from '../../config/territories';
import { streetLook } from '../streetLook';

function fresh(seed = 5): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

describe('the street', () => {
  it('starts honest: no unmarked, no shell, no truck, people out', () => {
    const look = streetLook(fresh());
    expect(look.unmarked).toBe(false);
    expect(look.shell).toBe(false);
    expect(look.truck).toBe(false);
    expect(look.crates).toBe(0);
    expect(look.peds).toBeGreaterThan(0);
    expect(look.car).toBeNull();
  });

  it('is deterministic and does not consume the seeded stream', () => {
    const state = fresh();
    const before = JSON.stringify({ seed: state.rng, day: state.day });
    const a = streetLook(state);
    const b = streetLook(state);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify({ seed: state.rng, day: state.day })).toBe(before);
  });

  it('parks the unmarked only once a case reaches a stage the street can see', () => {
    const state = fresh();
    state.law.investigations['c1'] = {
      id: 'c1',
      agencyId: 'city_police',
      stage: 'suspicion',
      stageSince: state.day,
      status: 'open',
      openedDay: state.day,
      strength: 5,
      evidenceIds: [],
    } as never;
    // Suspicion is a file, not a car on the street.
    expect(streetLook(state).unmarked).toBe(false);
    (state.law.investigations['c1'] as never as { stage: string }).stage = 'surveillance';
    expect(streetLook(state).unmarked).toBe(true);
  });

  it('shows the war and empties the pavement and the road', () => {
    const state = fresh();
    state.factions.falcone!.bonds.player.warSince = state.day - 7;
    const look = streetLook(state);
    expect(look.shell).toBe(true);
    expect(look.peds).toBe(0);
    expect(look.traffic).toBe(0);
  });

  it('keeps traffic moving on an ordinary day', () => {
    // Traffic is the prosperity band wearing wheels — a second telling,
    // like everything else here, and never zero while the district lives.
    expect(streetLook(fresh()).traffic).toBeGreaterThan(0);
  });

  it('parks the best car you actually hold, and none you do not', () => {
    const state = fresh();
    state.possessions = [
      { id: 'p1', defId: 'sedan', boughtDay: 1, paid: 1, status: 'held' },
      { id: 'p2', defId: 'roadster', boughtDay: 1, paid: 1, status: 'lost' },
    ] as never;
    expect(streetLook(state).car).toBe('sedan');
    (state.possessions![1] as never as { status: string }).status = 'held';
    expect(streetLook(state).car).toBe('wedge');
  });

  it('backs the truck up only when the trade actually runs through here', () => {
    const state = fresh();
    expect(streetLook(state).truck).toBe(false);
    state.contraband.routes.product = [HOME_TERRITORY];
    state.contraband.stock.product = 11;
    const look = streetLook(state);
    expect(look.truck).toBe(true);
    expect(look.crates).toBeGreaterThan(0);
  });

  it('puts your fronts on the street in their own state', () => {
    const state = fresh();
    state.businesses['b1'] = {
      id: 'b1',
      defId: 'laundromat',
      territoryId: HOME_TERRITORY,
      purchasedDay: 1,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 80,
      status: 'operating',
    } as never;
    const look = streetLook(state);
    const mine = look.fronts.find((f) => f.id === 'laundromat' && f.yours);
    expect(mine).toBeDefined();
    expect(mine!.state).toBe('trading');
    (state.businesses['b1'] as never as { status: string }).status = 'shuttered';
    expect(
      streetLook(state).fronts.find((f) => f.id === 'laundromat' && f.yours)!.state,
    ).toBe('shut');
  });
});
