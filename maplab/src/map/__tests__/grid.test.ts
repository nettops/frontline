import { describe, it, expect } from 'vitest';
import { buildWalkGrid, findPath, cellRoomIndex, cellOf } from '../grid';
import type { MapDef, RoomDef } from '../types';

function tinyMap(overrides: Partial<MapDef> = {}): MapDef {
  return {
    id: 'tiny',
    name: 'Tiny',
    grid: { cols: 2, rows: 1, cellSize: 32 },
    cells: [['floor', 'floor']],
    walls: [],
    rooms: [],
    objects: [],
    spawns: [],
    exits: [],
    ...overrides,
  };
}

describe('buildWalkGrid', () => {
  it('blocks movement across a wall edge', () => {
    const map = tinyMap({ walls: [{ cell: [0, 0], side: 'E', kind: 'wall' }] });
    const grid = buildWalkGrid(map);
    expect(grid.canMove([0, 0], [1, 0])).toBe(false);
    expect(findPath(map, [0, 0], [1, 0])).toBeNull();
  });

  it('allows movement across a door edge', () => {
    const map = tinyMap({ walls: [{ cell: [0, 0], side: 'E', kind: 'door' }] });
    const grid = buildWalkGrid(map);
    expect(grid.canMove([0, 0], [1, 0])).toBe(true);
    expect(findPath(map, [0, 0], [1, 0])).toEqual([[0, 0], [1, 0]]);
  });

  it('treats an unwalkable object footprint as blocked', () => {
    const map: MapDef = {
      id: 'row', name: 'Row',
      grid: { cols: 3, rows: 1, cellSize: 32 },
      cells: [['floor', 'floor', 'floor']],
      walls: [],
      rooms: [],
      objects: [{ id: 'crate', kind: 'crate', x: 1, y: 0, footprint: { w: 1, h: 1 }, height: 1, roomId: 'r' }],
      spawns: [],
      exits: [],
    };
    const grid = buildWalkGrid(map);
    expect(grid.isWalkable([1, 0])).toBe(false);
    expect(findPath(map, [0, 0], [2, 0])).toBeNull();
  });

  it('routes around a wall when a detour exists', () => {
    const map: MapDef = {
      id: 'loop', name: 'Loop',
      grid: { cols: 2, rows: 2, cellSize: 32 },
      cells: [['floor', 'floor'], ['floor', 'floor']],
      walls: [{ cell: [0, 0], side: 'E', kind: 'wall' }],
      rooms: [],
      objects: [],
      spawns: [],
      exits: [],
    };
    expect(findPath(map, [0, 0], [1, 0])).toEqual([[0, 0], [0, 1], [1, 1], [1, 0]]);
  });
});

describe('cellRoomIndex', () => {
  it('maps each room cell to that room, and leaves cells owned by no room absent', () => {
    const dining: RoomDef = { id: 'dining', name: 'Dining', kind: 'dining', cells: [[0, 0], [1, 0]], level: 0 };
    const kitchen: RoomDef = { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', cells: [[2, 0]], level: 0 };
    const map = tinyMap({
      grid: { cols: 4, rows: 1, cellSize: 32 },
      cells: [['floor', 'floor', 'floor', 'floor']],
      rooms: [dining, kitchen],
    });
    const index = cellRoomIndex(map);
    expect(index.get('0,0')).toBe(dining);
    expect(index.get('1,0')).toBe(dining);
    expect(index.get('2,0')).toBe(kitchen);
    expect(index.get('3,0')).toBeUndefined();
  });
});

describe('cellOf', () => {
  it('floors fractional coordinates', () => {
    expect(cellOf(3.7, 2.1)).toEqual([3, 2]);
  });

  it('passes integer input through unchanged', () => {
    expect(cellOf(5, 5)).toEqual([5, 5]);
  });
});
