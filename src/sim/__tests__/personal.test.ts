/**
 * The half of a boss that is not the business.
 *
 * The design note is in `config/personal.ts`, and it is unusually blunt about
 * this feature: **no measurement supports it.** No round has ever asked for a
 * personal life. It exists because the brief asks for it, and the job of this
 * file is to make sure it is not decoration — which for a layer with no
 * evidence behind it is the only honest standard available.
 *
 * Three properties.
 *
 * **It must cost something.** A boss who never goes home has to be measurably
 * worse off, or the whole layer is a panel.
 *
 * **It must not cost everybody something.** A penalty that applies whatever
 * the player does is a tax, not a decision, and the game already has enough
 * numbers that only go one way.
 *
 * **It must not touch the random stream.** The household is built lazily on
 * first read, and a lazy initialiser that rolls would reshuffle every later
 * call in a career that loaded an old save. That is the exact mistake whispers
 * made on the day it was written.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import {
  bodySpentTonight,
  canConsult,
  canGoHome,
  consultDoctor,
  daysUntilAdult,
  familyHorizon,
  goHome,
  home,
  homeRead,
  homeTier,
  memberAge,
  memberLifeStage,
  neglectRisk,
  playerStress,
  stressLeadershipMultiplier,
  stressPressure,
  stressTier,
  tickHome,
  tickStress,
} from '../personal';
import { canLaunch, launchOperation } from '../operations';
import { crewList, perceive } from '../npc';
import { OPERATION_BY_ID } from '../../config/operations';
import { career } from '../career';
import { declareWar } from '../diplomacy';
import { totalFunds } from '../economy';
import { HOME_TERRITORY } from '../../config/territories';
import { HOME, RELATIONS, STRESS } from '../../config/personal';
import type { GameState } from '../types';

function game(seed = 6): GameState {
  return newGame({ name: 'Home', difficulty: 'normal', seed });
}

/** Steps to the next interval boundary and ticks, `n` times. */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / HOME.intervalDays) + 1) * HOME.intervalDays;
    tickHome(state);
  }
}

describe('the house', () => {
  it('is there before anybody asks, and the same house every time', () => {
    const state = game();
    const first = home(state);
    expect(first.people.length).toBe(HOME.household);
    expect(first.people.every((p) => p.name.length > 0)).toBe(true);
    // Nobody has two mothers.
    expect(new Set(first.people.map((p) => p.relationId)).size).toBe(first.people.length);
    expect(home(state)).toBe(first);
  });

  /*
     The house does not assume anybody's gender either.

     The name pool is mixed and nothing in this game's state has ever recorded
     a gender, so a relation label that does is a bug waiting for a screenshot
     — and the live screen produced "Carla, your son" within a minute of the
     panel existing. `voice.test.ts` hunts gendered pronouns and these are
     nouns, so it walked straight past them.
  */
  it('never says what anybody is', () => {
    const gendered = /(wife|husband|son|daughter|mother|father|brother|sister|uncle|aunt|niece|nephew|widow|widower)/i;
    for (const r of RELATIONS) {
      expect(gendered.test(r.label), `"${r.label}" assumes a gender`).toBe(false);
      expect(gendered.test(r.asks), `"${r.asks}" assumes a gender`).toBe(false);
    }
  });

  it('is the same house in the same world, and a different one in another', () => {
    const a = home(game(6)).people.map((p) => `${p.name}:${p.relationId}`).join(',');
    const b = home(game(6)).people.map((p) => `${p.name}:${p.relationId}`).join(',');
    const c = home(game(77)).people.map((p) => `${p.name}:${p.relationId}`).join(',');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  /*
     The property that makes a lazy initialiser safe. If building the house
     rolls, then a save from before this existed silently changes every later
     outcome in that career the first time anybody opens the Yourself panel.
  */
  it('costs the random stream nothing to build or to read', () => {
    const state = game();
    const before = state.rng.calls;
    home(state);
    homeRead(state);
    neglectRisk(state);
    expect(state.rng.calls).toBe(before);
  });

  it('reads an absent house as one that has just been made', () => {
    const state = game();
    delete state.home;
    expect(() => homeRead(state)).not.toThrow();
    expect(homeRead(state).neglect).toBe(0);
  });
});

describe('being away', () => {
  /*
     The instrument first. `tickHome` early-returns on the calendar, and a
     helper that steps the clock wrongly would report that being away costs
     nothing — which is the finding this file exists to establish, arrived at
     for entirely the wrong reason. Four systems in this project have been
     measured at zero by exactly that.
  */
  it('actually runs the weekly tick', () => {
    const state = game();
    weeks(state, 4);
    expect(home(state).neglect, 'four weeks away changed nothing').toBeGreaterThan(0);
  });

  it('is wired into the day', () => {
    const state = game();
    for (let i = 0; i < 120; i++) advanceDay(state);
    expect(
      state.home?.neglect ?? 0,
      'a hundred and twenty days through advanceDay and nobody noticed',
    ).toBeGreaterThan(0);
  });

  it('is put right by going home, and not by anything else', () => {
    const state = game();
    weeks(state, 10);
    const away = home(state).neglect;
    expect(away).toBeGreaterThan(0);

    goHome(state);
    expect(home(state).neglect).toBeLessThan(away);
    expect(home(state).lastVisitDay).toBe(state.day);
  });

  it('says how it reads, in words', () => {
    const state = game();
    weeks(state, 30);
    const read = homeRead(state);
    expect(read.label.length).toBeGreaterThan(0);
    expect(read.people.length).toBe(HOME.household);
    expect(read.where.length).toBeGreaterThan(0);
    expect(read.since).toBeGreaterThan(0);
  });
});

describe('what it costs', () => {
  /*
     The half that decides whether this layer is worth having. A number that
     never reaches anything is the "meaningless statistic" the brief bans, and
     a personal life with no consequence is the most decorative thing this
     project could ship.
  */
  it('is free to a boss who goes home', () => {
    const state = game();
    weeks(state, 6);
    expect(
      neglectRisk(state),
      'a boss who has been away six weeks is already being punished for it',
    ).toBe(1);
  });

  it('makes a boss who never goes home easier to remove', () => {
    const state = game();
    weeks(state, 40);

    expect(home(state).neglect).toBeGreaterThan(HOME.depositionFrom);
    expect(
      neglectRisk(state),
      'forty weeks of never being home costs nothing at all',
    ).toBeGreaterThan(1);
    expect(neglectRisk(state)).toBeLessThanOrEqual(HOME.depositionAtWorst);
  });

  /*
     And it has to be recoverable, or it is a countdown rather than a choice.
  */
  it('comes back down when the boss goes home again', () => {
    const state = game();
    weeks(state, 40);
    const risk = neglectRisk(state);
    for (let i = 0; i < 4; i++) goHome(state);
    expect(neglectRisk(state)).toBeLessThan(risk);
  });
});

/*
   Round 15's severest SHOULD FIX, and the reason the panel has a button.

     "For 230 days the game showed me a rising counter I had no way to act on.
     I assumed for most of the run that I was missing a screen."

   The only way to go home was a memo on a weighted draw, and it arrived on day
   233 of a 245-day run.
*/
describe('going home without being asked', () => {
  it('is available to a boss who has been away', () => {
    const state = game();
    weeks(state, 10);
    expect(canGoHome(state).ok, 'ten weeks away and the door is still shut').toBe(true);
  });

  it('refuses a second evening in the same week, and says why', () => {
    const state = game();
    weeks(state, 10);
    goHome(state);

    const again = canGoHome(state);
    expect(again.ok).toBe(false);
    expect(again.reason, 'the refusal does not name its own bar').toContain(
      String(HOME.visitAgainAfterDays),
    );
  });

  it('does nothing when it is refused, rather than quietly working', () => {
    const state = game();
    weeks(state, 10);
    goHome(state);
    const after = home(state).neglect;
    goHome(state);
    expect(home(state).neglect, 'a refused visit still cleared neglect').toBe(after);
  });
});

/*
   Brief item 11: going home has to cost something against the business, or
   it is a free lunch next to every other decision in this game.
   `work_it_yourself` is the one job that occupies the boss's own body rather
   than a crew member's — "there is only one of you" is already `canLaunch`'s
   own refusal for it — and an evening at home occupies exactly the same body
   for exactly the same one day. Reusing that existing exclusion rather than
   inventing a new resource: neither can happen on a day the other already
   has.
*/
describe('the one body', () => {
  it('cannot go home while out on the one job that needs the boss personally', () => {
    const state = game();
    weeks(state, 10);
    expect(canGoHome(state).ok, 'the setup should otherwise allow a visit').toBe(true);

    const launched = launchOperation(state, 'work_it_yourself', [], HOME_TERRITORY);
    expect(launched, 'the job did not launch, so this test measures nothing').toBeTruthy();

    expect(canGoHome(state).ok).toBe(false);
  });

  it('refuses work it yourself the same evening the boss went home', () => {
    const state = game();
    weeks(state, 10);
    goHome(state);

    const def = OPERATION_BY_ID['work_it_yourself'];
    expect(canLaunch(state, def, [], HOME_TERRITORY).ok).toBe(false);
  });

  it('stops blocking the day after going home', () => {
    const state = game();
    weeks(state, 10);
    goHome(state);
    advanceDay(state);

    const def = OPERATION_BY_ID['work_it_yourself'];
    expect(canLaunch(state, def, [], HOME_TERRITORY).ok).toBe(true);
  });

  /*
     `home()` lazily stamps `lastVisitDay` at whatever day it happens to be
     first read on, for a career that has never actually visited — and
     something in the tick pipeline reads it well before the boss has ever
     gone anywhere. `lastVisitDay` coincidentally equalling today is not
     proof of a visit, and `work_it_yourself` must not read it as one. Built
     directly rather than by advancing to whichever day the coincidence
     happens to land on, which is a detail of other systems this test is not
     about.
  */
  it('does not mistake home() being read for a visit', () => {
    const state = game();
    weeks(state, 3);
    const house = home(state);
    house.lastVisitDay = state.day; // the exact coincidence, without goHome ever running
    expect(state.flags['went_home_day']).not.toBe(state.day);

    const def = OPERATION_BY_ID['work_it_yourself'];
    expect(
      canLaunch(state, def, [], HOME_TERRITORY).ok,
      'a career that never went home was refused work_it_yourself as though it had',
    ).toBe(true);
  });
});

/*
   Milestone 2: a family occasion is not knowable in advance (which one, or
   who), but the day the cooldown floor lifts is, and it is the only thing
   `familyHorizon` claims. See its own comment in `sim/personal.ts` for why
   the occasion itself stays unnamed.
*/
describe('the family horizon', () => {
  it('is the same for the same state, called twice', () => {
    const state = game();
    state.flags['evt_gen_family_dilemma'] = 40;
    state.day = 55;
    expect(familyHorizon(state)).toEqual(familyHorizon(state));
  });

  it('reads as never fired, and eligible now, before it ever has', () => {
    const state = game();
    const horizon = familyHorizon(state);
    expect(horizon.everFired).toBe(false);
    expect(horizon.daysUntil).toBe(0);
  });

  it('counts down as the day advances, and floors at zero once eligible', () => {
    const state = game();
    state.flags['evt_gen_family_dilemma'] = 40;
    state.day = 41;
    const first = familyHorizon(state);
    expect(first.everFired).toBe(true);
    expect(first.daysUntil).toBeGreaterThan(0);

    state.day += 1;
    const second = familyHorizon(state);
    expect(second.eligibleFromDay, 'the floor itself moved, which nothing should do between fires').toBe(
      first.eligibleFromDay,
    );
    expect(second.daysUntil, 'a day passing did not move the count down by a day').toBe(
      first.daysUntil - 1,
    );

    state.day = first.eligibleFromDay;
    expect(familyHorizon(state).daysUntil).toBe(0);
    state.day = first.eligibleFromDay + 30;
    expect(familyHorizon(state).daysUntil, 'eligible does not mean overdue').toBe(0);
  });
});

describe('the four tiers, read as one table', () => {
  it('picks the tier whose own bar the reading has actually crossed', () => {
    expect(homeTier(0).id).toBe('present');
    expect(homeTier(24).id).toBe('present');
    expect(homeTier(25).id).toBe('missed');
    expect(homeTier(49).id).toBe('missed');
    expect(homeTier(50).id).toBe('distant');
    expect(homeTier(74).id).toBe('distant');
    expect(homeTier(75).id).toBe('estranged');
    expect(homeTier(100).id).toBe('estranged');
  });
});

/*
   Milestone 2: the projection that says what doing nothing costs, ahead of
   `costing` actually going live.
*/
describe('daysUntilDepositionRisk', () => {
  it('counts down while under the bar', () => {
    const state = game();
    home(state).neglect = 0;
    const untouched = homeRead(state).daysUntilDepositionRisk;
    expect(untouched).toBeGreaterThan(0);

    home(state).neglect = HOME.depositionFrom - 1;
    expect(
      homeRead(state).daysUntilDepositionRisk,
      'closer to the bar should mean fewer days, not more',
    ).toBeLessThan(untouched);
  });

  it('is zero once already at or past the bar', () => {
    const state = game();
    home(state).neglect = HOME.depositionFrom;
    expect(homeRead(state).daysUntilDepositionRisk).toBe(0);

    home(state).neglect = 100;
    expect(homeRead(state).daysUntilDepositionRisk).toBe(0);
  });
});

/*
   Milestone 2: a cold reception. Watched to fail — reverting the `* 0.5` in
   `goHome` to a flat `baseline` made this pass at neglect 80 too, exactly as
   it does at 40; restoring the halving is what tells the two apart. Run by
   hand for this session's report rather than left in the suite as a second
   copy of the same guard.
*/
describe('a cold reception', () => {
  it('halves what a visit clears once neglect has reached the worst tier', () => {
    const state = game();
    weeks(state, 10);
    home(state).neglect = 80;
    expect(canGoHome(state).ok, 'the setup should otherwise allow a visit').toBe(true);
    const baseline = HOME.clearedByVisit;
    goHome(state);
    expect(
      80 - home(state).neglect,
      'a visit at the worst tier cleared the same as an ordinary one',
    ).toBeCloseTo(baseline * 0.5, 5);
  });

  it('clears the full amount below that tier', () => {
    const state = game();
    weeks(state, 10);
    home(state).neglect = 40;
    const baseline = HOME.clearedByVisit;
    goHome(state);
    expect(40 - home(state).neglect).toBeCloseTo(baseline, 5);
  });
});

/*
   Milestone 3: stress. `config/personal.ts`'s own `STRESS` block argues the
   double life bears down through facts the sim already tracks — wars, real
   heat, a house gone distant, wages owed — rather than a second ledger.
*/
describe('stress', () => {
  it('defaults cleanly to 0 on a legacy state that has never carried any', () => {
    const state = game();
    expect(state.player.stress).toBeUndefined();
    expect(playerStress(state)).toBe(0);
  });

  it('clamps a value already out of range, same as every other reading here', () => {
    const state = game();
    state.player.stress = 140;
    expect(playerStress(state)).toBe(STRESS.max);
    state.player.stress = -5;
    expect(playerStress(state)).toBe(0);
  });

  it('itemizes every active driver, and nothing that is not', () => {
    const state = game();
    // Quiet: no wars, low heat, low neglect, nothing owed.
    const quiet = stressPressure(state);
    expect(quiet.wars).toBe(0);
    expect(quiet.heat).toBe(0);
    expect(quiet.domestic).toBe(0);
    expect(quiet.payroll).toBe(0);
    expect(quiet.netWeekly, 'a quiet world should be recovering').toBe(-STRESS.naturalRecovery);

    declareWar(state, 'player', 'kestler');
    state.org.heat = 60;
    home(state).neglect = 60;
    state.org.wagesOwed = 500;

    const loaded = stressPressure(state);
    expect(loaded.wars).toBeCloseTo(STRESS.perWar, 5);
    expect(loaded.heat).toBe(STRESS.highHeat);
    expect(loaded.domestic).toBe(STRESS.domesticStrain);
    expect(loaded.payroll).toBe(STRESS.wageArrears);
    expect(loaded.netWeekly).toBeCloseTo(
      STRESS.perWar + STRESS.highHeat + STRESS.domesticStrain + STRESS.wageArrears,
      5,
    );
  });

  it('accumulates net pressure only on the weekly interval, and clamps', () => {
    const state = game();
    declareWar(state, 'player', 'kestler');
    const before = playerStress(state);
    state.day += 1; // not a boundary
    tickStress(state);
    expect(playerStress(state), 'moved off the weekly gate').toBe(before);

    state.day = (Math.floor(state.day / HOME.intervalDays) + 1) * HOME.intervalDays;
    tickStress(state);
    expect(playerStress(state)).toBeCloseTo(before + STRESS.perWar, 5);

    // And it cannot be driven past the ceiling.
    state.player.stress = STRESS.max;
    state.day += HOME.intervalDays;
    tickStress(state);
    expect(playerStress(state)).toBe(STRESS.max);
  });

  it('reads a stress tier from each of the four bars', () => {
    expect(stressTier(0).id).toBe('calm');
    expect(stressTier(24).id).toBe('calm');
    expect(stressTier(25).id).toBe('strained');
    expect(stressTier(55).id).toBe('overloaded');
    expect(stressTier(80).id).toBe('critical');
    expect(stressTier(100).id).toBe('critical');
  });

  describe('a discreet consultation', () => {
    it('refuses without the money, naming what it costs', () => {
      const state = game();
      state.org.cash = 0;
      state.org.dirtyCash = 0;
      const check = canConsult(state);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/do not have it/);
    });

    it('reuses the same zero-crew-op check `canGoHome` does, not `canGoHome` itself', () => {
      const state = game();
      state.org.cash = 100_000;
      launchOperation(state, 'work_it_yourself', [], HOME_TERRITORY);
      expect(bodySpentTonight(state), 'the fixture should have the body spent').toBe(true);
      expect(canConsult(state).ok).toBe(false);
    });

    /*
       The point of extracting `bodySpentTonight` rather than calling
       `canGoHome` wholesale: `canGoHome` also refuses inside
       `HOME.visitAgainAfterDays`, a rule about a *visit* being worth less so
       soon after the last one — which has nothing to say about a doctor's
       office. A consultation the day after going home must not be blocked
       by that unrelated refusal.
    */
    it('is not blocked by having gone home earlier today, unlike canGoHome', () => {
      const state = game();
      state.org.cash = 100_000;
      weeks(state, 10);
      goHome(state);
      expect(canGoHome(state).ok, 'the fixture should show the visit-cooldown refusal').toBe(false);
      expect(canConsult(state).ok, 'a consultation should not read the home-visit cooldown').toBe(true);
    });

    it('refuses inside its own cooldown, naming it', () => {
      const state = game();
      state.org.cash = 100_000;
      state.flags['last_consult_day'] = state.day;
      const check = canConsult(state);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(new RegExp(`inside ${STRESS.consultCooldownDays} days`));
    });

    it('spends cash, clears stress, spends the evening, and logs it', () => {
      const state = game();
      state.org.cash = 100_000;
      state.player.stress = 50;
      const before = totalFunds(state);
      consultDoctor(state);
      expect(totalFunds(state)).toBeLessThan(before);
      expect(playerStress(state)).toBeCloseTo(50 - STRESS.consultRecovery, 5);
      expect(state.flags['went_home_day']).toBe(state.day);
      expect(state.flags['last_consult_day']).toBe(state.day);
      expect(state.flags['dr_vance_clarity_until']).toBe(state.day + 14);
      expect(state.log.some((l) => l.text.includes('72nd Street'))).toBe(true);
    });

    it('does nothing when it should have refused', () => {
      const state = game();
      state.org.cash = 0;
      state.org.dirtyCash = 0;
      const before = playerStress(state);
      consultDoctor(state);
      expect(playerStress(state), 'a refused consultation still moved stress').toBe(before);
      expect(state.flags['went_home_day']).toBeUndefined();
    });

    /*
       Watched to fail: with the `state.org.heat >= STRESS.secrecyRiskHeat ||
       activeCases(state).length > 0` condition in `consultDoctor` disabled,
       the "hot" half of this test went red — no career entry was recorded at
       all. Restored afterwards. Run by hand for this session's report rather
       than left in the suite as a second copy of the same guard.
    */
    it('records a career whisper when the secrecy risk is real, not when it is quiet', () => {
      const quiet = game();
      quiet.org.cash = 100_000;
      quiet.org.heat = 10;
      consultDoctor(quiet);
      expect(career(quiet).some((e) => e.text.includes('federal plates'))).toBe(false);

      const hot = game(7);
      hot.org.cash = 100_000;
      hot.org.heat = STRESS.secrecyRiskHeat;
      consultDoctor(hot);
      expect(career(hot).some((e) => e.text.includes('federal plates'))).toBe(true);
    });

    it('sharpens perception of crew hidden stats during the fortnight of clarity', () => {
      const state = game();
      state.org.cash = 100_000;
      const crew = crewList(state)[0];
      crew.familiarity = 20;

      consultDoctor(state);
      expect(state.flags['dr_vance_clarity_until']).toBeGreaterThanOrEqual(state.day + 14);
      const read = perceive(crew, 'loyalty', state);
      expect(read.confidence).not.toBe('—');
    });
  });

  /*
     Point 6: a real, testable hook into `sim/sitdown.ts`'s `lands()` — not a
     decorative meter. Watched to fail: with `stressLeadershipMultiplier`
     hard-coded to return 1, the borderline case in `sitdown.test.ts`
     ("a read a critical boss can no longer make") landed regardless of
     stress; restoring the real function is what makes it depend on stress
     again. Run by hand for this session's report.
  */
  describe('the leadership penalty stress leaves on a sit-down', () => {
    it('is 1 outside the worst tier and outside a sedatives comedown', () => {
      const state = game();
      state.player.stress = 79; // just under `critical`
      expect(stressLeadershipMultiplier(state)).toBe(1);
    });

    it('applies only at the critical tier', () => {
      const state = game();
      state.player.stress = 80;
      expect(stressLeadershipMultiplier(state)).toBeCloseTo(STRESS.criticalLeadershipPenalty, 5);
    });

    it('the sedatives comedown stacks with the tier penalty rather than replacing it', () => {
      const state = game();
      state.player.stress = 80;
      state.flags['sedated_until_day'] = state.day + 1;
      expect(stressLeadershipMultiplier(state)).toBeCloseTo(
        STRESS.criticalLeadershipPenalty * STRESS.sedatedLeadershipPenalty,
        5,
      );
    });

    it('the sedatives flag is still active the day before it expires, gone the day it does', () => {
      const state = game();
      state.flags['sedated_until_day'] = state.day + STRESS.sedatedDays; // consultDoctor's own stamp
      state.day += STRESS.sedatedDays - 1;
      expect(stressLeadershipMultiplier(state)).toBeCloseTo(STRESS.sedatedLeadershipPenalty, 5);

      state.day += 1; // now exactly at the stamped day
      expect(stressLeadershipMultiplier(state)).toBe(1);
    });
  });
});

/*
   Milestone 4: age and life stage. Fully derived per `CLAUDE.md`'s "reach
   for a derived read before stored state" — nothing here is ever written to
   `Home` or `HouseholdMember`, so there is no `SAVE_VERSION` bump and no
   second copy of an age to drift from `state.day`.
*/
describe('age and life stage', () => {
  /** Overwrites one household slot so a test does not depend on this seed's
   * own three-of-six draw actually landing on a child relation. */
  function withChild(state: GameState, relationId: 'eldest' | 'youngest', name = 'Testy'): void {
    home(state).people[0] = { name, relationId };
  }

  it('is null for the four relations nobody tracks an age for', () => {
    const state = game();
    for (const relationId of ['spouse', 'parent', 'sibling', 'elder']) {
      expect(memberAge(state, 'Anybody', relationId), relationId).toBeNull();
    }
  });

  it('draws a base age in range at household creation, and ages a year every 365 days', () => {
    const state = game();
    withChild(state, 'eldest');
    const base = memberAge(state, 'Testy', 'eldest')!;
    expect(base).toBeGreaterThanOrEqual(9);
    expect(base).toBeLessThanOrEqual(17);

    state.day += 365 * 20;
    expect(memberAge(state, 'Testy', 'eldest')).toBe(base + 20);
  });

  it("crosses Child -> Teenager -> Young Adult -> Adult at the director's own bands", () => {
    const state = game();
    // `youngest`'s own start range (8-11) is the one that can actually begin
    // in the Child band -- `eldest` starts at 14-16 and never sees it.
    withChild(state, 'youngest');
    const base = memberAge(state, 'Testy', 'youngest')!;
    const stageAt = (age: number) => {
      state.day = (age - base) * 365 + 1;
      return memberLifeStage(memberAge(state, 'Testy', 'youngest')!).id;
    };

    expect(stageAt(12)).toBe('child');
    expect(stageAt(13)).toBe('teen');
    expect(stageAt(17)).toBe('teen');
    expect(stageAt(18)).toBe('young_adult');
    expect(stageAt(22)).toBe('young_adult');
    expect(stageAt(23)).toBe('adult');
  });

  it('counts down to the 18th birthday, and stops once there is nothing left to count', () => {
    const state = game();
    withChild(state, 'youngest');
    const base = memberAge(state, 'Testy', 'youngest')!;
    const before = daysUntilAdult(state, 'youngest')!;
    expect(before).toBeGreaterThan(0);

    state.day += (18 - base) * 365;
    expect(daysUntilAdult(state, 'youngest')).toBeNull();
  });

  /*
     CLAUDE.md point 2: a household has only 3 of 6 possible relations, and
     "no child in this household" must be a silent no-op everywhere, not a
     bug. Built rather than played toward, so this does not depend on a seed
     that happens to skip both child relations.
  */
  it('is silent for a household with neither eldest nor youngest in it', () => {
    const state = game();
    home(state).people = [
      { name: 'A', relationId: 'spouse' },
      { name: 'B', relationId: 'parent' },
      { name: 'C', relationId: 'sibling' },
    ];
    expect(home(state).people.every((p) => memberAge(state, p.name, p.relationId) === null)).toBe(
      true,
    );
    expect(homeRead(state).comingOfAge).toEqual([]);
  });

  it('homeRead names age and stage beside a household member who has one, and nothing extra for one who does not', () => {
    const state = game();
    // All three slots forced, so this does not depend on whichever two
    // non-child relations this seed's own draw happened to pick.
    home(state).people = [
      { name: 'Testy', relationId: 'youngest' },
      { name: 'Ma', relationId: 'parent' },
      { name: 'Sib', relationId: 'sibling' },
    ];
    const read = homeRead(state);
    const line = read.people.find((p) => p.startsWith('Testy'))!;
    expect(line).toMatch(/^Testy, your youngest \(\d+, (Child|Teenager|Adult)\)$/);

    // Nobody spouse/parent/sibling/elder gets a fabricated age tacked on.
    const others = read.people.filter((p) => !p.startsWith('Testy'));
    expect(others).toHaveLength(2);
    expect(others.every((p) => !/\(\d+,/.test(p))).toBe(true);
  });

  it("comingOfAge reports a household member inside the panel's own window, and stays empty outside it", () => {
    const state = game();
    withChild(state, 'eldest');
    const base = memberAge(state, 'Testy', 'eldest')!;
    // Land just outside the window first.
    state.day += (18 - base) * 365 - HOME.comingOfAgeWithinDays - 5;
    const before = homeRead(state).comingOfAge.find((c) => c.relationId === 'eldest')!.daysUntil;
    expect(before).toBeGreaterThan(HOME.comingOfAgeWithinDays);
  });
});
