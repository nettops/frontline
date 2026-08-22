/**
 * Can the advice the game holds actually reach a player?
 *
 * A round-7 tester played 157 days and reported that 19 of the 25 tips never
 * fired once. That reads as a broken tutorial and is mostly not: two thirds of
 * the list is gated on things that happen later than day 157, or on actions
 * that player never took. But nothing distinguished "you have not got there
 * yet" from "this predicate can never be true", and a tip that can never fire
 * is a piece of writing nobody will ever read.
 *
 * So this plays six ordinary careers to the four-year mark and records which
 * predicates ever became true. The eighteen below are the ones a
 * straightforward career reaches by doing the obvious things: run the jobs your
 * rank allows, hire when you can afford somebody, keep the payroll covered.
 *
 * The seven it does not reach are listed too, with what each one needs. All
 * seven are reachable by a player and unreachable by this bot, which is a
 * statement about the bot — it never borrows money, never makes a promise,
 * never hands a district to a steward, and never opens Simulation. Left out
 * rather than papered over, because the day one of them becomes genuinely dead
 * this list is where it will show up.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { runDaysSolvent } from '../../sim/__tests__/helpers';
import { canRecruit, recruit } from '../../sim/crew';
import { availableOperations, launchOperation } from '../../sim/operations';
import { operableTerritories, playerInfluence } from '../../sim/territory';
import { availableCrew } from '../../sim/npc';
import { TIPS } from '../tips';

/** Reached by playing a career straightforwardly. */
const ORDINARY = [
  'first_job', 'it_saves', 'reading_people', 'wages', 'dirty_money', 'heat',
  'case_open', 'ground', 'step_up', 'sitdown', 'grievance', 'delegate',
  'leaks', 'rivals', 'war', 'heir', 'trade', 'why',
];

/** Reachable, but only by doing something this bot never does. */
const NEEDS_AN_ACTION: Record<string, string> = {
  time_moves: 'a job still running before the first one has ever finished',
  more_crew: 'playing on past the first job without hiring anybody',
  debt: 'borrowing money',
  promised: 'making somebody a promise',
  ledger: 'handing a district to a steward and reading his record',
  unrest: 'a city condition this bot never provokes',
  watching: 'Simulation mode',
};

describe('the advice', () => {
  const fired = new Set<string>();

  for (let seed = 1; seed <= 6; seed++) {
    const s = newGame({ name: 'A', difficulty: 'normal', mode: 'career', seed });
    for (let d = 0; d < 1460; d++) {
      for (const t of TIPS) {
        if (!fired.has(t.id) && (!t.only || t.only.includes(s.mode)) && t.when(s)) {
          fired.add(t.id);
        }
      }
      for (const id of Object.keys(s.recruits)) {
        if (canRecruit(s, id).ok) {
          recruit(s, id);
          break;
        }
      }
      const where =
        [...operableTerritories(s)].sort(
          (a, b) => playerInfluence(b.territory) - playerInfluence(a.territory),
        )[0]?.territory.id ?? null;
      if (where) {
        for (const def of availableOperations(s)) {
          if (availableCrew(s).length < def.crewRequired) break;
          launchOperation(
            s,
            def.id,
            availableCrew(s)
              .slice(0, def.crewRequired)
              .map((n) => n.id),
            where,
          );
        }
      }
      if (runDaysSolvent(s, 1) < 1) break;
    }
  }

  it('reaches every tip an ordinary career should see', () => {
    const missed = ORDINARY.filter((id) => !fired.has(id));
    expect(missed).toEqual([]);
  });

  it('accounts for every tip in the list', () => {
    const unaccounted = TIPS.map((t) => t.id).filter(
      (id) => !ORDINARY.includes(id) && !(id in NEEDS_AN_ACTION),
    );
    expect(unaccounted).toEqual([]);
  });
});
