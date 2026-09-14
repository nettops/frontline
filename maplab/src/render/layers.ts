import { Container, Graphics, Text } from 'pixi.js';
import type { Bounds } from './camera';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import type { WalkGrid } from '../map/grid';
import { cellRoomIndex } from '../map/grid';
import { cellToScreen, heightOffset, TILE_W, TILE_H } from './iso';
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

export function buildMapLayers(map: MapDef, grid: WalkGrid): MapLayers {
  const cs = map.grid.cellSize;
  const roomIndex = cellRoomIndex(map);
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
      const room = roomIndex.get(`${c},${r}`);
      const color = room ? ROOM_COLORS[room.kind] : VOID_COLOR;
      const p0 = cellToScreen(c, r);
      const p1 = cellToScreen(c + 1, r);
      const p2 = cellToScreen(c + 1, r + 1);
      const p3 = cellToScreen(c, r + 1);
      const g = new Graphics();
      g.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]).fill(color);
      floor.addChild(g);
    }
  }

  const WALL_HEIGHT = 3; // world-height units, tall enough to read as a wall
  for (const wall of map.walls) {
    if (wall.side !== 'N' && wall.side !== 'W') continue; // only the two visible faces
    const [c, r] = wall.cell;
    // Ground-level endpoints of this cell edge.
    const a = cellToScreen(c, r);
    const b = wall.side === 'N' ? cellToScreen(c + 1, r) : cellToScreen(c, r + 1);
    const lift = heightOffset(wall.kind === 'door' ? WALL_HEIGHT * 0.4 : WALL_HEIGHT);
    const color = wall.kind === 'wall' ? WALL_COLOR : wall.kind === 'door' ? DOOR_COLOR : 0x666666;
    const g = new Graphics();
    g.poly([a.x, a.y, b.x, b.y, b.x, b.y + lift, a.x, a.y + lift]).fill(color);
    walls.addChild(g);
  }

  const orderedObjects = [...map.objects].sort(
    (a, b) => (Math.floor(a.y) + Math.floor(a.x)) - (Math.floor(b.y) + Math.floor(b.x)),
  );
  for (const obj of orderedObjects) {
    const base = cellToScreen(obj.x + obj.footprint.w / 2, obj.y + obj.footprint.h / 2);
    const lift = heightOffset(obj.height);
    const halfW = (obj.footprint.w * TILE_W) / 4;
    const halfH = (obj.footprint.h * TILE_H) / 4;
    const g: SelectableGraphics = new Graphics();
    g.poly([
      base.x, base.y + lift - halfH,
      base.x + halfW, base.y + lift,
      base.x, base.y + lift + halfH,
      base.x - halfW, base.y + lift,
    ]).fill(OBJECT_COLOR);
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
    const base = cellToScreen(spawn.x, spawn.y);
    const lift = heightOffset(0.5);
    const g: SelectableGraphics = new Graphics();
    const color = spawn.kind === 'player' ? SPAWN_PLAYER_COLOR : SPAWN_NPC_COLOR;
    g.circle(base.x, base.y + lift, cs * 0.3).fill(color);
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.mapEntity = spawn;
    spawns.addChild(g);
  }

  world.addChild(floor, walls, objects, roomBounds, gridLines, collision, nav, spawns);
  return { world, floor, walls, objects, grid: gridLines, collision, nav, roomBounds, spawns };
}

export function mapPixelBounds(map: MapDef): Bounds {
  const corners = [
    cellToScreen(0, 0),
    cellToScreen(map.grid.cols, 0),
    cellToScreen(map.grid.cols, map.grid.rows),
    cellToScreen(0, map.grid.rows),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
