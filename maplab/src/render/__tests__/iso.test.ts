import { describe, it, expect } from 'vitest';
import { cellToScreen, screenToCell, heightOffset, TILE_W, TILE_H, HEIGHT_PX } from '../iso';
import { mapPixelBounds } from '../layers';
import { restaurantMap } from '../../map/restaurant';

describe('cellToScreen', () => {
  it('places the origin cell at the screen origin', () => {
    expect(cellToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('moves right and down as cx increases', () => {
    const p = cellToScreen(1, 0);
    expect(p.x).toBe(TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });

  it('moves left and down as cy increases', () => {
    const p = cellToScreen(0, 1);
    expect(p.x).toBe(-TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });
});

describe('screenToCell', () => {
  it('is the exact inverse of cellToScreen', () => {
    const cases: [number, number][] = [[0, 0], [5, 3], [-2, 7], [1.5, 2.25], [10, 10]];
    for (const [cx, cy] of cases) {
      const p = cellToScreen(cx, cy);
      const back = screenToCell(p.x, p.y);
      expect(back.x).toBeCloseTo(cx);
      expect(back.y).toBeCloseTo(cy);
    }
  });
});

describe('heightOffset', () => {
  it('lifts a sprite up-screen (negative y) proportional to height', () => {
    expect(heightOffset(0)).toBe(0);
    expect(heightOffset(1)).toBe(-HEIGHT_PX);
    expect(heightOffset(2)).toBe(-HEIGHT_PX * 2);
  });
});

describe('mapPixelBounds', () => {
  it('matches the corner-transform box for the 30x22 restaurant grid, padded for wall height', () => {
    // Same corner-transform mapPixelBounds itself uses, over the 30x22 grid:
    // (0,0), (30,0), (30,22), (0,22) -> min/max x/y, then padded at the top by the
    // N/W walls' lifted-top height (WALL_HEIGHT=3 world units * HEIGHT_PX=20px/unit = 60px),
    // per the "pad y/height" choice made in layers.ts's mapPixelBounds comment.
    expect(mapPixelBounds(restaurantMap)).toEqual({ x: -704, y: -60, width: 1664, height: 892 });
  });
});

describe('screenToCell / cellToScreen round trip', () => {
  it('floors back to the original integer cell from its center', () => {
    const [c, r] = [5, 7];
    const p = cellToScreen(c + 0.5, r + 0.5);
    const back = screenToCell(p.x, p.y);
    expect([Math.floor(back.x), Math.floor(back.y)]).toEqual([c, r]);
  });
});
