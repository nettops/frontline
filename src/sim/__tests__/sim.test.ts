import { describe, expect, it, beforeEach } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { advanceDay, advanceDays } from '../clock';
import { crewList, availableCrew, driftNpcs, generateNpc, perceive } from '../npc';
import {
  availableOperations,
  canLaunch,
  launchOperation,
  successBreakdown,
} from '../operations';
import { addHeat, tickHeat } from '../heat';
import { totalFunds } from '../economy';
import { resolveEvent } from '../events';
import { promote, recruit } from '../crew';
import { loadGame, saveGame } from '../save';
import { OPERATION_BY_ID } from '../../config/operations';
import { HOME_TERRITORY } from '../../config/territories';
import { operableTerritories } from '../territory';
import type { GameState } from '../types';

// ---------------------------------------------------------------- helpers ---

function fresh(seed = 12345): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Answers every pending event with its first enabled choice. */
function clearEvents(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.pendingEvents.length > 0 && guard++ < 20) {
    const event = state.pendingEvents[0];
    const choice = event.choices.find((c) => !c.disabledReason) ?? event.choices[0];
    resolveEvent(state, rng, event.id, choice.id);
  }
}

// -------------------------------------------------------------------- rng ---

describe('rng', () => {
  it('produces the same stream for the same seed and call count', () => {
    const a = new Rng({ seed: 999, calls: 0 });
    const b = new Rng({ seed: 999, calls: 0 });
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('resumes mid-stream from a saved call count', () => {
    const a = new Rng({ seed: 7, calls: 0 });
    for (let i = 0; i < 30; i++) a.next();
    const expected = Array.from({ length: 10 }, () => a.next());

    // Same as reloading a save taken after 30 calls.
    const resumed = new Rng({ seed: 7, calls: 30 });
    const actual = Array.from({ length: 10 }, () => resumed.next());
    expect(actual).toEqual(expected);
  });

  it('stays uniform enough after a large number of calls', () => {
    const rng = new Rng({ seed: 42, calls: 5_000_000 });
    const values = Array.from({ length: 20_000 }, () => rng.next());
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('respects int bounds inclusively', () => {
    const rng = new Rng({ seed: 3, calls: 0 });
    for (let i = 0; i < 2_000; i++) {
      const v = rng.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

// ------------------------------------------------------------- new game ----

describe('newGame', () => {
  it('starts the player at the bottom with one person', () => {
    const state = fresh();
    expect(state.day).toBe(1);
    expect(state.player.rank).toBe('street_criminal');
    expect(state.org.cash).toBe(2_500);
    expect(state.org.heat).toBe(0);
    expect(crewList(state)).toHaveLength(1);
    expect(Object.keys(state.recruits).length).toBeGreaterThan(0);
  });

  it('is fully reproducible from a seed', () => {
    const a = fresh(4242);
    const b = fresh(4242);
    advanceDays(a, 40);
    advanceDays(b, 40);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different worlds from different seeds', () => {
    const a = fresh(1);
    const b = fresh(2);
    expect(crewList(a)[0].name).not.toEqual(crewList(b)[0].name);
  });
});

// ----------------------------------------------------------- perception ----

describe('perception', () => {
  it('gives no read at all on someone brand new', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    const stranger = generateNpc(state, rng, 'associate');
    expect(perceive(stranger, 'loyalty').known).toBe(false);
  });

  it('is stable across repeated reads at the same familiarity', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    npc.familiarity = 40;
    const first = perceive(npc, 'loyalty');
    const second = perceive(npc, 'loyalty');
    expect(first.band).toEqual(second.band);
  });

  it('converges on the truth as familiarity rises', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    npc.stats.loyalty = 85;

    npc.familiarity = 100;
    const wellKnown = perceive(npc, 'loyalty');
    // At maximum familiarity noise is +/-4, so the band cannot be far off.
    expect(wellKnown.known).toBe(true);
    expect(Math.abs(wellKnown.bandIndex - 4)).toBeLessThanOrEqual(1);
  });

  it('never exposes raw stat numbers through the read', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    npc.familiarity = 90;
    const read = perceive(npc, 'greed');
    expect(typeof read.band).toBe('string');
    expect(read.band).not.toMatch(/\d/);
  });
});

// ------------------------------------------------------------ operations ---

describe('operations', () => {
  it('only offers work the player has the standing for', () => {
    const state = fresh();
    const ops = availableOperations(state);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((o) => o.minRank === 'street_criminal')).toBe(true);
  });

  it('occupies crew for the duration and releases them on resolve', () => {
    const state = fresh();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const crew = availableCrew(state);
    const op = launchOperation(state, def.id, [crew[0].id], HOME_TERRITORY);

    expect(op).not.toBeNull();
    expect(state.npcs[crew[0].id].status).toBe('busy');
    expect(availableCrew(state)).toHaveLength(0);

    advanceDays(state, def.durationDays);

    expect(Object.keys(state.activeOperations)).toHaveLength(0);
    expect(state.operationHistory.length).toBe(1);
    // Released unless a failure consequence took them.
    const after = state.npcs[crew[0].id].status;
    expect(['active', 'injured', 'arrested']).toContain(after);
  });

  it('refuses to launch without the required crew or funds', () => {
    const state = fresh();
    const def = OPERATION_BY_ID['boost_cars']; // needs 2
    const crew = availableCrew(state);
    expect(canLaunch(state, def, [crew[0].id], HOME_TERRITORY).ok).toBe(false);

    state.org.cash = 0;
    state.org.dirtyCash = 0;
    const shakedown = OPERATION_BY_ID['fence_goods'];
    expect(canLaunch(state, shakedown, [crew[0].id], HOME_TERRITORY).ok).toBe(false);
  });

  it('keeps success chance inside its clamps under any conditions', () => {
    const state = fresh();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const crew = crewList(state);

    state.org.heat = 100;
    const worst = successBreakdown(state, def, crew, HOME_TERRITORY).total;
    expect(worst).toBeGreaterThanOrEqual(0.05);

    state.org.heat = 0;
    for (const n of crew) {
      n.stats.skill = 100;
      n.stats.discipline = 100;
    }
    state.player.attributes.intimidation = 20;
    const best = successBreakdown(state, def, crew, HOME_TERRITORY).total;
    expect(best).toBeLessThanOrEqual(0.95);
  });

  it('pays out on success and never pays a negative amount', () => {
    const state = fresh();
    const def = OPERATION_BY_ID['corner_shakedown'];
    let payouts = 0;

    for (let i = 0; i < 60; i++) {
      const crew = availableCrew(state);
      if (crew.length > 0 && Object.keys(state.activeOperations).length === 0) {
        launchOperation(state, def.id, [crew[0].id], HOME_TERRITORY);
      }
      advanceDay(state);
    }
    for (const result of state.operationHistory) {
      expect(result.payout).toBeGreaterThanOrEqual(0);
      if (result.success) payouts += 1;
    }
    expect(payouts).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ heat ---

describe('heat', () => {
  it('stays within 0..100 no matter what is thrown at it', () => {
    const state = fresh();
    for (let i = 0; i < 50; i++) addHeat(state, 40, 'street', 'test');
    expect(state.org.heat).toBeLessThanOrEqual(100);
    expect(state.org.heat).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < 400; i++) {
      state.day += 1;
      tickHeat(state);
    }
    expect(state.org.heat).toBeGreaterThanOrEqual(0);
  });

  it('does not decay until there have been quiet days', () => {
    const state = fresh();
    addHeat(state, 30, 'street', 'test');
    const after = state.org.heat;
    state.day += 1;
    tickHeat(state); // first quiet day — still no decay
    expect(state.org.heat).toBe(after);
  });

  it('bleeds off much more slowly at high heat than at low heat', () => {
    const low = fresh();
    addHeat(low, 15, 'street', 'test');
    const high = fresh();
    addHeat(high, 95, 'street', 'test');

    for (const s of [low, high]) {
      for (let i = 0; i < 10; i++) {
        s.day += 1;
        tickHeat(s);
      }
    }
    const lowDrop = 15 - low.org.heat;
    const highDrop = 95 - high.org.heat;
    expect(lowDrop).toBeGreaterThan(highDrop);
  });
});

// ----------------------------------------------------------- loyalty ------

describe('loyalty drift', () => {
  it('erodes loyalty for a greedy, underpaid, aggrieved man', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    const npc = crewList(state)[0];
    npc.stats.loyalty = 70;
    npc.stats.greed = 95;
    npc.stats.grievance = 60;
    npc.wage = 10;
    state.player.attributes.leadership = 0;

    driftNpcs(state, rng);
    expect(npc.stats.loyalty).toBeLessThan(70);
  });

  it('holds loyalty for a well paid man with nothing against you', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    const npc = crewList(state)[0];
    npc.stats.loyalty = 50;
    npc.stats.greed = 10;
    npc.stats.grievance = 0;
    npc.stats.ambition = 10;
    npc.wage = 5_000;

    driftNpcs(state, rng);
    expect(npc.stats.loyalty).toBeGreaterThan(50);
  });

  it('lets a promotion buy real loyalty', () => {
    const state = fresh();
    const npc = crewList(state)[0];
    const before = npc.stats.loyalty;
    promote(state, npc.id);
    expect(npc.stats.loyalty).toBeGreaterThan(before);
    expect(npc.role).toBe('soldier');
  });

  it('never lets a stat leave 0..100', () => {
    const state = fresh();
    const rng = new Rng(state.rng);
    const npc = crewList(state)[0];
    npc.stats.loyalty = 1;
    npc.stats.grievance = 100;
    npc.wage = 1;

    for (let i = 0; i < 100; i++) {
      state.day += 7;
      driftNpcs(state, rng);
      for (const value of Object.values(npc.stats)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ------------------------------------------------------------------ save ---

describe('save/load', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    // vitest runs in node — provide the minimum localStorage the save layer uses.
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it('round-trips a mid-game state exactly', () => {
    const state = fresh(777);
    advanceDays(state, 60);

    expect(saveGame(state, '1').ok).toBe(true);
    const loaded = loadGame('1');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(JSON.stringify(loaded.state)).toEqual(JSON.stringify(state));
  });

  it('continues the same random stream after a reload', () => {
    const original = fresh(31337);
    advanceDays(original, 25);
    saveGame(original, '2');

    const loaded = loadGame('2');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    advanceDays(original, 30);
    advanceDays(loaded.state, 30);
    expect(JSON.stringify(loaded.state)).toEqual(JSON.stringify(original));
  });

  it('refuses a save from an incompatible version', () => {
    const state = fresh();
    saveGame(state, '3');
    const raw = JSON.parse(localStorage.getItem('mafia:save:3')!);
    raw.state.version = 999;
    localStorage.setItem('mafia:save:3', JSON.stringify(raw));

    const result = loadGame('3');
    expect(result.ok).toBe(false);
  });

  it('refuses a corrupted save rather than loading half a game', () => {
    localStorage.setItem('mafia:save:1', '{not json');
    expect(loadGame('1').ok).toBe(false);
  });
});

// ------------------------------------------------------------------ soak ---

describe('soak', () => {
  it('survives a year of scripted play without corrupting state', () => {
    const state = fresh(2024);
    const rng = new Rng(state.rng);

    for (let day = 0; day < 365; day++) {
      clearEvents(state, rng);

      // Recruit when there is room and money.
      const recruitIds = Object.keys(state.recruits);
      if (recruitIds.length && totalFunds(state) > 5_000) {
        recruit(state, recruitIds[0]);
      }

      // Take the best job the available crew can staff.
      if (Object.keys(state.activeOperations).length === 0) {
        const free = availableCrew(state);
        const options = availableOperations(state)
          .filter((o) => o.crewRequired <= free.length && o.investment <= totalFunds(state))
          .sort((a, b) => b.payout[1] - a.payout[1]);
        if (options.length) {
          const def = options[0];
          // Rotate through everywhere reachable, so the soak exercises
          // unfamiliar districts and influence growth too.
          const districts = operableTerritories(state);
          const where = districts[day % districts.length].territory.id;
          launchOperation(
            state,
            def.id,
            free.slice(0, def.crewRequired).map((n) => n.id),
            where,
          );
        }
      }

      advanceDay(state);

      // --- invariants -----------------------------------------------------
      expect(Number.isFinite(state.org.cash)).toBe(true);
      expect(Number.isFinite(state.org.dirtyCash)).toBe(true);
      expect(state.org.cash).toBeGreaterThanOrEqual(0);
      expect(state.org.dirtyCash).toBeGreaterThanOrEqual(0);
      expect(state.org.heat).toBeGreaterThanOrEqual(0);
      expect(state.org.heat).toBeLessThanOrEqual(100);
      expect(state.org.respect).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(state.org.respect)).toBe(true);

      for (const op of Object.values(state.activeOperations)) {
        // No operation may reference someone who does not exist.
        for (const id of op.crewIds) expect(state.npcs[id]).toBeDefined();
        // Nor outlive its end day.
        expect(op.endDay).toBeGreaterThanOrEqual(state.day);
      }

      for (const npc of Object.values(state.npcs)) {
        for (const [key, value] of Object.entries(npc.stats)) {
          expect(Number.isFinite(value), `${npc.name}.${key}`).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
        expect(npc.wage).toBeGreaterThanOrEqual(0);
        // A busy NPC must actually be on an operation.
        if (npc.status === 'busy') {
          const onJob = Object.values(state.activeOperations).some((o) =>
            o.crewIds.includes(npc.id),
          );
          expect(onJob, `${npc.name} is busy with no operation`).toBe(true);
        }
      }

      if (state.gameOver) break;
    }

    // A year of taking the biggest available job should have produced a real game.
    expect(state.operationHistory.length).toBeGreaterThan(20);
    expect(state.log.length).toBeGreaterThan(20);
  });

  it('reaches a losing state when the player does nothing at all', () => {
    const state = fresh(5150);
    /*
     * Doing nothing means taking no actions, not refusing to answer the phone.
     *
     * This used to call `advanceDays` and trust it to run the full 400 days,
     * which it never promised to do — it stops the moment something needs the
     * player, so the test was really measuring "how long until the first memo"
     * and passed only because that happened to be after a payday. It now
     * discards each memo unanswered and keeps going, which isolates the thing
     * being tested: wages with no income empty the accounts.
     */
    for (let i = 0; i < 400; i++) {
      state.pendingEvents.length = 0;
      advanceDay(state);
      if (state.gameOver) break;
    }
    expect(state.day).toBeGreaterThan(1);
    expect(totalFunds(state)).toBeLessThan(2_500);
  });
});
