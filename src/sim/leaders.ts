/**
 * The men running the other families, and what happens when they stop.
 *
 * A leaf module. The faction AI reads `leaderPersonality` on every scoring
 * pass, so nothing here may import faction.ts — which is fine, because a boss
 * dying is entirely a matter of arithmetic on his own record plus a few knocks
 * to the organization he leaves.
 */

import { Rng, clamp } from './rng';
import type { Faction, FactionLeader, GameState } from './types';
import { addLog } from './util';
import { promoteFromWithin } from './capos';
import {
  LEADER_AGE_ON_TAKING,
  LEADER_BIAS,
  LEADER_DECLINE_FROM,
  LEADER_EXIT_BASE,
  LEADER_EXIT_PER_YEAR,
  LEADER_FIRST_NAMES,
  LEADER_HANDOVER,
  LEADER_REPUTATIONS,
} from '../config/factionLeaders';
import {
  ALL_FACTIONS,
  type FactionId,
  type FactionPersonality,
} from '../config/factions';
import { DAYS_PER_YEAR } from '../config/economy';
import { LAST_NAMES } from '../config/npcs';
import { houseDef, housePersonality } from './houses';

/**
 * A new boss.
 *
 * The reputation line and the personality bias are picked together rather than
 * independently, so a man described as settling things in the street is
 * actually more aggressive than his predecessor. Getting that wrong is how you
 * end up with flavour text that quietly contradicts the simulation.
 */
export function newLeader(rng: Rng, day: number, familyName: string): FactionLeader {
  const reputation = rng.pick(LEADER_REPUTATIONS);
  const bias = LEADER_BIAS[reputation.suits];
  // Half the time he is one of the family, half the time he married in or
  // came up through it. Either way the surname is the one people use.
  const surname = rng.chance(0.55) ? familyName : rng.pick(LAST_NAMES);

  return {
    name: `${rng.pick(LEADER_FIRST_NAMES)} ${surname}`,
    age: rng.int(LEADER_AGE_ON_TAKING[0], LEADER_AGE_ON_TAKING[1]),
    since: day,
    // Jittered, so two bosses of the same type are not the same boss.
    bias: {
      aggression: bias.aggression * rng.float(0.7, 1.3),
      ambition: bias.ambition * rng.float(0.7, 1.3),
      commerce: bias.commerce * rng.float(0.7, 1.3),
      caution: bias.caution * rng.float(0.7, 1.3),
    },
    reputation: reputation.text,
  };
}

/**
 * The family's temperament as filtered through whoever is in charge.
 *
 * Clamped at both ends: a cautious boss of an aggressive family should be a
 * noticeably different organization, not a different family altogether.
 */
export function leaderPersonality(state: GameState, faction: Faction): FactionPersonality {
  const base = housePersonality(state, faction.id);
  const bias = faction.leader?.bias;
  if (!bias) return base;
  return {
    aggression: clamp(base.aggression + bias.aggression, 0.05, 1.4),
    ambition: clamp(base.ambition + bias.ambition, 0.05, 1.4),
    commerce: clamp(base.commerce + bias.commerce, 0.05, 1.4),
    caution: clamp(base.caution + bias.caution, 0.05, 1.4),
  };
}

/**
 * Yearly. Bosses get older and eventually stop.
 *
 * This is the only mechanism by which the other three organizations change
 * character over a long game without the player doing it to them — and it is
 * why a thirty-year Simulation run is now a different city at the end than it
 * was in the middle, rather than the same four constants with more money.
 */
export function tickLeaders(state: GameState, rng: Rng): void {
  if (state.day % DAYS_PER_YEAR !== 0) return;

  for (const id of ALL_FACTIONS) {
    if (id === 'player') continue;
    const faction = state.factions[id];
    if (!faction?.leader) continue;

    faction.leader.age += 1;
    const over = faction.leader.age - LEADER_DECLINE_FROM;
    if (over <= 0) continue;

    const chance = clamp(LEADER_EXIT_BASE + over * LEADER_EXIT_PER_YEAR, 0, 0.7);
    if (!rng.chance(chance)) continue;

    replaceLeader(state, rng, faction, id);
  }
}

/** The handover. A house between bosses is a weaker house and everyone knows. */
export function replaceLeader(
  state: GameState,
  rng: Rng,
  faction: Faction,
  id: FactionId,
): void {
  const def = houseDef(state, id);
  const gone = faction.leader;

  /*
   * The chair goes to somebody who was already in the room, if there is
   * anybody in it.
   *
   * Before the capos existed this conjured a stranger every time, which meant
   * a family's whole character could change overnight for reasons nobody could
   * have anticipated. Now the successor is a man the player has been able to
   * watch for years — and the runner-up, if it was close, is a problem for the
   * new boss from his first day.
   */
  const heir = promoteFromWithin(state, faction);
  const successor = newLeader(rng, state.day, def.shortName);
  if (heir) {
    successor.name = heir.name;
    successor.age = heir.age;
    // Ambition was the thing that got him here, so it carries into how he runs
    // the place. The rest of his temperament is his own.
    successor.bias.ambition += (heir.ambition / 100) * 0.3;
  }
  faction.leader = successor;

  faction.strength = clamp(faction.strength - LEADER_HANDOVER.strengthLost, 0, 100);
  faction.warWeariness = Math.max(0, faction.warWeariness - LEADER_HANDOVER.wearinessForgiven);

  /*
   * Everybody re-prices them, including the player.
   *
   * Respect rather than grudge: a house between bosses has not done anything
   * to anybody, it has simply become an unknown quantity run by a man nobody
   * has dealt with. Trust goes with it for the same reason — whatever
   * understanding you had was with the last one.
   */
  for (const other of ALL_FACTIONS) {
    if (other === id) continue;
    for (const [from, to] of [
      [id, other],
      [other, id],
    ] as [FactionId, FactionId][]) {
      const holder = state.factions[from];
      if (!holder) continue;
      const record = holder.bonds[to] ?? { grudge: 0, respect: 0, trust: 0, warSince: null };
      record.respect = clamp(record.respect + LEADER_HANDOVER.respectHit, -100, 100);
      record.trust = clamp(record.trust + LEADER_HANDOVER.trustHit, -100, 100);
      holder.bonds[to] = record;
    }
  }

  /*
   * An agenda belongs to the man who set it.
   *
   * Leaving it in place was the first version, and it produced a family that
   * had visibly changed hands and carried on pursuing the dead man's feud —
   * which is precisely the constant-personality problem this file exists to
   * remove, wearing a new name.
   */
  faction.agenda = null;
  faction.currentObjective = null;

  addLog(
    state,
    `${gone?.name ?? 'The old man'} is finished. ${successor.name} has the ${def.shortName} now.`,
    'crew',
  );
}
