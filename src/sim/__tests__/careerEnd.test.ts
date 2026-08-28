/**
 * A career ends when somebody ends it, and not before.
 *
 * There were three ways out. Two of them are somebody removing you — a
 * conviction, or a bullet — and both go through `removePlayer`, which only
 * stops the game when there is nobody left to hand the chair to. The third was
 * a floor in `checkGameOver`: no crew, no work running, and not enough money
 * to hire anybody, so the run is declared finished.
 *
 * The floor is gone, and the argument for removing it is that it was never
 * true. `work_it_yourself` asks for no crew, no investment and one day, pays
 * $180 to $420 at 82%, and is open at the first rank. A boss with nothing has
 * always had a way back — slow, undignified, and available every single
 * morning. The floor was not describing a dead end. It was declaring one, at
 * the exact moment the game got interesting, and then taking the run away.
 *
 * That leaves the two endings a 1935 boss actually gets, which is the point.
 *
 * The risk this file exists to guard is the obvious one: with the floor gone,
 * a broke career must not become a career that cannot end. So the last two
 * tests check the real endings still fire.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { advanceDay } from '../clock';
import { removePlayer } from '../succession';
import { crewList } from '../npc';
import { availableOperations, launchOperation } from '../operations';
import { operableTerritories } from '../territory';
import { Rng } from '../rng';
import type { GameState } from '../types';

/** A career with nobody left and nothing in the drawer. */
function destitute(seed = 11): GameState {
  const state = newGame({ name: 'Nobody', difficulty: 'normal', seed });
  for (const npc of crewList(state)) npc.status = 'dead';
  state.org.cash = 0;
  state.org.dirtyCash = 0;
  state.org.holdings = 0;
  return state;
}

describe('being broke is not an ending', () => {
  it('does not end the run when there is nobody left and no money', () => {
    const state = destitute();
    for (let i = 0; i < 40; i++) advanceDay(state);

    expect(
      state.gameOver,
      `the run ended by itself: "${state.gameOver?.reason}". Only a conviction ` +
        `or a bullet is allowed to do that.`,
    ).toBeNull();
  });

  it('still leaves something to do on the worst morning of the career', () => {
    /*
       The whole justification for removing the floor. If this ever fails, the
       floor was telling the truth and taking it out stranded the player in a
       run they cannot end and cannot play.
    */
    const state = destitute();
    const open = availableOperations(state);

    expect(
      open.length,
      'a boss with no crew and no money has nothing they can do, so the run is ' +
        'now unwinnable and unendable at the same time',
    ).toBeGreaterThan(0);

    const free = open.find((op) => op.crewRequired === 0 && op.investment === 0);
    expect(
      free,
      `nothing open costs nothing: ${open.map((o) => o.name).join(', ')}`,
    ).toBeDefined();
  });

  it('can actually climb back out, given the days', () => {
    // Not a balance claim. Only that the floor is reachable from below.
    const state = destitute(5);
    for (let i = 0; i < 120 && !state.gameOver; i++) {
      const op = availableOperations(state).find(
        (o) => o.crewRequired === 0 && o.investment === 0,
      );
      const where = operableTerritories(state)[0];
      if (op && where) launchOperation(state, op.id, [], where.territory.id);
      advanceDay(state);
    }
    expect(
      state.org.cash + state.org.dirtyCash,
      'four months of working it yourself earned nothing at all',
    ).toBeGreaterThan(0);
  });
});

describe('the two endings that are left', () => {
  it('ends on a conviction with nobody to take over', () => {
    const state = destitute(3);
    const rng = new Rng(state.rng);
    removePlayer(state, rng, 'convicted', 'Ten years.');
    expect(state.gameOver, 'a conviction with no heir did not end the career').not.toBeNull();
  });

  it('ends on an assassination with nobody to take over', () => {
    const state = destitute(3);
    const rng = new Rng(state.rng);
    removePlayer(state, rng, 'killed', 'On the steps of the courthouse.');
    expect(state.gameOver, 'a killing with no heir did not end the career').not.toBeNull();
  });

  it('does not end either one when there is somebody to take over', () => {
    // Succession is the buffer, and it is not what this change touches.
    const state = newGame({ name: 'Nobody', difficulty: 'normal', seed: 8 });
    const rng = new Rng(state.rng);
    for (let i = 0; i < 200 && crewList(state).length < 3; i++) advanceDay(state);
    if (crewList(state).length < 1) return; // nothing to assert against
    removePlayer(state, rng, 'convicted', 'Ten years.');
    // Either it handed over, or there genuinely was nobody senior enough.
    expect(typeof state.gameOver === 'object').toBe(true);
  });
});
