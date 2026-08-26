/**
 * The man running a rival family, drawn.
 *
 * Ported from prototypes/pixel-houses.html, which is where the light and the
 * wardrobe were argued out. Nothing here knows about React, canvas or the
 * simulation — it turns a spec and a light into a 64 x 80 RGBA buffer and
 * stops. Which spec and which light a given family gets is bossLook.ts.
 *
 * WHY THIS IS NOT THE CREW PORTRAIT
 *
 * parts.ts composes 32 x 40 sprites out of palette keys because a crew member
 * is a row in a table and has to read at 1x next to a name. A boss is looked
 * at once, in a panel, and the thing worth saying about him is not his rank —
 * it is which organization he runs. That is carried by light, and light needs
 * a shaded solid rather than flat keys. ART-DIRECTION.md is the standing note
 * on why both grids are correct.
 *
 * The method: one shaded solid for the head and then about thirty deliberate
 * marks. The first version of this stacked four ellipses with four shading
 * functions and the face turned to mush.
 */

export const BOSS_W = 64;
export const BOSS_H = 80;

type RGB = [number, number, number];
type Ramp = RGB[];

const hx = (s: string): RGB => [
  parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16),
];
const R = (...s: string[]): Ramp => s.map(hx);
const mix = (a: RGB, b: RGB, t: number): RGB =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* Ordered dither. Every ramp in this file is stepped through it, which is what
   makes the shading read as pixel art rather than as a downscaled render. */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const thr = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

/* ======================================================================
   PALETTE — one family, several ramps.

   Four skin ramps rather than one ramp sampled at four depths. A single warm
   ramp shaded darker gives grey mud at the bottom, because deep skin does not
   have the same shadow hue as fair skin — it goes cooler and more saturated,
   not simply darker.
   ====================================================================== */
export const SKINS: Record<string, Ramp> = {
  deep:  R('#150c07', '#241408', '#36200e', '#4a2e15', '#5f401f', '#77552c', '#8f6c3d', '#a98955'),
  brown: R('#1c0f08', '#2d1a0c', '#412712', '#57371a', '#6d4a25', '#845e33', '#9c7645', '#b8945f'),
  tan:   R('#231409', '#38210f', '#4f3117', '#684323', '#845a33', '#a17546', '#bd925f', '#d6b184'),
  fair:  R('#2b1a10', '#452a1a', '#5e3b26', '#7b5236', '#996b49', '#b7885f', '#d0a67c', '#e6c69c'),
};
export const HAIRS: Record<string, Ramp> = {
  black:  R('#0e0c0b', '#171412', '#221e19', '#302a23'),
  brown:  R('#140f0b', '#221912', '#33251a', '#463322'),
  pepper: R('#1a1714', '#2e2a25', '#4a453d', '#6b6459'),
  grey:   R('#2e2a25', '#4a453d', '#6b6459', '#948c7e'),
  white:  R('#4a453d', '#6b6459', '#948c7e', '#ccc3b2'),
};
const SHRT: Record<string, Ramp> = {
  white: R('#6b6558', '#948d7c', '#bfb6a0', '#e6ddcd'),
  cream: R('#655d4c', '#8c8270', '#b3a88f', '#ded3bc'),
  blue:  R('#3d4652', '#5a6675', '#7d8a99', '#a8b4c2'),
  ecru:  R('#5e5645', '#847a64', '#a89b80', '#d0c3a2'),
};
const CLOTH: Record<string, Ramp> = {
  charcoal: R('#0d0c0b', '#161513', '#22201d', '#302d29', '#403c37'),
  navy:     R('#0a0d12', '#12161f', '#1c232f', '#2b3441', '#3c4757'),
  brown:    R('#0f0b08', '#1a130d', '#271d14', '#36291d', '#473729'),
  slate:    R('#0d0f10', '#171a1c', '#23282b', '#32393d', '#434c51'),
  tan:      R('#181209', '#2a2113', '#3d3120', '#54452e', '#6b593c'),
  oxblood:  R('#120707', '#200c0b', '#331512', '#48201a', '#5e2c23'),
};
const BRASS = R('#3a2c0c', '#6b5216', '#9c7a22', '#c9a227');
const STEEL = R('#1b1d1e', '#33383a', '#565d60', '#828a8d');

/* ======================================================================
   TYPES
   ====================================================================== */

/** Where a house's light comes from, and what that says about the house. */
export interface BossLight {
  id: string;
  /** For the tooltip. One clause, in the game's voice. */
  where: string;
  /** Key direction. Its x sign decides which side everything is modelled from. */
  key: [number, number, number];
  keyWarm: RGB;
  /** Fill comes from the opposite side to the key; `dir` is that side's sign. */
  fillDir: 1 | -1;
  fillStr: number;
  /** A low bounce, when the house is somewhere that has one. */
  bounce: { from: [number, number]; reach: number; str: number } | null;
  rimSide: 'left' | 'right';
  rimStr: number;
  ambient: number;
  /**
   * Two backdrop ramps: the ground, and whatever the light is coming from.
   * `glowStr` matters more than it looks — at full strength a small radius is
   * a disc hovering behind the subject's ear rather than a lamp.
   */
  backdrop: {
    base: string[]; glow: string[];
    glowAt: [number, number]; glowR: number; glowStr: number;
  };
}

/** Everything that decides what one boss looks like. Derived, never stored. */
export interface BossSpec {
  skin: keyof typeof SKINS;
  hair: keyof typeof HAIRS;
  hairStyle: 'crop' | 'waves' | 'afro' | 'thin' | 'bald' | 'updo' | 'set';
  facial: 'none' | 'tache' | 'goatee' | 'beard' | 'stubble';
  head: 'none' | 'homburg' | 'peaked' | 'brim' | 'wrap';
  headCol?: keyof typeof CLOTH;
  neck: 'banded' | 'tie' | 'open' | 'kerchief';
  tieCol?: keyof typeof CLOTH;
  over: 'coat' | 'jacket' | 'waistcoat' | 'windbreaker';
  overCol?: keyof typeof CLOTH;
  shirt?: keyof typeof SHRT;
  /** -1 narrow .. +1 broad. */
  build: number;
  age: number;
  glasses?: boolean;
  badge?: boolean;
  squint?: boolean;
}

/* ======================================================================
   RENDER
   ====================================================================== */

/**
 * Draw one boss.
 *
 * `accent` is the house colour from config/houses.ts, folded into the fill and
 * the rim so two families under the same light are still two families.
 */
export function renderBoss(s: BossSpec, H: BossLight, accent: RGB): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(BOSS_W * BOSS_H * 4);

  /* x and y are floored here rather than at every call site. They were not,
     and a fractional y produced a fractional index — and writing to a
     fractional index of a typed array is a silent no-op, so every collar on a
     boss whose build put the shoulder line off-grid simply did not draw. */
  const put = (x: number, y: number, c: RGB | null) => {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= BOSS_W || y >= BOSS_H || !c) return;
    const i = (y * BOSS_W + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
  };
  const get = (x: number, y: number): RGB => {
    const i = ((clamp(y | 0, 0, BOSS_H - 1)) * BOSS_W + clamp(x | 0, 0, BOSS_W - 1)) * 4;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  const ramp = (x: number, y: number, cols: Ramp, t: number): RGB => {
    const v = clamp(t, 0, 0.9999) * (cols.length - 1);
    const i = Math.floor(v);
    return (v - i) > thr(x, y) ? cols[Math.min(i + 1, cols.length - 1)] : cols[i];
  };
  /** Multiply a region. The only way a shadow is ever laid down here. */
  const mul = (x0: number, y0: number, x1: number, y1: number, f: number, tint?: RGB) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= BOSS_W || y >= BOSS_H) continue;
      const c = get(x, y);
      put(x, y, tint
        ? [c[0] * f + tint[0], c[1] * f + tint[1], c[2] * f + tint[2]]
        : [c[0] * f, c[1] * f, c[2] * f]);
    }
  };
  /** An ellipse with a shading callback — what a face needs and flat keys never have. */
  const ell = (
    cx: number, cy: number, rxx: number, ryy: number,
    fn: (x: number, y: number, u: number, v: number, z: number) => RGB | null,
  ) => {
    for (let y = Math.floor(cy - ryy); y <= Math.ceil(cy + ryy); y++)
      for (let x = Math.floor(cx - rxx); x <= Math.ceil(cx + rxx); x++) {
        const u = (x - cx) / rxx, v = (y - cy) / ryy, d = u * u + v * v;
        if (d > 1) continue;
        put(x, y, fn(x, y, u, v, Math.sqrt(Math.max(0, 1 - d))));
      }
  };
  const lambert = (nx: number, ny: number, nz: number, L: number[]) =>
    Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);

  /* deterministic noise, so a portrait is the same portrait on every reload */
  let seed = 1;
  const srand = (v: number) => { seed = (v >>> 0) || 1; };
  const rnd = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };

  const SKIN = SKINS[s.skin], HAIR = HAIRS[s.hair], SH = SHRT[s.shirt ?? 'white'];
  const OVER = CLOTH[s.overCol ?? 'charcoal'];
  const b = s.build;
  const rx = 10.6 + b * 1.7, ry = 13.2 + b * 0.5;
  /* Shoulders run off both sides of the frame. Narrow and low gives a giraffe
     neck standing on a cone; a bust is shoulders cropped by the edge. */
  const shRx = 33 + b * 7, shRy = 32 + b * 2, shCy = 88;
  const SH_Y = Math.round(shCy - shRy);      // where cloth starts, ~56. Integer.
  const KEY = H.key, fillD = H.fillDir;
  const kx = KEY[0] < 0 ? -1 : 1;            // which way the key is coming from
  const fill = mix(hx('#7a8496'), accent, 0.55);
  const rim = mix(H.keyWarm, accent, H.rimSide === 'left' ? 0.20 : 0.35);
  /* Deep ramps bottom out into black at the ambient the fair ones want. A
     lift, not a lightening: the ramp is still the ramp, it is where the unlit
     end of it sits that changes. */
  const lift = s.skin === 'deep' ? 0.13 : s.skin === 'brown' ? 0.07 : 0;

  /* ------------------------------------------------------------ backdrop --
     A lit patch behind the near shoulder, and the source of the light on
     screen somewhere, so the fill has a reason. */
  const BASE = R(...H.backdrop.base), GLOW = R(...H.backdrop.glow);
  for (let y = 0; y < BOSS_H; y++) for (let x = 0; x < BOSS_W; x++) {
    const d = Math.hypot((x - (kx < 0 ? 18 : 46)) / 34, (y - 22) / 42);
    put(x, y, ramp(x, y, BASE, 1.00 - d * 0.78));
  }
  {
    const [gx, gy] = H.backdrop.glowAt, gr = H.backdrop.glowR;
    for (let y = 0; y < BOSS_H; y++) for (let x = 0; x < BOSS_W; x++) {
      const e = clamp(1 - Math.hypot((x - gx) / gr, (y - gy) / (gr * 1.2)), 0, 1);
      // squared, so it falls off the way light does rather than as a disc
      if (e > 0) put(x, y, mix(get(x, y), ramp(x, y, GLOW, 0.35 + e * 0.6), e * e * H.backdrop.glowStr));
    }
  }
  srand(0x51a7);
  for (let y = 0; y < BOSS_H; y++) for (let x = 0; x < BOSS_W; x++)
    if (rnd() < 0.012) put(x, y, mix(get(x, y), BASE[BASE.length - 1], 0.30));

  /* Keeping the backdrop makes the silhouette exact. Testing brightness
     instead lights interior edges and puts spikes on the crown. */
  const BG0 = buf.slice();
  const onSubject = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= BOSS_W || y >= BOSS_H) return false;
    const i = (y * BOSS_W + x) * 4;
    return BG0[i] !== buf[i] || BG0[i + 1] !== buf[i + 1] || BG0[i + 2] !== buf[i + 2];
  };

  /** How a surface at this normal is lit, for this house. */
  const shade = (
    x: number, y: number, nx: number, ny: number, nz: number, cols: Ramp, base?: number,
  ): RGB => {
    let t = (base === undefined ? H.ambient : base) + (cols === SKIN ? lift : 0)
      + lambert(nx, ny, nz, KEY) * 0.88;
    t += Math.max(0, nx * fillD) * nz * H.fillStr;
    if (H.bounce) {
      const d = Math.hypot(x - H.bounce.from[0], y - H.bounce.from[1]);
      t += Math.max(0, 1 - d / H.bounce.reach) * Math.max(0, -ny) * H.bounce.str * 1.6;
    }
    return ramp(x, y, cols, t);
  };

  /* ----------------------------------------------------------- shoulders --
     Order matters: shoulders, then the neck standing in front of them, THEN
     the collar closing around the neck. Drawn the other way the neck runs
     down over the shirt and every boss is a head on a pipe. */
  ell(32, shCy, shRx, shRy, (x, y, u, _v, z) => shade(x, y, u * 0.92, -0.28, z * 0.5, OVER, 0.15));

  /* ---------------------------------------------------------------- neck --
     Short, and flaring into the trapezius. A neck that does not widen where
     it meets the shoulders reads as a tube with a head posted onto it. */
  for (let y = 42; y <= SH_Y + 2; y++) {
    const t = clamp((y - 42) / 14, 0, 1);
    const nw = Math.round(5.5 + b * 1.4 + t * t * 5.5);
    for (let x = 32 - nw; x <= 32 + nw; x++) {
      const u = (x - 32) / nw;
      put(x, y, shade(x, y, u * 0.85, -0.15, Math.sqrt(Math.max(0, 1 - u * u)) * 0.7, SKIN, 0.10));
    }
  }
  mul(22, 42, 42, SH_Y + 2, 0.56, [2, 2, 8]);   // the head throws this, and it goes cool

  /* ------------------------------------------------ over the shoulders --- */
  if (s.over === 'coat' || s.over === 'jacket') {
    const spread = s.over === 'coat' ? 0.70 : 0.55;
    for (let y = SH_Y + 2; y < BOSS_H; y++) {
      const g = (y - SH_Y - 2) * spread;
      const iL = Math.round(32 - 3 - g * 0.45), oL = Math.round(32 - 11 - g);
      const iR = Math.round(32 + 3 + g * 0.45), oR = Math.round(32 + 11 + g);
      for (let x = oL; x <= iL; x++) put(x, y, ramp(x, y, OVER, (fillD < 0 ? 0.66 : 0.34) - (y - SH_Y) * 0.004));
      for (let x = iR; x <= oR; x++) put(x, y, ramp(x, y, OVER, (fillD < 0 ? 0.30 : 0.70) - (y - SH_Y) * 0.004));
      /* The lapel fold, as a lit edge. Without it two dark planes of the same
         cloth meet and the coat has no seam, which is the only thing telling
         you it is a coat. */
      put(iL, y, ramp(iL, y, OVER, fillD < 0 ? 0.92 : 0.54)); put(iL - 1, y, OVER[0]);
      put(iR, y, ramp(iR, y, OVER, fillD < 0 ? 0.50 : 0.94)); put(iR + 1, y, OVER[0]);
    }
  }
  if (s.over === 'windbreaker') {
    for (let y = SH_Y + 2; y <= SH_Y + 6; y++) for (let x = 21; x <= 43; x++)
      put(x, y, ramp(x, y, OVER, 0.60 - Math.abs(x - 32) * 0.012));
    mul(21, SH_Y + 6, 43, SH_Y + 8, 0.80);
    for (let y = SH_Y + 4; y < BOSS_H; y++) {
      for (let x = 29; x <= 35; x++) put(x, y, ramp(x, y, OVER, 0.52 + (32 - x) * fillD * 0.05));
      put(32, y, ramp(32, y, STEEL, 0.40 + (y % 2) * 0.34));
    }
  }
  if (s.over === 'waistcoat') {
    /* A solid garment with a V cut out of it, not two braces — two strips
       with the shirt showing between them is a bib. */
    for (let y = SH_Y + 2; y < BOSS_H; y++) {
      const g = (y - SH_Y - 2) * 0.40;
      const iL = Math.round(32 - 2 - g), iR = Math.round(32 + 2 + g);
      for (let x = 14; x <= iL; x++) put(x, y, ramp(x, y, OVER, fillD < 0 ? 0.56 : 0.30));
      for (let x = iR; x <= 50; x++) put(x, y, ramp(x, y, OVER, fillD < 0 ? 0.26 : 0.60));
      put(iL, y, ramp(iL, y, OVER, 0.80)); put(iR, y, ramp(iR, y, OVER, 0.74));
    }
    for (let y = SH_Y + 12; y < BOSS_H; y += 4) {
      const g = (y - SH_Y - 2) * 0.40;
      put(Math.round(32 - 3 - g), y, BRASS[3]); put(Math.round(32 + 3 + g), y, BRASS[1]);
    }
    // the watch chain: kept, not worn
    for (let i = 0; i < 10; i++)
      put(20 + i, 70 + Math.round(Math.sin(i / 10 * Math.PI) * 3), i % 2 ? BRASS[3] : BRASS[2]);
  }

  /* ------------------------------------------------------------- throat --
     The shirt showing in the opening. Only a garment that is actually open
     has one: a banded collar is buttoned to the throat and the coat closes
     under it, so drawing a V there puts a white bib on every boss meant to
     read as closed up. */
  if (s.neck === 'tie' || s.neck === 'open') {
    for (let y = SH_Y + 1; y < BOSS_H; y++) {
      const w = 2 + Math.round((y - SH_Y - 1) * 0.28);
      for (let x = 32 - w; x <= 32 + w; x++)
        put(x, y, ramp(x, y, SH, 0.60 - (y - SH_Y) * 0.012 + (32 - x) * fillD * 0.020));
    }
  }
  if (s.neck === 'banded') {
    for (let y = SH_Y - 4; y <= SH_Y + 2; y++) {
      const w = 5 + Math.round(b * 1.2) + Math.round((y - SH_Y + 4) * 0.45);
      for (let x = 32 - w; x <= 32 + w; x++)
        put(x, y, ramp(x, y, SH, 0.76 - Math.abs(x - 32) * 0.022 + (32 - x) * fillD * 0.014));
    }
    for (let x = 30; x <= 34; x++) put(x, SH_Y - 4, ramp(x, SH_Y - 4, SH, 0.55));
    put(32, SH_Y - 2, BRASS[3]); put(32, SH_Y + 2, BRASS[2]);
    mul(20, SH_Y + 3, 44, SH_Y + 5, 0.78);
  } else if (s.neck === 'tie') {
    for (let y = SH_Y - 4; y <= SH_Y + 1; y++) for (let x = 28; x <= 36; x++)
      put(x, y, ramp(x, y, SH, 0.72));
    // Points, not wings. A 1978 collar point is about six pixels long.
    for (let i = 0; i < 6; i++) {
      const yy = SH_Y - 2 + i;
      put(28 - i, yy, SH[3]); put(29 - i, yy, SH[2]); put(30 - i, yy, SH[1]);
      put(36 + i, yy, SH[2]); put(37 + i, yy, SH[1]); put(38 + i, yy, SH[0]);
    }
    const TIE = CLOTH[s.tieCol ?? 'oxblood'];
    for (let y = SH_Y - 1; y <= SH_Y + 2; y++) for (let x = 30; x <= 34; x++)
      put(x, y, ramp(x, y, TIE, 0.78 + (32 - x) * fillD * 0.06));
    for (let y = SH_Y + 3; y < BOSS_H; y++) {
      const w = 2 + Math.round((y - SH_Y) * 0.15);
      for (let x = 32 - w; x <= 32 + w; x++)
        put(x, y, ramp(x, y, TIE, 0.62 + (32 - x) * fillD * 0.08 - (y - SH_Y) * 0.006));
    }
  } else if (s.neck === 'open') {
    for (let y = SH_Y - 4; y <= SH_Y + 2; y++) for (let x = 27; x <= 37; x++)
      put(x, y, ramp(x, y, SH, 0.70));
    for (let i = 0; i < 6; i++) {
      const yy = SH_Y - 3 + Math.round(i * 1.2);
      put(29 - i, yy, SH[3]); put(30 - i, yy, SH[2]); put(31 - i, yy + 1, SH[1]);
      put(35 + i, yy, SH[2]); put(36 + i, yy, SH[1]); put(37 + i, yy + 1, SH[0]);
    }
    mul(20, SH_Y + 3, 44, SH_Y + 6, 0.86);
  } else {
    const K = CLOTH[s.tieCol ?? 'oxblood'];
    for (let y = SH_Y - 4; y <= SH_Y + 5; y++) for (let x = 19; x <= 45; x++) {
      const e = Math.abs(x - 32) / 13 + (y - SH_Y + 4) / 10;
      if (e > 1.45) continue;
      put(x, y, ramp(x, y, K, 0.78 - e * 0.30 + (32 - x) * fillD * 0.05));
    }
    for (let y = SH_Y + 5; y <= SH_Y + 11; y++) for (let x = 30; x <= 35; x++)
      put(x, y, ramp(x, y, K, 0.60 - (y - SH_Y - 5) * 0.05));
    mul(19, SH_Y + 5, 45, SH_Y + 8, 0.82);
  }
  mul(18, SH_Y - 5, 46, SH_Y + 5, 0.95);       // everything at the throat sits back

  /* ------------------------------------------------------------ the head --
     One shaded solid. Four ellipses with four shading functions turned the
     face to mush; a portrait wants one form and then decisions. */
  ell(32, 34, rx, ry, (x, y, u, v, z) => shade(x, y, u, v, z, SKIN));

  /* jaw — a linear taper gave everybody the same witch's chin. The chin has a
     width of its own and the jawline runs to it on a curve. */
  const jawTop = 36, jawBot = 47 + Math.round(b * 1.5);
  const chinW = 4.6 + b * 1.4;
  for (let y = jawTop; y <= jawBot; y++) {
    const t = (y - jawTop) / (jawBot - jawTop);
    const w = Math.round(rx - Math.pow(t, 1.7) * (rx - chinW));
    for (let x = 32 - w; x <= 32 + w; x++) {
      const u = (x - 32) / Math.max(w, 1);
      put(x, y, shade(x, y, u * 0.85, 0.30, Math.sqrt(Math.max(0, 1 - u * u)) * 0.7, SKIN, 0.09));
    }
  }
  /* Anything drawn on top of the head has to know where the face is, or the
     hair covers the eyes. Hairline at 26, and below it the face wins. */
  const overFace = (x: number, y: number) =>
    y > 26 && Math.hypot((x - 32) / (rx * 0.98), (y - 34) / (ry * 0.98)) < 1;

  // ears, at different exposures — one of them is on the key side
  const er = Math.round(rx);
  for (let y = 32; y <= 39; y++) {
    const lit = kx < 0 ? 0.46 : 0.14, dim = kx < 0 ? 0.14 : 0.46;
    put(32 - er, y, ramp(32 - er, y, SKIN, lit));
    put(32 - er + 1, y, ramp(32 - er + 1, y, SKIN, lit * 0.72));
    put(32 + er, y, ramp(32 + er, y, SKIN, dim));
    put(32 + er - 1, y, ramp(32 + er - 1, y, SKIN, dim * 0.72));
  }

  /* ---------------------------------------------------------- features --
     Few and deliberate. Everything here is a plane change, not a line. */
  for (let x = 32 - Math.round(rx) + 1; x <= 32 + Math.round(rx) - 1; x++) {
    const y = 27 + Math.round(Math.abs(x - 32) * 0.10);
    put(x, y, ramp(x, y, SKIN, 0.70 + (32 - x) * kx * 0.012));
    for (let k = 1; k <= 2; k++) mul(x, y + k, x, y + k, 0.66, [0, 0, 3]);
  }
  const sockA = kx < 0 ? 0.70 : 0.56, sockB = kx < 0 ? 0.56 : 0.70;
  for (let x = 24; x <= 29; x++) for (let y = 29; y <= 32; y++) mul(x, y, x, y, sockA, [0, 0, 2]);
  for (let x = 35; x <= 40; x++) for (let y = 29; y <= 32; y++) mul(x, y, x, y, sockB, [0, 0, 2]);
  // eyes: dark, an iris, one catchlight each. Any more and it is a cartoon.
  rect(25, 30, 28, 31, [22, 16, 13]); rect(36, 30, 39, 31, [19, 14, 12]);
  put(26, 30, [10, 8, 8]); put(37, 30, [9, 7, 7]);
  const catchA = kx < 0 ? 25 : 28, catchB = kx < 0 ? 36 : 39;
  put(catchA, 30, mix(SKIN[6], H.keyWarm, 0.45));
  put(catchB, 30, mix(SKIN[4], H.keyWarm, 0.30));
  for (let x = 23; x <= 30; x++) put(x, 28 - Math.round((x - 23) * 0.2), HAIR[kx < 0 ? 1 : 0]);
  for (let x = 34; x <= 41; x++) put(x, 26 + Math.round((x - 34) * 0.2), HAIR[kx < 0 ? 0 : 1]);
  /* Nose: a lit ridge and a shadow thrown away from the key, no outline.
     Started at the brow and four pixels either side it is a bright column
     down the middle of the face. A nose is narrow, and it starts lower. */
  for (let y = 32; y <= 39; y++) {
    const w = 1 + Math.round((y - 32) * 0.26);
    for (let x = 31 - w; x <= 31 + w; x++)
      put(x, y, ramp(x, y, SKIN, clamp(0.40 + (31 - x) * kx / 22 - (y - 32) * 0.010, 0.10, 0.98)));
    const sx = kx < 0 ? 32 + w : 30 - w;
    mul(sx, y, sx, y, 0.68, [0, 0, 3]);
    mul(sx + kx, y, sx + kx, y, 0.80, [0, 0, 2]);
  }
  put(29, 38, [34, 22, 16]); put(34, 38, [28, 18, 14]);
  for (let x = 28; x <= 35; x++) put(x, 39, ramp(x, 39, SKIN, 0.26));
  for (let x = 28; x <= 36; x++) put(x, 43, [30, 20, 15]);
  for (let x = 28; x <= 36; x++) put(x, 44, ramp(x, 44, SKIN, 0.52 - Math.abs(x - 31 - kx) * 0.03));
  for (let x = 28; x <= 36; x++) put(x, jawBot - 1, ramp(x, jawBot - 1, SKIN, 0.34));
  mul(28, jawBot, 37, jawBot + 2, 0.72);

  /* Age: two lines from the nose and a crease across the brow. Nothing else —
     the moment wrinkles become texture you have drawn a mask. */
  if (s.age >= 52) for (let i = 0; i < 4; i++) {
    mul(28 - i, 40 + i, 28 - i, 40 + i, 0.80); mul(36 + i, 40 + i, 36 + i, 40 + i, 0.84);
  }
  if (s.age >= 62) {
    for (let x = 26; x <= 38; x++) mul(x, 25, x, 25, 0.86);
    for (let x = 25; x <= 29; x++) mul(x, 33, x, 33, 0.88);
    for (let x = 35; x <= 39; x++) mul(x, 33, x, 33, 0.88);
  }
  // thirty years of sun off water, in eight pixels
  if (s.squint) {
    for (let x = 21; x <= 24; x++) { mul(x, 29, x, 29, 0.84); mul(x, 32, x, 32, 0.86); }
    for (let x = 40; x <= 43; x++) { mul(x, 29, x, 29, 0.84); mul(x, 32, x, 32, 0.86); }
    mul(25, 32, 28, 32, 0.90); mul(36, 32, 39, 32, 0.90);
  }

  /* -------------------------------------------------------- facial hair -- */
  if (s.facial === 'tache') {
    for (let y = 40; y <= 42; y++) for (let x = 27; x <= 37; x++) {
      const drop = Math.abs(x - 32) > 3 ? 1 : 0;
      if (y - drop > 42) continue;
      put(x, y, ramp(x, y, HAIR, 0.66 - Math.abs(x - 32) * 0.04 - (y - 40) * 0.14 + (32 - x) * kx * 0.02));
    }
  } else if (s.facial === 'beard') {
    /* A beard follows the jaw, stops at it, and rides UP at the sides into
       the sideburns. Flat-topped from ear to ear is not a beard, it is a
       plaster cast of the lower face. */
    const bBot = jawBot + 2, bMax = rx * 1.02;
    for (let x = Math.round(32 - bMax); x <= Math.round(32 + bMax); x++) {
      const d = Math.abs(x - 32) / bMax;
      const y0 = Math.round(40 - d * d * 8);
      for (let y = y0; y <= bBot; y++) {
        const t = clamp((y - 38) / (bBot - 38), 0, 1);
        if (Math.abs(x - 32) > rx * (1.02 - Math.pow(t, 1.5) * 0.58)) continue;
        if (y >= 42 && y <= 43 && Math.abs(x - 32) <= 4) continue;      // the mouth stays
        put(x, y, ramp(x, y, HAIR, 0.48 - t * 0.22 + (32 - x) * kx * 0.030));
      }
    }
    for (let x = 28; x <= 36; x++) put(x, 43, [26, 18, 14]);
  } else if (s.facial === 'goatee') {
    for (let y = 40; y <= 42; y++) for (let x = 27; x <= 37; x++)
      put(x, y, ramp(x, y, HAIR, 0.60 - (y - 40) * 0.10 + (32 - x) * kx * 0.02));
    for (let y = 45; y <= 51; y++) {
      const w = 5 - Math.round((y - 45) * 0.5);
      for (let x = 32 - w; x <= 32 + w; x++) put(x, y, ramp(x, y, HAIR, 0.50 - (y - 45) * 0.03));
    }
  } else if (s.facial === 'stubble') {
    for (let y = 38; y <= 48; y++) for (let x = 32 - Math.round(rx); x <= 32 + Math.round(rx); x++) {
      if ((x + y) % 2) continue;
      if (y <= 44 && Math.abs(x - 32) <= 4) continue;
      if (Math.hypot((x - 32) / (rx * 1.05), (y - 40) / 9) > 1) continue;
      put(x, y, mix(get(x, y), HAIR[1], 0.42));
    }
  }

  /* -------------------------------------------------------------- hair --
     Drawn as a mass with a lit crown, never as strands. Strands at this scale
     is thirty pixels of noise where a shape should be. */
  const hairCap = (flare: number, drop: number, cy: number, cry: number) => {
    ell(32, cy, rx * flare, cry, (x, y, u, v, z) => {
      if (y > 26 + drop || overFace(x, y)) return null;
      return shade(x, y, u, v - 0.30, z, HAIR, 0.14);
    });
  };
  if (s.hairStyle === 'crop') hairCap(1.06, 2, 25, 11.5);
  if (s.hairStyle === 'waves') {
    hairCap(1.10, 4, 25, 12.0);
    for (let y = 15; y <= 28; y += 2) for (let x = 32 - Math.round(rx); x <= 32 + Math.round(rx); x += 3) {
      const px = x + ((y >> 1) % 2 ? 1 : 0);
      if (!overFace(px, y)) put(px, y, HAIR[3]);
    }
  }
  if (s.hairStyle === 'afro') {
    hairCap(1.52, 11, 25, 15.5);
    // texture as broken value; without it the mass is a dome and reads as a bowl cut
    srand(0x3f1);
    for (let y = 8; y <= 38; y++) for (let x = 8; x <= 56; x++)
      if (!overFace(x, y) && Math.hypot((x - 32) / (rx * 1.52), (y - 25) / 15.5) < 1 && y <= 37)
        put(x, y, mix(get(x, y), rnd() < 0.30 ? HAIR[0] : HAIR[3], rnd() < 0.5 ? 0.40 : 0.16));
  }
  if (s.hairStyle === 'thin') {
    hairCap(1.04, 3, 26, 11.0);
    /* Receded at the temples, leaving a peak in the middle. Two passes got
       this wrong: a wedge of scalp down the centre, which is not a hairline
       any human has, and then the right shape drawn as a rectangle, which put
       a slab of forehead above the skull. */
    ell(32, 26, rx * 0.99, 11.5, (x, y, u, v, z) => {
      const hl = 19 + 5.5 * Math.exp(-Math.pow((x - 32) / 4.5, 2));
      if (y > hl || overFace(x, y)) return null;
      return shade(x, y, u, v - 0.42, z, SKIN, 0.10);
    });
  }
  if (s.hairStyle === 'bald')
    ell(32, 26, rx * 0.99, 10.5, (x, y, u, v, z) =>
      overFace(x, y) ? null : shade(x, y, u, v - 0.4, z, SKIN, 0.10));
  if (s.hairStyle === 'updo') {
    hairCap(1.06, 1, 25, 11.5);
    ell(32, 17, 6.6, 4.0, (x, y, u, v, z) => shade(x, y, u, v, z, HAIR, 0.14));
    mul(26, 20, 38, 21, 0.88);
  }
  if (s.hairStyle === 'set') {
    hairCap(1.26, 9, 25, 12.5);
    for (let x = 32 - Math.round(rx * 1.2); x <= 32 + Math.round(rx * 1.2); x++) {
      const y = 14 + Math.round(Math.pow(Math.abs(x - 32) / (rx * 1.2), 2) * 4);
      put(x, y, ramp(x, y, HAIR, 0.62 + (32 - x) * kx * 0.020));
    }
  }

  /* ---------------------------------------------------------- headwear -- */
  if (s.head === 'homburg' || s.head === 'peaked' || s.head === 'brim') {
    const FELT = CLOTH[s.headCol ?? 'charcoal'];
    if (s.head === 'homburg') {
      // a rounded crown — a flat top plus stray pinch pixels reads as prongs
      const C = [6, 8, 9, 10, 10, 11, 11, 11, 11, 11, 11, 11];
      for (let i = 0; i < C.length; i++) {
        const y = 6 + i, w = C[i] + Math.round(b * 0.6);
        for (let x = 32 - w; x <= 32 + w; x++)
          put(x, y, ramp(x, y, FELT, 0.30 + Math.max(0, (32 - x) * kx / 26) * 0.58 - i * 0.010));
        put(32 - w, y, FELT[kx < 0 ? 1 : 0]); put(32 + w, y, FELT[kx < 0 ? 0 : 1]);
      }
      for (let x = 26; x <= 38; x++) put(x, 6, ramp(x, 6, FELT, 0.70 + (32 - x) * kx * 0.020));
      for (let y = 7; y <= 12; y++) { put(31, y, FELT[1]); put(32, y, FELT[0]); put(33, y, FELT[1]); }
      for (let y = 17; y <= 19; y++) for (let x = 19; x <= 45; x++)
        put(x, y, ramp(x, y, FELT, 0.09 + Math.max(0, (32 - x) * kx / 40) * 0.20));
      // a narrow brim, curled at the edge. A homburg is not a fedora.
      for (let x = 14; x <= 50; x++) {
        const t = (x - 32) / 18, y0 = 19 + Math.round(t * t * 2.0);
        for (let y = y0; y <= y0 + 2; y++)
          put(x, y, ramp(x, y, FELT, 0.48 - (y - y0) * 0.16 + (32 - x) * kx * 0.010));
        put(x, y0, ramp(x, y0, FELT, 0.80 + (32 - x) * kx * 0.014));
        put(x, y0 + 3, FELT[0]);
      }
    }
    if (s.head === 'peaked') {
      // soft round crown, a hard band, a flat peak with a straight shadow edge
      ell(32, 16, 13.5, 8.2, (x, y, u, v, z) =>
        v < 0.55 ? ramp(x, y, FELT, 0.26 + lambert(u, v, z, KEY) * 0.72) : null);
      for (let y = 21; y <= 24; y++) for (let x = 19; x <= 45; x++)
        put(x, y, ramp(x, y, FELT, 0.12 + Math.max(0, (32 - x) * kx / 38) * 0.18));
      for (let x = 19; x <= 45; x++) put(x, 21, ramp(x, 21, FELT, 0.44));
      if (s.badge) { rect(30, 21, 34, 23, BRASS[1]); rect(31, 22, 33, 22, BRASS[3]); }
      for (let x = 15; x <= 49; x++) {
        const t = (x - 32) / 17, y0 = 24 + Math.round(t * t * 1.4);
        for (let y = y0; y <= y0 + 2; y++) put(x, y, ramp(x, y, FELT, 0.34 - (y - y0) * 0.14));
        put(x, y0, ramp(x, y0, FELT, 0.62 + (32 - x) * kx * 0.012));
        put(x, y0 + 3, FELT[0]);
      }
    }
    if (s.head === 'brim') {
      const STRAW = CLOTH.tan;
      ell(32, 16, 12.6, 9.6, (x, y, u, v, z) =>
        v < 0.46 ? ramp(x, y, STRAW, 0.32 + lambert(u, v, z, KEY) * 0.66) : null);
      for (let y = 20; y <= 22; y++) for (let x = 20; x <= 44; x++)
        put(x, y, ramp(x, y, CLOTH.brown, 0.30));
      for (let x = 10; x <= 54; x++) {
        const t = (x - 32) / 22, y0 = 22 + Math.round(t * t * 2.6);
        const th = Math.abs(t) > 0.86 ? 1 : 2;      // thins toward the ends
        for (let y = y0; y <= y0 + th; y++)
          put(x, y, ramp(x, y, STRAW, 0.50 - (y - y0) * 0.15 + (32 - x) * kx * 0.008));
        put(x, y0, ramp(x, y0, STRAW, 0.78 + (32 - x) * kx * 0.012));
        put(x, y0 + th + 1, [14, 10, 7]);
      }
    }
    /* THE shadow — the reason a portrait wants this grid at all. At 32 x 40 a
       brim shadow is one dark row and cannot fall across an eye. */
    const brimY = s.head === 'homburg' ? 19 : s.head === 'peaked' ? 24 : 22;
    const curve = s.head === 'peaked' ? 1.4 : 2.6;
    for (let x = 32 - Math.round(rx) - 2; x <= 32 + Math.round(rx) + 2; x++) {
      const t = (x - 32) / 18, edge = brimY + 9 + Math.round(t * t * curve);
      for (let y = brimY + 2; y <= edge; y++) mul(x, y, x, y, 0.48 + (edge - y) * 0.012, [0, 1, 7]);
    }
    put(catchA, 30, mix(SKIN[5], H.keyWarm, 0.30));   // the eyes still have to read
    put(catchB, 30, mix(SKIN[3], H.keyWarm, 0.22));
  }
  if (s.head === 'wrap') {
    /* A headwrap, drawn as a mass rather than a shell.
     *
     * Three passes got this wrong the same way. Stacked horizontal bands built
     * a fez; an ellipse cut at the hairline built a beret; the same ellipse
     * with folds and a brow band built a slightly better beret. The mistake
     * was drawing something that follows the skull. A wrap does not follow the
     * skull — it is cloth wound around it, so it is TALLER than the head, its
     * widest point is above the brow rather than at the ears, and its front
     * edge is close to straight. */
    const W = CLOTH[s.headCol ?? 'oxblood'];
    const wTop = 8, wBot = 26, wMax = rx * 1.34;
    const wAt = (y: number) => {
      const t = (y - wTop) / (wBot - wTop);
      return wMax * (0.60 + 0.44 * Math.sin(Math.min(1, t * 1.45) * Math.PI * 0.62));
    };
    for (let y = wTop; y <= wBot; y++) {
      const w = wAt(y);
      for (let x = Math.round(32 - w); x <= Math.round(32 + w); x++) {
        if (overFace(x, y)) continue;
        const u = (x - 32) / w, z = Math.sqrt(Math.max(0, 1 - u * u));
        let t = 0.16 + lambert(u, -0.35, z, KEY) * 0.82;
        const band = Math.floor((x * 0.66 + (y - wTop) * 1.55) / 4.5);
        t += (band & 1) ? 0.18 : -0.15;
        put(x, y, ramp(x, y, W, t));
      }
    }
    // a hard edge under every other fold, so they stack instead of blending
    for (let y = wTop; y <= wBot; y++) {
      const w = wAt(y);
      for (let x = Math.round(32 - w); x <= Math.round(32 + w); x++) {
        if (overFace(x, y)) continue;
        const a = Math.floor((x * 0.66 + (y - wTop) * 1.55) / 4.5);
        const c = Math.floor((x * 0.66 + (y + 1 - wTop) * 1.55) / 4.5);
        if (a !== c && (a & 1)) mul(x, y, x, y, 0.68);
      }
    }
    const knx = kx < 0 ? 32 - Math.round(wMax * 0.72) : 32 + Math.round(wMax * 0.72);
    ell(knx, 15, 4.6, 3.6, (x, y, u, v, z) => ramp(x, y, W, 0.32 + lambert(u, v, z, KEY) * 0.80));
    mul(knx - 5, 18, knx + 5, 20, 0.76);
    for (let x = Math.round(32 - wAt(wBot)); x <= Math.round(32 + wAt(wBot)); x++)
      if (!overFace(x, wBot)) mul(x, wBot, x, wBot, 0.58);
    for (let x = 32 - Math.round(rx); x <= 32 + Math.round(rx); x++)
      for (let y = wBot + 1; y <= wBot + 3; y++) mul(x, y, x, y, 0.70, [0, 1, 6]);
  }

  /* -------------------------------------------------------- spectacles -- */
  if (s.glasses) {
    const M: RGB = [28, 24, 20];
    for (let x = 23; x <= 30; x++) { put(x, 28, M); put(x, 33, M); }
    for (let x = 34; x <= 41; x++) { put(x, 28, M); put(x, 33, M); }
    for (let y = 28; y <= 33; y++) { put(23, y, M); put(30, y, M); put(34, y, M); put(41, y, M); }
    for (let x = 31; x <= 33; x++) put(x, 30, M);
    put(22, 29, M); put(42, 29, M);
    // one flash on the lens facing the key, and only one
    const gx = kx < 0 ? 25 : 39;
    put(gx, 29, mix(get(gx, 29), H.keyWarm, 0.55));
    put(gx + 1, 29, mix(get(gx + 1, 29), H.keyWarm, 0.30));
    mul(23, 34, 41, 35, 0.88);
  }

  /* --------------------------------------------------------------- rim --
     The key clips one edge of hat, cheek and shoulder. Which edge is the
     house's decision, and it is most of why two families read apart. */
  if (H.rimSide === 'left') {
    for (let y = 3; y < BOSS_H; y++) for (let x = 1; x < BOSS_W; x++)
      if (onSubject(x, y) && !onSubject(x - 1, y))
        put(x, y, mix(get(x, y), rim, H.rimStr - y / 500));
  } else {
    for (let y = 3; y < BOSS_H; y++) for (let x = BOSS_W - 2; x >= 0; x--)
      if (onSubject(x, y) && !onSubject(x + 1, y))
        put(x, y, mix(get(x, y), rim, H.rimStr - y / 500));
  }
  const farSide = H.rimSide === 'left' ? 1 : -1;
  for (let y = 3; y < BOSS_H; y++) for (let x = 0; x < BOSS_W; x++)
    if (onSubject(x, y) && !onSubject(x + farSide, y))
      put(x, y, mix(get(x, y), fill, 0.20));

  // vignette, last
  for (let y = 0; y < BOSS_H; y++) for (let x = 0; x < BOSS_W; x++) {
    const d = Math.hypot((x - 30) / 40, (y - 40) / 50), c = get(x, y);
    const f = 1 - Math.max(0, d - 0.62) * 0.80;
    put(x, y, [c[0] * f, c[1] * f, c[2] * f]);
  }
  return buf;
}
