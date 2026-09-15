import { describe, it, expect } from 'vitest';
import { pickWanderTarget } from '../wander';
import type { MapDef, RoomDef, WallEdge } from '../../map/types';

function roomMap(rooms: RoomDef[], walls: WallEdge[] = []): MapDef {
  return {
    id: 'test', name: 'Test',
    grid: { cols: 3, rows: 1, cellSize: 32 },
    cells: [['floor', 'floor', 'floor']],
    walls,
    rooms,
    objects: [],
    spawns: [],
    exits: [],
  };
}

describe('pickWanderTarget', () => {
  it('picks a reachable cell in the room other than the current one, via the injected rng', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0], [2, 0]] };
    const map = roomMap([room]);

    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toEqual([1, 0]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0.99)).toEqual([2, 0]);
  });

  it('returns null for an unknown room id', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0]] };
    const map = roomMap([room]);
    expect(pickWanderTarget(map, 'nope', [0, 0], () => 0)).toBeNull();
  });

  it('returns null when the room has no other cell to go to', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0]] };
    const map = roomMap([room]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toBeNull();
  });

  it('returns null when every other room cell is unreachable (walled off internally)', () => {
    const room: RoomDef = { id: 'r', name: 'R', kind: 'dining', level: 0, cells: [[0, 0], [1, 0]] };
    const map = roomMap([room], [{ cell: [0, 0], side: 'E', kind: 'wall' }]);
    expect(pickWanderTarget(map, 'r', [0, 0], () => 0)).toBeNull();
  });
});
