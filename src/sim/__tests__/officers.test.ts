/**
 * What the Underboss and the Consigliere make of the people under them.
 *
 * The property that matters is not that a read exists — it is that the same
 * capo, read by two officers who differ only in temperament or in their own
 * tie to him, comes back different. A read that ignores the officer asking it
 * is a fact about the capo, and this is deliberately not that; it is an
 * opinion, biased the way `careerShape`'s header warns a horoscope is not.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { GOAL_CERTAIN_ABOVE } from '../../config/goals';
import { remember } from '../memory';
import {
  consiglierRead,
  underbossOpinion,
  underbossStanding,
} from '../officers';
import type { GameState, Npc } from '../types';

function game(seed = 401): GameState {
  return newGame({ name: 'Officers', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 1717, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

describe('underbossOpinion', () => {
  it('is null when the organization has no Underboss', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    expect(underbossOpinion(state, capo.id)).toBeNull();
  });

  it('is null when the subject does not exist', () => {
    const state = game();
    hire(state, 'underboss', 1);
    expect(underbossOpinion(state, 'nobody')).toBeNull();
  });

  it('reads the same capo differently depending on the Underboss himself', () => {
    // Two careers, otherwise identical, differing only in who the Underboss
    // is and how he already feels about this capo — never in the capo.
    const trusting = game(11);
    const capoA = hire(trusting, 'capo', 1);
    const bossA = hire(trusting, 'underboss', 2);
    bossA.stats.ambition = 5;
    bossA.ties.push({ id: capoA.id, trust: 90, resentment: 0, debt: 0, cause: 'worked_together', since: trusting.day });

    const resentful = game(11);
    const capoB = hire(resentful, 'capo', 1);
    const bossB = hire(resentful, 'underboss', 2);
    bossB.stats.ambition = 95;
    bossB.ties.push({ id: capoB.id, trust: 0, resentment: 90, debt: 0, cause: 'took_the_blame', since: resentful.day });

    const good = underbossOpinion(trusting, capoA.id);
    const bad = underbossOpinion(resentful, capoB.id);
    expect(good).not.toBeNull();
    expect(bad).not.toBeNull();
    expect(good!.tone).toBe('good');
    expect(bad!.tone).toBe('bad');
    expect(good!.text).not.toBe(bad!.text);
  });

  it("is biased by the Underboss's own ambition even off the identical tie", () => {
    // Same tie (trust 40, resentment 20 — mildly, ambiguously positive) in
    // both careers. Only the Underboss's own ambition differs.
    const secureCareer = game(11);
    const capoA = hire(secureCareer, 'capo', 1);
    const secureBoss = hire(secureCareer, 'underboss', 2);
    secureBoss.stats.ambition = 5;
    secureBoss.ties.push({ id: capoA.id, trust: 40, resentment: 20, debt: 0, cause: 'worked_together', since: secureCareer.day });

    const strivingCareer = game(11);
    const capoB = hire(strivingCareer, 'capo', 1);
    const strivingBoss = hire(strivingCareer, 'underboss', 2);
    strivingBoss.stats.ambition = 95;
    strivingBoss.ties.push({ id: capoB.id, trust: 40, resentment: 20, debt: 0, cause: 'worked_together', since: strivingCareer.day });

    const secureRead = underbossOpinion(secureCareer, capoA.id);
    const strivingRead = underbossOpinion(strivingCareer, capoB.id);
    expect(secureRead!.tone).not.toBe(strivingRead!.tone);
  });

  it('gives a neutral read when the Underboss has no history with the man and no strong temperament', () => {
    const state = game(11);
    const capo = hire(state, 'capo', 1);
    const boss = hire(state, 'underboss', 2);
    boss.stats.ambition = 50;
    expect(underbossOpinion(state, capo.id)!.tone).toBe('neutral');
  });
});

describe('consiglierRead', () => {
  it('is null when the organization has no Consigliere', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    expect(consiglierRead(state, capo.id)).toBeNull();
  });

  it('reads the same capo differently depending on the Consigliere himself', () => {
    const trusting = game(12);
    const capoA = hire(trusting, 'capo', 1);
    const advisorA = hire(trusting, 'consigliere', 2);
    advisorA.stats.grievance = 5;
    advisorA.ties.push({ id: capoA.id, trust: 90, resentment: 0, debt: 0, cause: 'worked_together', since: trusting.day });

    const bitter = game(12);
    const capoB = hire(bitter, 'capo', 1);
    const advisorB = hire(bitter, 'consigliere', 2);
    advisorB.stats.grievance = 95;
    advisorB.ties.push({ id: capoB.id, trust: 0, resentment: 90, debt: 0, cause: 'took_the_blame', since: bitter.day });

    const good = consiglierRead(trusting, capoA.id);
    const bad = consiglierRead(bitter, capoB.id);
    expect(good!.tone).toBe('good');
    expect(bad!.tone).toBe('bad');
    expect(good!.text).not.toBe(bad!.text);
  });
});

describe('underbossStanding', () => {
  it('is null when there is no Underboss', () => {
    const state = game();
    expect(underbossStanding(state)).toBeNull();
  });

  it('is null when the player does not know the Underboss well enough yet', () => {
    const state = game();
    const boss = hire(state, 'underboss', 1);
    boss.familiarity = GOAL_CERTAIN_ABOVE - 1;
    expect(underbossStanding(state)).toBeNull();
  });

  it('reads higher for an Underboss who actually runs a room than one who holds the title alone', () => {
    const bare = game(21);
    const weakBoss = hire(bare, 'underboss', 1);
    weakBoss.familiarity = GOAL_CERTAIN_ABOVE;
    weakBoss.stats.leadership = 5;
    weakBoss.daysInCrew = 10;

    const seated = game(22);
    const strongBoss = hire(seated, 'underboss', 1);
    strongBoss.familiarity = GOAL_CERTAIN_ABOVE;
    strongBoss.stats.leadership = 95;
    strongBoss.daysInCrew = 400;
    for (let i = 0; i < 4; i++) {
      const soldier = hire(seated, 'soldier', 2 + i);
      soldier.reportsTo = strongBoss.id;
    }

    const weak = underbossStanding(bare);
    const strong = underbossStanding(seated);
    expect(weak).not.toBeNull();
    expect(strong).not.toBeNull();
    expect(strong!.tier).toBeGreaterThan(weak!.tier);
  });

  it('reads higher for headcount and tenure alone, with perceived leadership held identical', () => {
    const fresh = game(23);
    const freshBoss = hire(fresh, 'underboss', 1);
    freshBoss.familiarity = GOAL_CERTAIN_ABOVE;
    freshBoss.stats.leadership = 50;
    freshBoss.daysInCrew = 5;

    const seasoned = game(24);
    const seasonedBoss = hire(seasoned, 'underboss', 1);
    seasonedBoss.familiarity = GOAL_CERTAIN_ABOVE;
    seasonedBoss.stats.leadership = 50;
    seasonedBoss.daysInCrew = 400;
    for (let i = 0; i < 4; i++) {
      const soldier = hire(seasoned, 'soldier', 2 + i);
      soldier.reportsTo = seasonedBoss.id;
    }

    expect(underbossStanding(seasoned)!.tier).toBeGreaterThan(underbossStanding(fresh)!.tier);
  });

  it('reads higher for a track record of actually handling things than for the same leadership/headcount/tenure alone', () => {
    const noRecord = game(25);
    const bossA = hire(noRecord, 'underboss', 1);
    bossA.familiarity = GOAL_CERTAIN_ABOVE;
    bossA.stats.leadership = 50;
    bossA.daysInCrew = 10;

    const withRecord = game(26);
    const bossB = hire(withRecord, 'underboss', 1);
    bossB.familiarity = GOAL_CERTAIN_ABOVE;
    bossB.stats.leadership = 50;
    bossB.daysInCrew = 10;
    for (let i = 0; i < 3; i++) remember(bossB, withRecord.day, 'handled_it_quietly', null);

    expect(underbossStanding(withRecord)!.tier).toBeGreaterThan(underbossStanding(noRecord)!.tier);
  });

  it('reaches a dangerous top tier once an already-strong Underboss also has a track record of real handled problems', () => {
    const state = game(27);
    const boss = hire(state, 'underboss', 1);
    boss.familiarity = GOAL_CERTAIN_ABOVE;
    boss.stats.leadership = 50; // bandIndex 2, so headcount+tenure alone plateau below the top
    boss.daysInCrew = 400;
    for (let i = 0; i < 4; i++) {
      const soldier = hire(state, 'soldier', 2 + i);
      soldier.reportsTo = boss.id;
    }

    const beforeRecord = underbossStanding(state)!.tier;
    for (let i = 0; i < 3; i++) remember(boss, state.day, 'handled_it_quietly', null);
    const afterRecord = underbossStanding(state)!;

    expect(afterRecord.tier).toBeGreaterThan(beforeRecord);
    expect(afterRecord.text.toLowerCase()).toMatch(/nobody comes to you first|runs through him|isn't waiting on you/);
  });
});
