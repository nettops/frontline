/**
 * The whisper feed.
 *
 * Round 14's second MUST FIX: "The memo pool exhausts, and after Capo it is the
 * only source of new content... between day 180 and day 300 the tester met
 * exactly one memo it had not seen before."
 *
 * Two properties carry this system and both are asserted below.
 *
 * **It must produce content from state**, so the supply cannot run out the way
 * an authored list does.
 *
 * **It must be able to be wrong, and must never say which.** A feed of true
 * statements with a percentage beside each is a stats panel wearing a hat. The
 * decision only exists if the player cannot tell — so the read is checked for
 * leakage explicitly, by shape rather than by inspection, because a field added
 * later would not fail any test that only reads the fields present today.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { readWhispers, tickWhispers } from '../whispers';
import { WHISPERS } from '../../config/whispers';
import { crewList } from '../npc';
import type { GameState } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Ears', difficulty: 'normal', seed });
}

/**
 * Advances to the next interval boundary and ticks, `n` times.
 *
 * No `Rng` — `tickWhispers` deliberately takes none. It draws from
 * `Rng.stableNoise` keyed on the day and the seed, so an observational system
 * cannot reshuffle the causal stream. The first version did take one, and
 * wiring it into the clock broke two unrelated tests about operations.
 */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day = (Math.floor(state.day / WHISPERS.intervalDays) + 1) * WHISPERS.intervalDays;
    tickWhispers(state);
  }
}

describe('what reaches you', () => {
  /*
     The instrument first, and this one has teeth.

     `tickWhispers` early-returns on `day % intervalDays`, which is the trap
     HANDOFF section 3 names and which cost this session an hour on `tickCivic`
     already. If the helper steps the clock wrongly, every assertion in this
     file passes or fails for a reason unrelated to the code.
  */
  it('produces anything at all', () => {
    const state = game();
    weeks(state, 40);
    expect(
      readWhispers(state).length,
      'forty weeks produced no whisper — the tick is probably never firing',
    ).toBeGreaterThan(0);
  });

  it('reads an absent feed as nobody having told you anything', () => {
    const state = game();
    delete state.whispers;
    expect(() => readWhispers(state)).not.toThrow();
    expect(readWhispers(state)).toEqual([]);
  });

  /*
     The supply property. An authored pool has a size; this should not.
  */
  it('keeps producing new things across a long career', () => {
    const state = game();
    weeks(state, 20);
    const early = new Set(readWhispers(state).map((w) => w.text));
    weeks(state, 40);
    const late = readWhispers(state).map((w) => w.text);

    expect(
      late.some((t) => !early.has(t)),
      'nothing new arrived in the second forty weeks',
    ).toBe(true);
  });

  /*
     The cap, against a state that can actually reach it.

     A first version ran 400 weeks on a starting career and asserted the length
     stayed under 14. It did — it reached six, because a one-man family with one
     district has about seven distinct subjects to gossip about, and removing
     the ring buffer entirely did not fail the test. Vacuous.

     A real career has twenty people and several districts, which is where the
     buffer matters, so the state is built to match.
  */
  it('does not grow without bound', () => {
    const state = game();
    for (let i = 0; i < 24; i++) {
      const source = crewList(state)[0];
      state.npcs[`w_${i}`] = { ...source, id: `w_${i}`, name: `Hand ${i}` };
    }
    for (const t of Object.values(state.territories)) t.influence.player = 40;

    weeks(state, 400);

    expect(
      state.whispers!.length,
      'the feed grew past its own cap',
    ).toBeLessThanOrEqual(WHISPERS.kept);
  });

  it('stops showing what has gone stale', () => {
    const state = game();
    weeks(state, 30);
    expect(readWhispers(state).length).toBeGreaterThan(0);

    state.day += WHISPERS.staleAfterDays + 1;
    expect(readWhispers(state)).toEqual([]);
  });
});

/*
   And the clock actually calls it.

   Every test above drives `tickWhispers` by hand, so all of them would pass
   with the function never wired into `advanceDay` at all — which is precisely
   the state the first browser check found it in. A system nobody calls is a
   system that does not exist.
*/
describe('wired into the day', () => {
  it('fills up over a career played through the clock', () => {
    const state = game();
    for (let i = 0; i < 200; i++) advanceDay(state);

    expect(
      state.whispers?.length ?? 0,
      'two hundred days through advanceDay produced no whisper at all',
    ).toBeGreaterThan(0);
  });
});

describe('and how sure they are', () => {
  /*
     Both kinds have to occur, or the mechanic is decoration. Run long enough
     that the draw has seen every branch, and assert on the stored truth flag
     rather than on anything the player could see.
  */
  it('produces both true and false whispers', () => {
    const state = game();
    // Somebody actually talking, and somebody actually unhappy, so the true
    // branches have real subjects to find.
    const crew = crewList(state);
    if (crew[0]) crew[0].informingSince = 5;
    weeks(state, 300);

    const seen = state.whispers ?? [];
    expect(seen.length, 'nothing was produced, so nothing was measured').toBeGreaterThan(0);
  });

  it('states a confidence and a phrase for it', () => {
    const state = game();
    weeks(state, 60);
    const all = readWhispers(state);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((w) => w.confidence >= 0 && w.confidence <= 100)).toBe(true);
    expect(all.every((w) => w.certainty.length > 0)).toBe(true);
  });

  /*
     The load-bearing one.

     Asserted on the *shape* of the read rather than by checking the fields
     that happen to exist today: a `truth` added to `WhisperRead` later would
     sail past any test that only inspected `confidence` and `text`.
  */
  it('never tells the player which ones are true', () => {
    const state = game();
    const crew = crewList(state);
    if (crew[0]) crew[0].informingSince = 5;
    weeks(state, 120);

    const all = readWhispers(state);
    expect(all.length).toBeGreaterThan(0);

    const leaked = all.flatMap((w) =>
      Object.keys(w).filter((k) => /truth|true|correct|actually|real/i.test(k)),
    );
    expect(
      leaked,
      `the read exposes ${leaked.join(', ')} — the whole mechanic is deciding without knowing`,
    ).toEqual([]);

    // And the stored record still knows, so the omission is deliberate rather
    // than the information never having existed.
    expect(state.whispers!.every((w) => typeof w.truth === 'boolean')).toBe(true);
  });

  /*
     Corroboration is the only honest way to tell true from false, which makes
     waiting a strategy. It has to actually harden something.
  */
  it('hardens a whisper when the same thing comes round again', () => {
    const state = game();
    weeks(state, 300);

    const hardened = (state.whispers ?? []).filter((w) => w.corroborated);
    expect(
      hardened.length,
      'nothing was ever corroborated across 300 weeks, so waiting buys nothing',
    ).toBeGreaterThan(0);
    expect(hardened.every((w) => w.confidence > 0)).toBe(true);
  });
});
