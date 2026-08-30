/**
 * What went out with them, and what it left behind.
 *
 * Three acts of violence in this game land a body — `silence`, a mark, and
 * accusing one of your own — and until now all three filed the same trace at
 * the same strength whatever the family actually owned. This is the missing
 * question.
 *
 * The tests are ordered by what would be worst to get wrong.
 *
 * **Never a gate** comes first and it is not a formality. A boss does not send
 * his people out unarmed, so no act may ever be blocked, delayed or worsened
 * for want of a piece — not on day one, not with an empty shelf, and not on a
 * save written before any of this existed. `work_it_yourself` takes the same
 * stance about work: the answer is never nothing.
 *
 * **The stream** comes second, for the reason `addLog`'s header gives at
 * length — a change that only touches presentation moved every job outcome in
 * the game by one call, twice, and it took four probe runs to find. Reading
 * the shelf must not draw, and the default policy must not draw.
 *
 * Everything after that is the design: class trades noise for odds, provenance
 * trades money for what is left behind, and a piece kept is a piece that ties
 * tonight to the last time.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import type { GameState } from '../types';
import {
  armFor,
  armouryOf,
  breakOutCrate,
  buyCold,
  setCarry,
  setDump,
  shelf,
  spent,
} from '../pieces';
import { COLD, CRATE_BREAK, PROVENANCE } from '../../config/pieces';
import { silence } from '../silence';
import { crewList } from '../npc';

function fresh(seed = 7): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

/** The stream, as two numbers. Any draw at all moves one of them. */
function stream(state: GameState): string {
  return `${state.rng.seed}:${state.rng.calls}`;
}

function violence(state: GameState) {
  return Object.values(state.evidence).filter((e) => e.source === 'violence');
}

describe('a boss never sends his people out unarmed', () => {
  it('finds something on day one, before anything has been bought', () => {
    const state = fresh();
    expect(shelf(state).length, 'the family owns no guns at all').toBeGreaterThan(0);
    expect(armFor(state).piece).toBeDefined();
  });

  it('finds something with the shelf emptied', () => {
    const state = fresh();
    armouryOf(state).pieces = [];
    expect(armFor(state).piece, 'an empty shelf stopped an act of violence').toBeDefined();
    expect(shelf(state).length).toBeGreaterThan(0);
  });

  it('scrapes up something that has been out before, so dumping is not free', () => {
    /*
       The hole `ladder.probe` found before it could measure anything.

       The refill exists so no act is ever gated, and while it handed over
       clean guns for nothing it made the dump policy strictly better: dump
       everything, get a fresh one, never join two nights, pay nothing. A
       toggle with a right answer is a difficulty setting.
    */
    const state = fresh();
    armouryOf(state).pieces = [];
    expect(armFor(state).piece.bodies, 'the family scraped up a clean gun for free').toBe(1);
  });

  it('finds something on a save written before any of this existed', () => {
    // The lazy-initialiser idiom `possessions`, `marks` and `cards` all use, so
    // SAVE_VERSION does not move. An old save is a family that always had guns.
    const state = fresh();
    delete state.armoury;
    expect(armFor(state).piece).toBeDefined();
  });

  it('carries the class you asked for when the shelf has one', () => {
    const state = fresh();
    setCarry(state, 'long');
    armouryOf(state).pieces.push({
      id: 'pc-long',
      defId: 'pump',
      cls: 'long',
      provenance: 'cold',
      gotDay: 1,
      bodies: 0,
      status: 'shelf',
    });
    expect(armFor(state).piece.cls).toBe('long');
  });

  it('carries something anyway when it has none of that class', () => {
    const state = fresh();
    setCarry(state, 'long');
    // Nothing long on a day-one shelf, and the act still happens.
    expect(armFor(state).piece).toBeDefined();
  });
});

describe('reading the shelf costs nothing', () => {
  it('does not touch the seeded stream', () => {
    const state = fresh();
    const before = stream(state);
    armouryOf(state);
    shelf(state);
    armFor(state);
    expect(stream(state), 'reading the armoury drew from the seeded stream').toBe(before);
  });

  it('seeds the same shelf twice for the same career', () => {
    const a = fresh(31);
    const b = fresh(31);
    expect(JSON.stringify(shelf(a).map((p) => [p.defId, p.provenance, p.bodies]))).toBe(
      JSON.stringify(shelf(b).map((p) => [p.defId, p.provenance, p.bodies])),
    );
  });

  it('gives different careers different shelves', () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      seen.add(JSON.stringify(shelf(fresh(seed)).map((p) => p.defId)));
    }
    expect(seen.size, 'every family in the city owns the identical four guns').toBeGreaterThan(1);
  });

  it('keeps the default policy off the stream entirely', () => {
    /*
       The default is pocket and keep, which is also the correct early play —
       four pieces and no money to replace one. Nothing about it may draw, or
       every career that never opens this panel moves.
    */
    const state = fresh();
    const rng = new Rng(state.rng);
    const act = armFor(state);
    const before = stream(state);
    spent(state, rng, act, { npcIds: [], landed: true });
    expect(stream(state), 'the default policy drew from the seeded stream').toBe(before);
  });
});

describe('class trades noise for odds', () => {
  it('raises both together, never one alone', () => {
    const state = fresh();
    for (const cls of ['pocket', 'coat', 'long'] as const) {
      armouryOf(state).pieces.push({
        id: `pc-${cls}`,
        defId: 'snub',
        cls,
        provenance: 'house',
        gotDay: 1,
        bodies: 0,
        status: 'shelf',
      });
    }

    setCarry(state, 'pocket');
    const pocket = armFor(state);
    setCarry(state, 'long');
    const long = armFor(state);

    expect(long.odds, 'a long gun was no better than a pocket one').toBeGreaterThan(pocket.odds);
    expect(long.heat, 'a long gun cost no more attention than a pocket one').toBeGreaterThan(
      pocket.heat,
    );
  });

  it('leaves a pocket piece as the thing that changes nothing', () => {
    // Every existing balance figure in the game was measured against this.
    const state = fresh();
    setCarry(state, 'pocket');
    const act = armFor(state);
    if (act.piece.cls === 'pocket') {
      expect(act.odds).toBe(0);
      expect(act.heat).toBe(1);
    }
  });
});

describe('provenance is what it leaves behind', () => {
  it('costs least when nothing on it is yours, and most when it is', () => {
    expect(
      PROVENANCE.cold.evidence,
      'a piece bought clean left as much as one out of the family cupboard',
    ).toBeLessThan(PROVENANCE.house.evidence);
    expect(
      PROVENANCE.crate.evidence,
      'a serial you put on it yourself left no more than anybody else’s',
    ).toBeGreaterThan(PROVENANCE.house.evidence);
  });

  it('files a lighter trace for a cold piece than a house one', () => {
    const light = fresh(11);
    const heavy = fresh(11);
    for (const state of [light, heavy]) {
      armouryOf(state).pieces = [];
    }
    armouryOf(light).pieces.push({
      id: 'p-cold',
      defId: 'snub',
      cls: 'pocket',
      provenance: 'cold',
      gotDay: 1,
      bodies: 0,
      status: 'shelf',
    });
    armouryOf(heavy).pieces.push({
      id: 'p-house',
      defId: 'snub',
      cls: 'pocket',
      provenance: 'house',
      gotDay: 1,
      bodies: 0,
      status: 'shelf',
    });
    expect(armFor(light).evidence).toBeLessThan(armFor(heavy).evidence);
  });
});

describe('a piece you keep ties tonight to the last time', () => {
  function oneUsed(seed = 3) {
    const state = fresh(seed);
    armouryOf(state).pieces = [
      {
        id: 'p1',
        defId: 'snub',
        cls: 'pocket',
        provenance: 'cold',
        gotDay: 1,
        bodies: 0,
        status: 'shelf',
      },
    ];
    return state;
  }

  it('files nothing extra the first time', () => {
    const state = oneUsed();
    const rng = new Rng(state.rng);
    spent(state, rng, armFor(state), { npcIds: [], landed: true });
    expect(violence(state).length, 'a first body was already tied to something').toBe(0);
  });

  it('counts the body and leaves the piece on the shelf', () => {
    const state = oneUsed();
    const rng = new Rng(state.rng);
    spent(state, rng, armFor(state), { npcIds: [], landed: true });
    expect(shelf(state).length, 'a kept piece went missing').toBe(1);
    expect(shelf(state)[0].bodies).toBe(1);
  });

  it('files a joining trace the second time', () => {
    const state = oneUsed();
    const rng = new Rng(state.rng);
    spent(state, rng, armFor(state), { npcIds: [], landed: true });
    spent(state, rng, armFor(state), { npcIds: [], landed: true });
    expect(
      violence(state).length,
      'the same gun killed two people and nothing connected them',
    ).toBeGreaterThan(0);
  });

  it('counts no body when the act did not land', () => {
    const state = oneUsed();
    const rng = new Rng(state.rng);
    spent(state, rng, armFor(state), { npcIds: [], landed: false });
    expect(shelf(state)[0].bodies).toBe(0);
  });
});

describe('a piece you dump', () => {
  it('comes off the shelf whether or not it went in the river', () => {
    for (const seed of [2, 9, 14, 23]) {
      const state = fresh(seed);
      setDump(state, true);
      const had = shelf(state).length;
      const rng = new Rng(state.rng);
      spent(state, rng, armFor(state), { npcIds: [], landed: true });
      expect(shelf(state).length, 'a dumped piece was still on the shelf').toBe(had - 1);
    }
  });

  it('sometimes turns up, and files the trace the score gear already files', () => {
    /*
       No stub. Dumping is a roll like the score's own `DISPOSAL`, so this runs
       enough careers that both outcomes have to appear, and asserts on the one
       that matters — `source: 'disposal'`, which three agencies already work.
    */
    let recovered = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = fresh(seed);
      setDump(state, true);
      const rng = new Rng(state.rng);
      spent(state, rng, armFor(state), { npcIds: [], landed: true });
      if (Object.values(state.evidence).some((e) => e.source === 'disposal')) recovered += 1;
    }
    expect(recovered, 'forty pieces went in the river and every one stayed there').toBeGreaterThan(
      0,
    );
    expect(recovered, 'not one of forty ever went in the river').toBeLessThan(40);
  });
});

describe('the two doors that open later', () => {
  it('buys a cold piece for real money', () => {
    const state = fresh();
    state.org.dirtyCash = COLD.cost * 3;
    const had = shelf(state).length;
    expect(buyCold(state).ok).toBe(true);
    expect(shelf(state).length).toBe(had + 1);
    expect(shelf(state).some((p) => p.provenance === 'cold')).toBe(true);
  });

  it('refuses a cold piece you cannot pay for', () => {
    const state = fresh();
    state.org.dirtyCash = 0;
    state.org.cash = 0;
    expect(buyCold(state).ok).toBe(false);
  });

  it('breaks a crate out of your own trade into several pieces', () => {
    const state = fresh();
    state.contraband.stock.arms = 4;
    const had = shelf(state).length;
    expect(breakOutCrate(state).ok).toBe(true);
    expect(state.contraband.stock.arms).toBe(3);
    expect(shelf(state).length).toBe(had + CRATE_BREAK.pieces);
    expect(shelf(state).filter((p) => p.provenance === 'crate').length).toBe(CRATE_BREAK.pieces);
  });

  it('refuses to break out a crate you do not have', () => {
    const state = fresh();
    state.contraband.stock.arms = 0;
    expect(breakOutCrate(state).ok).toBe(false);
  });
});

describe('the wiring, not the function', () => {
  /*
     Same lesson `armoury.test.ts`'s own trade half records and `possessions`
     learned the hard way: a green unit test says nothing about whether the
     game ever calls it. So this runs the real act.
  */
  it('a real silencing spends a real piece', () => {
    const state = fresh(19);
    setDump(state, true);
    const target = crewList(state).find((n) => n.status !== 'boss');
    expect(target, 'nobody to send anybody after').toBeDefined();
    const had = shelf(state).length;
    silence(state, new Rng(state.rng), target!.id);
    expect(
      shelf(state).length,
      'the whole game silenced a man and no gun left the shelf',
    ).toBe(had - 1);
  });
});
