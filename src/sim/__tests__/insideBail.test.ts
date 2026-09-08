/**
 * Paying for somebody who is inside, and what it visibly buys.
 *
 * The option gave +9 loyalty and a `looked_after` memory. Both are real and
 * both are invisible for months — the memory is what makes an investigator's
 * conversation with him two years later go differently. A blind tester paid it
 * seven times across a 481-day career, roughly $10,500, checked the roster
 * immediately each time, and reported:
 *
 *   > "Immediately after paying for Franco on day 45 he still showed HELD ·
 *   > 33D; Enzo, whom I had also paid for, showed HELD · 55D. Whatever the
 *   > money buys, nothing on the roster or in the log changes. I paid it four
 *   > times without ever learning what it bought."
 *
 * He was right on the facts: nothing about the sentence moved. It does now,
 * the choice quotes the figure before you press it, and the figure the choice
 * quotes is the figure the resolver serves — decided once at build time and
 * carried on the memo, because computing it twice lets the two drift by
 * however many days the player took to answer.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { resolveEvent } from '../events';
import { GEN_DEFS } from '../eventgen';
import { crewList } from '../npc';
import { GEN_EFFECT } from '../../config/eventgen';
import type { GameState, Npc } from '../types';

function inside(seed: number, days: number): { state: GameState; npc: Npc } {
  const state = newGame({ name: 'Cell', difficulty: 'normal', seed });
  const npc = crewList(state)[0];
  npc.status = 'arrested';
  npc.unavailableUntilDay = state.day + days;
  state.org.cash = 500_000;
  return { state, npc };
}

function memo(state: GameState, npc: Npc) {
  const def = GEN_DEFS.find((d) => d.id === 'gen_somebody_inside')!;
  const built = def.build(state, new Rng(state.rng), { npc });
  if (!built) throw new Error('the memo did not build, so nothing below was tested');
  const pending = { ...built, id: 'evt_test', day: state.day };
  state.pendingEvents.push(pending);
  return pending;
}

describe('somebody of yours is inside', () => {
  it('says how many days the money buys, before you spend it', () => {
    const { state, npc } = inside(71, 40);
    const bail = memo(state, npc).choices.find((c: { id: string }) => c.id === 'bail')!;
    expect(bail.hint).toMatch(/\d+ days sooner/);
    // And the figure is the one the design says, not a round number in prose.
    expect(bail.hint).toContain(`${Math.round(40 * GEN_EFFECT.insideBailShortens)} days`);
  });

  it('takes them off, so the roster moves the same afternoon', () => {
    const { state, npc } = inside(72, 40);
    const event = memo(state, npc);
    const before = npc.unavailableUntilDay!;

    resolveEvent(state, new Rng(state.rng), event.id, 'bail');

    expect(npc.unavailableUntilDay).toBeLessThan(before);
    expect(before - npc.unavailableUntilDay!).toBe(Number(event.data.daysOff));
    expect(npc.notes.some((n) => /sent down there/.test(n.text))).toBe(true);
  });

  it('serves exactly what it quoted, however long the player took to answer', () => {
    // The reason `daysOff` rides on the memo rather than being recomputed.
    const { state, npc } = inside(73, 40);
    const event = memo(state, npc);
    const quoted = Number(event.data.daysOff);

    state.day += 11; // it sat in the queue
    const before = npc.unavailableUntilDay!;
    resolveEvent(state, new Rng(state.rng), event.id, 'bail');
    expect(before - npc.unavailableUntilDay!).toBe(quoted);
  });

  it('shortens and never cancels, and is never a purchase of nothing', () => {
    const { state, npc } = inside(74, 40);
    const event = memo(state, npc);
    resolveEvent(state, new Rng(state.rng), event.id, 'bail');
    expect(npc.unavailableUntilDay!, 'the money let him out today').toBeGreaterThan(state.day);

    // A man with almost nothing left to serve still gets somebody sent.
    const short = inside(75, 3);
    const ev = memo(short.state, short.npc);
    expect(Number(ev.data.daysOff)).toBeGreaterThan(0);
  });

  it('still costs the loyalty and the memory when you do not pay', () => {
    const { state, npc } = inside(76, 40);
    const event = memo(state, npc);
    const before = npc.unavailableUntilDay!;
    const loyalty = npc.stats.loyalty;

    resolveEvent(state, new Rng(state.rng), event.id, 'wait');
    expect(npc.unavailableUntilDay).toBe(before);
    expect(npc.stats.loyalty, 'letting it run cost him nothing').toBeLessThan(loyalty);
  });
});
