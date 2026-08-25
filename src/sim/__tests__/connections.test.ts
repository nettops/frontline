/**
 * PARKED with the feature. Un-skip both blocks when the jobs go back in.
 *
 * The four connected jobs are commented out of `config/operations.ts` and the
 * reason is written there: `owed >= 1` was cleared by **24 of 24 careers by
 * day 150**, so the gate is a timer rather than a relationship. These tests
 * are correct and all eight passed against the built version — four mutants
 * died — so they are kept intact rather than deleted. They are the thing that
 * should go red first if somebody re-adds the jobs with the same gate.
 *
 * `distance.test.ts` still covers the `OpsBoard` fields and both route kinds,
 * and stays live.
 *
 * ---
 *
 * Work you get because of who you know, not what you are called.
 *
 * *"The same four jobs"* is the most-quoted line in the whole score record, and
 * the mechanism behind it is a chain: operations gate on rank, rank gates on
 * clean money, and money is F15 — 34 of 36 careers are held by that line. So
 * the job list barely moves after the first ninety days, which is exactly
 * where Fun falls off a cliff.
 *
 * The fix is a second axis. These four jobs are gated on **relationships**
 * rather than on rank, and each one on a different relationship, so two bosses
 * standing at the same rung with different friends are looking at different
 * boards. That is the claim, and the third test is the only one that actually
 * proves it — the rest could all pass on a build where every career ends up
 * with the same list eventually.
 *
 * It also attacks F14. The sit-down is *"probably the best-designed system in
 * the game"* and was found on day 19 in one round and **day 300** in another.
 * Making the back room the door to new work is the cheapest way to stop that
 * being a lottery.
 *
 * No new event definitions anywhere in here, deliberately. `dailyMemo` fills
 * one slot a day and the authored events carry the pacing "firsts"; a new
 * definition costs one of them, which is what parked the partner.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { availableOperations, lockedOperations } from '../operations';
import { figure } from '../civic';
import { bond } from '../diplomacy';
import type { GameState } from '../types';

/*
   The four jobs and how to earn each one, declared here rather than in the
   config beside them.

   `grant` has to reach into `civic` and `diplomacy`, and config modules are
   forbidden from importing sim at runtime — HANDOFF §2. So the config holds
   the jobs and this holds the test's knowledge of what opens them, which also
   means the gates below are checked against an independent statement of the
   rule rather than against the same expression twice.
*/
const CONNECTED_OPS = [
  {
    id: 'fix_a_case',
    name: 'Fix a Case',
    need: 'a judge owing you one',
    grant: (s: GameState) => {
      figure(s, 'judge').owed = 1;
    },
  },
  {
    id: 'union_walkout',
    name: 'Union Walkout',
    need: 'a union boss owing you one',
    grant: (s: GameState) => {
      figure(s, 'union').owed = 1;
    },
  },
  {
    id: 'police_escort',
    name: 'Police Escort',
    need: 'a police captain owing you one',
    grant: (s: GameState) => {
      figure(s, 'captain').owed = 1;
    },
  },
  {
    id: 'joint_venture',
    name: 'Joint Venture',
    need: 'a rival family that trusts you',
    grant: (s: GameState) => {
      bond(s, 'player', 'falcone').trust = 70;
    },
  },
];

const ids = (state: GameState) => new Set(availableOperations(state).map((o) => o.id));

function fresh(seed = 6): GameState {
  return newGame({ name: 'Nobody', difficulty: 'normal', seed });
}

describe.skip('the connected jobs', () => {
  it('are sealed to somebody who knows nobody', () => {
    const open = ids(fresh());
    for (const op of CONNECTED_OPS) {
      expect(
        open.has(op.id),
        `"${op.name}" is open to a boss on day one who has never met anybody`,
      ).toBe(false);
    }
  });

  it('each say, on the locked row, which relationship opens them', () => {
    /*
       F10 is the one finding this project has ever closed, and it closed by
       naming the figure, the bar and the remedy at the point of refusal. A
       gate nobody can read is the same defect wearing a different hat.
    */
    const locked = lockedOperations(fresh());
    for (const op of CONNECTED_OPS) {
      const row = locked.find((l) => l.id === op.id);
      expect(row, `"${op.name}" is neither open nor locked`).toBeDefined();
      expect(row!.opens?.need, `"${op.name}" locks with no reason given`).toBeTruthy();
    }
  });

  it('open on the relationship, at a rank that would never have opened them', () => {
    for (const op of CONNECTED_OPS) {
      const state = fresh();
      expect(ids(state).has(op.id)).toBe(false);
      op.grant(state);
      expect(
        ids(state).has(op.id),
        `"${op.name}" stayed shut after ${op.need} — the gate reads something else`,
      ).toBe(true);
    }
  });

  it('give two bosses at the same rank different boards', () => {
    /*
       The headline claim, and the only test here that cannot be satisfied by
       a build where everybody converges. Same seed, same rank, same day —
       one knows a judge, the other knows the union.
    */
    const a = fresh();
    const b = fresh();
    CONNECTED_OPS[0].grant(a);
    CONNECTED_OPS[1].grant(b);

    const onlyA = [...ids(a)].filter((id) => !ids(b).has(id));
    const onlyB = [...ids(b)].filter((id) => !ids(a).has(id));

    expect(a.player.rank, 'the two careers drifted apart on rank').toBe(b.player.rank);
    expect(onlyA.length, 'the two boards are identical, so the axis does nothing').toBeGreaterThan(0);
    expect(onlyB.length, 'the two boards are identical, so the axis does nothing').toBeGreaterThan(0);
  });

  it('are gated on four different things, not four names for one thing', () => {
    // Granting any one must open exactly one. Otherwise this is a single
    // "are you connected" flag with four labels on it.
    for (const op of CONNECTED_OPS) {
      const state = fresh();
      const before = ids(state);
      op.grant(state);
      const opened = [...ids(state)].filter((id) => !before.has(id));
      expect(
        opened,
        `${op.need} opened ${opened.join(', ')} rather than only "${op.id}"`,
      ).toEqual([op.id]);
    }
  });

  it('pay better than the rank-gated work available at the same time', () => {
    // Otherwise there is no reason to chase a relationship, and the second
    // axis is decoration.
    const state = fresh();
    const ordinary = availableOperations(state);
    const bestOrdinary = Math.max(...ordinary.map((o) => o.payout[1]));
    for (const op of CONNECTED_OPS) {
      const state2 = fresh();
      op.grant(state2);
      const def = availableOperations(state2).find((o) => o.id === op.id)!;
      expect(
        def.payout[1],
        `"${def.name}" pays no better than work you can already take`,
      ).toBeGreaterThan(bestOrdinary);
    }
  });
});

describe.skip('the relationships themselves', () => {
  it('a favour owed is what opens a civic job, not mere standing', () => {
    /*
       Standing drifts toward a target every week, so a job gated on standing
       would open and shut on its own with nothing the player did. `owed` is
       the durable thing — it is what `civic.ts` says a figure can actually
       give you, and it is capped, so this cannot become free.
    */
    const state = fresh();
    const judge = figure(state, 'judge');
    judge.standing = 100;
    judge.owed = 0;
    expect(
      ids(state).has('fix_a_case'),
      'high standing alone opened the job, so it will open and shut by itself',
    ).toBe(false);

    judge.owed = 1;
    expect(ids(state).has('fix_a_case')).toBe(true);
  });

  it('a rival job needs a rival who will actually deal with you', () => {
    const state = fresh();
    const b = bond(state, 'player', 'falcone');
    b.trust = -50;
    expect(ids(state).has('joint_venture')).toBe(false);
    b.trust = 70;
    expect(ids(state).has('joint_venture')).toBe(true);
  });
});
