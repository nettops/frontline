import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { advanceDay, advanceDays } from '../clock';
import { runDaysSolvent } from './helpers';
import { availableCrew } from '../npc';
import { launchOperation, canLaunch, successBreakdown } from '../operations';
import {
  canOperateIn,
  controlLevel,
  controlledTerritories,
  isContested,
  operableTerritories,
  playerInfluence,
  readRivals,
  tickTerritory,
} from '../territory';
import { sentimentOutlook } from '../operations';
import {
  acquireBusiness,
  canAcquire,
  launderCut,
  ownedBusinesses,
  tickBusinesses,
  totalLaunderCapacity,
} from '../business';
import { loadGame, saveGame } from '../save';
import { weeklyWageBill } from '../economy';
import {
  HOME_TERRITORY,
  SENTIMENT_HOSTILE_BELOW,
  SENTIMENT_ON_FAILURE,
  SENTIMENT_ON_VIOLENCE,
  TERRITORIES,
  TERRITORY_BY_ID,
} from '../../config/territories';
import { APPROACH_BY_ID, OPERATION_BY_ID } from '../../config/operations';
import { RIVAL_IDS } from '../../config/factions';
import type { GameState } from '../types';

function fresh(seed = 4242): GameState {
  return newGame({ name: 'Test Boss', difficulty: 'normal', seed });
}

/** Puts the player in control of a district without playing 30 days first. */
function grant(state: GameState, territoryId: string, influence: number): void {
  state.territories[territoryId].influence.player = influence;
  for (const id of RIVAL_IDS) state.territories[territoryId].influence[id] = 0;
}

/** Standing and money enough to actually buy things, for the business tests. */
function funded(seed = 4242, influence = 30): GameState {
  const state = fresh(seed);
  grant(state, HOME_TERRITORY, influence);
  state.org.cash = 500_000;
  return state;
}

// ------------------------------------------------------------- territory ---

describe('territory', () => {
  it('starts the player with a presence at home and nothing anywhere else', () => {
    const state = fresh();
    expect(playerInfluence(state.territories[HOME_TERRITORY])).toBe(20);
    // Just short of the foothold that unlocks businesses — you have to earn it.
    expect(controlLevel(state.territories[HOME_TERRITORY])).toBe('presence');

    const elsewhere = TERRITORIES.filter((t) => t.id !== HOME_TERRITORY);
    for (const def of elsewhere) {
      expect(playerInfluence(state.territories[def.id])).toBe(0);
    }
  });

  it('only lets you work where you are, or next door', () => {
    const state = fresh();
    const operable = operableTerritories(state).map((o) => o.territory.id);

    expect(operable).toContain(HOME_TERRITORY);
    // Adjacent to home is reachable.
    for (const neighbour of TERRITORIES.find((t) => t.id === HOME_TERRITORY)!.adjacent) {
      expect(operable).toContain(neighbour);
    }
    // The far side of the map is not.
    expect(canOperateIn(state, 'fairgrounds')).toBe(false);
    expect(canOperateIn(state, 'the_heights')).toBe(false);
  });

  it('refuses to launch a job somewhere you have no way into', () => {
    const state = fresh();
    const def = OPERATION_BY_ID['corner_shakedown'];
    const crew = availableCrew(state);
    const check = canLaunch(state, def, [crew[0].id], 'fairgrounds');
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/no way into/i);
  });

  it('opens up new ground as influence spreads', () => {
    const state = fresh();
    expect(canOperateIn(state, 'downtown')).toBe(false);
    // Take the district between home and downtown.
    grant(state, 'old_quarter', 40);
    expect(canOperateIn(state, 'downtown')).toBe(true);
  });

  it('grows influence from successful work in a district', () => {
    const state = fresh();
    const before = playerInfluence(state.territories[HOME_TERRITORY]);
    const def = OPERATION_BY_ID['corner_shakedown'];

    for (let i = 0; i < 25; i++) {
      const crew = availableCrew(state);
      if (crew.length && Object.keys(state.activeOperations).length === 0) {
        launchOperation(state, def.id, [crew[0].id], HOME_TERRITORY);
      }
      advanceDay(state);
    }
    expect(playerInfluence(state.territories[HOME_TERRITORY])).toBeGreaterThan(before);
  });

  it('requires leading the district to claim control, not just a big number', () => {
    const state = fresh();
    const t = state.territories['downtown'];
    // Set explicitly rather than relying on who starts here. Which family sits
    // in which corner is drawn per seed now, so a test that assumed Falcone
    // owned Downtown was testing the world generator, not the control rule.
    for (const id of RIVAL_IDS) t.influence[id] = 0;
    t.influence[RIVAL_IDS[0]] = 62;
    t.influence.player = 60;
    expect(controlLevel(t)).toBe('foothold');
    expect(isContested(t)).toBe(true);

    t.influence.player = 80;
    expect(controlLevel(t)).toBe('dominance');
  });

  it('counts only districts actually held toward rank', () => {
    const state = fresh();
    expect(controlledTerritories(state)).toHaveLength(0);
    grant(state, 'southport', 55);
    expect(controlledTerritories(state).map((t) => t.id)).toEqual(['southport']);
  });

  it('bleeds influence where you stop showing up', () => {
    const state = fresh();
    grant(state, 'southport', 40);
    state.territories['southport'].lastActionDay = 1;
    state.day = 200;

    const before = playerInfluence(state.territories['southport']);
    tickTerritory(state);
    expect(playerInfluence(state.territories['southport'])).toBeLessThan(before);
  });

  it('keeps influence intact where you own a business', () => {
    const state = fresh();
    grant(state, 'southport', 55);
    state.org.cash = 500_000;
    expect(acquireBusiness(state, 'laundromat', 'southport')).not.toBeNull();
    state.territories['southport'].lastActionDay = 1;
    state.day = 200;

    const before = playerInfluence(state.territories['southport']);
    tickTerritory(state);
    expect(playerInfluence(state.territories['southport'])).toBe(before);
  });

  it('never lets influence leave 0..100', () => {
    const state = fresh(99);
    runDaysSolvent(state, 200);
    for (const t of Object.values(state.territories)) {
      for (const value of Object.values(t.influence)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(t.sentiment).toBeGreaterThanOrEqual(0);
      expect(t.sentiment).toBeLessThanOrEqual(100);
    }
  });

  it('makes a rich district pay better and a policed one louder', () => {
    const state = fresh();
    grant(state, 'downtown', 80);
    grant(state, 'southport', 80);
    const def = OPERATION_BY_ID['corner_shakedown'];
    const crew = availableCrew(state);

    // Southport is poor and unwatched; Downtown is rich and heavily policed.
    const quiet = successBreakdown(state, def, crew, 'southport').total;
    const loud = successBreakdown(state, def, crew, 'downtown').total;
    expect(quiet).toBeGreaterThan(loud);
  });

  it('only reads rival strength precisely where you have a real presence', () => {
    const state = fresh();
    const vague = readRivals(state, state.territories['downtown']);
    expect(vague.every((r) => r.value === null)).toBe(true);

    grant(state, 'downtown', 40);
    state.territories['downtown'].influence.falcone = 62;
    const clear = readRivals(state, state.territories['downtown']);
    expect(clear.find((r) => r.faction === 'falcone')?.value).toBe(62);
  });
});

// ------------------------------------------------------------ businesses ---

describe('businesses and laundering', () => {
  it('will not sell you a business where you have no standing', () => {
    const state = fresh();
    // Home is only a foothold, and a casino needs dominance.
    expect(canAcquire(state, 'casino', HOME_TERRITORY).ok).toBe(false);
    expect(canAcquire(state, 'laundromat', 'downtown').ok).toBe(false);
  });

  it('will not sell you one on a presence alone — the foothold has to be earned', () => {
    const state = fresh();
    state.org.cash = 500_000;
    expect(canAcquire(state, 'laundromat', HOME_TERRITORY).ok).toBe(false);
  });

  it('sells you a modest front once you have a foothold and the money', () => {
    const state = funded();
    const check = canAcquire(state, 'laundromat', HOME_TERRITORY);
    expect(check.ok).toBe(true);

    const business = acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    expect(business).not.toBeNull();
    expect(ownedBusinesses(state)).toHaveLength(1);
    expect(state.territories[HOME_TERRITORY].businessIds).toContain(business!.id);
  });

  /*
     Round 7 and round 12 both lost a career to this refusal, four rounds apart.

     Every other refusal in `canAcquire` states the requirement it is enforcing
     and the number attached to it. This one said "Nobody in X will sell to you
     right now" and stopped, so a player was told a district had decided about
     them without being told what had decided it, what the bar was, or that
     leaving the place alone brings it back at two a week. Round 12 read that
     line on day 18 and did not own a front until day 200.

     Asserted on the mechanism rather than the wording: the current figure, the
     bar it is under, and the fact that the bar exists. Prose can be rewritten;
     a refusal that names neither number is the defect.
  */
  it('says which number is refusing you when the neighbourhood will not sell', () => {
    const state = funded();
    const t = state.territories[HOME_TERRITORY];
    t.sentiment = SENTIMENT_HOSTILE_BELOW - 5;

    const check = canAcquire(state, 'laundromat', HOME_TERRITORY);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain(String(Math.round(t.sentiment)));
    expect(check.reason).toContain(String(SENTIMENT_HOSTILE_BELOW));
    expect(check.reason).toMatch(/public feeling/i);
  });

  /*
     F12. The refusal explains itself; nothing explains itself *first*.

     Iteration 5 fixed what the game says when the district has already turned
     — and round 13, blind, read it, understood it, and still named the gate as
     its First hour blocker, because by the time you can read the sentence you
     have spent a fortnight earning it. The only forward warning the game had
     was the words "the street minds" on the Heavy button: no district, no
     number, no consequence.

     The heat line above the district picker is the shape that already works
     here — what this will cost, what it costs if it goes wrong, and where you
     stand now — so public feeling gets the same sentence rather than a new
     mechanism.

     Asserted on the mechanism, not the wording, for the same reason the
     refusal above is: the figure, the bar, what moves it, and the district it
     is about. Prose can be rewritten.
  */
  it('says what a job will do to the district before it is launched', () => {
    const state = funded();
    const t = state.territories[HOME_TERRITORY];
    t.sentiment = 46;

    const outlook = sentimentOutlook(state, HOME_TERRITORY, 'standard');
    expect(outlook).toContain('46');
    expect(outlook).toContain(String(SENTIMENT_HOSTILE_BELOW));
    expect(outlook).toContain(String(Math.abs(SENTIMENT_ON_FAILURE)));
    expect(outlook).toContain(String(Math.abs(SENTIMENT_ON_VIOLENCE)));
    expect(outlook).toMatch(/public feeling/i);
    expect(outlook, 'the warning has to say which district it is about').toContain(
      TERRITORY_BY_ID[HOME_TERRITORY].name,
    );
  });

  /*
     And it has to cost more when you pick the approach that costs more, or it
     is a label rather than a warning.
  */
  it('names what the heavy approach costs on top', () => {
    const state = funded();
    state.territories[HOME_TERRITORY].sentiment = 46;
    const heavy = Math.abs(APPROACH_BY_ID.heavy.sentiment);

    expect(sentimentOutlook(state, HOME_TERRITORY, 'heavy')).toContain(String(heavy));
    expect(
      sentimentOutlook(state, HOME_TERRITORY, 'quiet'),
      'a quiet job costs the street nothing and must not claim otherwise',
    ).not.toContain(`${heavy} on its own`);
  });

  it('stops refusing once the neighbourhood comes back over the bar', () => {
    const state = funded();
    state.territories[HOME_TERRITORY].sentiment = SENTIMENT_HOSTILE_BELOW;
    expect(canAcquire(state, 'laundromat', HOME_TERRITORY).ok).toBe(true);
  });

  it('respects the district slot limit', () => {
    const state = funded();
    // A foothold is one slot only.
    expect(acquireBusiness(state, 'laundromat', HOME_TERRITORY)).not.toBeNull();
    expect(acquireBusiness(state, 'restaurant', HOME_TERRITORY)).toBeNull();

    grant(state, HOME_TERRITORY, 60); // control — two slots
    expect(acquireBusiness(state, 'restaurant', HOME_TERRITORY)).not.toBeNull();
  });

  it('converts dirty cash to clean, minus the cut', () => {
    const state = funded();
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);

    state.org.dirtyCash = 2_000;
    const cleanBefore = state.org.cash;
    const cut = launderCut(state);
    // The coming payroll is deliberately held back in dirty cash.
    const keepBack = weeklyWageBill(state);
    const expected = 2_000 - keepBack;

    state.day = 7; // payday
    const report = tickBusinesses(state, new Rng(state.rng));

    expect(report.laundered).toBe(expected);
    expect(state.org.dirtyCash).toBe(keepBack);

    /*
       The two kinds of clean money go to two different places now.

       This used to assert that the wallet gained the revenue *and* the washed
       money together, and that was the behaviour that stopped the legitimate
       side ever growing: a front's takings landed in the pool every cost falls
       back on, so the fronts funded the jobs and the family reinvested two per
       cent of its earnings.

       Washed money is money the player chose to convert and paid a cut for —
       it is spending money, and it stays to hand. Takings are what the
       businesses earned, and they go where they compound.

       Deliberate behaviour change, not a threshold moved. The family is no
       worse off either way, which the last assertion is here to hold.
    */
    const holdingsBefore = 0;
    expect(state.org.cash).toBeCloseTo(
      cleanBefore + expected - Math.round(expected * cut),
      0,
    );
    expect(state.org.holdings ?? 0).toBe(holdingsBefore + report.revenue);
    expect(state.org.cash + (state.org.holdings ?? 0)).toBeCloseTo(
      cleanBefore + report.revenue + expected - Math.round(expected * cut),
      0,
    );
  });

  it('holds the coming payroll back rather than washing money it is about to spend', () => {
    const state = funded();
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    const payroll = weeklyWageBill(state);

    // Everything on hand is needed for wages, so nothing should be washed.
    state.org.dirtyCash = payroll;
    state.day = 7;
    const report = tickBusinesses(state, new Rng(state.rng));

    expect(report.laundered).toBe(0);
    expect(state.org.dirtyCash).toBe(payroll);
  });

  it('cannot launder more than its capacity in a week', () => {
    const state = funded();
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    const capacity = totalLaunderCapacity(state);

    state.org.dirtyCash = capacity * 10;
    state.day = 7;
    const report = tickBusinesses(state, new Rng(state.rng));

    expect(report.laundered).toBeLessThanOrEqual(capacity);
    expect(state.org.dirtyCash).toBeGreaterThan(0);
  });

  it('never launders more dirty cash than exists', () => {
    const state = funded(4242, 80);
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    acquireBusiness(state, 'restaurant', HOME_TERRITORY);
    acquireBusiness(state, 'social_club', HOME_TERRITORY);

    const keepBack = weeklyWageBill(state);
    state.org.dirtyCash = 1_000 + keepBack;
    state.day = 7;
    const report = tickBusinesses(state, new Rng(state.rng));

    expect(report.laundered).toBe(1_000);
    expect(state.org.dirtyCash).toBe(keepBack);
  });

  it('raises exposure with throughput and lets it cool when idle', () => {
    const state = funded();
    const business = acquireBusiness(state, 'laundromat', HOME_TERRITORY)!;

    // Hammer it for several weeks at full capacity.
    for (let week = 1; week <= 6; week++) {
      state.day = week * 7;
      state.org.dirtyCash = 999_999;
      tickBusinesses(state, new Rng(state.rng));
    }
    const hot = business.exposure;
    expect(hot).toBeGreaterThan(0);

    // Then stop entirely.
    for (let week = 7; week <= 14; week++) {
      state.day = week * 7;
      state.org.dirtyCash = 0;
      tickBusinesses(state, new Rng(state.rng));
    }
    expect(business.exposure).toBeLessThan(hot);
  });

  it('keeps exposure inside 0..100 under sustained abuse', () => {
    const state = funded();
    const business = acquireBusiness(state, 'laundromat', HOME_TERRITORY)!;

    for (let week = 1; week <= 200; week++) {
      state.day = week * 7;
      state.org.dirtyCash = 999_999;
      tickBusinesses(state, new Rng(state.rng));
      expect(business.exposure).toBeGreaterThanOrEqual(0);
      expect(business.exposure).toBeLessThanOrEqual(100);
    }
  });

  it('buys the cut down as the player learns the business', () => {
    const state = fresh();
    const naive = launderCut(state);
    state.player.attributes.business = 20;
    expect(launderCut(state)).toBeLessThan(naive);
  });

  it('does nothing on a day that is not payday', () => {
    const state = funded();
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    state.org.dirtyCash = 5_000;

    state.day = 8;
    const report = tickBusinesses(state, new Rng(state.rng));
    expect(report.laundered).toBe(0);
    expect(state.org.dirtyCash).toBe(5_000);
  });
});

// ------------------------------------------------------------------ save ---

describe('save compatibility', () => {
  it('carries territories and businesses through a round trip', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };

    const state = funded(31337);
    acquireBusiness(state, 'laundromat', HOME_TERRITORY);
    advanceDays(state, 40);

    expect(saveGame(state, '1').ok).toBe(true);
    const loaded = loadGame('1');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(JSON.stringify(loaded.state)).toEqual(JSON.stringify(state));
    expect(Object.keys(loaded.state.territories)).toHaveLength(TERRITORIES.length);
    expect(ownedBusinesses(loaded.state)).toHaveLength(1);
  });
});
