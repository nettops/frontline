/**
 * The player character: standing and attributes.
 *
 * There is no advancement here any more. Ranks were gated on the state of the
 * organization — money, people, reputation — and every one of those gates now
 * lives on the thing it was gating: `opens` decides the job table, ground and
 * premises decide the payroll, the board decides who you can name. `player.rank`
 * survives as a name on the save and nothing reads it as a gate.
 *
 * What is left is the record the organization keeps of its own high-water
 * marks, which the front-health floor and `legacy.ts` read, and the attribute
 * training that was never part of the ladder.
 */

import { clamp } from './rng';
import type { AttributeId, GameState } from './types';
import { addLog } from './util';
import { crewList } from './npc';
import { controlledTerritories } from './territory';
import { estate } from './estate';
import { ownedBusinesses } from './business';
import {
  ATTRIBUTE_LABEL,
  ATTRIBUTE_MAX,
  CREW_BASE,
  CREW_PER_DISTRICT,
  CREW_PER_FRONT,
  FEAR,
  PAYDAY_INTERVAL,
  STANDING_HELD,
  attributeProgressNeeded,
} from '../config/economy';

/**
 * How many people you can keep, which is now a question about ground.
 *
 * This read `rankDef(state).maxCrew` — 3 people as a Street Criminal rising to
 * 55 as a Boss — and the rank ladder is gone. Ground is the honest constraint
 * and the better story: you can feed as many people as you have streets to
 * feed them from.
 *
 * Ground and premises both count — see `CREW_PER_FRONT` for what happened when
 * only ground did. Sized to land on the old curve rather than by eye: a career
 * spreading across the map reaches 8 districts and 12 fronts by day 230, which
 * is 59 people against the old Boss ceiling of 55; one working a single
 * neighbourhood holds 1 district and 2 fronts, which is 11 against the 12 the
 * old ladder gave a Crew Leader at day 65.
 */
export function maxCrew(state: GameState): number {
  return (
    CREW_BASE +
    controlledTerritories(state).length * CREW_PER_DISTRICT +
    ownedBusinesses(state).length * CREW_PER_FRONT
  );
}

export function gainRespect(state: GameState, amount: number): void {
  state.org.respect = Math.max(0, state.org.respect + amount);
}

/**
 * Being feared.
 *
 * The other half of what used to be one number called respect. Everything that
 * buys fear is an act of violence or the credible promise of one, and unlike
 * standing it bleeds away if you stop — a reputation for hurting people is a
 * claim, and claims expire.
 */
export function gainFear(state: GameState, amount: number): void {
  state.org.fear = clamp(state.org.fear + amount, 0, FEAR.max);
}

/** 0..1. Every consumer of fear scales its own effect off this. */
export function fearLevel(state: GameState): number {
  return clamp(state.org.fear / FEAR.max, 0, 1);
}

/**
 * Weekly. Fear fades, and while it lasts it costs you in three places at once:
 * the districts you hold, the loyalty of people who had a choice, and the
 * city's opinion of what you are.
 */
export function tickFear(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;
  const level = fearLevel(state);

  state.org.fear = Math.max(0, state.org.fear - FEAR.decayPerWeek);
  if (level <= 0) return;

  // A neighbourhood that is frightened of you is not a neighbourhood that
  // likes you, and businesses will not sell to people they are frightened of.
  for (const t of controlledTerritories(state)) {
    t.sentiment = clamp(t.sentiment + level * FEAR.sentimentPerWeekAtMax, 0, 100);
  }

  // Frightened people are not loyal people. They are just people who have not
  // left yet, which is a different and much worse thing to be running on.
  for (const npc of crewList(state)) {
    npc.stats.loyalty = clamp(npc.stats.loyalty + level * FEAR.loyaltyPerWeekAtMax, 0, 100);
    npc.stats.fear = clamp(npc.stats.fear + level * 0.6, 0, 100);
  }

  // What fear does to the city is a floor on its mood rather than a weekly
  // nudge — see CITY.fearFloorAtMax in config/perception.ts.
}

/**
 * Weekly. What the family holds is worth something to the people whose opinion
 * decides rank, whether or not anything happened this week.
 *
 * Deliberately separate from `tickFear` despite both being weekly and both
 * living here. Fear is a claim that expires; this is the opposite — it is the
 * slow interest on having kept something. Putting them in one function would
 * have made the next person changing either read both.
 */
export function tickStanding(state: GameState): void {
  if (state.day % PAYDAY_INTERVAL !== 0) return;

  const districts = controlledTerritories(state).length;
  const fronts = ownedBusinesses(state).length;
  if (districts === 0 && fronts === 0) return;

  gainRespect(
    state,
    districts * STANDING_HELD.perDistrictPerWeek + fronts * STANDING_HELD.perFrontPerWeek,
  );
}

/**
 * Attributes improve by doing. Progress needed per point scales with the
 * current value, so early growth is quick and mastery is a grind.
 */
export function trainAttribute(
  state: GameState,
  id: AttributeId,
  amount: number,
): void {
  const { attributes, attributeProgress } = state.player;
  if (attributes[id] >= ATTRIBUTE_MAX) return;

  attributeProgress[id] += amount;
  while (
    attributes[id] < ATTRIBUTE_MAX &&
    attributeProgress[id] >= attributeProgressNeeded(attributes[id])
  ) {
    attributeProgress[id] -= attributeProgressNeeded(attributes[id]);
    attributes[id] += 1;
    /*
       The number, not just the news.

       "Your Leadership has improved" told a playtester that something had
       happened and nothing about how much, so they could not tell a point from
       a rounding error and stopped reading the line. What it cost to get is on
       the log entry immediately above this one — the thing you just did — so
       the only piece genuinely missing was where it landed.
    */
    addLog(state, `Your ${ATTRIBUTE_LABEL[id]} has improved to ${attributes[id]}.`, 'success');
  }
}

/**
 * Keep the family's high-water marks up to date.
 *
 * Called once a day. Cheap, and it has to run every day rather than weekly
 * because the peak of anything is usually a moment rather than a Monday — a
 * balance that existed for three days between a payout and a purchase is a
 * balance the family reached.
 */
export function tickRecord(state: GameState): void {
  const now = state.org.record ?? {
    respect: 0,
    crew: 0,
    estate: 0,
    ops: 0,
    districts: 0,
    opsSeen: 0,
  };

  /*
     Operations accumulate; everything else is a peak.

     `player.opsCompleted` belongs to whoever is in the chair and is replaced
     by the successor's own count at a handover, so a plain maximum would stop
     rising the moment a boss with a long record was replaced by a soldier with
     a short one. Tracking the last value seen and adding only the increase
     makes the total belong to the family: it climbs while a boss works, and a
     handover simply starts counting the new man's contribution from zero.
  */
  const ops = state.player.opsCompleted;
  if (ops > now.opsSeen) now.ops += ops - now.opsSeen;
  now.opsSeen = ops;

  now.respect = Math.max(now.respect, Math.floor(state.org.respect));
  now.crew = Math.max(now.crew, crewList(state).length);
  now.estate = Math.max(now.estate, Math.floor(estate(state).total));
  now.districts = Math.max(now.districts, controlledTerritories(state).length);

  state.org.record = now;
}

/*
   `nextRank` and `rankRequirements` were here, and they are gone.

   They computed the distance to the next rung of a table nothing reads. Rank
   gated the job table, the trades, the crew cap and who you could promote;
   all four read the board now, and `player.rank` is pinned at the first rung
   for every career that will ever be played. So the Advancement panel counted
   toward a promotion that could not arrive, and the Overview told a boss
   holding three districts and twelve people that they were "12 of 3".

   `tickRecord` above stays. The high-water marks it keeps are read by the
   front-health floor in `business.ts` and by `legacy.ts` — the table was never
   their only customer, only their loudest one.

   What is *left* of the rank type is `player.rank` itself, which stays on the
   save so that a game written before the ladder came out still loads, and the
   succession line, which records what a predecessor was called. Neither is
   read as a gate.
*/

/*
   `acceptPromotion` and `declinePromotion` were here, with the `rank_offer`
   event that called them. All three are gone.

   Nothing ever raised `rank_offer`: `nextRank` was what decided a promotion
   was due and it was deleted with the rest of the ladder, so `pendingRank`
   could only ever be written `null` and the switch case in `events.ts` was
   unreachable. The functions were still *referenced* from that case, which is
   why a reference-counting sweep left them alone.
*/

