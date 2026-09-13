/**
 * A capo putting his name behind one of his own men.
 *
 * Readiness reuses three signals that already exist rather than a new hidden
 * stat: time in the crew (`daysInCrew`/`joinedDay`), the capo's own tie to the
 * associate (`ties.ts`), and the associate's loyalty. Make reuses `promote`
 * outright; Deny prices the snub the same way `capoPitches.ts`'s
 * `reassignPitch` already prices watching a job go to somebody else.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { generateNpc } from '../npc';
import { assignToCapo } from '../delegation';
import { TIE_DEPARTURE, TIE_EVENTS } from '../../config/ties';
import { BEHAVIOUR, DRIFT } from '../../config/npcs';
import { CAPO_VOUCH } from '../../config/capoVouches';
import {
  canMakeVouch,
  denyVouch,
  isVouchReady,
  makeVouch,
  vouchCandidates,
  waitOnVouch,
} from '../capoVouches';
import type { GameState, Npc } from '../types';

function game(seed = 61): GameState {
  return newGame({ name: 'Vouch', difficulty: 'normal', seed });
}

function hire(state: GameState, role: Npc['role'], calls: number): Npc {
  const npc = generateNpc(state, new Rng({ seed: 909, calls }), role);
  npc.status = 'active';
  state.npcs[npc.id] = npc;
  return npc;
}

/** A capo and an associate under him, both trusted enough and long enough in. */
function readyPair(state: GameState): { capo: Npc; associate: Npc } {
  const capo = hire(state, 'capo', 1);
  const associate = hire(state, 'associate', 2);
  assignToCapo(state, associate.id, capo.id);
  associate.joinedDay = state.day - DRIFT.daysInRoleBeforeStagnation - 1;
  associate.stats.loyalty = BEHAVIOUR.demandLoyaltyBelow + 5;
  capo.ties.push({
    id: associate.id,
    trust: TIE_DEPARTURE.followTrustAbove + 5,
    resentment: 0,
    debt: 0,
    cause: 'worked_together',
    since: state.day,
  });
  return { capo, associate };
}

describe('whether a capo is ready to vouch', () => {
  it('is not ready fresh off the boat, however much the capo already trusts him', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    associate.joinedDay = state.day; // arrived today
    expect(isVouchReady(state, capo, associate)).toBe(false);
  });

  it('is not ready without the capo trusting him enough', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    capo.ties[0].trust = TIE_DEPARTURE.followTrustAbove - 1;
    expect(isVouchReady(state, capo, associate)).toBe(false);
  });

  it('is not ready when the man himself is a poor bet — low loyalty', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    associate.stats.loyalty = BEHAVIOUR.demandLoyaltyBelow - 1;
    expect(isVouchReady(state, capo, associate)).toBe(false);
  });

  it('is ready once time, trust and loyalty all clear', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    expect(isVouchReady(state, capo, associate)).toBe(true);
    expect(vouchCandidates(state)).toEqual([{ capo, associate }]);
  });

  it('never surfaces the seniority fallback — only a real capo', () => {
    const state = game();
    const notCapo = hire(state, 'soldier', 1);
    const associate = hire(state, 'associate', 2);
    assignToCapo(state, associate.id, notCapo.id);
    associate.joinedDay = state.day - DRIFT.daysInRoleBeforeStagnation - 1;
    associate.stats.loyalty = 90;
    notCapo.ties.push({
      id: associate.id,
      trust: 100,
      resentment: 0,
      debt: 0,
      cause: 'worked_together',
      since: state.day,
    });
    expect(isVouchReady(state, notCapo, associate)).toBe(false);
    expect(vouchCandidates(state)).toHaveLength(0);
  });
});

describe('Make', () => {
  it('reuses promote outright — same role change, same loyalty gain', () => {
    const state = game();
    const { associate } = readyPair(state);
    const before = associate.stats.loyalty;
    expect(canMakeVouch(state, associate.id).ok).toBe(true);
    const result = makeVouch(state, associate.id);
    expect(result.ok).toBe(true);
    expect(state.npcs[associate.id].role).toBe('soldier');
    expect(state.npcs[associate.id].stats.loyalty).toBeGreaterThan(before);
  });
});

describe('Wait', () => {
  it('holds the recommendation off the list without touching anybody\'s numbers', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    const capoBefore = { ...capo.stats };
    const result = waitOnVouch(state, associate.id);
    expect(result.ok).toBe(true);
    expect(vouchCandidates(state)).toHaveLength(0);
    expect(state.npcs[capo.id].stats).toEqual(capoBefore);
    expect(state.npcs[associate.id].role).toBe('associate');
  });

  it('resurfaces once the cooldown clears', () => {
    const state = game();
    const { associate } = readyPair(state);
    waitOnVouch(state, associate.id);
    state.day += CAPO_VOUCH.cooldownDays;
    expect(vouchCandidates(state)).toHaveLength(1);
  });
});

describe('Deny', () => {
  it('prices the snub exactly the way reassignPitch prices being passed over', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    const trustBefore = capo.ties[0].trust;
    const resentmentBefore = capo.ties[0].resentment;
    const memoriesBefore = capo.memories.length;

    const result = denyVouch(state, associate.id);
    expect(result.ok).toBe(true);
    expect(state.npcs[associate.id].role).toBe('associate');

    const tie = state.npcs[capo.id].ties.find((t) => t.id === associate.id)!;
    expect(tie.trust).toBe(Math.max(0, trustBefore + (TIE_EVENTS.passed_over.trust ?? 0)));
    expect(tie.resentment).toBe(
      Math.max(0, resentmentBefore + (TIE_EVENTS.passed_over.resentment ?? 0)),
    );
    expect(state.npcs[capo.id].memories.length).toBe(memoriesBefore + 1);
    expect(state.npcs[capo.id].memories[0].kind).toBe('passed_over');
  });

  it('also holds the recommendation off the list', () => {
    const state = game();
    const { associate } = readyPair(state);
    denyVouch(state, associate.id);
    expect(vouchCandidates(state)).toHaveLength(0);
  });
});
