/**
 * Game state construction.
 *
 * Everything the simulation needs lives in one plain, JSON-serialisable
 * object. No classes, no Maps, no Dates — so saving is JSON.stringify and
 * loading is JSON.parse, and there is nothing to reconstruct.
 */

import { Rng } from './rng';
import type {
  Attributes,
  DifficultyId,
  Faction,
  FactionBond,
  GameMode,
  GameState,
  Territory,
} from './types';
import { CHARACTER_JITTER } from '../config/houses';
import {
  HOME_TERRITORY,
  SENTIMENT_START,
  STARTING_HOME_INFLUENCE,
  TERRITORIES,
  TERRITORY_BY_ID,
} from '../config/territories';
import {
  ALL_FACTIONS,
  RIVAL_IDS,
  STARTING_RESPECT_FOR,
  type FactionId,
} from '../config/factions';
import { addLog } from './util';
import { addNote, generateNpc } from './npc';
import { newLeader } from './leaders';
import { newCapos } from './capos';
import { drawHouses, foundingStrength, foundingWealth, type HouseDraw } from './houses';
import { newCity } from './perception';
import { newContraband } from './contraband';
import { newMarket } from './market';
import { newHeatChannels } from './heat';
import { refreshRecruits } from './crew';
import { newLawEnforcement } from './investigation';
import { SANDBOX_STARTS, SANDBOX_START_BY_ID } from '../config/modes';
import {
  STARTING_ATTRIBUTES,
  STARTING_CASH,
  STARTING_DIRTY_CASH,
  STARTING_FEAR,
  STARTING_RESPECT,
} from '../config/economy';

/**
 * Bump when the shape changes in a way old saves cannot survive.
 * v2 added territories, businesses and the clean-cash rank requirements.
 * v3 added rival factions with their own wealth, heat and objectives.
 * v4 added investigations, and evidence traces now attach to cases.
 * v5 replaced the single rival relationship with a full N-by-N matrix.
 * v6 added succession and city-wide world conditions.
 * v7 added the game mode, so a save knows which of the three it belongs to.
 * v8 is the deep-simulation pass: people have goals and opinions of each
 *    other, families have leaders and agendas, the city has an opinion of all
 *    of it, and fear is no longer the same currency as standing.
 * v9 gave the families beliefs. They no longer read the truth about who did
 *    what to them; they work it out, and they can be wrong.
 * v10 replaced the single relationship score with a bond: grudge, respect and
 *     trust, and war as a date rather than the bottom of a scale.
 * v11 gave people episodic memory and gave fronts a health of their own, so a
 *     business can go under without anybody closing it.
 * v12 added the two trades: a supply chain with stock that can be seized,
 *     routes through districts you hold, and arms you can sell to the people
 *     who will use them on you.
 * v13 is the long economy: a market cycle measured in years, a price index
 *     every figure in the game is quoted in, money you can borrow, districts
 *     whose prosperity and population move, heat with three channels instead
 *     of one, rival families with an inside, and a city generated per seed.
 */
export const SAVE_VERSION = 13;

export interface NewGameOptions {
  name: string;
  difficulty: DifficultyId;
  /** Defaults to the real game. */
  mode?: GameMode;
  /** Sandbox only: which starting position. Ignored in the other modes. */
  sandboxStart?: string;
  /** Omit for a random world. Pass one to reproduce a specific game. */
  seed?: number;
}

/**
 * The board at day one: rivals sit on the influence the config gives them,
 * and you have a foothold in the neighbourhood you are from and nowhere else.
 */
function buildTerritories(
  rng: Rng,
  draws: HouseDraw[],
  homeInfluence = STARTING_HOME_INFLUENCE,
): Record<string, Territory> {
  const territories: Record<string, Territory> = {};

  for (const def of TERRITORIES) {
    const influence = {} as Record<FactionId, number>;
    for (const faction of ALL_FACTIONS) influence[faction] = 0;
    RIVAL_IDS.forEach((id, i) => {
      influence[id] = draws[i]?.seat.influence[def.id] ?? 0;
    });
    influence.player = def.id === HOME_TERRITORY ? homeInfluence : 0;

    territories[def.id] = {
      id: def.id,
      ...character(rng, def),
      influence,
      sentiment: SENTIMENT_START,
      businessIds: [],
      // In Simulation the player has never set foot anywhere, so the map is
      // fogged the same way it would be on day one of a career — you are
      // reading the city from outside it, which is the point.
      visited: def.id === HOME_TERRITORY && homeInfluence > 0,
      lastActionDay: 1,
    };
  }

  return territories;
}

/**
 * How this city's version of a district differs from the archetype.
 *
 * Rolled once, kept forever, and applied as a multiplier rather than as a
 * one-off offset. The first version offset the starting figures and left the
 * drift target on the config number, which meant every jittered district
 * quietly walked back to the archetype over the first three years — the
 * variation existed on day one and had evaporated by the time anybody could
 * have noticed it.
 */
function character(rng: Rng, def: (typeof TERRITORIES)[number]) {
  const c = rng.float(CHARACTER_JITTER.prosperity[0], CHARACTER_JITTER.prosperity[1]);
  return {
    character: c,
    prosperity: Math.round(def.wealth * c),
    people: Math.round(
      def.population * c * rng.float(CHARACTER_JITTER.population[0], CHARACTER_JITTER.population[1]),
    ),
  };
}

/** The rival families, drawn for this city and seated on it. */
function buildFactions(rng: Rng, day: number, draws: HouseDraw[]): Record<string, Faction> {
  const factions: Record<string, Faction> = {};
  RIVAL_IDS.forEach((id, i) => {
    const house = draws[i].house;
    // Everybody starts indifferent to everybody, including each other: nothing
    // held against anybody, nobody proven either way.
    const bonds: Record<string, FactionBond> = {};
    for (const other of ALL_FACTIONS) {
      if (other !== id) {
        bonds[other] = { grudge: 0, respect: STARTING_RESPECT_FOR, trust: 0, warSince: null };
      }
    }

    factions[id] = {
      id,
      name: house.name,
      shortName: house.shortName,
      colour: house.colour,
      blurb: house.blurb,
      reputation: house.reputation,
      personality: house.personality,
      wealth: foundingWealth(rng, house),
      strength: foundingStrength(rng, house),
      heat: 0,
      bonds,
      warWeariness: 0,
      businessCount: 0,
      // Somebody is already running it, and has been for a while. The bias is
      // rolled here rather than fixed in config so two games of the same
      // family are not the same organization.
      leader: newLeader(rng, day, house.shortName),
      // The men under him, holding the districts the family actually stands
      // in, strongest first. A family with more capos than ground has men with
      // nothing of their own, which is a perfectly good reason to be unhappy.
      capos: [],
      // Nobody starts with a theory about anybody. Every belief in the game is
      // caused by something that happened to them.
      suspicions: [],
      currentObjective: null,
      agenda: null,
      history: [],
    };
  });
  return factions;
}

function zeroAttributes(): Attributes {
  return {
    leadership: 0,
    intimidation: 0,
    negotiation: 0,
    intelligence: 0,
    streetSmarts: 0,
    business: 0,
    strategy: 0,
    influence: 0,
  };
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const mode = opts.mode ?? 'career';
  // Sandbox is the only mode that gets to choose; the others are the position
  // the game gives you, which for Simulation is nothing at all.
  const start =
    mode === 'sandbox'
      ? (SANDBOX_START_BY_ID[opts.sandboxStart ?? ''] ?? SANDBOX_STARTS[0])
      : null;

  const attributes = { ...STARTING_ATTRIBUTES };
  if (start) {
    for (const key of Object.keys(attributes) as (keyof Attributes)[]) {
      attributes[key] += start.attributeBonus;
    }
  }

  // Built before the state object, because the founding bosses are rolled from
  // it and the whole point of the seed is that they are reproducible.
  const rngState = { seed, calls: 0 };
  const rng = new Rng(rngState);

  // Who is in this city, and which corner each of them starts in. Drawn first
  // because the board is built from the seats.
  const draws = drawHouses(rng, RIVAL_IDS.length);

  const state: GameState = {
    version: SAVE_VERSION,
    rng: rngState,
    difficulty: opts.difficulty,
    mode,
    day: 1,
    gameOver: null,

    player: {
      name: opts.name.trim() || (mode === 'simulation' ? 'Nobody at all' : 'Nobody'),
      rank: start?.rank ?? 'street_criminal',
      attributes,
      attributeProgress: zeroAttributes(),
      opsCompleted: 0,
      opsFailed: 0,
      pendingRank: null,
    },

    org: {
      cash: mode === 'simulation' ? 0 : (start?.cash ?? STARTING_CASH),
      dirtyCash: mode === 'simulation' ? 0 : (start?.dirtyCash ?? STARTING_DIRTY_CASH),
      respect: mode === 'simulation' ? 0 : (start?.respect ?? STARTING_RESPECT),
      // Nobody is afraid of you on day one, whichever way you start. Fear is
      // the one thing a sandbox position does not hand over — it is bought
      // with specific acts, and a starting position has not committed any.
      fear: STARTING_FEAR,
      heat: 0,
      heatBy: newHeatChannels(),
      quietDays: 0,
      layLowUntilDay: null,
    },

    npcs: {},
    recruits: {},
    recruitsRefreshedDay: -999,

    activeOperations: {},
    operationHistory: [],

    territories: buildTerritories(
      rng,
      draws,
      mode === 'simulation' ? 0 : (start?.homeInfluence ?? undefined),
    ),
    businesses: {},
    factions: {},
    lastLaunderReport: null,

    evidence: {},
    law: newLawEnforcement(),
    succession: { heirId: null, heirNamedDay: null, generation: 1, line: [] },
    world: { conditionId: null, startedDay: 0, endsDay: 0, lastEndedDay: 0 },
    market: newMarket(rng, 1),
    city: newCity(),
    contraband: newContraband(),
    pendingEvents: [],
    log: [],
    trace: [],

    flags: {},
    nextId: 0,
  };

  // Built after the state object because the capos need `nextId`, which reads
  // and writes it. The bosses do not, which is why they are rolled inside.
  state.factions = buildFactions(rng, 1, draws);
  for (const id of RIVAL_IDS) {
    const held = Object.values(state.territories)
      .filter((t) => (t.influence[id] ?? 0) >= 20)
      .sort((a, b) => (b.influence[id] ?? 0) - (a.influence[id] ?? 0))
      .map((t) => t.id);
    state.factions[id].capos = newCapos(state, rng, id, held);
  }

  if (mode === 'simulation') {
    // No crew, no recruits, no opening. There is nobody here to have them.
    addLog(
      state,
      'Three families, twelve districts and four agencies. Nobody is playing this one.',
      'neutral',
    );
    return state;
  }

  const crew = start?.crew ?? [{ role: 'associate' as const, count: 1 }];
  const hired = [];
  for (const { role, count } of crew) {
    for (let i = 0; i < count; i++) {
      const npc = generateNpc(state, rng, role);
      // People you have already worked with. Not fully read — the perception
      // system is the game, and a sandbox that hands you the true numbers has
      // quietly turned off the thing worth testing.
      npc.familiarity = start ? rng.int(25, 60) : 30;
      npc.daysInCrew = start ? rng.int(60, 400) : 0;
      addNote(
        npc,
        1,
        start ? 'Was with you before any of this.' : 'Has been around as long as you have.',
        'neutral',
      );
      state.npcs[npc.id] = npc;
      hired.push(npc);
    }
  }

  refreshRecruits(state, rng, true);

  if (start && start.id !== 'nobody') {
    addLog(
      state,
      `${state.player.name}. ${hired.length} people, ${'$' + (start.cash + start.dirtyCash).toLocaleString('en-US')}, and a reputation that arrived before you did.`,
      'neutral',
    );
  } else {
    addLog(
      state,
      `${state.player.name}. Nothing to your name but ${'$' + STARTING_CASH.toLocaleString('en-US')} and ${hired[0].name}.`,
      'neutral',
    );
  }
  addLog(
    state,
    start && start.id !== 'nobody'
      ? // "The only place anyone will take your call" is true of a man with
        // nothing and absurd of an Underboss with twelve people and a district.
        `${TERRITORY_BY_ID[HOME_TERRITORY].name} is yours and has been for years. Everywhere else is somebody's.`
      : `${TERRITORY_BY_ID[HOME_TERRITORY].name} is where you are from. It is the only place anyone will take your call.`,
    'neutral',
  );

  return state;
}
