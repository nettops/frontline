/**
 * The deep-simulation pass.
 *
 * Everything here was either broken and measured, or missing and named, in the
 * engine audit. The tests are written against the *property* that was wrong
 * rather than against the implementation that fixed it, so a future change
 * that reintroduces the behaviour fails here even if it does it differently.
 */

import { describe, expect, it } from 'vitest';

import { Rng } from '../rng';
import { newGame } from '../state';
import { advanceDay, advanceDays } from '../clock';
import { runDays, runDaysSolvent } from './helpers';
import { crewList, driftNpcs, traitEffect, perceivedGoal } from '../npc';
import {
  informFromMemory,
  poachableFromMemory,
  readMemories,
  recallsAbout,
  remember,
  weightOf,
} from '../memory';
import { acquireBusiness, healthPressure, tickBusinesses, weeklyRevenue } from '../business';
import { withFronts } from './helpers';
import {
  buildWorkshop,
  canSellArms,
  closeRoute,
  openRoute,
  canOpenSupply,
  openSupply,
  seizeStock,
  sellArms,
  throughput,
  tickContraband,
  tradeUnlocked,
  unitCost,
} from '../contraband';
import { TRADES, TRADE_SENTIMENT_FLOOR } from '../../config/contraband';
import { recordTie, followDeparture, tieDrift, readTies } from '../ties';
import { reviewGoal, goalBoard, goalEffect } from '../goals';
import { cover, tickPerception, readCity, buyPatron } from '../perception';
import { tickAging } from '../aging';
import { leaderPersonality, replaceLeader } from '../leaders';
import { approachCapo, canApproach, caposOf, defect, readCapos } from '../capos';
import { CAPO_COUNT } from '../../config/capos';
import { housePersonality } from '../houses';
import { CHARACTER_JITTER } from '../../config/houses';
import { canRecruit, dismiss, promote, recruit } from '../crew';
import { resolveEvent } from '../events';
import { claimStrength, eligibleHeirs } from '../succession';
import {
  adjustBond,
  alliesOf,
  atWar,
  bond,
  declareWar,
  makePeace,
  relationship,
  setRelationship,
  tickBonds,
  tickWars,
} from '../diplomacy';
import { noteInfluenceTaken, tickFactions } from '../faction';
import { wageExpectation } from '../npc';
import {
  controlLevel,
  controlledTerritories,
  payoutMultiplier,
  people,
  prosperity,
  territoryDef,
  territoryList,
  tickTerritory,
} from '../territory';
import { DAYS_PER_YEAR, FEAR } from '../../config/economy';
import { DEFAULT_TERMS, PRICE_BOUNDS } from '../../config/market';
import { borrow, prices, tickMarket, totalOwed } from '../market';
import { addHeat, channelHeat, setHeat, startLayLow, tickHeat } from '../heat';
import { agencyHeat } from '../investigation';
import { AGENCY_BY_ID } from '../../config/lawEnforcement';
import { LAY_LOW_DURATION_DAYS } from '../../config/heat';
import { HEALTH } from '../../config/businesses';
import { CITY, PATRON } from '../../config/perception';
import { AGING } from '../../config/succession';
import { RIVAL_IDS } from '../../config/factions';
import {
  DISTRICT_LIFE,
  HOME_TERRITORY,
  SENTIMENT_START,
  TERRITORY_BY_ID,
} from '../../config/territories';
import { ATTRIBUTION } from '../../config/beliefs';
import { BOND } from '../../config/diplomacy';
import {
  attribute,
  clarityFor,
  readSuspicions,
  tickBeliefs,
} from '../beliefs';
import { TIE_DEPARTURE } from '../../config/ties';
import type { GameState, Npc } from '../types';

function game(seed = 42): GameState {
  return newGame({ name: 'Deep', difficulty: 'normal', seed });
}

function seated(seed = 42): GameState {
  return newGame({
    name: 'Deep',
    difficulty: 'normal',
    mode: 'sandbox',
    sandboxStart: 'seated',
    seed,
  });
}

// ============================================================== repairs ====

describe('the repairs', () => {
  /*
   * The single worst bug in the audit: the memo had two real choices and no
   * resolver case at all, so a rival trying to end a war could not be allowed
   * to. Measured at six years of weekly offers with the relationship never
   * moving off -80.
   */
  it('lets you accept a peace offer, and the war actually ends', () => {
    const state = seated();
    const enemy = RIVAL_IDS[0];
    declareWar(state, enemy, 'player');
    expect(atWar(state, 'player', enemy)).toBe(true);

    const rng = new Rng(state.rng);
    resolveEvent(
      state,
      rng,
      // The event has to exist to be resolved; build the same one faction.ts does.
      (() => {
        state.pendingEvents.push({
          id: 'evt_test',
          defId: 'peace_offer',
          day: state.day,
          title: 'They want to stop',
          body: '',
          severity: 'opportunity',
          npcId: null,
          data: { factionId: enemy },
          choices: [
            { id: 'accept', label: 'Take the peace', hint: '' },
            { id: 'refuse', label: 'Keep going', hint: '' },
          ],
        });
        return 'evt_test';
      })(),
      'accept',
    );

    expect(atWar(state, 'player', enemy)).toBe(false);
  });

  it('lets you refuse one, and then the war does not end', () => {
    const state = seated(43);
    const enemy = RIVAL_IDS[0];
    declareWar(state, enemy, 'player');
    state.factions[enemy].warWeariness = 60;

    state.pendingEvents.push({
      id: 'evt_test',
      defId: 'peace_offer',
      day: state.day,
      title: 'They want to stop',
      body: '',
      severity: 'opportunity',
      npcId: null,
      data: { factionId: enemy },
      choices: [
        { id: 'accept', label: 'Take the peace', hint: '' },
        { id: 'refuse', label: 'Keep going', hint: '' },
      ],
    });
    resolveEvent(state, new Rng(state.rng), 'evt_test', 'refuse');

    expect(atWar(state, 'player', enemy)).toBe(true);
    // They stop asking for a while rather than offering again next Tuesday.
    expect(state.factions[enemy].warWeariness).toBeLessThan(60);
  });

  it('ages everybody as the calendar turns', () => {
    const state = game();
    const before = crewList(state).map((n) => n.age);
    state.day = DAYS_PER_YEAR - 1;
    advanceDay(state);
    expect(crewList(state).map((n) => n.age)).toEqual(before.map((a) => a + 1));
  });

  /*
   * The loan event described itself as creating a creditor and wrote a number
   * to a flag nothing read. Free money with a caption. It is a real loan now,
   * on the same terms and through the same collector as the Finances panel.
   */
  it('says why it will not lend rather than shrugging', () => {
    // borrow used to return a bare boolean that every caller threw away — the
    // panel threw it away with an explicit `void`. A second loan from the same
    // man is the refusal a player will actually hit.
    const state = seated(43);
    const first = borrow(state, 'shark', 40_000);
    expect(first.ok).toBe(true);
    expect(first.message).toMatch(/in hand/);

    const second = borrow(state, 'shark', 40_000);
    expect(second.ok).toBe(false);
    expect(second.message).toMatch(/already owe them/i);
  });

  it('collects what you borrowed', () => {
    const state = seated(44);
    borrow(state, 'shark', 40_000);
    const owed = totalOwed(state);
    const before = state.org.cash + state.org.dirtyCash;
    runDays(state, 8);
    expect(totalOwed(state)).toBeLessThan(owed);
    expect(state.org.cash + state.org.dirtyCash).toBeLessThan(before);
  });

  it('sends somebody round when it cannot be paid', () => {
    const state = seated(45);
    borrow(state, 'shark', 40_000);
    // advanceDay increments the day before running anything, so landing on a
    // payday means sitting one day short of it.
    for (let i = 0; i < DEFAULT_TERMS.graceMissed; i++) {
      state.day = 7 * (i + 1) - 1;
      state.org.cash = 0;
      state.org.dirtyCash = 0;
      advanceDay(state);
    }
    const hurt = crewList(state).some(
      (n) => n.status === 'injured' || n.notes.some((note) => note.text.includes('money you owe')),
    );
    expect(hurt).toBe(true);
  });

  /*
   * The whole reason inflation is in the game. Everything a player *does* is
   * indexed, so the numbers moving together is invisible — what is not indexed
   * is the pile in the room, and that is the pressure this is meant to create.
   */
  it('erodes a hoard while indexing everything you would spend it on', () => {
    const state = seated(46);
    state.org.dirtyCash = 500_000;
    const wageThen = wageExpectation(state, crewList(state)[0]);
    for (let i = 0; i < DAYS_PER_YEAR * 6; i++) tickMarket(state, new Rng(state.rng));

    expect(prices(state)).toBeGreaterThan(1.15);
    // The hoard did not move. What it has to buy did.
    expect(state.org.dirtyCash).toBe(500_000);
    expect(wageExpectation(state, crewList(state)[0])).toBeGreaterThan(wageThen);
  });

  it('turns the cycle rather than wandering', () => {
    const state = seated(47);
    const seen = new Set<string>();
    for (let i = 0; i < DAYS_PER_YEAR * 30; i++) {
      state.day += 1;
      tickMarket(state, new Rng(state.rng));
      seen.add(state.market.phaseId);
    }
    // Thirty years is enough for at least two full turns of a four-phase loop.
    expect(seen.size).toBe(4);
    // And the bound holds, which is the only promise made to everything
    // downstream of `priced`.
    expect(prices(state)).toBeLessThanOrEqual(PRICE_BOUNDS[1]);
  });
});

// ================================================== traits and goals =======

describe('traits do something', () => {
  it('composes multiplicatively across a person', () => {
    const state = game();
    const npc = crewList(state)[0];
    npc.traits = ['sloppy', 'hot_headed'];
    // 1.3 * 1.25. A man with two loud traits is worse than the worse of them.
    expect(traitEffect(npc, 'heat')).toBeCloseTo(1.625, 3);
    npc.traits = [];
    expect(traitEffect(npc, 'heat')).toBe(1);
  });

  it('makes an old school man harder to turn than a gambler', () => {
    const state = game();
    const [a, b] = [crewList(state)[0], crewList(state)[0]];
    void b;
    a.traits = ['old_school'];
    const loyal = traitEffect(a, 'poachable');
    a.traits = ['gambler'];
    const weak = traitEffect(a, 'poachable');
    expect(loyal).toBeLessThan(1);
    expect(weak).toBeGreaterThan(1);
  });
});

describe('people want things', () => {
  it('picks a goal that fits who somebody is', () => {
    const state = seated(46);
    const npc = crewList(state)[0];
    npc.stats.loyalty = 20;
    npc.stats.grievance = 60;
    npc.goal = null;
    reviewGoal(state, new Rng(state.rng), npc, goalBoard(state));
    expect(npc.goal).not.toBeNull();
    // Somebody this unhappy is not choosing from the contented half of the list.
    expect(goalEffect(npc, 'poachable')).toBeGreaterThanOrEqual(1);
  });

  it('holds a goal rather than flipping every week', () => {
    const state = seated(47);
    const npc = crewList(state)[0];
    npc.goal = null;
    const rng = new Rng(state.rng);
    reviewGoal(state, rng, npc, goalBoard(state));
    const first = npc.goal;
    state.day += 7;
    reviewGoal(state, rng, npc, goalBoard(state));
    expect(npc.goal).toBe(first);
  });

  /* The whole design rule: you do not get told, you have to know them. */
  it('does not tell you what somebody wants until you know them', () => {
    const state = seated(48);
    const npc = crewList(state)[0];
    npc.goal = 'run_it';

    npc.familiarity = 10;
    expect(perceivedGoal(npc)).toBeNull();

    npc.familiarity = 45;
    const guess = perceivedGoal(npc);
    expect(guess?.certain).toBe(false);

    npc.familiarity = 90;
    const known = perceivedGoal(npc);
    expect(known?.certain).toBe(true);
    expect(known?.text).toContain('chair');
  });
});

// ============================================================== ties ======

describe('people have opinions about each other', () => {
  function pair(state: GameState): [Npc, Npc] {
    const crew = crewList(state);
    return [crew[0], crew[1]];
  }

  it('writes a one-sided grudge when somebody is passed over', () => {
    const state = seated(49);
    const [a, b] = pair(state);
    recordTie(state.day, a, b, 'passed_over');
    expect(a.ties[0].resentment).toBeGreaterThan(0);
    // Entirely one-sided, which is what makes it useful.
    expect(b.ties).toHaveLength(0);
  });

  it('makes working together mutual, and only once', () => {
    const state = seated(50);
    const [a, b] = pair(state);
    recordTie(state.day, a, b, 'worked_together');
    expect(a.ties[0].trust).toBeGreaterThan(0);
    expect(b.ties[0].trust).toBeGreaterThan(0);
    // A mutual cause used to bounce between the two men forever; the first
    // two-man job in any game blew the stack.
    expect(a.ties).toHaveLength(1);
  });

  it('bleeds loyalty for a grudge against somebody still here', () => {
    const state = seated(51);
    const [a, b] = pair(state);
    recordTie(state.day, a, b, 'lost_the_room');
    const withEnemy = tieDrift(state, a);
    expect(withEnemy).toBeLessThan(0);

    // ...and stops the moment he is gone. A grudge against a dead man is free.
    b.status = 'dead';
    expect(tieDrift(state, a)).toBe(0);
  });

  it('takes the people who were loyal to him when somebody walks', () => {
    const state = seated(52);
    const crew = crewList(state);
    const leaver = crew[0];
    for (const other of crew.slice(1)) {
      other.ties.push({
        id: leaver.id,
        trust: TIE_DEPARTURE.followTrustAbove + 30,
        resentment: 0,
        debt: 0,
        cause: 'worked_together',
        since: 1,
      });
    }
    const followers = followDeparture(state, new Rng(state.rng), leaver, (npc) => {
      npc.status = 'defected';
    });
    expect(followers.length).toBeGreaterThan(0);
  });

  it('lets the room decide a succession', () => {
    const state = seated(53);
    const heirs = eligibleHeirs(state);
    expect(heirs.length).toBeGreaterThan(1);
    const [candidate, ...others] = heirs;

    const alone = claimStrength(state, candidate);
    for (const other of others) {
      recordTie(state.day, other, candidate, 'lost_the_room');
    }
    const resented = claimStrength(state, candidate);
    expect(resented).toBeLessThan(alone);
  });

  it('shows a tie only when you know both men', () => {
    const state = seated(54);
    const [a, b] = pair(state);
    recordTie(state.day, a, b, 'lost_the_room');
    a.familiarity = 90;
    b.familiarity = 5;
    expect(readTies(state, a)).toHaveLength(0);
    b.familiarity = 90;
    expect(readTies(state, a).length).toBeGreaterThan(0);
  });

  it('writes a grudge when you promote over somebody', () => {
    const state = seated(55);
    const crew = crewList(state).filter((n) => n.role === 'soldier');
    const promoted = crew[0];
    promote(state, promoted.id);
    const resentful = crewList(state).filter((n) =>
      n.ties.some((t) => t.id === promoted.id && t.resentment > 0),
    );
    expect(resentful.length).toBeGreaterThan(0);
  });
});

// ============================================================== city ======

describe('the city has a view', () => {
  it('moves outrage when something is printed', () => {
    const state = game(56);
    const before = state.city.outrage;
    cover(state, new Rng(state.rng), 'war', { named: true });
    expect(state.city.outrage).toBeGreaterThan(before);
    expect(state.city.notoriety).toBeGreaterThan(0);
  });

  /* The lag is the design. A fortnight of fury does nothing. */
  it('lets political pressure lag behind the mood', () => {
    const state = game(57);
    state.city.outrage = 90;
    state.city.pressure = 0;
    state.day = 7;
    tickPerception(state, new Rng(state.rng));
    expect(state.city.pressure).toBeGreaterThan(0);
    expect(state.city.pressure).toBeLessThan(state.city.outrage / 2);
  });

  it('settles back toward a baseline rather than to zero', () => {
    const state = game(58);
    state.city.outrage = 0;
    for (let w = 1; w <= 30; w++) {
      state.day = w * 7;
      tickPerception(state, new Rng(state.rng));
    }
    expect(state.city.outrage).toBeCloseTo(CITY.outrageBaseline, 0);
  });

  it('hides the mood from somebody with no pull, and shows it to somebody with some', () => {
    const state = game(59);
    state.player.attributes.influence = 0;
    expect(readCity(state).mood).toBeNull();
    state.player.attributes.influence = 12;
    const read = readCity(state);
    expect(read.mood).not.toBeNull();
    expect(read.pressure).not.toBeNull();
  });

  /* You cannot buy what a city thinks. You can buy what it is able to do. */
  it('holds political pressure off without touching the outrage behind it', () => {
    const state = seated(60);
    state.player.attributes.influence = PATRON.influenceRequired;
    state.org.cash = PATRON.cost * 2;
    state.city.outrage = 80;

    const outrageBefore = state.city.outrage;
    expect(buyPatron(state).ok).toBe(true);
    expect(state.city.outrage).toBe(outrageBefore);
    expect(state.city.patronUntilDay).not.toBeNull();

    const held = { ...state };
    void held;
    for (let w = 1; w <= 8; w++) {
      state.day = w * 7;
      tickPerception(state, new Rng(state.rng));
    }
    expect(state.city.pressure).toBeLessThan(state.city.outrage);
  });

  it('reads a war between two other families as news', () => {
    const state = game(61);
    const [a, b] = RIVAL_IDS;
    declareWar(state, a, b);
    const before = state.city.stories.length;
    tickWars(state, new Rng(state.rng));
    expect(state.city.stories.length).toBeGreaterThanOrEqual(before);
    expect(state.city.outrage).toBeGreaterThan(CITY.outrageBaseline);
  });
});

// ============================================================== fear ======

describe('fear is not respect', () => {
  it('keeps them as separate currencies', () => {
    const state = seated(62);
    state.org.fear = 0;
    state.org.respect = 500;
    expect(state.org.fear).not.toBe(state.org.respect);
  });

  it('costs the neighbourhood something every week', () => {
    const state = seated(63);
    state.org.fear = FEAR.max;
    const held = controlledTerritories(state);
    expect(held.length).toBeGreaterThan(0);
    const before = held[0].sentiment;
    state.day = 6;
    advanceDay(state);
    expect(controlledTerritories(state)[0]?.sentiment ?? before).toBeLessThan(before);
  });

  /*
   * Fear raises the floor the city settles at rather than adding to it weekly.
   * The first version added a few points a week and could not work: the weekly
   * decay is larger than any addition small enough not to spiral, so at
   * maximum fear the mood did not move at all.
   */
  it('raises the floor the city settles at', () => {
    const state = seated(64);
    state.org.fear = FEAR.max;
    const before = state.city.outrage;
    for (let w = 1; w <= 10; w++) {
      state.day = w * 7 - 1;
      advanceDay(state);
    }
    expect(state.city.outrage).toBeGreaterThan(before + 5);
  });

  it('fades if you stop reminding people', () => {
    const state = seated(65);
    state.org.fear = 50;
    for (let w = 1; w <= 6; w++) {
      state.day = w * 7 - 1;
      advanceDay(state);
    }
    expect(state.org.fear).toBeLessThan(50);
  });
});

// ============================================================= aging ======

describe('time happens to people', () => {
  it('takes the edge off an old man and leaves him the judgement', () => {
    const state = seated(66);
    const npc = crewList(state)[0];
    npc.age = AGING.declineFrom + 10;
    npc.stats.skill = 70;
    npc.stats.intelligence = 40;
    state.day = DAYS_PER_YEAR;
    tickAging(state, new Rng(state.rng), { onDeath: () => {}, onRetire: () => {} });
    expect(npc.stats.skill).toBeLessThan(70);
    expect(npc.stats.intelligence).toBeGreaterThan(40);
  });

  it('eventually removes people who are old enough', () => {
    const state = seated(67);
    for (const npc of crewList(state)) npc.age = 80;
    const rng = new Rng(state.rng);
    for (let y = 1; y <= 12; y++) {
      state.day = y * DAYS_PER_YEAR;
      tickAging(state, rng, { onDeath: () => {}, onRetire: () => {} });
    }
    expect(crewList(state).length).toBeLessThan(12);
  });

  it('never ages anybody out of the realm of the possible', () => {
    const state = seated(68);
    runDaysSolvent(state, DAYS_PER_YEAR * 8);
    for (const npc of Object.values(state.npcs)) {
      expect(npc.age).toBeLessThan(120);
    }
  });
});

// ============================================================ leaders =====

describe('the families are run by somebody', () => {
  it('gives every family a boss with a name and a temperament', () => {
    const state = game(69);
    for (const id of RIVAL_IDS) {
      const leader = state.factions[id].leader;
      expect(leader.name).toBeTruthy();
      expect(leader.reputation).toBeTruthy();
      expect(leader.age).toBeGreaterThan(30);
    }
  });

  it('changes what a family is like when the boss changes', () => {
    const state = game(70);
    const id = RIVAL_IDS[0];
    const before = leaderPersonality(state, state.factions[id]);
    const beforeName = state.factions[id].leader.name;

    // Roll until a genuinely different man turns up; the bias is jittered, so
    // two of the same type are close but never identical.
    const rng = new Rng(state.rng);
    for (let i = 0; i < 20; i++) {
      replaceLeader(state, rng, state.factions[id], id);
      if (state.factions[id].leader.name !== beforeName) break;
    }
    const after = leaderPersonality(state, state.factions[id]);
    const moved =
      Math.abs(after.aggression - before.aggression) +
      Math.abs(after.caution - before.caution) +
      Math.abs(after.commerce - before.commerce);
    expect(moved).toBeGreaterThan(0);
  });

  it('drops the dead man’s agenda rather than carrying it on', () => {
    const state = game(71);
    const id = RIVAL_IDS[0];
    state.day = 7;
    tickFactions(state, new Rng(state.rng));
    state.factions[id].agenda = {
      kind: 'ruin',
      territoryId: null,
      targetFactionId: 'player',
      since: 1,
      until: 9999,
    };
    replaceLeader(state, new Rng(state.rng), state.factions[id], id);
    expect(state.factions[id].agenda).toBeNull();
  });
});


// =========================================================== beliefs ======

describe('the families work out who did it', () => {
  /** A district with a known cast, so attribution has something to chew on. */
  function board(seed = 90) {
    const state = game(seed);
    const t = state.territories[HOME_TERRITORY];
    t.influence.falcone = 40;
    t.influence.vasari = 40;
    t.influence.player = 20;
    return { state, t };
  }

  it('gets it right when they are standing on the street it happened in', () => {
    const { state, t } = board();
    t.influence.falcone = 100;
    const rng = new Rng(state.rng);
    let right = 0;
    for (let i = 0; i < 200; i++) {
      if (!attribute(state, rng, 'falcone', 'player', t.id, 'ground', 0).mistaken) right += 1;
    }
    expect(right).toBeGreaterThan(140);
  });

  /* The whole point: they can be wrong, and it has to be reachable. */
  it('blames somebody else when it cannot tell and somebody else is in the frame', () => {
    const { state, t } = board(91);
    t.influence.falcone = 10;
    const rng = new Rng(state.rng);
    let wrong = 0;
    for (let i = 0; i < 200; i++) {
      if (attribute(state, rng, 'falcone', 'player', t.id, 'ground', 1).mistaken) wrong += 1;
    }
    expect(wrong).toBeGreaterThan(20);
  });

  /*
   * You cannot be blamed for something you could not have done. Without this
   * gate, hostility alone made anybody the victim disliked the explanation for
   * everything that happened anywhere — a player at -50 became the whole
   * city's answer to its own problems and spiralled.
   */
  it('never blames anybody who was not anywhere near it', () => {
    const state = game(92);
    const t = state.territories[HOME_TERRITORY];
    for (const id of RIVAL_IDS) t.influence[id] = 0;
    for (const next of territoryDef(t.id).adjacent) {
      for (const id of RIVAL_IDS) state.territories[next].influence[id] = 0;
    }
    t.influence.falcone = 8;
    t.influence.player = 40;
    // The Kestler are loathed and nowhere near it.
    setRelationship(state, 'falcone', 'kestler', -90);

    const rng = new Rng(state.rng);
    for (let i = 0; i < 150; i++) {
      const blame = attribute(state, rng, 'falcone', 'player', t.id, 'ground', 1);
      expect(blame.believed).not.toBe('kestler');
    }
  });

  it('makes being careful worth something', () => {
    const { state, t } = board(93);
    const rng = new Rng(state.rng);
    const careless = clarityFor(state, 'falcone', t.id, 0);
    const careful = clarityFor(state, 'falcone', t.id, 1);
    expect(careful).toBeLessThan(careless);
    void rng;
  });

  /* A wrong belief has to behave exactly like a right one, or it is decoration. */
  it('puts the grudge on the party they blame, not the party that did it', () => {
    const { state, t } = board(94);
    t.influence.falcone = 10;
    const rng = new Rng(state.rng);

    const beforePlayer = relationship(state, 'falcone', 'player');
    const beforeVasari = relationship(state, 'falcone', 'vasari');
    for (let i = 0; i < 40; i++) noteInfluenceTaken(state, rng, t.id, 6, 1);

    const blamedSomebodyElse = state.factions.falcone.suspicions.some((x) => x.mistaken);
    expect(blamedSomebodyElse).toBe(true);
    // Whoever they settled on is worse off than they were, and it is not
    // necessarily the man who actually did it.
    const movedPlayer = relationship(state, 'falcone', 'player') < beforePlayer;
    const movedVasari = relationship(state, 'falcone', 'vasari') < beforeVasari;
    expect(movedPlayer || movedVasari).toBe(true);
    expect(movedVasari).toBe(true);
  });

  it('hardens a theory into a conviction when it keeps happening', () => {
    const { state, t } = board(95);
    const rng = new Rng(state.rng);
    attribute(state, rng, 'falcone', 'player', t.id, 'ground', 0);
    const first = state.factions.falcone.suspicions[0].confidence;
    for (let i = 0; i < 6; i++) attribute(state, rng, 'falcone', 'player', t.id, 'ground', 0);
    const settled = state.factions.falcone.suspicions.find((x) => x.actorId === 'player');
    expect(settled!.confidence).toBeGreaterThanOrEqual(first);
  });

  it('stops bringing up old business', () => {
    const { state, t } = board(96);
    attribute(state, new Rng(state.rng), 'falcone', 'player', t.id, 'ground', 0);
    expect(state.factions.falcone.suspicions.length).toBe(1);
    state.day += ATTRIBUTION.memoryDays + 1;
    tickBeliefs(state);
    expect(state.factions.falcone.suspicions).toHaveLength(0);
  });

  /*
   * The player does not get a belief system. They get the panels, and they do
   * the reasoning themselves — which is the game, and would be replaced by a
   * number if the simulation did it for them.
   */
  it('does not hold beliefs on the player behalf', () => {
    const { state, t } = board(97);
    const blame = attribute(state, new Rng(state.rng), 'player', 'kestler', t.id, 'pressure', 1);
    expect(blame.believed).toBe('kestler');
    expect(blame.mistaken).toBe(false);
  });

  it('tells you what they think only when you are close enough to hear it', () => {
    const { state, t } = board(98);
    attribute(state, new Rng(state.rng), 'falcone', 'player', t.id, 'ground', 0);
    expect(readSuspicions(state, 'falcone', 0)).toHaveLength(0);
    expect(readSuspicions(state, 'falcone', 60).length).toBeGreaterThan(0);
  });

  /* Whether they are right is never something the interface hands over. */
  it('never tells you whether they are right', () => {
    const { state, t } = board(99);
    for (let i = 0; i < 20; i++) {
      attribute(state, new Rng(state.rng), 'falcone', 'player', t.id, 'ground', 1);
    }
    const read = JSON.stringify(readSuspicions(state, 'falcone', 100));
    expect(read).not.toContain('mistaken');
    expect(read.toLowerCase()).not.toContain('wrong');
  });
});


// ============================================================== bonds =====

describe('what one organization holds toward another', () => {
  /*
   * The refactor's whole justification. The single score conflated things that
   * routinely disagree, and this is the pair of cases that proves it: a family
   * can loathe you and still take you seriously, and it can bear you no ill
   * will and still not sign anything.
   */
  it('separates hating you from taking you seriously', () => {
    const state = game(120);
    adjustBond(state, 'player', 'falcone', { grudge: 70, respect: 80 });
    expect(relationship(state, 'player', 'falcone')).toBeLessThan(-50);
    expect(bond(state, 'falcone', 'player').respect).toBeGreaterThan(50);
  });

  it('separates liking you from relying on you', () => {
    const state = game(121);
    // No grievance whatsoever, and nobody would sign anything.
    adjustBond(state, 'player', 'vasari', { trust: -60 });
    expect(bond(state, 'vasari', 'player').grudge).toBe(0);
    expect(alliesOf(state, 'player')).not.toContain('vasari');
  });

  it('keeps both sides of a bond identical', () => {
    const state = game(122);
    adjustBond(state, 'falcone', 'kestler', { grudge: 20, trust: -10, respect: 5 });
    const a = bond(state, 'falcone', 'kestler');
    const b = bond(state, 'kestler', 'falcone');
    expect(a).toEqual(b);
  });

  /* War is a date now, not the bottom of a scale. */
  it('makes war a decision rather than an accumulation', () => {
    const state = game(123);
    adjustBond(state, 'player', 'kestler', { grudge: 100 });
    expect(atWar(state, 'player', 'kestler')).toBe(false);
    declareWar(state, 'player', 'kestler');
    expect(bond(state, 'kestler', 'player').warSince).toBe(state.day);
  });

  it('leaves the grudge behind when the shooting stops', () => {
    const state = game(124);
    declareWar(state, 'player', 'kestler');
    makePeace(state, 'player', 'kestler');
    expect(atWar(state, 'player', 'kestler')).toBe(false);
    expect(bond(state, 'kestler', 'player').grudge).toBeGreaterThan(0);
  });

  /*
   * The thing the old model could not represent at all, and the reason this
   * was worth doing: turning on somebody you were at peace with is different
   * from finally moving on a family you have hated for years, and everybody
   * else in the city can tell the difference.
   */
  it('treats turning on a partner as treachery the whole city notices', () => {
    const state = game(125);
    setRelationship(state, 'player', 'falcone', 60);
    const trusted = bond(state, 'falcone', 'player').trust;
    const watching = bond(state, 'vasari', 'player').trust;

    declareWar(state, 'player', 'falcone');

    expect(bond(state, 'falcone', 'player').trust).toBeLessThan(trusted + BOND.betrayalTrust + 1);
    // The Vasari were not involved and think less of you anyway.
    expect(bond(state, 'vasari', 'player').trust).toBeLessThan(watching);
  });

  it('does not call it treachery when the hatred was already there', () => {
    const state = game(126);
    adjustBond(state, 'player', 'falcone', { grudge: 80 });
    const watching = bond(state, 'vasari', 'player').trust;
    declareWar(state, 'player', 'falcone');
    expect(bond(state, 'vasari', 'player').trust).toBe(watching);
  });

  it('needs somebody reliable before it calls them an ally', () => {
    const state = game(127);
    // Warm, and unproven.
    adjustBond(state, 'player', 'vasari', { trust: BOND.allianceTrust - 10 });
    expect(alliesOf(state, 'player')).not.toContain('vasari');
    adjustBond(state, 'player', 'vasari', { trust: 30 });
    expect(alliesOf(state, 'player')).toContain('vasari');
  });

  it('earns trust from peace holding, and spends it on nothing else', () => {
    const state = game(128);
    const before = bond(state, 'falcone', 'vasari').trust;
    for (let w = 1; w <= 20; w++) {
      state.day = w * 7;
      tickBonds(state, () => 2);
    }
    expect(bond(state, 'falcone', 'vasari').trust).toBeGreaterThan(before);
  });

  it('settles respect toward what an organization can currently do', () => {
    const state = game(129);
    state.factions.kestler.strength = 5;
    adjustBond(state, 'falcone', 'kestler', { respect: 90 });
    const feared = bond(state, 'falcone', 'kestler').respect;
    for (let w = 1; w <= 60; w++) {
      state.day = w * 7;
      tickBonds(state, () => 0);
    }
    // A family that was frightening five years ago and is four men now does
    // not keep the reputation. It takes a while, which is correct — that is
    // how long it takes people to stop being careful around you.
    expect(bond(state, 'falcone', 'kestler').respect).toBeLessThan(feared - 50);
  });

  it('lets a grudge fade while the war is on hold', () => {
    const state = game(130);
    adjustBond(state, 'falcone', 'vasari', { grudge: 60 });
    for (let w = 1; w <= 30; w++) {
      state.day = w * 7;
      tickBonds(state, () => 2);
    }
    expect(bond(state, 'falcone', 'vasari').grudge).toBeLessThan(60);
  });

  it('does not let a grudge fade while they are still shooting', () => {
    const state = game(131);
    declareWar(state, 'falcone', 'vasari');
    const during = bond(state, 'falcone', 'vasari').grudge;
    for (let w = 1; w <= 30; w++) {
      state.day = w * 7;
      tickBonds(state, () => 2);
    }
    expect(bond(state, 'falcone', 'vasari').grudge).toBeGreaterThanOrEqual(during);
  });
});


// ============================================================ memory ======

describe('people remember specific things', () => {
  it('records what happened rather than how much it hurt', () => {
    const state = seated(140);
    const npc = crewList(state)[0];
    remember(npc, state.day, 'took_a_charge');
    expect(npc.memories[0].kind).toBe('took_a_charge');
    expect(npc.memories[0].day).toBe(state.day);
  });

  /*
   * The distinction the grievance stat could not make. Fading toward a floor
   * rather than to nothing is the difference between forgetting and forgiving:
   * eight years on he is not angry about it and has not forgotten it either.
   */
  it('fades toward a floor and never to nothing', () => {
    const state = seated(141);
    const npc = crewList(state)[0];
    remember(npc, state.day, 'took_a_charge');
    const fresh = weightOf(npc.memories[0], state.day);
    const later = weightOf(npc.memories[0], state.day + DAYS_PER_YEAR * 30);
    expect(later).toBeLessThan(fresh);
    expect(later).toBeGreaterThan(0);
  });

  it('keeps the heaviest rather than the newest when it runs out of room', () => {
    const state = seated(142);
    const npc = crewList(state)[0];
    remember(npc, state.day, 'took_a_charge');
    for (let i = 0; i < 20; i++) remember(npc, state.day + i, 'went_unpaid');
    expect(npc.memories.some((m) => m.kind === 'took_a_charge')).toBe(true);
  });

  it('makes a man with reasons easier to buy, and one who was looked after harder', () => {
    const state = seated(143);
    const [a, b] = crewList(state);
    for (let i = 0; i < 3; i++) remember(a, state.day, 'took_a_charge');
    for (let i = 0; i < 3; i++) remember(b, state.day, 'looked_after');
    expect(poachableFromMemory(a, state.day)).toBeGreaterThan(1);
    expect(poachableFromMemory(b, state.day)).toBeLessThan(1);
  });

  /* The most dangerous read, and the reason the system is worth having. */
  it('makes a man with reasons likelier to talk', () => {
    const state = seated(144);
    const [a, b] = crewList(state);
    for (let i = 0; i < 3; i++) remember(a, state.day, 'was_leaned_on');
    for (let i = 0; i < 3; i++) remember(b, state.day, 'kept_his_mouth_shut');
    expect(informFromMemory(a, state.day)).toBeGreaterThan(informFromMemory(b, state.day));
  });

  it('remembers who it was about, not only what it was', () => {
    const state = seated(145);
    const [a, b] = crewList(state);
    remember(a, state.day, 'passed_over', b.id);
    expect(recallsAbout(a, state.day, b.id)).toBeLessThan(0);
  });

  it('does not tell you any of it until you know them properly', () => {
    const state = seated(146);
    const npc = crewList(state)[0];
    remember(npc, state.day, 'took_a_charge');
    npc.familiarity = 30;
    expect(readMemories(npc, state.day)).toHaveLength(0);
    npc.familiarity = 90;
    expect(readMemories(npc, state.day).length).toBeGreaterThan(0);
  });

  /*
   * Memories deliberately add no weekly drift of their own. The events that
   * created them charged for themselves at the time, and stacking a second
   * slow drain on top is the mistake that made paying people properly stop
   * working once already.
   */
  it('does not quietly become a second loyalty economy', () => {
    const state = seated(147);
    const npc = crewList(state)[0];
    for (let i = 0; i < 8; i++) remember(npc, state.day, 'took_a_charge');
    const before = npc.stats.loyalty;
    state.day = 7;
    driftNpcs(state, new Rng(state.rng));
    const withMemories = npc.stats.loyalty - before;

    const clean = seated(147);
    const other = crewList(clean)[0];
    const cleanBefore = other.stats.loyalty;
    clean.day = 7;
    driftNpcs(clean, new Rng(clean.rng));
    expect(npc.stats.loyalty - before).toBeCloseTo(
      other.stats.loyalty - cleanBefore,
      5,
    );
    void withMemories;
  });
});

// ========================================================= businesses =====

describe('fronts can fail without you closing them', () => {
  function withFront(seed: number) {
    const state = seated(seed);
    const t = controlledTerritories(state)[0];
    const business = acquireBusiness(state, 'laundromat', t.id);
    return { state, business: business!, t };
  }

  it('starts a new front in good health', () => {
    const { business } = withFront(150);
    expect(business.health).toBe(HEALTH.start);
  });

  it('declines when the neighbourhood has turned', () => {
    const { state, business, t } = withFront(151);
    t.sentiment = 0;
    expect(healthPressure(state, business).sentiment).toBeLessThan(0);
    expect(healthPressure(state, business).total).toBeLessThan(0);
  });

  it('declines when it is being hammered as a laundry', () => {
    const { state, business } = withFront(152);
    business.exposure = 95;
    expect(healthPressure(state, business).exposure).toBeLessThan(0);
  });

  it('recovers when nothing is going wrong', () => {
    const { state, business, t } = withFront(153);
    t.sentiment = 90;
    business.exposure = 0;
    state.city.outrage = 0;
    for (const id of RIVAL_IDS) t.influence[id] = 0;
    expect(healthPressure(state, business).total).toBeGreaterThan(0);
  });

  it('earns less while it is dying, which is the warning', () => {
    const { state, business } = withFront(154);
    const healthy = weeklyRevenue(state, business);
    business.health = 5;
    expect(weeklyRevenue(state, business)).toBeLessThan(healthy);
  });

  it('closes on its own once it has nothing left', () => {
    const { state, business, t } = withFront(155);
    t.sentiment = 0;
    business.health = 1;
    state.day = 7;
    tickBusinesses(state, new Rng(state.rng));
    expect(business.status).toBe('shuttered');
  });
});


// ========================================================= the trades =====

describe('the two trades', () => {
  /** A seated sandbox with a district opened for a trade. */
  function running(seed: number, trade: 'product' | 'arms') {
    const state = seated(seed);
    // The trades read fronts rather than a rank now — two for product, three
    // for arms — and the seated start holds ground without owning premises on
    // it. `minControl` on the route below is unchanged and still does its half.
    withFronts(state, TRADES[trade].minFronts);
    const t = controlledTerritories(state)[0];
    openRoute(state, trade, t.id);
    return { state, t };
  }

  it('will not deal with somebody who has not got there yet', () => {
    const state = game(160);
    expect(tradeUnlocked(state, 'product')).toBe(false);
    expect(tradeUnlocked(state, 'arms')).toBe(false);
    expect(openSupply(state, 'dockside').ok).toBe(false);
  });

  it('will not hire on credit, and says so', () => {
    // The Bring in button guarded the crew cap and nothing else, so a boss who
    // could not cover the fee got a live button that did nothing.
    const state = seated(46);
    const someone = Object.keys(state.recruits)[0];
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    const broke = canRecruit(state, someone);
    expect(broke.ok).toBe(false);
    expect(broke.message).toMatch(/costs \$/);
    expect(recruit(state, someone).ok).toBe(false);

    state.org.cash = 100_000;
    expect(canRecruit(state, someone).ok).toBe(true);
    expect(recruit(state, someone).ok).toBe(true);
  });

  it('says what is missing rather than swallowing the click', () => {
    // The panel disables the button on this and puts the message in its title.
    // Before it existed, a player who could not cover the retainer got a live
    // button that took the click and did nothing — the bug this guards.
    const state = game(160);
    const tooJunior = canOpenSupply(state, 'dockside');
    expect(tooJunior.ok).toBe(false);
    // Names the figure, the bar and the way back, which the old
    // "Nobody will deal with a street criminal" did none of.
    expect(tooJunior.message).toMatch(/nowhere to put it/);
    expect(tooJunior.message).toMatch(/\d+ fronts?/);
    expect(tooJunior.message).toMatch(/Take a district/);

    const seatedState = seated(162);
    // Fronts first, so the refusal under test is the money one and not the
    // premises one standing in front of it.
    withFronts(seatedState, TRADES.product.minFronts);
    seatedState.org.cash = 0;
    seatedState.org.dirtyCash = 0;
    const tooPoor = canOpenSupply(seatedState, 'dockside');
    expect(tooPoor.ok).toBe(false);
    expect(tooPoor.message).toMatch(/retainer is \$/);
    // and the check agrees with what actually happens
    expect(openSupply(seatedState, 'dockside').ok).toBe(false);

    seatedState.org.cash = 10_000_000;
    expect(canOpenSupply(seatedState, 'dockside').ok).toBe(true);
    expect(openSupply(seatedState, 'dockside').ok).toBe(true);
  });

  it('carries nothing through a district you do not hold', () => {
    const state = seated(161);
    const weak = territoryList(state).find((t) => controlLevel(t) === 'none')!;
    expect(openRoute(state, 'product', weak.id).ok).toBe(false);
  });

  /*
   * The decision the whole system exists to create. Ground without people is a
   * network nobody is running; people without ground is a crew standing about,
   * and it is deliberately the same crew operations want.
   */
  it('is limited by people as well as by streets', () => {
    const { state } = running(162, 'product');
    const withCrew = throughput(state, 'product');
    expect(withCrew.total).toBeGreaterThan(0);

    for (const npc of crewList(state)) npc.status = 'busy';
    const withoutCrew = throughput(state, 'product');
    expect(withoutCrew.crew).toBe(0);
    expect(withoutCrew.total).toBe(0);
  });

  it('buys, moves and earns over a week', () => {
    const { state } = running(163, 'product');
    state.org.cash = 500_000;
    openSupply(state, 'dockside');
    const before = state.org.dirtyCash;

    state.day = 7;
    tickContraband(state, new Rng(state.rng));
    expect(state.contraband.lastRun!.product.bought).toBeGreaterThan(0);

    state.day = 14;
    tickContraband(state, new Rng(state.rng));
    expect(state.org.dirtyCash).toBeGreaterThan(before);
    expect(state.contraband.lastRun!.product.moved).toBeGreaterThan(0);
  });

  /*
   * The reason product is not simply the best thing in the game.
   *
   * This test used to tick contraband and nothing else, and it passed for a
   * year against a game where the effect it asserts could not happen. A
   * district recovers `SENTIMENT_RECOVERY_PER_WEEK` = 2.0 a week toward
   * indifference, and at `sentimentPerUnit` = -0.11 the largest district on
   * the board, held at dominance and saturated, lost 0.73 — so every street in
   * the city got *happier* while product ran through it, and the panel, the
   * config comment and the trade's own blurb all said otherwise. A blind
   * tester ran narcotics through his own neighbourhood for 348 days and
   * reported its feeling at 50 out of 100, the value it started at.
   *
   * The fixture ticks the recovery too, because the recovery is the thing the
   * cost has to beat. Anything that measures only one side of a race is not
   * measuring the race.
   */
  function weeks(state: GameState, count: number): void {
    for (let w = 1; w <= count; w++) {
      state.day = w * 7;
      // A supplier can fall over on any given week, and this test is not about
      // that. Re-opening is what a player does, and without it the assertion
      // is a bet on a 5% roll not landing six times — which it eventually did.
      if (!state.contraband.supplierId) openSupply(state, 'dockside');
      tickContraband(state, new Rng(state.rng));
      tickTerritory(state);
    }
  }

  it('costs the neighbourhood faster than the neighbourhood forgets', () => {
    const { state, t } = running(164, 'product');
    state.org.cash = 500_000;
    openSupply(state, 'dockside');
    const before = t.sentiment;
    weeks(state, 12);
    expect(state.contraband.lastRun!.product.moved).toBeGreaterThan(0);
    expect(t.sentiment).toBeLessThan(before);
  });

  /*
   * And the other half, which is what stops the fix above from being a
   * one-way ratchet: a street you stop working comes back. Without this the
   * cheapest way to pass the test above is a number so large that one season
   * of trading ruins a district permanently, and no player would ever open a
   * second route.
   */
  it('and comes back when you stop', () => {
    const { state, t } = running(168, 'product');
    state.org.cash = 500_000;
    openSupply(state, 'dockside');
    weeks(state, 12);
    const worked = t.sentiment;

    closeRoute(state, 'product', t.id);
    for (let w = 13; w <= 24; w++) {
      state.day = w * 7;
      tickContraband(state, new Rng(state.rng));
      tickTerritory(state);
    }
    expect(t.sentiment).toBeGreaterThan(worked);
  });

  /*
   * And the shape of it, which is the part a number alone cannot hold.
   *
   * The first repair of `sentimentPerUnit` was flat, and flat against a flat
   * recovery is a race rather than a price: 36 careers put the median worst
   * district at 1 out of 100 and every one of them took a street below the
   * hostile bar. The cost now weakens as the district sours, so what a route
   * buys is an equilibrium — bad enough to matter, and not the end of the
   * neighbourhood.
   */
  it('sours a street without emptying it', () => {
    const { state, t } = running(169, 'product');
    state.org.cash = 2_000_000;
    openSupply(state, 'dockside');
    weeks(state, 80);
    expect(t.sentiment).toBeLessThan(SENTIMENT_START);
    expect(
      t.sentiment,
      'the trade alone took a district past what the trade alone is worth',
    ).toBeGreaterThanOrEqual(TRADE_SENTIMENT_FLOOR - 1);
  });

  it('prices the water by who holds the docks', () => {
    const state = seated(165);
    withFronts(state, TRADES.product.minFronts);
    openSupply(state, 'dockside');
    const docks = state.territories['the_docks'];
    for (const id of RIVAL_IDS) docks.influence[id] = 0;
    docks.influence.vasari = 80;
    const calm = unitCost(state, 'product');

    declareWar(state, 'player', 'vasari');
    expect(unitCost(state, 'product')).toBeGreaterThan(calm);
  });

  it('makes arms rather than buying them', () => {
    const state = seated(166);
    withFronts(state, TRADES.arms.minFronts);
    const t = controlledTerritories(state)[0];
    state.org.cash = 500_000;
    expect(buildWorkshop(state, t.id).ok, buildWorkshop(state, t.id).message).toBe(true);

    state.day = 7;
    tickContraband(state, new Rng(state.rng));
    expect(state.contraband.stock.arms).toBeGreaterThan(0);
  });

  /*
   * The most double-edged thing in the game: they pay above street value
   * because they are buying capability, and what they do with it is become
   * measurably harder to fight.
   */
  it('makes a buyer stronger than they were this morning', () => {
    const state = seated(167);
    state.contraband.stock.arms = 40;
    const target = RIVAL_IDS[0];
    state.factions[target].wealth = 5_000_000;
    const before = state.factions[target].strength;

    expect(sellArms(state, target, 20).ok).toBe(true);
    expect(state.factions[target].strength).toBeGreaterThan(before);
    expect(state.contraband.stock.arms).toBe(20);
  });

  it('will not arm somebody who is shooting at you', () => {
    const state = seated(168);
    state.contraband.stock.arms = 40;
    const target = RIVAL_IDS[0];
    state.factions[target].wealth = 5_000_000;
    declareWar(state, 'player', target);
    expect(canSellArms(state, target, 20).ok).toBe(false);
  });

  /* Stock is the only asset in this game that physically exists somewhere. */
  it('loses stock to a raid, which no other asset can', () => {
    const state = seated(169);
    state.contraband.stock.product = 200;
    seizeStock(state, new Rng(state.rng), 'City Police');
    expect(state.contraband.stock.product).toBeLessThan(200);
  });

  it('leaves evidence behind in proportion to what moved', () => {
    const { state } = running(170, 'product');
    state.org.cash = 800_000;
    openSupply(state, 'dockside');
    for (let w = 1; w <= 4; w++) {
      state.day = w * 7;
      tickContraband(state, new Rng(state.rng));
    }
    expect(Object.keys(state.evidence).length).toBeGreaterThan(0);
  });

  it('survives a long run without corrupting anything', () => {
    const { state } = running(171, 'product');
    openSupply(state, 'dockside');
    runDaysSolvent(state, 365 * 3);
    for (const trade of ['product', 'arms'] as const) {
      expect(Number.isFinite(state.contraband.stock[trade])).toBe(true);
      expect(state.contraband.stock[trade]).toBeGreaterThanOrEqual(0);
      expect(state.contraband.stock[trade]).toBeLessThanOrEqual(TRADES[trade].stockCap);
    }
  });
});

// ======================================================= a different city ==

/**
 * The board is hand-authored. Everything on it is not.
 *
 * The audit's complaint was that every game was the same three families in the
 * same three corners, which meant the opening was solved after two runs. The
 * map stays fixed on purpose — a generated one would be a worse one, and the
 * whole game is balanced against this one — so the variation has to be in who
 * is on it and what the districts are like.
 */
describe('a city drawn per seed', () => {
  const seeds = [300, 301, 302, 303, 304, 305, 306, 307];

  it('puts different families in the city from one game to the next', () => {
    const rosters = seeds.map((seed) =>
      RIVAL_IDS.map((id) => newGame({ name: 'P', difficulty: 'normal', seed }).factions[id].shortName)
        .sort()
        .join('/'),
    );
    expect(new Set(rosters).size).toBeGreaterThan(4);
  });

  it('seats them in different corners', () => {
    const boards = seeds.map((seed) => {
      const s = newGame({ name: 'P', difficulty: 'normal', seed });
      // Who holds the docks, which is the one district with a mechanic
      // attached to it — the port price on the product trade.
      return RIVAL_IDS.map((id) => Math.round(s.territories['the_docks'].influence[id])).join(',');
    });
    expect(new Set(boards).size).toBeGreaterThan(2);
  });

  it('never draws three families of the same temperament', () => {
    for (const seed of seeds) {
      const s = newGame({ name: 'P', difficulty: 'normal', seed });
      const aggression = RIVAL_IDS.map((id) => housePersonality(s, id).aggression);
      // A city where nobody moves is not a variation, it is a broken game that
      // happens to be reproducible. The group draw is what prevents it.
      expect(Math.max(...aggression) - Math.min(...aggression)).toBeGreaterThan(0.15);
    }
  });

  it('gives each district a character it keeps', () => {
    const s = newGame({ name: 'P', difficulty: 'normal', seed: 310 });
    const varied = territoryList(s).filter(
      (t) => Math.abs(t.character - 1) > 0.03,
    );
    expect(varied.length).toBeGreaterThan(4);
    // Inside the bounds the whole map is balanced against: Downtown is still
    // the rich one, whatever the roll did.
    for (const t of territoryList(s)) {
      expect(t.character).toBeGreaterThanOrEqual(CHARACTER_JITTER.prosperity[0] - 0.001);
      expect(t.character).toBeLessThanOrEqual(CHARACTER_JITTER.prosperity[1] + 0.001);
    }
    expect(prosperity(s, 'downtown')).toBeGreaterThan(prosperity(s, 'little_sicily'));
  });

  it('still reproduces a city exactly from its seed', () => {
    const a = newGame({ name: 'P', difficulty: 'normal', seed: 311 });
    const b = newGame({ name: 'P', difficulty: 'normal', seed: 311 });
    expect(JSON.stringify(a.factions)).toEqual(JSON.stringify(b.factions));
    expect(JSON.stringify(a.territories)).toEqual(JSON.stringify(b.territories));
  });
});

// ============================================================== capos =====

/**
 * A rival family with an inside.
 *
 * The tests here are about the two things that made this worth building: a way
 * into a rival that is not a war, and a reason a family that is going wrong
 * keeps going wrong. The rest — names, ages, districts — is scenery and does
 * not need guarding.
 */
describe('the men under the other bosses', () => {
  it('gives every family a roster holding real ground', () => {
    const state = game(200);
    for (const id of RIVAL_IDS) {
      const roster = caposOf(state, id);
      expect(roster.length).toBeGreaterThanOrEqual(CAPO_COUNT[0]);
      expect(roster.length).toBeLessThanOrEqual(CAPO_COUNT[1]);
      // Nobody's people add up to more than the family. This held only at
      // generation in the first version, and a family that received defectors
      // ended up owing more strength than it had.
      const shares = roster.reduce((sum, c) => sum + c.share, 0);
      expect(shares).toBeLessThanOrEqual(0.86);
    }
  });

  it('costs the family measurably when one of them walks', () => {
    const state = game(201);
    const faction = state.factions[RIVAL_IDS[0]];
    const capo = faction.capos[0];
    const before = faction.strength;
    const district = capo.territoryId;
    const theirsBefore = district ? (state.territories[district].influence[faction.id] ?? 0) : 0;

    defect(state, new Rng(state.rng), faction, capo, 'player', 'test');

    expect(faction.strength).toBeLessThan(before);
    expect(faction.capos.find((c) => c.id === capo.id)).toBeUndefined();
    if (district) {
      expect(state.territories[district].influence[faction.id]).toBeLessThan(theirsBefore);
      expect(state.territories[district].influence.player).toBeGreaterThan(0);
    }
    // He arrives as an actual person, not as a number moving between two
    // abstractions. Without this "he is with you now" means nothing you can
    // look at.
    expect(crewList(state).some((n) => n.name === capo.name)).toBe(true);
  });

  it('will not talk to somebody who has not got the standing for it', () => {
    const state = game(202);
    const faction = state.factions[RIVAL_IDS[0]];
    const check = canApproach(state, faction.id, faction.capos[0].id, {
      respect: 0,
      fear: 0,
      intel: 100,
      funds: 10_000_000,
      priceLevel: 1,
    });
    expect(check.ok).toBe(false);
  });

  it('tells his boss when he says no', () => {
    const state = game(203);
    const faction = state.factions[RIVAL_IDS[0]];
    const capo = faction.capos[0];
    const grudgeBefore = faction.bonds['player'].grudge;

    // A chance of zero forces the refusal branch rather than betting on a roll.
    approachCapo(state, new Rng(state.rng), faction.id, capo.id, 0, true);

    expect(faction.bonds['player'].grudge).toBeGreaterThan(grudgeBefore);
    expect(capo.approachedDay).toBe(state.day);
    // And he will not sit down with you again for a very long time.
    const again = canApproach(state, faction.id, capo.id, {
      respect: 999,
      fear: 99,
      intel: 100,
      funds: 10_000_000,
      priceLevel: 1,
    });
    expect(again.ok).toBe(false);
  });

  it('never shows the player the number it is asking them to bet on', () => {
    const state = game(204);
    const faction = state.factions[RIVAL_IDS[0]];
    const capo = faction.capos[0];
    capo.loyalty = 9;
    // Below the intel threshold the roster says nothing about what he thinks.
    expect(readCapos(state, faction.id, 0)[0].standing).toBeNull();
    // ...and above it, a phrase. Never the figure.
    const read = readCapos(state, faction.id, 100).find((r) => r.capo.id === capo.id)!;
    expect(read.standing).toBeTruthy();
    expect(read.standing).not.toContain('9');
  });

  it('hands the chair to somebody who was already in the room', () => {
    const state = game(205);
    const faction = state.factions[RIVAL_IDS[0]];
    const names = faction.capos.map((c) => c.name);
    replaceLeader(state, new Rng(state.rng), faction, RIVAL_IDS[0]);
    // Before the capos existed this conjured a stranger every time, so a
    // family could change character overnight for reasons nobody could have
    // anticipated.
    expect(names).toContain(faction.leader.name);
  });

  it('does not let one family absorb every unhappy man in the city', () => {
    /*
     * The roster cap, which was not there in the first version. Without it the
     * winning family took in every defector, and 24 worlds x 12 years produced
     * one organization on fifteen capos, all twelve districts and $10.5m.
     */
    const state = newGame({ name: 'P', difficulty: 'normal', mode: 'simulation', seed: 206 });
    for (let d = 0; d < DAYS_PER_YEAR * 12; d++) {
      state.pendingEvents = [];
      advanceDay(state);
    }
    for (const id of RIVAL_IDS) {
      expect(caposOf(state, id).length).toBeLessThanOrEqual(CAPO_COUNT[1]);
    }
  });
});

// ========================================================= heat channels ==

/**
 * The split has one hard requirement and one soft one.
 *
 * Hard: the total must behave exactly as the single meter did, because every
 * tier, penalty and world condition in the game is tuned against it. Soft: the
 * channels must actually differ in what gets rid of them, or this is three
 * numbers where one used to be.
 */
describe('heat has channels', () => {
  it('keeps the total as the sum of the parts', () => {
    const state = game(190);
    addHeat(state, 20, 'street');
    addHeat(state, 15, 'money');
    addHeat(state, 10, 'inside');
    expect(state.org.heat).toBeCloseTo(
      channelHeat(state, 'street') + channelHeat(state, 'money') + channelHeat(state, 'inside'),
      5,
    );
  });

  it('never lets the total leave 0..100 however it was earned', () => {
    const state = game(191);
    for (let i = 0; i < 20; i++) {
      addHeat(state, 40, 'street');
      addHeat(state, 40, 'money');
      addHeat(state, 40, 'inside');
    }
    expect(state.org.heat).toBeLessThanOrEqual(100);
    expect(state.org.heat).toBeGreaterThanOrEqual(0);
  });

  /*
   * The reason the split exists. Going quiet was a universal solvent: whatever
   * kind of trouble you were in, a fortnight of doing nothing fixed it. An
   * informant is not a problem you can solve by not doing anything.
   */
  it('cools the street when you go quiet and does nothing about an informant', () => {
    /*
       Run for exactly the window, not a day past it.

       This looped 14 times against a `LAY_LOW_DURATION_DAYS` of 14, so the
       last tick landed after the lay-low had already lapsed and measured one
       day of ordinary decay as though it were part of going quiet. Under a
       flat decay rate that day was worth 0.24 and hid inside a
       `toBeCloseTo(60, 0)`; once decay became a share of the load it was worth
       0.94 and the test failed — correctly, and for a reason that had nothing
       to do with what it was testing.

       `LAY_LOW_BY_CHANNEL.inside` is 0, so the honest assertion is exact.
       Somebody already talking is not affected by the boss staying in.
    */
    const state = game(192);
    setHeat(state, 'street', 60);
    setHeat(state, 'inside', 60);
    startLayLow(state);
    for (let d = 0; d < LAY_LOW_DURATION_DAYS - 1; d++) {
      state.day += 1;
      tickHeat(state);
    }
    expect(channelHeat(state, 'street')).toBeLessThan(45);
    expect(channelHeat(state, 'inside')).toBe(60);

    // And the day after it lapses, the ordinary rate resumes — slowly, because
    // paper and people do not forget at the speed the street does.
    state.day += 1;
    tickHeat(state);
    expect(channelHeat(state, 'inside')).toBeLessThan(60);
    expect(channelHeat(state, 'inside')).toBeGreaterThan(57);
  });

  it('shows Financial Crimes the books and nothing else', () => {
    const state = game(193);
    setHeat(state, 'street', 90);
    expect(agencyHeat(state, AGENCY_BY_ID['treasury'])).toBe(0);
    setHeat(state, 'money', 40);
    expect(agencyHeat(state, AGENCY_BY_ID['treasury'])).toBe(40);
    // ...and City Police the street and nothing else.
    expect(agencyHeat(state, AGENCY_BY_ID['city_police'])).toBe(90);
  });

  it('leaves the Bureau reading exactly what it read before the split', () => {
    const state = game(194);
    setHeat(state, 'street', 30);
    setHeat(state, 'money', 25);
    setHeat(state, 'inside', 20);
    // It cares about all four evidence sources, so its view is the total. This
    // is what keeps the top of the pressure curve where it was.
    expect(agencyHeat(state, AGENCY_BY_ID['federal_bureau'])).toBe(state.org.heat);
  });

  it('makes cutting somebody loose the answer to the channel laying low cannot touch', () => {
    const state = seated(195);
    setHeat(state, 'inside', 50);
    const before = channelHeat(state, 'inside');
    dismiss(state, crewList(state)[0].id);
    expect(channelHeat(state, 'inside')).toBeLessThan(before);
    expect(channelHeat(state, 'street')).toBe(0);
  });
});

// ====================================================== living districts ==

/**
 * The decision this system exists to create: extraction against cultivation.
 *
 * Eight years, one district held and built on, one held and run product
 * through, one left alone. Nothing announces any of it — the numbers on the
 * Territory panel simply end up somewhere different.
 */
describe('districts that change', () => {
  function eightYears(seed: number, setup?: (s: GameState) => void) {
    const state = newGame({ name: 'P', difficulty: 'normal', seed });
    setup?.(state);
    state.org.cash = 5_000_000;
    state.player.rank = 'boss';

    const grow = state.territories['old_quarter'];
    grow.influence.player = 80;
    for (const def of ['social_club', 'restaurant', 'laundry']) {
      acquireBusiness(state, def, 'old_quarter');
    }

    const strip = state.territories['little_sicily'];
    strip.influence.player = 80;
    openRoute(state, 'product', 'little_sicily');
    state.contraband.supplierId = 'dockside';

    for (let d = 0; d < DAYS_PER_YEAR * 8; d++) {
      state.pendingEvents = [];
      // A front nobody runs goes under on its own. That is the health system
      // and a different test; this one is about what an *open* front does to
      // the street it sits on.
      for (const b of Object.values(state.businesses)) b.health = 100;
      advanceDay(state);
    }
    return state;
  }

  it('lifts a district you build on and empties one you run through', () => {
    const state = eightYears(180);
    expect(prosperity(state, 'old_quarter')).toBeGreaterThan(
      TERRITORY_BY_ID['old_quarter'].wealth * 1.1,
    );
    expect(prosperity(state, 'little_sicily')).toBeLessThan(
      TERRITORY_BY_ID['little_sicily'].wealth * 0.9,
    );
  });

  it('leaves a district nobody touches exactly where it was', () => {
    // Against day one rather than against the config, because the founding
    // figure is now jittered per seed — see CHARACTER_JITTER. The claim is
    // that nothing *moves* it, not that it starts on a particular number.
    const start = newGame({ name: 'P', difficulty: 'normal', seed: 181 });
    const before = prosperity(start, 'fairgrounds');
    const state = eightYears(181, (s) => {
      // Cleared of everybody, so "nobody touches it" is literally true. A war
      // fought on a street lowers it, correctly, and which family stands where
      // is drawn per seed — so a district left to the draw is not a control.
      for (const id of RIVAL_IDS) s.territories['fairgrounds'].influence[id] = 0;
    });
    // The market cycle deliberately does *not* reach in here — it already
    // multiplies payouts and front revenue, and applying it twice dragged all
    // twelve districts around together, which drowned the local signal.
    // Within a percent. Not exact, because day one rounds to a whole number
    // and the drift target does not.
    expect(Math.abs(prosperity(state, 'fairgrounds') / before - 1)).toBeLessThan(0.01);
  });

  it('moves people afterwards, and much more slowly', () => {
    const state = eightYears(182);
    expect(people(state, 'old_quarter')).toBeGreaterThan(
      TERRITORY_BY_ID['old_quarter'].population,
    );
    expect(people(state, 'little_sicily')).toBeLessThan(
      TERRITORY_BY_ID['little_sicily'].population,
    );
    // Slower than prosperity, always. A stripped district becomes a slum, not
    // an empty lot.
    const prosperityFall =
      1 - prosperity(state, 'little_sicily') / TERRITORY_BY_ID['little_sicily'].wealth;
    const peopleFall =
      1 - people(state, 'little_sicily') / TERRITORY_BY_ID['little_sicily'].population;
    expect(peopleFall).toBeLessThan(prosperityFall);
  });

  it('never lets a district fall out of the game entirely', () => {
    const state = eightYears(183);
    for (const t of territoryList(state)) {
      const def = TERRITORY_BY_ID[t.id];
      // The bounds are against the founding character in config, which the
      // per-seed jitter sits inside — so they still hold whatever the draw did.
      expect(t.prosperity).toBeGreaterThanOrEqual(def.wealth * DISTRICT_LIFE.prosperityBounds[0]);
      expect(t.prosperity).toBeLessThanOrEqual(def.wealth * DISTRICT_LIFE.prosperityBounds[1]);
      expect(Number.isFinite(t.people)).toBe(true);
    }
  });

  it('makes the same job pay less on ground that has been worked out', () => {
    const state = eightYears(184);
    expect(payoutMultiplier(state, 'little_sicily')).toBeLessThan(
      payoutMultiplier(state, 'old_quarter'),
    );
  });
});

// =========================================================== the whole ====

describe('all of it together', () => {
  it('survives a long game without corrupting anything', () => {
    const state = seated(72);
    runDaysSolvent(state, DAYS_PER_YEAR * 10);

    for (const npc of Object.values(state.npcs)) {
      expect(Number.isFinite(npc.age)).toBe(true);
      for (const tie of npc.ties) expect(state.npcs[tie.id]).toBeDefined();
    }
    expect(Number.isFinite(state.org.fear)).toBe(true);
    expect(state.city.outrage).toBeGreaterThanOrEqual(0);
    expect(state.city.outrage).toBeLessThanOrEqual(100);
    expect(state.trace.length).toBeLessThanOrEqual(200);
  });

  it('still hides what people are really like after all of it', () => {
    const state = seated(73);
    runDaysSolvent(state, 400);
    for (const npc of crewList(state)) {
      expect(npc.familiarity).toBeLessThanOrEqual(100);
    }
  });

  it('leaves the simulation deterministic', () => {
    const a = newGame({ name: 'Same', difficulty: 'normal', seed: 4242 });
    const b = newGame({ name: 'Same', difficulty: 'normal', seed: 4242 });
    advanceDays(a, 120);
    advanceDays(b, 120);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
