import { describe, expect, it } from 'vitest';
import type { Npc, RoleId } from '../../sim/types';
import { lookFor } from '../art/look';
import { compose, paletteFor, SPRITE_H, SPRITE_W } from '../art/parts';
import { isLit, resolve, tierOf } from '../art/paint';
import { PERCEPTION_TIERS } from '../../config/npcs';

function npc(id: string, over: Partial<Npc> = {}): Npc {
  return {
    id, name: 'Somebody', age: 40, role: 'soldier' as RoleId, familiarity: 50,
    traits: [], secret: null, stats: {} as Npc['stats'], daysInCrew: 0,
    opsCompleted: 0, opsFailed: 0, wage: 100, status: 'available',
    unavailableUntilDay: null, notes: [], goal: null, goalSince: 0, ties: [],
    ...over,
  } as Npc;
}

describe('crew portraits', () => {
  /*
     The property the whole thing rests on. A man has to look the same after a
     reload, and deriving his face must not cost the simulation a random draw —
     sim/rng.ts is a seeded stream with determinism tests over it, and taking a
     roll to pick a hat would shift every subsequent roll in the game.
  */
  it('is a pure function of the npc, stable across calls', () => {
    expect(lookFor(npc('npc-17'))).toEqual(lookFor(npc('npc-17')));
  });

  it('gives different people different looks', () => {
    const looks = new Set(
      Array.from({ length: 40 }, (_, i) => JSON.stringify(lookFor(npc('npc-' + i)))),
    );
    expect(looks.size, 'ids should not collapse onto one appearance').toBeGreaterThan(20);
  });

  it('does not depend on anything that changes while he works for you', () => {
    const before = lookFor(npc('npc-3', { familiarity: 0, opsCompleted: 0, wage: 100 }));
    const after = lookFor(npc('npc-3', { familiarity: 90, opsCompleted: 30, wage: 900 }));
    expect(after).toEqual(before);
  });

  it('reads rank off the kit, so the top of the house is not dressed like the street', () => {
    expect(lookFor(npc('same-id', { role: 'associate' })))
      .not.toEqual(lookFor(npc('same-id', { role: 'underboss' })));
  });

  it('composes to a full sprite grid whoever it is', () => {
    const roles: RoleId[] = ['associate', 'soldier', 'enforcer', 'lieutenant', 'capo', 'consigliere', 'underboss'];
    for (const role of roles) {
      const rows = compose(lookFor(npc('r-' + role, { role })));
      expect(rows).toHaveLength(SPRITE_H);
      rows.forEach((r) => expect(r).toHaveLength(SPRITE_W));
    }
  });

  /* The point of the feature: what you can see is the tier the game already
     uses to decide what it is willing to tell you. */
  it('resolves on the game own perception tiers', () => {
    PERCEPTION_TIERS.forEach((t, i) => expect(tierOf(t.minFamiliarity)).toBe(i));
    expect(isLit(84)).toBe(false);
    expect(isLit(85)).toBe(true);
  });

  it('hides a stranger and shows a man you know', () => {
    const pal = paletteFor(lookFor(npc('npc-9')));
    const distinct = (p: Record<string, string>) => new Set(Object.values(p)).size;
    expect(distinct(resolve(pal, 0)), 'a stranger is a couple of values').toBeLessThan(5);
    expect(distinct(resolve(pal, 90))).toBeGreaterThan(8);
    expect(resolve(pal, 90)).toEqual(pal);
  });
});
