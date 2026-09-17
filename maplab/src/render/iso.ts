/**
 * Cell <-> screen projection for the isometric renderer. Pure math, no
 * Pixi/DOM — the same separation `camera.ts` already keeps.
 *
 * 2:1 diamond-tile projection (the Habbo/RTS convention): moving one cell in
 * +x goes right-and-down on screen, moving one cell in +y goes left-and-down.
 * `screenToCell` is the algebraic inverse of `cellToScreen`.
 */

export const TILE_W = 64;
export const TILE_H = 32;
/** Screen px lifted per 1.0 unit of MapObject/wall height. */
export const HEIGHT_PX = 20;

export interface ScreenPoint {
  x: number;
  y: number;
}

export function cellToScreen(cx: number, cy: number): ScreenPoint {
  return { x: (cx - cy) * (TILE_W / 2), y: (cx + cy) * (TILE_H / 2) };
}

export function screenToCell(sx: number, sy: number): { x: number; y: number } {
  const cx = sx / TILE_W + sy / TILE_H;
  const cy = sy / TILE_H - sx / TILE_W;
  return { x: cx, y: cy };
}

/** Negative y = up-screen, so taller things draw higher. */
export function heightOffset(height: number): number {
  return height === 0 ? 0 : -height * HEIGHT_PX;
}
