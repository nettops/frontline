/**
 * The room taking it off you.
 *
 * The point of this route is that it is the only way out of the chair a young,
 * careful boss can reach — conviction needs a case, assassination needs a war
 * you are losing, and the aging clock needs twenty-five years. So the tests
 * that matter are about reachability and about warning: it has to be able to
 * happen to somebody who has done nothing else wrong, and it must never happen
 * to a player who was not told first.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import { nameHeir, tickDeposition, wouldTakeIt } from '../succession';
import { DEPOSITION } from '../../config/succession';
import { ROLE_ORDER } from '../../config/economy';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Chair', difficulty: 'normal', seed });
}

/**
 * A room full of people who have had enough, one of whom wants the chair.
 *
 * Throws rather than returning early if the world does not cooperate. A setup
 * helper that quietly produces four men when it was asked for six is how a test
 * ends up asserting nothing at all.
 */
function unhappyRoom(state: GameState, size = 5): Npc[] {
  const seed = crewList(state)[0];
  if (!seed) throw new Error('a career starts with somebody; this one did not');

  const men: Npc[] = [];
  for (let i = 0; i < size; i++) {
    const npc: Npc = {
      ...seed,
      id: `man_${i}`,
      name: `Man ${i}`,
      role: 'capo',
      status: 'active',
      stats: {
        ...seed.stats,
        respectForBoss: 20,
        grievance: 70,
        ambition: 40,
        leadership: 70,
        skill: 70,
        courage: 70,
      },
      daysInCrew: 900,
      opsCompleted: 40,
      notes: [],
      memories: [],
      ties: [],
    };
    state.npcs[npc.id] = npc;
    men.push(npc);
  }
  // One of them wants it.
  men[0].stats.ambition = 90;

  if (ROLE_ORDER.indexOf('capo') < 0) throw new Error('role table changed');
  return men;
}

/** Runs weeks of the deposition question without running the rest of the game. */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day += 7;
    tickDeposition(state, new Rng(state.rng));
    if (state.gameOver) return;
  }
}

describe('a boss the room has stopped wanting', () => {
  it('has somebody who would take it', () => {
    const state = game();
    unhappyRoom(state);
    expect(wouldTakeIt(state)?.id).toBe('man_0');
  });

  it('has nobody when one man is angry and the rest are not', () => {
    const state = game();
    const men = unhappyRoom(state);
    for (const m of men.slice(1)) {
      m.stats.respectForBoss = 80;
      m.stats.grievance = 5;
    }
    /*
       The gate that separates a coup from a resignation. One aggrieved capo is
       a personnel problem; it becomes a succession when enough of the people
       who would have to object have stopped objecting.
    */
    expect(wouldTakeIt(state)).toBeNull();
  });

  it('warns before it can happen, without naming him', () => {
    const state = game();
    unhappyRoom(state);
    state.day = 7;

    weeks(state, DEPOSITION.rumourAfterWeeks + 2);

    const warning = state.log.find((l) => l.text.includes('meeting you were not at'));
    expect(warning, 'a coup nobody saw coming is a coin flip with extra steps').toBeTruthy();
    expect(warning!.text).not.toContain('Man 0');
    expect(state.gameOver).toBeNull();
  });

  it('never happens to a player who was not told first', () => {
    /*
       The invariant, rather than a check on the length of the fuse.

       The first version of this test asserted only that nothing happened in the
       first two weeks — which stayed green when the warning gate was deleted
       outright, because the fuse is short and the roll is unlikely. What has to
       be true is a relation between two days, over worlds where the thing
       actually happened, so the test has nothing to be right about by accident.
    */
    let checked = 0;
    for (let seed = 40; seed < 60; seed++) {
      const state = game(seed);
      unhappyRoom(state);
      state.day = 7;
      weeks(state, 250);
      if (state.succession.generation === 1) continue;

      const took = state.succession.line[state.succession.line.length - 1].toDay;
      const warned = state.log.find((l) => l.text.includes('meeting you were not at'));
      expect(warned, 'it happened with no warning at all').toBeTruthy();
      expect(warned!.day, 'the warning arrived with the coup').toBeLessThan(took);
      checked++;
    }
    expect(checked, 'no world got as far as a deposition, so nothing was checked')
      .toBeGreaterThan(10);
  });

  it('eventually happens, and the man who wanted it is the one who has it', () => {
    const state = game();
    unhappyRoom(state);
    state.day = 7;
    const wanted = wouldTakeIt(state)!;

    // Long enough that a 3.5% weekly roll is close to certain, and not so long
    // that this is testing patience rather than the mechanism.
    weeks(state, 250);

    expect(state.succession.generation).toBeGreaterThan(1);
    expect(state.player.name).toBe(wanted.name);
  });

  it('forgets about it the moment the room settles', () => {
    const state = game();
    const men = unhappyRoom(state);
    state.day = 7;
    weeks(state, DEPOSITION.rumourAfterWeeks + 1);
    expect(state.flags['unrest_since']).toBeGreaterThan(0);

    // Whatever it was, it was dealt with.
    for (const m of men) {
      m.stats.grievance = 0;
      m.stats.respectForBoss = 90;
    }
    weeks(state, 1);
    expect(state.flags['unrest_since']).toBe(0);
  });
});

describe('naming an heir', () => {
  it('makes waiting the only thing between him and the chair', () => {
    /*
       The other half of a decision that used to cost only social capital. You
       have told a man he gets it eventually; the config doubles his weekly
       chance of deciding that eventually is now. Asserted through the config
       rather than by running two thousand worlds to see a 3.5% against a 7%.
    */
    const state = game();
    unhappyRoom(state);
    const mover = wouldTakeIt(state)!;
    expect(nameHeir(state, mover.id).ok).toBe(true);
    expect(DEPOSITION.namedHeirMultiplier).toBeGreaterThan(1);
  });
});

describe('an ordinary career', () => {
  it('is not deposed for no reason', () => {
    /*
       The guard against the obvious way to get this wrong. Everything above
       constructs a room that has given up on the player; this checks that a
       normal one does not quietly do the same thing on its own.
    */
    const state = game(9);
    for (let d = 0; d < 400; d++) {
      state.org.cash = Math.max(state.org.cash, 200_000);
      advanceDay(state);
      if (state.gameOver) break;
    }
    // ...and it has to have been a career, or this asserts that nothing
    // happens in a game that ended on day four.
    expect(state.day, 'the world stopped before the question was ever asked').toBeGreaterThan(300);
    expect(state.succession.generation).toBe(1);
  });
});
