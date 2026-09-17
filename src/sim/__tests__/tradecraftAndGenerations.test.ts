/**
 * Tradecraft, the two generations, and the old man who cannot be left out.
 *
 * Three systems, and what is worth pinning down is not the arithmetic but the
 * six facts the design rests on:
 *
 * 1. **The walk is safe and it is not free.** Nothing on any file, no roll at
 *    all, and the evening is gone. A boss who has already spent tonight is
 *    refused, and told what would lift it.
 * 2. **The phone is free until somebody is listening.** A case with a van
 *    outside turns a convenience into 2.5 points of evidence on the strongest
 *    file, itemised on the breakdown that has to explain it.
 * 3. **Who carries the order matters.** A man with no discipline and a temper
 *    is several times likelier to hear something larger than what was said.
 * 4. **The two eras are a real fracture, and position outranks era.** A relic
 *    and a tracksuit in the same chain register it on both ties — unless a
 *    standing gap or a shared border has already explained that pair, in
 *    which case the concrete cause keeps the edge.
 * 5. **An untended old man costs you a file a month, and only once there is a
 *    file.** No case, no bill. Green Grove stops it completely and charges
 *    for the privilege in the one pool that is hard to refill.
 * 6. **The hit is the worst thing a boss can do to the men who made him.**
 *    Every relic on the roster, whether it came off or not.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { generateNpc, crewList } from '../npc';
import { openContract } from '../contract';
import { caposOf } from '../capos';
import { transmitOrder, misfireChance } from '../tradecraft';
import { checkGenerationalFracture, isRelic, isTracksuit } from '../capoTension';
import {
  assignDementiaCare,
  careOf,
  checkDementiaOnset,
  failingCapos,
  tickDementia,
} from '../dementia';
import { TRADECRAFT } from '../../config/tradecraft';
import { CAPO_TENSION } from '../../config/capoTension';
import { DEMENTIA } from '../../config/dementia';
import { TRAIT_BY_ID } from '../../config/npcs';
import { VOICES } from '../../config/voice';
import { DAYS_PER_YEAR } from '../../config/economy';
import type { ContractTarget } from '../contract';
import type { GameState, Investigation, Npc } from '../types';
import type { StageId } from '../../config/lawEnforcement';

function game(seed = 909): GameState {
  return newGame({ name: 'Tape', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 6161, calls }), role);
  npc.status = 'active';
  npc.isSkimming = false;
  npc.ties = [];
  npc.familiarity = 0;
  state.npcs[npc.id] = npc;
  return npc;
}

function caseAt(state: GameState, stage: StageId, strength = 40, id = 'case_1'): Investigation {
  const investigation: Investigation = {
    id,
    agencyId: 'federal_bureau',
    stage,
    openedDay: 1,
    stageSince: 1,
    strength,
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
 * Scanned rather than hard-coded, the same way `suburbsModernCrime.test.ts`
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

// ---------------------------------------------------------- the walk ---

describe('the walk, and what it is immune to', () => {
  it('leaves nothing on a file the phone would have fed', () => {
    const state = game();
    const file = caseAt(state, 'surveillance');
    const man = hire(state, 'enforcer', 1);
    const before = file.strength;

    const said = transmitOrder(state, 'walk_and_talk', man, 'the thing on Ferry Street');

    expect(said.ok).toBe(true);
    expect(said.wiretapHeard).toBe(false);
    expect(file.strength).toBe(before);
    expect(file.history).toHaveLength(0);
  });

  it('cannot misfire, however bad the man is', () => {
    const state = game();
    const man = hire(state, 'enforcer', 2);
    man.stats.discipline = 1;
    man.traits = ['hot_headed', 'sloppy'];
    const heatBefore = state.org.heat;

    // Parked where the phone would certainly have gone wrong for this man.
    streamWhere(state, misfireChance(man), true);
    const said = transmitOrder(state, 'walk_and_talk', man, 'the thing on Ferry Street');

    expect(said.misfire).toBe(false);
    expect(said.extraHeat).toBe(0);
    expect(state.org.heat).toBe(heatBefore);
  });

  it('spends the evening, and draws nothing from the causal stream to do it', () => {
    const state = game();
    const man = hire(state, 'enforcer', 3);
    const calls = state.rng.calls;

    transmitOrder(state, 'walk_and_talk', man, 'the thing on Ferry Street');

    expect(state.flags['went_home_day']).toBe(state.day);
    expect(state.rng.calls).toBe(calls);
  });

  it('refuses a night already spoken for, and says what would lift it', () => {
    const state = game();
    const man = hire(state, 'enforcer', 4);
    state.flags['went_home_day'] = state.day;

    const said = transmitOrder(state, 'walk_and_talk', man, 'the thing on Ferry Street');

    expect(said.ok).toBe(false);
    expect(said.message).toMatch(/tomorrow|phone/i);
  });
});

// --------------------------------------------------------- the phone ---

describe('the phone, and who is on the line', () => {
  it('feeds the strongest file once a case has a van outside', () => {
    const state = game();
    caseAt(state, 'surveillance', 20, 'weak');
    const strong = caseAt(state, 'surveillance', 55, 'strong');
    const man = hire(state, 'enforcer', 5);
    man.stats.discipline = 90;
    man.traits = [];
    streamWhere(state, misfireChance(man), false);

    const said = transmitOrder(state, 'phone_euphemism', man, 'the thing on Ferry Street');

    expect(said.wiretapHeard).toBe(true);
    expect(strong.strength).toBeCloseTo(55 + TRADECRAFT.wiretapInterceptionEvidence, 5);
    expect(state.law.investigations['weak'].strength).toBe(20);
  });

  it('itemises what it added, rather than moving a number nothing explains', () => {
    const state = game();
    const file = caseAt(state, 'witnesses');
    const man = hire(state, 'enforcer', 6);
    man.stats.discipline = 90;
    man.traits = [];
    streamWhere(state, misfireChance(man), false);

    transmitOrder(state, 'phone_euphemism', man, 'the thing on Ferry Street');

    expect(file.lastGrowth?.absorbed).toBeCloseTo(TRADECRAFT.wiretapInterceptionEvidence, 5);
    expect(file.lastProgressDay).toBe(state.day);
    expect(file.history).toHaveLength(1);
  });

  it('hears nothing at all while every file is still a rumour', () => {
    const state = game();
    const file = caseAt(state, 'suspicion');
    const man = hire(state, 'enforcer', 7);
    man.stats.discipline = 90;
    man.traits = [];
    streamWhere(state, misfireChance(man), false);

    const said = transmitOrder(state, 'phone_euphemism', man, 'the thing on Ferry Street');

    expect(said.wiretapHeard).toBe(false);
    expect(file.strength).toBe(40);
    expect(file.history).toHaveLength(0);
  });
});

// ------------------------------------------------------- the misfire ---

describe('the metaphor misfire', () => {
  it('is several times likelier on a man with no discipline and a temper', () => {
    const state = game();
    const careful = hire(state, 'enforcer', 8);
    careful.stats.discipline = 90;
    careful.traits = [];
    const liability = hire(state, 'enforcer', 9);
    liability.stats.discipline = 10;
    liability.traits = ['hot_headed'];

    expect(misfireChance(careful)).toBeCloseTo(TRADECRAFT.misfireBaseChance, 5);
    expect(misfireChance(liability)).toBeCloseTo(
      TRADECRAFT.misfireBaseChance *
        TRADECRAFT.misfireDisciplineMultiplier *
        TRADECRAFT.misfireTraitMultiplier,
      5,
    );
    expect(misfireChance(liability)).toBeGreaterThan(misfireChance(careful) * 2);
  });

  it('costs street heat and lands on his own sheet when it fires', () => {
    const state = game();
    const man = hire(state, 'enforcer', 10);
    man.stats.discipline = 20;
    man.traits = ['sloppy'];
    const heatBefore = state.org.heat;
    streamWhere(state, misfireChance(man), true);

    const said = transmitOrder(state, 'phone_euphemism', man, 'the thing on Ferry Street');

    expect(said.misfire).toBe(true);
    expect(said.extraHeat).toBe(TRADECRAFT.misfireHeat);
    expect(state.org.heat).toBeGreaterThan(heatBefore);
    expect(man.notes[0].text).toMatch(/phone/i);
  });

  it('a disciplined man on a quiet week pays nothing for using the phone', () => {
    const state = game();
    const man = hire(state, 'enforcer', 11);
    man.stats.discipline = 90;
    man.traits = [];
    const heatBefore = state.org.heat;
    streamWhere(state, misfireChance(man), false);

    const said = transmitOrder(state, 'phone_euphemism', man, 'the thing on Ferry Street');

    expect(said.ok).toBe(true);
    expect(said.misfire).toBe(false);
    expect(said.wiretapHeard).toBe(false);
    expect(state.org.heat).toBe(heatBefore);
    expect(state.flags['went_home_day']).toBeUndefined();
  });
});

// ---------------------------------------------- wired into a real order ---

describe('a contract given one way or the other', () => {
  /**
   * A career with money and enough men for `CONTRACT.crew`, and somebody in
   * another family worth sending them after.
   */
  function ready(seed = 4): GameState {
    const state = newGame({ name: 'Tester', difficulty: 'normal', seed });
    const rng = new Rng(state.rng);
    for (let i = 0; i < 5; i++) {
      const npc = generateNpc(state, rng, 'soldier');
      npc.status = 'active';
      npc.joinedDay = state.day;
      state.npcs[npc.id] = npc;
    }
    for (const n of crewList(state)) if (n.status !== 'boss') n.status = 'active';
    state.org.dirtyCash = 500_000;
    state.org.respect = 400;
    return state;
  }

  function aCapo(state: GameState): ContractTarget {
    return { kind: 'capo', factionId: 'falcone', capoId: caposOf(state, 'falcone')[0].id };
  }

  it('given nothing, behaves exactly as it always did', () => {
    const state = ready();
    expect(openContract(state, aCapo(state)).ok).toBe(true);
    expect(state.flags['went_home_day']).toBeUndefined();
  });

  it('given on foot, spends the evening as well as the money', () => {
    const state = ready();
    const before = state.org.dirtyCash;

    expect(openContract(state, aCapo(state), false, 'walk_and_talk').ok).toBe(true);

    expect(state.flags['went_home_day']).toBe(state.day);
    expect(state.org.dirtyCash).toBeLessThan(before);
  });

  it('refuses the walk on a night already spoken for, and takes nothing for it', () => {
    const state = ready();
    state.flags['went_home_day'] = state.day;
    const before = state.org.dirtyCash;
    const free = crewList(state).filter((n) => n.status === 'active').length;

    const said = openContract(state, aCapo(state), false, 'walk_and_talk');

    expect(said.ok).toBe(false);
    expect(state.org.dirtyCash).toBe(before);
    expect(crewList(state).filter((n) => n.status === 'active').length).toBe(free);
  });

  it('given down a phone with a van outside, puts the order on a reel', () => {
    const state = ready();
    const file = caseAt(state, 'surveillance', 50);

    expect(openContract(state, aCapo(state), false, 'phone_euphemism').ok).toBe(true);

    expect(file.strength).toBeGreaterThan(50);
    expect(file.history).toHaveLength(1);
  });
});

// ------------------------------------------------------ the two eras ---

describe('the tracksuit, as a trait', () => {
  it('is in the catalogue with the effects that make it a trade rather than a flaw', () => {
    const def = TRAIT_BY_ID['tracksuit'];
    expect(def).toBeDefined();
    expect(def.bias.greed).toBeGreaterThan(0);
    expect(def.bias.discipline).toBeLessThan(0);
    expect(def.bias.skill).toBeGreaterThan(0);
    expect(def.effects.wageExpectation).toBeGreaterThan(1);
    expect(def.effects.exposure).toBeGreaterThan(1);
    expect(def.effects.poachable).toBeGreaterThan(1);
  });

  it('reads as a clash against the old way rather than a mere difference', () => {
    expect(TRAIT_BY_ID['tracksuit'].clashesWith).toContain('old_school');
    expect(TRAIT_BY_ID['tracksuit'].clashesWith).toContain('loyalist');
  });

  it('does not ship mute — it has a voice like every other trait', () => {
    expect(VOICES['tracksuit']).toBeDefined();
    expect(VOICES['tracksuit'].landed.length).toBeGreaterThan(0);
    expect(VOICES['tracksuit'].missed.length).toBeGreaterThan(0);
  });
});

describe('who is on which side of it', () => {
  it('reads a relic off the trait, or off age and rank without one', () => {
    const state = game();
    const young = hire(state, 'capo', 12);
    young.age = 30;
    young.traits = ['old_school'];
    expect(isRelic(young)).toBe(true);

    const untraited = hire(state, 'capo', 13);
    untraited.age = CAPO_TENSION.relicAge;
    untraited.traits = [];
    expect(isRelic(untraited)).toBe(true);

    // Old, and nobody's institution: the age route is capo and above only.
    const soldier = hire(state, 'soldier', 14);
    soldier.age = CAPO_TENSION.relicAge + 10;
    soldier.traits = [];
    expect(isRelic(soldier)).toBe(false);
  });

  it('will not call a young man modern on his age alone', () => {
    const state = game();
    const steady = hire(state, 'soldier', 15);
    steady.age = 24;
    steady.stats.greed = 90;
    steady.stats.discipline = 80;
    expect(isTracksuit(steady)).toBe(false);

    steady.stats.discipline = 10;
    expect(isTracksuit(steady)).toBe(true);

    const traited = hire(state, 'capo', 16);
    traited.age = 60;
    traited.traits = ['tracksuit'];
    expect(isTracksuit(traited)).toBe(true);
  });
});

describe('the generational fracture', () => {
  function pair(state: GameState): { relic: Npc; modern: Npc } {
    const relic = hire(state, 'capo', 17);
    relic.age = 62;
    relic.traits = ['old_school'];
    const modern = hire(state, 'capo', 18);
    modern.age = 28;
    modern.traits = ['tracksuit'];
    return { relic, modern };
  }

  it('lands on both ties, because neither man outranks the other about it', () => {
    const state = game();
    const { relic, modern } = pair(state);
    state.day = CAPO_TENSION.checkIntervalDays;

    checkGenerationalFracture(state);

    const forward = relic.ties.find((t) => t.id === modern.id);
    const back = modern.ties.find((t) => t.id === relic.id);
    expect(forward?.cause).toBe('generational_clash');
    expect(back?.cause).toBe('generational_clash');
    expect(forward!.resentment).toBeGreaterThan(0);
    expect(back!.trust).toBeLessThanOrEqual(0);
  });

  it('reaches a capo and the man who actually answers to him', () => {
    const state = game();
    const relic = hire(state, 'capo', 19);
    relic.age = 62;
    relic.traits = ['old_school'];
    const modern = hire(state, 'soldier', 20);
    modern.age = 26;
    modern.traits = ['tracksuit'];
    modern.reportsTo = relic.id;
    state.day = CAPO_TENSION.checkIntervalDays;

    checkGenerationalFracture(state);

    expect(relic.ties.find((t) => t.id === modern.id)?.cause).toBe('generational_clash');
  });

  it('leaves two men who merely differ alone', () => {
    const state = game();
    const one = hire(state, 'capo', 21);
    one.age = 44;
    one.traits = [];
    one.stats.greed = 30;
    const two = hire(state, 'capo', 22);
    two.age = 46;
    two.traits = [];
    two.stats.greed = 30;
    state.day = CAPO_TENSION.checkIntervalDays;

    checkGenerationalFracture(state);

    expect(one.ties).toHaveLength(0);
    expect(two.ties).toHaveLength(0);
  });

  it('does not overwrite a cause a real standing gap already put there', () => {
    const state = game();
    const { relic, modern } = pair(state);
    state.day = CAPO_TENSION.checkIntervalDays;
    // What `checkCapoPowerImbalance` would have written, on the day it wrote it.
    relic.ties.push({
      id: modern.id,
      trust: 0,
      resentment: 30,
      debt: 0,
      cause: 'lost_the_room',
      since: state.day,
    });

    checkGenerationalFracture(state);

    expect(relic.ties.find((t) => t.id === modern.id)?.cause).toBe('lost_the_room');
  });

  it('runs off the daily loop with nobody calling it directly', () => {
    const state = game();
    const { relic, modern } = pair(state);

    while (state.day < CAPO_TENSION.checkIntervalDays) advanceDay(state);

    expect(relic.ties.find((t) => t.id === modern.id)?.cause).toBe('generational_clash');
  });
});

// -------------------------------------------------- the slipped tongue ---

function failingCapo(state: GameState, calls: number): Npc {
  const capo = hire(state, 'capo', calls);
  capo.age = DEMENTIA.onsetAge + 4;
  capo.dementiaSince = state.day;
  capo.dementiaCare = 'active';
  return capo;
}

describe('a capo whose mind is going', () => {
  it('only ever starts on the day the calendar turns, and only at the table', () => {
    const state = game();
    const capo = hire(state, 'capo', 23);
    capo.age = DEMENTIA.onsetAge + 5;
    const soldier = hire(state, 'soldier', 24);
    soldier.age = DEMENTIA.onsetAge + 20;

    state.day = DAYS_PER_YEAR - 1;
    streamWhere(state, DEMENTIA.onsetChanceAnnual, true);
    checkDementiaOnset(state, new Rng(state.rng));
    expect(capo.dementiaSince).toBeUndefined();

    state.day = DAYS_PER_YEAR;
    streamWhere(state, DEMENTIA.onsetChanceAnnual, true);
    checkDementiaOnset(state, new Rng(state.rng));
    expect(capo.dementiaSince).toBe(state.day);
    expect(soldier.dementiaSince).toBeUndefined();
  });

  it('leaves a soldier out of it entirely, however old he is', () => {
    const state = game();
    for (const npc of crewList(state)) npc.age = 30;
    const soldier = hire(state, 'soldier', 41);
    soldier.age = DEMENTIA.onsetAge + 20;
    state.day = DAYS_PER_YEAR;
    // Parked where every draw it could make would fire. It should make none.
    streamWhere(state, DEMENTIA.onsetChanceAnnual, true);
    const calls = state.rng.calls;

    checkDementiaOnset(state, new Rng(state.rng));

    expect(failingCapos(state)).toHaveLength(0);
    expect(state.rng.calls).toBe(calls);
  });

  it('asks nothing of the stream when nobody at the table is old enough', () => {
    const state = game();
    const capo = hire(state, 'capo', 25);
    capo.age = DEMENTIA.onsetAge - 1;
    state.day = DAYS_PER_YEAR;
    const rng = new Rng(state.rng);
    const calls = state.rng.calls;

    checkDementiaOnset(state, rng);

    expect(state.rng.calls).toBe(calls);
    expect(failingCapos(state)).toHaveLength(0);
  });

  it('puts what he said in public onto the strongest file, itemised', () => {
    const state = game();
    state.day = 7;
    caseAt(state, 'surveillance', 15, 'weak');
    const strong = caseAt(state, 'surveillance', 60, 'strong');
    failingCapo(state, 26);
    streamWhere(state, DEMENTIA.slippedTongueChanceWeekly, true);

    tickDementia(state, new Rng(state.rng));

    expect(strong.strength).toBeCloseTo(60 + DEMENTIA.slippedTongueEvidenceWeekly, 5);
    expect(strong.lastGrowth?.absorbed).toBeCloseTo(DEMENTIA.slippedTongueEvidenceWeekly, 5);
    expect(strong.history[0].obvious).toBe(true);
    expect(state.law.investigations['weak'].strength).toBe(15);
  });

  it('costs nothing at all while there is no file for it to land on', () => {
    const state = game();
    state.day = 7;
    failingCapo(state, 27);
    const calls = state.rng.calls;

    tickDementia(state, new Rng(state.rng));

    expect(state.rng.calls).toBe(calls);
    expect(state.org.heat).toBe(0);
  });
});

describe('wired into the daily loop', () => {
  it('diagnoses a table of old men on the day the calendar turns, uncalled', () => {
    /*
       Across worlds rather than on one seed. The onset chance is 12% a man a
       year and the yearly pass also retires and buries people, so a single
       world can legitimately produce nobody — seed 4242 does, with all twenty
       men still alive. What has to be true is that it happens *somewhere*,
       and with the clock call removed it happens nowhere at all.
    */
    const diagnosed = [1, 2, 3, 7, 99, 4242].map((seed) => {
      const state = game(seed);
      for (let i = 0; i < 20; i++) {
        const capo = hire(state, 'capo', 200 + i);
        capo.age = DEMENTIA.onsetAge + 5;
      }
      state.day = DAYS_PER_YEAR - 1;
      advanceDay(state);
      expect(state.day).toBe(DAYS_PER_YEAR);
      return failingCapos(state).length;
    });

    expect(diagnosed.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('lets an untended old man feed a live file over a season, uncalled', () => {
    const state = game(4242);
    const file = caseAt(state, 'surveillance', 45);
    const capo = failingCapo(state, 42);
    const before = file.strength;

    for (let w = 0; w < 10; w++) advanceDay(state);
    // Eight more weeks of Sundays, so this is the tick rather than one lucky day.
    while (state.day < 70) advanceDay(state);

    expect(capo.dementiaSince).toBeDefined();
    expect(
      file.history.some((h) => h.text.includes('coffee shop')),
      'nothing the old man said ever reached the file',
    ).toBe(true);
    expect(file.strength).toBeGreaterThan(before);
  });
});

describe('the three answers', () => {
  it('Green Grove stops the leak completely', () => {
    const state = game();
    state.day = 7;
    const file = caseAt(state, 'surveillance', 60);
    const capo = failingCapo(state, 28);
    state.org.cash = 50_000;

    expect(assignDementiaCare(state, capo.id, 'golden_cage').ok).toBe(true);
    expect(careOf(capo)).toBe('golden_cage');

    streamWhere(state, DEMENTIA.slippedTongueChanceWeekly, true);
    tickDementia(state, new Rng(state.rng));

    expect(file.strength).toBe(60);
  });

  it('bills for it monthly, out of clean money only', () => {
    const state = game();
    const capo = failingCapo(state, 29);
    state.org.cash = 50_000;
    state.org.dirtyCash = 900_000;
    assignDementiaCare(state, capo.id, 'golden_cage');

    const cleanBefore = state.org.cash;
    const dirtyBefore = state.org.dirtyCash;
    state.day = DEMENTIA.goldenCageIntervalDays;
    tickDementia(state, new Rng(state.rng));

    expect(state.org.cash).toBe(cleanBefore - DEMENTIA.goldenCageCostMonthly);
    expect(state.org.dirtyCash).toBe(dirtyBefore);
  });

  it('sends him home when the account will not cover it', () => {
    const state = game();
    const capo = failingCapo(state, 30);
    state.org.cash = 50_000;
    assignDementiaCare(state, capo.id, 'golden_cage');

    state.org.cash = 0;
    state.day = DEMENTIA.goldenCageIntervalDays;
    tickDementia(state, new Rng(state.rng));

    expect(careOf(capo)).toBe('active');
  });

  it('refuses the room at all when the clean pool is short, and names the figure', () => {
    const state = game();
    const capo = failingCapo(state, 31);
    state.org.cash = 0;
    state.org.dirtyCash = 900_000;

    const said = assignDementiaCare(state, capo.id, 'golden_cage');

    expect(said.ok).toBe(false);
    expect(said.message).toContain(DEMENTIA.goldenCageCostMonthly.toLocaleString('en-US'));
    expect(said.message).toMatch(/clean money/i);
  });

  it('a man on the door is paid for in bodies, and he stops the leak too', () => {
    const state = game();
    state.day = 7;
    const file = caseAt(state, 'surveillance', 60);
    const capo = failingCapo(state, 32);
    hire(state, 'soldier', 33);

    expect(assignDementiaCare(state, capo.id, 'house_guard').ok).toBe(true);
    const minder = state.npcs[capo.dementiaMinderId!];
    expect(minder).toBeDefined();
    expect(minder.status).toBe('busy');
    expect(minder.unavailableUntilDay).toBeNull();

    streamWhere(state, DEMENTIA.slippedTongueChanceWeekly, true);
    tickDementia(state, new Rng(state.rng));
    expect(file.strength).toBe(60);
  });

  it('refuses a minder when every man is out, and says so', () => {
    const state = game();
    const capo = failingCapo(state, 34);
    for (const npc of crewList(state)) {
      if (npc.id !== capo.id) npc.status = 'busy';
    }

    const said = assignDementiaCare(state, capo.id, 'house_guard');

    expect(said.ok).toBe(false);
    expect(said.message).toMatch(/every man you have is out/i);
  });

  it('gives the minder back when the boss pays for the room instead', () => {
    const state = game();
    const capo = failingCapo(state, 35);
    hire(state, 'soldier', 36);
    assignDementiaCare(state, capo.id, 'house_guard');
    const minder = state.npcs[capo.dementiaMinderId!];
    state.org.cash = 50_000;

    assignDementiaCare(state, capo.id, 'golden_cage');

    expect(minder.status).toBe('active');
    expect(capo.dementiaMinderId).toBeUndefined();
  });

  it('detonates every relic on the roster when the answer is the other thing', () => {
    const state = game();
    const capo = failingCapo(state, 37);
    const relic = hire(state, 'capo', 38);
    relic.age = 58;
    relic.traits = ['old_school'];
    relic.stats.grievance = 10;
    relic.stats.loyalty = 80;
    const modern = hire(state, 'soldier', 39);
    modern.age = 26;
    modern.traits = ['tracksuit'];
    modern.stats.grievance = 10;
    modern.stats.loyalty = 80;

    expect(assignDementiaCare(state, capo.id, 'hit').ok).toBe(true);

    expect(relic.stats.grievance).toBe(10 + DEMENTIA.relicGrievanceOnHit);
    expect(relic.stats.loyalty).toBe(80 + DEMENTIA.relicLoyaltyHitOnHit);
    expect(relic.memories[0].kind).toBe('lost_a_friend');
    // Nobody who never knew the old way carries anything about it.
    expect(modern.stats.grievance).toBe(10);
    expect(modern.stats.loyalty).toBe(80);
  });

  it('will not entertain any of it about a man there is nothing wrong with', () => {
    const state = game();
    const well = hire(state, 'capo', 40);

    const said = assignDementiaCare(state, well.id, 'hit');

    expect(said.ok).toBe(false);
    expect(said.message).toContain(well.name);
    expect(well.status).toBe('active');
  });
});
