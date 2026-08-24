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
 */

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
const BARE: CrewLook['hair_style'][] = ['slick', 'slick', 'bald', 'balding', 'bun', 'bob'];

export function lookFor(npc: Npc): CrewLook {
  const kit = BY_ROLE[npc.role];
  const hat = pick(npc.id, 'hat', kit.hats);

  /*
     Hair style, when there is no hat, is drawn from one list for everybody.
     The Npc has no field for sex and the name lists are mixed, so inferring
     one from a name would be the art asserting something the simulation does
     not know. It draws from the hash instead.
  */
  const hair_style: CrewLook['hair_style'] =
    hat !== 'none' ? 'none'
      : npc.age >= 55 && chance(npc.id, 'thin', 0.45) ? 'balding'
      : pick(npc.id, 'style', BARE);

  const facial: CrewLook['facial'] =
    hair_style === 'bun' || hair_style === 'bob' ? 'none' : pick(npc.id, 'face', FACIAL);

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
