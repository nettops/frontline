import { describe, it, expect } from 'vitest';
import { stepAlongPath, facingToSprite, DEFAULT_SPEED_CELLS_PER_SEC } from '../movement';
import type { Point } from '../../map/grid';

describe('stepAlongPath', () => {
  it('starts at the path origin with the first segment\'s facing', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    const state = stepAlongPath(path, 0, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBeCloseTo(0);
    expect(state.y).toBeCloseTo(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(false);
  });

  it('interpolates fractionally partway through a segment', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    // distance = (elapsedMs/1000) * speed = 0.5 cells at speed 2
    const state = stepAlongPath(path, 250, 2);
    expect(state.x).toBeCloseTo(0.5);
    expect(state.y).toBeCloseTo(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(false);
  });

  it('carries facing across a direction change into the second segment', () => {
    const path: Point[] = [[0, 0], [1, 0], [1, 1]]; // E then S
    // distance = 1.5 cells at speed 3 -> 500ms
    const state = stepAlongPath(path, 500, 3);
    expect(state.x).toBeCloseTo(1);
    expect(state.y).toBeCloseTo(0.5);
    expect(state.facing).toBe('S');
    expect(state.done).toBe(false);
  });

  it('clamps to the exact endpoint and reports done once elapsed time exceeds the path length', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    const state = stepAlongPath(path, 10_000, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBe(1);
    expect(state.y).toBe(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(true);
  });

  it('treats a single-cell path as already arrived, facing south by default', () => {
    const path: Point[] = [[3, 4]];
    const state = stepAlongPath(path, 0, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBe(3);
    expect(state.y).toBe(4);
    expect(state.facing).toBe('S');
    expect(state.done).toBe(true);
  });

  it('covers all 4 grid directions', () => {
    expect(stepAlongPath([[0, 0], [1, 0]], 0, 1).facing).toBe('E');
    expect(stepAlongPath([[0, 0], [-1, 0]], 0, 1).facing).toBe('W');
    expect(stepAlongPath([[0, 0], [0, 1]], 0, 1).facing).toBe('S');
    expect(stepAlongPath([[0, 0], [0, -1]], 0, 1).facing).toBe('N');
  });

  it('treats a negative elapsedMs as zero elapsed, never throwing', () => {
    const path: Point[] = [[0, 0], [1, 0]];
    const state = stepAlongPath(path, -1, DEFAULT_SPEED_CELLS_PER_SEC);
    expect(state.x).toBeCloseTo(0);
    expect(state.y).toBeCloseTo(0);
    expect(state.facing).toBe('E');
    expect(state.done).toBe(false);
  });

  it('throws on an empty path', () => {
    expect(() => stepAlongPath([], 0, DEFAULT_SPEED_CELLS_PER_SEC)).toThrow();
  });
});

describe('facingToSprite', () => {
  it('maps toward-camera directions (S/E) to the front sprite, E mirrored', () => {
    expect(facingToSprite('S')).toEqual({ variant: 'front', flipX: false });
    expect(facingToSprite('E')).toEqual({ variant: 'front', flipX: true });
  });

  it('maps away-from-camera directions (N/W) to the back sprite, W mirrored', () => {
    expect(facingToSprite('N')).toEqual({ variant: 'back', flipX: false });
    expect(facingToSprite('W')).toEqual({ variant: 'back', flipX: true });
  });
});
