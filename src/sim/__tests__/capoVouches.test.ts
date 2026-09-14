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
import { crewList, driftNpcs, generateNpc } from '../npc';
import { assignToCapo, putInCharge } from '../delegation';
import { territoryList } from '../territory';
import { dismiss, promote } from '../crew';
import { defectToRival } from '../diplomacy';
import { sweep } from '../investigation';
import { applyFailureConsequence } from '../operations';
import { silence } from '../silence';
import { removePlayer } from '../succession';
import { TIE_DEPARTURE, TIE_EVENTS } from '../../config/ties';
import { BEHAVIOUR, DRIFT } from '../../config/npcs';
import { DELEGATION } from '../../config/delegation';
import { CAPO_VOUCH, CAPO_CAPACITY } from '../../config/capoVouches';
import { RIVAL_IDS } from '../../config/factions';
import { OPERATION_BY_ID } from '../../config/operations';
import {
  canMakeVouch,
  capoCapacity,
  denyVouch,
  isVouchReady,
  makeVouch,
  voucherMistakeCount,
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

  it('records who vouched for him', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    expect(state.npcs[associate.id].vouchedBy).toBe(capo.id);
  });

  it('a plain promote (outside the vouch flow) leaves vouchedBy unset', () => {
    const state = game();
    const { associate } = readyPair(state);
    promote(state, associate.id);
    expect(state.npcs[associate.id].vouchedBy).toBeUndefined();
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

describe('a capo can only hold so many made guys', () => {
  it('shaped like maxCrew — a base, plus more for a district he actually runs', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    expect(capoCapacity(state, capo)).toBe(CAPO_CAPACITY.base);

    const t = territoryList(state)[0];
    t.influence = { ...t.influence, player: 60 };
    putInCharge(state, capo.id, t.id);
    expect(capoCapacity(state, capo)).toBe(CAPO_CAPACITY.base + CAPO_CAPACITY.perDistrict);
  });

  it('blocks a Make that would push him over it, and says why', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    // Fill him up to exactly his capacity with other men first.
    for (let i = 0; i < CAPO_CAPACITY.base; i++) {
      const filler = hire(state, 'soldier', 10 + i);
      filler.reportsTo = capo.id;
    }
    const check = canMakeVouch(state, associate.id);
    expect(check.ok).toBe(false);
    expect(check.message).toContain(capo.name);

    const result = makeVouch(state, associate.id);
    expect(result.ok).toBe(false);
    expect(state.npcs[associate.id].role).toBe('associate');
  });

  it('does not block a Make while there is still room', () => {
    const state = game();
    const { associate } = readyPair(state);
    expect(canMakeVouch(state, associate.id).ok).toBe(true);
  });
});

describe('a made man cut loose costs the capo who vouched for him', () => {
  it('charges the vouching capo the same standing hit reassignPitch already prices', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    expect(state.npcs[associate.id].vouchedBy).toBe(capo.id);

    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;
    const grievanceBefore = state.npcs[capo.id].stats.grievance;
    const memoriesBefore = state.npcs[capo.id].memories.length;

    dismiss(state, associate.id);

    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
    expect(state.npcs[capo.id].stats.grievance).toBe(
      Math.max(0, Math.min(100, grievanceBefore + DELEGATION.recallGrievance)),
    );
    expect(state.npcs[capo.id].memories.length).toBe(memoriesBefore + 1);
    // Its own kind, distinct from Deny's `passed_over` above — a vouch going
    // bad is not the same thing as a capo being passed over for one.
    expect(state.npcs[capo.id].memories[0].kind).toBe('vouch_soured');
  });

  it('costs nobody when the dismissed man was never vouched for', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    promote(state, associate.id); // made, but not through a vouch
    expect(state.npcs[associate.id].vouchedBy).toBeUndefined();

    const capoBefore = { ...state.npcs[capo.id].stats };
    dismiss(state, associate.id);
    expect(state.npcs[capo.id].stats).toEqual(capoBefore);
  });
});

/**
 * The other six places a vouched man's run can end badly. `dismiss` was the
 * first site wired to `applyVoucherConsequence`; these are the rest of them,
 * one per real transition named in Phase D's follow-up. Every one reuses
 * `DELEGATION.recallLoyalty`/`recallGrievance` rather than its own number,
 * because nothing in this codebase sizes a third-party vouch charge more
 * specifically than that for any of these outcomes either.
 */
describe('the same charge, from every other way a vouch goes bad', () => {
  it('defecting to a rival costs the vouching capo exactly like a dismissal', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;
    const grievanceBefore = state.npcs[capo.id].stats.grievance;

    defectToRival(state, state.npcs[associate.id], RIVAL_IDS[0]);

    expect(state.npcs[associate.id].status).toBe('defected');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
    expect(state.npcs[capo.id].stats.grievance).toBe(
      Math.max(0, Math.min(100, grievanceBefore + DELEGATION.recallGrievance)),
    );
  });

  it('a police sweep that takes a vouched man costs the capo who backed him', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    // Only the vouched man is left available, so the weighted draw has
    // nowhere else to land.
    for (const npc of crewList(state)) {
      if (npc.id !== associate.id) npc.status = 'arrested';
    }
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;

    sweep(state, new Rng(state.rng), 'the police');

    expect(state.npcs[associate.id].status).toBe('arrested');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });

  it('an arrest on a job that went wrong costs the capo who backed the man taken', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    // Neutral traits, so escalation stays at 1 and the outcome table's own
    // weights decide this rather than a trait multiplier.
    state.npcs[associate.id].traits = [];
    const def = OPERATION_BY_ID.port_operation; // risk: 'extreme'
    const territoryId = territoryList(state)[0].id;
    // Fixed at a roll that lands on 'crew_arrested' in the extreme table
    // (cumulative 45..69 of 100) and, with one man in `crew`, always picks him.
    const rng = new Rng(state.rng);
    rng.next = () => 0.5;
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;

    applyFailureConsequence(state, rng, def, [state.npcs[associate.id]], territoryId);

    expect(state.npcs[associate.id].status).toBe('arrested');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });

  it('silencing a vouched man costs the capo who put his name behind him', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    const rng = new Rng(state.rng);
    rng.chance = () => true; // the act lands
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;

    silence(state, rng, associate.id);

    expect(state.npcs[associate.id].status).toBe('dead');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });

  it('a botched silencing costs the same, even though the man survives it', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    const rng = new Rng(state.rng);
    rng.chance = () => false; // the act fails
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;

    silence(state, rng, associate.id);

    expect(state.npcs[associate.id].status).toBe('defected');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });

  it('drifting out on his own low loyalty costs the capo who vouched for him', () => {
    const state = game();
    const { capo, associate } = readyPair(state);
    makeVouch(state, associate.id);
    // Frozen so the capo's own ordinary weekly drift cannot move his stats —
    // isolates the one change under test to the vouch consequence itself.
    capo.status = 'arrested';
    associate.stats.loyalty = 0;
    const rng = new Rng(state.rng);
    rng.chance = () => true;
    const loyaltyBefore = capo.stats.loyalty;
    const grievanceBefore = capo.stats.grievance;

    driftNpcs(state, rng);

    expect(associate.status).toBe('defected');
    expect(capo.stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
    expect(capo.stats.grievance).toBe(
      Math.max(0, Math.min(100, grievanceBefore + DELEGATION.recallGrievance)),
    );
  });

  it('following a departing man out costs whoever vouched for the follower, not the leaver', () => {
    const state = game();
    const { capo: leaverCapo, associate: leaver } = readyPair(state);
    makeVouch(state, leaver.id);
    leaverCapo.status = 'arrested'; // freeze — this test is about the follower's voucher

    const followerCapo = hire(state, 'capo', 5);
    const follower = hire(state, 'associate', 6);
    assignToCapo(state, follower.id, followerCapo.id);
    follower.joinedDay = state.day - DRIFT.daysInRoleBeforeStagnation - 1;
    makeVouch(state, follower.id);
    followerCapo.status = 'arrested'; // freeze this one too
    // High enough that the follower never drifts out on his own — the only
    // way he leaves here is by following the leaver.
    follower.stats.loyalty = 90;
    // The tie that makes him follow — trust in the leaver, not in his own capo.
    follower.ties.push({
      id: leaver.id,
      trust: TIE_DEPARTURE.followTrustAbove + 5,
      resentment: 0,
      debt: 0,
      cause: 'worked_together',
      since: state.day,
    });

    leaver.stats.loyalty = 0;
    const rng = new Rng(state.rng);
    rng.chance = () => true;
    const followerCapoLoyaltyBefore = followerCapo.stats.loyalty;

    driftNpcs(state, rng);

    expect(leaver.status).toBe('defected');
    expect(follower.status).toBe('defected');
    expect(followerCapo.stats.loyalty).toBe(
      Math.max(0, Math.min(100, followerCapoLoyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });

  it('walking out rather than serve a new boss costs the capo who vouched for the man who left', () => {
    const state = game();
    const winner = hire(state, 'capo', 7);
    winner.stats.ambition = 90;
    winner.stats.leadership = 80;
    const { capo, associate: walker } = readyPair(state);
    makeVouch(state, walker.id);
    // High enough that the voucher himself is never the one the floor picks
    // to leave — walker, forced to the bottom, is.
    capo.stats.loyalty = 80;
    walker.stats.loyalty = 1; // well under HANDOVER.walkOutLoyaltyBelow
    const rng = new Rng(state.rng);
    rng.chance = () => true; // the walkout roll lands
    const loyaltyBefore = state.npcs[capo.id].stats.loyalty;

    removePlayer(state, rng, 'killed', 'Shot outside a restaurant.', winner);

    expect(state.npcs[walker.id].status).toBe('defected');
    expect(state.npcs[capo.id].stats.loyalty).toBe(
      Math.max(0, Math.min(100, loyaltyBefore + DELEGATION.recallLoyalty)),
    );
  });
});

/**
 * A capo's judgment does not get worse the third time it goes wrong, but the
 * player is entitled to be told it keeps happening — `silence()` already
 * works on a capo exactly like anybody else; what was missing was a reason to
 * point it at one.
 */
describe('a running count of a capo\'s bad vouches', () => {
  /** One vouch, made and then soured, for a fresh associate each time. */
  function sourOneVouch(state: GameState, capo: Npc, calls: number): void {
    const associate = hire(state, 'associate', calls);
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
    makeVouch(state, associate.id);
    dismiss(state, associate.id);
  }

  it('starts at zero for a capo who has never had a vouch go bad', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    expect(voucherMistakeCount(capo)).toBe(0);
  });

  it('counts each vouch that goes bad, not just the last one', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    sourOneVouch(state, capo, 10);
    expect(voucherMistakeCount(capo)).toBe(1);
    sourOneVouch(state, capo, 20);
    expect(voucherMistakeCount(capo)).toBe(2);
  });

  it('says nothing while the count sits under the threshold', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    for (let i = 0; i < CAPO_VOUCH.mistakesBeforeWarning - 1; i++) {
      sourOneVouch(state, capo, 10 + i * 10);
    }
    expect(state.log.some((l) => l.text.includes(capo.name))).toBe(false);
  });

  it('surfaces a warning the moment the count crosses the threshold, and only then', () => {
    const state = game();
    const capo = hire(state, 'capo', 1);
    for (let i = 0; i < CAPO_VOUCH.mistakesBeforeWarning; i++) {
      sourOneVouch(state, capo, 10 + i * 10);
    }
    const hits = state.log.filter((l) => l.text.includes(capo.name));
    expect(hits).toHaveLength(1);

    // One more bad vouch afterwards does not repeat the warning.
    sourOneVouch(state, capo, 200);
    expect(state.log.filter((l) => l.text.includes(capo.name))).toHaveLength(1);
  });
});
