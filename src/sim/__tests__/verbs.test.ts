/**
 * The seven things only a particular boss can do.
 *
 * See `config/build.ts`. The property that matters most is the one this file
 * checks first and everywhere: **a verb is gated by the build and by nothing
 * else.** If the answer to "why can I not do this" is ever anything except
 * "you did not put the points there", the build has stopped being the decision
 * and the seven stats are decoration again — which is exactly what happened to
 * the eight attributes this replaced.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { spendPoint, statLevel } from '../build';
import { VERB_AT, type StatId } from '../../config/build';
import { VERBS } from '../../config/verbs';
import {
  callEverybodyIn,
  canCallATable,
  canCallEverybodyIn,
  canPlant,
  canPutOnCard,
  canTakeTheWeight,
  cardTake,
  casedBonus,
  caseJob,
  isInside,
  plant,
  putOnCard,
  takeTheWeight,
  tickCard,
} from '../verbs';
import { PAYDAY_INTERVAL } from '../../config/economy';
import type { GameState } from '../types';

function game(seed = 9): GameState {
  const state = newGame({ name: 'Verbs', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  while (crewList(state).filter((n) => n.status !== 'dead').length < 8) {
    const npc = generateNpc(state, rng, 'soldier');
    state.npcs[npc.id] = npc;
  }
  return state;
}

/** Put the points in, which is the only way any of this opens. */
function build(state: GameState, id: StatId, to = VERB_AT[id]): void {
  state.player.points = 99;
  while (statLevel(state, id) < to) spendPoint(state, id);
}

describe('a verb is the build and nothing else', () => {
  it('refuses every one of them to a boss who placed no points', () => {
    const state = game();
    state.territories.northside.influence.player = 90;
    expect(canCallEverybodyIn(state).ok).toBe(false);
    expect(canPutOnCard(state, 'northside').ok).toBe(false);
    expect(canPlant(state, 'the_castellanos').ok).toBe(false);
    expect(canCallATable(state).ok).toBe(false);
  });

  it('says what is missing rather than that the answer is no', () => {
    const state = game();
    expect(canCallEverybodyIn(state).message).toMatch(/kind of boss/i);
  });
});

describe('calling everybody in', () => {
  it('takes the edge off what people are carrying', () => {
    const state = game();
    build(state, 'grip');
    for (const npc of crewList(state)) npc.stats.grievance = 60;

    const out = callEverybodyIn(state);
    expect(out, 'nobody came').toBeTruthy();
    expect(out!.heard.length).toBeGreaterThan(0);
    for (const { npc } of out!.heard) expect(npc.stats.grievance).toBeLessThan(60);
  });

  /*
     And it is not a dial. A room that can be held down with a brick is a
     grievance discount with prose on it.
  */
  it('stops meaning anything if you do it every week', () => {
    const state = game();
    build(state, 'grip');
    expect(callEverybodyIn(state)).toBeTruthy();
    expect(canCallEverybodyIn(state).ok).toBe(false);
    state.day += VERBS.meetingEveryDays;
    expect(canCallEverybodyIn(state).ok).toBe(true);
  });

  it('names who did not come', () => {
    const state = game();
    build(state, 'grip');
    const away = crewList(state)[0];
    away.status = 'arrested';
    const out = callEverybodyIn(state)!;
    expect(out.absent.map((n) => n.id)).toContain(away.id);
  });
});

describe('the card', () => {
  it('will not collect on ground that is not yours', () => {
    const state = game();
    build(state, 'muscle');
    expect(canPutOnCard(state, 'northside').ok).toBe(false);
  });

  it('pays weekly once a district is on it', () => {
    const state = game();
    build(state, 'muscle');
    state.territories.northside.influence.player = 90;
    expect(putOnCard(state, 'northside').ok).toBe(true);

    const before = state.org.dirtyCash;
    state.day = PAYDAY_INTERVAL;
    tickCard(state);
    expect(state.org.dirtyCash, 'the card paid nothing').toBeGreaterThan(before);
  });

  /*
     The whole reason this verb exists. Fear had no demand — measured twice —
     and a racket only a frightening family can hold is the demand.
  */
  it('pays a frightening family far more than a quiet one', () => {
    const quiet = game();
    build(quiet, 'muscle');
    quiet.territories.northside.influence.player = 90;
    putOnCard(quiet, 'northside');

    const feared = game();
    build(feared, 'muscle');
    feared.territories.northside.influence.player = 90;
    putOnCard(feared, 'northside');
    feared.org.fear = 90;

    expect(cardTake(feared)).toBeGreaterThan(cardTake(quiet) * 2);
  });

  it('costs the neighbourhood whether or not the take was worth having', () => {
    const state = game();
    build(state, 'muscle');
    state.territories.northside.influence.player = 90;
    putOnCard(state, 'northside');
    const before = state.territories.northside.sentiment;

    state.day = PAYDAY_INTERVAL;
    tickCard(state);
    expect(state.territories.northside.sentiment).toBeLessThan(before);
  });
});

describe('casing a job', () => {
  it('is worth nothing until the week is up, and then it is worth points', () => {
    const state = game();
    build(state, 'method');
    expect(caseJob(state, 'shakedown', 'northside').ok).toBe(true);

    expect(casedBonus(state, 'shakedown', 'northside')).toBe(0);
    state.day += VERBS.casingDays;
    expect(casedBonus(state, 'shakedown', 'northside')).toBe(VERBS.casedOdds);
  });

  it('is worth nothing to a different job, or the same job somewhere else', () => {
    const state = game();
    build(state, 'method');
    caseJob(state, 'shakedown', 'northside');
    state.day += VERBS.casingDays;
    expect(casedBonus(state, 'shakedown', 'the_docks')).toBe(0);
    expect(casedBonus(state, 'truck_hijacking', 'northside')).toBe(0);
  });
});

describe('taking the weight', () => {
  it('is only offered for somebody they actually have', () => {
    const state = game();
    build(state, 'stomach');
    const man = crewList(state)[0];
    expect(
      canTakeTheWeight(state, man.id).ok,
      'offered for a man who is walking around',
    ).toBe(false);
    man.status = 'arrested';
    man.unavailableUntilDay = state.day + 90;
    expect(canTakeTheWeight(state, man.id).ok).toBe(true);
  });

  it('gets the man out and puts the boss in', () => {
    const state = game();
    build(state, 'stomach');
    const man = crewList(state)[0];
    man.status = 'arrested';
    man.unavailableUntilDay = state.day + 90;

    expect(takeTheWeight(state, man.id).ok).toBe(true);
    expect(man.status).toBe('active');
    expect(isInside(state), 'the boss did not go anywhere').toBe(true);
  });

  /*
     The half that makes it worth more than money. A family decides what it
     believes about the boss by watching what happened to the man who got
     caught — so it lands on everybody, not only on the one it saved.
  */
  it('is worth something to everybody who was watching', () => {
    const state = game();
    build(state, 'stomach');
    const man = crewList(state)[0];
    man.status = 'arrested';
    man.unavailableUntilDay = state.day + 90;
    const others = crewList(state).filter((n) => n.id !== man.id);
    const before = others.map((n) => n.stats.loyalty);

    takeTheWeight(state, man.id);
    others.forEach((n, i) => {
      expect(n.stats.loyalty, `${n.name} did not notice`).toBeGreaterThan(before[i]);
    });
  });
});

describe('planting somebody', () => {
  it('takes a man off the roster while he is in there', () => {
    const state = game();
    build(state, 'instinct');
    const man = crewList(state).find((n) => n.status === 'active')!;
    expect(plant(state, 'the_castellanos', man.id).ok).toBe(true);
    expect(man.status, 'he is still available for jobs').toBe('busy');
  });

  it('will not place more people than a boss can keep track of', () => {
    const state = game();
    build(state, 'instinct');
    const men = crewList(state).filter((n) => n.status === 'active');
    for (let i = 0; i < VERBS.plantsAtOnce; i++) plant(state, `house_${i}`, men[i].id);
    expect(canPlant(state, 'one_more').ok).toBe(false);
  });
});
