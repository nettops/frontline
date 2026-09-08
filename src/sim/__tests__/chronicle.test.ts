/**
 * The family's own past, which the game was throwing away.
 *
 * `addLog` keeps 400 entries, newest first. A career writes many times that, so
 * measured across eight careers the log reaches back 90 days of a 90-day career,
 * 150 days of a 300-day one, and 132 days of a 600-day one — 99%, 50% and 22%
 * of the career visible. The founding of the family is the first thing to go.
 *
 * The repair is a read rather than a second list, because a recorded chronicle
 * needs a call at every moment worth remembering and deaths alone happen at five
 * sites. This project has found the same defect four times in a season — a rank
 * nothing assigned, a groove that never left one module, a cooldown applied to
 * one of two identical memos — and each was a write that some path skipped.
 *
 * What makes the read possible is that former crew are never deleted:
 * `crewList` filters them out and `state.npcs` keeps them, with notes, role and
 * a `daysInCrew` frozen at the day they stopped being yours.
 *
 * These guard that it reaches the whole career, that it changes nothing, and
 * that it agrees with the people it is derived from.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { advanceDay } from '../clock';
import { addLog } from '../util';
import { chronicle, chronicleSummary } from '../chronicle';
import type { GameState, Npc } from '../types';

function game(seed = 6): GameState {
  return newGame({ name: 'Past', difficulty: 'normal', seed });
}

function hire(state: GameState, at: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 51, calls: at }), 'soldier');
  state.npcs[npc.id] = npc;
  npc.daysInCrew = 0;
  return npc;
}

describe('what happened to this family', () => {
  it('names everybody who was ever in it, including the dead', () => {
    const state = game();
    const living = crewList(state)[0];
    const lost = hire(state, 1);
    lost.daysInCrew = 40;
    lost.status = 'dead';
    lost.notes = [{ day: state.day, text: 'They were found.', kind: 'bad' }];

    const names = chronicle(state).map((c) => c.name);
    expect(names).toContain(living.name);
    expect(names, 'the dead fall out of the record they are most of').toContain(lost.name);
  });

  it('gives a man who left both halves of his story', () => {
    const state = game();
    const npc = hire(state, 2);
    npc.daysInCrew = 60;
    npc.status = 'defected';
    npc.notes = [{ day: 100, text: 'Went with Vito.', kind: 'bad' }];

    const his = chronicle(state).filter((c) => c.npcId === npc.id);
    expect(his).toHaveLength(2);
    expect(his[0].day, 'joined 60 days before he went').toBe(40);
    expect(his[1].day).toBe(100);
    expect(his[1].text).toContain('Went with Vito.');
  });

  /**
   * Oldest first, which is the opposite of the log and the point of the file.
   * A record read newest-first is a feed.
   */
  it('reads forwards', () => {
    const state = game();
    for (let i = 0; i < 4; i++) {
      const npc = hire(state, i);
      npc.daysInCrew = i * 10;
    }
    const days = chronicle(state).map((c) => c.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  /**
   * The whole career, which is what the log cannot do.
   *
   * Run rather than constructed: what is being guarded is that the record
   * survives the passage of time, and a fixture frozen on one day would pass
   * whatever `LOG_LIMIT` did.
   */
  it('still reaches the founding after the log has forgotten it', () => {
    const state = game(14);
    const founding = Math.min(...chronicle(state).map((c) => c.day));

    /*
       The log has to actually overflow or this measures nothing.

       A bare `advanceDay` bot writes about eighty entries in 260 days, which is
       under the cap — so the first version of this test compared two records
       neither of which had forgotten anything and would have passed with the
       chronicle deleted. Filled directly rather than by playing harder,
       because what is under test is the cap, not the game.
    */
    for (let d = 0; d < 260; d++) advanceDay(state);
    for (let i = 0; i < 500; i++) addLog(state, `night ${i}`, 'neutral');

    const oldestLog = state.log.length ? state.log[state.log.length - 1].day : state.day;
    const oldestChapter = Math.min(...chronicle(state).map((c) => c.day));

    expect(oldestChapter, 'the founding moved').toBe(founding);
    expect(state.log.length, 'the log did not fill, so this measures nothing').toBe(400);
    expect(
      oldestChapter,
      `the log reaches back to day ${oldestLog} and the chronicle to day ${oldestChapter}; ` +
        `the record has stopped outliving the feed`,
    ).toBeLessThan(oldestLog);
  });

  it('says the same thing its own summary says', () => {
    const state = game(9);
    const gone = hire(state, 3);
    gone.daysInCrew = 30;
    gone.status = 'dead';
    gone.notes = [{ day: state.day, text: 'Died.', kind: 'bad' }];

    const summary = chronicleSummary(state);
    const people = new Set(chronicle(state).map((c) => c.npcId));
    expect(summary.everJoined).toBe(people.size);
    expect(summary.stillHere + summary.gone).toBe(summary.everJoined);
    expect(summary.gone).toBeGreaterThan(0);
  });

  /**
   * A predecessor is the succession line's business.
   *
   * `status: 'boss'` marks somebody who used to run this, and `succession.ts`
   * keeps that record properly across reigns. Listing him here would say he
   * walked out.
   */
  it('leaves the previous boss to the succession line', () => {
    const state = game();
    const npc = hire(state, 4);
    npc.daysInCrew = 100;
    npc.status = 'boss';
    expect(chronicle(state).some((c) => c.npcId === npc.id)).toBe(false);
  });
});

describe('the record changes nothing', () => {
  it('consumes no random draws', () => {
    const state = game(7);
    const before = state.rng.calls;
    chronicle(state);
    chronicleSummary(state);
    expect(state.rng.calls).toBe(before);
  });

  it('moves nothing on the state it reads', () => {
    const state = game(8);
    const snapshot = JSON.stringify(state);
    chronicle(state);
    chronicleSummary(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is the same on the same seed', () => {
    const run = () => {
      const state = game(21);
      for (let d = 0; d < 120; d++) advanceDay(state);
      return chronicle(state).map((c) => `${c.day}:${c.npcId}:${c.text}`);
    };
    expect(run()).toEqual(run());
  });

  /** Somebody with no notes at all still has a beginning. */
  it('survives a man the game never wrote anything about', () => {
    const state = game(10);
    const npc = hire(state, 5);
    npc.daysInCrew = 20;
    npc.notes = [];
    expect(() => chronicle(state)).not.toThrow();
    expect(chronicle(state).some((c) => c.npcId === npc.id)).toBe(true);
  });
});
