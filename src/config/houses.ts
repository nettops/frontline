/**
 * Who is in the city this time.
 *
 * The map is hand-authored and stays that way. Twelve districts, an adjacency
 * that makes expansion have a front line, and a Downtown that is rich and
 * heavily policed because that is what makes it worth fighting over — a
 * generated map would be a worse map, and the whole game is balanced against
 * this one.
 *
 * What was fixed and should not have been is everything *on* it. The same three
 * families sat in the same three corners with the same temperaments in every
 * game ever played, which meant the opening was solved after two runs. So:
 *
 *   houses    three drawn from twelve, with their own names and characters
 *   seats     which corner of the city each of them starts in
 *   character district wealth and population jittered per seed
 *
 * A player who has run this twenty times still knows the board. They do not
 * know who is on the waterfront, whether the family next door is the patient
 * kind or the kind that shoots first, or whether Riverside is worth anything
 * this time.
 */

import type { FactionPersonality } from './factions';
import { f, m, type GivenName } from './names';

export interface HouseDef {
  id: string;
  name: string;
  shortName: string;
  colour: string;
  blurb: string;
  /** How they are spoken about before you know anything concrete. */
  reputation: string;
  /**
   * What the men who run this house tend to be called.
   *
   * Optional, and most houses do not set it: the default pool in
   * factionLeaders.ts covers a family that has been in the city long enough
   * that nobody asks. A house set apart by having come from somewhere gets its
   * own list, so the succession log reads like the family it is about.
   *
   * Each name carries whether it reads as a man's or a woman's, which is the
   * only thing the portraits are allowed to know about it — see config/names.ts
   * for what that is and is not for.
   */
  firstNames?: GivenName[];
  personality: FactionPersonality;
  /** Wealth and muscle at the founding, before the per-seed jitter. */
  wealth: number;
  strength: number;
}

/*
 * Twelve houses, four temperaments.
 *
 * The personalities are spread deliberately rather than rolled: two families
 * that are both cautious and commercial produce a quiet city where nothing
 * happens, and a draw that can produce one is a draw that will. `newHouses`
 * takes one from each of three different temperament groups.
 *
 * A house is written as a way of doing business, never as a nationality with
 * a temperament attached. Beauvais are careful because they have lost
 * everything once; Rowe are indifferent to territory because their money is in
 * routes rather than corners. Those are strategies the AI actually plays, and
 * they are the only reason either house is in the pool.
 */
export const HOUSES: HouseDef[] = [
  {
    id: 'falcone',
    name: 'The Falcone Family',
    shortName: 'Falcone',
    colour: '#8f4a3c',
    blurb:
      'The oldest outfit in the city and the most comfortable. They hold what they hold and they have held it a long time.',
    reputation:
      'Everybody knows the Falcone. Nobody can remember the last time they had to prove anything.',
    personality: { aggression: 0.55, ambition: 0.35, commerce: 0.8, caution: 0.9 },
    wealth: 900_000,
    strength: 78,
  },
  {
    id: 'vasari',
    name: 'The Vasari Organization',
    shortName: 'Vasari',
    colour: '#4a6f7a',
    blurb:
      'Traders before anything else. Everything that moves through their ground has been counted by somebody who answers to them.',
    reputation: 'Practical, patient, and they own more than anyone admits.',
    personality: { aggression: 0.4, ambition: 0.6, commerce: 1.0, caution: 0.6 },
    wealth: 620_000,
    strength: 62,
  },
  {
    id: 'kestler',
    name: 'The Kestler Crew',
    shortName: 'Kestler',
    colour: '#6b7f4a',
    blurb:
      'Newer, smaller, and less interested in how things have always been done. They take what nobody is watching.',
    reputation: 'Nobody had heard of them five years ago. They are not careful and it has not cost them yet.',
    personality: { aggression: 1.0, ambition: 0.95, commerce: 0.4, caution: 0.3 },
    wealth: 240_000,
    strength: 45,
  },
  {
    id: 'moreau',
    name: 'The Moreau Interests',
    shortName: 'Moreau',
    colour: '#7a5a86',
    blurb:
      'Lawyers, permits and a great many entirely legitimate companies. They have not needed to threaten anybody in eleven years.',
    reputation: 'Nobody is certain they are a family at all, which is the arrangement they prefer.',
    personality: { aggression: 0.25, ambition: 0.5, commerce: 1.25, caution: 1.1 },
    wealth: 1_100_000,
    strength: 48,
  },
  {
    id: 'delgado',
    name: 'The Delgado Brothers',
    shortName: 'Delgado',
    colour: '#a06a2c',
    blurb:
      'Four of them, and the city has never worked out which one to talk to. Everything is a family matter and every family matter is everybody else’s problem.',
    reputation: 'Loud, close, and impossible to buy off one at a time.',
    personality: { aggression: 0.85, ambition: 0.7, commerce: 0.55, caution: 0.45 },
    wealth: 420_000,
    strength: 70,
  },
  {
    id: 'okonkwo',
    name: 'The Okonkwo Concern',
    shortName: 'Okonkwo',
    colour: '#3f7a5e',
    blurb:
      'Came up out of the freight yards inside a decade. Better organised than anybody twice their age and entirely uninterested in tradition.',
    reputation: 'Everyone who underestimated them is doing something else now.',
    personality: { aggression: 0.6, ambition: 1.05, commerce: 0.85, caution: 0.5 },
    wealth: 480_000,
    strength: 58,
  },
  {
    id: 'sokolov',
    name: 'The Sokolov Group',
    shortName: 'Sokolov',
    colour: '#6d6f8c',
    blurb:
      'Arrived from somewhere else with money nobody can trace and no interest in explaining any of it. They do not sit down with people.',
    reputation: 'Nobody knows what they want, which is why nobody has stopped them.',
    personality: { aggression: 0.9, ambition: 0.8, commerce: 0.7, caution: 0.75 },
    wealth: 760_000,
    strength: 66,
  },
  {
    id: 'brannigan',
    name: 'The Brannigan Outfit',
    shortName: 'Brannigan',
    colour: '#9a4f5f',
    blurb:
      'Union halls, building sites and every hiring gate in their half of the city. They do not own the work; they own who gets it.',
    reputation: 'A word from them and three hundred men do not turn up on Monday.',
    personality: { aggression: 0.7, ambition: 0.55, commerce: 0.75, caution: 0.65 },
    wealth: 700_000,
    strength: 72,
  },
  {
    id: 'castellan',
    name: 'The Castellan Family',
    shortName: 'Castellan',
    colour: '#8a7434',
    blurb:
      'Very old, very careful, and down to two districts from six. Everything they do now is about not being the ones who lost it.',
    reputation: 'A great house on the way down, which is the most dangerous kind.',
    personality: { aggression: 0.75, ambition: 0.3, commerce: 0.6, caution: 1.15 },
    wealth: 350_000,
    strength: 55,
  },
  {
    id: 'rask',
    name: 'The Rask Company',
    shortName: 'Rask',
    colour: '#5c7f8f',
    blurb:
      'One man and an accountant, and somehow four districts. Nobody can point to a single thing they have done.',
    reputation: 'Quiet to the point of being a rumour. The quiet is not restraint.',
    personality: { aggression: 0.5, ambition: 0.85, commerce: 0.95, caution: 1.0 },
    wealth: 830_000,
    strength: 51,
  },
  {
    id: 'beauvais',
    name: 'The Beauvais Family',
    shortName: 'Beauvais',
    colour: '#4f5f9a',
    blurb:
      'Arrived with capital, a family name and a long memory of losing both. The money moves through eleven small businesses and never sits anywhere long enough to be counted.',
    reputation: 'They have been on the wrong end of one bad year already. There will not be a second.',
    firstNames: [
      ...m('Fritznel', 'Dieudonné', 'Renaud', 'Josaphat', 'Wilner', 'Lucien', 'Ossé', 'Prosper'),
      ...f('Marcelle', 'Yolande', 'Ghislaine', 'Carmelle', 'Edwidge', 'Micheline',
           'Roselene', 'Antoinette'),
    ],
    // Dispossessed once, and the lesson they took from it was not to be gentle.
    // The first pass had them at 0.45 aggression, which put a third quiet
    // earner in the pool and produced exactly the city this file warns about:
    // no rival attacked anybody in a whole sample. Frightened money is the
    // dangerous kind — same note the Castellan carry.
    personality: { aggression: 0.8, ambition: 0.5, commerce: 0.95, caution: 1.1 },
    wealth: 810_000,
    strength: 50,
  },
  {
    id: 'rowe',
    name: 'The Rowe Combine',
    shortName: 'Rowe',
    colour: '#8f4f7a',
    blurb:
      'Boats, produce, and a way out of the city for anything that fits in a crate. They care what moves and when, not who is standing on which corner.',
    reputation: 'They have never once argued about a street. They do not think in streets.',
    firstNames: [
      ...m('Winston', 'Delroy', 'Everton', 'Neville', 'Lascelles', 'Errol',
           'Byron', 'Ossie', 'Clovis'),
      ...f('Icilda', 'Enid', 'Merlene', 'Doreen', 'Pearline', 'Vashti', 'Ivorine'),
    ],
    // Indifferent to turf, which is not the same as harmless: they move on a
    // route the moment it is worth more than the trouble, and the ambition is
    // what makes them expand rather than settle.
    personality: { aggression: 0.6, ambition: 0.95, commerce: 1.05, caution: 0.55 },
    wealth: 560_000,
    strength: 60,
  },
];

/** Grouped by temperament, so a draw cannot produce three of the same city. */
export const HOUSE_GROUPS: string[][] = [
  // Settled and commercial.
  ['falcone', 'moreau', 'rask'],
  // Traders and organisers.
  ['vasari', 'okonkwo', 'brannigan', 'rowe'],
  // Hungry and quick to move.
  ['kestler', 'delgado'],
  // Old money, frightened.
  ['castellan', 'sokolov', 'beauvais'],
];

/**
 * Where a family sits at the founding.
 *
 * Four seats for three houses, so one corner of the city is always genuinely
 * open — which is where a player who has run this before will go, and it will
 * not be the same corner.
 */
export interface SeatDef {
  id: string;
  /** For the log line on day one. */
  name: string;
  influence: Record<string, number>;
}

export const SEATS: SeatDef[] = [
  {
    id: 'centre',
    name: 'the centre',
    influence: {
      downtown: 62,
      the_heights: 48,
      old_quarter: 40,
      northside: 30,
      garment_district: 22,
    },
  },
  {
    id: 'water',
    name: 'the waterfront',
    influence: {
      the_docks: 55,
      southport: 44,
      warehouse_district: 38,
      riverside: 24,
      little_sicily: 12,
    },
  },
  {
    id: 'rail',
    name: 'the yards',
    influence: {
      rail_yards: 42,
      fairgrounds: 36,
      garment_district: 30,
      warehouse_district: 20,
    },
  },
  {
    id: 'north',
    name: 'the north side',
    influence: {
      northside: 50,
      the_heights: 38,
      fairgrounds: 30,
      old_quarter: 24,
    },
  },
];

/**
 * Per-seed variation in what a district is like.
 *
 * Applied to the *live* prosperity and population, not to the config figures,
 * so the founding character in territories.ts stays the reference every readout
 * compares against. Modest bands: Downtown must still be the rich one or the
 * map stops meaning what the whole game is balanced against.
 */
export const CHARACTER_JITTER = {
  prosperity: [0.85, 1.18] as [min: number, max: number],
  population: [0.88, 1.14] as [min: number, max: number],
};

/** Founding wealth and muscle wobble too. Nobody starts the same twice. */
export const FOUNDING_JITTER = {
  wealth: [0.75, 1.3] as [min: number, max: number],
  strength: [0.85, 1.15] as [min: number, max: number],
};
