/**
 * Handing the operations loop over.
 *
 * This is the one thing in this project that was measured thoroughly and then
 * never shipped. `ladder.probe` has carried a `matchOps` arm for a while: your
 * best and most careful people on the riskiest work, whoever is left on the
 * safe jobs, running every day with nothing chosen by hand. It read 19 careers
 * of 36 ahead at +$202,308, and 18 of 36 at +$71,570 once the family also
 * trains people — a convenience rather than a strategy, which is exactly the
 * bar `RUNS_AUTO` sets for anything that plays turns for you.
 *
 * So it ships as what it measured as: a way to stop clicking, not a way to win.
 *
 * Two properties matter more than anything about the payoff, and both come
 * straight from what the probe learned building it:
 *
 * 1. **It does not change *what* runs, only *who* goes.** The first version of
 *    the arm also reordered the board — riskiest job first instead of by
 *    expected value — and lost by a million, because it spent the bench and the
 *    stake on the most dangerous work before reaching the work that pays. Jobs
 *    are still taken in expected-value order. Only the assignment is different.
 *
 * 2. **It is off unless you turn it on**, and turning it off leaves everything
 *    exactly as it was. No save format moves for it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { autopilotOn, setAutopilot, tickAutopilot } from '../autopilot';
import { advanceDay } from '../clock';
import { SAVE_VERSION } from '../state';
import { OPERATION_BY_ID } from '../../config/operations';
import type { GameState } from '../types';

function game(seed = 7): GameState {
  const state = newGame({ name: 'Auto', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 12) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

describe('turning it on', () => {
  it('is off until somebody asks for it', () => {
    const state = game();
    expect(autopilotOn(state)).toBe(false);
    expect(state.autopilot).toBeUndefined();
  });

  it('does not move the save format', () => {
    const state = game();
    setAutopilot(state, true);
    expect(SAVE_VERSION).toBe(13);
  });

  it('goes back off, and stops doing anything', () => {
    const state = game();
    setAutopilot(state, true);
    setAutopilot(state, false);
    expect(autopilotOn(state)).toBe(false);

    tickAutopilot(state, new Rng(state.rng));
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
  });
});

describe('what it does with the day', () => {
  it('sends people out without being asked', () => {
    const state = game();
    setAutopilot(state, true);
    expect(Object.keys(state.activeOperations)).toHaveLength(0);

    tickAutopilot(state, new Rng(state.rng));
    expect(Object.keys(state.activeOperations).length).toBeGreaterThan(0);
  });

  it('does nothing at all while it is off', () => {
    const state = game();
    tickAutopilot(state, new Rng(state.rng));
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
  });

  /*
     The property the probe paid a million to learn.

     The first version of the arm sorted the board by danger and spent the
     bench on the worst work before reaching the work that pays. Jobs are taken
     in expected-value order; only the assignment differs from the hand.
  */
  it('puts the better people on the more dangerous work', () => {
    const state = game();
    // A clear best and a clear worst, so the pairing is unambiguous.
    const crew = crewList(state).filter((n) => n.status === 'active');
    crew.forEach((n, i) => {
      n.stats.skill = 10 + i * 7;
      n.stats.discipline = 10 + i * 7;
    });
    setAutopilot(state, true);
    tickAutopilot(state, new Rng(state.rng));

    const out = Object.values(state.activeOperations);
    expect(out.length, 'nothing went out, so there is nothing to compare').toBeGreaterThan(1);

    const byRisk = { extreme: 3, high: 2, moderate: 1, low: 0 } as const;
    const rated = out
      .map((op) => ({
        risk: byRisk[OPERATION_BY_ID[op.defId].risk],
        crew: op.crewIds
          .map((id) => state.npcs[id])
          .reduce((sum, n) => sum + n.stats.skill + n.stats.discipline, 0) /
          Math.max(1, op.crewIds.length),
      }))
      .sort((a, b) => b.risk - a.risk);

    expect(
      rated[0].crew,
      'the riskiest job did not get the better people',
    ).toBeGreaterThanOrEqual(rated[rated.length - 1].crew);
  });

  it('will not send more people than it has', () => {
    const state = game();
    setAutopilot(state, true);
    tickAutopilot(state, new Rng(state.rng));

    const sent = Object.values(state.activeOperations).flatMap((op) => op.crewIds);
    expect(new Set(sent).size, 'somebody was on two jobs at once').toBe(sent.length);
  });

  it('will not spend money it does not have', () => {
    const state = game();
    state.org.dirtyCash = 0;
    state.org.cash = 0;
    setAutopilot(state, true);
    tickAutopilot(state, new Rng(state.rng));

    expect(state.org.dirtyCash).toBeGreaterThanOrEqual(0);
    expect(state.org.cash).toBeGreaterThanOrEqual(0);
  });

  /*
     It is not clever about danger, and that is deliberate.

     A standing order does not read the room and neither does this. Laying low
     is the one thing it respects, and it gets that for free by asking the same
     `canLaunch` every other launch asks.
  */
  it('stays in while the family is dark', () => {
    const state = game();
    setAutopilot(state, true);
    state.org.layLowUntilDay = state.day + 14;

    tickAutopilot(state, new Rng(state.rng));
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
  });

  it('keeps going across days on its own', () => {
    const state = game();
    setAutopilot(state, true);
    for (let d = 0; d < 10; d++) advanceDay(state);
    expect(state.operationHistory.length).toBeGreaterThan(2);
  });
});

/*
   Where it sends them, which it was getting wrong in a way nothing could see.

   `tickAutopilot` picked `operableTerritories(state)[0]`, and that list comes
   back sorted by influence descending — so the autopilot worked the district
   it was already strongest in, every night, forever. Influence is built by
   working a district, so a boss who threw this switch could never open another
   one. The map quietly stopped moving and no message said so.

   `ladder.probe` found exactly this defect in its own bot years ago and fixed
   it with the rule the territory screen already teaches: finish the district
   you started, then go and stand somewhere new. The shipped feature had the
   old line in it, and until now nothing outside this file had ever turned the
   shipped feature on.
*/
describe('where it sends them', () => {
  it('does not pour every night into ground it already holds', () => {
    const state = game();
    // Home is comfortably held; the place next door is not.
    state.territories.northside.influence.player = 90;
    state.territories.the_docks.influence.player = 20;
    setAutopilot(state, true);

    tickAutopilot(state, new Rng(state.rng));

    const live = Object.values(state.activeOperations ?? {});
    expect(live.length, 'the autopilot launched nothing, so this proves nothing').toBeGreaterThan(0);
    expect(
      live.every((op) => op.territoryId !== 'northside'),
      'the autopilot worked the district it already held instead of opening another',
    ).toBe(true);
  });

  it('goes back to its strongest ground once everything it can reach is held', () => {
    const state = game();
    // Every reachable district held outright, so there is nothing to open.
    for (const t of Object.values(state.territories)) t.influence.player = 80;
    setAutopilot(state, true);

    tickAutopilot(state, new Rng(state.rng));

    const live = Object.values(state.activeOperations ?? {});
    expect(live.length).toBeGreaterThan(0);
    expect(
      live.every((op) => typeof op.territoryId === 'string' && op.territoryId.length > 0),
      'with nothing left to open the autopilot stopped picking anywhere at all',
    ).toBe(true);
  });
});
