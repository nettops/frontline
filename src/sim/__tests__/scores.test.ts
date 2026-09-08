/**
 * Scores: jobs you have to build before you can do them.
 *
 * The design note is `docs/specs/2026-08-23-scores-and-setups-design.md`.
 * This file holds the four properties the design rests on, and the layer is
 * decoration if any one of them fails.
 *
 * **Opening has to cost something.** A free option with no downside is a
 * button. The bill is a body, because the measured cause of a dead week in
 * this game is a shortage of people and never a shortage of money.
 *
 * **Prep has to be a dial and not a gate.** Skipping every setup stays legal
 * at the job's own odds. That is what keeps this clear of the `opGates` rule.
 *
 * **Setups must not count as work already done.** They run through
 * `launchOperation`, which is what makes them cheap to build, and two live job
 * gates read a lifetime count of every job run. §4.1 of the spec says this has
 * to be a test, so it is.
 *
 * **Getting rid of the gear has to bite.** Recovered gear writes evidence
 * naming the men who were carrying it, and where the job ran decides how often
 * that happens.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { availableCrew, crewList, generateNpc } from '../npc';
import { startLayLow } from '../heat';
import { LAY_LOW_DURATION_DAYS } from '../../config/heat';
import { territoryList } from '../territory';
import {
  canOpenScore,
  closeScore,
  liveScores,
  openScore,
  readyEverything,
  scoreOn,
  setupsFor,
} from '../scores';
import {
  availableOperations,
  crewNeeded,
  launchOperation,
  lockedOperations,
  opsBoard,
  successBreakdown,
} from '../operations';
import { SCORE, SETUP_BY_ID } from '../../config/scores';
import { OPERATION_BY_ID } from '../../config/operations';
import type { ApproachId } from '../../config/operations';
import type { GameState, Score } from '../types';

/** The cheapest tier-4 job to put on the board: two districts and eight bodies. */
const TARGET = 'call_in_tribute';
const STRAIGHT: ApproachId = 'standard';
const HEAVY: ApproachId = 'heavy';

function game(seed = 7): GameState {
  const state = newGame({ name: 'Planner', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 14) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  const all = territoryList(state);
  all[0].influence.player = 60;
  all[1].influence.player = 60;
  state.org.dirtyCash = 500_000;
  return state;
}

function where(state: GameState): string {
  return territoryList(state).sort(
    (a, b) => (b.influence.player ?? 0) - (a.influence.player ?? 0),
  )[0].id;
}

function open(state: GameState, spot?: string): Score {
  const man = availableCrew(state)[0];
  const score = openScore(state, TARGET, spot ?? where(state), man.id);
  if (!score) throw new Error('the fixture cannot open a score');
  return score;
}

/**
 * Runs one setup to a decided end.
 *
 * `successChance` is snapshotted on the operation at launch precisely so the
 * UI cannot lie about it after the fact, which makes it the honest lever for a
 * test that needs a landed setup rather than a lucky one.
 */
function runSetup(state: GameState, score: Score, setupId: string, land: boolean): void {
  const def = SETUP_BY_ID[setupId];
  const crew = availableCrew(state)
    .slice(0, def.crewRequired)
    .map((n) => n.id);
  const op = launchOperation(state, setupId, crew, score.territoryId, STRAIGHT, score.id);
  if (!op) throw new Error(`the fixture cannot launch ${setupId}`);
  op.successChance = land ? 1 : 0;
  for (let d = 0; d < def.durationDays; d++) advanceDay(state);
}

describe('opening one', () => {
  it('costs a man, and he is not available while it stands', () => {
    const state = game();
    const before = availableCrew(state).length;
    const score = open(state);

    expect(liveScores(state)).toHaveLength(1);
    expect(availableCrew(state).length).toBe(before - 1);
    expect(state.npcs[score.manId].status).not.toBe('active');
    expect(score.dueDay).toBe(state.day + SCORE.windowDays);
  });

  it('costs a stake in dirty money', () => {
    const state = game();
    const before = state.org.dirtyCash;
    open(state);
    expect(state.org.dirtyCash).toBeLessThan(before);
  });

  it('refuses a job the board has not opened', () => {
    const state = game();
    // Nothing held anywhere, so no tier-4 job is on the table.
    for (const t of territoryList(state)) t.influence.player = 0;
    expect(canOpenScore(state, TARGET).ok).toBe(false);
  });

  it('refuses a second score against the same job', () => {
    const state = game();
    open(state);
    expect(canOpenScore(state, TARGET).ok).toBe(false);
  });

  it('refuses when there is nobody spare', () => {
    const state = game();
    for (const npc of crewList(state)) npc.status = 'busy';
    expect(canOpenScore(state, TARGET).ok).toBe(false);
  });

  /*
     §2.4: a window expires because the player was slow, never because the game
     moved the job out from under them. Measured, two of 121 expiries were
     exactly that — the target's `opens` gate closed while the score stood,
     because a front shut or a favour lapsed. `canLaunch` never checked
     `opens`, so the simulation always allowed it; the board was the only thing
     saying no, and the probe inherited the same blindness from the panel.
  */
  it('keeps its target on the board when the gate behind it shuts', () => {
    const state = game();
    const score = open(state);
    // Whatever put it there, taken away. Two districts held becomes none.
    for (const t of territoryList(state)) t.influence.player = 0;
    state.territories[score.territoryId].influence.player = 30;

    expect(availableOperations(state).some((o) => o.id === TARGET)).toBe(true);
    expect(lockedOperations(state).some((o) => o.id === TARGET)).toBe(false);
  });

  it('puts it back above your standing once the score is gone', () => {
    const state = game();
    const score = open(state);
    for (const t of territoryList(state)) t.influence.player = 0;
    closeScore(state, score, 'expired');
    expect(availableOperations(state).some((o) => o.id === TARGET)).toBe(false);
  });

  it('leaves the job runnable by somebody who never opens one', () => {
    const state = game();
    expect(availableOperations(state).some((o) => o.id === TARGET)).toBe(true);
  });
});

describe('the setups', () => {
  it('are the ones this target names, and nothing else', () => {
    const setups = setupsFor(TARGET);
    expect(setups.length).toBeGreaterThan(0);
    for (const def of setups) expect(SETUP_BY_ID[def.id]).toBeTruthy();
  });

  it('are not on the job board', () => {
    const state = game();
    const board = availableOperations(state).map((o) => o.id);
    for (const def of setupsFor(TARGET)) expect(board).not.toContain(def.id);
  });

  it('pay nothing', () => {
    for (const def of Object.values(SETUP_BY_ID)) {
      expect(def.payout).toEqual([0, 0]);
    }
  });

  it('put their gear in the kit when they land', () => {
    const state = game();
    const score = open(state);
    const setup = setupsFor(TARGET)[0];
    runSetup(state, score, setup.id, true);

    expect(score.kit).toContain(setup.yields);
    expect(score.botched).toHaveLength(0);
  });

  it('raise alertness and leave the score standing when they blow', () => {
    const state = game();
    const score = open(state);
    const setup = setupsFor(TARGET)[0];
    runSetup(state, score, setup.id, false);

    expect(score.kit).toHaveLength(0);
    expect(score.botched).toContain(setup.id);
    expect(score.alertness).toBeGreaterThan(0);
    expect(score.status).toBe('open');
  });

  it('give the man straight back either way', () => {
    const state = game();
    const score = open(state);
    const setup = setupsFor(TARGET)[0];
    const before = availableCrew(state).length;
    runSetup(state, score, setup.id, false);
    expect(availableCrew(state).length).toBe(before);
  });

  it('cannot be run twice for the same thing', () => {
    const state = game();
    const score = open(state);
    const setup = setupsFor(TARGET)[0];
    runSetup(state, score, setup.id, true);
    const crew = availableCrew(state)
      .slice(0, setup.crewRequired)
      .map((n) => n.id);
    expect(
      launchOperation(state, setup.id, crew, score.territoryId, STRAIGHT, score.id),
    ).toBeNull();
  });

  /*
     §4.1. `opsBy` is a lifetime count of every job run and two live gates read
     it — `fence_goods >= 5` and `freelance_muscle >= 6`. Setups go through
     `launchOperation` unchanged, so without this they would quietly buy their
     way past both.
  */
  it('never count as work already done', () => {
    const state = game();
    const score = open(state);
    for (const setup of setupsFor(TARGET)) runSetup(state, score, setup.id, true);

    const board = opsBoard(state);
    for (const setup of setupsFor(TARGET)) {
      expect(board.opsBy[setup.id] ?? 0).toBe(0);
    }
    expect(state.operationHistory.every((r) => !SETUP_BY_ID[r.defId])).toBe(true);
  });
});

/*
   Getting everything ready in one move.

   Each setup went through the whole assemble panel on its own, so building up
   to one job was three to five full launches before the job itself — about
   240 clicks a career on top of the twelve hundred the crew picker already
   cost. The loop lives in sim rather than in the panel because there is no
   jsdom here, and a batch action that decides what it can afford has to be
   testable.
*/
describe('getting everything ready at once', () => {
  it('sends everything it can staff, and says what went', () => {
    const state = game();
    const score = open(state);
    const want = setupsFor(TARGET).length;

    const sent = readyEverything(state, score, 'best');

    expect(sent.length).toBe(want);
    expect(Object.values(state.activeOperations).filter((o) => o.scoreId === score.id))
      .toHaveLength(want);
  });

  it('leaves alone what is already out or already in hand', () => {
    const state = game();
    const score = open(state);
    const first = setupsFor(TARGET)[0];
    runSetup(state, score, first.id, true);

    const sent = readyEverything(state, score, 'best');
    expect(sent).not.toContain(first.id);
    expect(sent.length).toBe(setupsFor(TARGET).length - 1);
  });

  it('stops when there is nobody left to send', () => {
    const state = game();
    const score = open(state);
    // Leave two men standing, which cannot staff every setup this job allows.
    const spare = availableCrew(state);
    for (const npc of spare.slice(2)) npc.status = 'busy';

    const sent = readyEverything(state, score, 'best');
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.length).toBeLessThan(setupsFor(TARGET).length);
  });

  it('does nothing to a score whose night is already out', () => {
    const state = game();
    const score = open(state);
    score.status = 'running';
    expect(readyEverything(state, score, 'best')).toHaveLength(0);
  });

  /*
     The two policies, and the same reason the panel ships two buttons: a
     single fill would have a silent default and the default would become the
     strategy.
  */
  it('honours which men it was told to send', () => {
    const a = game();
    const b = game();
    const one = open(a);
    const two = open(b);
    readyEverything(a, one, 'best');
    readyEverything(b, two, 'rested');

    const who = (s: GameState) =>
      Object.values(s.activeOperations)
        .flatMap((o) => o.crewIds)
        .sort()
        .join(',');
    expect(who(a)).not.toBe(who(b));
  });
});

describe('what the kit buys', () => {
  it('moves the odds on the job at the end of it', () => {
    const state = game();
    const score = open(state);
    const crew = availableCrew(state).slice(0, 4);
    const bare = successBreakdown(state, OPERATION_BY_ID[TARGET], crew, score.territoryId).total;

    for (const setup of setupsFor(TARGET)) runSetup(state, score, setup.id, true);
    const prepped = successBreakdown(
      state,
      OPERATION_BY_ID[TARGET],
      crew,
      score.territoryId,
    ).total;

    expect(prepped).toBeGreaterThan(bare);
  });

  it('is pulled back by a score that has been noticed', () => {
    const state = game();
    const score = open(state);
    const crew = availableCrew(state).slice(0, 4);
    for (const setup of setupsFor(TARGET)) runSetup(state, score, setup.id, true);
    const before = successBreakdown(
      state,
      OPERATION_BY_ID[TARGET],
      crew,
      score.territoryId,
    ).total;

    score.alertness = 60;
    const after = successBreakdown(state, OPERATION_BY_ID[TARGET], crew, score.territoryId).total;
    expect(after).toBeLessThan(before);
  });

  it('does not touch a job nobody opened a score against', () => {
    const state = game();
    const crew = availableCrew(state).slice(0, 4);
    expect(successBreakdown(state, OPERATION_BY_ID[TARGET], crew, where(state)).prep).toBe(0);
  });
});

describe('the window', () => {
  it('shuts on the due day, and gives the man back', () => {
    const state = game();
    const score = open(state);
    const held = score.manId;

    for (let d = 0; d < SCORE.windowDays + 1; d++) advanceDay(state);

    expect(score.status).toBe('expired');
    expect(liveScores(state)).toHaveLength(0);
    expect(state.npcs[held].status).toBe('active');
  });

  /*
     A day the game refuses to let you move is not a day you were given.

     Measured: across every day in the life of a score that expired, 14% were
     spent laying low and a further 39% were spent at a heat the family would
     not work through. The first of those is the game saying no —
     `canLaunch` refuses anything but quiet work while dark — and
     `LAY_LOW_DURATION_DAYS` is 14, exactly half a window. A player who takes
     the correct cure for heat should not lose the month of planning for it.
  */
  it('does not run down while the family is dark', () => {
    const state = game();
    const score = open(state);
    const was = score.dueDay;
    startLayLow(state);

    for (let d = 0; d < 5; d++) advanceDay(state);
    expect(score.dueDay).toBe(was + 5);
    // And the man is still held to the day it now shuts on, or closing it
    // would leave him standing on a corner forever.
    expect(state.npcs[score.manId].unavailableUntilDay).toBe(score.dueDay);
  });

  it('runs down again once the family comes back out', () => {
    const state = game();
    const score = open(state);
    startLayLow(state);
    for (let d = 0; d < LAY_LOW_DURATION_DAYS + 1; d++) advanceDay(state);
    const after = score.dueDay;

    for (let d = 0; d < 4; d++) advanceDay(state);
    expect(score.dueDay).toBe(after);
  });

  it('takes the kit with it', () => {
    const state = game();
    const score = open(state);
    runSetup(state, score, setupsFor(TARGET)[0].id, true);
    expect(score.kit.length).toBeGreaterThan(0);

    closeScore(state, score, 'expired');
    expect(score.kit).toHaveLength(0);
    expect(scoreOn(state, TARGET)).toBeUndefined();
  });
});

describe('getting rid of it', () => {
  /**
   * One career: open a score, land every setup, run the job, count what the
   * police came away with.
   */
  function career(seed: number, control: number): number {
    const state = game(seed);
    /*
       A third district, so the two the gate reads keep their 60 whatever this
       is set to. The first version moved one of those and the job came off the
       board, which is a fixture granting a precondition and then taking it
       away again.
    */
    const spot = territoryList(state)[2].id;
    state.territories[spot].influence.player = control;

    const score = open(state, spot);
    for (const setup of setupsFor(TARGET)) runSetup(state, score, setup.id, true);

    const before = Object.keys(state.evidence).length;
    const def = OPERATION_BY_ID[TARGET];
    // What it needs *now*, which the kit has already cut into.
    const crew = availableCrew(state)
      .slice(0, crewNeeded(state, def))
      .map((n) => n.id);
    const op = launchOperation(state, TARGET, crew, spot, STRAIGHT);
    if (!op) throw new Error('the fixture cannot run the job');
    op.successChance = 1;
    for (let d = 0; d < def.durationDays; d++) advanceDay(state);

    expect(score.status).toBe('done');
    return Object.keys(state.evidence).length - before;
  }

  it('names the men who were carrying it', () => {
    const state = game();
    const score = open(state);
    for (const setup of setupsFor(TARGET)) runSetup(state, score, setup.id, true);

    const def = OPERATION_BY_ID[TARGET];
    // What it needs *now*, which the kit has already cut into.
    const crew = availableCrew(state)
      .slice(0, crewNeeded(state, def))
      .map((n) => n.id);
    state.territories[score.territoryId].influence.player = 26;
    const op = launchOperation(state, TARGET, crew, score.territoryId, HEAVY);
    if (!op) throw new Error('the fixture cannot run the job');
    op.successChance = 0;
    for (let d = 0; d < def.durationDays; d++) advanceDay(state);

    const found = Object.values(state.evidence).filter((e) => e.source === 'disposal');
    expect(found.length).toBeGreaterThan(0);
    for (const trace of found) {
      expect(trace.npcIds.length).toBeGreaterThan(0);
      for (const id of trace.npcIds) expect(crew).toContain(id);
    }
  });

  /*
     Paired across twenty seeds, because one disposal is one roll. This is the
     row §2.3 exists for: where the job ran has a tail three days after it.
  */
  it('goes better on ground you hold', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    const held = seeds.reduce((sum, s) => sum + career(s, 90), 0);
    const strange = seeds.reduce((sum, s) => sum + career(s, 26), 0);
    expect(held).toBeLessThan(strange);
  });
});
