/**
 * The street, drawn. Composition only: sprites come from streetSprites.ts
 * (copied from the prototype sheets), facts come from streetLook.ts, and
 * this file just puts one on top of the other. It holds no opinion about
 * the game — give it a different look and it draws a different street.
 *
 * Geometry: a 192 × 72 cell scene. Four frontages of 48 × 40 across the
 * top, their own pavement at the bottom of the grid, then a road band the
 * vehicles park on. Vehicles are 64 × 24, so three parking slots exactly
 * fill the block — the look can name more parked things than that, and the
 * street keeps the three that matter most, law first.
 */
import type { StreetLook } from '../streetLook';
import {
  CAR_FIXED,
  CAR_PAINTS,
  CAR_SPRITES,
  FRONT_BASE,
  FRONT_SPRITES,
  SHELLS,
} from './streetSprites';

export const STREET_W = 192;
export const STREET_H = 88;

/** Roughly where each frontage keeps its door, for walkers with errands. */
export const DOOR_XS = [20, 68, 116, 164];

/** Ordinary cars, for the kerb's spare slots and the traffic lane. */
export const TRAFFIC_POOL = ['coupe', 'wagon', 'beater', 'van', 'pickup', 'sedan'] as const;
const AMBIENT_PAINTS = ['blue', 'olive', 'copper', 'cream', 'teal', 'primer', 'maroon'];

function carPal(name: string): Record<string, string> {
  const p = CAR_PAINTS[name] ?? CAR_PAINTS.black;
  return Object.assign({}, CAR_FIXED, { a: p[0], b: p[1], c: p[2] });
}

/* The fronts palette, ported from the sheet: a shut front is the same
   sprite with the lights out, and night is palette work, not redrawing. */
function frontPal(
  shellName: keyof typeof SHELLS,
  state: 'trading' | 'shut',
  night: boolean,
  sign: string,
): Record<string, string> {
  const sh = SHELLS[shellName];
  const p = Object.assign({}, FRONT_BASE, { a: sh[0], b: sh[1], c: sh[2] });
  if (sign) p['h'] = sign;
  if (sign && state === 'trading') {
    const quiet = ['#4a443a', '#5c5449', '#3d3830', '#332a22'].includes(sign);
    p['i'] = quiet ? '#8a7f66' : '#ded3bc';
  }
  if (night) {
    p['c'] = sh[1];
    p['b'] = sh[0];
    p['s'] = '#15110e';
    p['t'] = '#241d18';
    if (state === 'trading') {
      p['d'] = '#c9a227';
      p['e'] = '#c9a227';
    }
  }
  if (state !== 'trading') {
    p['d'] = '#12161c';
    p['e'] = '#12161c';
    p['i'] = '#4a443a';
    p['h'] = '#2e2a24';
    p['r'] = '#4a2320';
    p['y'] = '#4a3d18';
    p['z'] = '#31424e';
    p['w'] = '#4a443a';
    p['k'] = '#6b6157';
  }
  return p;
}

/*
   The people, authored here rather than ported.

   `pixel-cast.html` settled a character as 32x40 and **half-figure** — head
   and torso, no legs — so there is nothing on any sheet to copy for somebody
   walking. A true full-figure cast variant is a prototype-sheet job and it is
   still owed; what is here is a deliberate second thing, at a twelfth of the
   size, built to the sheets' craft rather than out of their parts.

   Three builds and six palettes, which is what took them from "a count" to
   "a street". The builds differ only in shoulder width and hat, because at
   eleven pixels tall that is the entire vocabulary — anything finer is noise
   the reader cannot resolve. The palettes take the cast library's own skin
   and garment ramps, so the people outside are from the same world as the
   people in the portraits.
*/
const PED_BUILDS = [
  // Ordinary: hat, coat, four wide.
  ['.hh.', '.hh.', '.ff.', 'cccc', 'cccc', 'cccc', '.cc.', '.cc.', '.c.c', '.c.c', '.b.b'],
  // Broader, and bare-headed. Somebody who works outside.
  ['.ff.', '.ff.', '.ff.', 'cccc', 'cccc', 'cccc', 'cccc', '.cc.', '.c.c', '.c.c', '.b.b'],
  // Slighter, longer coat. Reads as a woman or a younger man at this size.
  ['.hh.', '.ff.', '.ff.', '.cc.', 'cccc', 'cccc', 'cccc', '.cc.', '.cc.', '.c.c', '.b.b'],
];
/* The other half of the walk: legs passing. Two frames is a stride at this
   size; a third would be a flourish nobody reads at twelve pixels. */
const PED_BUILD_STEPS = [
  ['.hh.', '.hh.', '.ff.', 'cccc', 'cccc', 'cccc', '.cc.', '.cc.', '.cc.', '.cc.', '.bb.'],
  ['.ff.', '.ff.', '.ff.', 'cccc', 'cccc', 'cccc', 'cccc', '.cc.', '.cc.', '.cc.', '.bb.'],
  ['.hh.', '.ff.', '.ff.', '.cc.', 'cccc', 'cccc', 'cccc', '.cc.', '.cc.', '.cc.', '.bb.'],
];
/** Kept for the still layer, which draws one standing figure per band. */
const PED = PED_BUILDS[0];
const PED_PALS: Record<string, string>[] = [
  { h: '#1c1713', f: '#8a6a4f', c: '#3b3528', b: '#15110e' },
  { h: '#2e2a24', f: '#6f4f37', c: '#4a4436', b: '#15110e' },
  { h: '#3d3d42', f: '#8a6a4f', c: '#26221d', b: '#15110e' },
  // Three more off the cast sheet's ramps: a darker skin, a paler one, and
  // the one coat colour in this palette that is not brown or black.
  { h: '#1c1713', f: '#5f4030', c: '#2a2a2e', b: '#15110e' },
  { h: '#2e2a24', f: '#a68766', c: '#3d5464', b: '#15110e' },
  { h: '#3b2519', f: '#6f4f37', c: '#4f3a22', b: '#15110e' },
];
const CRATE = ['0000000000', '0mmmmMmmm0', '0nnnnMnnn0', '0mmmmMmmm0', '0nnnnMnnn0', '0000000000'];
const CRATE_PAL: Record<string, string> = { '0': '#0c0a09', m: '#5f3d27', n: '#3b2519', M: '#855838' };

/*
   Street furniture, authored here in the sheets' craft: one outline, three
   values, desaturated. Furniture is geography, not state — where a bench
   and a tree sit hashes off the district so every street is its own street,
   and none of it reads anything.
*/
const TREE = [
  '....gg......',
  '..gGggggg...',
  '.gggggGggg..',
  'gGgggggggGg.',
  '.ggGggGggg..',
  '..ggggggg...',
  '...gGgg.....',
  '.....tt.....',
  '.....tt.....',
  '.....tt.....',
  '.....tt.....',
  '.....tt.....',
  '....TTTT....',
];
const TREE_PAL: Record<string, string> = {
  g: '#2c3520', G: '#465a2e', t: '#3b2519', T: '#26221d',
};

const BENCH = [
  '0bbbbbbbbbbbbb0.',
  '.p...........p..',
  '0bbbbbbbbbbbbb0.',
  '0bbbbbbbbbbbbb0.',
  '.p...........p..',
  '.p...........p..',
];
const BENCH_PAL: Record<string, string> = { '0': '#0c0a09', b: '#5f3d27', p: '#1c1713' };

/** Somebody on the bench. A ped with nowhere to be, which is the point. */
const SITTER = ['.hh.', '.ff.', 'cccc', 'cccc', 'cc..', 'cc..'];

const LAMP = [
  '.ww.',
  'wwww',
  '.ww.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  '.tt.',
  'tttt',
];
const lampPal = (night: boolean): Record<string, string> => ({
  w: night ? '#ded3bc' : '#6b6157',
  t: '#26221d',
});

function blit(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  pal: Record<string, string>,
  ox: number,
  oy: number,
  s: number,
): void {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const k = rows[y][x];
      if (k === '.') continue;
      const hex = pal[k];
      if (!hex) continue;
      ctx.fillStyle = hex;
      ctx.fillRect((x + ox) * s, (y + oy) * s, s, s);
    }
  }
}

/** Stable variety without a die roll — same idiom the faces use. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function drawStreet(
  canvas: HTMLCanvasElement,
  look: StreetLook,
  s: number,
  /*
     The animated path passes false and moves the walkers itself; everything
     else — reduced motion, a page the browser is not compositing — gets the
     same people standing still, because the count is a reading and a reading
     must survive the animation being taken away.
  */
  bakePeds = true,
): void {
  canvas.width = STREET_W * s;
  canvas.height = STREET_H * s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = look.night ? '#0a0908' : '#14110d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  look.fronts.slice(0, 4).forEach((f, i) => {
    const def = FRONT_SPRITES[f.id];
    if (!def) return;
    blit(ctx, def.rows, frontPal(def.shell, f.state, look.night, def.sign), i * 48, 0, s);
  });

  /*
     Furniture, then people, then crates — all on the pavement in front of
     the frontages. Positions hash off slot indexes so the same street keeps
     its trees where they were yesterday.
  */
  [45, 141].forEach((x) => blit(ctx, LAMP, lampPal(look.night), x, 25, s));
  const treeXs = [10 + (hash('tree:0') % 60), 100 + (hash('tree:1') % 70)];
  treeXs.forEach((x) => blit(ctx, TREE, TREE_PAL, x, 27, s));
  const benchX = 58 + (hash('bench') % 50);
  blit(ctx, BENCH, BENCH_PAL, benchX, 34, s);

  /*
     People. The first sits on the bench when anybody is out at all — a
     street with life in it has somebody with nowhere to be — and the rest
     walk, spaced by hash and kept off the tree trunks.
  */
  if (look.peds > 0) {
    blit(ctx, SITTER, PED_PALS[2], benchX + 4, 30, s);
  }
  if (bakePeds) {
    for (let i = 0; i < look.peds - 1; i++) {
      const x = 4 + (hash(`ped:${i}`) % (STREET_W - 16));
      blit(ctx, PED, PED_PALS[i % PED_PALS.length], x, 29, s);
    }
  }

  for (let i = 0; i < look.crates; i++) {
    blit(ctx, CRATE, CRATE_PAL, 148 + i * 13, 34, s);
  }

  // The road: kerb line, parking lane, and the open lane the traffic uses.
  ctx.fillStyle = look.night ? '#100d0a' : '#191410';
  ctx.fillRect(0, 40 * s, STREET_W * s, (STREET_H - 40) * s);
  ctx.fillStyle = look.night ? '#241d18' : '#332a22';
  ctx.fillRect(0, 40 * s, STREET_W * s, s);

  /*
     Three kerb slots, the facts first and the unmarked rightmost — parked
     across the street from your fronts is the whole sentence it draws.
     Slots the facts do not need are filled with ordinary cars by the
     traffic band, because "cars that do not belong" only means something
     on a street that also has cars that do.
  */
  /*
     The kerb, in the order things matter.

     Later entries win the three slots, so the loudest facts survive a crowded
     street: a hearse and a burned-out shell are the two that mean somebody is
     not coming back, and an unmarked car is the one the whole scene was built
     around. The ambient traffic below only ever fills what is left.
  */
  const parked: { id: string; paint?: string }[] = [];
  if (look.stripped) parked.push({ id: 'stripped' });
  if (look.car) parked.push({ id: look.car, paint: look.car === 'wedge' ? 'maroon' : look.car === 'towncar' ? 'black' : 'blue' });
  if (look.truck) parked.push({ id: 'boxtruck' });
  if (look.cruiser) parked.push({ id: 'cruiser' });
  if (look.hearse) parked.push({ id: 'hearse' });
  if (look.shell) parked.push({ id: 'burned' });
  if (look.unmarked) parked.push({ id: 'unmarked' });
  const showing = parked.slice(-3);
  for (let slot = 0; showing.length < 3 && slot < look.traffic; slot++) {
    const id = TRAFFIC_POOL[hash(`kerb:${slot}`) % TRAFFIC_POOL.length];
    const paint = AMBIENT_PAINTS[hash(`kerbpaint:${slot}`) % AMBIENT_PAINTS.length];
    showing.unshift({ id, paint });
  }
  showing.forEach((v, i) => {
    const def = CAR_SPRITES[v.id];
    if (!def) return;
    const x = showing.length === 1 ? 64 : i * 64;
    blit(ctx, def.rows, carPal(v.paint ?? def.fixed ?? 'black'), x, 42, s);
  });
}

/*
   Traffic. The moving cars are pure theatre with the same standing as the
   night palette: they carry nothing that is not already in `look.traffic`,
   they never touch the seeded stream, and under prefers-reduced-motion the
   caller simply never asks for them — a still street loses no information,
   because passing cars carry none.

   Each car is pre-rendered once and stamped with drawImage per frame, so a
   frame costs two draw calls rather than a few thousand fills.
*/
export interface PassingCar {
  sprite: HTMLCanvasElement;
  /** In scene cells, so the caller stays scale-agnostic. */
  x: number;
  /** Cells per second, signed — the lane is the sign. */
  speed: number;
  /** Which lane it holds. The far lane runs right, the near lane left. */
  y: number;
}

export function makePassingCar(seed: number, s: number): PassingCar {
  const id = TRAFFIC_POOL[hash(`go:${seed}`) % TRAFFIC_POOL.length];
  const paint = AMBIENT_PAINTS[hash(`gopaint:${seed}`) % AMBIENT_PAINTS.length];
  const rightward = hash(`godir:${seed}`) % 2 === 0;
  const sprite = document.createElement('canvas');
  sprite.width = 64 * s;
  sprite.height = 24 * s;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    if (rightward) {
      // The sheet draws every car nose-left; the oncoming lane is a flip.
      ctx.translate(sprite.width, 0);
      ctx.scale(-1, 1);
    }
    blit(ctx, CAR_SPRITES[id].rows, carPal(paint), 0, 0, s);
  }
  const pace = 34 + (hash(`gospeed:${seed}`) % 30);
  return rightward
    ? { sprite, x: -66, speed: pace, y: 52 }
    : { sprite, x: STREET_W + 2, speed: -pace, y: 62 };
}

/** Somebody out walking — crossing the block, or with a shop to get to. */
export interface Walker {
  x: number;
  /** Cells per second, signed. */
  speed: number;
  pal: number;
  /** Which of the three builds this one is. */
  build: number;
  /** A door worth stopping at, or null for straight across. */
  doorX: number | null;
}

export function makeWalker(seed: number, fromDoor: boolean): Walker {
  const rightward = hash(`wdir:${seed}`) % 2 === 0;
  const pace = (6 + (hash(`wpace:${seed}`) % 7)) * (rightward ? 1 : -1);
  const door = DOOR_XS[hash(`wdoor:${seed}`) % DOOR_XS.length];
  const x = fromDoor ? door : rightward ? -5 : STREET_W + 1;
  // Somebody leaving a shop is going somewhere else; somebody arriving from
  // the edge has an errand here half the time.
  const doorX = fromDoor ? null : hash(`werr:${seed}`) % 2 === 0 ? door : null;
  return {
    x,
    speed: pace,
    pal: hash(`wpal:${seed}`) % PED_PALS.length,
    build: hash(`wbuild:${seed}`) % PED_BUILDS.length,
    doorX,
  };
}

/** Off the pavement, one way or another: through a door, or off the block. */
export function walkerGone(w: Walker): boolean {
  if (w.doorX !== null && Math.abs(w.x - w.doorX) < 1) return true;
  return w.speed > 0 ? w.x > STREET_W + 4 : w.x < -8;
}

/** One frame: the still street underneath, everything that moves over it. */
export function drawLive(
  canvas: HTMLCanvasElement,
  still: HTMLCanvasElement,
  cars: PassingCar[],
  walkers: Walker[],
  s: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(still, 0, 0);
  for (const w of walkers) {
    // The stride is tied to position, not a clock — a walker that stops
    // stops mid-step, and no timer has to exist for the legs.
    const frame =
      Math.floor(w.x / 3) % 2 === 0 ? PED_BUILDS[w.build] : PED_BUILD_STEPS[w.build];
    blit(ctx, frame, PED_PALS[w.pal], Math.round(w.x), 29, s);
  }
  // Far lane first, near lane last, so oncoming traffic passes behind.
  for (const car of [...cars].sort((a, b) => a.y - b.y)) {
    ctx.drawImage(car.sprite, Math.round(car.x) * s, car.y * s);
  }
}
