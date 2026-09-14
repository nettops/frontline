import { describe, it, expect } from 'vitest';
import { cellToScreen, screenToCell, heightOffset, TILE_W, TILE_H, HEIGHT_PX } from '../iso';

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
