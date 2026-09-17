/**
 * What kind of thing this is, and the way out of it.
 *
 * Two systems, and what is worth pinning down is not the arithmetic but the
 * seven facts the design rests on:
 *
 * 1. **An undeclared career is the career this game always was.** Every
 *    doctrine modifier returns its neutral value and nothing is drawn. This
 *    is the guard that makes adding the whole feature free for every save and
 *    every probe baseline written before it.
 * 2. **Declaring it moves four dials at once, in opposite directions.** The
 *    Iron Hand earns less over the counter and draws a quarter more federal
 *    attention; the Holding Company is the mirror and its fear expires faster.
 * 3. **The old men take it personally, once.** The relic step is a
 *    consequence of the declaration, not a subscription, and the cooldown is
 *    what stops it being farmed by toggling.
 * 4. **The shown number is the real number.** The buy screen's revenue
 *    estimate carries the same doctrine term the weekly takings do.
 * 5. **The money really goes.** `nestEgg` leaves `cleanWorth` and never
 *    comes back, and what it buys on the way out is suspicion.
 * 6. **Suspicion is paid to the people who already decide the coup.** Past
 *    the bar the weekly deposition roll doubles; past the higher bar they
 *    stop waiting for the roll at all.
 * 7. **The plane only leaves when there is nothing to stay for**, and every
 *    refusal says which bar stopped it.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import {
  currentDoctrine,
  doctrineAttributeBonus,
  doctrineCleanYield,
  doctrineFearDecay,
  doctrineFederalHeat,
  doctrineState,
  relics,
  setDoctrine,
} from '../doctrine';
import {
  canRetireToFlorida,
  floridaState,
  retireToFlorida,
  siphonToFlorida,
  tickFlorida,
} from '../florida';
import { heatScale, successBreakdown } from '../operations';
import { revenueIfBought, weeklyRevenue } from '../business';
import { tickFear } from '../player';
import { tickDeposition, wouldTakeIt } from '../succession';
import { cleanWorth } from '../economy';
import { declareWar } from '../diplomacy';
import { DOCTRINE, DOCTRINES } from '../../config/doctrine';
import { FLORIDA } from '../../config/florida';
import { OPERATION_BY_ID } from '../../config/operations';
import { BUSINESS_BY_ID } from '../../config/businesses';
import { CAPO_TENSION } from '../../config/capoTension';
import { DEPOSITION } from '../../config/succession';
import { FEAR } from '../../config/economy';
import type { Business, GameState, Investigation, Npc } from '../types';
import type { StageId } from '../../config/lawEnforcement';

function game(seed = 4242): GameState {
  return newGame({ name: 'Palm', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 7171, calls }), role);
  npc.status = 'active';
  npc.isSkimming = false;
  npc.ties = [];
  state.npcs[npc.id] = npc;
  return npc;
}

/** A capo the generational read will certainly call a relic. */
function relic(state: GameState, calls: number): Npc {
  const npc = hire(state, 'capo', calls);
  npc.age = CAPO_TENSION.relicAge + 6;
  npc.traits = ['old_school'];
  npc.stats.loyalty = 50;
  npc.stats.grievance = 10;
  return npc;
}

function caseAt(state: GameState, stage: StageId, id = 'case_1'): Investigation {
  const investigation: Investigation = {
    id,
    agencyId: 'federal_bureau',
    stage,
    openedDay: 1,
    stageSince: 1,
    strength: 40,
    suspectIds: [],
    businessIds: [],
    lastProgressDay: state.day,
    status: 'open',
    verdict: null,
    verdictDay: null,
    history: [],
  };
  state.law.investigations[id] = investigation;
  return investigation;
}

/**
 * Parks the causal stream where its next `chance(p)` lands, or does not.
 *
 * Scanned rather than hard-coded, the same way `tradecraftAndGenerations.test.ts`
 * does it — a magic call count is a number that stops meaning anything the
 * first time an unrelated draw moves upstream of it.
 */
function streamWhere(state: GameState, p: number, fires: boolean): void {
  for (let calls = 0; calls < 50_000; calls++) {
    if (new Rng({ seed: state.rng.seed, calls }).chance(p) === fires) {
      state.rng.calls = calls;
      return;
    }
  }
  throw new Error('no such stream');
}

// ------------------------------------------------------- nothing declared ---

describe('a career that has never said what it is', () => {
  it('reads neutral on every dial and stores nothing', () => {
    const state = game();

    expect(doctrineState(state)).toBeNull();
    expect(currentDoctrine(state)).toBeNull();
    expect(state.doctrine).toBeUndefined();
    expect(doctrineFederalHeat(state)).toBe(1);
    expect(doctrineCleanYield(state)).toBe(1);
    expect(doctrineFearDecay(state)).toBe(1);
    expect(doctrineAttributeBonus(state, 'intimidation')).toBe(0);
  });
});

// ------------------------------------------------------------ declaring it --

describe('saying what this is', () => {
  it('lands the Iron Hand on heat, yields and the odds, all at once', () => {
    const plain = game();
    const iron = game();
    const def = Object.values(OPERATION_BY_ID)[0];

    setDoctrine(iron, 'traditional');

    expect(heatScale(iron, def) / heatScale(plain, def)).toBeCloseTo(
      DOCTRINES.traditional.federalHeat,
      5,
    );
    expect(doctrineCleanYield(iron)).toBe(DOCTRINES.traditional.cleanYield);
    expect(doctrineAttributeBonus(iron, 'intimidation')).toBe(2);
    // ...and only on the attribute it is actually about.
    expect(doctrineAttributeBonus(iron, 'negotiation')).toBe(0);
  });

  it('lands the Holding Company the other way, and lets fear expire faster', () => {
    const plain = game();
    const suits = game();
    const def = Object.values(OPERATION_BY_ID)[0];

    setDoctrine(suits, 'corporate');

    expect(heatScale(suits, def) / heatScale(plain, def)).toBeCloseTo(
      DOCTRINES.corporate.federalHeat,
      5,
    );
    expect(heatScale(suits, def)).toBeLessThan(heatScale(plain, def));
    expect(doctrineCleanYield(suits)).toBe(DOCTRINES.corporate.cleanYield);
    expect(doctrineFearDecay(suits)).toBe(1.5);
    expect(doctrineAttributeBonus(suits, 'intimidation')).toBe(0);
  });

  it('puts the Iron Hand on the odds of a job scored on fear', () => {
    const plain = game();
    const iron = game();
    const territoryId = Object.keys(plain.territories)[0];
    const def = Object.values(OPERATION_BY_ID).find((d) => d.attribute === 'intimidation')!;

    // Below the ceiling, so the bonus has somewhere to go.
    plain.player.attributes.intimidation = 10;
    iron.player.attributes.intimidation = 10;
    setDoctrine(iron, 'traditional');

    const before = successBreakdown(plain, def, [], territoryId).total;
    const after = successBreakdown(iron, def, [], territoryId).total;

    expect(after).toBeGreaterThan(before);
  });

  it('charges the front, both on the takings and on the figure the buy screen quotes', () => {
    const plain = game();
    const iron = game();
    const territoryId = Object.keys(plain.territories)[0];
    const def = BUSINESS_BY_ID[Object.keys(BUSINESS_BY_ID)[0]];

    setDoctrine(iron, 'traditional');

    expect(revenueIfBought(iron, def, territoryId)).toBeLessThan(
      revenueIfBought(plain, def, territoryId),
    );

    // And the weekly takings of a front that is actually standing there.
    // Placed on the board rather than bought, because `acquireBusiness` has
    // its own gates (money, sentiment, the front count) and none of them is
    // what this test is about.
    const front = (s: GameState): Business => {
      const b: Business = {
        id: 'front_1',
        defId: def.id,
        territoryId,
        purchasedDay: 1,
        exposure: 0,
        revenueTotal: 0,
        launderedTotal: 0,
        lastLaundered: 0,
        health: 100,
        status: 'operating',
      };
      s.businesses[b.id] = b;
      return b;
    };
    expect(weeklyRevenue(iron, front(iron))).toBeLessThan(
      weeklyRevenue(plain, front(plain)),
    );
  });

  it('lets the Holding Company’s fear drain half again as fast', () => {
    const plain = game();
    const suits = game();
    setDoctrine(suits, 'corporate');

    for (const s of [plain, suits]) {
      s.org.fear = 80;
      s.day = 7;
      tickFear(s);
    }

    const plainLost = 80 - plain.org.fear;
    const suitsLost = 80 - suits.org.fear;
    expect(plainLost).toBeGreaterThan(0);
    expect(suitsLost / plainLost).toBeCloseTo(1.5, 5);
    expect(FEAR.decayShare).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------- the old men --

describe('what the men who made you make of it', () => {
  it('pays the relics for the Iron Hand and nobody else', () => {
    const state = game();
    const old = relic(state, 11);
    const young = hire(state, 'capo', 12);
    young.age = 31;
    young.traits = [];
    young.stats.loyalty = 50;

    setDoctrine(state, 'traditional');

    expect(relics(state).map((n) => n.id)).toEqual([old.id]);
    expect(old.stats.loyalty).toBe(60);
    expect(young.stats.loyalty).toBe(50);
  });

  it('charges them for the Holding Company, and says so on the man', () => {
    const state = game();
    const old = relic(state, 13);

    setDoctrine(state, 'corporate');

    expect(old.stats.grievance).toBe(25);
    expect(old.notes[0]?.kind).toBe('bad');
  });

  it('refuses a switch inside the cooldown, and names the day it clears', () => {
    const state = game();
    const old = relic(state, 14);
    setDoctrine(state, 'traditional');
    const paid = old.stats.loyalty;

    state.day += DOCTRINE.switchCooldownDays - 1;
    const again = setDoctrine(state, 'corporate');

    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/1 day\b/);
    expect(state.doctrine!.current).toBe('traditional');
    // Which is what stops the relic step being farmed by toggling.
    expect(old.stats.loyalty).toBe(paid);

    state.day += 1;
    expect(setDoctrine(state, 'corporate').ok).toBe(true);
  });

  it('refuses re-declaring what is already true, for its own reason', () => {
    const state = game();
    const old = relic(state, 15);
    setDoctrine(state, 'corporate');
    const carried = old.stats.grievance;

    /*
       Past the cooldown deliberately.

       Asking on the same day would be refused by the cooldown, and a test that
       only ever reads `ok: false` cannot tell the two refusals apart — it
       passes with this guard deleted. Standing clear of the cooldown means the
       only thing left to refuse is the no-op, and the message has to say so.
    */
    state.day += DOCTRINE.switchCooldownDays;
    const again = setDoctrine(state, 'corporate');

    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/already/i);
    // ...and the old men are not charged a second time for the same sentence.
    expect(old.stats.grievance).toBe(carried);
  });
});

// ------------------------------------------------------------- the siphon --

describe('money that stops being the organization’s', () => {
  it('leaves the wallet, leaves what the family is worth, and buys suspicion', () => {
    const state = game();
    state.org.cash = 100_000;
    const worthBefore = cleanWorth(state);

    const moved = siphonToFlorida(state, 40_000);

    expect(moved.ok).toBe(true);
    expect(state.org.cash).toBe(60_000);
    expect(cleanWorth(state)).toBe(worthBefore - 40_000);
    expect(floridaState(state).nestEgg).toBe(40_000);
    expect(floridaState(state).suspicion).toBeCloseTo(
      40 * FLORIDA.suspicionPerSiphon,
      5,
    );
  });

  it('refuses a clean pool that cannot cover it, and says what is in it', () => {
    const state = game();
    state.org.cash = 900;
    state.org.dirtyCash = 500_000;

    const moved = siphonToFlorida(state, 40_000);

    expect(moved.ok).toBe(false);
    expect(moved.message).toMatch(/\$900/);
    expect(state.florida).toBeUndefined();
    expect(state.org.dirtyCash).toBe(500_000);
  });

  it('will take the other kind when told to', () => {
    const state = game();
    state.org.cash = 0;
    state.org.dirtyCash = 30_000;

    expect(siphonToFlorida(state, 10_000, false).ok).toBe(true);
    expect(state.org.dirtyCash).toBe(20_000);
    expect(floridaState(state).nestEgg).toBe(10_000);
  });

  it('fades on a quiet week and does not fade on a loud one', () => {
    const quiet = game();
    const busy = game();
    for (const s of [quiet, busy]) {
      floridaState(s).suspicion = 20;
      s.day = 70;
    }
    quiet.florida!.lastSiphonDay = 40;
    busy.florida!.lastSiphonDay = 70;

    tickFlorida(quiet, new Rng(quiet.rng));
    tickFlorida(busy, new Rng(busy.rng));

    expect(quiet.florida!.suspicion).toBeCloseTo(20 - FLORIDA.suspicionDecayWeekly, 5);
    expect(busy.florida!.suspicion).toBe(20);
  });

  it('puts grievance on the capos once the room is past the bar, and not before', () => {
    const under = game();
    const over = game();
    const men: Npc[] = [];
    for (const s of [under, over]) {
      men.push(hire(s, 'capo', 21));
      s.day = 70;
      floridaState(s).suspicion = FLORIDA.coupRiskSuspicionThreshold;
      s.florida!.lastSiphonDay = 70;
    }
    over.florida!.suspicion = FLORIDA.coupRiskSuspicionThreshold + 1;
    const before = men.map((m) => m.stats.grievance);

    tickFlorida(under, new Rng(under.rng));
    tickFlorida(over, new Rng(over.rng));

    expect(men[0].stats.grievance).toBe(before[0]);
    expect(men[1].stats.grievance).toBe(before[1] + FLORIDA.grievancePerWeekOverThreshold);
  });

  it('draws nothing and touches nothing for a career that never opened the account', () => {
    const state = game();
    state.day = 70;
    const calls = state.rng.calls;

    tickFlorida(state, new Rng(state.rng));

    expect(state.florida).toBeUndefined();
    expect(state.rng.calls).toBe(calls);
  });
});

// --------------------------------------------------------------- the coup --

describe('the room working it out', () => {
  /** A table that would move, and a boss the weekly roll is about to test. */
  function unrest(state: GameState): Npc {
    const mover = hire(state, 'underboss', 31);
    mover.age = 45;
    // Every bar `wouldTakeIt` reads, cleared with room to spare — and a claim
    // built the way `claimFrom` actually builds one, out of leadership, skill,
    // courage, a record and a tenure rather than a number poked into a field
    // that does not exist.
    mover.stats = {
      ...mover.stats,
      ambition: 95,
      respectForBoss: 5,
      grievance: 95,
      loyalty: 5,
      leadership: 95,
      skill: 90,
      courage: 90,
    };
    mover.daysInCrew = 2_000;
    mover.opsCompleted = 200;
    for (let i = 0; i < 3; i++) {
      const backer = hire(state, 'capo', 40 + i);
      backer.stats.respectForBoss = 5;
      backer.stats.grievance = 95;
      backer.ties = [];
    }
    state.day = 7 * 20;
    state.flags['unrest_since'] = state.day - 7 * 10;
    state.flags['unrest_told'] = state.day - 7 * 5;
    return mover;
  }

  it('doubles the weekly roll for a boss who is visibly packing', () => {
    const calm = game();
    const packing = game();
    for (const s of [calm, packing]) unrest(s);
    floridaState(packing).suspicion = FLORIDA.coupRiskSuspicionThreshold + 1;

    expect(wouldTakeIt(calm)).not.toBeNull();
    expect(wouldTakeIt(packing)).not.toBeNull();

    /*
       Parked between the two chances rather than asserted as a number.

       The roll is the same draw in both games; the only difference is the
       multiplier in front of it. A stream that lands above the plain chance
       and below the doubled one is the exact window this feature owns, and it
       is the only reading that cannot be satisfied by an unrelated change to
       `DEPOSITION.chancePerWeek`.
    */
    const plain = DEPOSITION.chancePerWeek;
    for (let calls = 0; calls < 50_000; calls++) {
      const roll = new Rng({ seed: calm.rng.seed, calls }).next();
      if (roll >= plain && roll < plain * FLORIDA.coupChanceMultiplier) {
        calm.rng.calls = calls;
        packing.rng.calls = calls;
        break;
      }
    }

    /*
       Read off the handover, not off `gameOver`.

       `removePlayer` only ends a run when there is nobody to take it, and this
       fixture deliberately has somebody — so a coup here is a succession, and
       the generation counter is the thing that says one happened.
    */
    const before = calm.succession.generation;
    tickDeposition(calm, new Rng(calm.rng));
    tickDeposition(packing, new Rng(packing.rng));

    expect(calm.succession.generation).toBe(before);
    expect(packing.succession.generation).toBe(before + 1);
  });

  it('stops waiting for the roll past the mutiny bar', () => {
    const state = game();
    unrest(state);
    state.org.cash = 100_000;
    floridaState(state).suspicion = FLORIDA.mutinyThreshold - 0.05;

    // One more thousand is one more twentieth of a point, and it is enough.
    const moved = siphonToFlorida(state, 1_000, true, new Rng(state.rng));

    expect(moved.ok).toBe(true);
    expect(state.florida!.suspicion).toBeGreaterThanOrEqual(FLORIDA.mutinyThreshold);
    expect(state.succession.generation).toBe(2);
    // ...and the record says what it was about, rather than "unrest".
    expect(state.succession.line[0].fate).toMatch(/account/i);
  });

  it('latches the mutiny when there is no stream in hand, and the week fires it', () => {
    const state = game();
    unrest(state);
    state.org.cash = 100_000;
    floridaState(state).suspicion = FLORIDA.mutinyThreshold;

    siphonToFlorida(state, 1_000);
    expect(state.florida!.mutinyPending).toBe(true);
    expect(state.gameOver).toBeNull();

    state.day = 7 * 21;
    tickFlorida(state, new Rng(state.rng));

    expect(state.florida!.mutinyPending).toBe(false);
    expect(state.succession.generation).toBe(2);
  });
});

// ------------------------------------------------------------ the ending ---

describe('the plane', () => {
  it('refuses a short account and says exactly how short', () => {
    const state = game();
    state.org.cash = 1_000_000;
    siphonToFlorida(state, 100_000);

    const check = canRetireToFlorida(state);

    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/\$150,000/);
    expect(retireToFlorida(state).ok).toBe(false);
    expect(state.gameOver).toBeNull();
  });

  it('refuses a trial, and says it is the trial', () => {
    const state = game();
    state.org.cash = 1_000_000;
    siphonToFlorida(state, FLORIDA.targetNestEgg);
    caseAt(state, 'trial');

    const check = canRetireToFlorida(state);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/trial/i);
  });

  it('refuses a war, and says it is the war', () => {
    const state = game();
    state.org.cash = 1_000_000;
    siphonToFlorida(state, FLORIDA.targetNestEgg);
    const rival = Object.keys(state.factions).find((f) => f !== 'player')!;
    declareWar(state, 'player' as never, rival as never);

    const check = canRetireToFlorida(state);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/war/i);
  });

  it('leaves on a Tuesday when the account is full and nothing is owed', () => {
    const state = game();
    state.org.cash = 1_000_000;
    siphonToFlorida(state, FLORIDA.targetNestEgg);

    expect(canRetireToFlorida(state).ok).toBe(true);
    expect(retireToFlorida(state).ok).toBe(true);
    expect(state.gameOver).not.toBeNull();
    expect(state.gameOver!.reason).toMatch(/Florida|flight|account/i);
    expect(state.career?.some((c) => c.tone === 'good' && /Florida/.test(c.text))).toBe(true);
  });
});

// --------------------------------------------------------- the whole loop --

describe('through the clock, as the game runs it', () => {
  it('runs the weekly pass without anybody calling it by hand', () => {
    const state = game();
    state.day = 69;
    floridaState(state).suspicion = 30;
    state.florida!.lastSiphonDay = 1;
    // Parked off a certainty, so nothing in the day's other rolls is what
    // moved this.
    streamWhere(state, 0.5, true);

    advanceDay(state);

    expect(state.day).toBe(70);
    expect(state.florida!.suspicion).toBeCloseTo(30 - FLORIDA.suspicionDecayWeekly, 5);
  });

  it('never opens the account for a boss who never asked for one', () => {
    const state = game();
    state.day = 69;

    advanceDay(state);

    expect(state.florida).toBeUndefined();
    expect(state.doctrine).toBeUndefined();
  });
});
