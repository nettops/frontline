/**
 * Which families are in this particular city.
 *
 * A leaf. Every module in the game asks it what a family is called, so it can
 * import nothing but config.
 *
 * The three faction ids — `falcone`, `vasari`, `kestler` — survive as *slots*
 * rather than as identities. Keeping them means the union type, the bond
 * matrix, the save format and forty call sites all stay exactly as they were,
 * while the organization sitting in each slot is drawn fresh per seed. The
 * alternative was making the id itself dynamic, which is a much larger change
 * and buys nothing the player can see.
 */

import { Rng } from './rng';
import type { Faction, GameState } from './types';
import {
  FOUNDING_JITTER,
  HOUSES,
  HOUSE_GROUPS,
  SEATS,
  type HouseDef,
  type SeatDef,
} from '../config/houses';
import { FACTION_BY_ID, type FactionId, type FactionPersonality } from '../config/factions';

export interface HouseDraw {
  house: HouseDef;
  seat: SeatDef;
}

/**
 * Three houses from three different temperaments, in three different corners.
 *
 * The group constraint is the only rule, and it earns its place: drawing three
 * at random from the ten there were then produced cities where every family
 * was cautious and commercial, and a city where nobody ever moves is not a
 * variation, it is a broken game that happens to be reproducible. The pool has
 * grown since; the rule is what keeps growing it safe.
 */
export function drawHouses(rng: Rng, count: number): HouseDraw[] {
  const groups = rng.sample(HOUSE_GROUPS, Math.min(count, HOUSE_GROUPS.length));
  const seats = rng.sample(SEATS, count);

  return groups.slice(0, count).map((group, i) => {
    // Picked once, outside the find. Inlining `rng.pick` into the predicate
    // re-rolls it against every element of HOUSES, which mostly matches nobody
    // — a fifth of the draws came back with an undefined house.
    const chosen = rng.pick(group);
    return {
      house: HOUSES.find((h) => h.id === chosen)!,
      seat: seats[i],
    };
  });
}

/** Founding figures, wobbled. Nobody starts the same twice. */
export function foundingWealth(rng: Rng, house: HouseDef): number {
  return Math.round(house.wealth * rng.float(FOUNDING_JITTER.wealth[0], FOUNDING_JITTER.wealth[1]));
}

export function foundingStrength(rng: Rng, house: HouseDef): number {
  return Math.round(
    house.strength * rng.float(FOUNDING_JITTER.strength[0], FOUNDING_JITTER.strength[1]),
  );
}

// ------------------------------------------------------------- accessors ---

/**
 * What this slot is called in this game.
 *
 * Falls back to the config definition for two reasons that both matter: the
 * player's own entry has no drawn house, and a handful of tests and the
 * statistical harness build partial states. A name is the last thing that
 * should be able to throw.
 */
function identity(state: GameState, id: FactionId): { name: string; shortName: string; colour: string } {
  const faction = state.factions?.[id] as Faction | undefined;
  if (faction?.shortName) {
    return { name: faction.name, shortName: faction.shortName, colour: faction.colour };
  }
  const def = FACTION_BY_ID[id];
  return { name: def.name, shortName: def.shortName, colour: def.colour };
}

/**
 * The whole identity in one object.
 *
 * Exists so the handful of places that were written around `const def =
 * FACTION_BY_ID[id]` and then read `def.shortName` four times can swap one line
 * instead of four. Same values as the accessors below.
 */
export function houseDef(state: GameState, id: FactionId) {
  return {
    ...identity(state, id),
    blurb: houseBlurb(state, id),
    reputation: houseReputation(state, id),
  };
}

export function houseName(state: GameState, id: FactionId): string {
  return identity(state, id).name;
}

export function houseShort(state: GameState, id: FactionId): string {
  return identity(state, id).shortName;
}

export function houseColour(state: GameState, id: FactionId): string {
  return identity(state, id).colour;
}

export function houseBlurb(state: GameState, id: FactionId): string {
  return state.factions?.[id]?.blurb ?? FACTION_BY_ID[id].blurb;
}

export function houseReputation(state: GameState, id: FactionId): string {
  return state.factions?.[id]?.reputation ?? FACTION_BY_ID[id].reputation;
}

/** The drawn temperament, before the current boss bends it. */
export function housePersonality(state: GameState, id: FactionId): FactionPersonality {
  return state.factions?.[id]?.personality ?? FACTION_BY_ID[id].personality;
}
