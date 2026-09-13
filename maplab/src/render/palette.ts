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
