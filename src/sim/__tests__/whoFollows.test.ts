/**
 * Which way a tie points, and the direction that had no view.
 *
 * Ties are stored on the man whose opinion changed. `recordTie` mirrors only
 * the causes that are genuinely mutual — `passed_over` and `took_the_blame`
 * are one-sided on purpose, and that asymmetry is what makes them useful.
 *
 * The consequence is that `readTies(npc)` answers *who would this man follow*
 * and cannot answer *who would follow this man*, because those facts live on
 * other people's sheets. `followDeparture` reads the second one — it iterates
 * everybody whose tie to the leaver clears `TIE_DEPARTURE.followTrustAbove` —
 * so the compounding walkout was legible from every dossier except the one it
 * is about. A boss looking at the man he was thinking of dismissing saw
 * nothing at all.
 *
 * What is guarded here is that the two reads stay opposite, that the warning
 * agrees with the behaviour it warns about, and that neither of them starts
 * telling the player about people they have never met.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList, generateNpc } from '../npc';
import { readTies, whoWouldFollow, followRisk, followDeparture, recordTie } from '../ties';
import { TIE_DEPARTURE } from '../../config/ties';
import type { GameState, Npc } from '../types';

/** A career with enough people in it for anybody to be behind anybody. */
function game(seed = 4, extra = 5): GameState {
  const state = newGame({ name: 'Behind', difficulty: 'normal', seed });
  for (let i = 0; i < extra; i++) {
    const npc = generateNpc(state, new Rng({ seed: 88, calls: i * 37 }), 'soldier');
    state.npcs[npc.id] = npc;
  }
  // Both reads are gated on knowing both men; these tests are about direction.
  for (const n of crewList(state)) n.familiarity = 100;
  return state;
}

function two(state: GameState): [Npc, Npc] {
  const crew = crewList(state).filter((n) => n.status !== 'dead');
  if (crew.length < 2) throw new Error('need two people');
  return [crew[0], crew[1]];
}

/** Put trust on `from` toward `to` directly, so the direction is unambiguous. */
function trusts(from: Npc, to: Npc, amount: number): void {
  recordTie(1, from, to, 'worked_together');
  const tie = from.ties.find((t) => t.id === to.id)!;
  tie.trust = amount;
  tie.resentment = 0;
  tie.debt = 0;
}

describe('the two directions of a tie', () => {
  it('are opposite, and only one of them used to have a view', () => {
    const state = game();
    const [a, b] = two(state);
    trusts(a, b, 80);

    // A's sheet says he rates B. That was always readable.
    expect(readTies(state, a).some((t) => t.name === b.name)).toBe(true);
    // B's sheet now says A is behind him. That is the new half.
    expect(whoWouldFollow(state, b).some((t) => t.name === a.name)).toBe(true);

    // And it does not invent the mirror: B has no opinion of A.
    expect(readTies(state, b).some((t) => t.name === a.name)).toBe(false);
    expect(whoWouldFollow(state, a).some((t) => t.name === b.name)).toBe(false);
  });

  /**
   * The warning has to agree with the thing it warns about.
   *
   * Both sides read `TIE_DEPARTURE.followTrustAbove` rather than a copy of the
   * number, so this checks the boundary rather than a value: a man just under
   * the bar is not shown as being behind anybody, and one just over is.
   */
  it('names somebody exactly when the simulation would take him', () => {
    const state = game();
    const [a, b] = two(state);

    trusts(a, b, TIE_DEPARTURE.followTrustAbove - 1);
    expect(whoWouldFollow(state, b).some((t) => t.name === a.name)).toBe(false);

    trusts(a, b, TIE_DEPARTURE.followTrustAbove);
    expect(whoWouldFollow(state, b).some((t) => t.name === a.name)).toBe(true);
  });

  /**
   * And the count agrees with what a departure would actually do.
   *
   * `followRisk` is the ceiling rather than the expected number — the
   * simulation still rolls `followChance` on each of them — so what is checked
   * is that a real departure never takes more than the sheet said it might.
   */
  it('never promises fewer than a departure takes', () => {
    const state = game(9, 8);
    const [leaver] = two(state);
    for (const n of crewList(state)) {
      if (n.id !== leaver.id) trusts(n, leaver, 90);
    }

    const risk = followRisk(state, leaver);
    expect(risk, 'nobody is behind a man the whole crew trusts').toBeGreaterThan(1);

    const went = followDeparture(state, new Rng({ seed: 3, calls: 0 }), leaver, () => {});
    expect(
      went.length,
      `${went.length} walked out behind him and the sheet said at most ${risk}`,
    ).toBeLessThanOrEqual(risk);
  });

  /**
   * And nobody is nobody, not one.
   *
   * `followDeparture`'s `Math.max(1, ...)` is a floor on the *ceiling* — one
   * man is the smallest share an organization can lose — and reading it as a
   * floor on the answer would put "as many as 1 could go with them" on the
   * sheet of every man in the game nobody rates.
   */
  it('counts nobody when nobody rates him', () => {
    const state = game();
    const [, b] = two(state);
    expect(whoWouldFollow(state, b)).toHaveLength(0);
    expect(followRisk(state, b)).toBe(0);
  });

  /**
   * Somebody who will not be in a room with him is also standing behind him,
   * in the sense this section means: it is a fact about him that lives on
   * somebody else's sheet.
   */
  it('shows the man who will not work with him either', () => {
    const state = game();
    const [a, b] = two(state);
    recordTie(1, a, b, 'took_the_blame');
    const tie = a.ties.find((t) => t.id === b.id)!;
    tie.resentment = 80;
    tie.trust = 0;

    const behind = whoWouldFollow(state, b);
    expect(behind.some((t) => t.name === a.name && t.tone === 'bad')).toBe(true);
  });
});

describe('and neither read gossips', () => {
  /**
   * The rule the outward read already sets: you notice this by being in a room
   * with two people, so knowing one of them tells you nothing.
   */
  it('says nothing about somebody you have not got the measure of', () => {
    const state = game();
    const [a, b] = two(state);
    trusts(a, b, 90);

    a.familiarity = 10;
    expect(whoWouldFollow(state, b)).toHaveLength(0);

    a.familiarity = 100;
    b.familiarity = 10;
    expect(whoWouldFollow(state, b)).toHaveLength(0);
  });

  it('never puts a number or a stat name in a line', () => {
    const state = game();
    const [a, b] = two(state);
    trusts(a, b, 90);
    for (const t of whoWouldFollow(state, b)) {
      expect(t.text).not.toMatch(/\d/);
      expect(t.text.toLowerCase()).not.toMatch(/trust|resentment|loyalty|stat/);
    }
  });

  it('changes nothing it reads', () => {
    const state = game(11);
    const [a, b] = two(state);
    trusts(a, b, 70);
    const snapshot = JSON.stringify(state);
    whoWouldFollow(state, b);
    followRisk(state, b);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('survives a crew written before anybody had ties', () => {
    const state = game(12);
    for (const n of crewList(state)) (n as { ties?: unknown }).ties = [];
    expect(() => whoWouldFollow(state, two(state)[0])).not.toThrow();
  });
});
