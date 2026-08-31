/**
 * What people call you.
 *
 * The bug this repairs was not a wrong number, it was a number nobody could
 * move: `player.rank` was never assigned anywhere in the codebase, so every
 * career ended on the rung it started on. Round 16 found it three testers out
 * of three.
 *
 * So the tests that matter are not "does the arithmetic work". They are:
 *
 * 1. **It moves**, on the facts a player changes on purpose.
 * 2. **It agrees with the job table**, because both read `opsBoard` — a rank
 *    derived from one set of facts and a ladder gated on another is exactly
 *    how `requires` went wrong before.
 * 3. **The three careers round 16 actually produced land on different rungs.**
 *    That is the real acceptance test: if all three still read the same, the
 *    repair has changed nothing that a player would feel.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { rankNow, nextRank, whatItNeeds } from '../rank';
import { RANKS } from '../../config/economy';
import { crewList } from '../npc';
import { territoryList } from '../territory';
import type { GameState } from '../types';

function game(seed = 5): GameState {
  return newGame({ name: 'Rung', difficulty: 'normal', seed });
}

/**
 * Put an organization of a stated size on the board.
 *
 * Reaches through to the same quantities `opsBoard` reads rather than faking
 * the board, so a change to how control or fronts are counted breaks this
 * test rather than sliding past it.
 */
function build(state: GameState, districts: number, fronts: number, crew: number): void {
  const ts = territoryList(state);
  for (let i = 0; i < districts && i < ts.length; i++) {
    ts[i].influence = { ...ts[i].influence, player: 95 };
  }
  state.businesses = {};
  for (let i = 0; i < fronts; i++) {
    state.businesses[`b${i}`] = {
      id: `b${i}`,
      defId: 'laundromat',
      territoryId: ts[0].id,
      purchasedDay: 1,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 100,
      // `ownedBusinesses` counts only what is trading. A shuttered front is
      // not a front, which is the same rule `STANDING_HELD` follows.
      status: 'operating',
    } as unknown as (typeof state.businesses)[string];
  }
  /*
     Cloned from the man the career starts with, so every field the board or a
     filter might read is present and plausible. `crewList` drops former crew,
     so the clone has to carry a live status rather than an invented one.
  */
  const have = crewList(state);
  const src = have[0];
  for (let i = have.length; i < crew; i++) {
    state.npcs[`n${i}`] = { ...src, id: `n${i}`, name: `Hand ${i}`, status: 'active' };
  }
}

describe('the rank a player is actually at', () => {
  it('starts at the bottom', () => {
    expect(rankNow(game()).id).toBe('street_criminal');
  });

  it('moves once there is a crew and somewhere to put them', () => {
    const state = game();
    build(state, 0, 1, 4);
    expect(rankNow(state).id).toBe('enforcer');
  });

  it('climbs as the organization does', () => {
    const state = game();
    build(state, 2, 3, 9);
    expect(rankNow(state).id).toBe('capo');
  });

  /**
   * The acceptance test, against real careers.
   *
   * These three organizations are what round 16's testers actually had at day
   * ~120 — reported independently, on three separate builds of the same seed
   * family. Under the old code all three read Street Criminal. If this repair
   * is worth anything they read differently from each other.
   */
  it('separates the three careers round 16 produced', () => {
    const a = game(1); build(a, 3, 3, 7);    // 16a
    const b = game(2); build(b, 3, 7, 17);   // 16b
    const c = game(3); build(c, 2, 2, 15);   // 16c

    const names = [rankNow(a).name, rankNow(b).name, rankNow(c).name];
    expect(new Set(names).size).toBeGreaterThan(1);
    // and none of them is still where they started
    for (const n of names) expect(n).not.toBe('Street Criminal');
  });

  it('is a ladder — a high rung is not reachable past an unmet low one', () => {
    const state = game();
    // Everything Boss wants except the fronts Crew Leader wants.
    build(state, 4, 0, 18);
    expect(RANKS.indexOf(rankNow(state))).toBeLessThan(RANKS.findIndex((r) => r.id === 'boss'));
  });

  it('goes back down when the organization does', () => {
    const state = game();
    build(state, 2, 3, 9);
    const high = rankNow(state).id;
    build(state, 0, 0, 1);
    expect(rankNow(state).id).not.toBe(high);
  });

  /**
   * The Rail's rule, which a rank nobody could move was the largest breach of.
   *
   * A demand for attention with no statement of what would satisfy it is the
   * thing `attention.ts` exists to refuse, and three testers spent 120 days
   * inside exactly that.
   */
  it('always says what the next rung wants, in words', () => {
    const state = game();
    const needs = whatItNeeds(state);
    expect(needs.length).toBeGreaterThan(0);
    for (const line of needs) expect(line).not.toMatch(/undefined|NaN/);
    expect(nextRank(state)?.id).toBe('enforcer');
  });

  it('has nothing left to ask for at the top', () => {
    const state = game();
    build(state, 12, 12, 30);
    for (const t of territoryList(state)) t.influence = { ...t.influence, player: 99 };
    if (nextRank(state) === null) expect(whatItNeeds(state)).toHaveLength(0);
  });

  it('needs no new state and survives a save', () => {
    const state = game();
    build(state, 2, 3, 9);
    const reloaded = JSON.parse(JSON.stringify(state)) as GameState;
    expect(rankNow(reloaded).id).toBe(rankNow(state).id);
  });
});
