/**
 * Which boss, in which room, under which light.
 *
 * Two derivations, from two different places, and keeping them apart is the
 * whole design:
 *
 *   THE HOUSE decides the light and the wardrobe, and it decides them from
 *   its personality — the same four numbers faction.ts weights every decision
 *   by. A careful commercial family is drawn in an office at night because
 *   that is where a careful commercial family is; a family with low caution
 *   and high ambition is drawn outdoors in hard afternoon light because that
 *   is where that one is. So the portrait is not decoration on top of the
 *   simulation, it is a readout of it: you can see how they play before the
 *   intel tells you.
 *
 *   THE MAN decides everything else — build, tone, age lines, hair, whether
 *   he wears glasses — and that is hashed off his name, so a boss is the same
 *   man across a reload and a new boss is a new face.
 *
 * The split is what keeps config/houses.ts honest. That file says a house is
 * "written as a way of doing business, never as a nationality with a
 * temperament attached", and if the art answered that with per-house faces it
 * would quietly make the file a liar. Nothing here reads a house's name, id or
 * colour to decide what a person looks like. The house colour tints the fill
 * and the rim and stops there.
 *
 * The one thing about the boss himself that is not hashed is whether his name
 * reads as a man's or a woman's, which the name pools now carry — see
 * config/names.ts. That is a fact about the name, looked up rather than
 * guessed, and it decides facial hair and which silhouettes are on the table.
 * It is still not a house trait: the same name in either family gets the same
 * answer.
 *
 * Nothing in this file touches sim/rng.ts. That is a seeded stream with
 * determinism tests over it, and taking a draw to decide a hat would shift
 * every subsequent roll in the game — the same rule art/look.ts follows.
 */

import { sexOfName } from '../../sim/names';
import type { Faction } from '../../sim/types';
import type { FactionPersonality } from '../../config/factions';
import type { BossLight, BossSpec } from './bossPortrait';

/** FNV-1a. Small, stable, and not the simulation's business. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const pick = <T,>(id: string, salt: string, from: readonly T[]): T =>
  from[hash(id + ':' + salt) % from.length];
const chance = (id: string, salt: string, p: number) =>
  (hash(id + ':' + salt) % 1000) / 1000 < p;

/* ======================================================================
   1. THE LIGHT — four rooms, chosen by temperament.

   Each obeys itself: one key, one fill from the opposite side, and a bounce
   only where the place would actually have one. That self-consistency is the
   thing ART-DIRECTION.md says has to hold per piece, and here it is also
   what makes four lights read as four kinds of organization.
   ====================================================================== */
export const LIGHTS: Record<string, BossLight> = {
  /* Careful money, indoors, after hours. Steep close key off a desk lamp and
     the cold of the street through a window on the other side. No bounce —
     nobody is lighting this room properly. */
  office: {
    id: 'office',
    where: 'in an office, after everyone has gone',
    key: [-0.46, -0.74, 0.49], keyWarm: [255, 226, 186],
    fillDir: 1, fillStr: 0.30, bounce: null,
    rimSide: 'right', rimStr: 0.30, ambient: 0.145,
    backdrop: {
      base: ['#0a0908', '#100e0c', '#171310', '#201a15', '#2a221b', '#352b22'],
      glow: ['#1a2233', '#26324a', '#33415e'], glowAt: [59, 12], glowR: 15, glowStr: 0.95,
    },
  },
  /* Routes rather than corners. Four in the afternoon on a quay: hard low sun
     off the right, open sky filling the left, and the magenta of a sun going
     down over water coming up under the jaw. */
  quay: {
    id: 'quay',
    where: 'on a quay, late in the afternoon',
    key: [0.62, -0.44, 0.65], keyWarm: [255, 214, 150],
    fillDir: -1, fillStr: 0.34,
    bounce: { from: [32, 74], reach: 26, str: 0.26 },
    rimSide: 'left', rimStr: 0.26, ambient: 0.16,
    backdrop: {
      base: ['#171c22', '#212831', '#2d3640', '#3b4551', '#4c5563', '#5f6675'],
      glow: ['#3d2830', '#6b4152', '#a3637c'], glowAt: [56, 30], glowR: 30, glowStr: 0.95,
    },
  },
  /* Hungry and quick. A street at night under one sodium lamp — hard, high,
     unflattering, and the light is not theirs. */
  street: {
    id: 'street',
    where: 'on a street, under the one lamp that works',
    key: [0.30, -0.86, 0.42], keyWarm: [255, 206, 138],
    fillDir: -1, fillStr: 0.22,
    bounce: { from: [32, 78], reach: 20, str: 0.14 },
    rimSide: 'left', rimStr: 0.34, ambient: 0.10,
    backdrop: {
      base: ['#08080a', '#0e0e12', '#15151b', '#1d1d25', '#262631', '#31313e'],
      glow: ['#3a2c14', '#6b5124', '#9c7a35'], glowAt: [60, 2], glowR: 26, glowStr: 0.70,
    },
  },
  /* Settled, old, and holding. A back room with a lamp low on the table —
     warm, close, and almost nothing beyond it. */
  backroom: {
    id: 'backroom',
    where: 'in a back room, at the table',
    key: [-0.34, -0.30, 0.89], keyWarm: [255, 216, 160],
    fillDir: 1, fillStr: 0.18,
    bounce: { from: [32, 72], reach: 30, str: 0.30 },
    rimSide: 'right', rimStr: 0.22, ambient: 0.13,
    backdrop: {
      base: ['#0b0806', '#120e0a', '#1a1310', '#231a15', '#2d221b', '#382b22'],
      glow: ['#3a2a16', '#5e4423', '#856233'], glowAt: [30, 78], glowR: 30, glowStr: 0.80,
    },
  },
};

/* ======================================================================
   2. THE WARDROBE — what the business puts a man in.

   Four kits, and every one of them is a claim about how the family earns.
   Nothing here is a nationality; a house wearing the closed kit is a house
   that keeps its money where it can watch it, whoever they are.
   ====================================================================== */
interface Wardrobe {
  /*
     Headwear splits the same way hair does, and for the same reason. Fixing
     facial hair alone left the women of a house in homburgs and peaked caps,
     which is the men's kit — so the beards came off and the portraits still
     read as men. `any` is what a name from no pool gets: the pieces that do
     not decide anything.
  */
  heads: { m: BossSpec['head'][]; f: BossSpec['head'][]; any: BossSpec['head'][] };
  necks: BossSpec['neck'][];
  overs: BossSpec['over'][];
  cloth: NonNullable<BossSpec['overCol']>[];
  /** Separate from the coat: sharing one list put people in maroon caps. */
  felt: NonNullable<BossSpec['headCol']>[];
  shirts: NonNullable<BossSpec['shirt']>[];
  accent: NonNullable<BossSpec['tieCol']>[];
  /** Sun on the face for thirty years leaves a mark; an office does not. */
  outdoors: boolean;
  glasses: number;
}
export const WARDROBES: Record<string, Wardrobe> = {
  // Buttoned to the throat. Waistcoats, watch chains, no display.
  closed: {
    heads: {
      m: ['none', 'none', 'homburg', 'homburg'],
      f: ['none', 'none', 'wrap', 'none'],
      any: ['none'],
    },
    necks: ['banded', 'banded', 'tie'],
    overs: ['waistcoat', 'coat'],
    cloth: ['charcoal', 'navy', 'brown'],
    felt: ['charcoal', 'brown', 'oxblood'],
    shirts: ['cream', 'white'],
    accent: ['oxblood', 'slate'],
    outdoors: false, glasses: 0.4,
  },
  // Open collars, a cap, something that has been rained on.
  working: {
    heads: {
      m: ['peaked', 'none', 'brim', 'peaked'],
      f: ['none', 'wrap', 'brim', 'none'],
      any: ['none', 'brim'],
    },
    necks: ['open', 'open', 'kerchief'],
    overs: ['windbreaker', 'jacket'],
    cloth: ['slate', 'navy', 'tan', 'oxblood'],
    felt: ['navy', 'slate', 'charcoal'],
    shirts: ['blue', 'ecru', 'white'],
    accent: ['oxblood', 'brown'],
    outdoors: true, glasses: 0.1,
  },
  // Nothing that would be missed if it had to be left somewhere.
  plain: {
    heads: {
      m: ['none', 'none', 'peaked'],
      f: ['none', 'none', 'wrap'],
      any: ['none'],
    },
    necks: ['open', 'banded'],
    overs: ['jacket', 'windbreaker'],
    cloth: ['charcoal', 'slate', 'brown'],
    felt: ['charcoal', 'slate'],
    shirts: ['white', 'ecru'],
    accent: ['brown', 'slate'],
    outdoors: true, glasses: 0.08,
  },
  // Old money that still dresses for the room it used to own.
  formal: {
    heads: {
      m: ['homburg', 'none', 'none'],
      f: ['none', 'none', 'wrap'],
      any: ['none'],
    },
    necks: ['tie', 'tie', 'banded'],
    overs: ['coat', 'waistcoat'],
    cloth: ['charcoal', 'navy'],
    felt: ['charcoal', 'navy', 'brown'],
    shirts: ['white', 'cream'],
    accent: ['oxblood', 'slate', 'brown'],
    outdoors: false, glasses: 0.35,
  },
};

/* ======================================================================
   3. TEMPERAMENT -> ROOM

   Scored rather than branched, so a house that sits between two kinds gets
   the nearer one instead of falling through a chain of ifs in whatever order
   they happen to be written. Adding a thirteenth house to config/houses.ts
   needs no change here — it gets a room because it has a personality.
   ====================================================================== */
export function styleFor(p: FactionPersonality): { light: BossLight; kit: Wardrobe } {
  /*
     Centred first, and that is not a detail.

     Scored on the raw trait values, four sums with different signs are not on
     comparable scales — `office` adds two traits that are usually near 1 and
     `street` subtracts two of them, so office beat everything and nine of the
     twelve houses in config/houses.ts ended up in the same room. What decides
     which room a family belongs in is not how commercial they are, it is how
     commercial they are *for a family*. 0.7 is the middle of the band the
     personalities are written in.
  */
  const m = 0.7;
  const agg = p.aggression - m, amb = p.ambition - m;
  const com = p.commerce - m, cau = p.caution - m;

  const scores: [string, string, number][] = [
    // Careful and commercial, and enough teeth to still be here.
    ['office', 'closed', com * 1.2 + cau * 1.0 - agg * 0.4],
    // Moves on routes: wants things, is not careful, earns rather than fights.
    ['quay', 'working', amb * 1.3 + com * 0.6 - cau * 0.9],
    // Hungry and quick, and not interested in how it has always been done.
    ['street', 'plain', agg * 1.4 - com * 0.8 - cau * 0.6],
    // Settled or declining: holds ground, does not reach for more.
    ['backroom', 'formal', cau * 1.0 - amb * 1.2 + agg * 0.3],
  ];
  const best = scores.reduce((a, c) => (c[2] > a[2] ? c : a));
  return { light: LIGHTS[best[0]], kit: WARDROBES[best[1]] };
}

/* ======================================================================
   4. THE MAN
   ====================================================================== */
const SKINS: BossSpec['skin'][] = ['deep', 'brown', 'tan', 'fair'];
const FACIAL: BossSpec['facial'][] = ['none', 'none', 'tache', 'stubble', 'goatee', 'beard'];

/*
   Hair, by what the name says and nothing else.
 *
 * This used to be one list for everybody, on the principle that the art must
 * not assert what the simulation does not know. The principle was right and
 * the conclusion was wrong: refusing to decide produced a boss named
 * Antoinette with a full beard, which asserts something considerably louder
 * than choosing would have. The pools carry the fact now — see config/names.ts
 * — so the art reads it instead of guessing.
 *
 * A name in no pool still resolves to nothing, and gets the neutral set: the
 * silhouettes that read as anybody, and no facial hair, because a beard is the
 * mark that does the asserting.
 */
const HAIR_M: BossSpec['hairStyle'][] = ['crop', 'waves', 'afro', 'crop', 'waves'];
const HAIR_F: BossSpec['hairStyle'][] = ['set', 'updo', 'afro', 'waves', 'set'];
const HAIR_ANY: BossSpec['hairStyle'][] = ['crop', 'waves', 'afro'];

/** Age shows in the hair before it shows anywhere else. */
function hairFor(id: string, age: number): BossSpec['hair'] {
  if (age >= 66) return chance(id, 'grey', 0.55) ? 'white' : 'grey';
  if (age >= 56) return chance(id, 'grey', 0.6) ? 'grey' : 'pepper';
  if (age >= 46) return chance(id, 'grey', 0.4) ? 'pepper' : pick(id, 'hair', ['black', 'brown']);
  return pick(id, 'hair', ['black', 'brown', 'black']);
}

/**
 * What this particular boss looks like.
 *
 * Keyed on the leader's name rather than the faction id, so a succession
 * actually changes the face — which is the point of leaders.ts existing. The
 * house's own name is mixed in only so that two families who happen to
 * promote men with the same name do not get the identical portrait.
 */
export function bossSpecFor(faction: Faction): BossSpec | null {
  const leader = faction.leader;
  if (!leader) return null;

  const kit = styleFor(faction.personality).kit;
  const id = `${faction.shortName}/${leader.name}`;
  const sex = sexOfName(leader.name);
  const head = pick(id, 'head', sex === 'm' ? kit.heads.m
    : sex === 'f' ? kit.heads.f : kit.heads.any);

  const styles = sex === 'm' ? HAIR_M : sex === 'f' ? HAIR_F : HAIR_ANY;
  /* Receding is drawn for men only. Women's hair thins too, but at this scale
     the shape reads as a bald man rather than as an older woman, so it would
     be the art getting it wrong in the other direction. */
  const hairStyle: BossSpec['hairStyle'] =
    head !== 'none' ? 'crop'
      : sex === 'm' && leader.age >= 58 && chance(id, 'thin', 0.4)
        ? (chance(id, 'bald', 0.4) ? 'bald' : 'thin')
        : pick(id, 'style', styles);

  return {
    skin: pick(id, 'skin', SKINS),
    hair: hairFor(id, leader.age),
    hairStyle,
    facial: sex === 'm' ? pick(id, 'face', FACIAL) : 'none',
    head,
    headCol: pick(id, 'felt', kit.felt),
    neck: pick(id, 'neck', kit.necks),
    tieCol: pick(id, 'tie', kit.accent),
    over: pick(id, 'over', kit.overs),
    overCol: pick(id, 'cloth', kit.cloth),
    shirt: pick(id, 'shirt', kit.shirts),
    build: ((hash(id + ':build') % 1000) / 1000) * 1.6 - 0.7,
    age: leader.age,
    glasses: chance(id, 'specs', kit.glasses),
    badge: chance(id, 'badge', 0.5),
    squint: kit.outdoors && chance(id, 'squint', 0.7),
  };
}

/** The house colour, as the fill and rim tint. */
export function accentOf(hexv: string): [number, number, number] {
  return [
    parseInt(hexv.slice(1, 3), 16), parseInt(hexv.slice(3, 5), 16), parseInt(hexv.slice(5, 7), 16),
  ];
}
