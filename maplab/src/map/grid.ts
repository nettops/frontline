import type { MapDef, RoomDef, Side, WallEdge } from './types';

/** Integer cell coordinates — not fractional world units. */
export type Point = [number, number];

/** Floor a fractional world-unit position (e.g. a MapObject's or SpawnPoint's x/y) into the integer cell it occupies. */
export function cellOf(x: number, y: number): Point {
  return [Math.floor(x), Math.floor(y)];
}

/** Shared cell -> owning room lookup, keyed "col,row". If two rooms' `cells` overlap the
    same coordinate, the last room in `map.rooms` wins (plain `Map.set` overwrite) — fine
    for maps with disjoint rooms (the current restaurant map), but a real tie-break rule a
    future overlapping-rooms map should know about. */
export function cellRoomIndex(map: MapDef): Map<string, RoomDef> {
  const index = new Map<string, RoomDef>();
  for (const room of map.rooms) {
    for (const [c, r] of room.cells) index.set(`${c},${r}`, room);
  }
  return index;
}

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
    const [c0, r0] = cellOf(obj.x, obj.y);
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
