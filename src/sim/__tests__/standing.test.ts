/**
 * Who has been carrying it.
 *
 * The recurring decision in this game was "which two or three jobs can I
 * afford, and who is free" — and who was free had no consequence attached to
 * it whatever. These tests hold the repair to the two things that make it a
 * decision rather than a diary: the man who does all the work must cost you
 * something, and the man who is never sent must notice.
 *
 * Derived from the job history rather than counted into a field, because the
 * history already persists, is already capped, and is already what the
 * informant deduction reads. A counter would be a second copy of one fact.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { crewList } from '../npc';
import { crewWasBusy, markStanding, nightsWorked, share } from '../standing';
import { STANDING } from '../../config/standing';
import type { GameState, Id, Npc } from '../types';

function game(seed = 31): GameState {
  return newGame({ name: 'Standing', difficulty: 'normal', seed });
}

/** A night's work, written straight into the record the module reads. */
function ran(state: GameState, day: number, crewIds: Id[]): void {
  state.operationHistory.unshift({
    id: `op-${day}-${crewIds.join('-')}`,
    defId: 'corner_shakedown',
    name: 'Corner Shakedown',
    territoryId: 'little_sicily',
    day,
    success: true,
    margin: 0.5,
    payout: 400,
    heat: 1,
    crewIds,
    consequence: null,
  });
}

/** Two men, because a career begins with one. */
function twoMen(state: GameState): [Npc, Npc] {
  const source = crewList(state)[0];
  const second = { ...source, id: 'second-man', name: 'Second Man', status: 'active' as const };
  state.npcs[second.id] = second;
  return [source, second];
}

describe('nights worked', () => {
  it('counts only the jobs inside the window', () => {
    const state = game();
    const [a] = twoMen(state);
    state.day = 200;

    ran(state, 200 - STANDING.windowDays + 1, [a.id]);
    ran(state, 200 - STANDING.windowDays - 1, [a.id]);

    expect(nightsWorked(state, a.id)).toBe(1);
  });

  it('is zero for somebody who has not been out', () => {
    const state = game();
    const [a, b] = twoMen(state);
    state.day = 60;
    ran(state, 58, [a.id]);

    expect(nightsWorked(state, b.id)).toBe(0);
  });
});

describe('share', () => {
  it('is the same for two men who worked the same nights', () => {
    const state = game();
    const [a, b] = twoMen(state);
    state.day = 60;
    ran(state, 55, [a.id, b.id]);
    ran(state, 56, [a.id, b.id]);

    expect(share(state, a.id)).toBeCloseTo(share(state, b.id), 5);
  });

  it('is above one for the man who gets sent and below for the man who does not', () => {
    const state = game();
    const [a, b] = twoMen(state);
    state.day = 60;
    for (let d = 50; d < 58; d++) ran(state, d, [a.id]);

    expect(share(state, a.id)).toBeGreaterThan(1);
    expect(share(state, b.id)).toBeLessThan(1);
  });

  it('is one for everybody when nothing has happened, rather than dividing by zero', () => {
    /*
       A quiet fortnight is not the same as being passed over, and a new career
       starts in exactly this state. A NaN here would travel into a loyalty
       drift and be very hard to find afterwards.
    */
    const state = game();
    twoMen(state);
    for (const npc of crewList(state)) {
      expect(Number.isFinite(share(state, npc.id))).toBe(true);
      expect(share(state, npc.id)).toBe(1);
    }
    expect(crewWasBusy(state)).toBe(false);
  });
});

describe('marking who carried it', () => {
  function settled(state: GameState): void {
    for (const npc of crewList(state)) npc.daysInCrew = STANDING.settledAfterDays + 10;
  }

  it('marks the man who has been out far more than the rest', () => {
    const state = game();
    const [a] = twoMen(state);
    state.day = 60;
    settled(state);
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const ambition = a.stats.ambition;
    markStanding(state);

    expect(a.memories.some((m) => m.kind === 'carried_the_work')).toBe(true);
    expect(a.stats.ambition).toBeGreaterThan(ambition);
  });

  it('does not make him more loyal for it', () => {
    /*
       The sting, asserted. A man who does all the work knows he is
       load-bearing; that makes him expensive and dangerous, not devoted. If
       this ever starts raising loyalty then the mechanic has become a reward,
       and the decision it exists to create is gone.
    */
    const state = game();
    const [a] = twoMen(state);
    state.day = 60;
    settled(state);
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const loyalty = a.stats.loyalty;
    markStanding(state);
    expect(a.stats.loyalty).toBeLessThanOrEqual(loyalty);
  });

  it('costs you more to keep him', () => {
    const state = game();
    const [a] = twoMen(state);
    state.day = 60;
    settled(state);
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const greed = a.stats.greed;
    markStanding(state);
    expect(a.stats.greed).toBeGreaterThan(greed);
  });

  it('marks the man nobody sends, while the rest are working', () => {
    const state = game();
    const [a, b] = twoMen(state);
    state.day = 60;
    settled(state);
    for (let d = 20; d < 40; d++) ran(state, d, [a.id]);

    const loyalty = b.stats.loyalty;
    markStanding(state);

    expect(b.memories.some((m) => m.kind === 'left_on_the_bench')).toBe(true);
    expect(b.stats.loyalty).toBeLessThan(loyalty);
  });

  it('does not mark a bench when nobody has been working', () => {
    const state = game();
    twoMen(state);
    state.day = 60;
    settled(state);

    markStanding(state);
    expect(
      crewList(state).some((n) => n.memories.some((m) => m.kind === 'left_on_the_bench')),
    ).toBe(false);
  });

  it('does not mark a man who is hurt, inside, or newly hired', () => {
    /*
       The three guards, and they are the part of this most likely to punish a
       player for something correct. Holding a reserve is legitimate and the
       arrest system makes it necessary; a man in a cell is not being snubbed;
       and somebody hired on Tuesday has not been passed over by Friday.
    */
    const state = game();
    const [worker] = twoMen(state);
    state.day = 60;
    for (let d = 20; d < 40; d++) ran(state, d, [worker.id]);

    const source = crewList(state)[0];
    const others = ['hurt', 'inside', 'fresh'].map((tag) => {
      const npc: Npc = {
        ...source,
        id: `${tag}-man`,
        name: `${tag} man`,
        memories: [],
        notes: [],
      };
      state.npcs[npc.id] = npc;
      return npc;
    });
    const [hurt, inside, fresh] = others;
    for (const npc of others) npc.daysInCrew = STANDING.settledAfterDays + 10;
    hurt.status = 'injured';
    inside.status = 'arrested';
    fresh.status = 'active';
    fresh.daysInCrew = STANDING.settledAfterDays - 1;
    worker.daysInCrew = STANDING.settledAfterDays + 10;

    markStanding(state);

    for (const npc of others) {
      expect(
        npc.memories.some((m) => m.kind === 'left_on_the_bench'),
        `${npc.name} was marked and should not have been`,
      ).toBe(false);
    }
  });
});
