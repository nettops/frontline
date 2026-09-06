/**
 * Round 11's tip queue, still starved four rounds after it was fixed.
 *
 * `TIP_LINGER_DAYS` went in because one tip whose condition stayed true sat at
 * the head of the queue forever and every later tip was unreachable — a
 * 303-day career that read "5 OF 25 SAID" with THE LAW pinned for 258 of them.
 * The linger fixed that for ordinary tips. It never applied to the ones that
 * jump: `nextTip` returned an urgent tip before the check, so an urgent tip
 * whose condition kept holding still owned the strip for the rest of the run.
 *
 * The five urgent conditions are `heat >= 35`, an open case, a leak, unrest and
 * a war. **The first two are the steady state of a working family.** Measured
 * over six ordinary 300-day careers driving `nextTip`/`markShown` exactly as
 * `Coach` does, THE LAW and the case tip alternated at the head from day 19 to
 * the end, five tips of twenty-eight ever reached the screen, and eleven
 * predicates were true on the last day having never been shown once.
 *
 * Among them `the_game`, which is why this file exists. Three blind rounds have
 * finished without a tester sitting down at the card game, and the reason
 * written on the carried list for two of them was the respect gate. It was not
 * the gate: the back room is `respectAbove: 0` at a $400 stake and
 * `ladder.probe` reads 36 of 36 careers invited by median day 7, with the
 * condition holding for 234 days of 300. The tip that is the game's only
 * unprompted mention of the whole system could not reach the screen.
 *
 * The bot is the one from `tips.reach.test.ts`, playing a career straight: hire
 * when you can, buy a front when one is for sale, run the jobs your rank
 * allows. Three hundred days rather than four years, because that is a round.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../../sim/state';
import { runDaysSolvent } from '../../sim/__tests__/helpers';
import { canRecruit, recruit } from '../../sim/crew';
import { availableOperations, launchOperation } from '../../sim/operations';
import { operableTerritories, playerInfluence } from '../../sim/territory';
import { availableCrew } from '../../sim/npc';
import { acquireBusiness, canAcquire } from '../../sim/business';
import { BUSINESSES } from '../../config/businesses';
import { markShown, nextTip, TIPS } from '../tips';

const DAYS = 300;
const SEEDS = [1, 2, 3, 4, 5, 6];

interface Career {
  /** Every tip that reached the strip, in the order it got there. */
  shown: string[];
  /** Day `the_game` first reached it, or null. */
  gameDay: number | null;
  /** Days its predicate held, whether or not anybody was told. */
  gameHeld: number;
}

function play(seed: number): Career {
  const s = newGame({ name: 'A', difficulty: 'normal', mode: 'career', seed });
  const game = TIPS.find((t) => t.id === 'the_game')!;
  const shown: string[] = [];
  let gameDay: number | null = null;
  let gameHeld = 0;

  for (let d = 0; d < DAYS; d++) {
    /*
       What `Coach` does: read the head, and write that it went past. Both
       calls, because `markShown` is what makes the queue move and a test that
       only read would report a queue nobody had advanced.
    */
    const tip = nextTip(s);
    if (tip) {
      markShown(s, tip.id);
      if (!shown.includes(tip.id)) shown.push(tip.id);
      if (tip.id === 'the_game') gameDay ??= s.day;
    }
    if (game.when(s)) gameHeld += 1;

    for (const id of Object.keys(s.recruits)) {
      if (canRecruit(s, id).ok) {
        recruit(s, id);
        break;
      }
    }
    for (const t of Object.values(s.territories)) {
      for (const def of BUSINESSES) {
        if (canAcquire(s, def.id, t.id).ok) {
          acquireBusiness(s, def.id, t.id);
          break;
        }
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
  return { shown, gameDay, gameHeld };
}

describe('the advice a career actually gets', () => {
  const careers = SEEDS.map(play);

  it('gets through the catalogue rather than repeating two lines', () => {
    const counts = careers.map((c) => c.shown.length).sort((a, b) => a - b);
    const middle = counts[Math.floor(counts.length / 2)];
    /*
       Fourteen in the median career after the change, five before it. Ten is
       the bar because the failure this guards is a queue that stops, and a
       career that gets through ten of twenty-eight lines has not stopped.
    */
    expect(middle, 'the tip queue has stopped moving again').toBeGreaterThanOrEqual(10);
  });

  it('tells a player there is a card game', () => {
    /*
       The specific finding. Its predicate holds for most of every career, so a
       career that is never told is a queue defect and not a career that never
       qualified — the second assertion is what separates those, and it is the
       one that would have made this test pass vacuously if it were missing.
    */
    expect(Math.min(...careers.map((c) => c.gameHeld))).toBeGreaterThan(DAYS / 3);

    const told = careers.filter((c) => c.gameDay !== null);
    expect(told.length, 'nobody is ever told there is a game').toBeGreaterThanOrEqual(
      SEEDS.length - 1,
    );
    expect(
      Math.max(...told.map((c) => c.gameDay ?? 0)),
      'a player is told about the game too late in a round to act on it',
    ).toBeLessThan(200);
  });
});
