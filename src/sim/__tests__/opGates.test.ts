/**
 * What opens a job, now that rank does not.
 *
 * The rank ladder used to decide this: `rankIndex(def.minRank) <= board.rank`,
 * with `opens` as a second way in for six of the twenty-three jobs. That was
 * incoherent once the player became the boss from the first morning — the
 * screen said so and the table still asked them to climb from Street Criminal,
 * silently, with no label left to explain the refusal. Measured: the five jobs
 * above Capo were shut on 100% of 3,600 days, and of 36 careers 31 were held
 * back by one number, the clean-money line inside the rank requirements.
 *
 * So every job opens on the board now: ground held, fronts running, people on
 * the payroll, work already done, and who in the city owes you. Each carries
 * the sentence the locked row shows, because a gate the player cannot read is
 * the failure this replaced.
 */

import { describe, expect, it } from 'vitest';

import { OPERATIONS } from '../../config/operations';
import type { OpsBoard } from '../types';

/** A board with nothing on it — the first morning. */
const EMPTY: OpsBoard = {
  districtsHeld: 0,
  districtsControlled: 0,
  fronts: 0,
  crew: 0,
  opsBy: {},
  favoursOwed: {},
  owedTotal: 0,
  owedFigures: 0,
  bestRivalTrust: -100,
};

/** A board with everything on it — a career that did all of it. */
const FULL: OpsBoard = {
  districtsHeld: 9,
  districtsControlled: 9,
  fronts: 20,
  crew: 30,
  opsBy: Object.fromEntries(OPERATIONS.map((o) => [o.id, 50])),
  favoursOwed: { captain: 2, union: 2, judge: 2, alderman: 2 },
  owedTotal: 8,
  owedFigures: 4,
  bestRivalTrust: 100,
};

describe('the job table opens on the board, not on rank', () => {
  it('no job carries a rank requirement any more', () => {
    for (const o of OPERATIONS) {
      expect(
        (o as { minRank?: unknown }).minRank,
        `${o.name} still has a minRank`,
      ).toBeUndefined();
    }
  });

  it('every gated job says what it needs in words', () => {
    for (const o of OPERATIONS) {
      if (!o.opens) continue;
      expect(o.opens.need, `${o.name} has a gate with no sentence`).toBeTruthy();
      expect(o.opens.need.length, `${o.name}'s need reads like a label, not a sentence`).toBeGreaterThan(12);
      expect(o.opens.need[0], `${o.name}'s need should not start capitalised — it is read inline`)
        .toBe(o.opens.need[0].toLowerCase());
    }
  });

  it('something is open on the first morning, and it is free', () => {
    const open = OPERATIONS.filter((o) => !o.opens || o.opens.met(EMPTY));
    expect(open.length, 'nothing at all is open on day one').toBeGreaterThan(0);
    expect(
      open.some((o) => o.investment === 0 && o.crewRequired === 0),
      'the job that needs nobody and costs nothing is not open on day one',
    ).toBe(true);
  });

  it('every job is reachable — no gate is unsatisfiable', () => {
    for (const o of OPERATIONS) {
      if (!o.opens) continue;
      expect(o.opens.met(FULL), `${o.name} stays shut on a board holding everything`).toBe(true);
    }
  });

  /*
     The dead-gate check, which is the one that found a real defect.

     Three gates read a count of another job: `backroom_game` wanted four
     protection rackets, `union_local` three, `warehouse_job` three truck
     hijackings. Measured over 24 careers, protection_racket ran **zero** times
     and truck_hijack ran in 5 of 24 — because neither is ever the best money
     per crew-day, so a competent player never picks them. A gate standing on a
     job nobody has a reason to run is a gate that never opens.

     So a job may still ask about work already done, but only about work the
     table gives a reason to do: a prerequisite must be open on an empty board,
     or itself gated on state rather than on yet another job count. One link,
     never a chain.
  */
  it('no gate depends on a job that is itself gated on another job', () => {
    const byId = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));
    for (const o of OPERATIONS) {
      if (!o.opens) continue;
      // Which job ids does this gate read? Found by feeding it a board where
      // exactly one job has been run a great many times.
      for (const other of OPERATIONS) {
        const probe: OpsBoard = { ...FULL, opsBy: { [other.id]: 50 } };
        const without: OpsBoard = { ...FULL, opsBy: {} };
        if (o.opens.met(probe) === o.opens.met(without)) continue;
        // `o` depends on `other` having been run. `other` must not itself be
        // gated on a job count.
        const dep = byId[other.id];
        if (!dep?.opens) continue;
        const depOnJobs = OPERATIONS.some((third) => {
          const a: OpsBoard = { ...FULL, opsBy: { [third.id]: 50 } };
          const b: OpsBoard = { ...FULL, opsBy: {} };
          return dep.opens!.met(a) !== dep.opens!.met(b);
        });
        expect(
          depOnJobs,
          `${o.name} needs ${dep.name}, which is itself gated on running something else`,
        ).toBe(false);
      }
    }
  });
});
