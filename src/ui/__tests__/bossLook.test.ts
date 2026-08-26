import { describe, expect, it } from 'vitest';

import { HOUSES } from '../../config/houses';
import { RIVAL_IDS } from '../../config/factions';
import { newGame } from '../../sim/state';
import { accentOf, bossSpecFor, LIGHTS, styleFor, WARDROBES } from '../art/bossLook';
import { BOSS_H, BOSS_W, renderBoss, type BossSpec } from '../art/bossPortrait';
import type { Faction } from '../../sim/types';

/** A faction carrying one house's identity, which is all the art reads. */
function asFaction(houseIndex: number, leaderName: string, age = 50): Faction {
  const h = HOUSES[houseIndex];
  return {
    id: 'falcone', name: h.name, shortName: h.shortName, colour: h.colour,
    blurb: h.blurb, reputation: h.reputation, personality: h.personality,
    wealth: h.wealth, strength: h.strength, heat: 0, bonds: {}, warWeariness: 0,
    businessCount: 0, capos: [], suspicions: [], currentObjective: null,
    agenda: null, history: [],
    leader: {
      name: leaderName, age, since: 0, reputation: '',
      bias: { aggression: 0, ambition: 0, commerce: 0, caution: 0 },
    },
  } as unknown as Faction;
}
const byId = (id: string) => HOUSES.findIndex((h) => h.id === id);

describe('which room a house is drawn in', () => {
  it('gives every house in the pool a light and a wardrobe', () => {
    for (const h of HOUSES) {
      const { light, kit } = styleFor(h.personality);
      expect(light, `${h.id} has no light`).toBeTruthy();
      expect(kit, `${h.id} has no wardrobe`).toBeTruthy();
      expect(Object.values(LIGHTS)).toContain(light);
      expect(Object.values(WARDROBES)).toContain(kit);
    }
  });

  /*
     The bug this is here to stop coming back.

     Scored on the raw trait values the four sums were not on comparable
     scales — `office` adds two traits that sit near 1 and `street` subtracts
     two of them — so office beat everything and nine of the twelve houses
     were drawn in the same room. It looked fine one portrait at a time and
     only showed up laid out side by side. Centring the traits fixed it, and
     nothing about that fix announces itself if somebody later re-tunes a
     personality in config/houses.ts.
  */
  it('does not put most of the pool in one room', () => {
    const rooms = new Set(HOUSES.map((h) => styleFor(h.personality).light.id));
    expect(rooms.size, `only ${[...rooms]} used`).toBeGreaterThanOrEqual(3);

    const counts = new Map<string, number>();
    for (const h of HOUSES) {
      const id = styleFor(h.personality).light.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const worst = Math.max(...counts.values());
    expect(worst, 'one room is taking most of the pool').toBeLessThanOrEqual(
      Math.ceil(HOUSES.length / 2),
    );
  });

  /*
     The claim the whole design rests on: the room is a readout of how the
     family plays, not decoration. These four are the least ambiguous houses
     in the file, and each one's blurb says where it belongs.
  */
  it('puts a house in the room its own description implies', () => {
    // "They are not careful and it has not cost them yet."
    expect(styleFor(HOUSES[byId('kestler')].personality).light.id).toBe('street');
    // "Lawyers, permits and a great many entirely legitimate companies."
    expect(styleFor(HOUSES[byId('moreau')].personality).light.id).toBe('office');
    // "A great house on the way down."
    expect(styleFor(HOUSES[byId('castellan')].personality).light.id).toBe('backroom');
    // "They do not think in streets."
    expect(styleFor(HOUSES[byId('rowe')].personality).light.id).toBe('quay');
  });

  it('reads the personality and nothing else about the house', () => {
    const a = HOUSES[byId('beauvais')];
    const twin = { ...a, id: 'x', name: 'Z', shortName: 'Z', colour: '#ffffff' };
    expect(styleFor(twin.personality).light.id).toBe(styleFor(a.personality).light.id);
  });
});

describe('which man is drawn', () => {
  it('is stable for the same boss and different for the next one', () => {
    const i = byId('beauvais');
    expect(bossSpecFor(asFaction(i, 'Yolande Beauvais')))
      .toEqual(bossSpecFor(asFaction(i, 'Yolande Beauvais')));
    expect(bossSpecFor(asFaction(i, 'Yolande Beauvais')))
      .not.toEqual(bossSpecFor(asFaction(i, 'Wilner Beauvais')));
  });

  it('gives a succession a genuinely new face, not a recolour', () => {
    const i = byId('falcone');
    const faces = new Set(
      ['Aldo', 'Bruno', 'Cesare', 'Dario', 'Emilio', 'Fabio', 'Guido', 'Ilario']
        .map((n) => JSON.stringify(bossSpecFor(asFaction(i, `${n} Falcone`)))),
    );
    expect(faces.size, 'successions collapsed onto one look').toBeGreaterThanOrEqual(6);
  });

  it('has nobody to draw when the house is between bosses', () => {
    const f = asFaction(0, 'x');
    (f as { leader: unknown }).leader = null;
    expect(bossSpecFor(f)).toBeNull();
  });

  /*
     config/houses.ts: "A house is written as a way of doing business, never as
     a nationality with a temperament attached." If the art encoded identity
     per house that line would be false, so: two houses with the same
     personality and the same boss must produce the same man. Only the light,
     the kit and the accent colour may differ between families.
  */
  it('does not encode a family in a face', () => {
    const a = asFaction(byId('beauvais'), 'Somebody Else');
    const b = asFaction(byId('rowe'), 'Somebody Else');
    b.personality = a.personality;
    b.shortName = a.shortName;
    expect(bossSpecFor(b)).toEqual(bossSpecFor(a));
  });

  it('costs the simulation no random draws', () => {
    // sim/rng.ts is a seeded stream with determinism tests over it. Taking a
    // roll to decide a hat would shift every subsequent roll in the game.
    const state = newGame({ name: 'Test Boss', difficulty: 'normal', seed: 909 });
    const before = state.rng.calls;
    for (const id of RIVAL_IDS) {
      const f = state.factions[id];
      bossSpecFor(f);
      styleFor(f.personality);
    }
    expect(state.rng.calls).toBe(before);
  });
});

describe('the renderer', () => {
  const base: BossSpec = {
    skin: 'brown', hair: 'black', hairStyle: 'crop', facial: 'none', head: 'none',
    neck: 'open', over: 'jacket', build: 0, age: 50,
  };

  it('fills a 64 x 80 buffer, fully opaque, for every option', () => {
    const opts: Partial<BossSpec>[] = [
      {}, { head: 'homburg' }, { head: 'peaked', badge: true }, { head: 'brim' },
      { head: 'wrap' }, { hairStyle: 'waves' }, { hairStyle: 'afro' },
      { hairStyle: 'thin' }, { hairStyle: 'bald' }, { hairStyle: 'updo' },
      { hairStyle: 'set' }, { facial: 'tache' }, { facial: 'beard' },
      { facial: 'goatee' }, { facial: 'stubble' }, { neck: 'banded' },
      { neck: 'tie' }, { neck: 'kerchief' }, { over: 'coat' },
      { over: 'waistcoat' }, { over: 'windbreaker' }, { glasses: true },
      { squint: true }, { build: -1 }, { build: 1 }, { age: 70 },
      { skin: 'deep' }, { skin: 'fair' }, { hair: 'white' },
    ];
    for (const light of Object.values(LIGHTS)) {
      for (const o of opts) {
        const buf = renderBoss({ ...base, ...o }, light, [140, 90, 120]);
        expect(buf.length).toBe(BOSS_W * BOSS_H * 4);
        // Every pixel written: a gap is a hole in the backdrop, which reads as
        // a black notch rather than as anything deliberate.
        let clear = 0;
        for (let i = 3; i < buf.length; i += 4) if (buf[i] !== 255) clear += 1;
        expect(clear, `${light.id} / ${JSON.stringify(o)} left ${clear} pixels unpainted`).toBe(0);
      }
    }
  });

  it('draws the same bytes for the same boss twice', () => {
    const a = renderBoss(base, LIGHTS.office, [79, 95, 154]);
    const b = renderBoss(base, LIGHTS.office, [79, 95, 154]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  /* The build has to reach the picture. It is derived from a hash and passed
     through about a dozen coordinates, and it would be entirely possible for
     it to be plumbed nowhere and for nobody to notice. */
  it('draws a different figure for a different build', () => {
    const narrow = renderBoss({ ...base, build: -0.8 }, LIGHTS.office, [79, 95, 154]);
    const broad = renderBoss({ ...base, build: 0.8 }, LIGHTS.office, [79, 95, 154]);
    let differing = 0;
    for (let i = 0; i < narrow.length; i += 4) if (narrow[i] !== broad[i]) differing += 1;
    expect(differing).toBeGreaterThan(200);
  });

  it('takes the house colour as an accent and nothing more', () => {
    // Same man, two families: the picture differs, but not by very much — the
    // colour tints the fill and the rim and stops there.
    const a = renderBoss(base, LIGHTS.quay, [79, 95, 154]);
    const b = renderBoss(base, LIGHTS.quay, [143, 79, 122]);
    let differing = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i]) differing += 1;
    expect(differing, 'the accent did not reach the picture').toBeGreaterThan(0);
    expect(differing, 'the accent is repainting the whole portrait')
      .toBeLessThan(BOSS_W * BOSS_H * 0.5);
  });

  it('reads a house colour off its hex', () => {
    expect(accentOf('#4f5f9a')).toEqual([0x4f, 0x5f, 0x9a]);
  });
});
