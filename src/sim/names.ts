/**
 * Looking a given name back up in the pools it came from.
 *
 * A leaf. It imports the three name pools and nothing else, and it exists at
 * this level rather than in config/ because config modules must not import one
 * another in a ring — `houses.ts` owns a pool, so a resolver that reads every
 * pool cannot live beside it.
 *
 * WHY A LOOKUP RATHER THAN A FIELD ON THE PERSON
 *
 * Storing the sex on an Npc or a FactionLeader at generation would be the
 * obvious move and is the wrong one here. It is a fact about the *name*, not a
 * fact the simulation ever needs; nothing scores on it, and putting it in the
 * save would mean every person who already exists in somebody's save file is
 * stuck without it. Resolved from the name, a game saved before any of this
 * was written gets its portraits fixed on the next load, and SAVE_VERSION does
 * not move.
 *
 * A name in no pool resolves to null, and the art treats that the way it
 * treated everybody before the flag existed: it does not assert anything.
 */

import { GIVEN_NAMES } from '../config/npcs';
import { LEADER_GIVEN_NAMES } from '../config/factionLeaders';
import { HOUSES } from '../config/houses';
import type { GivenName } from '../config/names';

/**
 * Built once, from every pool anybody is named out of.
 *
 * A name that appears in two pools with two different answers would be a
 * genuine authoring error rather than something to resolve at runtime, so the
 * first pool wins and a test in sim/__tests__/names.test.ts fails the build.
 */
const BY_NAME: Map<string, 'm' | 'f'> = (() => {
  const map = new Map<string, 'm' | 'f'>();
  const add = (pool: readonly GivenName[]) => {
    for (const n of pool) if (!map.has(n.name)) map.set(n.name, n.sex);
  };
  add(GIVEN_NAMES);
  add(LEADER_GIVEN_NAMES);
  for (const house of HOUSES) if (house.firstNames) add(house.firstNames);
  return map;
})();

/** Every pool that feeds the lookup, for the test that checks them for conflicts. */
export const NAME_POOLS: { where: string; pool: readonly GivenName[] }[] = [
  { where: 'config/npcs.ts GIVEN_NAMES', pool: GIVEN_NAMES },
  { where: 'config/factionLeaders.ts LEADER_GIVEN_NAMES', pool: LEADER_GIVEN_NAMES },
  ...HOUSES.filter((h) => h.firstNames).map((h) => ({
    where: `config/houses.ts ${h.id}.firstNames`,
    pool: h.firstNames!,
  })),
];

/**
 * Whether a full name's given part reads as a man's or a woman's.
 *
 * Takes the whole name because that is what the caller has. A nickname sits in
 * quotes in the middle (`Jo "the Nail" Moreno`) and a surname follows, so the
 * first word is the given name in every form the game produces.
 */
export function sexOfName(fullName: string): 'm' | 'f' | null {
  const given = fullName.trim().split(/\s+/)[0];
  return BY_NAME.get(given) ?? null;
}
