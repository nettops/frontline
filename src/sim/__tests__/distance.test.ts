/**
 * How far the work is from you.
 *
 * Heat turned out to be the only constraint in this game that binds anything.
 * Over 4320 measured crew-days a career spent 53% of its life too hot to work
 * and 20% laying low, against 0% blocked by money, bodies or ground — and the
 * one lever against it, `HEAT_BY_RANK_GAP`, was indexed on a rank that 24
 * careers out of 24 never reached.
 *
 * These tests hold the repair to its two promises. Nothing about work at your
 * own level or four ranks beneath it may move, because those numbers were
 * balanced against everything else in the table. And an organization must be
 * able to buy quiet with something other than rank, because that is the whole
 * point.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { heatScale } from '../operations';
import { crewList } from '../npc';
import {
  HEAT_BY_RANK_GAP,
  HEAT_DISTANCE,
  OPERATION_BY_ID,
  OPERATIONS,
  heatDistance,
  heatScaleForDistance,
  heatScaleForGap,
} from '../../config/operations';
import { ROLE_ORDER } from '../../config/economy';
import type { GameState, OpsBoard } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Distance', difficulty: 'normal', seed });
}

describe('the table, read at fractional distances', () => {
  it('is unchanged at every whole rank of separation', () => {
    for (let gap = 0; gap < HEAT_BY_RANK_GAP.length + 2; gap++) {
      expect(heatScaleForDistance(gap), `distance ${gap} moved`).toBeCloseTo(
        heatScaleForGap(gap),
        10,
      );
    }
  });

  it('falls smoothly between them rather than in steps', () => {
    /*
       Interpolation is not a detail. Every contributor to distance is
       fractional, so rounding would make four hires out of six worth exactly
       nothing and the fifth worth a whole rank — which is a lottery dressed as
       a decision.
    */
    const a = heatScaleForDistance(1);
    const b = heatScaleForDistance(1.5);
    const c = heatScaleForDistance(2);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(c);
  });

  it('never goes below the quietest the table allows, however large you get', () => {
    const vast = heatDistance({
      rankGap: 6,
      sentSeniority: ROLE_ORDER.length,
      stewarded: true,
      crew: 200,
    });
    expect(heatScaleForDistance(vast)).toBe(HEAT_BY_RANK_GAP[HEAT_BY_RANK_GAP.length - 1]);
  });
});

describe('what buys distance', () => {
  it('gives nothing for doing it yourself', () => {
    // The floor of the whole mechanic: no crew, no organization, no rank gap
    // is a man on a corner doing his own work, and that is full attention.
    expect(heatDistance({ rankGap: 0, sentSeniority: 0, stewarded: false, crew: 0 })).toBe(0);
  });

  it('is bought by seniority, by a steward, and by size', () => {
    const bare = { rankGap: 0, sentSeniority: 0, stewarded: false, crew: 0 };
    expect(heatDistance({ ...bare, sentSeniority: 3 })).toBeGreaterThan(0);
    expect(heatDistance({ ...bare, stewarded: true })).toBeGreaterThan(0);
    expect(heatDistance({ ...bare, crew: 12 })).toBeGreaterThan(0);
  });

  it('caps what an organization can buy without rank', () => {
    /*
       Rank still has to be worth having. Without this an outfit large enough
       reaches the bottom of the table on everything and heat stops existing,
       which replaces one broken extreme with another.
    */
    const huge = heatDistance({
      rankGap: 0,
      sentSeniority: ROLE_ORDER.length,
      stewarded: true,
      crew: 500,
    });
    expect(huge).toBeLessThanOrEqual(HEAT_DISTANCE.maxFromOrganization);
  });
});

describe('through heatScale, as the game calls it', () => {
  it('makes the same job quieter for a bigger outfit', () => {
    const small = game(11);
    const large = game(11);
    for (let i = 0; i < 10; i++) {
      const source = crewList(small)[0];
      large.npcs[`extra-${i}`] = { ...source, id: `extra-${i}`, status: 'active' };
    }

    const def = OPERATION_BY_ID.corner_shakedown;
    expect(heatScale(large, def)).toBeLessThan(heatScale(small, def));
  });

  it('makes it quieter again when you send somebody senior', () => {
    const state = game(12);
    const def = OPERATION_BY_ID.corner_shakedown;
    const [man] = crewList(state);
    man.role = 'lieutenant';

    expect(heatScale(state, def, [man])).toBeLessThan(heatScale(state, def, []));
  });

  it('quotes the job on its own when nobody has been picked yet', () => {
    /*
       The job table is drawn before you have chosen anybody, and it must not
       promise a number that assumes a crew. Whoever you send only ever makes
       it quieter, so the table under-promises.
    */
    const state = game(13);
    const def = OPERATION_BY_ID.corner_shakedown;
    const [man] = crewList(state);
    man.role = 'lieutenant';

    expect(heatScale(state, def)).toBeGreaterThanOrEqual(heatScale(state, def, [man]));
  });
});

/**
 * The second route into the back half of the game.
 *
 * Rank is a clean-money threshold as much as anything. Before the heat work no
 * career in twenty-four reached Crew Leader; after it, eight did — which still
 * leaves two thirds of careers with six jobs and the product trade sealed off
 * for their whole length. These conditions are the other way in, and the thing
 * they must not become is the same wall a fortnight later.
 */
describe('every route onto the board', () => {
  /*
     There is one kind of route now, and every job has one.

     This file used to describe two: **behavioural** routes at Crew Leader,
     which were a way past a rank the player could not afford, and
     **connected** ones at Crime Lord, which were a way past rank entirely.
     Both existed because rank was the real gate and `opens` was the exception
     — six jobs of twenty-three had a clause and the other seventeen opened on
     a title.

     Rank is gone. Every gated job names something on the board, so the split
     has nothing left to separate and the coverage claim below simply covers
     the table. What has not changed is why the file exists: a condition
     generic enough to be met by ordinary play is the clean-money wall again a
     fortnight later, and the last test still says so.
  */
  const ROUTED = OPERATIONS.filter((o) => o.opens);

  const ZERO: OpsBoard = {
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

  /** The least board that opens each job, written by hand from its clause. */
  const MINIMAL: Record<string, OpsBoard> = {
    freelance_muscle: { ...ZERO, crew: 3 },
    fence_goods: { ...ZERO, fronts: 1 },
    truck_hijack: { ...ZERO, districtsHeld: 1 },
    protection_racket: { ...ZERO, districtsHeld: 1 },
    rent_the_crew: { ...ZERO, crew: 6 },
    debt_collection: { ...ZERO, crew: 4, opsBy: { freelance_muscle: 6 } },
    backroom_game: { ...ZERO, districtsHeld: 2, fronts: 1 },
    union_local: { ...ZERO, districtsHeld: 2, owedFigures: 1 },
    counterfeit_run: { ...ZERO, fronts: 2, opsBy: { fence_goods: 5 } },
    warehouse_job: { ...ZERO, fronts: 2, crew: 6 },
    sitdown_fees: { ...ZERO, owedTotal: 2, districtsHeld: 3 },
    underground_club: { ...ZERO, fronts: 4, owedFigures: 2 },
    smuggling_run: { ...ZERO, districtsControlled: 1, fronts: 3 },
    protection_route: { ...ZERO, districtsHeld: 4, fronts: 3 },
    call_in_tribute: { ...ZERO, districtsControlled: 2, crew: 8 },
    financial_scheme: { ...ZERO, districtsControlled: 2, fronts: 6 },
    port_operation: { ...ZERO, districtsControlled: 2, fronts: 6, owedFigures: 2 },
    citywide_network: { ...ZERO, districtsControlled: 5, fronts: 12, owedTotal: 4 },
    enforce_the_peace: { ...ZERO, districtsControlled: 5, bestRivalTrust: 35 },

    // The connected four, commented out of the table. Kept so that turning
    // them back on does not silently arrive untested.
    fix_a_case: { ...ZERO, favoursOwed: { judge: 1 }, owedTotal: 1, owedFigures: 1 },
    union_walkout: { ...ZERO, favoursOwed: { union: 1 }, owedTotal: 1, owedFigures: 1 },
    police_escort: { ...ZERO, favoursOwed: { captain: 1 }, owedTotal: 1, owedFigures: 1 },
    joint_venture: { ...ZERO, bestRivalTrust: 60 },
  };

  function boardSatisfying(op: (typeof OPERATIONS)[number]): OpsBoard {
    const board = MINIMAL[op.id];
    // Throws rather than skips: this is what fails loudly when somebody adds a
    // route and forgets to describe it here, instead of quietly testing the
    // rest and reporting green.
    if (!board) throw new Error(`no minimal board written for ${op.id}`);
    return board;
  }

  it('accounts for every routed job', () => {
    const withClause = OPERATIONS.filter((o) => o.opens).map((o) => o.id).sort();
    expect(ROUTED.map((o) => o.id).sort()).toEqual(withClause);
  });

  it('leaves the street work open, and only the street work', () => {
    /*
       Something has to be doable on the first morning, and it must not be
       much. Everything ungated is tier 0 — the shakedowns and the burglary a
       player opens the game with.
    */
    const free = OPERATIONS.filter((o) => !o.opens);
    expect(free.length, 'nothing at all is open on day one').toBeGreaterThan(0);
    for (const op of free) {
      expect(op.tier, `${op.name} is open from the first morning and is not street work`).toBe(0);
    }
  });

  it('says what it wants in words as well as in code', () => {
    for (const op of ROUTED) {
      expect(op.opens!.need.length, `${op.id} has no readable condition`).toBeGreaterThan(10);
    }
  });

  it('opens on nothing when you have done nothing', () => {
    for (const op of ROUTED) {
      expect(op.opens!.met(ZERO), `${op.id} opens for free`).toBe(false);
    }
  });

  it('each condition is satisfied by the board written for it', () => {
    // Guards the guard below: a MINIMAL entry that does not actually satisfy
    // its own job would make the separation test pass by testing nothing.
    for (const op of ROUTED) {
      expect(op.opens!.met(boardSatisfying(op)), `${op.id}'s own board does not open it`).toBe(
        true,
      );
    }
  });

  it('does not open a whole tier at once', () => {
    /*
       The failure this exists for: a condition generic enough to be satisfied
       by ordinary play opens its whole tier in the same week, which is the
       clean-money wall replaced by a slightly later clean-money wall.

       Judged within a tier rather than across the table, because a board that
       opens a Port Operation *should* also open the smaller work — an outfit
       holding two districts and six fronts has plainly earned the warehouse
       job. What would be wrong is one condition unlocking everything at the
       same level of ambition at once.
    */
    for (const op of ROUTED) {
      const board = boardSatisfying(op);
      const sameTier = ROUTED.filter((o) => o.tier === op.tier && o.id !== op.id);
      const alsoOpen = sameTier.filter((o) => o.opens!.met(board));
      expect(
        alsoOpen.length,
        `${op.id}'s condition also opens ${alsoOpen.map((o) => o.id).join(', ')}`,
      ).toBeLessThan(Math.max(2, sameTier.length));
    }
  });
});
