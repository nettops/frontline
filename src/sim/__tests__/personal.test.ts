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
  canGoHome,
  familyHorizon,
  goHome,
  home,
  homeRead,
  homeTier,
  neglectRisk,
  tickHome,
} from '../personal';
import { canLaunch, launchOperation } from '../operations';
import { OPERATION_BY_ID } from '../../config/operations';
import { HOME_TERRITORY } from '../../config/territories';
import { HOME, RELATIONS } from '../../config/personal';
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
