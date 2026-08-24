import { useEffect, useMemo, useRef } from 'react';
import type { Npc } from '../sim/types';
import { compose, paletteFor, SPRITE_H, SPRITE_W } from './art/parts';
import { lookFor } from './art/look';
import { isLit, paint, resolve, tierLabel } from './art/paint';
import { currentSkin } from './skin';

/**
 * A crew member, drawn at the resolution you have earned.
 *
 * Deliberately not a photograph of anybody: the look is derived from the id
 * (see art/look.ts, which takes no draw from the simulation's RNG) and how
 * much of it you can see is the familiarity tier (see art/paint.ts). Below the
 * first tier this is a silhouette on purpose — that is the same rule
 * `perceive()` and `memories.ts` already follow, applied to the picture.
 */
export function CrewPortrait({ npc, scale = 1 }: { npc: Npc; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const skin = currentSkin();

  // The grid depends on who he is; the colours depend on that and on the skin.
  const rows = useMemo(() => compose(lookFor(npc)), [npc.id, npc.role, npc.age]);
  const palette = useMemo(
    () => resolve(paletteFor(lookFor(npc)), npc.familiarity),
    [npc.id, npc.role, npc.age, npc.familiarity, skin],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom, and anywhere else without a 2D context
    paint(ctx, rows, palette, scale, isLit(npc.familiarity));
  }, [rows, palette, scale, npc.familiarity]);

  return (
    <canvas
      ref={ref}
      className="crew-portrait"
      width={SPRITE_W * scale}
      height={SPRITE_H * scale}
      title={tierLabel(npc.familiarity)}
      aria-hidden="true"
    />
  );
}
