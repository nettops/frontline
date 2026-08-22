/**
 * Districts held by somebody else.
 *
 * The mechanic is a bet on a man you cannot read, so the tests that matter are
 * not about the arithmetic. They are about whether the bet is learnable — over
 * a season, can somebody watching only the record tell an honest steward from
 * a thief — and whether it stays a bet, rather than collapsing into a lookup
 * off the crew sheet.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import {
  averageTake,
  canPutInCharge,
  districtWorth,
  districtsHeldBy,
  eligibleStewards,
  needsSteward,
  putInCharge,
  readLedger,
  takeItBack,
  tickDelegation,
} from '../delegation';
import { addInfluence, playerInfluence, territoryList } from '../territory';
import { refreshRecruits } from '../crew';
import { DELEGATION } from '../../config/delegation';
import { ROLE_ORDER } from '../../config/economy';
import type { GameState, Npc, Territory } from '../types';

function game(seed = 6): GameState {
  return newGame({ name: 'Deleg', difficulty: 'normal', seed });
}

/**
 * Two men, because a career begins with one.
 *
 * Written as a helper that throws rather than as `if (!b) return`, which is how
 * the first draft of this file was written — and it meant two of the tests
 * below, including the one that measures whether the whole mechanic is
 * learnable, silently did nothing and reported green. Third time this session
 * an instrument has passed by not running.
 */
function twoMen(state: GameState): [Npc, Npc] {
  const rng = new Rng(state.rng);
  let guard = 0;
  while (crewList(state).length < 2 && guard++ < 10) {
    refreshRecruits(state, rng, true);
    const id = Object.keys(state.recruits)[0];
    const npc = state.recruits[id];
    delete state.recruits[id];
    npc.status = 'active';
    state.npcs[npc.id] = npc;
  }
  const crew = crewList(state);
  if (crew.length < 2) throw new Error('could not assemble two men to test with');
  return [crew[0], crew[1]];
}

/** A district you actually hold, and a man senior enough to be given it. */
function setup(state: GameState): { t: Territory; npc: Npc } {
  const t = territoryList(state)[0];
  t.influence.player = 55;
  const npc = crewList(state)[0];
  npc.role = ROLE_ORDER[DELEGATION.minRoleIndex];
  npc.status = 'active';
  return { t, npc };
}

describe('putting a man in charge', () => {
  it('will not hand a district to somebody too junior', () => {
    const state = game();
    const { t, npc } = setup(state);
    npc.role = ROLE_ORDER[0];
    expect(canPutInCharge(state, npc.id, t.id).ok).toBe(false);
  });

  it('will not hand him a district you have no standing in', () => {
    const state = game();
    const { t, npc } = setup(state);
    t.influence.player = 0;
    expect(canPutInCharge(state, npc.id, t.id).ok).toBe(false);
  });

  it('gives one man one district', () => {
    const state = game();
    const { t, npc } = setup(state);
    const other = territoryList(state)[1];
    other.influence.player = 40;

    expect(putInCharge(state, npc.id, t.id).ok).toBe(true);
    expect(canPutInCharge(state, npc.id, other.id).ok).toBe(false);
    expect(districtsHeldBy(state, npc.id)).toHaveLength(1);
  });

  it('is worth something to him to be trusted with it', () => {
    const state = game();
    const { t, npc } = setup(state);
    const before = npc.stats.loyalty;
    putInCharge(state, npc.id, t.id);
    expect(npc.stats.loyalty).toBeGreaterThan(before);
  });

  it('costs him something to have it taken away', () => {
    const state = game();
    const { t, npc } = setup(state);
    putInCharge(state, npc.id, t.id);
    const loyalty = npc.stats.loyalty;
    const grievance = npc.stats.grievance;

    takeItBack(state, t.id);
    expect(npc.stats.loyalty).toBeLessThan(loyalty);
    expect(npc.stats.grievance).toBeGreaterThan(grievance);
    expect(t.stewardId ?? null).toBeNull();
  });

  it('takes the district back on its own when he cannot hold it', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const { t, npc } = setup(state);
    putInCharge(state, npc.id, t.id);

    npc.status = 'arrested';
    state.day = DELEGATION.intervalDays;
    tickDelegation(state, rng);
    expect(t.stewardId ?? null).toBeNull();
  });

  it('drops him from the list of men who could take one', () => {
    const state = game();
    const { t, npc } = setup(state);
    expect(eligibleStewards(state).some((n) => n.id === npc.id)).toBe(true);
    putInCharge(state, npc.id, t.id);
    expect(eligibleStewards(state).some((n) => n.id === npc.id)).toBe(false);
  });
});

describe('what he does with it', () => {
  it('keeps the district from bleeding while somebody is standing in it', () => {
    const held = game();
    const loose = game();

    for (const [state, delegate] of [
      [held, true],
      [loose, false],
    ] as const) {
      const { t, npc } = setup(state);
      if (delegate) putInCharge(state, npc.id, t.id);
      // Nobody runs a job here for a season.
      t.lastActionDay = 0;
      for (let d = 0; d < 90; d++) advanceDay(state);
    }

    const heldInfluence = playerInfluence(territoryList(held)[0]);
    const looseInfluence = playerInfluence(territoryList(loose)[0]);
    expect(heldInfluence).toBeGreaterThan(looseInfluence);
  });

  it('reads his real numbers, not the ones the player can see', () => {
    // Identical low familiarity, so the player's read of both is equally
    // vague. Opposite greed underneath.
    const state = game();
    const rng = new Rng(state.rng);
    const [a, b] = twoMen(state);
    const [ta, tb] = territoryList(state);
    ta.influence.player = 60;
    tb.influence.player = 60;

    for (const [npc, t, greedy] of [
      [a, ta, true],
      [b, tb, false],
    ] as const) {
      npc.role = ROLE_ORDER[DELEGATION.minRoleIndex];
      npc.familiarity = 5;
      npc.wage = 100;
      npc.stats.greed = greedy ? 95 : 5;
      npc.stats.loyalty = greedy ? 10 : 95;
      npc.stats.grievance = greedy ? 70 : 0;
      npc.stats.respectForBoss = greedy ? 5 : 90;
      putInCharge(state, npc.id, t.id);
    }

    for (let w = 1; w <= 16; w++) {
      state.day = w * DELEGATION.intervalDays;
      tickDelegation(state, rng);
    }

    // The dishonest one keeps a cut, so less of the same district reaches you.
    expect(averageTake(ta)!).toBeLessThan(averageTake(tb)!);
    expect(a.skimTotal).toBeGreaterThan(0);
    expect(b.skimTotal).toBe(0);
  });

  it('holds a greedy man honest while he is well paid and well regarded', () => {
    const grudge = game();
    const content = game();

    for (const [state, sore] of [
      [grudge, true],
      [content, false],
    ] as const) {
      const rng = new Rng(state.rng);
      const { t, npc } = setup(state);
      // Same appetite for money in both. Only his situation differs.
      npc.stats.greed = 90;
      npc.stats.loyalty = 45;
      npc.stats.grievance = sore ? 85 : 0;
      npc.stats.respectForBoss = sore ? 10 : 85;
      npc.wage = sore ? 90 : 900;
      putInCharge(state, npc.id, t.id);
      for (let w = 1; w <= 16; w++) {
        state.day = w * DELEGATION.intervalDays;
        tickDelegation(state, rng);
      }
    }

    const sore = crewList(grudge)[0];
    const settled = crewList(content)[0];
    expect(
      settled.skimTotal,
      'a well-paid, well-regarded man should not be stealing as freely',
    ).toBeLessThan(sore.skimTotal);
  });
});

describe('the record you read him from', () => {
  it('never puts a number about the man on the page', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const { t, npc } = setup(state);
    npc.stats.greed = 90;
    putInCharge(state, npc.id, t.id);
    for (let w = 1; w <= 8; w++) {
      state.day = w * DELEGATION.intervalDays;
      tickDelegation(state, rng);
    }

    for (const line of readLedger(t)) {
      // Money is allowed — it is the district's, not his. Anything else
      // numeric would be a stat leaking through the one surface that must not
      // leak one.
      expect(line.label).not.toMatch(/\d/);
      expect(line.note).not.toMatch(/\d/);
    }
  });

  it('does not name the thing he is actually doing when he is stealing', () => {
    /*
       The most important assertion in the file.

       A man taking a cut writes the same line in the record as a man working
       honestly, because that is what it looks like from where the player is
       standing. If the ledger said "skimmed", the mechanic would be a
       confession rather than a bet, answerable at a glance and grokked the
       first time it happened.
    */
    const state = game();
    const rng = new Rng(state.rng);
    const { t, npc } = setup(state);
    npc.wage = 60;
    npc.stats.greed = 99;
    npc.stats.loyalty = 2;
    npc.stats.grievance = 90;
    npc.stats.respectForBoss = 2;
    putInCharge(state, npc.id, t.id);
    for (let w = 1; w <= 16; w++) {
      state.day = w * DELEGATION.intervalDays;
      tickDelegation(state, rng);
    }

    expect(npc.skimTotal, 'this man should have been stealing').toBeGreaterThan(0);
    const labels = readLedger(t).map((l) => l.label.toLowerCase());
    expect(labels.some((l) => /skim|steal|took|cut/.test(l))).toBe(false);
  });

  it('gives him away in the money over a season, in most worlds but not all', () => {
    /*
       Measured across worlds, because the property is statistical and a single
       seed cannot show it. The first version of this test used one seed, drew a
       world where the thief happened to be obvious in week one, and would have
       reported either "instantly readable" or "never readable" depending
       entirely on which seed it was written against. That is the same sampling
       mistake that produced a confident 2.8x result elsewhere in this suite.

       What is being pinned is the shape of the read, not a number: a thief
       usually shows, rarely at once, and sometimes not at all within a season.
       The last of those is what makes the suspicion worth having.
    */
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    const settledOn: number[] = [];

    for (const seed of seeds) {
      const state = game(seed);
      const rng = new Rng(state.rng);
      const [a, b] = twoMen(state);
      const [ta, tb] = territoryList(state);

      for (const [npc, t, thief] of [
        [a, ta, true],
        [b, tb, false],
      ] as const) {
        npc.role = ROLE_ORDER[DELEGATION.minRoleIndex];
        npc.wage = 100;
        npc.stats.greed = thief ? 99 : 20;
        npc.stats.loyalty = thief ? 2 : 90;
        npc.stats.grievance = thief ? 90 : 0;
        npc.stats.respectForBoss = thief ? 2 : 90;
        // Same ground under both men, so the money is the only difference.
        t.influence.player = 60;
        t.prosperity = 60;
        t.sentiment = 60;
        putInCharge(state, npc.id, t.id);
      }

      const ratios: number[] = [];
      for (let w = 1; w <= DELEGATION.ledgerLength; w++) {
        state.day = w * DELEGATION.intervalDays;
        tickDelegation(state, rng);
        const x = averageTake(ta);
        const y = averageTake(tb);
        ratios.push(x !== null && y !== null && y > 0 ? x / y : 1);
      }

      /*
         The week from which the gap never closes again.

         "First week it dipped below" was the first metric and it measured
         noise: a week's takings swing 45% on their own, so the ratio of two
         single weeks crosses any threshold by chance about half the time. What
         a player can act on is a gap that stops closing.
      */
      let settled = Infinity;
      for (let w = ratios.length; w >= 1; w--) {
        if (ratios[w - 1] >= 0.8) break;
        settled = w;
      }
      settledOn.push(settled);
    }

    const caught = settledOn.filter((w) => w < Infinity).sort((x, y) => x - y);
    const median = caught[Math.floor(caught.length / 2)];
    // eslint-disable-next-line no-console
    console.log(
      `  a thief showed in the takings in ${caught.length}/${seeds.length} worlds, ` +
        `median week ${median}`,
    );

    expect(caught.length, 'a thief must usually show').toBeGreaterThan(seeds.length * 0.6);
    expect(median, 'and must not be readable from a single week').toBeGreaterThan(1);
    expect(
      caught.length,
      'and some must get away with it, or the suspicion is just a timer',
    ).toBeLessThan(seeds.length);
  });
});

describe('saves', () => {
  it('reads a district with no steward field as nobody holding it', () => {
    const state = game();
    const t = territoryList(state)[0];
    delete t.stewardId;
    delete t.ledger;
    expect(readLedger(t)).toEqual([]);
    expect(averageTake(t)).toBeNull();
    expect(districtsHeldBy(state, crewList(state)[0].id)).toHaveLength(0);
  });

  it('survives a round trip through JSON', () => {
    const state = game();
    const rng = new Rng(state.rng);
    const { t, npc } = setup(state);
    putInCharge(state, npc.id, t.id);
    state.day = DELEGATION.intervalDays;
    tickDelegation(state, rng);

    const back = JSON.parse(JSON.stringify(state)) as GameState;
    const there = back.territories[t.id];
    expect(there.stewardId).toBe(npc.id);
    expect(readLedger(there).length).toBeGreaterThan(0);
  });
});

describe('a steward who is no longer there', () => {
  it('does not punish a man who has already walked', () => {
    /*
       Found by playing: a man was appointed, went unpaid twice, defected, and
       the district reverting logged that he "heard about it the same day
       everybody else did" — about somebody who had left a fortnight earlier.
       The consequence was being applied to a man the game had already lost.
    */
    const state = game();
    const rng = new Rng(state.rng);
    const { t, npc } = setup(state);
    putInCharge(state, npc.id, t.id);

    npc.status = 'defected';
    const grievance = npc.stats.grievance;
    state.day = DELEGATION.intervalDays;
    tickDelegation(state, rng);

    expect(t.stewardId ?? null).toBeNull();
    expect(npc.stats.grievance, 'nothing more can be taken from him').toBe(grievance);
    expect(state.log[0].text).not.toMatch(/heard about it/);
  });
});

/**
 * Whether the game ever suggests any of this.
 *
 * The mechanic above was reachable, tested and unused. A blind playtester ran
 * a hundred and seventy-nine days holding ground the whole time and never
 * handed a district to anybody — not because it was locked, but because the
 * only prompt for it in the interface asked `held === 0`, and so appeared
 * exclusively to players with no district to hand over.
 */
describe('needsSteward', () => {
  it('is true when you hold ground nobody is running and have somebody to run it', () => {
    const state = game(41);
    const t = territoryList(state)[0];
    addInfluence(state, t.id, 60);

    const hand = crewList(state)[0];
    hand.role = ROLE_ORDER[DELEGATION.minRoleIndex];
    hand.status = 'active';

    expect(needsSteward(state)).toBe(true);
  });

  it('stays true once you already hold a district — the case the rail used to suppress', () => {
    const state = game(42);
    const [a, b] = territoryList(state);
    addInfluence(state, a.id, 80);
    addInfluence(state, b.id, 60);

    // Two, because a career begins with one — see `twoMen` above.
    const [first, second] = twoMen(state);
    first.role = ROLE_ORDER[DELEGATION.minRoleIndex];
    first.status = 'active';
    second.role = ROLE_ORDER[DELEGATION.minRoleIndex];
    second.status = 'active';

    putInCharge(state, first.id, a.id);
    expect(needsSteward(state)).toBe(true);
  });

  it('is false when every district you hold is already run', () => {
    const state = game(43);
    const t = territoryList(state)[0];
    addInfluence(state, t.id, 60);

    const hand = crewList(state)[0];
    hand.role = ROLE_ORDER[DELEGATION.minRoleIndex];
    hand.status = 'active';
    putInCharge(state, hand.id, t.id);

    expect(needsSteward(state)).toBe(false);
  });

  it('is false with nobody senior enough to hand it to', () => {
    const state = game(44);
    addInfluence(state, territoryList(state)[0].id, 60);
    for (const npc of crewList(state)) npc.role = 'associate';

    expect(needsSteward(state)).toBe(false);
  });
});

/**
 * What a district is worth, said before the decision instead of after it.
 *
 * The appointing screen was a row of names. What the district actually earns
 * was computable and private, so a player learned it by handing somebody a
 * district and waiting a month — which is why nobody did. The hiring screen
 * has stated a wage against income for some time now, and putting a man on a
 * district is the larger commitment of the two.
 */
describe('districtWorth', () => {
  it('is worth more where you are stronger', () => {
    const state = game(45);
    const t = territoryList(state)[0];

    addInfluence(state, t.id, 25);
    const weak = districtWorth(t);
    addInfluence(state, t.id, 60);
    const strong = districtWorth(t);

    expect(strong).toBeGreaterThan(weak);
  });

  it('quotes the middle of what a week pays, not a best case', () => {
    const state = game(46);
    const t = territoryList(state)[0];
    addInfluence(state, t.id, 70);

    const quoted = districtWorth(t);
    expect(quoted).toBeGreaterThan(0);
    expect(quoted).toBeLessThan(DELEGATION.worthPerWeek * 2);
  });

  it('is the centre the steward actually draws from', () => {
    /*
       The figure on the screen has to be the middle of the distribution a
       steward's weeks are drawn from, or it is an advertisement. Averaging a
       run of real weeks is the only honest way to check that, since the swing
       is applied inside the roll.
    */
    const state = game(47);
    const t = territoryList(state)[0];
    addInfluence(state, t.id, 70);

    const [hand] = twoMen(state);
    hand.role = ROLE_ORDER[DELEGATION.minRoleIndex];
    hand.status = 'active';
    putInCharge(state, hand.id, t.id);

    const quoted = districtWorth(t);
    const rng = new Rng(state.rng);
    let weeks = 0;
    for (let w = 1; w <= 60; w++) {
      // Landing exactly on the interval, not stepping by it — `tickDelegation`
      // gates on `day % intervalDays`, and a career does not begin on day zero.
      state.day = w * DELEGATION.intervalDays;
      tickDelegation(state, rng);
      weeks++;
    }

    const ledger = t.ledger ?? [];
    expect(ledger.length, 'the steward never had a week').toBeGreaterThan(0);
    const average = ledger.reduce((sum, e) => sum + e.earned, 0) / ledger.length;

    // Generous bounds: what a man hands over is his action's share of the
    // worth, not the worth, so this asserts the right order of magnitude
    // rather than equality.
    expect(weeks).toBeGreaterThan(0);
    expect(average).toBeGreaterThan(quoted * 0.2);
    expect(average).toBeLessThan(quoted * 2.5);
  });
});
