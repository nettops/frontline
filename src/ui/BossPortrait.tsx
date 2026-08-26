import { useEffect, useMemo, useRef } from 'react';
import type { Faction } from '../sim/types';
import { BOSS_H, BOSS_W, renderBoss } from './art/bossPortrait';
import { accentOf, bossSpecFor, styleFor } from './art/bossLook';
import { tierOf } from './art/paint';
import { currentSkin } from './skin';

/**
 * The man running a rival family, at the resolution you have earned.
 *
 * Two rules from elsewhere in the project apply here and neither is optional:
 *
 * 1. He resolves as everything else about a rival does. `readFaction` fogs
 *    their wealth, their strength and what they have been doing; a crisp
 *    photograph of a boss you have no intel on would contradict every other
 *    readout on the same panel. So the portrait is put through the game's own
 *    `PERCEPTION_TIERS` — the same five steps art/paint.ts uses for crew.
 *
 * 2. Nothing about him is drawn from the simulation's RNG. See art/bossLook.ts.
 */
export function BossPortrait({
  faction,
  intel,
  scale = 2,
}: {
  faction: Faction;
  intel: number;
  scale?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const skin = currentSkin();
  const leaderName = faction.leader?.name ?? '';

  const buf = useMemo(() => {
    const spec = bossSpecFor(faction);
    if (!spec) return null;
    const { light } = styleFor(faction.personality);
    return fog(renderBoss(spec, light, accentOf(faction.colour)), intel, skin === 'crt');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderName, faction.shortName, faction.colour, faction.leader?.age, intel, skin]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom, and anywhere else without a 2D context
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, BOSS_W * scale, BOSS_H * scale);
    // A second canvas at 1:1, then an integer upscale. Writing ImageData
    // straight to a scaled context would resample it.
    const src = document.createElement('canvas');
    src.width = BOSS_W; src.height = BOSS_H;
    const sctx = src.getContext('2d');
    if (!sctx) return;
    // via createImageData rather than `new ImageData(buf, …)`: the constructor
    // wants its backing buffer to be an ArrayBuffer specifically, and ours is
    // typed as ArrayBufferLike.
    const img = sctx.createImageData(BOSS_W, BOSS_H);
    img.data.set(buf);
    sctx.putImageData(img, 0, 0);
    ctx.drawImage(src, 0, 0, BOSS_W, BOSS_H, 0, 0, BOSS_W * scale, BOSS_H * scale);
  }, [buf, scale]);

  if (!buf) return null;
  return (
    <canvas
      ref={ref}
      className="boss-portrait"
      width={BOSS_W * scale}
      height={BOSS_H * scale}
      aria-hidden="true"
    />
  );
}

/**
 * How much of him you can actually see.
 *
 * The crew sprite fogs by swapping its palette, which this cannot do — there
 * is no palette, only a rendered buffer. So it fogs the way the room would:
 * the light drops away and the figure goes back into it. At tier 0 what is
 * left is a shape against the backdrop, which is exactly what a family you
 * have never worked near should be.
 *
 * Deliberately not a blur. A blurred portrait says "the picture is bad"; a
 * dark one says "you have not been close enough", and the second is the thing
 * that is actually true.
 */
function fog(buf: Uint8ClampedArray, intel: number, crt: boolean): Uint8ClampedArray {
  const tier = tierOf(intel);
  if (tier >= 4 && !crt) return buf;

  /* Held back at each tier, and how far each pixel is pulled toward flat.
     The first pass had tier 1 at 0.46 and the whole tile went to a black
     square — which is tier 0's job, not tier 1's. paint.ts sets the shape of
     this: tier 0 is a silhouette, 1 and 2 are drawn but drained, 3 is very
     nearly the picture. */
  const dark = [0.42, 0.70, 0.86, 0.96, 1][tier];
  const flat = [0.85, 0.52, 0.28, 0.10, 0][tier];
  const out = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    let r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const l = r * 0.30 + g * 0.59 + b * 0.11;
    // toward the room's own near-black rather than toward grey, so a fogged
    // portrait still belongs to the picture it is half of
    r = r + (l * 0.55 + 8 - r) * flat;
    g = g + (l * 0.52 + 7 - g) * flat;
    b = b + (l * 0.56 + 11 - b) * flat;
    if (crt) {
      // The second skin is CGA grey on black; colour cannot carry anything.
      const m = r * 0.30 + g * 0.59 + b * 0.11;
      r = r + (m - r) * 0.85; g = g + (m - g) * 0.85; b = b + (m - b) * 0.85;
    }
    out[i] = r * dark; out[i + 1] = g * dark; out[i + 2] = b * dark;
    out[i + 3] = buf[i + 3];
  }
  return out;
}
