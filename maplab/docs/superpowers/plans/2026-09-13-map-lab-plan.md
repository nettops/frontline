# Map Lab (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, data-driven map + PixiJS renderer + dev inspection tool (`Map Lab`), proven on one restaurant test map, per `docs/superpowers/specs/2026-09-13-map-lab-design.md`.

**Architecture:** A grid-based `MapDef` (rooms, edge-based walls/doors, objects, spawns, exits) is the single source of truth. `grid.ts` derives a walkability grid and A* pathfinding from it — never authored by hand. A PixiJS renderer consumes `MapDef` + the derived grid to build layered, toggleable visuals. A thin React shell (`Map Lab`) wraps the Pixi canvas with pan/zoom/selection/inspection UI, reading the same data the renderer drew.

**Tech Stack:** React 18 + TypeScript + Vite (matches Frontline's existing app), PixiJS 8 (new dependency, this package only), Vitest for the data-layer tests.

## Global Constraints

- Standalone package in `maplab/`. No import path into or out of `mafia/src` — this phase cannot affect Frontline's sim, panels, tests, or build.
- Exactly one new dependency: `pixi.js` (`^8.0.0`). Nothing else added without a reason documented in a task.
- The map data model (`src/map/types.ts`, `src/map/grid.ts`, `src/map/restaurant.ts`) has zero React or Pixi coupling — it must be importable and testable in plain Node.
- Automated tests (Vitest) cover the data layer only: `src/map/**` and `src/render/camera.ts`. No DOM/Pixi-runtime tests this phase — rendering/UI correctness is verified by actually running the app (final task).
- No in-lab visual map editor, no player movement/mechanics wiring, no multi-floor, no art pass — all explicit non-goals per the spec.
- Windows 11, PowerShell 5.1 primary shell; every command below is plain `npm`/`npx` and runs identically from PowerShell or Git Bash.

---

### Task 1: Package scaffold

**Files:**
- Create: `maplab/package.json`
- Create: `maplab/tsconfig.json`
- Create: `maplab/vite.config.ts`
- Create: `maplab/index.html`
- Create: `maplab/src/main.tsx`
- Create: `maplab/src/MapLabApp.tsx`

**Interfaces:**
- Produces: a buildable/runnable Vite+React+TS app with a placeholder `MapLabApp` component, and a working `npm test` (Vitest) runner for later tasks to add tests to.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "maplab",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "pixi.js": "^8.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vite.config.ts`** (Vitest config lives here too — one file, no separate `vitest.config.ts`)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Map Lab</title>
    <style>
      html, body, #root { margin: 0; height: 100%; background: #0a0908; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/MapLabApp.tsx`** (placeholder — Task 6 replaces the body)

```tsx
export default function MapLabApp() {
  return <div style={{ padding: 16, color: '#ded3bc', background: '#141110', fontFamily: 'monospace' }}>Map Lab</div>;
}
```

- [ ] **Step 6: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MapLabApp from './MapLabApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MapLabApp />
  </StrictMode>,
);
```

- [ ] **Step 7: Install and verify the build**

Run (from `maplab/`):
```bash
npm install
npm run build
```
Expected: install completes, `tsc -b` reports no errors, `vite build` emits `dist/`.

- [ ] **Step 8: Commit**

```bash
git add maplab/package.json maplab/package-lock.json maplab/tsconfig.json maplab/vite.config.ts maplab/index.html maplab/src/main.tsx maplab/src/MapLabApp.tsx
git commit -m "Map Lab: scaffold Vite+React+TS app"
```

---

### Task 2: Map data types + walkability grid + pathfinding

**Files:**
- Create: `maplab/src/map/types.ts`
- Create: `maplab/src/map/grid.ts`
- Test: `maplab/src/map/__tests__/grid.test.ts`

**Interfaces:**
- Consumes: nothing (first logic layer).
- Produces (for Tasks 3, 5, 6): `MapDef`, `RoomDef`, `WallEdge`, `MapObject`, `SpawnPoint`, `ExitDef`, `CellKind`, `Side` types from `types.ts`; `buildWalkGrid(map: MapDef): WalkGrid` (`{ isWalkable(cell): boolean; canMove(from, to): boolean }`), `findPath(map, from, to): Point[] | null`, `roomReachableFrom(map, from, roomId): boolean`, `edgeKey(cell, side): string`, `mirrorEdgeKey(cell, side): string`, `neighborOf(cell, side): Point` from `grid.ts`. `Point = [number, number]`.

- [ ] **Step 1: Write `src/map/types.ts`**

```ts
export type CellKind = 'floor' | 'void';
export type Side = 'N' | 'E' | 'S' | 'W';
export type WallKind = 'wall' | 'door' | 'window' | 'open';

export interface WallEdge {
  cell: [number, number];
  side: Side;
  kind: WallKind;
  height?: number;
}

export type RoomKind =
  | 'dining' | 'bar' | 'kitchen' | 'back-room' | 'staff'
  | 'corridor' | 'bathroom' | 'entrance' | 'exit';

export interface RoomDef {
  id: string;
  name: string;
  kind: RoomKind;
  cells: [number, number][];
  level: number;
}

export interface MapObject {
  id: string;
  kind: string;
  x: number;
  y: number;
  footprint: { w: number; h: number };
  height: number;
  walkable?: boolean;
  roomId: string;
}

export interface SpawnPoint {
  id: string;
  kind: 'player' | 'npc';
  x: number;
  y: number;
  roomId: string;
}

export interface ExitDef {
  id: string;
  roomId: string;
  wall: WallEdge;
  kind: 'front' | 'rear' | 'side';
  leadsTo: 'outside';
}

export interface MapDef {
  id: string;
  name: string;
  grid: { cols: number; rows: number; cellSize: number };
  cells: CellKind[][];
  walls: WallEdge[];
  rooms: RoomDef[];
  objects: MapObject[];
  spawns: SpawnPoint[];
  exits: ExitDef[];
}
```

- [ ] **Step 2: Write the failing test — `src/map/__tests__/grid.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildWalkGrid, findPath } from '../grid';
import type { MapDef } from '../types';

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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/map/__tests__/grid.test.ts`
Expected: FAIL — `../grid` has no exported member `buildWalkGrid`/`findPath` (module doesn't exist yet).

- [ ] **Step 4: Write `src/map/grid.ts`**

```ts
import type { MapDef, Side, WallEdge } from './types';

export type Point = [number, number];

const DIRS: Record<Side, Point> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function neighborOf(cell: Point, side: Side): Point {
  const [dx, dy] = DIRS[side];
  return [cell[0] + dx, cell[1] + dy];
}

export function edgeKey(cell: Point, side: Side): string {
  return `${cell[0]},${cell[1]},${side}`;
}

/** The same physical edge, expressed from the neighboring cell's side. */
export function mirrorEdgeKey(cell: Point, side: Side): string {
  const neighbor = neighborOf(cell, side);
  return edgeKey(neighbor, OPPOSITE[side]);
}

function blockedEdges(walls: WallEdge[]): Set<string> {
  const blocked = new Set<string>();
  for (const w of walls) {
    if (w.kind !== 'wall') continue;
    blocked.add(edgeKey(w.cell, w.side));
    blocked.add(mirrorEdgeKey(w.cell, w.side));
  }
  return blocked;
}

function inBounds(map: MapDef, cell: Point): boolean {
  return cell[0] >= 0 && cell[0] < map.grid.cols && cell[1] >= 0 && cell[1] < map.grid.rows;
}

function cellKindAt(map: MapDef, cell: Point) {
  return map.cells[cell[1]]?.[cell[0]];
}

function blockedObjectCells(map: MapDef): Set<string> {
  const blocked = new Set<string>();
  for (const obj of map.objects) {
    if (obj.walkable) continue;
    const c0 = Math.floor(obj.x);
    const r0 = Math.floor(obj.y);
    const c1 = Math.floor(obj.x + obj.footprint.w - 0.001);
    const r1 = Math.floor(obj.y + obj.footprint.h - 0.001);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) blocked.add(`${c},${r}`);
    }
  }
  return blocked;
}

export interface WalkGrid {
  isWalkable(cell: Point): boolean;
  canMove(from: Point, to: Point): boolean;
}

export function buildWalkGrid(map: MapDef): WalkGrid {
  const blockedEdgeSet = blockedEdges(map.walls);
  const blockedCells = blockedObjectCells(map);

  function isWalkable(cell: Point): boolean {
    if (!inBounds(map, cell)) return false;
    if (cellKindAt(map, cell) !== 'floor') return false;
    if (blockedCells.has(`${cell[0]},${cell[1]}`)) return false;
    return true;
  }

  function canMove(from: Point, to: Point): boolean {
    if (!isWalkable(from) || !isWalkable(to)) return false;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    let side: Side | null = null;
    if (dx === 1 && dy === 0) side = 'E';
    else if (dx === -1 && dy === 0) side = 'W';
    else if (dx === 0 && dy === 1) side = 'S';
    else if (dx === 0 && dy === -1) side = 'N';
    if (!side) return false;
    return !blockedEdgeSet.has(edgeKey(from, side));
  }

  return { isWalkable, canMove };
}

/** A* over the 4-directional grid. Ceiling: O(n^2) open-set scan — fine at
    restaurant scale; swap for a binary heap if maps grow past a few thousand cells. */
export function findPath(map: MapDef, from: Point, to: Point): Point[] | null {
  const grid = buildWalkGrid(map);
  if (!grid.isWalkable(from) || !grid.isWalkable(to)) return null;

  const key = (p: Point) => `${p[0]},${p[1]}`;
  const heuristic = (a: Point, b: Point) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

  const open = new Set<string>([key(from)]);
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>([[key(from), 0]]);
  const fScore = new Map<string, number>([[key(from), heuristic(from, to)]]);
  const points = new Map<string, Point>([[key(from), from]]);

  while (open.size > 0) {
    let currentKey = '';
    let currentF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < currentF) { currentF = f; currentKey = k; }
    }
    const current = points.get(currentKey)!;
    if (currentKey === key(to)) {
      const path: Point[] = [current];
      let k = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        path.unshift(prev);
        k = key(prev);
      }
      return path;
    }
    open.delete(currentKey);
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const neighbor = neighborOf(current, side);
      if (!grid.canMove(current, neighbor)) continue;
      const nKey = key(neighbor);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, to));
        points.set(nKey, neighbor);
        open.add(nKey);
      }
    }
  }
  return null;
}

export function roomReachableFrom(map: MapDef, from: Point, roomId: string): boolean {
  const room = map.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  return room.cells.some((cell) => findPath(map, from, cell) !== null);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/map/__tests__/grid.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Put the fault back, confirm the test catches it, restore**

Temporarily change `if (w.kind !== 'wall') continue;` to `if (w.kind !== 'door') continue;` in `blockedEdges`. Run the test again — expected: the "blocks movement across a wall edge" test now FAILS (a `wall`-kind edge no longer blocks). Revert the change.

- [ ] **Step 7: Commit**

```bash
git add maplab/src/map/types.ts maplab/src/map/grid.ts maplab/src/map/__tests__/grid.test.ts
git commit -m "Map Lab: map data types, walkability grid, A* pathfinding"
```

---

### Task 3: Restaurant test map

**Files:**
- Create: `maplab/src/map/restaurant.ts`
- Test: `maplab/src/map/__tests__/restaurant.test.ts`

**Interfaces:**
- Consumes: `MapDef`, `RoomDef`, `WallEdge`, `Side` from `./types`; `neighborOf`, `edgeKey`, `mirrorEdgeKey`, `buildWalkGrid`, `roomReachableFrom` from `./grid`.
- Produces (for Tasks 5, 6): `restaurantMap: MapDef` — a fully-connected 10-room floorplan (kitchen, staff, back-room, side-exit, corridor, rear-exit, bathroom, dining, bar, entrance), with a `player-start` spawn in `entrance` and one `npc` spawn each in kitchen/dining/bar/back-room.

The floorplan (30×22 cells, `cellSize: 32`):

| Room | id | cols | rows | Connects via door to |
|---|---|---|---|---|
| Kitchen | `kitchen` | 6–14 | 1–7 | dining (S), staff (E) |
| Staff Area | `staff` | 15–19 | 1–7 | kitchen (W), back-room (E) |
| Back Room | `back-room` | 20–24 | 1–7 | staff (W), corridor (E) |
| Side Exit | `side-exit` | 25 | 1–3 | corridor (S), **outside** (N) |
| Corridor | `corridor` | 25 | 4–15 | side-exit (N), rear-exit (S), bathroom (E), back-room (W), dining (W) |
| Rear Exit | `rear-exit` | 25 | 16–18 | corridor (N), **outside** (S) |
| Bathroom | `bathroom` | 26–28 | 8–11 | corridor (W) |
| Dining Room | `dining` | 6–24 | 8–18 | kitchen (N), corridor (E), bar (W), entrance (S) |
| Bar | `bar` | 1–5 | 8–18 | dining (E) |
| Front Entrance | `entrance` | 12–16 | 19–20 | dining (N), **outside** (S) |

Every wall not listed as a door is derived automatically (any cell boundary between two different rooms, or between a room and empty space, becomes a `wall` edge unless it's one of the doors above).

- [ ] **Step 1: Write the failing test — `src/map/__tests__/restaurant.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/map/__tests__/restaurant.test.ts`
Expected: FAIL — `../restaurant` does not exist.

- [ ] **Step 3: Write `src/map/restaurant.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/map/__tests__/restaurant.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Put the fault back, confirm the test catches it, restore**

Temporarily delete the `{ cell: [10, 7], side: 'S', kind: 'door' }` entry from `DOOR_EDGES` (kitchen loses its only connection to the rest of the building). Run the test again — expected: "reaches every room from the front entrance" and "no orphan rooms" both FAIL (kitchen and staff and back-room all become unreachable). Restore the entry.

- [ ] **Step 6: Commit**

```bash
git add maplab/src/map/restaurant.ts maplab/src/map/__tests__/restaurant.test.ts
git commit -m "Map Lab: restaurant test map, fully connected and validated"
```

---

### Task 4: Camera math

**Files:**
- Create: `maplab/src/render/camera.ts`
- Test: `maplab/src/render/__tests__/camera.test.ts`

**Interfaces:**
- Consumes: nothing (pure math).
- Produces (for Task 6): `Transform { x: number; y: number; scale: number }`, `Size { width: number; height: number }`, `Bounds { x: number; y: number; width: number; height: number }`, `clampZoom(scale): number`, `fitTransform(bounds: Bounds, viewport: Size, padding?: number): Transform`.

- [ ] **Step 1: Write the failing test — `src/render/__tests__/camera.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { clampZoom, fitTransform } from '../camera';

describe('clampZoom', () => {
  it('clamps below the minimum', () => {
    expect(clampZoom(0.01)).toBe(0.25);
  });
  it('clamps above the maximum', () => {
    expect(clampZoom(100)).toBe(4);
  });
  it('passes through an in-range value', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('fitTransform', () => {
  it('centers a square in a matching square viewport with no padding', () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, { width: 200, height: 200 }, 0);
    expect(t.scale).toBe(2);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it('uses the tighter dimension for a non-square viewport', () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 50 }, { width: 200, height: 60 }, 0);
    // width would allow scale 2, height only allows scale 1.2 — height wins.
    expect(t.scale).toBeCloseTo(1.2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/__tests__/camera.test.ts`
Expected: FAIL — `../camera` does not exist.

- [ ] **Step 3: Write `src/render/camera.ts`**

```ts
export interface Transform { x: number; y: number; scale: number; }
export interface Size { width: number; height: number; }
export interface Bounds { x: number; y: number; width: number; height: number; }

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** A transform that centers `bounds` in `viewport`, leaving `padding` px of margin. */
export function fitTransform(bounds: Bounds, viewport: Size, padding = 32): Transform {
  const availW = Math.max(1, viewport.width - padding * 2);
  const availH = Math.max(1, viewport.height - padding * 2);
  const scale = clampZoom(Math.min(availW / bounds.width, availH / bounds.height));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return {
    scale,
    x: viewport.width / 2 - cx * scale,
    y: viewport.height / 2 - cy * scale,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/render/__tests__/camera.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Put the fault back, confirm the test catches it, restore**

Temporarily change `Math.min(availW / bounds.width, availH / bounds.height)` to always use `availW / bounds.width`. Run again — expected: "uses the tighter dimension" FAILS (scale comes back 2 instead of 1.2). Restore the `Math.min`.

- [ ] **Step 6: Commit**

```bash
git add maplab/src/render/camera.ts maplab/src/render/__tests__/camera.test.ts
git commit -m "Map Lab: camera fit/zoom math"
```

---

### Task 5: PixiJS layer builder

**Files:**
- Create: `maplab/src/render/palette.ts`
- Create: `maplab/src/render/layers.ts`

**Interfaces:**
- Consumes: `MapDef`, `RoomKind` from `../map/types`; `WalkGrid` from `../map/grid`.
- Produces (for Task 6): `buildMapLayers(map: MapDef, grid: WalkGrid): MapLayers` where `MapLayers = { world, floor, walls, objects, grid, collision, nav, roomBounds, spawns }` (all `pixi.js` `Container`s); `mapPixelBounds(map: MapDef): Bounds`. Each `Graphics` child in `objects`/`spawns` carries a `.mapEntity` property (the source `MapObject` or `SpawnPoint`) for click-to-select in Task 6.

No dedicated automated test — this is Pixi-runtime rendering code with no headless target in this project (see Global Constraints). It's verified visually in Task 6.

- [ ] **Step 1: Write `src/render/palette.ts`**

```ts
import type { RoomKind } from '../map/types';

export const ROOM_COLORS: Record<RoomKind, number> = {
  dining: 0x3a2f28,
  bar: 0x2f2a3a,
  kitchen: 0x3a3428,
  'back-room': 0x2a3428,
  staff: 0x28343a,
  corridor: 0x24211d,
  bathroom: 0x243038,
  entrance: 0x3a2820,
  exit: 0x1d1a17,
};

export const OBJECT_COLOR = 0x8a7f66;
export const WALL_COLOR = 0x0c0a09;
export const DOOR_COLOR = 0xc9a227;
export const VOID_COLOR = 0x0a0908;
export const GRID_LINE_COLOR = 0x000000;
export const NAV_EDGE_COLOR = 0x4ecbb0;
export const COLLISION_COLOR = 0xd1495b;
export const SPAWN_PLAYER_COLOR = 0x2ecc71;
export const SPAWN_NPC_COLOR = 0xf1c40f;
export const ROOM_BOUNDS_COLOR = 0xffffff;
```

- [ ] **Step 2: Write `src/render/layers.ts`**

```ts
import { Container, Graphics, Text } from 'pixi.js';
import type { Bounds } from './camera';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import type { WalkGrid } from '../map/grid';
import {
  ROOM_COLORS, OBJECT_COLOR, WALL_COLOR, DOOR_COLOR, VOID_COLOR,
  GRID_LINE_COLOR, NAV_EDGE_COLOR, COLLISION_COLOR,
  SPAWN_PLAYER_COLOR, SPAWN_NPC_COLOR, ROOM_BOUNDS_COLOR,
} from './palette';

export interface MapLayers {
  world: Container;
  floor: Container;
  walls: Container;
  objects: Container;
  grid: Container;
  collision: Container;
  nav: Container;
  roomBounds: Container;
  spawns: Container;
}

export type SelectableGraphics = Graphics & { mapEntity?: MapObject | SpawnPoint };

function roomKindAt(map: MapDef, c: number, r: number) {
  return map.rooms.find((room) => room.cells.some(([rc, rr]) => rc === c && rr === r))?.kind;
}

export function buildMapLayers(map: MapDef, grid: WalkGrid): MapLayers {
  const cs = map.grid.cellSize;
  const world = new Container();
  const floor = new Container();
  const walls = new Container();
  const objects = new Container();
  const gridLines = new Container();
  const collision = new Container();
  const nav = new Container();
  const roomBounds = new Container();
  const spawns = new Container();

  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      if (map.cells[r][c] !== 'floor') continue;
      const kind = roomKindAt(map, c, r);
      const g = new Graphics();
      g.rect(c * cs, r * cs, cs, cs).fill(kind ? ROOM_COLORS[kind] : VOID_COLOR);
      floor.addChild(g);
    }
  }

  for (const wall of map.walls) {
    const [c, r] = wall.cell;
    const x0 = c * cs;
    const y0 = r * cs;
    const g = new Graphics();
    const color = wall.kind === 'wall' ? WALL_COLOR : wall.kind === 'door' ? DOOR_COLOR : 0x666666;
    const thickness = wall.kind === 'wall' ? 4 : 2;
    if (wall.side === 'N') g.moveTo(x0, y0).lineTo(x0 + cs, y0);
    else if (wall.side === 'S') g.moveTo(x0, y0 + cs).lineTo(x0 + cs, y0 + cs);
    else if (wall.side === 'W') g.moveTo(x0, y0).lineTo(x0, y0 + cs);
    else g.moveTo(x0 + cs, y0).lineTo(x0 + cs, y0 + cs);
    g.stroke({ width: thickness, color });
    walls.addChild(g);
  }

  const orderedObjects = [...map.objects].sort((a, b) => (a.y + a.height) - (b.y + b.height));
  for (const obj of orderedObjects) {
    const g: SelectableGraphics = new Graphics();
    g.rect(obj.x * cs, obj.y * cs, obj.footprint.w * cs, obj.footprint.h * cs).fill(OBJECT_COLOR);
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.mapEntity = obj;
    objects.addChild(g);
  }

  const gLines = new Graphics();
  for (let c = 0; c <= map.grid.cols; c++) gLines.moveTo(c * cs, 0).lineTo(c * cs, map.grid.rows * cs);
  for (let r = 0; r <= map.grid.rows; r++) gLines.moveTo(0, r * cs).lineTo(map.grid.cols * cs, r * cs);
  gLines.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: 0.15 });
  gridLines.addChild(gLines);

  const collisionG = new Graphics();
  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      if (map.cells[r][c] === 'floor' && !grid.isWalkable([c, r])) {
        collisionG.rect(c * cs, r * cs, cs, cs).fill({ color: COLLISION_COLOR, alpha: 0.4 });
      }
    }
  }
  collision.addChild(collisionG);

  const navG = new Graphics();
  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      if (!grid.isWalkable([c, r])) continue;
      const cx = c * cs + cs / 2;
      const cy = r * cs + cs / 2;
      if (grid.canMove([c, r], [c + 1, r])) navG.moveTo(cx, cy).lineTo(cx + cs, cy);
      if (grid.canMove([c, r], [c, r + 1])) navG.moveTo(cx, cy).lineTo(cx, cy + cs);
    }
  }
  navG.stroke({ width: 1, color: NAV_EDGE_COLOR, alpha: 0.5 });
  nav.addChild(navG);

  for (const room of map.rooms) {
    const cols = room.cells.map(([c]) => c);
    const rowsArr = room.cells.map(([, r]) => r);
    const minC = Math.min(...cols);
    const minR = Math.min(...rowsArr);
    const maxC = Math.max(...cols);
    const maxR = Math.max(...rowsArr);
    const g = new Graphics();
    g.rect(minC * cs, minR * cs, (maxC - minC + 1) * cs, (maxR - minR + 1) * cs)
      .stroke({ width: 2, color: ROOM_BOUNDS_COLOR, alpha: 0.6 });
    roomBounds.addChild(g);
    const label = new Text({ text: room.name, style: { fill: ROOM_BOUNDS_COLOR, fontSize: 10 } });
    label.x = minC * cs + 4;
    label.y = minR * cs + 4;
    roomBounds.addChild(label);
  }

  for (const spawn of map.spawns) {
    const g: SelectableGraphics = new Graphics();
    const color = spawn.kind === 'player' ? SPAWN_PLAYER_COLOR : SPAWN_NPC_COLOR;
    g.circle(spawn.x * cs + cs / 2, spawn.y * cs + cs / 2, cs * 0.3).fill(color);
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.mapEntity = spawn;
    spawns.addChild(g);
  }

  world.addChild(floor, walls, objects, roomBounds, gridLines, collision, nav, spawns);
  return { world, floor, walls, objects, grid: gridLines, collision, nav, roomBounds, spawns };
}

export function mapPixelBounds(map: MapDef): Bounds {
  const cs = map.grid.cellSize;
  return { x: 0, y: 0, width: map.grid.cols * cs, height: map.grid.rows * cs };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (No runtime test this task — see note above.)

- [ ] **Step 4: Commit**

```bash
git add maplab/src/render/palette.ts maplab/src/render/layers.ts
git commit -m "Map Lab: PixiJS layer builder (floor/walls/objects/overlays)"
```

---

### Task 6: Map Lab UI — pan/zoom/select/inspect, and real-app verification

**Files:**
- Create: `maplab/src/render/PixiStage.tsx`
- Create: `maplab/src/lab/Inspector.tsx`
- Create: `maplab/src/lab/LayerToggles.tsx`
- Create: `maplab/src/lab/StatusBar.tsx`
- Modify: `maplab/src/MapLabApp.tsx` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `restaurantMap` from `../map/restaurant`; `buildWalkGrid` from `../map/grid`; `buildMapLayers`, `mapPixelBounds`, `MapLayers`, `SelectableGraphics` from `./layers`; `fitTransform` from `./camera`.
- Produces: the running Map Lab app. `PixiStageHandle = { resetCamera(): void; frameSelected(): void }`, `SelectedEntity = MapObject | SpawnPoint | null`, `LayerVisibility` (from `LayerToggles.tsx`).

- [ ] **Step 1: Write `src/render/PixiStage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import { buildWalkGrid } from '../map/grid';
import { buildMapLayers, mapPixelBounds, type MapLayers, type SelectableGraphics } from './layers';
import { fitTransform } from './camera';
import type { LayerVisibility } from '../lab/LayerToggles';

export type SelectedEntity = MapObject | SpawnPoint | null;

export interface PixiStageHandle {
  resetCamera: () => void;
  frameSelected: () => void;
}

interface Props {
  map: MapDef;
  layerVisibility: LayerVisibility;
  onSelect: (entity: SelectedEntity) => void;
  onPointerMove: (cell: { x: number; y: number } | null) => void;
  registerHandle: (handle: PixiStageHandle) => void;
}

export default function PixiStage({ map, layerVisibility, onSelect, onPointerMove, registerHandle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<MapLayers | null>(null);
  const selectedRef = useRef<SelectedEntity>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const app = new Application();

    (async () => {
      await app.init({ background: 0x0a0908, resizeTo: host, antialias: false });
      if (disposed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

      const grid = buildWalkGrid(map);
      const layers = buildMapLayers(map, grid);
      layersRef.current = layers;
      app.stage.addChild(layers.world);
      app.stage.eventMode = 'static';

      const bounds = mapPixelBounds(map);
      const applyTransform = (t: { x: number; y: number; scale: number }) => {
        layers.world.position.set(t.x, t.y);
        layers.world.scale.set(t.scale);
      };
      applyTransform(fitTransform(bounds, { width: host.clientWidth, height: host.clientHeight }));

      const handleSelect = (entity: SelectedEntity) => {
        selectedRef.current = entity;
        onSelect(entity);
      };

      registerHandle({
        resetCamera: () =>
          applyTransform(fitTransform(bounds, { width: host.clientWidth, height: host.clientHeight })),
        frameSelected: () => {
          const sel = selectedRef.current;
          if (!sel) return;
          const w = 'footprint' in sel ? sel.footprint.w : 2;
          const h = 'footprint' in sel ? sel.footprint.h : 2;
          const selBounds = {
            x: sel.x * map.grid.cellSize,
            y: sel.y * map.grid.cellSize,
            width: w * map.grid.cellSize,
            height: h * map.grid.cellSize,
          };
          applyTransform(fitTransform(selBounds, { width: host.clientWidth, height: host.clientHeight }, 80));
        },
      });

      let dragging = false;
      let last = { x: 0, y: 0 };
      app.stage.on('pointerdown', (e) => { dragging = true; last = { x: e.global.x, y: e.global.y }; });
      app.stage.on('pointerup', () => { dragging = false; });
      app.stage.on('pointerupoutside', () => { dragging = false; });
      app.stage.on('pointermove', (e) => {
        const local = layers.world.toLocal(e.global);
        onPointerMove({ x: Math.floor(local.x / map.grid.cellSize), y: Math.floor(local.y / map.grid.cellSize) });
        if (!dragging) return;
        const dx = e.global.x - last.x;
        const dy = e.global.y - last.y;
        last = { x: e.global.x, y: e.global.y };
        layers.world.position.set(layers.world.position.x + dx, layers.world.position.y + dy);
      });
      host.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          const nextScale = Math.min(4, Math.max(0.25, layers.world.scale.x * factor));
          layers.world.scale.set(nextScale);
        },
        { passive: false },
      );

      for (const child of [...layers.objects.children, ...layers.spawns.children] as SelectableGraphics[]) {
        child.on('pointertap', () => handleSelect(child.mapEntity ?? null));
      }

      forceRender((n) => n + 1); // now that layersRef is populated, re-run the visibility effect
    })();

    return () => {
      disposed = true;
      appRef.current?.destroy(true);
      appRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.floor.visible = layerVisibility.floor;
    layers.walls.visible = layerVisibility.walls;
    layers.objects.visible = layerVisibility.objects;
    layers.grid.visible = layerVisibility.grid;
    layers.collision.visible = layerVisibility.collision;
    layers.nav.visible = layerVisibility.nav;
    layers.roomBounds.visible = layerVisibility.roomBounds;
    layers.spawns.visible = layerVisibility.spawns;
  });

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
```

- [ ] **Step 2: Write `src/lab/LayerToggles.tsx`**

```tsx
export interface LayerVisibility {
  floor: boolean;
  walls: boolean;
  objects: boolean;
  grid: boolean;
  collision: boolean;
  nav: boolean;
  roomBounds: boolean;
  spawns: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  floor: true, walls: true, objects: true, grid: false,
  collision: false, nav: false, roomBounds: true, spawns: true,
};

const LABELS: Record<keyof LayerVisibility, string> = {
  floor: 'Floor', walls: 'Walls', objects: 'Objects', grid: 'Grid',
  collision: 'Collision', nav: 'Navigation', roomBounds: 'Room bounds', spawns: 'Spawns',
};

export default function LayerToggles({
  value,
  onChange,
}: {
  value: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}) {
  return (
    <aside style={{ padding: 12, borderRight: '1px solid #332a22' }}>
      <h3 style={{ marginTop: 0 }}>Layers</h3>
      {(Object.keys(LABELS) as (keyof LayerVisibility)[]).map((key) => (
        <label key={key} style={{ display: 'block', marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />{' '}
          {LABELS[key]}
        </label>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Write `src/lab/Inspector.tsx`**

```tsx
import type { SelectedEntity } from '../render/PixiStage';

export default function Inspector({ entity }: { entity: SelectedEntity }) {
  return (
    <aside style={{ padding: 12, borderLeft: '1px solid #332a22', overflow: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Inspector</h3>
      {!entity ? (
        <p>Click an object or spawn point to inspect it.</p>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(entity, null, 2)}</pre>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Write `src/lab/StatusBar.tsx`**

```tsx
export default function StatusBar({
  cursorCell,
  mapName,
}: {
  cursorCell: { x: number; y: number } | null;
  mapName: string;
}) {
  return (
    <div style={{ gridColumn: '1 / -1', padding: '4px 12px', borderTop: '1px solid #332a22', fontSize: 12 }}>
      {mapName} · {cursorCell ? `cell (${cursorCell.x}, ${cursorCell.y})` : 'cell (—, —)'}
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/MapLabApp.tsx`**

```tsx
import { useRef, useState } from 'react';
import { restaurantMap } from './map/restaurant';
import PixiStage, { type PixiStageHandle, type SelectedEntity } from './render/PixiStage';
import Inspector from './lab/Inspector';
import LayerToggles, { DEFAULT_LAYER_VISIBILITY, type LayerVisibility } from './lab/LayerToggles';
import StatusBar from './lab/StatusBar';

export default function MapLabApp() {
  const [selected, setSelected] = useState<SelectedEntity>(null);
  const [cursorCell, setCursorCell] = useState<{ x: number; y: number } | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const handleRef = useRef<PixiStageHandle | null>(null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 260px',
        gridTemplateRows: '1fr auto',
        height: '100vh',
        background: '#141110',
        color: '#ded3bc',
        fontFamily: 'monospace',
      }}
    >
      <LayerToggles value={layers} onChange={setLayers} />
      <div style={{ position: 'relative' }}>
        <PixiStage
          map={restaurantMap}
          layerVisibility={layers}
          onSelect={setSelected}
          onPointerMove={setCursorCell}
          registerHandle={(h) => { handleRef.current = h; }}
        />
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => handleRef.current?.resetCamera()}>Reset camera</button>
          <button onClick={() => handleRef.current?.frameSelected()} disabled={!selected}>
            Frame selected
          </button>
        </div>
      </div>
      <Inspector entity={selected} />
      <StatusBar cursorCell={cursorCell} mapName={restaurantMap.name} />
    </div>
  );
}
```

- [ ] **Step 6: Type-check and run the full test suite**

Run:
```bash
npx tsc -b --noEmit
npm test
```
Expected: no type errors; all Task 2–4 tests still pass (9 tests total: 4 grid + 5 restaurant, plus the 5 camera tests = 14).

- [ ] **Step 7: Start the dev server and verify the real, rendered app**

Run: `npm run dev` (leave running). Using the browser tooling available in this session:
1. Navigate to the printed local URL (e.g. `http://localhost:5173`).
2. Confirm the restaurant renders: 10 distinctly colored rooms, walls as dark lines, doors as gold lines, placeholder furniture rectangles, colored spawn dots.
3. Drag to pan; scroll to zoom; click "Reset camera" and confirm it re-fits the whole map.
4. Click a table object and a spawn dot; confirm the Inspector panel shows that entity's real JSON (id, position, footprint/roomId) and the status bar's cell coordinate updates as the mouse moves.
5. Click "Frame selected" with an object selected; confirm the camera zooms to it.
6. Toggle "Collision" on; confirm the furniture footprints and cells outside any room tint red. Toggle "Navigation" on; confirm connecting lines run through every doorway and stop at every solid wall. Toggle "Room bounds"; confirm all 10 room outlines and labels are visible and match the floorplan table in Task 3.
7. Take a screenshot for the record.

If any of the above doesn't hold, fix the responsible file (most likely `layers.ts` for a Pixi v8 API mismatch, or `PixiStage.tsx` for an event-wiring bug) before continuing — this step is the actual acceptance test for the whole phase, not a formality.

- [ ] **Step 8: Commit**

```bash
git add maplab/src/render/PixiStage.tsx maplab/src/lab maplab/src/MapLabApp.tsx
git commit -m "Map Lab: pan/zoom/select/inspect UI, verified against the running app"
```

---

## Plan self-review

**Spec coverage:** data model (Task 2) · derived collision/nav (Task 2) · restaurant map with all 10 required rooms (Task 3) · reachability/spawn/door tests (Task 3) · renderer consuming data, not hard-coded (Task 5) · depth via footprint+height (Task 5) · pan/zoom/select/layers/coordinates/collision/nav/room-bounds/reset/frame-selected (Task 6) · real-app visual verification (Task 6, Step 7) · zero impact on `mafia/` (Global Constraints + Task 1 isolation). Explicit non-goals (in-lab editor, mechanics wiring, multi-floor, art) are called out, not silently dropped.

**Type consistency:** `MapDef`/`RoomDef`/`WallEdge`/`MapObject`/`SpawnPoint`/`ExitDef` defined once in Task 2, imported (never redefined) in Tasks 3, 5, 6. `WalkGrid`, `findPath`, `roomReachableFrom`, `edgeKey`, `mirrorEdgeKey`, `neighborOf` defined once in Task 2, consumed in Tasks 3 and 5. `MapLayers`, `buildMapLayers`, `mapPixelBounds`, `SelectableGraphics` defined once in Task 5, consumed in Task 6. `Transform`/`Bounds`/`Size`/`fitTransform`/`clampZoom` defined once in Task 4, consumed in Task 6. `LayerVisibility`/`DEFAULT_LAYER_VISIBILITY` defined once in Task 6's `LayerToggles.tsx`, consumed by `PixiStage.tsx` and `MapLabApp.tsx` in the same task.

**No placeholders found** on re-read.
