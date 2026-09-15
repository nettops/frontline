/**
 * Pure path-interpolation and facing math for Map Lab's movement pass. No
 * Pixi/DOM — same separation `iso.ts`/`grid.ts` already keep. `PixiStage.tsx`
 * drives this from its per-frame loop.
 */

import type { Point } from '../map/grid';

export type Facing = 'N' | 'E' | 'S' | 'W';

/** Which Map Lab interaction mode is active — decides what a canvas click does. */
export type Mode = 'inspect' | 'move';

export interface MoveState {
  x: number;
  y: number;
  facing: Facing;
  done: boolean;
}

export const DEFAULT_SPEED_CELLS_PER_SEC = 3;

function directionOf(dx: number, dy: number): Facing {
  if (dx === 1) return 'E';
  if (dx === -1) return 'W';
  if (dy === 1) return 'S';
  return 'N'; // dy === -1
}

/** Walks `path` (a findPath() result, 4-directional unit steps) at
 * `speedCellsPerSec`, returning the interpolated position/facing at
 * `elapsedMs` since the walk started. A single-cell path (already at the
 * target) is immediately done, facing south — there is no direction to
 * derive it from. */
export function stepAlongPath(
  path: Point[],
  elapsedMs: number,
  speedCellsPerSec: number = DEFAULT_SPEED_CELLS_PER_SEC,
): MoveState {
  if (path.length === 0) throw new Error('stepAlongPath requires a non-empty path');
  if (path.length === 1) {
    return { x: path[0][0], y: path[0][1], facing: 'S', done: true };
  }

  const totalSegments = path.length - 1;
  const distance = Math.min((elapsedMs / 1000) * speedCellsPerSec, totalSegments);
  const done = distance >= totalSegments;
  const segmentIndex = done ? totalSegments - 1 : Math.floor(distance);
  const fraction = done ? 1 : distance - segmentIndex;

  const [fx, fy] = path[segmentIndex];
  const [tx, ty] = path[segmentIndex + 1];
  const x = fx + (tx - fx) * fraction;
  const y = fy + (ty - fy) * fraction;
  const facing = directionOf(tx - fx, ty - fy);

  return { x, y, facing, done };
}

export interface SpriteFacing {
  variant: 'front' | 'back';
  flipX: boolean;
}

/** S and E both walk toward the camera (down-screen in this projection) —
 * front sprite, E mirrored. N and W both walk away from the camera —
 * back sprite, W mirrored. 2 drawn sprites cover all 4 grid directions. */
export function facingToSprite(facing: Facing): SpriteFacing {
  switch (facing) {
    case 'S': return { variant: 'front', flipX: false };
    case 'E': return { variant: 'front', flipX: true };
    case 'N': return { variant: 'back', flipX: false };
    case 'W': return { variant: 'back', flipX: true };
  }
}
