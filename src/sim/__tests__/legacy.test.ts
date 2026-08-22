/**
 * Legitimacy, and what a career turns out to have been.
 *
 * The property that matters is not that the shapes are reachable — it is that
 * they can *fail* to match. Round 14 stopped at day 300 because the brief said
 * to, having met four of five Capo lines, and scored Fun 5 while scoring seven
 * other axes at their best. A system that always finds something flattering to
 * say about that career would be worse than none: it would be a horoscope with
 * the game's own numbers in it.
 *
 * So most of what follows checks that an ordinary career gets the ordinary
 * name, and that each shape is claimed only by a career that actually did the
 * thing.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { careerShape, legitimacy, postMortem } from '../legacy';
import { estate } from '../estate';
import { figure } from '../civic';
import { SHAPE_BARS } from '../../config/legacy';
import { CIVIC_FIGURES } from '../../config/civic';
import { territoryList } from '../territory';
import type { GameState } from '../types';

function game(seed = 7): GameState {
  return newGame({ name: 'Legacy', difficulty: 'normal', seed });
}

describe('how legitimate it looks', () => {
  it('reads a fresh career as neither one thing nor the other', () => {
    // The instrument first: a reading pinned at 0 or 100 would pass several of
    // the comparisons below without measuring anything.
    const value = legitimacy(game());
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it('falls when the police get interested', () => {
    const state = game();
    const before = legitimacy(state);
    state.org.heat = 95;
    expect(legitimacy(state)).toBeLessThan(before);
  });

  it('falls when the papers start using your name', () => {
    const state = game();
    const before = legitimacy(state);
    state.city.notoriety = 90;
    expect(legitimacy(state)).toBeLessThan(before);
  });

  /*
     And the term that is actually about the money, not about attention.

     A drawer full of cash nobody can explain is the whole reason this reading
     exists, so it has to move on its own with heat and the papers held still.
  */
  it('falls when the money on hand cannot be explained', () => {
    const state = game();
    state.org.cash = 50_000;
    state.org.dirtyCash = 0;
    const clean = legitimacy(state);

    state.org.cash = 0;
    state.org.dirtyCash = 50_000;
    expect(legitimacy(state)).toBeLessThan(clean);
  });
});

describe('what the career turns out to have been', () => {
  it('gives an ordinary career the ordinary name', () => {
    expect(careerShape(game()).id).toBe('unremarkable');
  });

  it('names the ground when there is ground', () => {
    const state = game();
    const all = territoryList(state);
    for (let i = 0; i < SHAPE_BARS.kingpinDistricts; i++) all[i].influence.player = 60;

    const shape = careerShape(state);
    expect(shape.id).toBe('kingpin');
    expect(shape.because, 'the verdict did not say what earned it').toContain(
      String(SHAPE_BARS.kingpinDistricts),
    );
  });

  it('names fear when the family ran on it', () => {
    const state = game();
    state.org.fear = SHAPE_BARS.streetKingFear + 5;
    expect(careerShape(state).id).toBe('street_king');
  });

  it('names the network when people owe you', () => {
    const state = game();
    for (const def of CIVIC_FIGURES) figure(state, def.id).owed = 2;
    state.player.attributes.influence = SHAPE_BARS.diplomatInfluence;
    expect(careerShape(state).id).toBe('diplomat');
  });

  /*
     Found on the live screen, not by a test.

     Favours accrue from how the family is run, and a captain watches how quiet
     you keep things — so a career that does nothing has heat 0, a captain who
     likes it, and favours in hand. The screen was calling that boss The
     Diplomat at 0 operations and 0 respect, which is exactly the horoscope
     this file is supposed to refuse to be.
  */
  it('does not call a career that did nothing a diplomat', () => {
    const state = game();
    for (const def of CIVIC_FIGURES) figure(state, def.id).owed = 2;
    state.player.attributes.influence = 0;

    expect(careerShape(state).id).toBe('unremarkable');
  });

  /*
     The loudest verdict in the game, and the one most likely to be handed out
     by accident. A family that never had anything cannot have lost it.
  */
  it('calls a collapse a collapse', () => {
    const state = game();
    state.org.record = {
      respect: 0,
      crew: 0,
      estate: SHAPE_BARS.tragicPeakAbove * 2,
      ops: 0,
      districts: 0,
      opsSeen: 0,
    };
    state.org.cash = 100;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;

    expect(careerShape(state).id).toBe('tragic');
  });

  it('does not call a career that never had anything a tragedy', () => {
    const state = game();
    state.org.record = {
      respect: 0,
      crew: 0,
      estate: SHAPE_BARS.tragicPeakAbove - 1,
      ops: 0,
      districts: 0,
      opsSeen: 0,
    };
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;

    expect(careerShape(state).id).not.toBe('tragic');
  });

  /*
     Weight, not list order. Somebody who took the whole city and also happens
     to clear the fear bar is a Kingpin, and adding a shape must not be able to
     change that by being declared earlier.
  */
  it('takes the heavier shape when two of them fit', () => {
    const state = game();
    const all = territoryList(state);
    for (let i = 0; i < SHAPE_BARS.kingpinDistricts; i++) all[i].influence.player = 60;
    state.org.fear = SHAPE_BARS.streetKingFear + 20;

    expect(careerShape(state).id).toBe('kingpin');
  });
});

describe('the post-mortem', () => {
  /*
     F11: "the death screen has no post-mortem... The moment the player most
     needs to be shown what he missed shows him the least."
  */
  it('says what it was worth at its best, not only at the end', () => {
    const state = game();
    state.org.record = {
      respect: 400,
      crew: 9,
      estate: 900_000,
      ops: 40,
      districts: 3,
      opsSeen: 0,
    };
    state.org.cash = 10;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;

    const lines = postMortem(state);
    const best = lines.find((l) => /best/i.test(l.label));
    expect(best, 'no line reported the peak').toBeDefined();
    expect(best!.value).toContain('900,000');

    // And the end is reported too, so the gap between them is the story.
    const now = lines.find((l) => /at the end/i.test(l.label));
    expect(now!.value).not.toContain('900,000');
    expect(now!.value).toContain(String(estate(state).total.toLocaleString('en-US')));
  });

  it('reports every line with something in it', () => {
    const lines = postMortem(game());
    expect(lines.length).toBeGreaterThan(4);
    expect(lines.every((l) => l.label.length > 0 && l.value.length > 0)).toBe(true);
  });
});
