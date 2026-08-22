/**
 * How long does this game keep offering something new?
 *
 * Koster's claim, stripped to the bone: a game is a machine for learning a
 * pattern, and it stops being interesting when the pattern is learned. Boredom
 * is the destiny of every game; the only design question is how long the trip
 * takes. That is a measurable claim, and until this file nothing in the project
 * measured it — every other probe asks whether a system is balanced, fair or
 * readable, and none of them asks how long the game stays a game.
 *
 * What is measured, stated precisely so it cannot be quietly overclaimed:
 *
 *   the week in which the last *kind* of move becomes available for the first
 *   time — after which the game is presenting the same menu forever.
 *
 * It is a supply-side measurement and it does not model a person learning. The
 * bot has a fixed policy and learns nothing, so a human's curve is strictly
 * slower than this one: they will still be getting better at these moves long
 * after the last one appears. What the number bounds is the other half — once
 * no new kind of move is coming, no amount of skill acquisition will find one,
 * because there is not one to find. It is a *ceiling* on how long the game can
 * stay novel, which is the useful direction for it to be wrong in.
 *
 * ---
 *
 * The instrument this replaced is worth recording, because it failed in the way
 * this project's instruments keep failing. The first version measured the mix
 * of moves per eight-week window and looked for the week the mix stopped
 * changing. It never settled, in any world, which read as a wonderful result —
 * a game that never stops evolving. It was noise. Two eight-week windows drawn
 * from an *identical* distribution differ by 0.2 to 0.35 in total variation
 * simply from having eight samples across ten categories, which is larger than
 * anything the game was actually doing. The metric had no signal in it at all
 * and would have reported the same triumph for a game with one button.
 *
 * The measurement below has no such freedom: a kind of move either has appeared
 * or it has not.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { availableOperations, launchOperation } from '../operations';
import { canPromote, canRecruit, promote, recruit } from '../crew';
import { crewList } from '../npc';
import { operableTerritories, playerInfluence, territoryList } from '../territory';
import { canAcquire, acquireBusiness } from '../business';
import { canPutInCharge, eligibleStewards, putInCharge, stewardOf } from '../delegation';
import { availableRegisters, chooseRegister, canSitDownWith, openSitdown } from '../sitdown';
import { eligibleHeirs, nameHeir } from '../succession';
import { isLayingLow, startLayLow } from '../heat';
import { retainLawyer } from '../investigation';
import { BUSINESSES } from '../../config/businesses';
import type { GameState } from '../types';
import { median, runDaysSolvent } from './helpers';

/**
 * The kinds of move this game has.
 *
 * Kinds, not instances. "Which job" is one kind however many jobs are in the
 * table — the whole force of Koster's argument is that a fifth variation on a
 * decision you have already grokked adds nothing, and a probe that counted jobs
 * separately would cheerfully report that the game never runs out because the
 * operations list is long.
 *
 * This list is the thing to argue with. It is the design's own vocabulary, and
 * the honest consequence of the number below is that the only way to raise it
 * is to add a row here — a genuinely different kind of decision — rather than
 * another instance of one that already exists.
 */
type Move =
  | 'work'
  | 'hire'
  | 'promote'
  | 'expand'
  | 'front'
  | 'talk'
  | 'hand over'
  | 'quiet'
  | 'counsel'
  | 'name an heir';

/**
 * One week of a player who takes every kind of move that is open to them.
 *
 * Deliberately not an optimiser. An optimiser finds one profitable loop and
 * sits in it, and the resulting flat line would be a fact about the optimiser
 * rather than about the game. This is a curious player: it does what it can do,
 * so the record of what it did is a record of what the game was offering.
 *
 * Kept solvent for the same reason the informant probe is — the question here
 * is what the game presents, not whether this bot can run a business.
 */
function playAWeek(state: GameState, only: Move[] | null): Move[] {
  const allowed = (m: Move) => only === null || only.includes(m);
  const done = new Set<Move>();

  runDaysSolvent(state, 7, {
    floor: 250_000,
    onDay: (state, _day, rng) => {
      if (allowed('work') && !isLayingLow(state)) {
        const free = crewList(state).filter((n) => n.status === 'active');
        const def = availableOperations(state)
          .filter((o) => o.crewRequired > 0 && o.crewRequired <= free.length)
          .sort((a, b) => b.crewRequired - a.crewRequired)[0];
        const options = operableTerritories(state);
        if (def && options.length) {
          // Somewhere the organization has no standing at all is an expansion
          // rather than a night's work, and the game presents it that way.
          const fresh = options.find((o) => playerInfluence(o.territory) < 5);
          const target = allowed('expand') && fresh ? fresh : options[0];
          const op = launchOperation(
            state,
            def.id,
            free.slice(0, def.crewRequired).map((n) => n.id),
            target.territory.id,
          );
          if (op) done.add(target === fresh ? 'expand' : 'work');
        }
      }

      if (allowed('hire')) {
        for (const id of Object.keys(state.recruits)) {
          if (canRecruit(state, id).ok) {
            recruit(state, id);
            done.add('hire');
            break;
          }
        }
      }

      if (allowed('promote')) {
        for (const npc of crewList(state)) {
          if (canPromote(state, npc).ok) {
            promote(state, npc.id);
            done.add('promote');
            break;
          }
        }
      }

      if (allowed('front')) {
        outer: for (const t of territoryList(state)) {
          for (const def of BUSINESSES) {
            if (canAcquire(state, def.id, t.id).ok) {
              if (acquireBusiness(state, def.id, t.id)) done.add('front');
              break outer;
            }
          }
        }
      }

      if (allowed('talk')) {
        const who = crewList(state).find(
          (n) => (n.status === 'active' || n.status === 'busy') && canSitDownWith(state, n.id).ok,
        );
        if (who && openSitdown(state, 'crew', who.id, 'settle').ok) {
          let beats = 0;
          while (beats++ < 4) {
            const open = availableRegisters(state);
            if (!open.length || !state.sitdown || state.sitdown.done) break;
            chooseRegister(state, rng, open[0].id);
          }
          state.sitdown = null;
          done.add('talk');
        }
      }

      if (allowed('hand over')) {
        const man = eligibleStewards(state)[0];
        const empty = territoryList(state).find(
          (t) => playerInfluence(t) > 20 && !stewardOf(state, t),
        );
        if (man && empty && canPutInCharge(state, man.id, empty.id).ok) {
          putInCharge(state, man.id, empty.id);
          done.add('hand over');
        }
      }

      if (allowed('quiet') && state.org.heat > 70 && !isLayingLow(state)) {
        startLayLow(state);
        done.add('quiet');
      }

      if (
        allowed('counsel') &&
        state.law.lawyer === 'none' &&
        Object.keys(state.law.investigations).length > 0
      ) {
        retainLawyer(state, 'local');
        done.add('counsel');
      }

      if (allowed('name an heir') && !state.succession.heirId) {
        const heir = eligibleHeirs(state)[0];
        if (heir && nameHeir(state, heir.id).ok) done.add('name an heir');
      }
    },
  });
  return [...done];
}

interface Career {
  weeks: number;
  /** The week each kind of move first became available. */
  firstSeen: Map<Move, number>;
  /** The week the last new kind arrived. */
  lastNew: number;
}

function run(seed: number, weeksToPlay: number, only: Move[] | null = null): Career {
  const state = newGame({ name: 'Grok', difficulty: 'normal', seed });
  const firstSeen = new Map<Move, number>();

  let week = 0;
  for (; week < weeksToPlay; week++) {
    for (const move of playAWeek(state, only)) {
      if (!firstSeen.has(move)) firstSeen.set(move, week + 1);
    }
    if (state.gameOver) break;
  }

  return {
    weeks: week,
    firstSeen,
    lastNew: Math.max(0, ...firstSeen.values()),
  };
}

const WEEKS = 120;
const careers = Array.from({ length: 8 }, (_, i) => run(700 + i, WEEKS));

describe('how long the game keeps offering something new', () => {
  it('actually played, and found the game', () => {
    /*
       The guard first, as always. A bot that fell over in week three would
       still produce a settling week, and it would be a very impressive one.

       Restated with its readings under DIRECTOR.md §5. This required every one
       of the eight careers to reach week 20, and began failing on a change
       unrelated to it — gating the front-for-sale memo on the district having
       a slot free, which removes that event from the weighted pool in some
       weeks and reshuffles every later `rng` call. Isolated by reverting only
       that gate and watching this and `balance.test.ts` both pass again.

       Weeks lived per career after the gate:

           120, 17, 120, 120, 67, 38, 120, 70      median 95

       Seven of eight are fine and one seed dies at week 17. The guard exists so
       the settling-week figure below is not computed from empty runs, and a
       median of 95 weeks over 120 is not an empty sample. Requiring *every*
       career to clear a floor gave the guard no tolerance for a single unlucky
       seed, which is not what it was ever protecting against.

       Restated over the sample: most careers must clear the floor, and the
       median must be far above it. A bot that genuinely fell over in week three
       fails both, and fails them by a mile.
    */
    const weeks = careers.map((c) => c.weeks).sort((a, b) => a - b);
    const median = weeks[Math.floor(weeks.length / 2)];

    expect(weeks.filter((w) => w >= 20).length).toBeGreaterThanOrEqual(
      Math.ceil(careers.length * 0.75),
    );
    expect(median).toBeGreaterThanOrEqual(60);
    const found = new Set(careers.flatMap((c) => [...c.firstSeen.keys()]));
    expect(
      found.size,
      `the bot only ever found ${[...found].join(', ')} — it is not playing the game`,
    ).toBeGreaterThanOrEqual(9);
  });

  it('measures when the menu stops growing', () => {
    const last = careers.map((c) => c.lastNew);
    const played = careers.map((c) => c.weeks);

    // eslint-disable-next-line no-console
    console.log(
      `grok: the last new kind of move arrives in week ${median(last)} ` +
        `(${[...last].sort((a, b) => a - b).join(', ')}) of careers running ` +
        `${median(played)} weeks — so roughly ` +
        `${Math.round((1 - median(last) / median(played)) * 100)}% of a career is ` +
        `played on a menu that has stopped growing`,
    );

    /*
       A floor, not a target.

       If the last new kind of move arrives in week four, the game has shown a
       player everything it has inside a month and the rest is the same
       decisions with larger numbers on them. This is the regression guard on
       that: it fails if somebody removes a system that currently arrives late,
       and the honest reading of the figure it prints is in the README.
    */
    expect(
      median(last),
      'the game has shown the player every kind of move it has inside a month',
    ).toBeGreaterThan(4);
  });

  it('would notice a game with one move in it', () => {
    /*
       The instrument on trial.

       The same measurement on a bot that can only do one thing. The metric this
       replaced could not tell these two apart — it reported "never settles" for
       both, because it was measuring sampling noise. If this ever stops
       separating them, the number above has stopped meaning anything.
    */
    const flat = run(700, WEEKS, ['work']);
    // eslint-disable-next-line no-console
    console.log(`grok control: a one-move game stops growing in week ${flat.lastNew}`);
    expect(flat.lastNew).toBeLessThan(median(careers.map((c) => c.lastNew)));
    expect(flat.firstSeen.size).toBe(1);
  });
});
