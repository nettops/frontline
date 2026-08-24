/**
 * Drawing a crew portrait, and hiding most of it.
 *
 * `memories.ts` already refuses to tell you what a man is carrying below
 * `RECALL.visibleAbove`, and `perceive()` blurs his stats by the same number.
 * Every system in the game obeys familiarity except, until now, the art — a
 * new hire and a man you had run twenty jobs with were drawn identically.
 *
 * So the portrait resolves as familiarity does, on the game's own tiers from
 * `PERCEPTION_TIERS` rather than on invented ones. Nothing is redrawn between
 * tiers: it is one sprite and a palette transform, plus a light pass at the
 * top.
 */

import { PERCEPTION_TIERS } from '../../config/npcs';
import { currentSkin } from '../skin';
import type { Palette } from './parts';

const hx = (s: string): [number, number, number] => [
  parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16),
];
const toHex = (c: number[]) =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: number[], b: number[], t: number) =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lum = (c: number[]) => c[0] * 0.30 + c[1] * 0.59 + c[2] * 0.11;

/** Which of the five perception tiers a familiarity lands in. */
export function tierOf(familiarity: number): number {
  let i = 0;
  PERCEPTION_TIERS.forEach((t, n) => { if (familiarity >= t.minFamiliarity) i = n; });
  return i;
}
export const tierLabel = (familiarity: number) => PERCEPTION_TIERS[tierOf(familiarity)].label;
/** Above this the portrait is lit rather than flat — the top tier only. */
export const isLit = (familiarity: number) => tierOf(familiarity) >= 4;

const NEUTRAL = hx('#3a332b');

/**
 * Tier 0 is a shape: two near-blacks and the outline, so rank still reads off
 * the silhouette and nothing else reads at all. Tiers 1 and 2 are drawn but
 * drained. Tier 3 is simply the palette, which is the same line on which
 * memories.ts starts letting you see what he is holding.
 */
export function resolve(pal: Palette, familiarity: number): Palette {
  const tier = tierOf(familiarity);
  const crt = currentSkin() === 'crt';
  const out: Palette = {};
  for (const [k, hexv] of Object.entries(pal)) {
    if (k === '0') { out[k] = hexv; continue; }
    let c: number[] = hx(hexv);
    if (tier === 0) {
      /* A shape, but a legible one: both values sit just above --ink-700 so
         the silhouette reads against the tile behind it. Drawn darker than
         the ground it stands on, a stranger is a smudge rather than a man. */
      c = lum(c) > 78 ? hx('#342c24') : hx('#26201a');
    } else if (tier < 3) {
      const t = tier === 1 ? 1 : 0.45;
      c = mix(c, NEUTRAL, 0.62 * t);
      const l = lum(c);
      c = mix(c, [l, l, l], 0.35 * t);
    }
    if (crt) {
      // The second skin is CGA grey on black, so colour cannot carry anything.
      const l = lum(c);
      c = mix(c, [l, l, l], 0.85);
    }
    out[k] = toHex(c);
  }
  return out;
}

/**
 * Paint. The lit pass is the same three-source logic as the scene work in
 * prototypes/: a warm key from the upper left, the shadow side dropped, and a
 * rim taken from the sprite's own silhouette rather than from brightness —
 * testing brightness lights interior edges and speckles the whole figure.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  pal: Palette,
  scale: number,
  lit: boolean,
): void {
  const w = rows[0].length, h = rows.length;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w * scale, h * scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = rows[y][x];
      if (k === '.') continue;
      const hexv = pal[k];
      if (!hexv) continue;
      let c: number[] = hx(hexv);
      if (lit) {
        if (k !== '0') {
          const key = 0.22 - (x - w * 0.36) / (w * 1.7) - (y - h * 0.28) / (h * 3.2);
          c = mix(c, [255, 234, 194], Math.max(0, key) * 0.40);
          c = mix(c, [6, 9, 16], Math.max(0, -key) * 0.62);
        }
        if (on(x, y) && !on(x - 1, y)) c = mix(c, [246, 194, 102], 0.40);
      }
      ctx.fillStyle = toHex(c);
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
