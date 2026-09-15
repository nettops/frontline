/**
 * NPC wander target selection for Map Lab's movement pass. Pure — no
 * Pixi/DOM, no timers. `PixiStage.tsx`'s per-frame loop calls this whenever
 * an NPC needs a new destination.
 */

import type { MapDef } from '../map/types';
import { findPath, type Point } from '../map/grid';

/** Picks a random cell inside `roomId`, other than `currentCell`, that is
 * actually reachable from `currentCell` (a room's cells can be internally
 * split by walls or furniture). Returns null if there's nowhere to go —
 * an unknown room, a single-cell room, or every other cell being
 * unreachable — which is a normal "stay put" outcome, not an error. */
export function pickWanderTarget(
  map: MapDef,
  roomId: string,
  currentCell: Point,
  rng: () => number,
): Point | null {
  const room = map.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const candidates = room.cells.filter(
    ([c, r]) => !(c === currentCell[0] && r === currentCell[1]),
  );
  if (candidates.length === 0) return null;

  const reachable = candidates.filter((cell) => findPath(map, currentCell, cell) !== null);
  if (reachable.length === 0) return null;

  const idx = Math.floor(rng() * reachable.length);
  return reachable[idx];
}
