import { Container, Graphics, Text } from 'pixi.js';
import type { Bounds } from './camera';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import type { WalkGrid } from '../map/grid';
import { cellRoomIndex } from '../map/grid';
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
      const kind = roomIndex.get(`${c},${r}`)?.kind;
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
