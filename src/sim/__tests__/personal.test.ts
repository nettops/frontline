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
import { goHome, home, homeRead, neglectRisk, tickHome } from '../personal';
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
