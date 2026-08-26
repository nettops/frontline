import { useEffect, useMemo, useRef } from 'react';
import type { Player } from '../sim/types';
import { compose, paletteFor, SPRITE_H, SPRITE_W } from './art/parts';
import { lookForPlayer } from './art/playerLook';
import { paint, resolve } from './art/paint';
import { currentSkin } from './skin';

/**
 * You.
 *
 * The one portrait in the game that is never fogged. `art/paint.ts` resolves
 * a crew member by familiarity and `BossPortrait` resolves a rival by intel,
 * because both are questions about how well you know somebody. Neither
 * question applies here, so this is always drawn at the top tier — a game
 * that showed you your own face as a silhouette would be making a point it
 * does not have.
 *
 * Lit, too. `isLit` is the top familiarity tier and you are past it.
 */
export function PlayerPortrait({ player, scale = 2 }: { player: Player; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const skin = currentSkin();
  const look = useMemo(() => lookForPlayer(player), [player.look, player.name, player.rank]);
  const rows = useMemo(() => compose(look), [look]);
  // `resolve` at full familiarity is a pass-through except under the CRT skin,
  // which it still has to run for — that one is grey on black by design.
  const palette = useMemo(() => resolve(paletteFor(look), 100), [look, skin]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom, and anywhere else without a 2D context
    paint(ctx, rows, palette, scale, true);
  }, [rows, palette, scale]);

  return (
    <canvas
      ref={ref}
      className="crew-portrait"
      width={SPRITE_W * scale}
      height={SPRITE_H * scale}
      aria-hidden="true"
    />
  );
}
