/**
 * How much power a capo has actually built for himself — headcount, whether
 * people listen, ground of his own, and how much money moves through his
 * chain. See `capoStanding.ts`'s header for why these four and not the rest
 * of the design brief's list.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { GOAL_CERTAIN_ABOVE } from '../../config/goals';
import { capoStanding } from '../capoStanding';
import type { GameState, Npc } from '../types';

function game(seed = 501): GameState {
  return newGame({ name: 'CapoStanding', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 1919, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

describe('capoStanding', () => {
  it('is null when there is no such person', () => {
    const state = game();
    expect(capoStanding(state, 'nobody')).toBeNull();
  });

  it('is null for a man who is not actually a capo', () => {
    const state = game();
    const soldier = hire(state, 'soldier', 1);
    soldier.familiarity = GOAL_CERTAIN_ABOVE;
    expect(capoStanding(state, soldier.id)).toBeNull();
  });

  it('is null before the player knows him well enough for a read', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    capo.familiarity = GOAL_CERTAIN_ABOVE - 1;
    expect(capoStanding(state, capo.id)).toBeNull();
  });

  it('reads weak for a capo with no following and nothing built', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    capo.familiarity = GOAL_CERTAIN_ABOVE;
    capo.stats.leadership = 5;
    const standing = capoStanding(state, capo.id);
    expect(standing).not.toBeNull();
    expect(standing!.tier).toBe(0);
  });

  it('reads higher for a capo whose crew actually listens than one who merely has the title', () => {
    const bare = game(31);
    const titleOnly = hire(bare, 'capo', 1);
    titleOnly.familiarity = GOAL_CERTAIN_ABOVE;
    titleOnly.stats.leadership = 5;

    const followed = game(32);
    const realCapo = hire(followed, 'capo', 1);
    realCapo.familiarity = GOAL_CERTAIN_ABOVE;
    realCapo.stats.leadership = 90;
    for (let i = 0; i < 6; i++) {
      const soldier = hire(followed, 'soldier', 2 + i);
      soldier.reportsTo = realCapo.id;
    }

    const weak = capoStanding(bare, titleOnly.id);
    const strong = capoStanding(followed, realCapo.id);
    expect(strong!.tier).toBeGreaterThan(weak!.tier);
    expect(strong!.text).not.toBe(weak!.text);
  });

  it('counts ground held in his own right toward standing, even with a small crew', () => {
    const state = game(33);
    const capo = hire(state, 'capo', 1);
    capo.familiarity = GOAL_CERTAIN_ABOVE;
    capo.stats.leadership = 50;
    const soldier = hire(state, 'soldier', 2);
    soldier.reportsTo = capo.id;

    const withoutGround = capoStanding(state, capo.id)!.tier;

    Object.values(state.territories)[0].stewardId = capo.id;
    const withGround = capoStanding(state, capo.id)!.tier;

    expect(withGround).toBeGreaterThan(withoutGround);
  });

  it('tips a powerful capo into the dangerous read once his chain is earning on its own', () => {
    const state = game(34);
    const capo = hire(state, 'capo', 1);
    capo.familiarity = GOAL_CERTAIN_ABOVE;
    capo.stats.leadership = 90;
    const reports: Npc[] = [];
    for (let i = 0; i < 2; i++) {
      const soldier = hire(state, 'soldier', 2 + i);
      soldier.reportsTo = capo.id;
      reports.push(soldier);
    }
    // Padding so this capo's two reports stay a small share of the roster —
    // otherwise headcount alone would already reach the "powerful" bar.
    for (let i = 0; i < 5; i++) hire(state, 'soldier', 10 + i);
    Object.values(state.territories)[0].stewardId = capo.id;

    const beforeEarning = capoStanding(state, capo.id)!.tier;
    for (const n of reports) n.opsCompleted = 8;

    const afterEarning = capoStanding(state, capo.id)!.tier;
    expect(afterEarning).toBeGreaterThan(beforeEarning);
    expect(afterEarning).toBe(3);
  });
});
