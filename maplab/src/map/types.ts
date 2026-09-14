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

export type SelectedEntity = MapObject | SpawnPoint | RoomDef | null;
