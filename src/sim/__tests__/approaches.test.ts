/**
 * Somebody is waiting to see you.
 *
 * Three properties are guarded here, and only the first is about the feature.
 *
 * 1. **A man with a reason turns up, and a man without one does not.** The
 *    failure mode this replaces is not "no approaches" — it is a doorway with
 *    everybody in it, which reads as the simulation shouting.
 *
 * 2. **It changes nothing.** This is a leaf read. Calling it must not move a
 *    stat, consume a random draw, or alter what the rest of the day does.
 *    `whispers.ts` records what happens when a reporting system forgets this:
 *    two unrelated operations tests went red the moment it was wired in.
 *
 * 3. **It costs no memo slot.** The whole architectural argument for building
 *    the engagement layer as a read rather than as event definitions is that
 *    `tickEvents` is a shared quarter-memo a day. A test that let an approach
 *    quietly become an event would delete that argument without anybody
 *    noticing.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import { approaches } from '../approaches';
import { makePromise } from '../promises';
import { remember } from '../memory';
import { openSitdown, endSitdown } from '../sitdown';
import { APPROACH } from '../../config/approaches';
import { PROMISES } from '../../config/promises';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Door', difficulty: 'normal', seed });
}

function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

/**
 * Give him a live grudge: the number *and* something recent to hold it about.
 *
 * Both halves are the precondition. Gated on the stat alone, one man stood in
 * the doorway for 124 consecutive days of a measured career — so the branch
 * asks for a fresh bad memory too, and these tests have to say so.
 */
function aggrieve(state: GameState, npc: Npc, level: number): void {
  npc.stats.grievance = level;
  remember(npc, state.day, 'passed_over');
}

/** Nobody has any reason to be at the door. */
function calm(state: GameState): void {
  for (const npc of crewList(state)) {
    npc.stats.grievance = 10;
    npc.stats.ambition = 10;
    npc.stats.fear = 10;
    npc.memories = [];
  }
  state.promises = [];
}

describe('who is waiting to see you', () => {
  it('is nobody, when nobody has a reason', () => {
    const state = game();
    calm(state);
    expect(approaches(state)).toHaveLength(0);
  });

  it('is the man carrying something', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceAsksAbove + 5);

    const waiting = approaches(state);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].npcId).toBe(npc.id);
    expect(waiting[0].urgency).toBe('soon');
  });

  it('says it is urgent once it has stopped resolving itself', () => {
    const state = game();
    calm(state);
    aggrieve(state, someone(state), APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)[0].urgency).toBe('now');
  });

  /**
   * The promise beats the grudge underneath it.
   *
   * A man with both leads with the promise, because that is the thing the
   * player can act on today and the thing he would actually open with.
   */
  it('leads with the promise when there is one coming due', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    npc.stats.grievance = APPROACH.grievanceUrgentAbove + 5;
    makePromise(state, npc.id, 'promoted');
    // Wind it down to inside the window without moving anything else.
    const owed = state.promises!.find((p) => p.npcId === npc.id)!;
    owed.dueDay = state.day + 1;

    const waiting = approaches(state);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].urgency).toBe('now');
    expect(waiting[0].text).toContain(PROMISES.promoted.outstanding.toLowerCase());
  });

  it('does not come back the week after being heard', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);

    openSitdown(state, 'crew', npc.id, 'settle');
    endSitdown(state);

    expect(approaches(state)).toHaveLength(0);
  });

  it('comes back once enough time has gone by', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    openSitdown(state, 'crew', npc.id, 'settle');
    endSitdown(state);

    state.day += APPROACH.quietDaysAfterMeeting;
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);
  });

  it('never puts more than a queue at the door', () => {
    const state = game(8);
    calm(state);
    for (const npc of crewList(state)) {
      aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    }
    expect(approaches(state).length).toBeLessThanOrEqual(APPROACH.most);
  });

  it('says nothing while you are already in a room', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    const other = crewList(state)[1];
    if (other) aggrieve(state, other, APPROACH.grievanceUrgentAbove + 5);

    openSitdown(state, 'crew', npc.id, 'settle');
    expect(approaches(state)).toHaveLength(0);
  });

  it('leaves the dead and the unreachable where they are', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    npc.status = 'arrested';
    expect(approaches(state)).toHaveLength(0);
  });

  /**
   * A number on its own is not a reason to knock.
   *
   * This is the measured fix. Gated on grievance alone, one man waited 124
   * consecutive days of a 300-day career and the feature averaged two
   * distinct people across four seeds. A grudge nobody has added to lately is
   * a man getting on with it, which is most unhappy people most of the time.
   */
  it('does not come for a grudge that nothing has fed lately', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    npc.stats.grievance = APPROACH.grievanceUrgentAbove + 5;
    expect(approaches(state)).toHaveLength(0);

    remember(npc, state.day, 'passed_over');
    expect(approaches(state)).toHaveLength(1);
  });

  it('stops coming once the reason has gone stale', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);

    state.day += APPROACH.memoryFreshDays + 1;
    expect(approaches(state)).toHaveLength(0);
  });

  /**
   * It reads hidden stats and must never print one.
   *
   * The licence for reading grievance is that the man is telling you, and
   * that licence ends the moment a line says a number. Checked against every
   * branch rather than against the one being exercised.
   */
  it('never puts a number or a stat name on screen', () => {
    const state = game(12);
    const npc = someone(state);
    npc.stats.grievance = 91;
    npc.stats.ambition = 88;
    npc.stats.fear = 90;
    remember(npc, state.day, 'passed_over');
    remember(npc, state.day, 'went_unpaid');
    makePromise(state, npc.id, 'next_in_line');

    for (const a of approaches(state)) {
      expect(a.text).not.toMatch(/\d/);
      expect(a.text.toLowerCase()).not.toMatch(/grievance|ambition|loyalty|fear|stat/);
    }
  });
});

describe('the read changes nothing', () => {
  /**
   * A reporting system that touches the causal stream reorders every later
   * draw in the simulation. `whispers.ts` learned this by breaking two
   * operations tests, and states the rule at the top of the file.
   */
  it('consumes no random draws', () => {
    const state = game(5);
    const before = state.rng.calls;
    approaches(state);
    approaches(state);
    expect(state.rng.calls).toBe(before);
  });

  it('moves nothing on the state it reads', () => {
    const state = game(6);
    const npc = someone(state);
    npc.stats.grievance = 80;
    const snapshot = JSON.stringify(state);
    approaches(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  /**
   * The architectural claim, guarded.
   *
   * The engagement layer is a read specifically so that it does not compete
   * for `tickEvents`'s shared quarter-memo a day. If an approach ever became
   * an event, that would silently stop being true.
   */
  it('queues no memo', () => {
    const state = game(7);
    for (const npc of crewList(state)) npc.stats.grievance = 90;
    const before = state.pendingEvents.length;
    approaches(state);
    expect(state.pendingEvents.length).toBe(before);
  });

  /**
   * Two identical careers must produce identical doorways.
   *
   * Weaker than it looks unless the days are actually run: the read is pure,
   * so what this really guards is that nothing it calls has become impure.
   */
  it('is the same on the same seed', () => {
    const run = () => {
      const state = game(31);
      for (let d = 0; d < 90; d++) advanceDay(state);
      return approaches(state).map((a) => `${a.npcId}:${a.urgency}:${a.text}`);
    };
    expect(run()).toEqual(run());
  });

  it('survives a save that predates it', () => {
    const state = game(9);
    delete (state as { promises?: unknown }).promises;
    expect(() => approaches(state)).not.toThrow();
  });
});
