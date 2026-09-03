/**
 * How far a month gets, and why it was four days.
 *
 * A blind tester on a 481-day career: *"Between days 180 and 300 I was stopped
 * roughly every 1-2 game days, and a '+1 month' advance almost never delivered
 * more than 5 days... By day 400 I was answering them without reading them,
 * which is the failure state for a game whose best writing is in its memos."*
 *
 * The rate was an impression and this file disagrees with it — memos arrive at
 * roughly one every four days, flat, at every stage of a career and at every
 * family size, out of 23 distinct templates. His second sentence is exactly
 * what one-every-four-days produces against `advanceDays`, which stops on the
 * first new memo. His third is the damage.
 *
 * So the repair is not fewer memos. It is that answering one should not also
 * cancel the month you asked for: `sim/pace.ts` resumes the span once the
 * question is answered and stops dead only for `danger`, which is 2% of the
 * queue and is the six memos that change your situation. Measured below, six
 * careers past day 180 asking for thirty days: **2.8 days before, 27.2 after.**
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDays } from '../clock';
import { carriesOn } from '../pace';
import { answerFirst, runDaysSolvent, mean } from './helpers';
import { crewList } from '../npc';
import type { GameState, Npc } from '../types';

/** A family the size the tester's was, since crew shapes scale with it. */
function staff(state: GameState, count: number): void {
  const source = crewList(state)[0];
  let n = 0;
  while (crewList(state).filter((x) => x.status === 'active').length < count) {
    const copy: Npc = {
      ...source,
      id: `hand-${n}`,
      name: `Hand ${n}`,
      status: 'active',
      ties: [],
      notes: [],
      memories: [],
    };
    state.npcs[copy.id] = copy;
    n++;
  }
}

interface Seen {
  raised: number;
  days: number;
  news: number;
  defs: Set<string>;
}

function career(seed: number, crew: number, days: number): Seen {
  const state = newGame({ name: 'Pace', difficulty: 'normal', seed });
  staff(state, crew);
  const seen: Seen = { raised: 0, days: 0, news: 0, defs: new Set() };
  runDaysSolvent(state, days, {
    floor: 250_000,
    answer: (s, rng) => {
      seen.days += 1;
      for (const e of s.pendingEvents) {
        seen.raised += 1;
        seen.defs.add(e.defId);
        if (carriesOn(e.severity)) seen.news += 1;
      }
      answerFirst(s, rng);
    },
  });
  return seen;
}

describe('the memo cadence', () => {
  it('says how often one arrives, and how many there are', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const small = seeds.map((s) => career(s, 1, 450));
    const large = seeds.map((s) => career(s, 18, 450));
    const defs = new Set<string>();
    for (const run of [...small, ...large]) for (const d of run.defs) defs.add(d);

    const rate = (runs: Seen[]) => mean(runs.map((r) => r.raised / r.days));
    const carryShare = (runs: Seen[]) =>
      mean(runs.map((r) => (r.raised ? r.news / r.raised : 0)));

    // eslint-disable-next-line no-console
    console.log(
      `memos over 450 days, 6 careers each\n` +
        `        a family of 1:   ${rate(small).toFixed(3)}/day = one every ` +
        `${(1 / rate(small)).toFixed(1)} days · ${(carryShare(small) * 100).toFixed(0)}% carry on\n` +
        `        a family of 18:  ${rate(large).toFixed(3)}/day = one every ` +
        `${(1 / rate(large)).toFixed(1)} days · ${(carryShare(large) * 100).toFixed(0)}% carry on\n` +
        `        ${defs.size} distinct memos across the twelve careers`,
    );

    /*
       The property the repair rests on, and the reason it is worth making.

       If almost everything were trouble there would be nothing to resume
       through and `pace.ts` would be decoration. It is the mix that makes a
       month reachable, so the mix is what this guards — not the rate, which is
       a design choice, and not the count, which is content.
    */
    expect(
      carryShare(large),
      'too much of the queue stops the clock for a month to be reachable',
    ).toBeGreaterThan(0.9);
    expect(defs.size, 'the memo pool has shrunk to a handful of templates').toBeGreaterThan(15);
  });

  it('says how far thirty days actually gets, and that carrying on covers it', () => {
    /*
       The tester's own measurement, reproduced: ask for a month, get a few
       days. Then the same month with `carriesOn` driving the resume, which is
       what the view now does.
    */
    const legs: number[] = [];
    const hops: number[] = [];
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const state = newGame({ name: 'Pace', difficulty: 'normal', seed });
      staff(state, 18);
      const rng = new Rng(state.rng);
      runDaysSolvent(state, 180, { floor: 250_000 });

      let left = 30;
      let first: number | null = null;
      let stops = 0;
      while (left > 0) {
        const moved = advanceDays(state, left);
        if (first === null) first = moved;
        left -= moved;
        const raised = state.pendingEvents;
        if (raised.length === 0) break;
        // A danger ends the span; everything else is answered and it carries on.
        const carry = carriesOn(raised[raised.length - 1].severity);
        answerFirst(state, rng);
        stops += 1;
        if (!carry) break;
      }
      legs.push(first ?? 0);
      hops.push(30 - left);
    }

    // eslint-disable-next-line no-console
    console.log(
      `asking for thirty days, six careers past day 180\n` +
        `        the first leg alone:      ${mean(legs).toFixed(1)} days\n` +
        `        carrying on to the danger: ${mean(hops).toFixed(1)} days`,
    );

    expect(mean(legs), 'a month already runs its length, so there was nothing to fix')
      .toBeLessThan(20);
    expect(
      mean(hops),
      'carrying on covers no more of the month than stopping at the first memo',
    ).toBeGreaterThan(mean(legs) * 1.4);
    // And the whole point: a request for a month should mostly be a month.
    expect(mean(hops), 'a thirty-day request still does not reach three weeks').toBeGreaterThan(21);
  });
});
