/**
 * The half of a boss that is not the household either.
 *
 * The design note is in `config/personal.ts`. What this file settles:
 *
 * **The layer is derived, not stored on the way in.** A save written before
 * Milestone 6 grows one on load without spending a causal roll, which is the
 * same rule `home()` and the whisper feed live under and the same mistake
 * they each made once.
 *
 * **Both spends do different things.** An evening buys back less discretion
 * than an envelope and is the only one that takes weight off the man — and
 * neither of them is an evening at home, which is the trade the whole layer
 * exists to pose.
 *
 * **The meter is load-bearing in two places.** Below one bar a case that is
 * already watching hears things it did not work for; below the other the
 * kitchen finds out. Both are tested against the bar rather than against a
 * number typed twice.
 */

import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import {
  canGoHome,
  canPayAllowance,
  canVisitConfidant,
  confidant,
  confidantIsExposed,
  goHome,
  home,
  payConfidantAllowance,
  playerStress,
  setDiscretion,
  tickConfidant,
  visitConfidant,
} from '../personal';
import { tickInvestigations } from '../investigation';
import { GEN_DEFS } from '../eventgen';
import { resolveEvent } from '../events';
import { totalFunds } from '../economy';
import { CONFIDANT, HOME, STRESS } from '../../config/personal';
import { PAYDAY_INTERVAL } from '../../config/economy';
import type { GameState, Investigation } from '../types';
import type { StageId } from '../../config/lawEnforcement';

function game(seed = 6): GameState {
  const state = newGame({ name: 'Quiet', difficulty: 'normal', seed });
  state.org.cash = 100_000;
  return state;
}

/** Steps to the next weekly boundary and ticks the layer, `n` times. */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / HOME.intervalDays) + 1) * HOME.intervalDays;
    tickConfidant(state);
  }
}

function caseAt(state: GameState, stage: StageId): Investigation {
  const investigation: Investigation = {
    id: 'case_wire',
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
  state.law.investigations[investigation.id] = investigation;
  return investigation;
}

/** A week of case growth with nothing else in the world to feed it. */
function caseWeek(state: GameState): void {
  state.day = (Math.floor(state.day / PAYDAY_INTERVAL) + 1) * PAYDAY_INTERVAL;
  tickInvestigations(state, new Rng(state.rng));
}

describe('the apartment nobody has the address of', () => {
  it('is there before anybody asks, and is the same one every time', () => {
    const a = confidant(game(11));
    const b = confidant(game(11));
    expect(a.name).toBe(b.name);
    expect(a.role).toBe(b.role);
    expect(CONFIDANT.roles).toContain(a.role);
    expect(a.discretion).toBe(CONFIDANT.initialDiscretion);
    expect(a.active).toBe(true);
    expect(a.discovered).toBe(false);
  });

  /*
     The one that would rot silently. A lazy initialiser that drew from the
     causal stream would move every later roll in a career that loaded an old
     save — `whispers.ts` did exactly this once and broke two unrelated tests
     about operations. Watched to fail with a single `state.rng.next()` added
     to `confidant()` — this guard and twenty-six others in this file went
     red together, which is exactly the blast radius the rule exists for.
  */
  it('is built without spending a roll', () => {
    const state = game();
    const before = state.rng.calls;
    confidant(state);
    expect(state.rng.calls).toBe(before);
  });

  it('grows on a save that never had one', () => {
    const state = game();
    confidant(state);
    delete state.confidant;
    expect(() => confidant(state)).not.toThrow();
    expect(state.confidant).toBeDefined();
  });
});

describe('the two ways of paying for it', () => {
  it('an evening takes weight off the man and spends the night', () => {
    const state = game();
    state.player.stress = 60;
    const cash = totalFunds(state);
    visitConfidant(state);

    const her = confidant(state);
    expect(playerStress(state)).toBe(60 - CONFIDANT.visitStressRelief);
    expect(her.discretion).toBe(CONFIDANT.initialDiscretion + CONFIDANT.visitDiscretionGain);
    expect(totalFunds(state)).toBeLessThan(cash);
    expect(state.flags['went_home_day']).toBe(state.day);
  });

  /*
     The whole trade. An evening across town is the night the house thought it
     was getting, so it must not also clear what being away is costing — a
     version that did would make this a strictly better "Go home" button.
  */
  it('an evening across town clears nothing at home', () => {
    const state = game();
    home(state).neglect = 50;
    visitConfidant(state);
    expect(home(state).neglect).toBe(50);
  });

  it('an envelope buys more quiet, and takes nothing off the man', () => {
    const state = game();
    state.player.stress = 60;
    payConfidantAllowance(state);

    expect(confidant(state).discretion).toBe(
      CONFIDANT.initialDiscretion + CONFIDANT.allowanceDiscretionGain,
    );
    expect(playerStress(state)).toBe(60);
    expect(state.flags['went_home_day']).toBeUndefined();
  });

  it('refuses a night already given to the house, and says so', () => {
    const state = game();
    // Far enough in that the house is worth going to — `canGoHome` refuses a
    // second evening inside `visitAgainAfterDays`, and a fresh career's
    // household is stamped as visited on the day it is built.
    home(state);
    state.day += HOME.visitAgainAfterDays;
    goHome(state);
    expect(state.flags['went_home_day'], 'the fixture must actually go home').toBe(state.day);
    const refusal = canVisitConfidant(state);
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toBeTruthy();
  });

  /*
     The other half of the same rule, and it was missing until this milestone
     went looking for it. `went_home_day` is stamped by three things and only
     one of them moves `lastVisitDay`, so `canGoHome`'s "you were there N days
     ago" check caught one case in three: a night across the river could be
     followed by an evening at home on the same day. Watched to fail with the
     new `went_home_day` check removed from `canGoHome`.
  */
  it('a night across the river is a night the house does not get', () => {
    const state = game();
    home(state);
    state.day += HOME.visitAgainAfterDays;
    visitConfidant(state);
    const refusal = canGoHome(state);
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toBeTruthy();
  });

  it('refuses when the money is not there, and names the price', () => {
    const state = game();
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    const refusal = canVisitConfidant(state);
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toContain(String(CONFIDANT.visitCost));
  });

  it('never runs past its own ceiling', () => {
    const state = game();
    setDiscretion(state, 95);
    payConfidantAllowance(state);
    expect(confidant(state).discretion).toBe(100);
  });
});

describe('a week of it going quiet', () => {
  it('decays on the weekly clock', () => {
    const state = game();
    weeks(state, 2);
    expect(confidant(state).discretion).toBe(
      CONFIDANT.initialDiscretion - CONFIDANT.weeklyDiscretionDecay * 2,
    );
  });

  /*
     The one coupling between this and the household, and it runs the
     direction the fiction does. Watched to fail with the multiplier read as
     1: 72 instead of 70.5 after one week.
  */
  it('decays faster in a house that is already cold', () => {
    const cold = game();
    home(cold).neglect = CONFIDANT.neglectDecayFrom;
    weeks(cold, 1);

    const warm = game();
    home(warm).neglect = CONFIDANT.neglectDecayFrom - 1;
    weeks(warm, 1);

    expect(confidant(cold).discretion).toBeLessThan(confidant(warm).discretion);
    expect(confidant(cold).discretion).toBe(
      CONFIDANT.initialDiscretion -
        CONFIDANT.weeklyDiscretionDecay * CONFIDANT.neglectDecayMultiplier,
    );
  });

  it('stops entirely once it is over', () => {
    const state = game();
    confidant(state).active = false;
    weeks(state, 4);
    expect(confidant(state).discretion).toBe(CONFIDANT.initialDiscretion);
  });
});

describe('what a wire picks up', () => {
  it('feeds a case that is already listening', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.wiretapDiscretionThreshold - 1);
    const open = caseAt(state, 'surveillance');
    const before = open.strength;
    caseWeek(state);
    expect(open.strength).toBeGreaterThanOrEqual(before + CONFIDANT.wiretapEvidenceWeekly);
    expect(open.lastGrowth?.absorbed).toBeGreaterThanOrEqual(CONFIDANT.wiretapEvidenceWeekly);
  });

  it('feeds nothing while the address is still quiet', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.wiretapDiscretionThreshold + 1);
    const open = caseAt(state, 'surveillance');
    caseWeek(state);
    expect(confidantIsExposed(state)).toBe(false);
    expect(open.lastGrowth?.absorbed ?? 0).toBe(0);
  });

  /*
     Per-case, not organization-wide: a file nobody has put a van outside for
     has nobody sitting in it. Watched to fail with the stage check dropped —
     the `suspicion` case absorbed the full weekly figure.
  */
  it('feeds nothing to a file that is not watching yet', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.wiretapDiscretionThreshold - 1);
    const early = caseAt(state, 'suspicion');
    caseWeek(state);
    expect(early.lastGrowth?.absorbed ?? 0).toBe(0);
  });

  /*
     The bite. `absorbed > 0` is what holds `lastProgressDay`, so a private
     life nobody is minding keeps a file warm through a month when the family
     has otherwise gone completely still — which is the counterplay this
     whole layer is aimed at.
  */
  it('keeps a file warm that would otherwise have gone cold', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.wiretapDiscretionThreshold - 1);
    const open = caseAt(state, 'surveillance');
    open.lastProgressDay = 0;
    caseWeek(state);
    expect(open.lastProgressDay).toBe(state.day);
    expect(open.status).toBe('open');
  });

  it('says so out loud, and not every week', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.wiretapDiscretionThreshold - 1);
    caseAt(state, 'surveillance');

    const said = () => state.log.filter((l) => l.text.includes('address across the river')).length;
    caseWeek(state);
    expect(said()).toBe(1);
    caseWeek(state);
    expect(said(), 'a line every week about the same wire is a subscription').toBe(1);

    state.day += CONFIDANT.wiretapBeatEveryDays;
    caseWeek(state);
    expect(said()).toBe(2);
  });

  it('hears nothing once it is over', () => {
    const state = game();
    setDiscretion(state, 0);
    confidant(state).active = false;
    const open = caseAt(state, 'surveillance');
    caseWeek(state);
    expect(confidantIsExposed(state)).toBe(false);
    expect(open.lastGrowth?.absorbed ?? 0).toBe(0);
  });
});

describe('the kitchen, at an hour nobody chose', () => {
  const def = () => GEN_DEFS.find((d) => d.id === 'gen_affair_fallout')!;

  function raise(state: GameState) {
    const rng = new Rng(state.rng);
    const ctx = def().applies(state, rng);
    expect(ctx, 'the memo should have been raised').not.toBeNull();
    const built = def().build(state, rng, ctx!);
    state.pendingEvents.push({ ...built, id: 'ev_fallout', day: state.day });
    return state.pendingEvents[state.pendingEvents.length - 1];
  }

  function answer(state: GameState, choiceId: string) {
    const event = raise(state);
    resolveEvent(state, new Rng(state.rng), event.id, choiceId);
    expect(state.pendingEvents.find((e) => e.id === event.id)).toBeUndefined();
  }

  it('stays quiet while the address is kept and the house is warm', () => {
    const state = game();
    expect(def().applies(state, new Rng(state.rng))).toBeNull();
  });

  it('comes up when too many people know the address', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.discoveryDiscretionThreshold - 1);
    expect(def().applies(state, new Rng(state.rng))).not.toBeNull();
  });

  /*
     The second door, and it is not the same failure as the first. A boss who
     pays the envelope every month and is never home still gets this
     conversation — the house works it out unassisted.
  */
  it('comes up in a house cold enough to work it out on its own', () => {
    const state = game();
    setDiscretion(state, 100);
    home(state).neglect = CONFIDANT.discoveryNeglect;
    expect(def().applies(state, new Rng(state.rng))).not.toBeNull();
  });

  it('ending it costs the house, costs the man, and closes the address', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.discoveryDiscretionThreshold - 1);
    home(state).neglect = 20;
    state.player.stress = 10;

    answer(state, 'end_it');

    const her = confidant(state);
    expect(her.active).toBe(false);
    expect(her.discovered).toBe(true);
    expect(home(state).neglect).toBe(20 + CONFIDANT.falloutBreakNeglect);
    expect(playerStress(state)).toBe(10 + CONFIDANT.falloutBreakStress);
    expect(canVisitConfidant(state).ok).toBe(false);
    expect(canPayAllowance(state).ok).toBe(false);
  });

  it('denying it is free, and the most expensive answer in the room', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.discoveryDiscretionThreshold - 1);
    home(state).neglect = 20;
    const cash = totalFunds(state);

    answer(state, 'deny');

    const her = confidant(state);
    expect(totalFunds(state)).toBe(cash);
    expect(her.active).toBe(true);
    expect(home(state).neglect).toBe(20 + CONFIDANT.falloutDenyNeglect);
    expect(her.discretion).toBe(CONFIDANT.falloutDenyDiscretion);
  });

  it('buying the room back costs real money and ends nothing', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.discoveryDiscretionThreshold - 1);
    home(state).neglect = 40;
    const cash = totalFunds(state);

    answer(state, 'peace');

    const her = confidant(state);
    expect(cash - totalFunds(state)).toBeGreaterThanOrEqual(CONFIDANT.falloutPeaceCost);
    expect(her.active).toBe(true);
    expect(home(state).neglect).toBe(40 - CONFIDANT.falloutPeaceNeglectClear);
    expect(her.discretion).toBe(CONFIDANT.falloutPeaceDiscretion);
  });

  /*
     A floor rather than a gain. Either door can raise this memo, so a boss
     who got here on neglect alone may be perfectly discreet — paying him
     discretion for having been found out would make the second door a
     reward. Watched to fail with `Math.max` dropped: 60 instead of 100.
  */
  it('does not pay a discreet boss for having been found out', () => {
    const state = game();
    setDiscretion(state, 100);
    home(state).neglect = CONFIDANT.discoveryNeglect;
    answer(state, 'peace');
    expect(confidant(state).discretion).toBe(100);
  });

  it('is asked once in a career, whatever was decided', () => {
    const state = game();
    setDiscretion(state, CONFIDANT.discoveryDiscretionThreshold - 1);
    answer(state, 'deny');
    setDiscretion(state, 0);
    expect(
      def().applies(state, new Rng(state.rng)),
      'the house does not find out twice',
    ).toBeNull();
  });

  it('does not come back after it has been ended', () => {
    const state = game();
    confidant(state).active = false;
    setDiscretion(state, 0);
    home(state).neglect = 100;
    expect(def().applies(state, new Rng(state.rng))).toBeNull();
  });
});

describe('the relief it is measured against', () => {
  /*
     Not an assertion about which is better — an assertion that they are not
     the same button. The doctor is money for stress with no meter attached;
     this is money for stress with a meter a federal case can read.
  */
  it('takes less off the man than a doctor does, and leaves a trail', () => {
    expect(CONFIDANT.visitStressRelief).toBeLessThan(STRESS.consultRecovery);
    expect(CONFIDANT.visitCost).toBeLessThan(STRESS.consultCost);
  });
});
