import { describe, it, expect } from 'vitest';
import { clampZoom, fitTransform } from '../camera';

describe('clampZoom', () => {
  it('clamps below the minimum', () => {
    expect(clampZoom(0.01)).toBe(0.25);
  });
  it('clamps above the maximum', () => {
    expect(clampZoom(100)).toBe(4);
  });
  it('passes through an in-range value', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('fitTransform', () => {
  it('centers a square in a matching square viewport with no padding', () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, { width: 200, height: 200 }, 0);
    expect(t.scale).toBe(2);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it('uses the tighter dimension for a non-square viewport', () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 50 }, { width: 200, height: 60 }, 0);
    // width would allow scale 2, height only allows scale 1.2 — height wins.
    expect(t.scale).toBeCloseTo(1.2);
  });
});
