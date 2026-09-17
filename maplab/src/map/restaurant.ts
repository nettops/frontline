import type { CellKind, MapDef, MapObject, RoomDef, RoomKind, SpawnPoint, WallEdge } from './types';
import { edgeKey, mirrorEdgeKey } from './grid';

function rectCells(c0: number, r0: number, c1: number, r1: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.push([c, r]);
  return cells;
}

const ROOM_RECTS: { id: string; name: string; kind: RoomKind; rect: [number, number, number, number] }[] = [
  { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', rect: [6, 1, 14, 7] },
  { id: 'staff', name: 'Staff Area', kind: 'staff', rect: [15, 1, 19, 7] },
  { id: 'back-room', name: 'Back Room', kind: 'back-room', rect: [20, 1, 24, 7] },
  { id: 'side-exit', name: 'Side Exit', kind: 'exit', rect: [25, 1, 25, 3] },
  { id: 'corridor', name: 'Corridor', kind: 'corridor', rect: [25, 4, 25, 15] },
  { id: 'rear-exit', name: 'Rear Exit', kind: 'exit', rect: [25, 16, 25, 18] },
  { id: 'bathroom', name: 'Bathroom', kind: 'bathroom', rect: [26, 8, 28, 11] },
  { id: 'dining', name: 'Dining Room', kind: 'dining', rect: [6, 8, 24, 18] },
  { id: 'bar', name: 'Bar', kind: 'bar', rect: [1, 8, 5, 18] },
  { id: 'entrance', name: 'Front Entrance', kind: 'entrance', rect: [12, 19, 16, 20] },
];

const rooms: RoomDef[] = ROOM_RECTS.map(({ id, name, kind, rect }) => ({
  id, name, kind, level: 0, cells: rectCells(...rect),
}));

const GRID = { cols: 30, rows: 22, cellSize: 32 };

function emptyCells(): CellKind[][] {
  return Array.from({ length: GRID.rows }, () => Array<CellKind>(GRID.cols).fill('void'));
}
const cells = emptyCells();
for (const room of rooms) for (const [c, r] of room.cells) cells[r][c] = 'floor';

// Every intentional opening: interior doors between rooms, and exterior exits.
// Anything not listed here, between two different rooms (or a room and empty
// space), becomes a solid wall automatically — see `autoWalls` below.
const DOOR_EDGES: WallEdge[] = [
  { cell: [10, 7], side: 'S', kind: 'door' },   // kitchen -> dining
  { cell: [14, 4], side: 'E', kind: 'door' },   // kitchen -> staff
  { cell: [19, 4], side: 'E', kind: 'door' },   // staff -> back-room
  { cell: [24, 5], side: 'E', kind: 'door' },   // back-room -> corridor
  { cell: [25, 4], side: 'N', kind: 'door' },   // corridor -> side-exit
  { cell: [25, 15], side: 'S', kind: 'door' },  // corridor -> rear-exit
  { cell: [25, 9], side: 'E', kind: 'door' },   // corridor -> bathroom
  { cell: [24, 12], side: 'E', kind: 'door' },  // dining -> corridor
  { cell: [5, 13], side: 'E', kind: 'door' },   // bar -> dining
  { cell: [14, 18], side: 'S', kind: 'door' },  // dining -> entrance
  { cell: [14, 20], side: 'S', kind: 'door' },  // entrance -> outside (front)
  { cell: [25, 1], side: 'N', kind: 'door' },   // side-exit -> outside
  { cell: [25, 18], side: 'S', kind: 'door' },  // rear-exit -> outside
];

function autoWalls(allRooms: RoomDef[], doors: WallEdge[]): WallEdge[] {
  const owner = new Map<string, string>();
  for (const room of allRooms) for (const [c, r] of room.cells) owner.set(`${c},${r}`, room.id);

  const doorKeys = new Set<string>();
  for (const d of doors) {
    doorKeys.add(edgeKey(d.cell, d.side));
    doorKeys.add(mirrorEdgeKey(d.cell, d.side));
  }

  const walls: WallEdge[] = [];
  for (const [key, roomId] of owner) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const dCol = side === 'E' ? 1 : side === 'W' ? -1 : 0;
      const dRow = side === 'S' ? 1 : side === 'N' ? -1 : 0;
      const neighborRoom = owner.get(`${c + dCol},${r + dRow}`);
      if (neighborRoom === roomId) continue;
      if (doorKeys.has(edgeKey([c, r], side))) continue;
      walls.push({ cell: [c, r], side, kind: 'wall' });
    }
  }
  return walls;
}

const walls: WallEdge[] = [...DOOR_EDGES, ...autoWalls(rooms, DOOR_EDGES)];

const objects: MapObject[] = [
  { id: 'table-1', kind: 'table', x: 8, y: 10, footprint: { w: 2, h: 2 }, height: 0.8, roomId: 'dining' },
  { id: 'table-2', kind: 'table', x: 14, y: 10, footprint: { w: 2, h: 2 }, height: 0.8, roomId: 'dining' },
  { id: 'table-3', kind: 'table', x: 8, y: 15, footprint: { w: 2, h: 2 }, height: 0.8, roomId: 'dining' },
  { id: 'table-4', kind: 'table', x: 18, y: 15, footprint: { w: 2, h: 2 }, height: 0.8, roomId: 'dining' },
  { id: 'bar-counter', kind: 'bar-counter', x: 1, y: 9, footprint: { w: 4, h: 1 }, height: 1.1, roomId: 'bar' },
  { id: 'stove', kind: 'stove', x: 7, y: 2, footprint: { w: 2, h: 1 }, height: 1.0, roomId: 'kitchen' },
  { id: 'prep-counter', kind: 'counter', x: 11, y: 2, footprint: { w: 2, h: 1 }, height: 0.9, roomId: 'kitchen' },
  { id: 'staff-lockers', kind: 'lockers', x: 16, y: 2, footprint: { w: 2, h: 1 }, height: 1.2, roomId: 'staff' },
  { id: 'back-desk', kind: 'desk', x: 21, y: 2, footprint: { w: 2, h: 1 }, height: 0.9, roomId: 'back-room' },
  { id: 'host-stand', kind: 'host-stand', x: 13, y: 19, footprint: { w: 1, h: 1 }, height: 1.0, roomId: 'entrance' },
];

const spawns: SpawnPoint[] = [
  { id: 'player-start', kind: 'player', x: 14, y: 19, roomId: 'entrance' },
  { id: 'npc-cook', kind: 'npc', x: 9, y: 4, roomId: 'kitchen' },
  { id: 'npc-waiter', kind: 'npc', x: 20, y: 10, roomId: 'dining' },
  { id: 'npc-bartender', kind: 'npc', x: 3, y: 11, roomId: 'bar' },
  { id: 'npc-owner', kind: 'npc', x: 22, y: 4, roomId: 'back-room' },
];

export const restaurantMap: MapDef = {
  id: 'restaurant-test',
  name: "Test Case: Italian Restaurant",
  grid: GRID,
  cells,
  walls,
  rooms,
  objects,
  spawns,
  exits: [
    { id: 'exit-front', roomId: 'entrance', kind: 'front', leadsTo: 'outside', wall: { cell: [14, 20], side: 'S', kind: 'door' } },
    { id: 'exit-side', roomId: 'side-exit', kind: 'side', leadsTo: 'outside', wall: { cell: [25, 1], side: 'N', kind: 'door' } },
    { id: 'exit-rear', roomId: 'rear-exit', kind: 'rear', leadsTo: 'outside', wall: { cell: [25, 18], side: 'S', kind: 'door' } },
  ],
};
