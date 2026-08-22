/**
 * Game modes, and allies who actually turn up.
 *
 * The properties under test: Sandbox is the same simulation with the ending
 * switched off rather than an easier one, Simulation is a city that runs
 * correctly with nobody in it, and an alliance is something you can feel in a
 * fight — on both sides of it.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { advanceDay, advanceDays } from '../clock';
import { runDays, runDaysSolvent } from './helpers';
import { crewList } from '../npc';
import { controlledTerritories, territoryList } from '../territory';
import {
  activeWars,
  alliesOf,
  declareWar,
  factionStrength,
  setRelationship,
  tickWars,
} from '../diplomacy';
import { removePlayer } from '../succession';
import { SANDBOX_STARTS } from '../../config/modes';
import { ALLIANCE } from '../../config/diplomacy';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function career(seed = 3): GameState {
  return newGame({ name: 'Career', difficulty: 'normal', seed });
}

describe('sandbox is the same game with the ending switched off', () => {
  it('starts you where you asked to start', () => {
    const seated = SANDBOX_STARTS.find((s) => s.id === 'seated')!;
    const state = newGame({
      name: 'Sandbox',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'seated',
      seed: 5,
    });
    expect(state.player.rank).toBe(seated.rank);
    expect(state.org.cash).toBe(seated.cash);
    expect(crewList(state)).toHaveLength(
      seated.crew.reduce((sum, c) => sum + c.count, 0),
    );
    expect(controlledTerritories(state).length).toBeGreaterThan(0);
  });

  /*
   * The whole point. A sandbox that hands over the true stats has quietly
   * turned off the one mechanic the game is built on, and you would be testing
   * a different game from the one you meant to test.
   */
  it('still hides what people are really like', () => {
    const state = newGame({
      name: 'Sandbox',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'seated',
      seed: 6,
    });
    for (const npc of crewList(state)) {
      expect(npc.familiarity).toBeLessThan(100);
    }
  });

  it('cannot be finished by running out of everything', () => {
    const state = newGame({
      name: 'Sandbox',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'nobody',
      seed: 7,
    });
    for (const npc of crewList(state)) npc.status = 'dead';
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    advanceDay(state);
    expect(state.gameOver).toBeNull();
  });

  it('cannot be finished by a conviction with nobody to inherit', () => {
    const state = newGame({
      name: 'Sandbox',
      difficulty: 'normal',
      mode: 'sandbox',
      sandboxStart: 'nobody',
      seed: 8,
    });
    for (const npc of crewList(state)) npc.status = 'dead';
    removePlayer(state, new Rng(state.rng), 'convicted', 'They made it stick.');
    expect(state.gameOver).toBeNull();
  });

  it('leaves a career able to end, which is the comparison that matters', () => {
    const state = career();
    for (const npc of crewList(state)) npc.status = 'dead';
    removePlayer(state, new Rng(state.rng), 'convicted', 'They made it stick.');
    expect(state.gameOver).not.toBeNull();
  });
});

describe('simulation is a city with nobody in it', () => {
  const observe = (seed: number) =>
    newGame({ name: '', difficulty: 'normal', mode: 'simulation', seed });

  it('starts with no organization and no claim on anywhere', () => {
    const state = observe(11);
    expect(crewList(state)).toHaveLength(0);
    expect(Object.keys(state.recruits)).toHaveLength(0);
    for (const t of territoryList(state)) expect(t.influence.player).toBe(0);
  });

  /*
   * Deliberately `advanceDays` and not `runDays`.
   *
   * `runDays` answers whatever is waiting before it moves, which is right for
   * testing the systems and wrong here — it papers over the exact failure this
   * is for. The first version used it and passed against a build where a city
   * condition still queued a memo, so eight presses of "+1 year" all landed on
   * day 99 and the clock never moved again. The UI advances through
   * `advanceDays`, which stops dead on a queued memo, so the test must too.
   */
  it('never ends, and never stops to ask a player who is not there', () => {
    const state = observe(12);
    const moved = advanceDays(state, 730);
    expect(moved).toBe(730);
    expect(state.day).toBe(731);
    expect(state.gameOver).toBeNull();
    expect(state.pendingEvents).toHaveLength(0);
  });

  it('still gets its weather, it is just not handed a memo about it', () => {
    const state = observe(16);
    advanceDays(state, 730);
    expect(state.log.some((l) => l.text.includes('.'))).toBe(true);
    expect(state.flags).not.toEqual({});
  });

  /*
   * The reason this mode is worth having. If the families do nothing without a
   * player to react to, the AI was reacting to the player rather than deciding
   * for itself, and two phases of work were a puppet show.
   */
  it('the families get on with it regardless', () => {
    const state = observe(13);
    const before = territoryList(state).map((t) => ({ ...t.influence }));
    runDays(state, 730);

    const moved = territoryList(state).filter((t, i) =>
      RIVAL_IDS.some((id) => Math.abs(t.influence[id] - before[i][id]) > 5),
    );
    expect(moved.length).toBeGreaterThan(2);
    expect(Object.values(state.factions).some((f) => f.history.length > 5)).toBe(true);
  });

  it('never turns the map a single colour', () => {
    const state = observe(14);
    runDays(state, 1095);
    for (const id of RIVAL_IDS) {
      expect(factionStrength(state, id)).toBeGreaterThan(0);
    }
  });

  it('leaves the player out of the wars entirely', () => {
    const state = observe(15);
    runDays(state, 730);
    for (const [a, b] of activeWars(state)) {
      expect(a).not.toBe('player');
      expect(b).not.toBe('player');
    }
  });
});

describe('allies turn up', () => {
  /** Two rivals allied against a third, all of them at war. */
  function threeWay(seed = 21) {
    const state = career(seed);
    const [first, second, third] = RIVAL_IDS;
    setRelationship(state, first, second, 85);
    declareWar(state, first, third);
    declareWar(state, second, third);
    return { state, first, second, third };
  }

  it('an ally in the war stands with you and takes some of the beating', () => {
    const { state, first, second, third } = threeWay();
    expect(alliesOf(state, first)).toContain(second);

    const before = state.factions[second].strength;
    // Force the outcome by making the third side overwhelming, so the losing
    // side is known and the ally's share of the damage is what is measured.
    state.factions[third].strength = 100;
    state.factions[first].strength = 5;
    tickWars(state, new Rng(state.rng));

    expect(state.factions[second].strength).toBeLessThan(before);
    expect(state.factions[second].warWeariness).toBeGreaterThan(0);
  });

  /**
   * A friend of one side who is not in the war: the quiet tier. Set up so the
   * only thing that can move their relationship with the other side afterwards
   * is having been seen helping.
   */
  function quietFriend(seed: number, weariness = 0) {
    const state = career(seed);
    const [first, second, third] = RIVAL_IDS;
    setRelationship(state, first, second, 85);
    declareWar(state, first, third);
    // declareWar drags allies toward the enemy; put the friend back to
    // indifferent so the penalty measured below is only for turning out.
    setRelationship(state, second, third, 0);
    state.factions[second].warWeariness = weariness;
    return { state, first, second, third };
  }

  it('a friend who stays out of it still gets noticed by the other side', () => {
    const { state, second, third } = quietFriend(22);
    const strengthBefore = state.factions[second].strength;
    tickWars(state, new Rng(state.rng));

    // Being seen helping is recorded as a grudge, which is what makes it
    // spread: the grudge is the thing that redirects pressure and eventually
    // wars, not a generic drop in how warmly they feel.
    expect(state.factions[second].bonds[third].grudge).toBeGreaterThan(0);
    // Quiet help costs money and goodwill, never blood. They are also at peace,
    // so the week leaves them stronger rather than merely unhurt.
    expect(state.factions[second].strength).toBeGreaterThanOrEqual(strengthBefore);
  });

  it('somebody allied to both sides refuses to pick one', () => {
    const state = career(23);
    const [first, second, third] = RIVAL_IDS;
    setRelationship(state, second, first, 85);
    setRelationship(state, second, third, 85);
    declareWar(state, first, third);
    setRelationship(state, second, first, 85);
    setRelationship(state, second, third, 85);

    const before = {
      first: state.factions[second].bonds[first].grudge,
      third: state.factions[second].bonds[third].grudge,
    };
    tickWars(state, new Rng(state.rng));
    expect(state.factions[second].bonds[first].grudge).toBe(before.first);
    expect(state.factions[second].bonds[third].grudge).toBe(before.third);
  });

  it('does not conscript the player into somebody else\'s war', () => {
    const state = career(24);
    const [first, second, third] = RIVAL_IDS;
    setRelationship(state, 'player', first, 85);
    declareWar(state, first, third);
    // The player is allied to a side that is fighting, and is not in it.
    const crewBefore = crewList(state).map((n) => n.status);
    tickWars(state, new Rng(state.rng));
    expect(crewList(state).map((n) => n.status)).toEqual(crewBefore);
    void second;
  });

  /*
   * Measured through the relationship rather than through strength, because a
   * committed ally takes damage from its own war whether or not it also turned
   * out for yours — which is what the first version of this test mistook for
   * evidence that it had.
   */
  it('an exhausted ally stays home', () => {
    const { state, second, third } = quietFriend(25, ALLIANCE.wearinessStaysHome + 10);
    const before = state.factions[second].bonds[third].grudge;
    tickWars(state, new Rng(state.rng));
    expect(state.factions[second].bonds[third].grudge).toBe(before);
  });

  it('leaves a long game intact', () => {
    const state = career(26);
    const [first, second] = RIVAL_IDS;
    setRelationship(state, 'player', first, 85);
    setRelationship(state, first, second, 80);
    runDaysSolvent(state, 730);
    for (const id of RIVAL_IDS) {
      const f = state.factions[id];
      expect(Number.isFinite(f.strength)).toBe(true);
      expect(f.strength).toBeGreaterThanOrEqual(0);
      expect(f.strength).toBeLessThanOrEqual(100);
      expect(Number.isFinite(f.warWeariness)).toBe(true);
    }
  });
});
