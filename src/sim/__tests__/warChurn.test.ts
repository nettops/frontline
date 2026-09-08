/**
 * A war that starts and ends on the same day, narrated three times.
 *
 * A blind tester reported this six times over a 481-day career, every line
 * stamped the same day and in this order:
 *
 *     The Castellan and the Delgado have stopped fighting.
 *     Delgado have declared war on Castellan.
 *     The Delgado and the Castellan are at war.
 *
 * and the Diplomacy panel reading "0 WARS IN THE CITY" three days after the
 * last one. He adjusted his diplomacy spending twice on the belief that a war
 * had just started.
 *
 * Two faults, both one line each.
 *
 * `PEACE_GRUDGE` was 52 against a `warGrudge` bar of 45, so peace capped the
 * grudge *above* the figure the rival AI needs to start a war and the pair
 * re-qualified immediately. And `executeDiplomacy` recorded the deed with
 * `observed: true` after `declareWar`/`makePeace` had already logged it, so
 * every AI war and peace reached the log twice in two phrasings.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { declareWar, makePeace, atWar, bond } from '../diplomacy';
import { tickFactions } from '../faction';
import { BOND, PEACE_GRUDGE } from '../../config/diplomacy';
import { RIVAL_IDS } from '../../config/factions';

function game(seed = 9) {
  return newGame({ name: 'War', difficulty: 'normal', seed });
}

describe('a war that has just ended', () => {
  it('leaves a grudge under the bar that starts one', () => {
    // The whole fault, as arithmetic. Peace has to mean something to the
    // decision that follows it, and above the bar it means nothing at all.
    expect(PEACE_GRUDGE).toBeLessThan(BOND.warGrudge);
  });

  it('does not re-qualify the same pair to fight again', () => {
    const state = game(11);
    const [a, b] = RIVAL_IDS;
    declareWar(state, a, b);
    expect(atWar(state, a, b)).toBe(true);

    makePeace(state, a, b);
    expect(atWar(state, a, b)).toBe(false);
    expect(bond(state, a, b).grudge).toBeLessThan(BOND.warGrudge);
  });

  it('is never announced as starting and stopping on the same day', () => {
    /*
       The behavioural half. The arithmetic above can be satisfied by a number
       and this cannot: it runs the rival AI for four years and reads the log
       the player would have read.
    */
    const state = game(12);
    const rng = new Rng(state.rng);
    let everStarted = 0;
    const started = /declared war|are at war/i;
    const stopped = /stopped fighting|made peace|war with .* is over/i;

    for (let day = 1; day <= 1_460; day++) {
      state.day = day;
      const before = state.log.length;
      tickFactions(state, rng);
      const today = state.log.slice(0, Math.max(0, state.log.length - before));
      const text = today.map((l) => l.text);
      const opens = text.filter((t) => started.test(t));
      everStarted += opens.length;
      const closes = text.filter((t) => stopped.test(t));

      expect(
        opens.length + closes.length,
        `day ${day} announced both a war and a peace: ${text.join(' / ')}`,
      ).toBeLessThanOrEqual(Math.max(opens.length, closes.length));

      // And each event is announced once, not twice in two phrasings.
      expect(opens.length, `day ${day}: ${opens.join(' / ')}`).toBeLessThanOrEqual(1);
      expect(closes.length, `day ${day}: ${closes.join(' / ')}`).toBeLessThanOrEqual(1);
    }

    // Four years of a city where nobody ever fights would pass every
    // assertion above without measuring anything.
    expect(everStarted, 'no war was ever declared, so nothing was checked').toBeGreaterThan(3);
  });
});
