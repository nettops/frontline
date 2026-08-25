/**
 * Succession and city conditions.
 *
 * The properties under test: being removed is not the same as losing, naming
 * an heir is a real decision with a real cost, the handover hurts without
 * being fatal, and a condition is weather rather than a permanent state.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { maxCrew } from '../player';
import { newGame } from '../state';
import { runDaysSolvent } from './helpers';
import { crewList } from '../npc';
import {
  claimStrength,
  eligibleHeirs,
  heirOf,
  nameHeir,
  perceivedClaim,
  removePlayer,
  rollAssassination,
} from '../succession';
import { activeCondition, tickWorld, worldMod, worldSuccessDelta } from '../world';
import { CLAIM, REMOVAL } from '../../config/succession';
import { WORLD_CONDITIONS, WORLD_CONDITION_BY_ID } from '../../config/world';
import { ROLE_ORDER } from '../../config/economy';
import type { GameState, Npc, RoleId } from '../types';

function fresh(seed = 909): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Adds somebody at a given role with controllable stats. */
function plant(
  state: GameState,
  id: string,
  role: RoleId,
  stats: Partial<Npc['stats']> = {},
  extra: Partial<Npc> = {},
): Npc {
  const template = crewList(state)[0];
  const npc = structuredClone(template);
  npc.id = id;
  npc.name = `Man ${id}`;
  npc.role = role;
  npc.status = 'active';
  npc.daysInCrew = 200;
  npc.opsCompleted = 12;
  Object.assign(npc.stats, { leadership: 50, skill: 50, courage: 50, ambition: 50 }, stats);
  Object.assign(npc, extra);
  state.npcs[id] = npc;
  return npc;
}

describe('who has a claim', () => {
  it('ranks a senior, capable, ambitious man above a junior one', () => {
    const state = fresh();
    const capo = plant(state, 'a', 'capo', { leadership: 80, ambition: 70 });
    const soldier = plant(state, 'b', 'soldier', { leadership: 30, ambition: 70 });
    expect(claimStrength(state, capo)).toBeGreaterThan(claimStrength(state, soldier));
  });

  it('gates a claim on wanting it', () => {
    const state = fresh();
    const willing = plant(state, 'a', 'capo', { ambition: 90 });
    const unwilling = plant(state, 'b', 'capo', { ambition: 5 });
    expect(claimStrength(state, willing)).toBeGreaterThan(claimStrength(state, unwilling));
    // ...but never to zero. A room can hand it to somebody who never asked.
    expect(claimStrength(state, unwilling)).toBeGreaterThan(0);
  });

  it('does not consider anybody too junior to be followed', () => {
    const state = fresh();
    plant(state, 'a', 'associate', { leadership: 99, ambition: 99 });
    const floor = ROLE_ORDER.indexOf(CLAIM.minRole);
    for (const npc of eligibleHeirs(state)) {
      expect(ROLE_ORDER.indexOf(npc.role)).toBeGreaterThanOrEqual(floor);
    }
  });

  it('reads a claim through perception, not through the true stats', () => {
    const state = fresh();
    // Somebody nobody knows reads as an average man whatever he actually is.
    const stranger = plant(state, 'a', 'capo', { leadership: 5, skill: 5, courage: 5 }, {
      familiarity: 0,
      daysInCrew: 1,
      opsCompleted: 0,
    });
    expect(perceivedClaim(state, stranger)).toBeGreaterThan(claimStrength(state, stranger));
  });

  it('never reports a claim outside 0..1', () => {
    const state = fresh();
    const best = plant(state, 'a', 'underboss', {
      leadership: 100,
      skill: 100,
      courage: 100,
      ambition: 100,
    }, { daysInCrew: 5000, opsCompleted: 900 });
    nameHeir(state, best.id);
    expect(claimStrength(state, best)).toBeLessThanOrEqual(1);
    expect(claimStrength(state, best)).toBeGreaterThanOrEqual(0);
  });
});

describe('naming an heir', () => {
  it('costs you with everybody you did not name', () => {
    const state = fresh();
    const chosen = plant(state, 'a', 'capo');
    const passed = plant(state, 'b', 'capo', { grievance: 10, loyalty: 60 });

    const before = { grievance: passed.stats.grievance, loyalty: passed.stats.loyalty };
    expect(nameHeir(state, chosen.id).ok).toBe(true);

    expect(passed.stats.grievance).toBeGreaterThan(before.grievance);
    expect(passed.stats.loyalty).toBeLessThan(before.loyalty);
  });

  it('gives the man you named ambition he did not have', () => {
    const state = fresh();
    const chosen = plant(state, 'a', 'capo', { ambition: 40 });
    nameHeir(state, chosen.id);
    expect(chosen.stats.ambition).toBeGreaterThan(40);
    expect(claimStrength(state, chosen)).toBeGreaterThan(0);
  });

  it('lands worse to take it back than never to have said it', () => {
    const state = fresh();
    const chosen = plant(state, 'a', 'capo', { grievance: 0 });
    nameHeir(state, chosen.id);
    const afterNaming = chosen.stats.grievance;
    nameHeir(state, null);

    const other = plant(state, 'b', 'capo', { grievance: 0 });
    nameHeir(state, other.id);
    // Being demoted from heir hurts more than merely being passed over.
    expect(chosen.stats.grievance - afterNaming).toBeGreaterThan(other.stats.grievance);
    expect(heirOf(state)?.id).toBe(other.id);
  });

  it('refuses somebody too junior, and forgets an heir who is gone', () => {
    const state = fresh();
    const junior = plant(state, 'a', 'associate');
    expect(nameHeir(state, junior.id).ok).toBe(false);

    const capo = plant(state, 'b', 'capo');
    nameHeir(state, capo.id);
    capo.status = 'dead';
    expect(heirOf(state)).toBeNull();
  });
});

describe('being removed', () => {
  it('continues the game as somebody else when there is anybody to take it', () => {
    const state = fresh();
    plant(state, 'a', 'capo', { leadership: 80, ambition: 70 });
    const rng = new Rng(state.rng);

    removePlayer(state, rng, 'convicted', 'They made it stick.');

    expect(state.gameOver).toBeNull();
    expect(state.player.name).toBe('Man a');
    expect(state.succession.generation).toBe(2);
    expect(state.succession.line).toHaveLength(1);
    expect(state.succession.line[0].name).toBe('Test Boss');
    // The successor stops being crew but stays on file, so every evidence
    // trace and suspect list naming them still resolves.
    expect(state.npcs.a.status).toBe('boss');
    expect(crewList(state).some((n) => n.id === 'a')).toBe(false);
  });

  it('ends the game when there is nobody senior enough', () => {
    const state = fresh();
    // The starting associate is not a candidate, by design.
    const rng = new Rng(state.rng);
    removePlayer(state, rng, 'killed', 'Somebody got to him.');
    expect(state.gameOver).not.toBeNull();
    expect(state.succession.generation).toBe(1);
  });

  it('hands the successor a smaller organization but not a dead one', () => {
    const state = fresh();
    plant(state, 'a', 'capo', { leadership: 80, ambition: 70 });
    state.org.respect = 400;
    state.org.cash = 100_000;
    state.org.heat = 80;
    state.player.rank = 'capo';
    const homeInfluence = state.territories.riverside.influence.player;
    const before = { cap: maxCrew(state) };

    removePlayer(state, new Rng(state.rng), 'convicted', 'They made it stick.');

    expect(state.org.respect).toBeLessThan(400);
    expect(state.org.respect).toBeGreaterThan(0);
    expect(state.org.cash).toBeLessThan(100_000);
    expect(state.org.cash).toBeGreaterThan(0);
    /*
       Heat is the one thing a conviction does *not* shrink.

       This line read `toBeLessThan(80)` and passed for the life of the project,
       because `heatKept` halved attention on every handover regardless of what
       emptied the chair. That made being convicted the cheapest heat cure in
       the game — see config/succession.ts:heatKeptWhenConvicted for the
       measurements, and the 'a conviction does not buy quiet' block below for
       the rule itself.

       Changed deliberately, not weakened: this test is about the successor
       inheriting a smaller organization, and that claim is still carried by
       respect, cash, influence and rank on the lines around it.
    */
    expect(state.org.heat).toBe(80);
    expect(state.territories.riverside.influence.player).toBeLessThanOrEqual(homeInfluence);
    /*
       Ground, not a rung.

       This asserted `rankIndex(player.rank) === rankIndex('capo') - ranksLost`.
       Nothing reads rank any more — the job table, the trades and the crew cap
       all read the board — so a docked title would have been a punishment the
       successor never felt. What they actually inherit smaller is the ground,
       and the ceiling on what they can hold falls with it, which is the line
       below and the one that now carries this claim.
    */
    expect(maxCrew(state), 'the successor can hold as much as the boss could')
      .toBeLessThanOrEqual(before.cap);
  });

  it('derives the new player from who the successor actually was', () => {
    const state = fresh();
    const sharp = plant(state, 'a', 'capo', {
      intelligence: 95,
      leadership: 90,
      ambition: 70,
    });
    const dull = plant(state, 'b', 'soldier', { intelligence: 5, leadership: 5, ambition: 5 });
    void dull;

    removePlayer(state, new Rng(state.rng), 'killed', 'Shot outside a restaurant.');

    expect(state.player.name).toBe(sharp.name);
    expect(state.player.attributes.intelligence).toBeGreaterThan(0);
    expect(state.player.attributes.leadership).toBeGreaterThan(0);
    // Inherited attributes are a blend of hidden stats, never a raw copy.
    expect(state.player.attributes.intelligence).toBeLessThanOrEqual(12);
  });

  it('leaves the open files without the man they were built around', () => {
    const state = fresh();
    plant(state, 'a', 'capo', { leadership: 80, ambition: 70 });
    state.law.investigations.case_1 = {
      id: 'case_1',
      agencyId: 'city_police',
      stage: 'arrests',
      openedDay: 1,
      stageSince: 1,
      strength: 80,
      suspectIds: [],
      businessIds: [],
      lastProgressDay: 1,
      status: 'open',
      verdict: null,
      verdictDay: null,
      history: [],
    };

    removePlayer(state, new Rng(state.rng), 'convicted', 'They made it stick.');

    const file = state.law.investigations.case_1;
    expect(file.strength).toBeLessThan(80);
    expect(file.status).toBe('cold');
  });

  it('does not put the player on the table in a war they are winning', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    // A rout, but the player is the stronger party — nothing should happen.
    expect(rollAssassination(state, rng, 0.99, 1.5, 'Falcone')).toBe(false);
    // A close week while outmatched is also not how a boss dies.
    expect(
      rollAssassination(state, rng, REMOVAL.assassinationMarginAbove - 0.01, 0.2, 'Falcone'),
    ).toBe(false);
    expect(state.gameOver).toBeNull();
  });
});

describe('city conditions', () => {
  it('reports no modifier at all when nothing is happening', () => {
    const state = fresh();
    expect(activeCondition(state)).toBeNull();
    expect(worldMod(state, 'payout')).toBe(1);
    expect(worldMod(state, 'agencyWork')).toBe(1);
    expect(worldSuccessDelta(state)).toBe(0);
  });

  it('runs one at a time and lets it expire', () => {
    const state = fresh();
    state.world.conditionId = 'boom';
    state.world.startedDay = state.day;
    state.world.endsDay = state.day + 1;
    expect(worldMod(state, 'payout')).toBeGreaterThan(1);

    state.day += 2;
    tickWorld(state, new Rng(state.rng));
    expect(state.world.conditionId).toBeNull();
    expect(worldMod(state, 'payout')).toBe(1);
  });

  it('leaves the ordinary state of the world ordinary', () => {
    // A condition is weather. If the city is in one most of the time the
    // modifiers stop being a change and become the baseline.
    const state = fresh();
    let daysUnderCondition = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 730; i++) {
      runDaysSolvent(state, 1);
      if (state.world.conditionId) {
        daysUnderCondition += 1;
        seen.add(state.world.conditionId);
      }
    }
    // Both halves matter. Without the lower bound this passes for a system
    // that never fires at all, which is exactly the shape of a dead feature.
    expect(seen.size).toBeGreaterThan(0);
    expect(daysUnderCondition).toBeGreaterThan(20);
    expect(daysUnderCondition).toBeLessThan(365);
  });

  it('never lets a condition assert a modifier it did not declare', () => {
    const state = fresh();
    for (const def of WORLD_CONDITIONS) {
      state.world.conditionId = def.id;
      state.world.endsDay = state.day + 10;
      for (const key of ['payout', 'heatGain', 'businessRevenue', 'agencyWork'] as const) {
        const expected = def.effects[key] ?? 1;
        expect(worldMod(state, key)).toBe(expected);
      }
    }
  });

  it('only offers conditions the board can actually cause', () => {
    // Day one: no cases, no war, no fronts, nobody bleeding.
    const impossible = ['federal_interest', 'audit_season', 'blood_in_water'];
    for (const id of impossible) {
      const def = WORLD_CONDITION_BY_ID[id];
      expect(
        def.requires?.({
          day: 1,
          heat: 0,
          openCases: 0,
          worstCaseStage: 0,
          crewSize: 1,
          districtsHeld: 0,
          businesses: 0,
          warInCity: false,
          bleedingRival: false,
          weeklyLaundered: 0,
        }),
      ).toBe(false);
    }
  });
});

describe('succession does not break the world', () => {
  it('survives a handover mid-game with the simulation intact', () => {
    const state = fresh(4242);
    runDaysSolvent(state, 120);
    plant(state, 'heir', 'capo', { leadership: 80, ambition: 70, loyalty: 80 });

    removePlayer(state, new Rng(state.rng), 'killed', 'Shot outside a restaurant.');
    expect(state.gameOver).toBeNull();

    runDaysSolvent(state, 200);

    expect(Number.isFinite(state.org.cash)).toBe(true);
    expect(Number.isFinite(state.org.heat)).toBe(true);
    expect(state.org.heat).toBeGreaterThanOrEqual(0);
    expect(state.org.heat).toBeLessThanOrEqual(100);
    for (const npc of Object.values(state.npcs)) {
      expect(Number.isFinite(npc.stats.loyalty)).toBe(true);
    }
    for (const op of Object.values(state.activeOperations)) {
      for (const id of op.crewIds) expect(state.npcs[id]).toBeDefined();
    }
  });
});

describe('a conviction does not buy quiet', () => {
  /*
     The state's own sanction was the cheapest heat cure in the game.

     `heatKept` halves organizational attention on every handover, which is
     right when a chair empties on its own and backwards when the agencies are
     the reason it emptied. A boss at 100 could be convicted and hand over at
     50, keeping nine tenths of the money and usually the rank — so there was
     no reason to lay low, buy a contact, or care who was informing.
  */
  function handOverAt(kind: 'convicted' | 'killed' | 'deposed'): number {
    const state = newGame({ name: 'Heat', difficulty: 'normal', seed: 11 });
    const rng = new Rng(state.rng);
    // Somebody the room will follow, so there is a handover rather than an end.
    runDaysSolvent(state, 200);
    for (const npc of crewList(state)) {
      npc.stats.loyalty = 90;
      npc.stats.respectForBoss = 90;
      npc.stats.skill = 70;
      npc.stats.leadership = 70;
      npc.daysInCrew = 200;
    }
    state.org.heat = 100;
    removePlayer(state, rng, kind, 'For the test.');
    return state.org.heat;
  }

  it('keeps the heat when the state took the boss, and sheds it otherwise', () => {
    const convicted = handOverAt('convicted');
    const deposed = handOverAt('deposed');

    // Both must actually have handed over, or this measures nothing.
    expect(convicted).toBeGreaterThan(0);
    expect(deposed).toBeGreaterThan(0);

    expect(convicted).toBe(100);
    expect(deposed).toBeLessThan(convicted);
  });
});
