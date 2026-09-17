/**
 * Where a new associate on the recruit list is said to come from.
 *
 * `refreshRecruits` used to generate four strangers with no author — the
 * organization "just knew" somebody was available. Once there is a real capo
 * (`ROLE_ORDER` at capo or above — the same distinction `capoPitches.ts`
 * already draws), a fresh associate is his introduction: attributed to him
 * and reporting to him from the day he joins, the same way a pitch is his
 * idea rather than a menu item. A young organization with nobody senior yet
 * gets exactly what it always got — an unattributed name, straight-answers-
 * to-the-boss.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { refreshRecruits } from '../crew';
import { RECRUIT_POOL_SIZE, RECRUIT_REFRESH_DAYS } from '../../config/npcs';
import type { GameState, Npc } from '../types';

function game(seed = 77): GameState {
  return newGame({ name: 'Vouch', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 909, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

describe('who a new associate is said to come from', () => {
  it('leaves recruits unattributed when the organization has no real capo yet', () => {
    const state = game();
    // A fresh game's starting crew is nowhere near capo — see reportsTo.test.ts
    // for the identical assumption.
    const rng = new Rng(state.rng);
    refreshRecruits(state, rng, true);
    const recruits = Object.values(state.recruits);
    expect(recruits.length).toBe(RECRUIT_POOL_SIZE);
    for (const r of recruits) expect(r.reportsTo).toBeUndefined();
  });

  it('attributes at least one fresh associate to a real capo once the organization has one', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    const rng = new Rng(state.rng);
    // Several draws so the attribution roll is not the one thing that failed.
    let sawAttribution = false;
    for (let i = 0; i < 20; i++) {
      state.day += RECRUIT_REFRESH_DAYS;
      refreshRecruits(state, rng, true);
      const recruits = Object.values(state.recruits);
      if (recruits.some((r) => r.reportsTo === capo.id)) {
        sawAttribution = true;
        break;
      }
    }
    expect(sawAttribution).toBe(true);
  });

  it('never attributes a recruit to the seniority fallback — only a real capo', () => {
    const state = game();
    // Nobody at capo or above; pitchCapoPool would fall back to the whole
    // roster, and that fallback must never own a recruit.
    const rng = new Rng(state.rng);
    for (let i = 0; i < 10; i++) {
      state.day += RECRUIT_REFRESH_DAYS;
      refreshRecruits(state, rng, true);
      for (const r of Object.values(state.recruits)) expect(r.reportsTo).toBeUndefined();
    }
  });
});
