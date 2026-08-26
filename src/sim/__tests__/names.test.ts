/**
 * The name pools, and the one fact they carry.
 *
 * config/names.ts explains what the flag is for. These are the checks that
 * keep it true: that it stayed derived rather than hand-maintained (so no
 * draw moved when it was added), that no name is flagged two ways in two
 * pools, and that every name a person can actually be given resolves.
 */

import { describe, expect, it } from 'vitest';

import { FIRST_NAMES, GIVEN_NAMES, LAST_NAMES } from '../../config/npcs';
import { LEADER_FIRST_NAMES, LEADER_GIVEN_NAMES } from '../../config/factionLeaders';
import { namesOf } from '../../config/names';
import { NAME_POOLS, sexOfName } from '../names';
import { newGame } from '../state';
import { RIVAL_IDS } from '../../config/factions';
import { runDaysSolvent } from './helpers';

describe('the name pools', () => {
  /*
     The flag was added to pools every consumer draws from with `rng.pick`,
     which is one call on the seeded stream whatever the list looks like — but
     only if the list is the same list. Deriving the flat array rather than
     maintaining a second copy is what makes that guaranteed instead of
     merely intended, and this is the check that it stayed derived.
  */
  it('draws from the same names in the same order as before the flag', () => {
    expect(FIRST_NAMES).toEqual(namesOf(GIVEN_NAMES));
    expect(LEADER_FIRST_NAMES).toEqual(namesOf(LEADER_GIVEN_NAMES));
    expect(FIRST_NAMES).toHaveLength(48);
    expect(LEADER_FIRST_NAMES).toHaveLength(20);
  });

  it('flags every name exactly one way, everywhere it appears', () => {
    const seen = new Map<string, { sex: string; where: string }>();
    for (const { where, pool } of NAME_POOLS) {
      for (const n of pool) {
        const prior = seen.get(n.name);
        expect(
          prior === undefined || prior.sex === n.sex,
          `"${n.name}" is ${prior?.sex} in ${prior?.where} and ${n.sex} in ${where}`,
        ).toBe(true);
        seen.set(n.name, { sex: n.sex, where });
      }
    }
    expect(seen.size).toBeGreaterThan(60);
  });

  it('has no name in a pool twice', () => {
    for (const { where, pool } of NAME_POOLS) {
      const names = pool.map((n) => n.name);
      expect(new Set(names).size, `${where} repeats a name`).toBe(names.length);
    }
  });

  it('keeps both kinds in every pool', () => {
    // A pool that ended up all one way would quietly make a whole family, or
    // the whole crew, one sex — which is a content decision, not a side effect.
    for (const { where, pool } of NAME_POOLS) {
      const men = pool.filter((n) => n.sex === 'm').length;
      expect(men, `${where} is all women`).toBeGreaterThan(0);
      expect(pool.length - men, `${where} is all men`).toBeGreaterThan(0);
    }
  });
});

describe('resolving a name', () => {
  it('reads the given name out of a full one, in every shape the game builds', () => {
    expect(sexOfName('Vincent Ricci')).toBe('m');
    expect(sexOfName('Maria Ricci')).toBe('f');
    // The nickname form: `Jo "the Nail" Moreno`.
    expect(sexOfName('Jo "the Nail" Moreno')).toBe('f');
    expect(sexOfName('Sal "Cufflinks" Vitale')).toBe('m');
  });

  it('covers the house pools as well as the crew and leader ones', () => {
    expect(sexOfName('Yolande Beauvais')).toBe('f');
    expect(sexOfName('Dieudonné Beauvais')).toBe('m');
    expect(sexOfName('Icilda Rowe')).toBe('f');
    expect(sexOfName('Winston Rowe')).toBe('m');
  });

  /*
     The graceful failure, and it has to stay graceful. A save written before
     any of this existed, or a name pool somebody edits later, produces names
     the map has never heard of. Those are drawn the way everybody was drawn
     before the flag: nothing asserted.
  */
  it('says nothing about a name it does not know', () => {
    expect(sexOfName('Zephaniah Quill')).toBeNull();
    expect(sexOfName('')).toBeNull();
    // A surname is not a given name, even one that is also somebody's first.
    expect(LAST_NAMES).toContain('Salvatore');
    expect(sexOfName('Ricci Salvatore')).toBeNull();
  });
});

describe('everybody the game actually names', () => {
  /*
     The end-to-end version, and the one that would catch a pool being added
     without being registered in sim/names.ts. Runs a real game so that the
     crew, the recruits, the rival bosses and their capos are all people the
     simulation made rather than people this test made up.
  */
  it('can resolve every person a played game produces', () => {
    const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed: 4242 });
    runDaysSolvent(state, 240);

    const names: string[] = [];
    for (const npc of Object.values(state.npcs)) names.push(npc.name);
    for (const npc of Object.values(state.recruits)) names.push(npc.name);
    for (const id of RIVAL_IDS) {
      const f = state.factions[id];
      if (f.leader) names.push(f.leader.name);
      for (const capo of f.capos ?? []) names.push(capo.name);
    }

    expect(names.length, 'the game produced nobody to check').toBeGreaterThan(8);
    const unknown = names.filter((n) => sexOfName(n) === null);
    expect(unknown, `unresolved: ${unknown.join(', ')}`).toEqual([]);
  });
});
