/**
 * Isometric furniture and person sprites: the same row-string + palette
 * technique `src/ui/art/street.ts` (main repo) uses for the shipped street
 * scene, but every sprite here is drawn as a 3/4 isometric silhouette — a
 * flat top face plus one or two shaded side faces implying volume — instead
 * of a top-down shape. Sized roughly 5 pixel-columns per footprint cell, so
 * a 4x1 counter reads about twice as wide as a 2x1 stove.
 */

export interface IsoSprite {
  rows: string[];
  palette: Record<string, string>;
}

// A small square table, viewed from the iso camera: a flat top face (t) and
// two visible side faces (s = near-left face, S = near-right face, slightly
// darker to read as shadowed) plus four short legs (l).
export const TABLE: IsoSprite = {
  rows: [
    '..tttttt..',
    '.tttttttt.',
    'ttttttttt.',
    'ttttttttt.',
    '.tttttttt.',
    'sssssSSSSS',
    'sssssSSSSS',
    'l........l',
  ],
  palette: { t: '#8a6a4f', s: '#6f5138', S: '#5a4029', l: '#3b2519' },
};

// The standing person: a head, torso, and two visible faces of legs (same
// near-left/near-right shading idea as the table), scaled to stand roughly
// one cell tall in this projection.
export const PERSON: IsoSprite = {
  rows: [
    '.hh.',
    '.hh.',
    '.ff.',
    'cccc',
    'cccc',
    'c.C.',
    'c.C.',
  ],
  palette: { h: '#2e2a24', f: '#8a6a4f', c: '#3b3528', C: '#2a261f' },
};

// Back view of the standing person: same silhouette as PERSON, but the face
// patch is covered by hair colour (nothing to see from behind) and a faint
// centre seam replaces the flat torso fill, so it reads as a distinct pose
// at a glance rather than a recoloured front sprite.
export const PERSON_BACK: IsoSprite = {
  rows: [
    '.hh.',
    '.hh.',
    '.hh.',
    'cccc',
    'cCCc',
    'c.C.',
    'c.C.',
  ],
  palette: { h: '#2e2a24', f: '#8a6a4f', c: '#3b3528', C: '#2a261f' },
};

// Bar counter (footprint 4x1, height 1.1): long and shallow, so the top
// face reads as a thin lens rather than a diamond, with a tall front face
// and a brass rail along the base.
export const BAR_COUNTER: IsoSprite = {
  rows: [
    '..bbbbbbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbbbbbb.',
    'bbbbbbbbbbbbbbbbbbbb',
    'ffffffffffffffffffff',
    'ffffffffffffffffffff',
    'FFFFFFFFFFFFFFFFFFFF',
    'rrrrrrrrrrrrrrrrrrrr',
  ],
  palette: { b: '#6f5138', f: '#4a3624', F: '#332619', r: '#8a6a2f' },
};

// Stove (footprint 2x1, height 1.0): boxy metal appliance. Three burner
// rings across the top (not two, so it doesn't read as a face) plus a
// bright oven-door handle and a knob row on the front — pass 2: the first
// draft's two symmetric burner squares read as eyes on a blank grey head,
// so this adds a third burner and picks out the handle/knobs in a warm
// accent colour to give the front face enough detail to read as an oven.
export const STOVE: IsoSprite = {
  rows: [
    '.tttttttt.',
    'tOtOtOtt..',
    'tttttttttt',
    'ffffffffff',
    'fHHHHHHHff',
    'fkk..kkfff',
    'FFFFFFFFFF',
  ],
  palette: { t: '#5a5a58', O: '#2e1a14', f: '#3d3d3b', H: '#c9c9c2', k: '#8a3a2a', F: '#232322' },
};

// Prep counter (footprint 2x1, height 0.9): stainless top with a cutting
// board patch, flatter front than the stove since there's no oven below.
export const COUNTER: IsoSprite = {
  rows: [
    '.tttttttt.',
    'ttccccttt.',
    'ttttttttt.',
    'ffffffffff',
    'ffffffffff',
    'FFFFFFFFFF',
  ],
  palette: { t: '#9a9a92', c: '#b5895a', f: '#6b6b62', F: '#4a4a44' },
};

// Staff lockers (footprint 2x1, height 1.2 — the tallest object on the
// map): a narrow top and a tall front face divided into two locker doors.
export const LOCKERS: IsoSprite = {
  rows: [
    '.tttttttt.',
    'tttttttttt',
    'f1f1f2f2ff',
    'f1f1f2f2ff',
    'f1f1f2f2ff',
    'f1f1f2f2ff',
    'FFFFFFFFFF',
  ],
  palette: { t: '#4a5a52', f: '#232b26', '1': '#38443c', '2': '#2c352f', F: '#1c211d' },
};

// Back-room desk (footprint 2x1, height 0.9): same wood tone as the table,
// with a drawer pull picked out on the front face.
export const DESK: IsoSprite = {
  rows: [
    '.tttttttt.',
    'tttttttttt',
    'ttttttttt.',
    'ffffffffff',
    'fDDffDDfff',
    'FFFFFFFFFF',
  ],
  palette: { t: '#8a6a4f', f: '#6f5138', D: '#3b2519', F: '#5a4029' },
};

// Host stand (footprint 1x1, height 1.0): a narrow podium, the smallest
// piece of furniture on the map.
export const HOST_STAND: IsoSprite = {
  rows: [
    '.ttt.',
    'ttttt',
    '.fff.',
    '.fff.',
    '.fff.',
    '.FFF.',
  ],
  palette: { t: '#5a4029', f: '#4a3624', F: '#332619' },
};

export const SPRITES: Record<string, IsoSprite> = {
  table: TABLE,
  person: PERSON,
  'bar-counter': BAR_COUNTER,
  stove: STOVE,
  counter: COUNTER,
  lockers: LOCKERS,
  desk: DESK,
  'host-stand': HOST_STAND,
};

// Palette variants for spawned people, same idea as street.ts's PED_PALS:
// a handful of skin/coat combinations cycled by a stable hash of the
// spawn's id so the same map always casts the same-looking crew.
export const PERSON_PALETTES: Record<string, string>[] = [
  { h: '#2e2a24', f: '#8a6a4f', c: '#3b3528', C: '#2a261f' },
  { h: '#1c1713', f: '#6f4f37', c: '#4a4436', C: '#332e26' },
  { h: '#3d3d42', f: '#a68766', c: '#26221d', C: '#1c1916' },
  { h: '#1c1713', f: '#5f4030', c: '#2a2a2e', C: '#1e1e21' },
];

/** Stable variety without a die roll — same idiom street.ts's hash() uses. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Rasterize one sprite to an offscreen canvas at `scale` px per pixel-row-unit. */
export function blitIsoSprite(sprite: IsoSprite, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = Math.max(...sprite.rows.map((r) => r.length));
  canvas.width = width * scale;
  canvas.height = sprite.rows.length * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === '.' || !sprite.palette[key]) continue;
      ctx.fillStyle = sprite.palette[key];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return canvas;
}
