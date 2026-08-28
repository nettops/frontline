/**
 * Territory: influence, control, and where you are allowed to work.
 *
 * Influence is per-faction and independent — four numbers, each 0..100, not a
 * pie that must add to a hundred. Control is decided by share, so a district
 * can be genuinely contested rather than flipping between owners.
 */

import { clamp } from './rng';
import type { GameState, Territory } from './types';
import { addLog } from './util';
import { holdingShare, yieldOf } from './holdings';
import { houseColour, houseShort } from './houses';
import {
  CONTESTED_MARGIN,
  DISTRICT_LIFE,
  CONTROL_LABEL,
  CONTROL_REQUIRES_LEAD,
  CONTROL_THRESHOLDS,
  DAYS_IDLE_BEFORE_DECAY,
  HEAT_REDUCTION_BY_CONTROL,
  INFLUENCE_DECAY_PER_WEEK,
  MUSCLE_IN_SHARE,
  POLICE_HEAT_BASE,
  POLICE_HEAT_RANGE,
  POLICE_SUCCESS_PENALTY,
  SENTIMENT_HOSTILE_BELOW,
  SENTIMENT_HOSTILE_SUCCESS_PENALTY,
  SENTIMENT_RECOVERY_PER_WEEK,
  SENTIMENT_START,
  SLOTS_BY_CONTROL,
  TERRITORIES,
  TERRITORY_BY_ID,
  UNFAMILIAR_HEAT_MULTIPLIER,
  UNFAMILIAR_SUCCESS_PENALTY,
  WEALTH_PAYOUT_BASE,
  WEALTH_PAYOUT_RANGE,
  type ControlLevel,
  type TerritoryDef,
} from '../config/territories';
import {
  ALL_FACTIONS,
  INTEL_PRECISE_ABOVE,
  INTEL_ROUGH_ABOVE,
  RIVAL_IDS,
  type FactionId,
} from '../config/factions';

export function territoryDef(id: string): TerritoryDef {
  return TERRITORY_BY_ID[id];
}

export function territoryList(state: GameState): Territory[] {
  // Config order, so the board reads the same way every time.
  return TERRITORIES.map((def) => state.territories[def.id]).filter(Boolean);
}

export function playerInfluence(t: Territory): number {
  return t.influence.player ?? 0;
}

/** The strongest faction present, or null if the district is untouched. */
export function leadingFaction(t: Territory): FactionId | null {
  let best: FactionId | null = null;
  let bestValue = 0;
  for (const id of ALL_FACTIONS) {
    const value = t.influence[id] ?? 0;
    if (value > bestValue) {
      best = id;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Whose district this really is, or null while it is still up for grabs.
 *
 * `leadingFaction` answers a different and much weaker question — who is
 * marginally ahead — and on day one that is somebody in all twelve districts,
 * which is why a readout built on it never moved off 12/12. This applies the
 * same threshold the player's own control level uses, so "theirs" means the
 * same thing whoever it is.
 */
export function districtOwner(t: Territory): FactionId | null {
  const leader = leadingFaction(t);
  if (!leader) return null;
  const control = CONTROL_THRESHOLDS.find((tier) => tier.level === 'control');
  return (t.influence[leader] ?? 0) >= (control?.min ?? 50) ? leader : null;
}

function strongestRival(t: Territory): { id: FactionId; value: number } | null {
  let best: { id: FactionId; value: number } | null = null;
  for (const id of RIVAL_IDS) {
    const value = t.influence[id] ?? 0;
    if (!best || value > best.value) best = { id, value };
  }
  return best && best.value > 0 ? best : null;
}

/**
 * What the player holds here. The top two levels also require being the
 * strongest faction — a 60 against a rival's 70 is a fight, not a holding.
 */
export function controlLevel(t: Territory): ControlLevel {
  const mine = playerInfluence(t);
  const rival = strongestRival(t);
  const leads = !rival || mine > rival.value;

  for (const tier of CONTROL_THRESHOLDS) {
    if (mine >= tier.min) {
      if (CONTROL_REQUIRES_LEAD.includes(tier.level) && !leads) continue;
      return tier.level;
    }
  }
  return 'none';
}

export function isContested(t: Territory): boolean {
  const mine = playerInfluence(t);
  const rival = strongestRival(t);
  if (!rival) return false;
  return Math.abs(mine - rival.value) < CONTESTED_MARGIN && (mine > 0 || rival.value > 0);
}

/** Districts the player controls outright — the rank requirement counts these. */
export function controlledTerritories(state: GameState): Territory[] {
  return territoryList(state).filter((t) => {
    const level = controlLevel(t);
    return level === 'control' || level === 'dominance';
  });
}

export function hasPresence(t: Territory): boolean {
  return playerInfluence(t) >= 10;
}

// ------------------------------------------------------------- expansion ---

export interface OperableTerritory {
  territory: Territory;
  def: TerritoryDef;
  /** True when you have no presence here — allowed, but harder and louder. */
  unfamiliar: boolean;
}

/**
 * Where the player may run a job: districts they hold, plus anything adjacent
 * to one. This is what gives expansion a front line instead of letting you
 * jump straight to Downtown on day one.
 */
export function operableTerritories(state: GameState): OperableTerritory[] {
  const held = new Set(
    territoryList(state)
      .filter(hasPresence)
      .map((t) => t.id),
  );

  const reachable = new Set(held);
  for (const id of held) {
    for (const neighbour of territoryDef(id).adjacent) reachable.add(neighbour);
  }
  // Nothing held at all (everything decayed away) — you can always work home.
  if (reachable.size === 0) reachable.add(TERRITORIES[0].id);

  return [...reachable]
    .map((id) => state.territories[id])
    .filter(Boolean)
    .map((territory) => ({
      territory,
      def: territoryDef(territory.id),
      unfamiliar: !hasPresence(territory),
    }))
    .sort((a, b) => playerInfluence(b.territory) - playerInfluence(a.territory));
}

export function canOperateIn(state: GameState, territoryId: string): boolean {
  return operableTerritories(state).some((o) => o.territory.id === territoryId);
}

// ------------------------------------------------- operation interactions ---

/**
 * Reads the district's *current* prosperity, not its founding wealth.
 *
 * This is the payoff for the whole drift system, and the only one that lands on
 * the player's most repeated action. A district worked hard for four years pays
 * measurably less for the same job than it did — nothing announces it, the
 * number on the Operations panel is simply smaller.
 */
export function payoutMultiplier(state: GameState, territoryId: string): number {
  const base = WEALTH_PAYOUT_BASE + (prosperity(state, territoryId) / 100) * WEALTH_PAYOUT_RANGE;
  /*
     Somewhere to put it.

     Only in the district that gives it — a warehouse in one place does not make
     a shakedown in another pay more. That is why this reads the pair rather
     than the family's holdings as a whole, unlike the other five.
  */
  if (yieldOf(territoryId) !== 'takings') return base;
  return base * (1 + holdingShare(state, 'takings'));
}

export function heatMultiplier(t: Territory, def: TerritoryDef, unfamiliar: boolean): number {
  const police = POLICE_HEAT_BASE + (def.policePresence / 100) * POLICE_HEAT_RANGE;
  const control = HEAT_REDUCTION_BY_CONTROL[controlLevel(t)];
  return police * control * (unfamiliar ? UNFAMILIAR_HEAT_MULTIPLIER : 1);
}

/** Negative number — what working here costs you in success chance. */
export function successModifier(
  t: Territory,
  def: TerritoryDef,
  unfamiliar: boolean,
): number {
  let mod = -(def.policePresence / 100) * POLICE_SUCCESS_PENALTY;
  if (unfamiliar) mod -= UNFAMILIAR_SUCCESS_PENALTY;
  if (t.sentiment < SENTIMENT_HOSTILE_BELOW) mod -= SENTIMENT_HOSTILE_SUCCESS_PENALTY;
  return mod;
}

export function addInfluence(state: GameState, territoryId: string, amount: number): void {
  const t = state.territories[territoryId];
  if (!t) return;
  const before = controlLevel(t);
  t.influence.player = clamp(playerInfluence(t) + amount, 0, 100);
  t.lastActionDay = state.day;
  t.visited = true;

  /*
     And whoever was holding the street gives a little of it up.

     Every call into here is the player having worked the district — a job that
     landed, a steward doing his rounds. Before this, all of that only ever
     raised the player's own number, and `controlLevel` refuses to call it
     control while somebody else is stronger. The arithmetic made the top of
     the ladder unreachable rather than expensive: ten of the twelve districts
     end held outright by a rival, the median career finds no open ground at
     all, and in 420 measured district-observations a family took a district
     off its holder three times.

     Only the strongest rival gives ground, and only when you gained some. A
     second family with a toe-hold is not who you are pushing against; the one
     with the corner is.
  */
  if (amount > 0) {
    const holder = strongestRival(t);
    if (holder) {
      t.influence[holder.id] = clamp(holder.value - amount * MUSCLE_IN_SHARE, 0, 100);
    }
  }

  const after = controlLevel(t);
  if (after !== before) {
    const def = territoryDef(territoryId);
    addLog(state, controlChangeText(def.name, before, after), 'crew');
  }
}

/**
 * How a district changing hands is put to the player.
 *
 * Written per level and per direction because the earlier one-liner produced
 * "Little Sicily: you now hold foothold", and — worse — reported slipping from
 * control down to a foothold in the same words as earning that foothold in the
 * first place. Losing ground should never read as a promotion.
 */
function controlChangeText(name: string, before: ControlLevel, after: ControlLevel): string {
  const rank = (level: ControlLevel) =>
    CONTROL_THRESHOLDS.length - CONTROL_THRESHOLDS.findIndex((tier) => tier.level === level);

  if (after === 'none') return `You have lost your footing in ${name}.`;
  if (rank(after) < rank(before)) {
    return `Your hold on ${name} has slipped to ${CONTROL_LABEL[after].toLowerCase()}.`;
  }
  switch (after) {
    case 'presence':
      return `People in ${name} know who you are now.`;
    case 'foothold':
      return `You have a foothold in ${name}.`;
    case 'control':
      return `${name} is yours.`;
    default:
      return `Nobody moves in ${name} without your say-so.`;
  }
}

export function adjustSentiment(state: GameState, territoryId: string, amount: number): void {
  const t = state.territories[territoryId];
  if (!t) return;
  t.sentiment = clamp(t.sentiment + amount, 0, 100);
}

// ------------------------------------------------------------ businesses ---

/** How many businesses this district can hold for the player right now. */
export function businessSlots(t: Territory): number {
  const byControl = SLOTS_BY_CONTROL[controlLevel(t)];
  // Density is the ceiling the district itself imposes. Rounding rather than
  // flooring matters: flooring capped ordinary neighbourhoods at a single
  // front even at full control, which left the laundering economy stillborn.
  const byDensity = Math.max(1, Math.round(territoryDef(t.id).businessDensity / 22));
  return Math.min(byControl, byDensity);
}

export function usedSlots(state: GameState, t: Territory): number {
  return t.businessIds.filter((id) => state.businesses[id]?.status === 'operating').length;
}

// ------------------------------------------------------------------ tick ---

/**
 * Weekly. Influence bleeds where you have stopped showing up, and public
 * feeling drifts back toward indifference.
 */
export function tickTerritory(state: GameState): void {
  for (const t of territoryList(state)) {
    if (
      playerInfluence(t) > 0 &&
      state.day - t.lastActionDay >= DAYS_IDLE_BEFORE_DECAY &&
      usedSlots(state, t) === 0
    ) {
      // A business keeps your name in a district even when you are not working it.
      t.influence.player = clamp(
        playerInfluence(t) - INFLUENCE_DECAY_PER_WEEK,
        0,
        100,
      );
    }

    if (t.sentiment < SENTIMENT_START) {
      t.sentiment = clamp(t.sentiment + SENTIMENT_RECOVERY_PER_WEEK, 0, SENTIMENT_START);
    }

    driftDistrict(state, t);
  }
}

// -------------------------------------------------- districts that change ---

/** Where a district stood on day one, which is not where it stands now. */
export function prosperity(state: GameState, id: string): number {
  return state.territories[id]?.prosperity ?? territoryDef(id).wealth;
}

export function people(state: GameState, id: string): number {
  return state.territories[id]?.people ?? territoryDef(id).population;
}

/** What this district was on day one of *this* city. The readouts compare to it. */
export function foundingWealth(t: Territory): number {
  return territoryDef(t.id).wealth * (t.character ?? 1);
}

export function foundingPeople(t: Territory): number {
  return territoryDef(t.id).population * (t.character ?? 1);
}

/**
 * What this district would settle at, given how it is currently being used.
 *
 * Read out of plain state rather than through business.ts and contraband.ts,
 * both of which import this file. The counts are two loops over objects that
 * are already in hand; the alternative is an import cycle for no gain.
 */
function prosperityTarget(state: GameState, t: Territory): number {
  /*
   * Deliberately *not* multiplied by the market cycle.
   *
   * The first version was, and it was double counting: `activity` already
   * multiplies operation payouts and front revenue directly, so putting it here
   * too meant a trough hit the same money twice and — worse — dragged all twelve
   * districts down together, which drowned the local signal this whole system
   * exists to produce. The cycle is the city's weather; this is what the player
   * has personally done to a street.
   */
  let target = foundingWealth(t);

  for (const b of Object.values(state.businesses)) {
    if (b.territoryId === t.id && b.status === 'operating') target += DISTRICT_LIFE.perBusiness;
  }
  for (const ids of Object.values(state.contraband?.routes ?? {})) {
    if (ids.includes(t.id)) target += DISTRICT_LIFE.perRoute;
  }

  target += (t.sentiment - SENTIMENT_START) * DISTRICT_LIFE.sentimentWeight;

  // Two families shooting at each other on this street. Nothing opens, and
  // what is already open closes early.
  const present = ALL_FACTIONS.filter((f) => (t.influence[f] ?? 0) >= DISTRICT_LIFE.warPresence);
  const fighting = present.some((a) =>
    present.some((b) => a !== b && state.factions[a]?.bonds?.[b]?.warSince != null),
  );
  if (fighting) target += DISTRICT_LIFE.warCost;

  const [lo, hi] = DISTRICT_LIFE.prosperityBounds;
  return clamp(target, foundingWealth(t) * lo, foundingWealth(t) * hi);
}

/**
 * Weekly. Two quantities, moving at very different speeds.
 *
 * Prosperity is shops opening and closing and reads within a year. People move
 * house at a fifth of that rate, so a district that has been stripped stays
 * populated for a long time after it stopped being worth anything — which is
 * the version of this that produces a slum rather than an empty lot.
 */
function driftDistrict(state: GameState, t: Territory): void {
  const base = foundingWealth(t);

  const target = prosperityTarget(state, t);
  t.prosperity = (t.prosperity ?? base) + (target - (t.prosperity ?? base)) * DISTRICT_LIFE.drift;

  // People follow work, and leave somewhere that frightens them.
  const ratio = t.prosperity / Math.max(1, base);
  const [plo, phi] = DISTRICT_LIFE.peopleBounds;
  const start = foundingPeople(t);
  const peopleTarget = start * clamp(0.5 + 0.45 * ratio + 0.2 * (t.sentiment / 100), plo, phi);
  t.people = Math.round((t.people ?? start) + (peopleTarget - (t.people ?? start)) * DISTRICT_LIFE.peopleDrift);
}

// ----------------------------------------------------------------- intel ---

export interface RivalRead {
  faction: FactionId;
  name: string;
  colour: string;
  /** Exact value only where you are close enough to know it. */
  value: number | null;
  band: string;
}

/**
 * What the player can tell about who else is working a district.
 *
 * Same rule as reading a person: you know what you are near. Somewhere you
 * have never set foot shows that somebody is active, not who or how much.
 */
export function readRivals(state: GameState, t: Territory): RivalRead[] {
  const mine = playerInfluence(t);
  const precise = mine >= INTEL_PRECISE_ABOVE;
  const rough = mine >= INTEL_ROUGH_ABOVE;

  return RIVAL_IDS.map((id) => {
    const value = t.influence[id] ?? 0;
    let band: string;
    if (value <= 0) band = '—';
    else if (precise) band = `${Math.round(value)}`;
    else if (rough) band = value > 55 ? 'strong' : value > 25 ? 'established' : 'present';
    else band = 'active here';

    return {
      faction: id,
      // The drawn house, not the config archetype. This was the last place in
      // the game still printing the slot's founding name — the map showed the
      // family that is actually there and the table beside it showed the
      // family that would have been there in the old fixed city.
      name: houseShort(state, id),
      colour: houseColour(state, id),
      value: precise && value > 0 ? Math.round(value) : null,
      band,
    };
  }).filter((r) => r.band !== '—');
}
