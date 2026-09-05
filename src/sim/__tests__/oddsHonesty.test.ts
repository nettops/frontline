/**
 * The row labelled "Current heat" must be current heat.
 *
 * Round 11 read the odds panel against the top bar on four days and found the
 * label charging more at *lower* heat: heat 27 cost -8%, heat 11 cost -13%,
 * reproduced 155 days apart. The arithmetic was never wrong — the total is
 * honest — but `heat` folded in `surveillancePenalty`, so the row named one
 * thing and reported two.
 *
 * The cost was real and expensive. That tester bought two fourteen-day lay-lows
 * for roughly $10,500 and 28 idle days specifically to move a number that was
 * only partly the number they were moving. The game's own promise on that panel
 * is "The odds you are shown are the odds you get."
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { EVENT_DEF_BY_ID } from '../events';
import { crewList } from '../npc';
import { successBreakdown, availableOperations } from '../operations';
import { heatSuccessPenalty } from '../heat';
import { availableCrew } from '../npc';
import { operableTerritories } from '../territory';
import type { GameState } from '../types';

function firstJob(state: GameState) {
  const def = availableOperations(state)[0];
  const where = operableTerritories(state)[0].territory.id;
  const crew = availableCrew(state).slice(0, def.crewRequired);
  return successBreakdown(state, def, crew, where);
}

describe('the odds breakdown', () => {
  it('reports heat as heat, and being watched as its own term', () => {
    const state = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    state.org.heat = 40;

    const b = firstJob(state);
    expect(b.heat).toBeCloseTo(-heatSuccessPenalty(state), 6);
    expect(b).toHaveProperty('watched');
  });

  it('still sums to the total it shows', () => {
    const state = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    state.org.heat = 55;

    const b = firstJob(state);
    const sum =
      b.base +
      b.crew +
      b.attribute +
      b.heat +
      b.watched +
      b.territory +
      b.difficulty +
      b.world +
      b.approach;
    // The total clamps, so compare against the unclamped sum only when it is
    // inside the band — otherwise this asserts the clamp rather than the sum.
    if (sum > 0.05 && sum < 0.95) expect(b.total).toBeCloseTo(sum, 6);
  });

  it('never charges more for less heat, even with a case open', () => {
    /*
       The reading round 11 actually took, reproduced.

       A first version of this set the two heat levels and nothing else, and
       passed before the fix — on day one there are no investigations, so
       surveillance was zero on both sides and the defect could not appear. A
       test that cannot reach the bug is not a test of it.
    */
    const low = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    const high = newGame({ name: 'Odds', difficulty: 'normal', seed: 3 });
    low.org.heat = 11;
    high.org.heat = 27;

    // The low-heat family is the one being watched, which is the shape that
    // made the row read backwards.
    low.law.investigations.probe = {
      id: 'probe',
      agencyId: 'city_police',
      stage: 'surveillance',
      stageSince: 1,
      strength: 30,
      status: 'open',
      suspectIds: [],
      evidenceIds: [],
      history: [],
      openedDay: 1,
      lastProgressDay: 1,
      verdict: null,
      verdictDay: null,
    } as unknown as (typeof low.law.investigations)[string];

    expect(firstJob(low).heat).toBeGreaterThanOrEqual(firstJob(high).heat);
  });
});

/*
 * And the one memo that quoted no odds at all.
 *
 * Round 19: *"the choice is 'Take it — $X, roughly even odds' with no
 * description of what the job actually is, who's involved, or what failure
 * costs beyond money. Every other financial decision in the game states its
 * terms; this family of events is the one place a shown-odds number arrives
 * with no picture behind it."*
 *
 * The figures existed the whole time — `0.5 + streetSmarts * 0.012`, that
 * minus `oddsPenalty` for the crew version, and a heat roll already stored on
 * the memo. Nothing was withheld on purpose; it simply was never said. The
 * panel's own promise is that the odds you are shown are the odds you get, and
 * this is the second half of that: a number you are not shown cannot be one.
 */
describe('the short-notice job', () => {
  function memo(state: GameState) {
    const def = EVENT_DEF_BY_ID['opportunity_score'];
    const rng = new Rng(state.rng);
    const ctx = def.applies(state, rng);
    if (!ctx) throw new Error('the memo did not apply, so nothing below was tested');
    const built = def.build(state, rng, ctx);
    const pending = { ...built, id: 'evt_odds', day: state.day };
    state.pendingEvents.push(pending);
    return pending;
  }

  function world(seed: number): GameState {
    const state = newGame({ name: 'Odds', difficulty: 'normal', seed });
    // The memo needs two people to be offered at all.
    const source = crewList(state)[0];
    state.npcs['second'] = { ...source, id: 'second', name: 'Second', status: 'active' };
    state.org.cash = 500_000;
    return state;
  }

  it('states the odds as a number, on both answers', () => {
    const state = world(61);
    const event = memo(state);
    const take = event.choices.find((c: { id: string }) => c.id === 'take')!;
    const send = event.choices.find((c: { id: string }) => c.id === 'send')!;

    expect(take.hint, 'the paid answer still says "roughly"').toMatch(/\d+% it holds/);
    expect(send.hint, 'the crew answer still says "worse odds"').toMatch(/\d+% it holds/);
    expect(take.hint).not.toMatch(/roughly even/i);
  });

  it('states what failure costs, which was never on the screen', () => {
    const state = world(62);
    const event = memo(state);
    const take = event.choices.find((c: { id: string }) => c.id === 'take')!;
    const send = event.choices.find((c: { id: string }) => c.id === 'send')!;

    // Attention is a number the memo already held and never printed.
    expect(take.hint).toMatch(new RegExp(`${event.data.heat} attention`));
    // And the crew answer's real price is a man, not money — which is also
    // why it names a share rather than a figure. `priced.test.ts` reads the
    // largest dollar amount in a hint as what is being asked for, and this
    // answer asks for nobody's money.
    expect(send.hint).toMatch(/hurt for \d+ days/);
    expect(send.hint, 'a free option is quoting dollars').not.toMatch(/\$/);
  });

  it('serves the odds it quoted, however long the memo sat', () => {
    /*
       The reason the figure rides on the memo. Street smarts move while a memo
       waits in the queue, and a screen that quotes one number and rolls
       another is worse than one that quotes nothing.
    */
    const state = world(63);
    const event = memo(state);
    const quoted = event.data.odds as number;

    state.player.attributes.streetSmarts += 30;
    expect(
      (state.pendingEvents.find((e) => e.id === 'evt_odds')!.data.odds as number),
      'the memo re-read the stat instead of holding what it said',
    ).toBe(quoted);
  });
});
