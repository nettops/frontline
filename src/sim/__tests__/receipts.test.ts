/**
 * Money never moves silently.
 *
 * A playtester bought a front for $9,368, watched their clean cash drop, got
 * nothing back on screen, and reported it as theft. It was not theft — the
 * refund existed — but a spend the player cannot see the result of is
 * indistinguishable from one, and the memo answers silently by design because
 * most consequences arrive later.
 *
 * The receipt fixed the surface by printing whatever a resolution wrote to the
 * log. That leaves the real hole one level down: a branch that spends money
 * and writes nothing has nothing to print. Three of them were still doing that
 * after the receipt shipped. This is the guard, and it reads the source rather
 * than any one event so a branch added next year is covered by it.
 */
import { describe, expect, it } from 'vitest';
// Vite's raw import rather than node:fs, because this project deliberately
// does not carry @types/node and one guard is not a reason to start.
import eventsSource from '../events.ts?raw';
import { newGame } from '../state';
import { Rng } from '../rng';
import { resolveEvent } from '../events';
import { crewList } from '../npc';
import { pushEvent } from '../util';
import type { GameState } from '../types';

const SOURCE: string = eventsSource;

describe('every branch that spends money says so', () => {
  it('has no silent spend in resolveEvent', () => {
    const body = SOURCE.slice(SOURCE.indexOf('export function resolveEvent'));
    const lines = body.split('\n');
    const silent: string[] = [];

    lines.forEach((line: string, i: number) => {
      if (!/\bspend(Split)?\(/.test(line)) return;
      // Read forward to the end of the branch this spend opened.
      const segment: string[] = [];
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        segment.push(lines[j]);
        if (/^\s*\} else/.test(lines[j]) || /^\s{6}\}$/.test(lines[j])) break;
      }
      if (!segment.join('\n').includes('addLog(')) {
        silent.push(`line ${i + 1}: ${line.trim()}`);
      }
    });

    expect(
      silent,
      `these spend money and print nothing, so the receipt has nothing to show:\n${silent.join('\n')}`,
    ).toHaveLength(0);
  });
});

/** Raises an event the way the queue would, so a branch can be answered. */
function raise(state: GameState, defId: string, npcId: string | null, data = {}) {
  return pushEvent(state, {
    defId,
    title: 'x',
    body: 'x',
    severity: 'danger',
    npcId,
    data,
    choices: [{ id: 'pay', label: 'p', hint: '' }],
  });
}

describe('the branches that were silent', () => {
  const money = (state: GameState) => state.org.cash + state.org.dirtyCash;

  it('reports paying off a grievance', () => {
    const state = newGame({ name: 'R', difficulty: 'normal', seed: 8 });
    const rng = new Rng(state.rng);
    state.org.dirtyCash = 50_000;
    const npc = crewList(state)[0];
    const before = money(state);

    const e = raise(state, 'grievance_raised', npc.id);
    const logBefore = state.log.length;
    resolveEvent(state, rng, e.id, 'pay');

    expect(money(state)).toBeLessThan(before);
    expect(state.log.length).toBeGreaterThan(logBefore);
  });

  it('reports paying a frightened man to stay', () => {
    const state = newGame({ name: 'R', difficulty: 'normal', seed: 8 });
    const rng = new Rng(state.rng);
    state.org.dirtyCash = 50_000;
    const npc = crewList(state)[0];
    const before = money(state);

    const e = raise(state, 'informant_scare', npc.id);
    const logBefore = state.log.length;
    resolveEvent(state, rng, e.id, 'pay');

    expect(money(state)).toBeLessThan(before);
    expect(state.log.length).toBeGreaterThan(logBefore);
  });

  it('reports a reward, and reports failing to afford one', () => {
    const rich = newGame({ name: 'R', difficulty: 'normal', seed: 8 });
    const poor = newGame({ name: 'R', difficulty: 'normal', seed: 8 });
    rich.org.dirtyCash = 50_000;
    poor.org.cash = 0;
    poor.org.dirtyCash = 0;

    for (const state of [rich, poor]) {
      const rng = new Rng(state.rng);
      const npc = crewList(state)[0];
      const e = raise(state, 'loyalty_gesture', npc.id);
      const logBefore = state.log.length;
      resolveEvent(state, rng, e.id, 'reward');
      // Both outcomes are worth a line: one says the money landed, the other
      // says it did not and he got the words instead.
      expect(state.log.length).toBeGreaterThan(logBefore);
    }
    expect(money(rich)).toBeLessThan(50_000);
  });
});

describe('missing payroll', () => {
  it('says what it cost, not only what was owed', async () => {
    const { tickEconomy } = await import('../economy');
    const { PAYDAY_INTERVAL } = await import('../../config/economy');

    const state = newGame({ name: 'R', difficulty: 'normal', seed: 8 });
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    // Land exactly on a payday with nothing in the drawer.
    state.day = PAYDAY_INTERVAL;

    const crew = crewList(state);
    const before = crew.map((n) => n.stats.loyalty);
    const logBefore = state.log.length;
    tickEconomy(state);

    const added = state.log.slice(0, state.log.length - logBefore).map((e) => e.text);
    // The shortfall was always reported. The consequence was not.
    expect(added.some((t) => /came up short|Nobody was paid/.test(t))).toBe(true);
    expect(
      added.some((t) => /further from you|holding it against you/.test(t)),
      `the loyalty cost is invisible:\n${added.join('\n')}`,
    ).toBe(true);
    expect(crewList(state).map((n) => n.stats.loyalty)).not.toEqual(before);
  });
});
