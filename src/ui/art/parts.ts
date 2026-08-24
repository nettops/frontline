/**
 * Crew portraits: the parts, and how a person is assembled from them.
 *
 * Ported from prototypes/pixel-cast.html, which is where the library was
 * argued out. Nothing here knows about React, canvas or the simulation — it
 * turns a `CrewLook` into a 32 x 40 grid of palette keys and stops.
 *
 * The rule that makes the library multiply instead of accumulate: every part
 * shares an anchor. Every face is the same ten columns wide (x11..x20), every
 * torso opens on the same six (x13..x18), every jaw starts on the same row.
 * That is why any moustache fits any head and any collar fits any build.
 * Break it for one part and that part needs a variant per head.
 */

export const SPRITE_W = 32;
export const SPRITE_H = 40;

/** A drawable part: rows of palette keys stamped at (x, y). '.' skips, '_' erases. */
export interface Part {
  x: number;
  y: number;
  rows: string[];
}

export type Palette = Record<string, string>;

/** Everything that decides what one person looks like. Derived, never stored. */
export interface CrewLook {
  build: 'slim' | 'regular' | 'heavy';
  hat: 'fedora' | 'homburg' | 'flatcap' | 'none';
  hair_style: 'slick' | 'bald' | 'balding' | 'bun' | 'bob' | 'none';
  facial: 'none' | 'tache' | 'walrus' | 'goatee' | 'beard' | 'stubble' | 'chops';
  garment: 'tie' | 'open' | 'vest' | 'roll' | 'scarf';
  prop: 'none' | 'cigar' | 'glasses' | 'scar' | 'pick';
  skin: string;
  suit: string;
  hair: string;
  shirt?: string;
  tie?: string;
  felt?: string;
}

/** The outline never varies: it is what lets a sprite sit on any ground. */
const OUTLINE = '#0c0a09';

export const SKINS: Record<string, string[]> = {
  deep:  ['#2e1c14', '#4a2f21', '#6b452f'],
  brown: ['#3b2519', '#5f3d27', '#855838'],
  olive: ['#5c3a26', '#8a5c3c', '#b3835a'],
  tan:   ['#6b4a33', '#9c6f4c', '#c2926a'],
  fair:  ['#7a5744', '#b08462', '#d6ae8a'],
};
export const SUITS: Record<string, string[]> = {
  charcoal: ['#14120f', '#2b2723', '#443e38'],
  brown:    ['#1a130d', '#332a22', '#4a3d31'],
  navy:     ['#10141a', '#232c38', '#3a4756'],
  olive:    ['#14170f', '#2b3122', '#434a33'],
  bone:     ['#2a2620', '#4a443a', '#6b6355'],
};
export const HAIRS: Record<string, string[]> = {
  black:  ['#17130f', '#2a231c'],
  brown:  ['#2e2118', '#4a382a'],
  pepper: ['#3b352e', '#7a7168'],
  grey:   ['#6b6157', '#9c9083'],
  white:  ['#9c9083', '#ded3bc'],
};
export const SHIRTS: Record<string, string> = { white:'#e6ddcd', cream:'#ded3bc', grey:'#b0a89c' };
export const TIES: Record<string, string> = {
  blood:'#c2352b', brass:'#c9a227', carbon:'#4a6f7a',
  olive:'#6b7f4a', deep:'#6d1b16', bone:'#ded3bc',
};
export const HATFELT: Record<string, string> = { black:'#15110e', brown:'#241d18', ash:'#332a22', bone:'#6b6157' };

export function paletteFor(look: CrewLook): Palette {
  const sk = SKINS[look.skin], su = SUITS[look.suit], ha = HAIRS[look.hair];
  const felt = HATFELT[look.felt ?? 'black'];
  return {
    '0': OUTLINE,
    '1': felt, 'h': su[0],
    '2': su[0], '3': su[1], '4': su[2],
    '7': SHIRTS[look.shirt ?? 'white'],
    'b': TIES[look.tie ?? 'blood'],
    '9': '#c9a227',
    '5': ha[0], '6': ha[1],
    'c': sk[0], 'd': sk[1], 'e': sk[2],
    '8': '#7d6720', 'a': '#9c9083',
  };
}

/* ======================================================================
   2. PARTS

   { x, y, rows } — stamped top-left at (x, y). '.' leaves what is under it,
   '_' erases it. Order matters: torso, garment, neck, face, jaw, brows,
   facial hair, hair, hat, prop. Later parts win, which is why a hat brim
   can shadow a forehead and a beard can bury a mouth.
   ====================================================================== */
const P = (x: number, y: number, ...rows: string[]): Part => ({ x, y, rows });

/* --- torsos. Three widths, one opening: columns 13..18, always. --------- */
const TORSO: Record<string, Part> = {
  slim: P(7, 22,
    '....33......33....',
    '..3333......3333..',
    '.33334......43333.',
    '033334......433330',
    '023334......433320','023334......433320','023334......433320',
    '023334......433320','023334......433320','023334......433320',
    '023334......433320','023334......433320','023334......433320',
    '023334......433320','023334......433320','023334......433320',
    '023334......433320',
    '000000000000000000'),
  regular: P(4, 22,
    '......333......333......',
    '....33333......33333....',
    '..3333334......4333333..',
    '.03333334......43333330.',
    '033333334......433333330',
    '022333334......433333220','022333334......433333220',
    '022333334......433333220','022333334......433333220',
    '022333334......433333220','022333334......433333220',
    '022333334......433333220','022333334......433333220',
    '022333334......433333220','022333334......433333220',
    '022333334......433333220','022333334......433333220',
    '000000000000000000000000'),
  heavy: P(2, 22,
    '.......3333......3333.......',
    '.....333333......333333.....',
    '...33333334......4333333....',
    '.0333333334......43333333330'.slice(0, 28),
    '02233333334......4333333' + '3220',
    '02233333334......43333333220','02233333334......43333333220',
    '02233333334......43333333220','02233333334......43333333220',
    '02233333334......43333333220','02233333334......43333333220',
    '02233333334......43333333220','02233333334......43333333220',
    '02233333334......43333333220','02233333334......43333333220',
    '02233333334......43333333220','02233333334......43333333220',
    '0000000000000000000000000000'),
};

/* --- garments. All six columns wide, all anchored at x=13. -------------- */
const GARMENT: Record<string, Part> = {
  tie: P(13, 22,
    '7....7','77..77',
    '7bbbb7','7bbbb7','7bbbb7','7bbbb7','7bbbb7','7bbbb7',
    '7b99b7','7bbbb7','7bbbb7','7bbbb7','7bbbb7',
    '333333','333333','333333','333333'),
  open: P(13, 22,
    '7....7','77..77','777777','777777','.7777.','..77..',
    '333333','333333','333333','333333','333333','333333',
    '333333','333333','333333','333333','333333'),
  vest: P(13, 22,
    '7....7','77..77',
    '722227','722227','729227','722227','722227','722227',
    '729227','722227','722227','722227','722227',
    '333333','333333','333333','333333'),
  roll: P(13, 21,
    '.4444.','444444','444444',
    '444444','444444','444444','444444','444444','444444',
    '444444','444444','444444','444444',
    '333333','333333','333333','333333','333333'),
  scarf: P(13, 21,
    '.bbbb.','bbbbbb','bbbbbb',
    '7bb..7','7bb..7','3bb..3','3bb..3','3bb..3',
    '333333','333333','333333','333333','333333','333333',
    '333333','333333','333333','333333'),
};

/* --- the face. One box, ten columns, x=11..20. Never changes width. ----- */
const FACE = P(11, 10,
  'cddddddddc',
  'cc0dccd0cc',
  'cdddccdddc',
  'cdeddcdedc',
  'cded00dedc',
  'cddddddddc',
  'cddd00dddc');

const JAW: Record<string, Part> = {
  slim:    P(11, 17, '.cdeeeedc.', '..cddddc..', '...cddc...'),
  regular: P(11, 17, 'cddeeeeddc', '.cddddddc.', '..cddddc..'),
  heavy:   P(10, 17, 'ccddeeeeddcc', '.cddddddddc.', '..cddddddc..'),
};
/* slim takes two columns off the cheeks; heavy adds jowls outside the box. */
const BUILD_MOD: Record<string, Part | null> = {
  slim: P(11, 12, '_c......c_', '_c......c_', '_c......c_', '_c......c_', '_c......c_'),
  regular: null,
  heavy: P(10, 15, 'c..........c', 'c..........c'),
};
const NECK: Record<string, Part[]> = {
  slim:    [P(15, 20, 'cc', 'cc', 'cc'), P(15, 23, 'cc')],
  regular: [P(14, 20, 'cccc', 'cccc', 'cccc'), P(15, 23, 'cc')],
  heavy:   [P(13, 20, 'cccccc', 'cccccc', 'cccccc'), P(14, 23, 'cccc')],
};

/* --- hats and hair ----------------------------------------------------- */
const HAT: Record<string, Part | Part[] | null> = {
  fedora: P(6, 2,
    '......00000000......',
    '.....0111111110.....',
    '....01211221121 0....'.replace(' ', ''),
    '....012112211210....',
    '....011111111110....',
    '...0hhhhhhhhhhhh0...',
    '011111111111111111 0'.replace(' ', ''),
    '.000000000000000000.'),
  homburg: P(7, 3,
    '.....00000000.....',
    '....01111111 10....'.replace(' ', ''),
    '...0111111111 10...'.replace(' ', ''),
    '...011111111110...',
    '..0hhhhhhhhhhhh0..',
    '.011111111111110.',
    '..00000000000000..'),
  flatcap: [P(8, 5,
    '...00000000.....',
    '..0111111111 0...'.replace(' ', ''),
    '.01111111111110.',
    '.01111111111110.',
    '.00000000000000.'),
    P(18, 9, '011110', '.0000.')],
  none: null,
};
const BRIM_SHADOW = P(11, 10, 'cccccccccc');

const HAIR: Record<string, Part | Part[] | null> = {
  slick: P(10, 5, '....0000....', '...555555...', '..55555555..', '.5555555555.', '555555555555'),
  bald:  P(10, 6, '.....00.....', '...0dddd0...', '..0dddddd0..', '.0dddddddd0.'),
  balding: [P(10, 6, '.....00.....', '...0dddd0...', '..0dddddd0..', '.0555555550.'),
            P(10, 10, '5..........5', '5..........5')],
  bun:   [P(10, 5, '....0000....', '...555555...', '..55555555..', '.5555555555.', '555555555555'),
          P(8, 7, '.00.', '0556', '0556', '.00.'),
          P(10, 10, '5..........5', '5..........5', '5..........5')],
  bob:   [P(10, 5, '....0000....', '...555555...', '..55555555..', '.5555555555.', '555555555555'),
          P(10, 10, '5..........5', '5..........5', '5..........5', '5..........5', '5..........5',
                    '5..........5', '55........55', '55........55', '55........55')],
  none: null,
};

/* --- facial hair. All inside the face box, so it fits every head. ------- */
const FACIAL: Record<string, Part | Part[] | null> = {
  none: null,
  tache: P(13, 15, '555555'),
  walrus: [P(12, 15, '55555555'), P(13, 16, '555555')],
  goatee: [P(13, 15, '555555'), P(14, 17, '5555'), P(14, 18, '5555'), P(15, 19, '55')],
  beard: [P(11, 14, '5........5'), P(11, 15, '5555555555'), P(11, 16, '5555555555'),
          P(11, 17, '5555555555'), P(12, 18, '55555555'), P(13, 19, '555555'), P(14, 20, '5555')],
  stubble: [P(11, 16, '5.5.5.5.5.'), P(11, 17, '.5.5.5.5.5'), P(12, 18, '5.5.5.5.'), P(13, 19, '.5.5.5')],
  chops: P(11, 11, '5........5', '5........5', '5........5', '5........5', '5........5'),
};

/* --- props ------------------------------------------------------------- */
const PROP: Record<string, Part | Part[] | null> = {
  none: null,
  cigar: [P(8, 32, 'dd'), P(1, 33, '6b888ded9'), P(6, 34, 'cccc'),
          P(3, 31, 'a'), P(3, 29, 'a'), P(4, 27, 'a')],
  glasses: [P(12, 10, '000..000'), P(12, 11, '0..00..0'), P(12, 12, '000..000')],
  scar: P(19, 12, '0', '0', '0'),
  pick: P(18, 16, '66'),
};
/* The cigar hand hangs off the coat's left edge, which moves with the build. */
const PROP_DX: Record<string, number> = { slim: 3, regular: 0, heavy: -2 };

/* ======================================================================
   3. COMPOSE
   ====================================================================== */
function blank(): string[][] {
  return Array.from({ length: SPRITE_H }, () => Array<string>(SPRITE_W).fill('.'));
}

function stamp(g: string[][], part: Part | Part[] | null, dx?: number): void {
  if (!part) return;
  if (Array.isArray(part)) { part.forEach((p) => stamp(g, p, dx)); return; }
  part.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const k = row[rx];
      if (k === '.') continue;
      const x = part.x + rx + (dx || 0), y = part.y + ry;
      if (x < 0 || x >= SPRITE_W || y < 0 || y >= SPRITE_H) continue;
      g[y][x] = k === '_' ? '.' : k;
    }
  });
}

export function compose(look: CrewLook): string[] {
  const g = blank();
  stamp(g, TORSO[look.build]);
  stamp(g, GARMENT[look.garment]);
  NECK[look.build].forEach((p) => stamp(g, p));
  stamp(g, FACE);
  stamp(g, BUILD_MOD[look.build]);
  stamp(g, JAW[look.build]);
  stamp(g, FACIAL[look.facial]);
  stamp(g, HAIR[look.hair_style]);
  stamp(g, HAT[look.hat]);
  if (look.hat !== 'none') stamp(g, BRIM_SHADOW);   // a brim is why a forehead is dark
  stamp(g, PROP[look.prop], PROP_DX[look.build]);
  return g.map((r) => r.join(''));
}
