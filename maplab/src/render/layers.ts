import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Bounds } from './camera';
import type { MapDef, MapObject, SpawnPoint } from '../map/types';
import type { WalkGrid } from '../map/grid';
import { cellRoomIndex } from '../map/grid';
import { cellToScreen, heightOffset } from './iso';
import {
  ROOM_COLORS, WALL_COLOR, DOOR_COLOR, VOID_COLOR,
  GRID_LINE_COLOR, NAV_EDGE_COLOR, COLLISION_COLOR,
  SPAWN_PLAYER_COLOR, SPAWN_NPC_COLOR, ROOM_BOUNDS_COLOR,
} from './palette';
import { SPRITES, PERSON_PALETTES, blitIsoSprite, hash } from './isoSprites';

/** Sprite pixels per iso-sprite row/column unit; sprites are authored at
 * roughly 5 columns per footprint cell, so this keeps a 2x2 table's drawn
 * width close to its floor diamond's screen width (2 * TILE_W / 2 = 64px). */
const SPRITE_SCALE = 6;

const objectTextures = new Map<string, Texture>();
function objectTexture(kind: string): Texture {
  let tex = objectTextures.get(kind);
  if (!tex) {
    const sprite = SPRITES[kind] ?? SPRITES.table;
    tex = Texture.from(blitIsoSprite(sprite, SPRITE_SCALE));
    objectTextures.set(kind, tex);
  }
  return tex;
}

const personTextures = new Map<number, Texture>();
function personTexture(paletteIndex: number): Texture {
  let tex = personTextures.get(paletteIndex);
  if (!tex) {
    const variant = { ...SPRITES.person, palette: PERSON_PALETTES[paletteIndex] };
    tex = Texture.from(blitIsoSprite(variant, SPRITE_SCALE));
    personTextures.set(paletteIndex, tex);
  }
  return tex;
}

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

export type SelectableGraphics = Container & { mapEntity?: MapObject | SpawnPoint };
type SelectableSprite = Sprite & { mapEntity?: MapObject | SpawnPoint };

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
    // Base-center of the footprint, at floor level — the sprite's own art
    // (top face + front faces) depicts the object's height, so no vertical
    // lift here or the sprite would float above its cell.
    const base = cellToScreen(obj.x + obj.footprint.w / 2, obj.y + obj.footprint.h / 2);
    const sprite: SelectableSprite = new Sprite(objectTexture(obj.kind));
    sprite.anchor.set(0.5, 1);
    sprite.x = base.x;
    sprite.y = base.y;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.mapEntity = obj;
    objects.addChild(sprite);
  }

  const gLines = new Graphics();
  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      const p0 = cellToScreen(c, r);
      const p1 = cellToScreen(c + 1, r);
      const p2 = cellToScreen(c + 1, r + 1);
      const p3 = cellToScreen(c, r + 1);
      gLines.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
    }
  }
  gLines.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: 0.15 });
  gridLines.addChild(gLines);

  const collisionG = new Graphics();
  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      if (map.cells[r][c] === 'floor' && !grid.isWalkable([c, r])) {
        const p0 = cellToScreen(c, r);
        const p1 = cellToScreen(c + 1, r);
        const p2 = cellToScreen(c + 1, r + 1);
        const p3 = cellToScreen(c, r + 1);
        collisionG.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]).fill({ color: COLLISION_COLOR, alpha: 0.4 });
      }
    }
  }
  collision.addChild(collisionG);

  const navG = new Graphics();
  for (let r = 0; r < map.grid.rows; r++) {
    for (let c = 0; c < map.grid.cols; c++) {
      if (!grid.isWalkable([c, r])) continue;
      const center = cellToScreen(c + 0.5, r + 0.5);
      if (grid.canMove([c, r], [c + 1, r])) {
        const next = cellToScreen(c + 1.5, r + 0.5);
        navG.moveTo(center.x, center.y).lineTo(next.x, next.y);
      }
      if (grid.canMove([c, r], [c, r + 1])) {
        const next = cellToScreen(c + 0.5, r + 1.5);
        navG.moveTo(center.x, center.y).lineTo(next.x, next.y);
      }
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
    const p0 = cellToScreen(minC, minR);
    const p1 = cellToScreen(maxC + 1, minR);
    const p2 = cellToScreen(maxC + 1, maxR + 1);
    const p3 = cellToScreen(minC, maxR + 1);
    const g = new Graphics();
    g.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y])
      .stroke({ width: 2, color: ROOM_BOUNDS_COLOR, alpha: 0.6 });
    roomBounds.addChild(g);
    const label = new Text({ text: room.name, style: { fill: ROOM_BOUNDS_COLOR, fontSize: 10 } });
    label.x = p0.x + 4;
    label.y = p0.y + 4;
    roomBounds.addChild(label);
  }

  for (const spawn of map.spawns) {
    const base = cellToScreen(spawn.x, spawn.y);
    const container: SelectableGraphics = new Container();
    // A small ground ring keeps the player/npc colour distinction the flat
    // marker used to carry; the person sprite stands on top of it, anchored
    // at its feet so it reads as standing on the spawn cell.
    const ring = new Graphics();
    const ringColor = spawn.kind === 'player' ? SPAWN_PLAYER_COLOR : SPAWN_NPC_COLOR;
    ring.ellipse(base.x, base.y, cs * 0.28, cs * 0.14).fill({ color: ringColor, alpha: 0.6 });
    const paletteIndex = hash(spawn.id) % PERSON_PALETTES.length;
    const person = new Sprite(personTexture(paletteIndex));
    person.anchor.set(0.5, 1);
    person.x = base.x;
    person.y = base.y;
    container.addChild(ring, person);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.mapEntity = spawn;
    spawns.addChild(container);
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
