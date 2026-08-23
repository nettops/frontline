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
describe('the behavioural routes', () => {
  /*
     Two kinds of `opens` route now, and they answer different questions.

     The behavioural ones are a way past a **rank** the player cannot afford
     yet — do the work, skip the promotion. The connected ones are a way past
     rank entirely: they sit at `crime_lord` and open on who you know, so the
     board differs between two bosses on the same rung. Splitting them keeps
     the coverage assertion below meaningful; lumped together it would have
     been satisfied by any ten jobs with a clause on them.
  */
  const BEHAVIOURAL = OPERATIONS.filter((o) => o.opens && o.minRank === 'crew_leader');
  const CONNECTED = OPERATIONS.filter((o) => o.opens && o.minRank === 'crime_lord');

  const ZERO: OpsBoard = {
    rank: 0,
    districtsHeld: 0,
    fronts: 0,
    crew: 0,
    opsBy: {},
    favoursOwed: {},
    bestRivalTrust: -100,
  };
  const MINIMAL: Record<string, OpsBoard> = {
    backroom_game: { ...ZERO, districtsHeld: 1, opsBy: { protection_racket: 4 } },
    counterfeit_run: { ...ZERO, fronts: 1, opsBy: { fence_goods: 5 } },
    warehouse_job: { ...ZERO, fronts: 1, opsBy: { truck_hijack: 3 } },
    debt_collection: { ...ZERO, crew: 4, opsBy: { freelance_muscle: 6 } },
    union_local: { ...ZERO, districtsHeld: 2, opsBy: { protection_racket: 3 } },
    rent_the_crew: { ...ZERO, crew: 6, opsBy: { freelance_muscle: 4 } },

    // The connected four. Each is one relationship and nothing else, which is
    // the claim `connections.test.ts` makes and this file re-checks from the
    // config side.
    fix_a_case: { ...ZERO, favoursOwed: { judge: 1 } },
    union_walkout: { ...ZERO, favoursOwed: { union: 1 } },
    police_escort: { ...ZERO, favoursOwed: { captain: 1 } },
    joint_venture: { ...ZERO, bestRivalTrust: 60 },
  };

  const ROUTED = [...BEHAVIOURAL, ...CONNECTED];

  function boardSatisfying(op: (typeof OPERATIONS)[number]): OpsBoard {
    const board = MINIMAL[op.id];
    // Throws rather than skips: this is what fails loudly when somebody adds a
    // seventh route and forgets to describe it here, instead of quietly
    // testing six things and reporting green.
    if (!board) throw new Error(`no minimal board written for ${op.id}`);
    return board;
  }

  it('covers every crew_leader job and nothing else', () => {
    const gated = OPERATIONS.filter((o) => o.minRank === 'crew_leader');
    expect(gated.length).toBe(6);
    expect(BEHAVIOURAL.map((o) => o.id).sort()).toEqual(gated.map((o) => o.id).sort());
  });

  it('accounts for every routed job, of either kind', () => {
    // The loud failure this file is built around: a new route with no minimal
    // board written for it throws rather than being silently untested.
    const withClause = OPERATIONS.filter((o) => o.opens).map((o) => o.id).sort();
    expect(ROUTED.map((o) => o.id).sort()).toEqual(withClause);
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

  it('does not open the whole tier at once', () => {
    /*
       The failure this exists for: a condition generic enough to be satisfied
       by ordinary play opens all six in the same week, which is the cash wall
       replaced by a slightly later cash wall. Each condition has to be
       specific enough that a board satisfying one leaves most of the others
       shut.
    */
    for (const op of ROUTED) {
      const board = boardSatisfying(op);
      const alsoOpen = BEHAVIOURAL.filter((o) => o.id !== op.id && o.opens!.met(board));
      expect(
        alsoOpen.length,
        `${op.id}'s condition also opens ${alsoOpen.map((o) => o.id).join(', ')}`,
      ).toBeLessThan(3);
    }
  });
});
