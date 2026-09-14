/**
 * What a real gap in two capos' organizational standing does to the weaker
 * one's own tie to the stronger — see `capoTension.ts`'s header.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { GOAL_CERTAIN_ABOVE } from '../../config/goals';
import { CAPO_TENSION } from '../../config/capoTension';
import { capoStanding } from '../capoStanding';
import { checkCapoPowerImbalance } from '../capoTension';
import type { GameState, Npc } from '../types';

function game(seed = 701): GameState {
  return newGame({ name: 'CapoTension', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 1919, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

/** A capo with the title and nothing else — `capoStanding` tier 0. */
function weakCapo(state: GameState, calls: number): Npc {
  const capo = hire(state, 'capo', calls);
  capo.familiarity = GOAL_CERTAIN_ABOVE;
  capo.stats.leadership = 5;
  return capo;
}

/** A capo with a real following, ground, and a chain earning on its own — tier 3. */
function dangerousCapo(state: GameState, calls: number): Npc {
  const capo = hire(state, 'capo', calls);
  capo.familiarity = GOAL_CERTAIN_ABOVE;
  capo.stats.leadership = 90;
  const reports: Npc[] = [];
  for (let i = 0; i < 2; i++) {
    const soldier = hire(state, 'soldier', calls + 1 + i);
    soldier.reportsTo = capo.id;
    soldier.opsCompleted = 8;
    reports.push(soldier);
  }
  Object.values(state.territories)[0].stewardId = capo.id;
  return capo;
}

describe('checkCapoPowerImbalance', () => {
  it('does nothing off the weekly cadence', () => {
    const state = game();
    const weak = weakCapo(state, 1);
    const strong = dangerousCapo(state, 10);
    expect(capoStanding(state, strong.id)!.tier - capoStanding(state, weak.id)!.tier).toBeGreaterThanOrEqual(
      CAPO_TENSION.gapTiers,
    );

    state.day = 3; // not a multiple of checkIntervalDays
    checkCapoPowerImbalance(state);

    expect(weak.ties.find((t) => t.id === strong.id)).toBeUndefined();
  });

  it('leaves a capo whose gap to the other is below the threshold untouched', () => {
    const state = game(702);
    const a = hire(state, 'capo', 1);
    a.familiarity = GOAL_CERTAIN_ABOVE;
    a.stats.leadership = 5;
    const b = hire(state, 'capo', 5);
    b.familiarity = GOAL_CERTAIN_ABOVE;
    b.stats.leadership = 90; // one signal up, not enough alone to clear a 2-tier gap
    const gap = Math.abs(capoStanding(state, a.id)!.tier - capoStanding(state, b.id)!.tier);
    expect(gap).toBeLessThan(CAPO_TENSION.gapTiers);

    state.day = CAPO_TENSION.checkIntervalDays;
    checkCapoPowerImbalance(state);

    expect(a.ties.find((t) => t.id === b.id)).toBeUndefined();
    expect(b.ties.find((t) => t.id === a.id)).toBeUndefined();
  });

  it('records the gap onto the weaker capo\'s tie to the stronger one, and only that direction', () => {
    const state = game(703);
    const weak = weakCapo(state, 1);
    const strong = dangerousCapo(state, 10);
    state.day = CAPO_TENSION.checkIntervalDays;

    checkCapoPowerImbalance(state);

    const tie = weak.ties.find((t) => t.id === strong.id);
    expect(tie).toBeDefined();
    expect(tie!.resentment).toBeGreaterThan(0);
    expect(tie!.cause).toBe('lost_the_room');
    expect(tie!.since).toBe(state.day);
    // A man does not resent somebody beneath him — the stronger capo carries
    // nothing back the other way.
    expect(strong.ties.find((t) => t.id === weak.id)).toBeUndefined();
  });

  it('does not refire on the same pair inside the cooldown', () => {
    const state = game(704);
    const weak = weakCapo(state, 1);
    const strong = dangerousCapo(state, 10);
    state.day = CAPO_TENSION.checkIntervalDays;
    checkCapoPowerImbalance(state);
    const firstResentment = weak.ties.find((t) => t.id === strong.id)!.resentment;

    state.day += CAPO_TENSION.checkIntervalDays; // still well inside cooldownDays
    checkCapoPowerImbalance(state);

    const tie = weak.ties.find((t) => t.id === strong.id)!;
    expect(tie.resentment).toBe(firstResentment);
    expect(tie.since).toBe(CAPO_TENSION.checkIntervalDays); // untouched since the first write
  });

  it('can register the gap again once the cooldown has passed', () => {
    const state = game(705);
    const weak = weakCapo(state, 1);
    const strong = dangerousCapo(state, 10);
    state.day = CAPO_TENSION.checkIntervalDays;
    checkCapoPowerImbalance(state);

    const next = CAPO_TENSION.checkIntervalDays + CAPO_TENSION.cooldownDays + CAPO_TENSION.checkIntervalDays;
    state.day = next - (next % CAPO_TENSION.checkIntervalDays); // land on the weekly cadence
    checkCapoPowerImbalance(state);

    const tie = weak.ties.find((t) => t.id === strong.id)!;
    expect(tie.since).toBe(state.day);
  });
});
