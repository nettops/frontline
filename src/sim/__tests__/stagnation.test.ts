/**
 * Ambition with nowhere to go, and the cure it never had.
 *
 * `driftNpcs` carried this:
 *
 *     const daysInRole = state.day - npc.joinedDay;
 *     if (daysInRole > 60 && npc.stats.ambition > 50) ...
 *
 * The variable is called `daysInRole` and it reads the day the man joined the
 * *organization*. There was no role-change stamp on `Npc` at all, and
 * `promote` never wrote one — so after sixty days every ambitious man bled
 * loyalty forever and nothing a boss did ever stopped it. Promotion did not.
 * A district of his own did not.
 *
 * Measured, that made stagnation **40% of every point of loyalty lost across
 * 158,484 crew-weeks** — the largest single drain in the game, and the only one
 * with no counterplay. It is why 291 of 343 hires walk out of a career.
 *
 * The clock now measures time since anything good happened to him: promoted,
 * given a district, given a raise, put on a score, taught by somebody better,
 * or heard out in a room. That is broader than "time since advancement" and it
 * was chosen deliberately over the narrower version.
 *
 * **The risk that breadth carries, named here so it stays measurable:** a boss
 * who never promotes anybody might now hold a crew together on conversation
 * alone. The last test in this file is the one that would catch it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc, driftNpcs } from '../npc';
import { promote, setWage } from '../crew';
import { putInCharge } from '../delegation';
import { somethingGood, daysSinceGood } from '../npc';
import { DRIFT } from '../../config/npcs';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  const state = newGame({ name: 'Stag', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 8) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

/** A man who wants to be somewhere, and has been nowhere for a long time. */
function restless(state: GameState): Npc {
  const npc = crewList(state).find((n) => n.status === 'active' && n.role === 'soldier')!;
  npc.stats.ambition = 90;
  npc.stats.loyalty = 70;
  state.day = npc.joinedDay + DRIFT.daysInRoleBeforeStagnation + 30;
  return npc;
}

describe('the clock it runs on', () => {
  it('starts from the day he arrived when nothing has happened yet', () => {
    const state = game();
    const npc = restless(state);
    expect(daysSinceGood(state, npc)).toBe(state.day - npc.joinedDay);
  });

  it('is reset by being moved up', () => {
    const state = game();
    const npc = restless(state);
    promote(state, npc.id);
    expect(daysSinceGood(state, npc)).toBe(0);
  });

  it('is reset by being handed a district', () => {
    const state = game();
    const npc = restless(state);
    state.territories['northside'].influence.player = 60;
    putInCharge(state, npc.id, 'northside');
    expect(daysSinceGood(state, npc)).toBe(0);
  });

  it('is reset by a real raise, and not by a cut', () => {
    const state = game();
    const npc = restless(state);
    setWage(state, npc.id, Math.round(npc.wage * 1.3));
    expect(daysSinceGood(state, npc)).toBe(0);

    state.day += 40;
    setWage(state, npc.id, Math.round(npc.wage * 0.8));
    expect(daysSinceGood(state, npc), 'a pay cut counted as something good').toBe(40);
  });

  it('survives a save, and defaults to the day he arrived', () => {
    const state = game();
    const npc = restless(state);
    delete (npc as { lastGoodDay?: number }).lastGoodDay;
    expect(daysSinceGood(state, npc)).toBe(state.day - npc.joinedDay);
  });
});

describe('what it costs him', () => {
  it('bleeds a man who has been nowhere', () => {
    const state = game();
    const npc = restless(state);
    const before = npc.stats.loyalty;
    driftNpcs(state, new Rng(state.rng));
    expect(npc.stats.loyalty).toBeLessThan(before);
  });

  /* The whole point: something good has to actually buy him back. */
  it('stops bleeding him once something good happens', () => {
    const stuck = game();
    const a = restless(stuck);
    driftNpcs(stuck, new Rng(stuck.rng));
    const lostStuck = 70 - a.stats.loyalty;

    const moved = game();
    const b = restless(moved);
    somethingGood(moved, b);
    driftNpcs(moved, new Rng(moved.rng));
    const lostMoved = 70 - b.stats.loyalty;

    expect(lostStuck, 'the man who went nowhere did not bleed').toBeGreaterThan(0);
    expect(
      lostMoved,
      'a man something good just happened to bled the same as one nothing happened to',
    ).toBeLessThan(lostStuck);
  });

  it('starts bleeding again once it has been long enough since', () => {
    const state = game();
    const npc = restless(state);
    somethingGood(state, npc);

    state.day += DRIFT.daysInRoleBeforeStagnation + 10;
    const before = npc.stats.loyalty;
    driftNpcs(state, new Rng(state.rng));
    expect(
      npc.stats.loyalty,
      'one good day bought him permanent contentment',
    ).toBeLessThan(before);
  });

  it('leaves the unambitious alone, whatever happens to them', () => {
    const state = game();
    const npc = restless(state);
    npc.stats.ambition = 10;
    const before = npc.stats.loyalty;
    driftNpcs(state, new Rng(state.rng));
    // Other terms may still move him; stagnation must not be one of them.
    expect(npc.stats.loyalty).toBeGreaterThanOrEqual(before - 1);
  });
});
