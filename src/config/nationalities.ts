/**
 * Where your people are from, and what that means for who is in the room.
 *
 * 1935 organized crime in an American city was not one culture with one
 * surname list. It was a handful of immigrant communities running rackets in
 * parallel, mostly out of their own neighbourhoods and mostly with their own
 * people — the Italians on one set of blocks, the Irish on another, the Jewish
 * outfits downtown, the tongs in Chinatown. Picking a nationality picks which
 * of those you came up in.
 *
 * What it does **not** do is change a single number. There is no Irish bonus
 * and no Sicilian penalty, and there is not going to be one: an ethnicity that
 * makes you better at crime is a worse idea than it first sounds, and the
 * flavour is doing the work on its own.
 *
 * Two things read this file: your own name when you leave the field blank, and
 * who walks in when you recruit. See `crewMix` for the second, which is the
 * part with an actual design decision in it.
 *
 * ## On the lists
 *
 * These are researched rather than invented, because a made-up Polish surname
 * reads as made-up to anybody Polish and this game's whole texture is that its
 * details hold up. Sources, per pool:
 *
 * - Irish: Matheson's 1890 *Special Report on Surnames in Ireland*, the twenty
 *   most common, which is also the generation that emigrated.
 * - Polish: the common-surname frequency lists, in the de-diacriticked spelling
 *   American paperwork actually used — Wisniewski, not Wiśniewski. Names were
 *   flattened by clerks and by families themselves, not, as the myth has it,
 *   at Ellis Island.
 * - Jewish: the common Ashkenazi surnames of the Eastern European emigration.
 * - Greek: the common-surname lists, patronymic -opoulos and -idis forms.
 * - Chinese: Cantonese romanizations, because almost everybody in an American
 *   Chinatown before the war came from Guangdong and wrote their name the way
 *   Cantonese sounded — Wong and Chan and Cheung, not Wang and Chen and Zhang.
 *
 * ## The pools must stay disjoint
 *
 * No surname may appear in two of them. That is not tidiness: `crewMix` is
 * measured by counting how many of your crew came from your own pool, and a
 * name in two pools makes that count meaningless. A test enforces it.
 */

import { f, m, namesOf, type GivenName } from './names';

export type NationalityId = 'italian' | 'irish' | 'jewish' | 'polish' | 'greek' | 'chinese';

export interface NationalityDef {
  id: NationalityId;
  /** As it appears on the menu. */
  name: string;
  /** One line, in the voice of the rest of the title screen. */
  blurb: string;
  /**
   * Given names, each carrying whether it reads as a man's or a woman's.
   *
   * Every pool here was already written men first and women after — the split
   * was real and lived only in the ordering, which is not somewhere a program
   * can read. The portraits need it (see config/names.ts for what the flag is
   * and is not for), so it is recorded rather than inferred.
   *
   * Cantonese given names carry the distinction more softly than the others;
   * the ordering in that pool is the author's and this only writes it down.
   */
  first: GivenName[];
  last: string[];
}

export const NATIONALITIES: NationalityDef[] = [
  {
    id: 'italian',
    name: 'Italian',
    blurb: 'Little Sicily. Everyone knows your mother, which cuts both ways.',
    first: [
      ...m('Sal', 'Vincent', 'Tommy', 'Gino', 'Marco', 'Dominic', 'Angelo',
        'Rocco', 'Nico', 'Franco', 'Luca', 'Carmine', 'Enzo', 'Bruno', 'Matteo',
        'Silvio', 'Aldo', 'Renzo', 'Vito', 'Paolo', 'Emilio', 'Rico', 'Sandro',
        'Nunzio'),
      ...f('Maria', 'Gina', 'Rosa', 'Lucia', 'Bianca', 'Carla', 'Sofia', 'Elena'),
    ],
    last: [
      'Corveti', 'Marchetti', 'Bellandi', 'Falcone', 'Ricci', 'Sabino',
      'Mercuri', 'Vasari', 'Panetta', 'Loscalzo', 'Ferraro', 'Delgato',
      'Trentini', 'Petrosino', 'Ianello', 'Barone', 'Vaccaro', 'Rinaldi',
      'Serafini', 'Bracco', 'Nardi', 'Salvatore', 'Amato', 'Gallo', 'Rizzo',
      'Testa', 'Bonanno', 'Cutrone', 'Vitale', 'Cordova',
    ],
  },
  {
    id: 'irish',
    name: 'Irish',
    blurb: 'Two generations off the boat. The parish, the docks, and the ward boss.',
    first: [
      ...m('Patrick', 'Michael', 'Seamus', 'Declan', 'Liam', 'Eamon', 'Brendan',
        'Cormac', 'Rory', 'Fergus', 'Colm', 'Niall', 'Sean', 'Danny', 'Dennis',
        'Cornelius', 'Jimmy', 'Terrence', 'Padraig', 'Ruairi'),
      ...f('Bridget', 'Maeve', 'Siobhan', 'Nora', 'Eileen', 'Kathleen',
        'Deirdre', 'Peg', 'Roisin', 'Aoife'),
    ],
    last: [
      'Murphy', 'Kelly', "O'Sullivan", 'Walsh', "O'Brien", 'Byrne', 'Ryan',
      "O'Connor", "O'Neill", "O'Reilly", 'Doyle', 'McCarthy', 'Gallagher',
      'Doherty', 'Kennedy', 'Lynch', 'Murray', 'Quinn', 'Moore', 'Brennan',
      'Donnelly', 'Fitzgerald', 'Hogan', 'Mulligan', 'Coughlin', 'Rafferty',
      'Shea', 'Cassidy', 'Halloran', 'Cavanagh',
    ],
  },
  {
    id: 'jewish',
    name: 'Jewish',
    blurb: 'The Lower East Side. Nobody in your family wanted this for you.',
    first: [
      ...m('Meyer', 'Abe', 'Irving', 'Morris', 'Sol', 'Hyman', 'Benny', 'Louis',
        'Jake', 'Max', 'Nathan', 'Saul', 'Herschel', 'Izzy', 'Moe', 'Sam', 'Lou',
        'Bernie', 'Manny', 'Yitzhak'),
      ...f('Rose', 'Ida', 'Sadie', 'Esther', 'Miriam', 'Bessie', 'Fanny', 'Ruth',
        'Leah', 'Golda'),
    ],
    last: [
      'Cohen', 'Levine', 'Friedman', 'Goldberg', 'Schwartz', 'Rosenberg',
      'Bernstein', 'Kaplan', 'Rabinowitz', 'Blumenthal', 'Eisenberg',
      'Hoffman', 'Katz', 'Shapiro', 'Weiss', 'Adler', 'Feldman', 'Gerson',
      'Rothstein', 'Zelman', 'Lieberman', 'Abramowitz', 'Horowitz', 'Siegel',
      'Weinberg', 'Mandelbaum', 'Tannenbaum', 'Perlman',
    ],
  },
  {
    id: 'polish',
    name: 'Polish',
    blurb: 'The mill wards. Your parents broke their backs for the people you now collect from.',
    first: [
      ...m('Stanislaw', 'Wladyslaw', 'Jozef', 'Kazimierz', 'Tadeusz',
        'Bronislaw', 'Franciszek', 'Zygmunt', 'Henryk', 'Jerzy', 'Marek',
        'Piotr', 'Antoni', 'Stefan', 'Ignacy', 'Wojciech', 'Czeslaw', 'Ryszard'),
      ...f('Jadwiga', 'Wanda', 'Halina', 'Stefania', 'Zofia', 'Irena',
        'Krystyna', 'Danuta', 'Bronislawa', 'Agnieszka'),
    ],
    last: [
      'Kowalski', 'Nowak', 'Wisniewski', 'Wojcik', 'Kowalczyk', 'Kaminski',
      'Lewandowski', 'Zielinski', 'Szymanski', 'Wozniak', 'Dabrowski',
      'Kozlowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski',
      'Nowicki', 'Pawlowski', 'Michalski', 'Adamczyk', 'Dudek', 'Sikora',
      'Baran', 'Walczak', 'Zawadzki', 'Wieczorek', 'Sadowski',
    ],
  },
  {
    id: 'greek',
    name: 'Greek',
    blurb: 'Coffee houses and lunch counters, and a ledger under every till.',
    first: [
      ...m('Yannis', 'Dimitri', 'Christos', 'Stavros', 'Nikos', 'Kostas',
        'Spiros', 'Panos', 'Vasilis', 'Aristotle', 'Theo', 'Manolis', 'Gus',
        'Elias', 'Petros', 'Thanasis', 'Lefteris', 'Apostolos'),
      ...f('Eleni', 'Kaliope', 'Athena', 'Voula', 'Despina', 'Yiota', 'Anthoula',
        'Fotini', 'Stamatia', 'Evanthia'),
    ],
    last: [
      'Papadopoulos', 'Pappas', 'Karagiannis', 'Vlahos', 'Ioannidis',
      'Georgiou', 'Nikolaidis', 'Christodoulou', 'Antoniou', 'Dimitriou',
      'Konstantinidis', 'Alexopoulos', 'Makris', 'Samaras', 'Stamatis',
      'Kefalas', 'Vasilakis', 'Roussos', 'Andreadis', 'Fotiou', 'Spanos',
      'Kalogeras', 'Zervas', 'Katsaros', 'Panagos', 'Mavridis',
    ],
  },
  {
    id: 'chinese',
    name: 'Chinese',
    blurb: 'The tongs run Chinatown, and the police do not come in without asking.',
    /*
       Many men in an American Chinatown also carried an adopted English first
       name for the world outside it — the Charlies and Harrys in every photo
       of the period. Left out of the pool on purpose: those names are already
       in the other lists, and a shared entry would break the disjointness the
       crew mix is measured against. The nicknames handle that register anyway.
    */
    first: [
      ...m('Wing', 'Ming', 'Kai', 'Hing', 'Yuen', 'Cheong', 'Sang', 'Tak', 'Wai',
        'Kwok', 'Chun', 'Shun', 'Fai', 'Hon', 'Yat', 'Lok', 'Bing', 'Hung'),
      ...f('Mei', 'Lin', 'Yuk', 'Siu', 'Wan', 'Ling', 'Suet', 'Oi', 'Kam', 'Fung'),
    ],
    last: [
      'Wong', 'Lee', 'Cheung', 'Lau', 'Chan', 'Yeung', 'Chiu', 'Ng', 'Chow',
      'Ho', 'Lam', 'Tam', 'Mak', 'Yip', 'Fong', 'Louie', 'Quon', 'Soo', 'Woo',
      'Leung', 'Tsang', 'Kwan', 'Hom', 'Jung', 'Moy', 'Toy', 'Seto', 'Wu',
    ],
  },
];

export const NATIONALITY_BY_ID: Record<string, NationalityDef> = Object.fromEntries(
  NATIONALITIES.map((n) => [n.id, n]),
);

/** What a save written before this existed, or a blank pick, resolves to. */
export const DEFAULT_NATIONALITY: NationalityId = 'italian';

export function nationalityDef(id: NationalityId | undefined): NationalityDef {
  return NATIONALITY_BY_ID[id ?? DEFAULT_NATIONALITY] ?? NATIONALITY_BY_ID[DEFAULT_NATIONALITY];
}

/**
 * The given names of a pool, flat and in the authored order.
 *
 * Everything that names somebody draws from this rather than from `first`,
 * and that is what guarantees the flag moved no draw anywhere: `rng.pick` is
 * one call on the seeded stream whatever the list looks like, but only if it
 * is the same list at the same indices. Derived rather than maintained
 * alongside, so the two cannot drift; memoised because it is read once per
 * person generated.
 */
const FLAT = new WeakMap<NationalityDef, string[]>();
export function firstNamesOf(def: NationalityDef): string[] {
  let flat = FLAT.get(def);
  if (!flat) {
    flat = namesOf(def.first);
    FLAT.set(def, flat);
  }
  return flat;
}

/**
 * How much of your crew comes from your own community, and why it varies.
 *
 * An Irish boss should be recruiting mostly Irish, because that is who is on
 * their blocks and who their mother vouches for. But *only* Irish is a caricature
 * — every real outfit had the useful outsider in it, and the mixed ones were
 * the interesting ones. So the share is high and it is never one.
 *
 * The range is per-city rather than fixed, so two careers do not produce the
 * same crew composition twice. At the bottom of the range you are running a
 * genuinely mixed outfit; at the top you are running your own people and one
 * or two others. Both should happen to a player who plays more than once.
 *
 * Derived from the seed with `stableNoise`, which does not advance the random
 * stream. That matters: this is read every time somebody is recruited, and a
 * value that consumed a roll would reshuffle every later draw in the game
 * depending on how many people you happened to hire.
 */
export const CREW_MIX = {
  /** Lowest share of your crew that will be your own people. */
  min: 0.45,
  /** Highest. Never 1 — the outsider is the point. */
  max: 0.85,
} as const;
