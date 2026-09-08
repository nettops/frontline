/**
 * Going and finding out.
 *
 * The property under guard is not that a button works. It is that **asking
 * does not answer the question** — the whole of `whispers.ts` is that the
 * player decides without knowing, and the obvious way to build a follow-up
 * would have been an oracle that reads `truth` and reports it. That would have
 * deleted the mechanic in order to add a button to it.
 *
 * So: the contact is fallible, `truth` never leaves the module, and the same
 * question asked twice on the same day gets the same answer rather than
 * another go at the dice.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { canLookInto, lookInto, readWhispers, whisperId } from '../whispers';
import { LOOK_INTO } from '../../config/whispers';
import { CIVIC_FIGURES } from '../../config/civic';
import { figure } from '../civic';
import { CIVIC_ATTRIBUTE } from '../../config/civic';
import type { GameState, Whisper } from '../types';

function game(seed = 4): GameState {
  return newGame({ name: 'Ears', difficulty: 'normal', seed });
}

/** A rumour on the books, with its truth set so the test can reason about it. */
function plant(state: GameState, truth: boolean): Whisper {
  const w: Whisper = {
    id: `${state.day}:somebody_talking:x`,
    day: state.day,
    kind: 'somebody_talking',
    text: 'Somebody says a name that should not have come up.',
    subject: 'x',
    confidence: 0.5,
    truth,
    corroborated: false,
  };
  state.whispers = [w];
  return w;
}

/** Somebody who owes the player one, and will take the meeting. */
function contact(state: GameState): string {
  const def = CIVIC_FIGURES[0];
  state.player.attributes[CIVIC_ATTRIBUTE] = 20;
  const held = figure(state, def.id);
  held.owed = 3;
  held.standing = 100;
  return def.id;
}

describe('looking into a rumour', () => {
  it('is refused, with a reason, when nobody owes you anything', () => {
    const state = game();
    const w = plant(state, true);
    const check = canLookInto(state, whisperId(w), CIVIC_FIGURES[0].id);
    expect(check.ok).toBe(false);
    expect(check.reason).toBeTruthy();
  });

  it('spends the favour and comes back with an opinion', () => {
    const state = game();
    const w = plant(state, true);
    const id = contact(state);
    const owedBefore = figure(state, id).owed;

    const result = lookInto(state, whisperId(w), id);
    expect(result.ok).toBe(true);
    expect(typeof result.agreed).toBe('boolean');
    expect(figure(state, id).owed).toBe(owedBefore - 1);
  });

  it('will not let the same person be asked twice', () => {
    const state = game();
    const w = plant(state, true);
    const id = contact(state);
    lookInto(state, whisperId(w), id);
    expect(canLookInto(state, whisperId(w), id).ok).toBe(false);
  });

  it('will not spend a favour on something too old to matter', () => {
    const state = game();
    const w = plant(state, true);
    const id = contact(state);
    state.day += LOOK_INTO.worthCheckingWithin + 1;
    expect(canLookInto(state, whisperId(w), id).ok).toBe(false);
  });

  /**
   * The mechanic, guarded.
   *
   * Agreement hardens the room's confidence and disagreement undermines it,
   * and neither is a statement about whether the rumour is so.
   */
  it('moves how sure the room is, in the direction of what came back', () => {
    const state = game();
    const w = plant(state, true);
    const before = w.confidence;
    const result = lookInto(state, whisperId(w), contact(state));
    if (result.agreed) expect(w.confidence).toBeGreaterThan(before);
    else expect(w.confidence).toBeLessThan(before);
  });

  it('never puts the truth on the read, before or after', () => {
    const state = game();
    const w = plant(state, false);
    lookInto(state, whisperId(w), contact(state));
    for (const r of readWhispers(state)) {
      expect(Object.keys(r)).not.toContain('truth');
    }
  });

  /**
   * The contact can be wrong, which is the reason this is a second source
   * rather than an answer. Swept across seeds so the test is about the rate
   * rather than about one draw.
   */
  it('is sometimes wrong', () => {
    let wrong = 0;
    const runs = 60;
    for (let seed = 0; seed < runs; seed++) {
      const state = game(seed + 100);
      const w = plant(state, true);
      const result = lookInto(state, whisperId(w), contact(state));
      if (result.agreed === false) wrong++;
    }
    expect(wrong).toBeGreaterThan(0);
    expect(wrong).toBeLessThan(runs);
  });

  /**
   * Asking again the same day is the same question, not another roll.
   *
   * This is what `stableNoise` buys beyond determinism: the answer is fixed
   * for a whisper, a contact and a day, so a player cannot shake the tree.
   */
  it('gives the same answer to the same question on the same day', () => {
    const first = (() => {
      const state = game(77);
      const w = plant(state, true);
      return lookInto(state, whisperId(w), contact(state)).agreed;
    })();
    const second = (() => {
      const state = game(77);
      const w = plant(state, true);
      return lookInto(state, whisperId(w), contact(state)).agreed;
    })();
    expect(first).toBe(second);
  });

  it('costs the causal stream nothing', () => {
    const state = game();
    const w = plant(state, true);
    const before = state.rng.calls;
    lookInto(state, whisperId(w), contact(state));
    expect(state.rng.calls).toBe(before);
  });

  /**
   * A feed written before any of this can still be acted on.
   *
   * `whisperId` derives the handle rather than requiring one, so no save has
   * to migrate for the panel to offer the button.
   */
  it('addresses a whisper that predates handles', () => {
    const state = game();
    const w = plant(state, true);
    delete w.id;
    expect(whisperId(w)).toBeTruthy();
    expect(readWhispers(state)[0].id).toBe(whisperId(w));
    expect(canLookInto(state, whisperId(w), contact(state)).ok).toBe(true);
  });
});
