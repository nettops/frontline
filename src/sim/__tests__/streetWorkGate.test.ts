/**
 * Retiring street jobs to district delegation.
 *
 * `work_it_yourself`, `corner_shakedown`, `boost_cars`, `burglary_run` and
 * `freelance_muscle` are the jobs a boss personally runs on a corner. Once the
 * organization has grown a layer between him and the street — a district
 * somebody else already answers for, or Crew Leader itself — the board should
 * stop offering them, the same way a boss stops being expected to drive the
 * getaway car.
 *
 * The one thing that must not happen: hiding them from somebody who still
 * needs them. `work_it_yourself` exists specifically so "what can I do this
 * week" is never nothing (see its own doc comment in `config/operations.ts`),
 * so the gate backs off the moment there is nowhere else to turn — no
 * district held at all, or nothing else on the board is affordable.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import {
  availableOperations,
  manualBoard,
  operationCost,
  outgrewStreetWork,
} from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { putInCharge } from '../delegation';
import { livePitches, tickCapoPitches } from '../capoPitches';
import { CAPO_PITCH } from '../../config/capoPitches';
import { Rng } from '../rng';
import { crewList } from '../npc';
import { territoryList } from '../territory';
import type { GameState } from '../types';

const STREET_IDS = [
  'work_it_yourself',
  'corner_shakedown',
  'boost_cars',
  'burglary_run',
  'freelance_muscle',
];

function game(seed = 7): GameState {
  return newGame({ name: 'Corner', difficulty: 'normal', seed });
}

/** Same shape as `rank.test.ts`'s builder — reaches through to what `opsBoard` reads. */
function build(state: GameState, districts: number, fronts: number, crew: number): void {
  const ts = territoryList(state);
  for (let i = 0; i < districts && i < ts.length; i++) {
    ts[i].influence = { ...ts[i].influence, player: 95 };
  }
  state.businesses = {};
  for (let i = 0; i < fronts; i++) {
    state.businesses[`b${i}`] = {
      id: `b${i}`,
      defId: 'laundromat',
      territoryId: ts[0].id,
      purchasedDay: 1,
      exposure: 0,
      revenueTotal: 0,
      launderedTotal: 0,
      lastLaundered: 0,
      health: 100,
      status: 'operating',
    } as unknown as (typeof state.businesses)[string];
  }
  const have = crewList(state);
  const src = have[0];
  for (let i = have.length; i < crew; i++) {
    state.npcs[`n${i}`] = { ...src, id: `n${i}`, name: `Hand ${i}`, status: 'active' };
  }
}

/**
 * A week of capo pitches, so there is something on the board to live off.
 *
 * Round 30's MUST FIX 3: the gate used to open the moment *any* higher-tier job
 * was open and affordable, though a Crew Leader cannot pick those from the
 * table — they reach him as pitches, weekly. A boss newly promoted, or between
 * refreshes, had street work taken away and nothing put in its place. The gate
 * now needs a pitch he could actually take today.
 */
function pitched(state: GameState): void {
  state.day = CAPO_PITCH.refreshIntervalDays;
  tickCapoPitches(state, new Rng(state.rng));
  expect(livePitches(state).length, 'the setup produced no pitch').toBeGreaterThan(0);
}

describe('street work, once the organization has outgrown it', () => {
  it('is on the board on the first morning', () => {
    const state = game();
    build(state, 0, 0, 3); // freelance_muscle wants three on the payroll
    expect(outgrewStreetWork(state)).toBe(false);
    const ids = manualBoard(state).map((o) => o.id);
    for (const id of STREET_IDS) expect(ids).toContain(id);
  });

  it('comes off the board at Crew Leader', () => {
    const state = game();
    build(state, 1, 2, 6); // Crew Leader's own needs, from config/economy.ts
    state.org.cash = 500_000;
    pitched(state);
    expect(outgrewStreetWork(state)).toBe(true);
    const ids = manualBoard(state).map((o) => o.id);
    for (const id of STREET_IDS) expect(ids).not.toContain(id);
  });

  it('stays on the board at Crew Leader until a pitch has actually come in', () => {
    // MUST FIX 3. Crew Leader, money, bodies, an open job — and no pitch yet,
    // because they arrive weekly. The table is the only work there is.
    const state = game();
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    expect(outgrewStreetWork(state)).toBe(false);
    const ids = manualBoard(state).map((o) => o.id);
    for (const id of STREET_IDS) expect(ids).toContain(id);
  });

  it('goes back on the board when every pitch is out of reach', () => {
    const state = game();
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    pitched(state);
    expect(outgrewStreetWork(state)).toBe(true);
    // Keep only what costs money, and leave him a dollar short of the cheapest.
    const price = (p: (typeof state.capoPitches & object)[number]) =>
      operationCost(state, OPERATION_BY_ID[p.defId]);
    const dear = livePitches(state).filter((p) => price(p) > 0);
    expect(dear.length, 'the setup pitched nothing that costs money').toBeGreaterThan(0);
    for (const p of livePitches(state)) if (!dear.includes(p)) p.status = 'expired';
    state.org.cash = Math.min(...dear.map(price)) - 1;
    state.org.dirtyCash = 0;
    expect(outgrewStreetWork(state)).toBe(false);
    expect(manualBoard(state).map((o) => o.id)).toContain('work_it_yourself');
  });

  it('stays off the board for a broke boss while a free job is being pitched', () => {
    // A free pitch is something he can take today, so the table is not the only
    // thing on the page. This is what keeps the rule from being "broke means
    // corners", which the poverty exemption for hands-on work already covers.
    const state = game();
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    pitched(state);
    const free = livePitches(state).filter(
      (p) => operationCost(state, OPERATION_BY_ID[p.defId]) === 0,
    );
    expect(free.length, 'the setup pitched nothing free').toBeGreaterThan(0);
    for (const p of livePitches(state)) if (!free.includes(p)) p.status = 'expired';
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    expect(outgrewStreetWork(state)).toBe(true);
  });

  it('goes back on the board when the pitches lapse', () => {
    const state = game();
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    pitched(state);
    expect(outgrewStreetWork(state)).toBe(true);
    for (const p of state.capoPitches ?? []) p.status = 'expired';
    expect(outgrewStreetWork(state)).toBe(false);
    expect(manualBoard(state).map((o) => o.id)).toContain('work_it_yourself');
  });

  it('comes off the board the moment any district has a steward, rank or not', () => {
    const state = game();
    build(state, 1, 0, 6);
    state.org.cash = 500_000;
    pitched(state);
    const t = territoryList(state)[0];
    const steward = crewList(state)[0];
    // A soldier or better, per `DELEGATION.minRoleIndex` — the career starts with an associate.
    steward.role = 'soldier';
    putInCharge(state, steward.id, t.id);
    expect(t.stewardId).toBe(steward.id);
    const ids = manualBoard(state).map((o) => o.id);
    for (const id of STREET_IDS) expect(ids).not.toContain(id);
  });

  it('never disappears from a career holding no ground at all', () => {
    const state = game();
    // Reach Crew Leader on paper, then lose the ground under it without going
    // through `takeItBack` — the decay path a district can actually take.
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    pitched(state);
    expect(outgrewStreetWork(state)).toBe(true);
    for (const t of territoryList(state)) t.influence = { ...t.influence, player: 0 };
    expect(outgrewStreetWork(state)).toBe(false);
    const ids = manualBoard(state).map((o) => o.id);
    for (const id of STREET_IDS) expect(ids).toContain(id);
  });

  it('never disappears from a career that cannot afford anything else', () => {
    // A steward triggers the gate (see the test above), but with one district,
    // no fronts and no spare crew, nothing at Enforcer tier is actually open —
    // `rent_the_crew`, the one free job at that tier, wants six on the payroll
    // and this career has one. With no money either, there is nowhere to turn
    // but the street.
    const state = game();
    const t = territoryList(state)[0];
    t.influence = { ...t.influence, player: 50 };
    const steward = crewList(state)[0];
    steward.role = 'soldier';
    putInCharge(state, steward.id, t.id);
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    expect(outgrewStreetWork(state)).toBe(false);
    // The gate is off: the manual board is the whole open list, untouched.
    expect(manualBoard(state).map((o) => o.id)).toEqual(
      availableOperations(state).map((o) => o.id),
    );
  });

  it('never disappears from a career with no free bodies to send, even with cash', () => {
    // MUST FIX 2(b): A boss with cash who has all crew in custody or busy cannot
    // staff any tier > 0 job (all need 1+ bodies). Hiding street work in that
    // state takes the whole game away.
    const state = game();
    build(state, 1, 2, 6);
    state.org.cash = 500_000;
    pitched(state);
    // Before crew is put in custody, the gate is on
    expect(outgrewStreetWork(state)).toBe(true);

    // All crew are arrested/in custody
    for (const n of crewList(state)) {
      n.status = 'arrested';
    }
    expect(outgrewStreetWork(state)).toBe(false);
    const ids = manualBoard(state).map((o) => o.id);
    expect(ids).toContain('work_it_yourself');
  });
});

