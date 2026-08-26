/**
 * What a given person looks like — derived, never stored.
 *
 * A crew member's portrait has to be the same man across a reload, a save and
 * a session, and it must not cost the simulation anything. So the look is a
 * pure function of fields that already exist on the Npc, hashed here rather
 * than drawn from the simulation's RNG.
 *
 * That last point is not a style choice. `sim/rng.ts` is a seeded stream and
 * the suite has determinism tests over it; taking a draw to decide a hat would
 * shift every subsequent roll in the game and break all of them. Nothing in
 * this file touches state.
 *
 * One thing is read rather than hashed: whether the name reads as a man's or a
 * woman's. That is carried by the name pools themselves (config/names.ts) and
 * resolved by sim/names.ts, and it decides facial hair and which bare-headed
 * silhouettes are available. A name in no pool resolves to nothing and is
 * drawn the way everybody was drawn before the flag existed.
 */

import { sexOfName } from '../../sim/names';
import type { Npc, RoleId } from '../../sim/types';
import type { CrewLook } from './parts';

/** FNV-1a. Small, stable, and not the simulation's business. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable draw from one id: different salts give independent choices. */
function pick<T>(id: string, salt: string, from: readonly T[]): T {
  return from[hash(id + ':' + salt) % from.length];
}
const chance = (id: string, salt: string, p: number) =>
  (hash(id + ':' + salt) % 1000) / 1000 < p;

/**
 * Role decides the kit, because rank is the one thing about a man the player
 * is always allowed to see. The cloth gets deeper up the ladder; that gradient
 * is most of what makes the roster legible at a glance.
 */
const BY_ROLE: Record<RoleId, {
  hats: CrewLook['hat'][];
  garments: CrewLook['garment'][];
  builds: CrewLook['build'][];
  suits: string[];
  shirts: string[];
  ties: string[];
}> = {
  associate:    { hats: ['flatcap', 'none'], garments: ['open', 'roll'], builds: ['slim', 'regular'],
                  suits: ['bone', 'olive'], shirts: ['grey', 'cream'], ties: ['deep'] },
  soldier:      { hats: ['flatcap', 'none'], garments: ['open', 'roll'], builds: ['slim', 'regular', 'heavy'],
                  suits: ['olive', 'brown'], shirts: ['grey', 'white'], ties: ['deep', 'olive'] },
  enforcer:     { hats: ['none', 'flatcap'], garments: ['roll', 'open'], builds: ['heavy', 'heavy', 'regular'],
                  suits: ['charcoal', 'olive'], shirts: ['grey'], ties: ['deep'] },
  lieutenant:   { hats: ['fedora', 'flatcap'], garments: ['tie', 'open'], builds: ['regular', 'heavy'],
                  suits: ['brown', 'charcoal'], shirts: ['white', 'cream'], ties: ['blood', 'olive'] },
  capo:         { hats: ['fedora', 'homburg'], garments: ['tie', 'vest'], builds: ['regular', 'heavy'],
                  suits: ['charcoal', 'brown', 'navy'], shirts: ['white'], ties: ['blood', 'deep', 'brass'] },
  consigliere:  { hats: ['homburg', 'none'], garments: ['tie'], builds: ['slim', 'regular'],
                  suits: ['charcoal', 'navy'], shirts: ['white', 'cream'], ties: ['carbon', 'deep'] },
  underboss:    { hats: ['homburg', 'fedora'], garments: ['vest', 'tie'], builds: ['heavy', 'regular'],
                  suits: ['navy', 'charcoal'], shirts: ['white'], ties: ['brass', 'blood'] },
};

/** Age shows in the hair before it shows anywhere else. */
function hairFor(npc: Npc): string {
  if (npc.age >= 64) return chance(npc.id, 'grey', 0.5) ? 'white' : 'grey';
  if (npc.age >= 52) return chance(npc.id, 'grey', 0.6) ? 'pepper' : 'grey';
  if (npc.age >= 40) return chance(npc.id, 'grey', 0.35) ? 'pepper' : pick(npc.id, 'hair', ['black', 'brown']);
  return pick(npc.id, 'hair', ['black', 'brown', 'black']);
}

const SKINS = ['deep', 'brown', 'olive', 'tan', 'fair'] as const;
const FACIAL: CrewLook['facial'][] = ['none', 'none', 'tache', 'stubble', 'goatee', 'walrus', 'chops', 'beard'];

/*
   Bare-headed silhouettes, by what the name says.

   This was one list for everybody, and the comment below `lookFor` explained
   why: the Npc has no field for sex, so choosing would have been the art
   asserting something the simulation did not know. That was right about the
   principle and wrong about where it led — refusing to decide put walrus
   moustaches on women at the same rate as on men, which asserts a great deal
   more than deciding would have.

   The pools carry the fact now. config/npcs.ts was already thirty-two men's
   names followed by sixteen women's; the split was real and only the ordering
   recorded it. See config/names.ts for what that flag is and is not for.
*/
const BARE_M: CrewLook['hair_style'][] = ['slick', 'slick', 'bald', 'balding'];
const BARE_F: CrewLook['hair_style'][] = ['bun', 'bob', 'slick', 'bun'];
const BARE_ANY: CrewLook['hair_style'][] = ['slick', 'slick', 'bob'];

export function lookFor(npc: Npc): CrewLook {
  const kit = BY_ROLE[npc.role];
  const hat = pick(npc.id, 'hat', kit.hats);

  /*
     Read off the name, not guessed from it, and not stored on the person.
     config/names.ts is the flag; sim/names.ts is the lookup, and a name in no
     pool comes back null and gets the neutral treatment — which is exactly
     what everybody got before the flag existed.
  */
  const sex = sexOfName(npc.name);
  const bare = sex === 'm' ? BARE_M : sex === 'f' ? BARE_F : BARE_ANY;

  const hair_style: CrewLook['hair_style'] =
    hat !== 'none' ? 'none'
      : sex === 'm' && npc.age >= 55 && chance(npc.id, 'thin', 0.45) ? 'balding'
      : pick(npc.id, 'style', bare);

  const facial: CrewLook['facial'] =
    sex === 'm' ? pick(npc.id, 'face', FACIAL) : 'none';

  return {
    build: pick(npc.id, 'build', kit.builds),
    hat,
    hair_style,
    facial,
    garment: pick(npc.id, 'wear', kit.garments),
    // Only the top of the house is drawn holding anything.
    prop: npc.role === 'underboss' && chance(npc.id, 'prop', 0.5) ? 'cigar'
      : npc.role === 'consigliere' && chance(npc.id, 'prop', 0.6) ? 'glasses'
      : chance(npc.id, 'prop2', 0.12) ? 'scar' : 'none',
    skin: pick(npc.id, 'skin', SKINS),
    suit: pick(npc.id, 'suit', kit.suits),
    hair: hairFor(npc),
    shirt: pick(npc.id, 'shirt', kit.shirts),
    tie: pick(npc.id, 'tie', kit.ties),
    felt: pick(npc.id, 'felt', ['black', 'brown', 'ash']),
  };
}
