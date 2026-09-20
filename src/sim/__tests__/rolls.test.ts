/**
 * The dice, on the page.
 *
 * Round 30's tester saw two shakedowns fail at a shown 83% and roughly ten of
 * fifteen pitched jobs fail at 50 to 75%, and said outright they could not prove
 * anything from one run: "a per-roll log in Why would settle it." The claim is
 * the second of the five things this game says must stay true — shown odds are
 * real odds — and a claim like that is only as good as the player's ability to
 * check it.
 *
 * Each finished job now keeps the odds it was launched at and the number it was
 * rolled against, on the result the game already keeps (`operationHistory`),
 * and `rollRead` adds the shown odds up so a run of bad luck can be told from a
 * rigged table. Recording is reporting: it draws nothing, and the roll it keeps
 * is the very draw that decided the job.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { availableCrew, crewList, generateNpc } from '../npc';
import { canLaunch, crewNeeded, launchOperation, tickOperations } from '../operations';
import { rollRead } from '../trace';
import { operableTerritories } from '../territory';
import { OPERATION_BY_ID } from '../../config/operations';
import type { GameState, OperationResult } from '../types';

function game(seed = 88): GameState {
  const state = newGame({ name: 'Dice', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 14) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 900_000;
  return state;
}

/** Launches one street job and resolves it, returning the roll the stream held for it. */
function runOne(state: GameState, rng: Rng) {
  const def = OPERATION_BY_ID['corner_shakedown'];
  const crew = availableCrew(state)
    .slice(0, crewNeeded(state, def))
    .map((n) => n.id);
  const where = operableTerritories(state)[0].territory.id;
  const op = launchOperation(state, def.id, crew, where);
  expect(op, `the setup could not launch the job: ${canLaunch(state, def, crew, where).reason}`).not.toBeNull();
  state.day = op!.endDay;
  const held = new Rng({ ...state.rng }).next();
  tickOperations(state, rng);
  return { op: op!, held };
}

describe('a finished job keeps its dice', () => {
  it('records the odds it was launched at and the very roll that decided it', () => {
    const state = game();
    const { op, held } = runOne(state, new Rng(state.rng));
    const result = state.operationHistory[0];

    expect(result.id).toBe(op.id);
    expect(result.chance, 'the odds the panel showed were not kept').toBe(op.successChance);
    expect(result.roll, 'the roll kept is not the draw that decided the job').toBe(held);
    expect(result.success).toBe(result.roll! < result.chance!);
  });

  it('is never a job that succeeded against its own roll, over a run of them', () => {
    const state = game(91);
    const rng = new Rng(state.rng);
    for (let i = 0; i < 25; i++) {
      // A man who is hurt or held is not free; the run has to keep going anyway.
      if (availableCrew(state).length < 2) {
        for (const npc of Object.values(state.npcs)) {
          if (npc.status === 'injured' || npc.status === 'arrested') {
            npc.status = 'active';
            npc.unavailableUntilDay = null;
          }
        }
      }
      runOne(state, rng);
    }
    const kept = state.operationHistory.filter((r) => r.roll !== undefined);
    expect(kept.length, 'the run recorded almost nothing').toBeGreaterThanOrEqual(20);
    for (const r of kept) expect(r.success).toBe(r.roll! < r.chance!);
  });

  it('does not change what the roll decides', () => {
    // The stream is the same with or without the recording: the first draw of a
    // resolving job is the roll, and one draw is what it has always taken.
    const a = game(93);
    const b = game(93);
    runOne(a, new Rng(a.rng));
    runOne(b, new Rng(b.rng));
    expect(a.operationHistory[0].success).toBe(b.operationHistory[0].success);
    expect(a.rng.calls).toBe(b.rng.calls);
  });
});

function result(over: Partial<OperationResult>): OperationResult {
  return {
    id: 'op',
    defId: 'corner_shakedown',
    name: 'Corner Shakedown',
    territoryId: 'little_sicily',
    day: 10,
    success: true,
    margin: 0.2,
    payout: 0,
    heat: 0,
    crewIds: [],
    consequence: null,
    ...over,
  };
}

describe('reading the dice back', () => {
  it('lists the newest first, with the roll against the odds', () => {
    const state = game();
    state.operationHistory = [
      result({ id: 'b', day: 20, chance: 0.83, roll: 0.91, success: false }),
      result({ id: 'a', day: 10, chance: 0.6, roll: 0.25, success: true }),
    ];
    const read = rollRead(state);
    expect(read.rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(read.rows[0]).toMatchObject({ chance: 0.83, roll: 0.91, success: false });
  });

  it('adds the shown odds up against what actually happened', () => {
    const state = game();
    state.operationHistory = [
      result({ id: '1', chance: 0.83, roll: 0.9, success: false }),
      result({ id: '2', chance: 0.83, roll: 0.95, success: false }),
      result({ id: '3', chance: 0.5, roll: 0.1, success: true }),
      result({ id: '4', chance: 0.5, roll: 0.3, success: true }),
    ];
    const read = rollRead(state);
    expect(read.counted).toBe(4);
    expect(read.expected).toBeCloseTo(2.66, 6);
    expect(read.got).toBe(2);
  });

  it('leaves out a job from before the dice were kept, and says how many there were', () => {
    const state = game();
    state.operationHistory = [
      result({ id: 'new', chance: 0.7, roll: 0.2, success: true }),
      result({ id: 'old' }),
      result({ id: 'older' }),
    ];
    const read = rollRead(state);
    expect(read.rows.map((r) => r.id)).toEqual(['new']);
    expect(read.counted).toBe(1);
    expect(read.unrecorded).toBe(2);
  });

  it('is empty for a career that has finished nothing', () => {
    const read = rollRead(game());
    expect(read.rows).toEqual([]);
    expect(read.counted).toBe(0);
    expect(read.expected).toBe(0);
    expect(read.got).toBe(0);
  });
});
