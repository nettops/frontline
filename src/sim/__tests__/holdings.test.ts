/**
 * What a district is actually for.
 *
 * Every one of the twelve was mechanically the same object — some business
 * slots and a discount on heat — differing only in how much a job pays and how
 * loud it is. Meanwhile every blurb in `territories.ts` has been saying what
 * the place is for since the day it was written, and nothing read them.
 *
 * Two properties this file exists to hold:
 *
 * 1. **A yield needs somebody standing in it.** Ground held with nobody
 *    running it keeps its influence and gives you nothing. That is what makes
 *    holding the whole map impractical — not a rule against it, but that every
 *    district you want the *use* of costs a man out of the crew your jobs draw
 *    from.
 *
 * 2. **Two of a kind is worth less than two kinds.** Otherwise the answer is
 *    always "take the two cheapest of your favourite yield" and the map stops
 *    being a set of choices.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { holdingShare, workingHoldings, yieldOf, yieldsHeld } from '../holdings';
import { eligibleStewards, putInCharge } from '../delegation';
import { DISTRICT_YIELD, HOLDING } from '../../config/holdings';
import type { GameState } from '../types';

function game(seed = 11): GameState {
  const state = newGame({ name: 'Ground', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 12) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  state.org.dirtyCash = 400_000;
  return state;
}

/** Ground held outright, which is what a yield needs before anything else. */
function hold(state: GameState, id: string): void {
  state.territories[id].influence.player = 80;
}

/*
   Somebody senior enough to be given a district.

   `eligibleStewards` rather than "the first active man" — the first crew
   member a new game hands you is an associate, and `DELEGATION.minRoleIndex`
   refuses those. The first version of this helper picked that man every time
   and quietly appointed nobody, which read as the yield being broken.
*/
function staff(state: GameState, id: string): void {
  const free = eligibleStewards(state).find(
    (n) => !Object.values(state.territories).some((t) => t.stewardId === n.id),
  );
  expect(free, `nobody senior enough was free for ${id}`).toBeTruthy();
  const done = putInCharge(state, free!.id, id);
  expect(done.ok, `${id}: ${done.message}`).toBe(true);
}

describe('what a district is for', () => {
  it('says what each of the twelve gives, off its own blurb', () => {
    for (const id of Object.keys(DISTRICT_YIELD)) {
      expect(yieldOf(id), `${id} has no yield`).toBeTruthy();
    }
    // Six kinds, each appearing twice, so no yield is locked behind one place.
    const kinds = Object.values(DISTRICT_YIELD);
    for (const kind of new Set(kinds)) {
      expect(kinds.filter((k) => k === kind), `${kind} is not on two districts`).toHaveLength(2);
    }
  });

  it('gives nothing at all to a family that holds nothing', () => {
    const state = game();
    expect(yieldsHeld(state)).toHaveLength(0);
    expect(holdingShare(state, 'labour')).toBe(0);
  });

  /* The property. Ground is not the same thing as the use of ground. */
  it('gives nothing for ground with nobody standing in it', () => {
    const state = game();
    hold(state, 'northside');
    expect(yieldsHeld(state), 'held ground paid out with nobody running it').toHaveLength(0);
    expect(holdingShare(state, 'labour')).toBe(0);
  });

  it('pays once somebody is running it', () => {
    const state = game();
    hold(state, 'northside');
    staff(state, 'northside');

    expect(yieldsHeld(state)).toContain('labour');
    expect(holdingShare(state, 'labour')).toBeCloseTo(HOLDING.share, 5);
  });

  it('pays nothing for a yield you do not hold', () => {
    const state = game();
    hold(state, 'northside');
    staff(state, 'northside');
    expect(holdingShare(state, 'trade')).toBe(0);
  });

  /*
     Two of a kind is worth less than two kinds, or the map is not a choice.
  */
  it('is worth less the second time you take the same thing', () => {
    const both = game();
    for (const id of ['northside', 'little_sicily']) {
      hold(both, id);
      staff(both, id);
    }
    const doubled = holdingShare(both, 'labour');

    expect(doubled).toBeGreaterThan(HOLDING.share);
    expect(
      doubled,
      'a second district of the same kind paid the same as the first',
    ).toBeLessThan(HOLDING.share * 2);
  });

  it('pays both when you take two different things', () => {
    const state = game();
    hold(state, 'northside');
    staff(state, 'northside');
    hold(state, 'the_docks');
    staff(state, 'the_docks');

    expect(holdingShare(state, 'labour')).toBeCloseTo(HOLDING.share, 5);
    expect(holdingShare(state, 'trade')).toBeCloseTo(HOLDING.share, 5);
  });

  /*
     And the reason you will not hold the map: every yield is a man.

     Not asserted as a rule — asserted as arithmetic. Twelve districts run at
     once is twelve of your people standing in them, and that number is read
     against the crew a career actually has.
  */
  it('runs out of men before it runs out of districts', () => {
    const state = game();
    const ids = Object.keys(DISTRICT_YIELD);

    // Take the lot, and put somebody in every one you can.
    for (const id of ids) hold(state, id);
    for (const id of ids) {
      const free = eligibleStewards(state).find(
        (n) => !Object.values(state.territories).some((t) => t.stewardId === n.id),
      );
      if (!free) break;
      putInCharge(state, free.id, id);
    }

    const running = workingHoldings(state).length;
    expect(running, 'nobody ended up running anything').toBeGreaterThan(0);
    expect(
      running,
      'a twelve-man crew ran the entire map, so holding everything costs nothing',
    ).toBeLessThan(ids.length);
  });
});
