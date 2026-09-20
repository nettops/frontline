/**
 * The board is a pure reading of state — like the briefing, it decides
 * nothing and is never saved, so a row added to it cannot change the outcome
 * of a game. These tests pin the two facts that make it trustworthy: it is
 * empty when nothing runs, and each kind of running thing produces exactly
 * one row that says what it is, where it is, and when it lands.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../../sim/state';
import { crewList } from '../../sim/npc';
import type { GameState } from '../../sim/types';
import { boardItems } from '../board';
import { throughput } from '../../sim/contraband';

function fresh(seed = 7): GameState {
  return newGame({ name: 'Tester', difficulty: 'normal', seed });
}

describe('the board', () => {
  it('is empty on day one, when nothing is in motion', () => {
    expect(boardItems(fresh())).toEqual([]);
  });

  it('shows a running job with its place, crew and landing day', () => {
    const state = fresh();
    const man = crewList(state)[0];
    state.activeOperations['op1'] = {
      id: 'op1',
      defId: 'corner_shakedown',
      territoryId: 'little_sicily',
      crewIds: [man.id],
      startDay: state.day,
      endDay: state.day + 2,
      investment: 0,
      successChance: 0.8,
      projectedPayout: 400,
    };
    const rows = boardItems(state);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe('job');
    expect(row.title).toContain('Corner Shakedown');
    expect(row.sub).toContain('Little Sicily');
    expect(row.figure).toBe('2d');
    expect(row.progress).toBe(0);
    expect(row.panel).toBe('operations');
  });

  it('shows a teaching pairing with both names and its deadline', () => {
    const state = fresh();
    const teacher = crewList(state)[0];
    const student = structuredClone(teacher);
    student.id = 'npc_student';
    student.name = 'Aldo Test';
    state.npcs[student.id] = student;
    state.training = [
      {
        id: 't1',
        teacherId: teacher.id,
        studentId: student.id,
        startDay: state.day,
        endDay: state.day + 12,
        status: 'running',
      },
    ];
    const rows = boardItems(state);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('teaching');
    expect(rows[0].title).toContain(teacher.name);
    expect(rows[0].title).toContain('Aldo Test');
    expect(rows[0].figure).toBe('12d');
    expect(rows[0].panel).toBe('crew');
  });

  it('shows each trade once it has a source or stock, and not before', () => {
    const state = fresh();
    state.contraband.supplierId = 'ricci';
    state.contraband.routes.product = ['little_sicily'];
    state.contraband.stock.product = 14;
    state.contraband.workshops.push({ territoryId: 'little_sicily', since: state.day });
    state.contraband.stock.arms = 3;
    const rows = boardItems(state);
    const product = rows.find((r) => r.kind === 'product');
    const arms = rows.find((r) => r.kind === 'arms');
    expect(product).toBeDefined();
    expect(product!.figure).toBe('14u');
    expect(product!.panel).toBe('contraband');
    expect(arms).toBeDefined();
    expect(arms!.figure).toBe('3u');
    // A trade with no source, no route and no stock is not running.
    const bare = fresh();
    expect(boardItems(bare).some((r) => r.kind === 'product' || r.kind === 'arms')).toBe(
      false,
    );
  });

  it('shows a war you are in above a war you are only watching', () => {
    const state = fresh();
    state.factions.falcone!.bonds.player.warSince = state.day - 14;
    state.factions.vasari!.bonds.kestler!.warSince = state.day - 7;
    const rows = boardItems(state);
    const wars = rows.filter((r) => r.kind === 'war');
    expect(wars).toHaveLength(2);
    expect(wars[0].panel).toBe('diplomacy');
    expect(wars[0].title.toLowerCase()).toContain('war with');
    expect(wars[0].figure).toBe('2w');
    // The rival war is theirs, and says so.
    expect(wars[1].sub.toLowerCase()).toContain('their');
  });
});

describe('the trade row', () => {
  /*
     Round 30: "up to 3.9172573331756046u a week". The ceiling is a sum of
     fractional district capacities, and the row printed it raw beside a stock
     figure that is always a whole number of loads.
  */
  it('never prints a raw float for what the routes can carry', () => {
    const state = fresh();
    state.contraband.supplierId = 'runner';
    state.contraband.routes.product = ['little_sicily', 'the_docks'];
    state.contraband.routes.arms = ['little_sicily', 'the_docks'];
    state.contraband.workshops.push({ territoryId: 'little_sicily', since: state.day });
    const src = crewList(state)[0];
    for (let i = 1; i < 12; i++) {
      state.npcs[`hand${i}`] = { ...src, id: `hand${i}`, name: `Hand ${i}`, status: 'active' };
    }
    for (const t of Object.values(state.territories)) {
      t.influence = { ...t.influence, player: 90 };
    }
    // The setup has to actually produce a fractional ceiling, or this proves nothing.
    expect(String(throughput(state, 'product').total)).toMatch(/\.\d{3,}/);
    const rows = boardItems(state).filter((r) => r.kind === 'product' || r.kind === 'arms');
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.sub, `${r.kind} row: ${r.sub}`).toMatch(/up to \d+(\.\d)?u a week/);
      expect(r.sub).not.toMatch(/\d\.\d{2,}/);
    }
  });

  it('says so while the boss is laying low, and shows the halved ceiling', () => {
    const state = fresh();
    state.contraband.supplierId = 'runner';
    state.contraband.routes.product = ['little_sicily'];
    state.contraband.stock.product = 10;
    state.territories['little_sicily'].influence = {
      ...state.territories['little_sicily'].influence,
      player: 90,
    };
    const src = crewList(state)[0];
    for (let i = 1; i < 8; i++) {
      state.npcs[`hand${i}`] = { ...src, id: `hand${i}`, name: `Hand ${i}`, status: 'active' };
    }
    const open = boardItems(state).find((r) => r.kind === 'product')!;
    state.org.layLowUntilDay = state.day + 14;
    const dark = boardItems(state).find((r) => r.kind === 'product')!;
    expect(open.sub).not.toMatch(/laying low/);
    expect(dark.sub).toMatch(/laying low/);
    const ceiling = (sub: string) => Number(/up to ([\d.]+)u a week/.exec(sub)![1]);
    expect(ceiling(dark.sub)).toBeLessThan(ceiling(open.sub));
  });
});
