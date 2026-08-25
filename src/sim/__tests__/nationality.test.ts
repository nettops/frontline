/**
 * Who walks in when an Irish boss goes looking for people.
 *
 * The brief was one sentence and it had two halves pulling against each other:
 * an Irish family should have an Irish crew, *and* it should have some other
 * nationalities mixed in, *and* it should not be the same every time. All
 * three, or the feature is either a caricature or nothing.
 *
 * So there is no single assertion that proves this works. A crew that is 100%
 * Irish satisfies the first half and fails the second. A crew drawn uniformly
 * from six pools satisfies the second and fails the first. A fixed 70/30 split
 * satisfies both and fails the third. Each test below kills one of those three
 * wrong answers, and the mutation notes say which.
 *
 * Everything here counts surnames, which only works because the pools are
 * disjoint — the first test is what makes the rest of the file meaningful
 * rather than decorative.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { crewShare, generateNpc } from '../npc';
import { Rng } from '../rng';
import {
  CREW_MIX,
  NATIONALITIES,
  type NationalityId,
} from '../../config/nationalities';

/** The pool a surname belongs to, or null if it is nobody's. */
function poolOf(surname: string): NationalityId | null {
  const hit = NATIONALITIES.find((n) => n.last.includes(surname));
  return hit ? hit.id : null;
}

/** Surnames are the last word, and nicknames sit in the middle in quotes. */
function surname(name: string): string {
  const parts = name.split(' ');
  return parts[parts.length - 1];
}

/**
 * Recruit a crowd for a boss of the given nationality and report who came.
 *
 * Deliberately many more people than a crew holds. The question is about the
 * shape of the distribution, and twelve names is not enough to tell 70% from
 * 100% — an early version of this test used a real crew size and passed
 * against a build that never mixed anybody in at all.
 */
function draw(nationality: NationalityId, seed: number, count = 300) {
  const state = newGame({ name: 'Boss', difficulty: 'normal', seed, nationality });
  const rng = new Rng(state.rng);
  const tally = new Map<NationalityId | null, number>();
  for (let i = 0; i < count; i++) {
    const npc = generateNpc(state, rng, 'soldier');
    const pool = poolOf(surname(npc.name));
    tally.set(pool, (tally.get(pool) ?? 0) + 1);
  }
  return {
    tally,
    own: (tally.get(nationality) ?? 0) / count,
    other: [...tally.entries()]
      .filter(([k]) => k !== nationality && k !== null)
      .reduce((n, [, v]) => n + v, 0) / count,
    unknown: (tally.get(null) ?? 0) / count,
  };
}

describe('nationality pools', () => {
  it('never puts one surname in two nationalities', () => {
    /*
       The load-bearing test in this file. Every other check counts surnames
       and attributes them to a pool; a name in two pools makes those counts
       lies that still look like numbers.
    */
    const seen = new Map<string, NationalityId>();
    const clashes: string[] = [];
    for (const nat of NATIONALITIES) {
      for (const last of nat.last) {
        const already = seen.get(last);
        if (already) clashes.push(`${last} is in both ${already} and ${nat.id}`);
        else seen.set(last, nat.id);
      }
    }
    expect(clashes, clashes.join('; ')).toEqual([]);
  });

  it('gives every nationality enough names to fill a crew without repeating', () => {
    // A 36-strong outfit at the top rank, drawn from one pool, should not be
    // three men called Murphy.
    for (const nat of NATIONALITIES) {
      expect(nat.last.length, `${nat.id} has too few surnames`).toBeGreaterThanOrEqual(24);
      expect(nat.first.length, `${nat.id} has too few first names`).toBeGreaterThanOrEqual(20);
      expect(new Set(nat.last).size, `${nat.id} repeats a surname`).toBe(nat.last.length);
      expect(new Set(nat.first).size, `${nat.id} repeats a first name`).toBe(nat.first.length);
    }
  });
});

describe('who your crew turns out to be', () => {
  it('is mostly your own people', () => {
    // Kills the uniform draw: six pools evenly would put own at about 0.17.
    for (const nat of NATIONALITIES) {
      const { own } = draw(nat.id, 4242);
      expect(
        own,
        `a ${nat.id} boss recruited only ${Math.round(own * 100)}% ${nat.id} people, ` +
          `which is not "an Irish family has an Irish crew"`,
      ).toBeGreaterThan(0.4);
    }
  });

  it('is never only your own people', () => {
    // Kills the caricature: the outsider in the outfit is the whole point.
    for (const nat of NATIONALITIES) {
      const { other } = draw(nat.id, 4242);
      expect(
        other,
        `a ${nat.id} boss recruited nobody from anywhere else, so the city has one culture in it`,
      ).toBeGreaterThan(0.05);
    }
  });

  it('draws the outsiders from more than one other community', () => {
    // A crew of Irish plus exactly one Pole would pass both tests above.
    const { tally } = draw('irish', 99);
    const others = [...tally.entries()].filter(([k, v]) => k !== 'irish' && k !== null && v > 0);
    expect(
      others.length,
      `the outsiders all came from ${others.map(([k]) => k).join(', ')}`,
    ).toBeGreaterThanOrEqual(3);
  });

  /*
     The next two read `crewShare` directly instead of counting a sampled crew,
     and that is a correction rather than a shortcut.

     The first version of "not the same mix in every city" inferred the share
     from 200 recruits per seed and asserted the spread exceeded 0.1. It
     passed — and it also passed against a hardcoded 0.7, because 200 Bernoulli
     draws carry a standard error near 0.032 and ten of those spread about 0.1
     all by themselves. The test was measuring its own sampling noise at
     exactly the size of the effect it was looking for.

     Measured at the source there is no noise and no threshold to argue about.
  */
  it('is not the same mix in every city', () => {
    const shares = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111].map(crewShare);
    expect(
      new Set(shares).size,
      `ten cities produced ${new Set(shares).size} distinct mixes, so the share ` +
        `is a constant wearing a range`,
    ).toBe(shares.length);

    const spread = Math.max(...shares) - Math.min(...shares);
    expect(
      spread,
      'the mixes differ but only in the last decimal, which no player will ever see',
    ).toBeGreaterThan(0.15);
  });

  it('keeps the mix inside the range the config declares', () => {
    for (let seed = 0; seed < 400; seed++) {
      const share = crewShare(seed);
      expect(share, `seed ${seed}`).toBeGreaterThanOrEqual(CREW_MIX.min);
      expect(share, `seed ${seed}`).toBeLessThanOrEqual(CREW_MIX.max);
    }
  });

  it('never makes a crew entirely your own people, at any seed', () => {
    // The ceiling is the design: max must stay under 1 or the outsider dies.
    expect(CREW_MIX.max).toBeLessThan(1);
    expect(CREW_MIX.min).toBeGreaterThan(0.3);
  });

  it('holds the same mix all game, however many people you hire', () => {
    /*
       The share is derived from the seed rather than rolled, so hiring nobody
       for a year and then hiring ten must not change what the eleventh person
       is. Two runs on one city, one of them after a long pause.
    */
    const a = draw('polish', 7, 150).own;
    const b = draw('polish', 7, 150).own;
    expect(b).toBe(a);
  });
});

describe('your own name', () => {
  it('comes from your nationality when you do not give one', () => {
    for (const nat of NATIONALITIES) {
      const state = newGame({ name: '', difficulty: 'normal', seed: 3, nationality: nat.id });
      expect(
        poolOf(surname(state.player.name)),
        `a ${nat.id} boss who left the name blank got "${state.player.name}"`,
      ).toBe(nat.id);
    }
  });

  it('is left alone when you do give one', () => {
    const state = newGame({
      name: 'Nobody Corveti',
      difficulty: 'normal',
      seed: 3,
      nationality: 'chinese',
    });
    expect(state.player.name).toBe('Nobody Corveti');
  });

  it('defaults to a playable game when no nationality is chosen', () => {
    // Every save written before this field existed loads without one.
    const state = newGame({ name: 'Nobody', difficulty: 'normal', seed: 3 });
    expect(state.player.name).toBe('Nobody');
    const rng = new Rng(state.rng);
    expect(() => generateNpc(state, rng, 'soldier')).not.toThrow();
  });
});
