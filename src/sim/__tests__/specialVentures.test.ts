/**
 * The two covers with a name, and the four things owning one actually does.
 *
 * Until this round `SPECIAL_VENTURES` was config prose: two entries nothing
 * could buy, whose perks were sentences with no code behind them and whose
 * `waste_management` branch in `hasHealthInsurance` was unreachable. A
 * catalogue entry nobody can reach is not a feature, and a perk described on a
 * panel and implemented nowhere is the panel lying — which is rule 3.
 *
 * So the assertions here are deliberately about consequences rather than about
 * the purchase:
 *
 * 1. **It is bought in clean money and it refuses to be bought in dirty.**
 *    That is the whole reason a legitimate cover is different from a front.
 * 2. **What comes out is an ordinary front.** It resolves through
 *    `businessDef`, it earns on payday, and everything downstream of a
 *    business works on it without knowing what it is.
 * 3. **Each perk moves the thing it names.** The traces, the block, the offer.
 * 4. **A career that never buys one is unchanged.** Every perk is behind an
 *    ownership read, so the baseline every probe measures cannot move.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { crewList } from '../npc';
import { territoryList, tickTerritory } from '../territory';
import { businessDef, ownedBusinesses, weeklyRevenue } from '../business';
import { hasHealthInsurance } from '../corporate';
import { addEvidence } from '../util';
import { rankNow } from '../rank';
import { poachChance } from '../faction';
import {
  acquireSpecialVenture,
  canAcquireSpecialVenture,
  hasSpecialVenture,
} from '../tribute';
import { SPECIAL_VENTURES, VENTURE_PERKS } from '../../config/tribute';
import {
  HOME_TERRITORY,
  SENTIMENT_RECOVERY_PER_WEEK,
  SENTIMENT_START,
} from '../../config/territories';
import type { GameState } from '../types';

const WASTE = SPECIAL_VENTURES.find((v) => v.id === 'waste_management')!;
const PORK = SPECIAL_VENTURES.find((v) => v.id === 'pork_store')!;

function game(seed = 41): GameState {
  return newGame({ name: 'Barone', difficulty: 'normal', seed });
}

/**
 * An organization big enough for the rung the ventures ask for.
 *
 * Same shape as `rank.test.ts`'s helper and for the same reason: it reaches
 * through to the quantities `opsBoard` actually counts, so a change to how a
 * front or a district is counted breaks this test rather than sliding past it.
 */
function build(state: GameState, districts = 2, fronts = 3, crew = 9): void {
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

/** A capo with the money in the clean pile. */
function ready(ventureId: string, seed = 41): GameState {
  const state = game(seed);
  build(state);
  state.org.cash = SPECIAL_VENTURES.find((v) => v.id === ventureId)!.cost;
  state.org.dirtyCash = 0;
  return state;
}

describe('buying a cover with a name on it', () => {
  it('refuses below the rung, and says which rung', () => {
    const state = game();
    state.org.cash = WASTE.cost;
    expect(rankNow(state).id).toBe('street_criminal');
    const can = canAcquireSpecialVenture(state, 'waste_management');
    expect(can.ok).toBe(false);
    expect(can.reason).toContain('Capo');
  });

  it('refuses on dirty money however much of it there is', () => {
    const state = game();
    build(state);
    state.org.cash = 0;
    state.org.dirtyCash = WASTE.cost * 4;
    const can = canAcquireSpecialVenture(state, 'waste_management');
    expect(can.ok).toBe(false);
    expect(can.reason).toContain('clean');
  });

  it('takes the price out of clean cash and leaves the dirty pile alone', () => {
    const state = ready('pork_store');
    state.org.cash = PORK.cost + 500;
    state.org.dirtyCash = 9_000;
    expect(acquireSpecialVenture(state, 'pork_store').ok).toBe(true);
    expect(state.org.cash).toBe(500);
    expect(state.org.dirtyCash).toBe(9_000);
  });

  it('will not sell the same place twice', () => {
    const state = ready('pork_store');
    expect(acquireSpecialVenture(state, 'pork_store').ok).toBe(true);
    state.org.cash = PORK.cost * 10;
    const can = canAcquireSpecialVenture(state, 'pork_store');
    expect(can.ok).toBe(false);
    expect(can.reason).toContain('already');
  });

  it('puts a real operating front on the board', () => {
    const state = ready('waste_management');
    const before = ownedBusinesses(state).length;
    expect(acquireSpecialVenture(state, 'waste_management').ok).toBe(true);
    expect(hasSpecialVenture(state, 'waste_management')).toBe(true);

    const fronts = ownedBusinesses(state);
    expect(fronts.length).toBe(before + 1);
    const bought = fronts.find((b) => b.defId === 'waste_management')!;
    expect(state.territories[HOME_TERRITORY].businessIds).toContain(bought.id);

    /*
       The whole of the integration. `businessDef` is the single funnel every
       tick, panel and shutter reads a front's shape through, and the ventures
       are deliberately not in `BUSINESSES` — so if this resolved to undefined
       the first payday after a purchase would throw.
    */
    const def = businessDef(bought);
    expect(def.name).toBe(WASTE.name);
    expect(def.revenue).toBe(WASTE.weeklyRevenue);
    expect(def.launderCapacity).toBe(0);
    expect(weeklyRevenue(state, bought)).toBeGreaterThan(0);
  });
});

describe('what owning one of them actually does', () => {
  it('puts the boss on a group plan', () => {
    const state = ready('waste_management');
    acquireSpecialVenture(state, 'waste_management');

    /*
       The other two routes taken away, because the rung this purchase needs
       already puts three fronts on the board and `HEALTH_INSURANCE.minFronts`
       would answer this on its own. The transfer station standing alone is the
       branch that was unreachable until this round — it is a payroll with the
       boss's name on it as a consultant, which is the entire point of it.
    */
    for (const b of ownedBusinesses(state)) {
      if (b.defId !== 'waste_management') b.status = 'shuttered';
    }
    expect(ownedBusinesses(state).length).toBe(1);
    expect(hasHealthInsurance(state)).toBe(true);
  });

  it('takes a third off what a killing and a body leave behind, and nothing off anything else', () => {
    const state = ready('waste_management');
    const trace = (source: 'violence' | 'disposal' | 'finance') =>
      addEvidence(state, { day: 1, source, strength: 10, npcIds: [], detail: 'x' }).strength;

    expect(trace('violence')).toBe(10);
    expect(trace('finance')).toBe(10);

    acquireSpecialVenture(state, 'waste_management');
    const kept = 10 * (1 - VENTURE_PERKS.wasteEvidenceReduction);
    expect(trace('violence')).toBe(kept);
    expect(trace('disposal')).toBe(kept);
    expect(trace('finance')).toBe(10);
  });

  it('makes the home block forgive faster, and only the home block', () => {
    const state = ready('pork_store');
    const other = territoryList(state).find((t) => t.id !== HOME_TERRITORY)!;
    const sour = SENTIMENT_START - 20;

    state.territories[HOME_TERRITORY].sentiment = sour;
    other.sentiment = sour;
    tickTerritory(state);
    expect(state.territories[HOME_TERRITORY].sentiment).toBe(sour + SENTIMENT_RECOVERY_PER_WEEK);

    acquireSpecialVenture(state, 'pork_store');
    state.territories[HOME_TERRITORY].sentiment = sour;
    other.sentiment = sour;
    tickTerritory(state);
    expect(state.territories[HOME_TERRITORY].sentiment).toBe(
      sour + SENTIMENT_RECOVERY_PER_WEEK + VENTURE_PERKS.porkStoreHomeSentiment,
    );
    expect(other.sentiment).toBe(sour + SENTIMENT_RECOVERY_PER_WEEK);
  });

  it('makes an offer to one of yours less likely to land', () => {
    const state = ready('pork_store');
    /*
       A man worth approaching. `poachChance` clamps to a floor of 0.05 and a
       loyal opener sits on it, where a multiplier of any size reads as no
       change — the first version of this test passed against the clamp rather
       than against the perk.
    */
    const man = crewList(state)[0];
    man.stats.loyalty = 10;
    const before = poachChance(state, man);

    acquireSpecialVenture(state, 'pork_store');
    const after = poachChance(state, man);

    expect(after).toBeLessThan(before);
    expect(after).toBeCloseTo(before * VENTURE_PERKS.porkStorePoachResist, 6);
  });

  it('never takes the block past where it started', () => {
    const state = ready('pork_store');
    acquireSpecialVenture(state, 'pork_store');
    state.territories[HOME_TERRITORY].sentiment = SENTIMENT_START - 1;
    tickTerritory(state);
    expect(state.territories[HOME_TERRITORY].sentiment).toBe(SENTIMENT_START);
  });
});

describe('a career that never buys one', () => {
  it('reads no venture and carries no perk', () => {
    const state = game();
    expect(hasSpecialVenture(state, 'waste_management')).toBe(false);
    expect(hasSpecialVenture(state, 'pork_store')).toBe(false);
    const trace = addEvidence(state, {
      day: 1,
      source: 'violence',
      strength: 7,
      npcIds: [],
      detail: 'x',
    });
    expect(trace.strength).toBe(7);
  });
});
