/**
 * What the street outside shows tonight.
 *
 * A pure reading of state in the briefing's mould: never saved, decides
 * nothing, and never touches the seeded RNG — incidental layout hashes off
 * the district id the way a face hashes off an npc id, so the street is
 * stable frame to frame and only changes when a fact changes.
 *
 * The fog rule, which is the whole design: everything here is a second
 * telling of something a panel already prints, and nothing keys off state
 * the player cannot see. The one that needed care is the unmarked car — it
 * keys off `OBVIOUS_STAGES`, the stages whose own definition says they are
 * impossible to miss whatever your intel, because that is precisely the
 * fiction the sprite draws: "Cars that do not belong."
 */
import type { GameState } from '../sim/types';
import { HOME_TERRITORY, TERRITORY_BY_ID } from '../config/territories';
import { OBVIOUS_STAGES, stageIndex } from '../config/lawEnforcement';
import { activeCases } from '../sim/investigation';
import { playerIsAtWar } from '../sim/diplomacy';
import { FRONT_SPRITES } from './art/streetSprites';

export interface StreetFront {
  /** A business def id, which is also a sprite id on the fronts sheet. */
  id: string;
  state: 'trading' | 'shut';
  /** Yours, or a neutral shop filling out the block. */
  yours: boolean;
}

export interface StreetLook {
  /** Four frontages, left to right. */
  fronts: StreetFront[];
  /** The best car you hold, as a fleet sprite id, or nothing at the curb. */
  car: 'sedan' | 'towncar' | 'wedge' | null;
  /** Eyes on you, parked across the street. */
  unmarked: boolean;
  /** A consequence with an address. */
  shell: boolean;
  /** The trade backed up to the block. */
  truck: boolean;
  /** Stock in the open, coarse — never the number. */
  crates: number;
  /** People out, coarse. */
  peds: number;
  /**
   * How busy the road is, 0..3 — the prosperity band wearing wheels. Drives
   * the passing cars and the ordinary parked ones, and goes to zero in a
   * war for the same reason the pavement does.
   */
  traffic: number;
  /** Theatre from the calendar. Decides nothing, reads nothing hidden. */
  night: boolean;
}

/** The same trick faces use: stable variety without a die roll. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The possession car ids, best first, mapped to their fleet sprites. */
const CAR_OF: [string, StreetLook['car']][] = [
  ['roadster', 'wedge'],
  ['lincoln', 'towncar'],
  ['sedan', 'sedan'],
];

const SURVEILLANCE_AT = Math.min(...OBVIOUS_STAGES.map((s) => stageIndex(s)));

export function streetLook(state: GameState): StreetLook {
  const here = HOME_TERRITORY;
  const territory = state.territories[here];
  const prosperity = territory?.prosperity ?? TERRITORY_BY_ID[here].wealth;

  /*
     The block: your fronts here first, then neutral shops picked by hash to
     fill four frontages. Neutral shops trade or shut with the prosperity
     band, which is the coarse fact the territory panel already shows.
  */
  // Not `ownedBusinesses`, which filters to operating — a shuttered front
  // with its lights out is exactly the kind of fact this scene exists to show.
  const mine = Object.values(state.businesses)
    .filter((b) => b.territoryId === here && FRONT_SPRITES[b.defId])
    .slice(0, 4)
    .map<StreetFront>((b) => ({
      id: b.defId,
      state: b.status === 'operating' ? 'trading' : 'shut',
      yours: true,
    }));

  const neutralPool = Object.keys(FRONT_SPRITES).filter(
    (id) => !mine.some((f) => f.id === id),
  );
  const fronts = [...mine];
  for (let slot = 0; fronts.length < 4; slot++) {
    const pick = neutralPool[hash(`${here}:${slot}`) % neutralPool.length];
    if (fronts.some((f) => f.id === pick)) {
      neutralPool.splice(neutralPool.indexOf(pick), 1);
      continue;
    }
    fronts.push({ id: pick, state: prosperity >= 35 ? 'trading' : 'shut', yours: false });
  }

  // The best car you actually hold. Standing pays for it being seen.
  let car: StreetLook['car'] = null;
  const held = (state.possessions ?? []).filter((p) => p.status === 'held');
  for (const [defId, sprite] of CAR_OF) {
    if (held.some((p) => p.defId === defId)) {
      car = sprite;
      break;
    }
  }

  // "Surveillance and arrests are impossible to miss, whatever your intel."
  const unmarked = activeCases(state).some((c) => stageIndex(c.stage) >= SURVEILLANCE_AT);

  const war = playerIsAtWar(state);

  const routed =
    (state.contraband?.routes.product ?? []).includes(here) ||
    (state.contraband?.routes.arms ?? []).includes(here) ||
    Object.values(state.businesses).some(
      (b) => b.territoryId === here && b.defId === 'trucking' && b.status === 'operating',
    );
  const stock = state.contraband
    ? state.contraband.stock.product + state.contraband.stock.arms
    : 0;

  return {
    fronts,
    car,
    unmarked,
    shell: war,
    truck: routed,
    crates: routed && stock > 0 ? Math.min(3, Math.ceil(stock / 12)) : 0,
    peds: war ? 0 : Math.max(1, Math.min(5, Math.round(prosperity / 16))),
    traffic: war ? 0 : Math.max(1, Math.min(3, Math.round(prosperity / 25))),
    night: state.day % 7 >= 5,
  };
}
