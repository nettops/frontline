/**
 * Working out who did it.
 *
 * A leaf module. It reads territories and factions off the state object and
 * imports nothing that could import back, because faction.ts, operations.ts
 * and diplomacy.ts all call into it — they are the systems that cause harm,
 * and none of them should have to know how blame is assigned.
 *
 * The contract is small: something bad happened to `victim`, in `territoryId`,
 * and `actor` really did it. This decides who the victim *thinks* did it, and
 * that answer is what the rest of the simulation acts on from then on.
 */

import { Rng, clamp } from './rng';
import type { FactionId } from '../config/factions';
import type { GameState, Suspicion } from './types';
import type { IncidentKind } from '../config/beliefs';
import { ATTRIBUTION, INCIDENT_TEXT, SUSPICION_BANDS } from '../config/beliefs';
import { ALL_FACTIONS } from '../config/factions';
import { territoryDef } from './territory';
import { houseShort } from './houses';

function influenceOf(state: GameState, id: FactionId, territoryId: string | null): number {
  if (!territoryId) return 0;
  return state.territories[territoryId]?.influence[id] ?? 0;
}

function strengthOf(state: GameState, id: FactionId): number {
  if (id === 'player') {
    // Deliberately not playerStrength() — diplomacy.ts imports this file, so
    // reading the crew here would close the loop. Presence on the board is a
    // fair proxy for "could plausibly have done this", and it is also what a
    // rival would actually be reasoning from.
    let total = 0;
    for (const t of Object.values(state.territories)) total += t.influence.player ?? 0;
    return clamp(total / 4, 0, 100);
  }
  return state.factions[id]?.strength ?? 0;
}

/**
 * How much the victim already holds against a candidate.
 *
 * Reads the grudge directly rather than the derived standing, which is the
 * more honest question here: the comfortable suspect is the one you already
 * blame for things, not the one you are merely unimpressed by.
 */
function grudgeToward(state: GameState, from: FactionId, to: FactionId): number {
  const faction = state.factions[from] ?? state.factions[to];
  if (!faction) return 0;
  const key = state.factions[from] ? to : from;
  return faction.bonds[key]?.grudge ?? 0;
}

/**
 * How well the victim can tell what happened.
 *
 * Standing in the district is most of it — you find out what happens on your
 * own street — and care is what takes it away. `care` is 0..1 and comes from
 * the caller, because only the caller knows who did the work: for the player
 * that is the discipline of the crew and whatever their traits do to how much
 * they leave behind.
 */
export function clarityFor(
  state: GameState,
  victim: FactionId,
  territoryId: string | null,
  care: number,
): number {
  return clamp(
    ATTRIBUTION.baseClarity +
      influenceOf(state, victim, territoryId) * ATTRIBUTION.clarityPerPresence -
      clamp(care, 0, 1) * ATTRIBUTION.clarityFromCare,
    ATTRIBUTION.min,
    ATTRIBUTION.max,
  );
}

/**
 * Who else it could plausibly have been.
 *
 * Three reasons, none of which is evidence: somebody standing in the district
 * is the obvious suspect, somebody they already dislike is the comfortable
 * one, and somebody strong enough is the credible one. That is how people
 * reason about a thing they did not witness.
 */
function scapegoat(
  state: GameState,
  rng: Rng,
  victim: FactionId,
  actor: FactionId,
  territoryId: string | null,
): FactionId {
  const candidates: { id: FactionId; weight: number }[] = [];

  // Who could have reached it: anybody in the district, and anybody standing
  // on the other side of a line into it.
  const neighbours = territoryId ? territoryDef(territoryId).adjacent : [];

  for (const id of ALL_FACTIONS) {
    if (id === victim) continue;
    const influence = influenceOf(state, id, territoryId);
    const nearby = neighbours.reduce(
      (most, next) => Math.max(most, influenceOf(state, id, next)),
      0,
    );
    // In the frame at all. Somebody who was not standing anywhere near it is
    // not a suspect, however much the victim dislikes them.
    if (influence < ATTRIBUTION.plausibleFrom && nearby < ATTRIBUTION.plausibleFrom) continue;

    const presence =
      Math.max(influence, nearby * ATTRIBUTION.plausibilityAdjacent) / 100;
    const hostility = clamp(grudgeToward(state, victim, id) / 100, 0, 1);
    const capability = strengthOf(state, id) / 100;

    candidates.push({
      id,
      weight:
        ATTRIBUTION.plausibilityFloor +
        presence * ATTRIBUTION.plausibilityPresence +
        hostility * ATTRIBUTION.plausibilityHostility +
        capability * ATTRIBUTION.plausibilityCapability,
    });
  }

  // Nobody else was anywhere near it, so it was obviously whoever it was.
  if (candidates.length === 0) return actor;

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let target = rng.next() * total;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.id;
  }
  return candidates[candidates.length - 1].id;
}

export interface Attribution {
  /** Who they have decided did it. */
  believed: FactionId;
  /** How sure, 0..1. Independent of whether they are right. */
  confidence: number;
  mistaken: boolean;
}

/**
 * The whole mechanic in one function.
 *
 * Returns who the victim believes was responsible. Callers apply their own
 * consequences to that party rather than to the real one — which is what makes
 * a wrong belief behave exactly like a right one everywhere downstream.
 */
export function attribute(
  state: GameState,
  rng: Rng,
  victim: FactionId,
  actor: FactionId,
  territoryId: string | null,
  kind: IncidentKind,
  care = 0,
): Attribution {
  const faction = state.factions[victim];

  // The player is not an AI and does not hold beliefs — they read the board
  // themselves and draw their own conclusions, which is the game. Anything
  // aimed at them is attributed correctly because *they* are doing the
  // attributing, in their head, with the panels this game already gives them.
  if (!faction || victim === 'player') {
    return { believed: actor, confidence: 1, mistaken: false };
  }

  const clarity = clarityFor(state, victim, territoryId, care);
  const seen = rng.chance(clarity);
  const believed = seen ? actor : scapegoat(state, rng, victim, actor, territoryId);
  const mistaken = believed !== actor;

  const range = seen
    ? ATTRIBUTION.confidenceWhenSeen
    : ATTRIBUTION.confidenceWhenGuessing;
  let confidence = rng.float(range[0], range[1]);

  /*
   * A second incident naming the same party hardens the first.
   *
   * This is what turns a guess into a conviction, and it is the reason a
   * misattribution is dangerous rather than merely noisy: nobody changes their
   * mind about who is doing this to them, they accumulate reasons.
   */
  const existing = faction.suspicions.find((s) => s.actorId === believed);
  if (existing) {
    existing.confidence = clamp(
      existing.confidence + ATTRIBUTION.corroborationConfidence,
      0,
      1,
    );
    confidence = Math.max(confidence, existing.confidence);
  }

  const suspicion: Suspicion = {
    actorId: believed,
    kind,
    territoryId,
    day: state.day,
    confidence,
    mistaken,
  };
  faction.suspicions.unshift(suspicion);
  if (faction.suspicions.length > ATTRIBUTION.kept) {
    faction.suspicions.length = ATTRIBUTION.kept;
  }

  return { believed, confidence, mistaken };
}

/**
 * How hard the grudge lands, given how sure they are.
 *
 * A theory still costs the accused something — people act on theories — but
 * not what a certainty costs.
 */
export function damageShare(confidence: number): number {
  return ATTRIBUTION.minDamageShare + (1 - ATTRIBUTION.minDamageShare) * clamp(confidence, 0, 1);
}

/** Weekly: old business stops being brought up, and certainty fades. */
export function tickBeliefs(state: GameState): void {
  for (const id of ALL_FACTIONS) {
    const faction = state.factions[id];
    if (!faction?.suspicions) continue;

    for (const suspicion of faction.suspicions) {
      suspicion.confidence = Math.max(
        0,
        suspicion.confidence - ATTRIBUTION.confidenceDecayPerWeek,
      );
    }
    faction.suspicions = faction.suspicions.filter(
      (s) => state.day - s.day < ATTRIBUTION.memoryDays && s.confidence > 0.05,
    );
  }
}

// ------------------------------------------------------------ perception ---

export interface SuspicionRead {
  /** Who they blame, by name. */
  who: string;
  /** What they think that party did. */
  what: string;
  /** How sure they sound. */
  certainty: string;
  /** True when the player is the one being blamed. */
  aboutYou: boolean;
}

/**
 * What a family will say about who has been doing this to them.
 *
 * Gated on intel like everything else about a family — this is the sort of
 * thing you hear because you are close enough to them to be told it. The
 * player is never shown whether the belief is correct: finding out that the
 * Falcone have spent two years blaming the Vasari for your work is something
 * you deduce from what they do, not something the interface hands over.
 */
export function readSuspicions(
  state: GameState,
  id: FactionId,
  intel: number,
  limit = 4,
): SuspicionRead[] {
  const faction = state.factions[id];
  if (!faction?.suspicions || intel < 25) return [];

  const out: SuspicionRead[] = [];
  const seen = new Set<string>();

  for (const suspicion of faction.suspicions) {
    const key = `${suspicion.actorId}:${suspicion.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const where = suspicion.territoryId ? ` in ${territoryDef(suspicion.territoryId).name}` : '';
    out.push({
      who:
        suspicion.actorId === 'player'
          ? 'you'
          : `the ${houseShort(state, suspicion.actorId)}`,
      what: `${INCIDENT_TEXT[suspicion.kind]}${where}`,
      certainty:
        SUSPICION_BANDS.find(([min]) => suspicion.confidence >= min)?.[1] ??
        SUSPICION_BANDS[SUSPICION_BANDS.length - 1][1],
      aboutYou: suspicion.actorId === 'player',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Diagnostic. Used by tests and the statistical harness, never by the UI. */
export function mistakenBeliefs(state: GameState): number {
  let count = 0;
  for (const id of ALL_FACTIONS) {
    for (const suspicion of state.factions[id]?.suspicions ?? []) {
      if (suspicion.mistaken) count += 1;
    }
  }
  return count;
}
