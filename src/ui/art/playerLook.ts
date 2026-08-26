/**
 * You, as a picture.
 *
 * WHAT YOU CHOOSE AND WHAT THE GAME CHOOSES
 *
 * Split deliberately, and the split is the whole design:
 *
 *   YOU pick the person — build, skin, hair, facial hair. Things that are
 *   true of you on day one and true of you at Crime Lord.
 *
 *   THE LADDER picks the clothes — hat, garment, suit, shirt, tie — out of
 *   the same `BY_ROLE` table every crew portrait uses. art/look.ts already
 *   says why: "the cloth gets deeper up the ladder; that gradient is most of
 *   what makes the roster legible at a glance." Letting you choose a homburg
 *   and a three-piece on day one would break that gradient for the one person
 *   the player looks at most, and it would contradict the opening line of the
 *   game, which is that you have $2,500 and one man.
 *
 * So the portrait changes when you are promoted, and it is the only readout
 * of rank the player did not have to go and look for. Nobody has to be told
 * this: you get promoted, you are wearing a better coat, and the first time
 * that happens it lands.
 *
 * NOT STORED UNLESS CHOSEN
 *
 * `Player.look` is optional. A save written before any of this loads with
 * nothing there and falls back to a look derived from the name, exactly as a
 * crew member's is — so no migration, and SAVE_VERSION does not move.
 */

import type { CrewLook } from './parts';
import type { Player, PlayerLook, RankId } from '../../sim/types';
import { sexOfName } from '../../sim/names';

export type { PlayerLook };



/* ======================================================================
   THE OPTIONS — what the customiser cycles through.

   Ordered so the first of each is the plainest, because that is what a new
   player sees before touching anything and it should not be a costume.
   ====================================================================== */
export const PLAYER_OPTIONS = {
  build: ['regular', 'slim', 'heavy'] as CrewLook['build'][],
  skin: ['tan', 'deep', 'brown', 'olive', 'fair'],
  hair: ['black', 'brown', 'pepper', 'grey', 'white'],
  hair_style: ['slick', 'bald', 'balding', 'bun', 'bob'] as CrewLook['hair_style'][],
  facial: ['none', 'stubble', 'tache', 'goatee', 'chops', 'walrus', 'beard'] as CrewLook['facial'][],
  hat: [true, false],
};

/** Labels, because 'chops' is not a word the interface should use unglossed. */
export const PLAYER_LABELS: Record<string, Record<string, string>> = {
  build: { slim: 'Lean', regular: 'Average', heavy: 'Heavy' },
  skin: { deep: 'Deep', brown: 'Brown', olive: 'Olive', tan: 'Tan', fair: 'Fair' },
  hair: { black: 'Black', brown: 'Brown', pepper: 'Greying', grey: 'Grey', white: 'White' },
  hair_style: {
    slick: 'Combed back', bald: 'Shaved', balding: 'Thinning', bun: 'Tied up', bob: 'Cut short',
  },
  facial: {
    none: 'Clean', stubble: 'Stubble', tache: 'Moustache', goatee: 'Goatee',
    chops: 'Sideburns', walrus: 'Full moustache', beard: 'Beard',
  },
  hat: { true: 'Worn', false: 'Never' },
};

export const PLAYER_FIELDS: { key: keyof PlayerLook; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'skin', label: 'Skin' },
  { key: 'hair_style', label: 'Hair' },
  { key: 'hair', label: 'Colour' },
  { key: 'facial', label: 'Face' },
  { key: 'hat', label: 'Hat' },
];

export const DEFAULT_PLAYER_LOOK: PlayerLook = {
  build: 'regular',
  skin: 'tan',
  hair: 'black',
  hair_style: 'slick',
  facial: 'none',
  hat: true,
};

/** Anything the customiser can produce, uniformly. Used by "Randomise". */
export function randomPlayerLook(roll: () => number = Math.random): PlayerLook {
  const of = <T,>(list: readonly T[]) => list[Math.floor(roll() * list.length) % list.length];
  return {
    build: of(PLAYER_OPTIONS.build),
    skin: of(PLAYER_OPTIONS.skin),
    hair: of(PLAYER_OPTIONS.hair),
    hair_style: of(PLAYER_OPTIONS.hair_style),
    facial: of(PLAYER_OPTIONS.facial),
    hat: of(PLAYER_OPTIONS.hat),
  };
}

/** FNV-1a, same as art/look.ts. Not the simulation's business. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A starting point derived from the name you typed.
 *
 * So the customiser is never showing a blank, and so a save from before any of
 * this existed still has a face. Reads the name flag the way every other
 * portrait does — see config/names.ts — and a name in no pool gets the neutral
 * treatment rather than an assertion.
 */
export function lookFromName(name: string): PlayerLook {
  const id = name.trim() || 'Nobody';
  const sex = sexOfName(id);
  const of = <T,>(list: readonly T[], salt: string) => list[hash(id + ':' + salt) % list.length];
  const styles: CrewLook['hair_style'][] =
    sex === 'f' ? ['bun', 'bob', 'slick'] : sex === 'm' ? ['slick', 'bald', 'balding'] : ['slick', 'bob'];
  return {
    build: of(PLAYER_OPTIONS.build, 'build'),
    skin: of(PLAYER_OPTIONS.skin, 'skin'),
    hair: of(PLAYER_OPTIONS.hair.slice(0, 3), 'hair'),
    hair_style: of(styles, 'style'),
    facial: sex === 'm' ? of(['none', 'stubble', 'tache'] as CrewLook['facial'][], 'face') : 'none',
    hat: true,
  };
}

/**
 * The whole picture: your half, plus whatever your rank is wearing.
 *
 * The kit is picked off the rank rather than hashed, so it is the same coat
 * for every player at the same rank — which is what makes it read as a
 * uniform you have earned rather than as more randomness.
 */
export function lookForPlayer(player: Player): CrewLook {
  const chosen = player.look ?? lookFromName(player.name);
  const kit = KIT_BY_RANK[player.rank] ?? KIT_BY_RANK.street_criminal;

  const hat = chosen.hat ? kit.hat : 'none';
  return {
    ...chosen,
    hat,
    // A hat covers the hair. Which is why wearing one is your call.
    hair_style: hat === 'none' ? chosen.hair_style : 'none',
    garment: kit.garment,
    suit: kit.suit,
    shirt: kit.shirt,
    tie: kit.tie,
    felt: kit.felt,
    prop: 'none',
  };
}

/**
 * One kit per rung, chosen rather than rolled.
 *
 * art/look.ts picks from a list per role using the person's id, because a
 * roster wants forty men who are not identical. There is only ever one of you
 * and the point here is the opposite: the coat has to be recognisably the
 * rank, so it is fixed.
 *
 * Keyed by rank rather than by mapping rank onto a crew role, which is what
 * the first pass did. Seven ranks onto seven roles looked tidy and put Boss,
 * Underboss and Crime Lord in one coat — three identical portraits at exactly
 * the point in a career where the player has worked hardest for a change.
 * The last two rungs are the whole back half of the game and they get their
 * own cloth.
 */
const KIT_BY_RANK: Record<RankId, {
  hat: CrewLook['hat']; garment: CrewLook['garment'];
  suit: string; shirt: string; tie: string; felt: string;
}> = {
  // Whatever you already owned. Nothing here was bought for the job.
  street_criminal: { hat: 'none',    garment: 'open',  suit: 'bone',     shirt: 'grey',  tie: 'deep',   felt: 'ash' },
  enforcer:        { hat: 'none',    garment: 'roll',  suit: 'olive',    shirt: 'grey',  tie: 'deep',   felt: 'ash' },
  crew_leader:     { hat: 'flatcap', garment: 'open',  suit: 'brown',    shirt: 'cream', tie: 'olive',  felt: 'brown' },
  // The first rung where you are dressed for the room rather than the weather.
  capo:            { hat: 'fedora',  garment: 'tie',   suit: 'charcoal', shirt: 'white', tie: 'blood',  felt: 'black' },
  underboss:       { hat: 'homburg', garment: 'vest',  suit: 'navy',     shirt: 'white', tie: 'brass',  felt: 'black' },
  boss:            { hat: 'homburg', garment: 'vest',  suit: 'charcoal', shirt: 'white', tie: 'blood',  felt: 'black' },
  // The pale hat is the only thing in the game that is purely a display of
  // having arrived, which is the correct note for the last rung.
  crime_lord:      { hat: 'homburg', garment: 'vest',  suit: 'charcoal', shirt: 'white', tie: 'bone',   felt: 'bone' },
};

/** What the rank is dressed in, in words, for the line under the portrait. */
export const KIT_NOTE: Record<RankId, string> = {
  street_criminal: 'Whatever you owned already.',
  enforcer: 'A heavier coat, and nobody asks where it came from.',
  crew_leader: 'A cap, and a jacket that fits.',
  capo: 'A hat and a tie. People stand up now.',
  underboss: 'A waistcoat, and a homburg you did not buy yourself.',
  boss: 'Charcoal and a red tie. Nobody in the room is dressed better.',
  crime_lord: 'A pale hat. You are the only person in the city who can wear it.',
};
