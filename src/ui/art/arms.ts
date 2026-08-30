/**
 * Stamping one piece onto a canvas.
 *
 * The whole renderer, because a rack is a list and a list does not need a
 * scene graph. Same stance as `art/street.ts`: nearest-neighbour, integer
 * scale, and the row-grid painted straight — no smoothing, no filters, and
 * nothing that would make a 48-wide sprite look like anything but one.
 *
 * Decides nothing. The finish comes from the piece's provenance, which
 * `config/pieces.ts` fixes, so two guns that differ only in where they came
 * from are the same shape in different metal — which is the sheet's own trick
 * and the only thing about it worth stealing.
 */
import { PIECE_H, PIECE_SPRITES, PIECE_W, armsPalette } from './armsSprites';

export type Finish = 'blued' | 'blacked' | 'nickel';

export function drawPiece(
  canvas: HTMLCanvasElement,
  defId: string,
  finish: Finish,
  scale: number,
): void {
  const rows = PIECE_SPRITES[defId];
  canvas.width = PIECE_W * scale;
  canvas.height = PIECE_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx || !rows) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const palette = armsPalette(finish);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === '.') continue;
      const hex = palette[key];
      if (!hex) continue;
      ctx.fillStyle = hex;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
