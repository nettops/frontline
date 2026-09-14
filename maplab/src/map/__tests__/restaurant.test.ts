import { describe, it, expect } from 'vitest';
import { restaurantMap } from '../restaurant';
import { buildWalkGrid, roomReachableFrom, neighborOf } from '../grid';

describe('restaurant map', () => {
  it('has every required room', () => {
    const ids = restaurantMap.rooms.map((r) => r.id).sort();
    expect(ids).toEqual(
      [
        'back-room', 'bar', 'bathroom', 'corridor', 'dining',
        'entrance', 'kitchen', 'rear-exit', 'side-exit', 'staff',
      ].sort(),
    );
  });

  it('reaches every room from the front entrance', () => {
    const start = restaurantMap.spawns.find((s) => s.id === 'player-start')!;
    for (const room of restaurantMap.rooms) {
      expect(roomReachableFrom(restaurantMap, [start.x, start.y], room.id)).toBe(true);
    }
  });

  it('has no orphan rooms — every room reaches every other room', () => {
    const [firstCell] = restaurantMap.rooms[0].cells;
    for (const room of restaurantMap.rooms) {
      expect(roomReachableFrom(restaurantMap, firstCell, room.id)).toBe(true);
    }
  });

  it('places every spawn on a walkable cell inside its declared room', () => {
    const grid = buildWalkGrid(restaurantMap);
    for (const spawn of restaurantMap.spawns) {
      expect(grid.isWalkable([spawn.x, spawn.y])).toBe(true);
      const room = restaurantMap.rooms.find((r) => r.id === spawn.roomId)!;
      expect(room.cells.some(([c, r]) => c === spawn.x && r === spawn.y)).toBe(true);
    }
  });

  it('every non-exit door joins two distinct rooms', () => {
    const cellRoom = new Map<string, string>();
    for (const room of restaurantMap.rooms) {
      for (const [c, r] of room.cells) cellRoom.set(`${c},${r}`, room.id);
    }
    const exitKeys = new Set(
      restaurantMap.exits.map((e) => `${e.wall.cell[0]},${e.wall.cell[1]},${e.wall.side}`),
    );
    for (const wall of restaurantMap.walls) {
      if (wall.kind !== 'door') continue;
      const key = `${wall.cell[0]},${wall.cell[1]},${wall.side}`;
      if (exitKeys.has(key)) continue;
      const ownRoom = cellRoom.get(`${wall.cell[0]},${wall.cell[1]}`);
      const neighbor = neighborOf(wall.cell, wall.side);
      const neighborRoom = cellRoom.get(`${neighbor[0]},${neighbor[1]}`);
      expect(ownRoom).toBeDefined();
      expect(neighborRoom).toBeDefined();
      expect(neighborRoom).not.toBe(ownRoom);
    }
  });
});
