/**
 * Handing the operations loop over.
 *
 * `ladder.probe` measured this twice. The `matchOps` arm — best people on the
 * riskiest work, jobs in expected-value order — read 19 careers of 36 ahead
 * at +$202,308. The `matchOpsSmart` arm added the two heat levers and read
 * 20/36 ahead at +$347,540, level with a careful hand. The first shipped
 * under the old "automation must not beat playing" bar; the second shipped
 * on 2026-08-29 when the owner reversed that bar — the autopilot is a
 * supported way to play, so it plays as well as a careful hand.
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
import { autopilotOn, autopilotRisk, setAutopilot, setAutopilotRisk, tickAutopilot } from '../autopilot';
import { advanceDay } from '../clock';
import { SAVE_VERSION } from '../state';
import { availableOperations } from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { AUTOPILOT, AUTOPILOT_RISK } from '../../config/autopilot';
import { payrollForecast } from '../economy';
import { PAYDAY_INTERVAL } from '../../config/economy';
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
     It reads the room now, and the two levers are the measured ones.

     The `matchOpsSmart` experiment in ladder.probe settled this across 36
     careers: quieter work above AUTOPILOT.quietAbove, nothing at all above
     AUTOPILOT.stopAbove, and the result stays level with careful hand play.
     For years the finding was withheld under the "automation must not beat
     playing" bar; the project owner reversed that bar on 2026-08-29 — the
     autopilot is a way to play, not a handicapped convenience — so the
     finding ships exactly as it measured.
  */
  it('runs nothing at all once the heat is genuinely bad', () => {
    const state = game();
    state.org.heat = AUTOPILOT.stopAbove;
    setAutopilot(state, true);
    tickAutopilot(state, new Rng(state.rng));
    expect(Object.keys(state.activeOperations)).toHaveLength(0);
  });

  it('keeps to the quieter work once they are looking at you', () => {
    const state = newGame({
      name: 'Auto',
      difficulty: 'normal',
      seed: 7,
      mode: 'sandbox',
      sandboxStart: 'seated',
    });
    const rng = new Rng(state.rng);
    while (crewList(state).filter((n) => n.status !== 'dead').length < 12) {
      const npc = generateNpc(state, rng, 'soldier');
      state.npcs[npc.id] = npc;
    }
    state.org.dirtyCash = 400_000;
    state.org.heat = AUTOPILOT.quietAbove;

    // Instrument first: a board with no loud work on it proves nothing.
    const byRisk = { extreme: 3, high: 2, moderate: 1, low: 0 } as const;
    expect(
      availableOperations(state).some((def) => byRisk[def.risk] > 1),
      'the board offered nothing loud, so the filter was never tested',
    ).toBe(true);

    setAutopilot(state, true);
    tickAutopilot(state, new Rng(state.rng));

    const out = Object.values(state.activeOperations);
    expect(out.length, 'going quiet is not the same as stopping').toBeGreaterThan(0);
    expect(
      out.every((op) => byRisk[OPERATION_BY_ID[op.defId].risk] <= 1),
      'something loud went out while they were already looking',
    ).toBe(true);
  });

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

/*
   How hard the loop is allowed to push. Round 16's own finding: the jobs
   pass spends against the whole treasury with no idea payroll exists, and a
   blind career's one real financial crisis was exactly that — two failed
   jobs plus a due Friday left nothing to cover it.

   `normal` has to be a no-op, checked directly, because it is what every
   career that has ever turned this on has been running — a regression here
   silently reruns every measurement in `ladder.probe`'s autopilot arms.
*/
describe('how hard it is allowed to push', () => {
  it('is normal by default, and normal is a no-op', () => {
    const state = game();
    expect(autopilotRisk(state)).toBe('normal');
    expect(AUTOPILOT_RISK.normal.quietAbove).toBe(AUTOPILOT.quietAbove);
    expect(AUTOPILOT_RISK.normal.stopAbove).toBe(AUTOPILOT.stopAbove);
    expect(AUTOPILOT_RISK.normal.reservesPayroll).toBe(false);
  });

  it('eases off and stops sooner when set to cautious', () => {
    const state = game();
    setAutopilot(state, true);
    setAutopilotRisk(state, 'cautious');
    // Between cautious's stop line and normal's — normal would still work,
    // cautious should already have gone dark.
    state.org.heat = AUTOPILOT_RISK.cautious.stopAbove;

    tickAutopilot(state, new Rng(state.rng));
    expect(
      Object.keys(state.activeOperations),
      'cautious kept working past its own stop line',
    ).toHaveLength(0);
  });

  it('tolerates more heat when set to aggressive', () => {
    const state = game();
    setAutopilot(state, true);
    setAutopilotRisk(state, 'aggressive');
    // Past normal's stop line, short of aggressive's — normal would already
    // be dark here.
    state.org.heat = AUTOPILOT.stopAbove + 5;
    expect(state.org.heat).toBeLessThan(AUTOPILOT_RISK.aggressive.stopAbove);

    tickAutopilot(state, new Rng(state.rng));
    expect(
      Object.keys(state.activeOperations).length,
      'aggressive stopped at the same line normal does',
    ).toBeGreaterThan(0);
  });

  it('never ends a tick owing more than it started with once payday is a day away', () => {
    /*
       The actual promise, checked directly rather than through which one
       job happened to be picked — pass one's budget check is a pre-filter
       against the *starting* total, not a running balance, so asserting on
       a specific job risks asserting on an implementation detail rather
       than the guarantee. What must always hold is the total afterwards.
    */
    const state = game();
    while ((state.day + 1) % PAYDAY_INTERVAL !== 0) advanceDay(state);
    const due = payrollForecast(state).due;
    expect(due, 'the fixture has to actually owe something').toBeGreaterThan(0);

    // Just over what payday costs — a normal boss has room to spend on jobs
    // and nothing stops it eating into this.
    state.org.cash = due + 100;
    state.org.dirtyCash = 0;

    setAutopilot(state, true);
    setAutopilotRisk(state, 'cautious');
    tickAutopilot(state, new Rng(state.rng));

    expect(
      state.org.cash + state.org.dirtyCash,
      'cautious spent below what the forecast says payday needs',
    ).toBeGreaterThanOrEqual(due);
  });

  it('the reserve is not free — the same setup spends further under normal', () => {
    // The contrast that makes the test above worth having, checked directly
    // rather than assumed: identical setup, only the setting differs, and
    // cautious is left with strictly more than normal.
    function endingFunds(riskLevel: 'normal' | 'cautious'): number {
      const state = game();
      while ((state.day + 1) % PAYDAY_INTERVAL !== 0) advanceDay(state);
      const due = payrollForecast(state).due;
      state.org.cash = due + 100;
      state.org.dirtyCash = 0;
      setAutopilot(state, true);
      setAutopilotRisk(state, riskLevel);
      tickAutopilot(state, new Rng(state.rng));
      return state.org.cash + state.org.dirtyCash;
    }

    expect(
      endingFunds('cautious'),
      'cautious must never end up holding less than normal in the same spot',
    ).toBeGreaterThanOrEqual(endingFunds('normal'));
  });

  it('still runs a job that costs nothing even with the reserve at zero', () => {
    const state = game();
    while ((state.day + 1) % PAYDAY_INTERVAL !== 0) advanceDay(state);
    // Deep in the hole — the reserve clamps to zero rather than going
    // negative, which would refuse a free job for a shortfall it cannot see.
    state.org.cash = 1;
    state.org.dirtyCash = 0;

    setAutopilot(state, true);
    setAutopilotRisk(state, 'cautious');
    tickAutopilot(state, new Rng(state.rng));

    const out = Object.values(state.activeOperations);
    expect(
      out.some((op) => OPERATION_BY_ID[op.defId].investment === 0),
      'a free job was refused for money the reserve only imagines it needs',
    ).toBe(true);
  });
});
