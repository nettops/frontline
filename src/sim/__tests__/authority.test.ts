/**
 * Whether the family still does what it is told.
 *
 * The design note is in `config/authority.ts`. The risk it names is the one
 * this file exists to close: an eleventh number on a panel that changes
 * nothing is the "meaningless statistic" the brief bans, and a test that only
 * reads the number back would pass on exactly that.
 *
 * So the load-bearing test here is **behavioural**. A family whose boss has no
 * authority must visibly stop obeying — measured as stewards helping
 * themselves to districts they were handed — and it must do so for reasons the
 * player can see and change.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { authority, authorityRead } from '../authority';
import { putInCharge, tickDelegation } from '../delegation';
import { crewList, generateNpc } from '../npc';
import { remember } from '../memory';
import { DELEGATION } from '../../config/delegation';
import { territoryList } from '../territory';
import type { GameState, Npc } from '../types';

function game(seed = 11): GameState {
  const state = newGame({ name: 'Chair', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  for (let i = 0; i < 6; i++) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  for (const t of territoryList(state)) t.influence.player = 60;
  return state;
}

function crew(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status !== 'dead');
}

describe('the reading', () => {
  /*
     The instrument. A number pinned at one value across wildly different
     organizations is not reading them, and would pass most of what follows.
  */
  it('separates a family that is run from one that is not', () => {
    const good = game();
    for (const n of crew(good)) {
      n.stats.respectForBoss = 90;
      n.stats.grievance = 0;
    }
    good.org.fear = 40;

    const bad = game();
    for (const n of crew(bad)) {
      n.stats.respectForBoss = 10;
      n.stats.grievance = 85;
    }
    bad.org.fear = 0;
    bad.org.wagesOwed = 100_000;

    expect(authority(good)).toBeGreaterThan(authority(bad) + 25);
    expect(authority(good)).toBeLessThanOrEqual(100);
    expect(authority(bad)).toBeGreaterThanOrEqual(0);
  });

  it('reads a boss with nobody under them as neither obeyed nor defied', () => {
    const alone = newGame({ name: 'Alone', difficulty: 'normal', seed: 2 });
    for (const n of crewList(alone)) n.status = 'defected';
    expect(authority(alone)).toBe(50);
  });

  /*
     Each of the four terms has to be able to move it on its own, or the ones
     that cannot are decoration inside a reading that claims four sources.
  */
  it('moves on each of the four things it claims to read', () => {
    const base = () => {
      const s = game();
      for (const n of crew(s)) {
        n.stats.respectForBoss = 50;
        n.stats.grievance = 20;
      }
      s.org.fear = 30;
      return s;
    };

    const respect = base();
    for (const n of crew(respect)) n.stats.respectForBoss = 95;
    expect(authority(respect), 'being rated changed nothing').toBeGreaterThan(authority(base()));

    const feared = base();
    feared.org.fear = 95;
    expect(authority(feared), 'being feared changed nothing').toBeGreaterThan(authority(base()));

    const sore = base();
    for (const n of crew(sore)) n.stats.grievance = 95;
    expect(authority(sore), 'a room full of grievances changed nothing').toBeLessThan(
      authority(base()),
    );

    const letDown = base();
    for (const n of crew(letDown)) remember(n, letDown.day, 'word_broken');
    expect(authority(letDown), 'breaking your word changed nothing').toBeLessThan(
      authority(base()),
    );
  });

  it('names what is holding it down, worst first', () => {
    const state = game();
    for (const n of crew(state)) {
      n.stats.respectForBoss = 80;
      n.stats.grievance = 95;
    }
    // Everything else healthy, so the grievance is unambiguously the worst of
    // the four. The first version left fear at its starting zero and the read
    // correctly named that instead.
    state.org.fear = 80;
    for (const n of crew(state)) remember(n, state.day, 'word_kept');
    const read = authorityRead(state);
    expect(read.because.length).toBe(4);
    expect(read.because[0].value).toBeLessThanOrEqual(read.because[3].value);
    expect(read.because[0].term).toMatch(/carrying/i);
    expect(read.label.length).toBeGreaterThan(0);
  });

  /*
     Same rule as `legitimacy` and `readWhispers`. A thing that only describes
     the world must not be able to change what happens in it.
  */
  it('costs the random stream nothing', () => {
    const state = game();
    const before = state.rng.calls;
    authority(state);
    authorityRead(state);
    expect(state.rng.calls).toBe(before);
  });
});

/*
   And the half that decides whether any of the above was worth building.

   Two organizations, identical apart from how they have been run, each handed
   the same districts to the same kind of man. The one whose boss has no
   authority must actually lose money to its own stewards.
*/
describe('what it changes', () => {
  function held(seed: number, obeyed: boolean): { skimmed: number; weeks: number } {
    const state = game(seed);
    for (const n of crew(state)) {
      n.stats.respectForBoss = obeyed ? 90 : 8;
      n.stats.grievance = obeyed ? 0 : 80;
      // The steward himself is the same man in both worlds — greedy enough to
      // be tempted, so the difference measured is the boss and not the hire.
      n.stats.greed = 70;
      n.stats.loyalty = 45;
      n.stats.discipline = 50;
    }
    state.org.fear = obeyed ? 45 : 0;
    state.org.wagesOwed = obeyed ? 0 : 60_000;

    const districts = territoryList(state);
    const hands = crew(state);
    for (let i = 0; i < Math.min(3, hands.length, districts.length); i++) {
      putInCharge(state, hands[i].id, districts[i].id);
    }

    const rng = new Rng(state.rng);
    let weeks = 0;
    for (let i = 0; i < 40; i++) {
      // The tick is gated on the calendar, and stepping the clock by the
      // interval from a day-1 start never lands on a multiple of it. Four
      // separate systems in this project have been measured at zero because of
      // exactly that.
      state.day = (Math.floor(state.day / DELEGATION.intervalDays) + 1) * DELEGATION.intervalDays;
      tickDelegation(state, rng);
      weeks += 1;
    }

    return {
      skimmed: crew(state).reduce((sum, n) => sum + n.skimTotal, 0),
      weeks,
    };
  }

  it('actually ran the weekly tick', () => {
    // The instrument, because everything below is a difference of two sums and
    // zero against zero is a very confident way of measuring nothing.
    const run = held(5, false);
    expect(run.weeks).toBe(40);
    expect(run.skimmed, 'forty weeks of a family that despises you took nothing').toBeGreaterThan(0);
  });

  it('loses a boss with no authority money out of their own districts', () => {
    let obeyedTotal = 0;
    let defiedTotal = 0;
    for (const seed of [5, 6, 7, 8, 9, 10]) {
      obeyedTotal += held(seed, true).skimmed;
      defiedTotal += held(seed, false).skimmed;
    }

    // eslint-disable-next-line no-console
    console.log(
      `authority: six worlds, forty weeks, three districts each\n` +
        `           skimmed under a boss who is obeyed: ${Math.round(obeyedTotal).toLocaleString('en-US')}\n` +
        `           ...and under one who is not:        ${Math.round(defiedTotal).toLocaleString('en-US')}`,
    );

    expect(
      defiedTotal,
      'authority is a number on a screen — the stewards behave identically either way',
    ).toBeGreaterThan(obeyedTotal);
  });
});
