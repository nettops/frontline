/**
 * Somebody is waiting to see you.
 *
 * Three properties are guarded here, and only the first is about the feature.
 *
 * 1. **A man with a reason turns up, and a man without one does not.** The
 *    failure mode this replaces is not "no approaches" — it is a doorway with
 *    everybody in it, which reads as the simulation shouting.
 *
 * 2. **It changes nothing.** This is a leaf read. Calling it must not move a
 *    stat, consume a random draw, or alter what the rest of the day does.
 *    `whispers.ts` records what happens when a reporting system forgets this:
 *    two unrelated operations tests went red the moment it was wired in.
 *
 * 3. **It costs no memo slot.** The whole architectural argument for building
 *    the engagement layer as a read rather than as event definitions is that
 *    `tickEvents` is a shared quarter-memo a day. A test that let an approach
 *    quietly become an event would delete that argument without anybody
 *    noticing.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { advanceDay } from '../clock';
import { crewList } from '../npc';
import { approaches } from '../approaches';
import { makePromise } from '../promises';
import { remember } from '../memory';
import { openSitdown, endSitdown } from '../sitdown';
import { availableOperations, launchOperation } from '../operations';
import { canRecruit, canPromote, promote, recruit } from '../crew';
import { operableTerritories } from '../territory';
import { isLayingLow } from '../heat';
import { runDaysSolvent, median } from './helpers';
import { APPROACH } from '../../config/approaches';
import { PROMISES } from '../../config/promises';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Door', difficulty: 'normal', seed });
}

function someone(state: GameState): Npc {
  const npc = crewList(state)[0];
  if (!npc) throw new Error('a career starts with a crew; this seed did not');
  return npc;
}

/**
 * Give him a live grudge: the number *and* something recent to hold it about.
 *
 * Both halves are the precondition. Gated on the stat alone, one man stood in
 * the doorway for 124 consecutive days of a measured career — so the branch
 * asks for a fresh bad memory too, and these tests have to say so.
 */
function aggrieve(state: GameState, npc: Npc, level: number): void {
  npc.stats.grievance = level;
  remember(npc, state.day, 'passed_over');
}

/** Nobody has any reason to be at the door. */
function calm(state: GameState): void {
  for (const npc of crewList(state)) {
    npc.stats.grievance = 10;
    npc.stats.ambition = 10;
    npc.stats.fear = 10;
    npc.memories = [];
  }
  state.promises = [];
}

describe('who is waiting to see you', () => {
  it('is nobody, when nobody has a reason', () => {
    const state = game();
    calm(state);
    expect(approaches(state)).toHaveLength(0);
  });

  it('is the man carrying something', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceAsksAbove + 5);

    const waiting = approaches(state);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].npcId).toBe(npc.id);
    expect(waiting[0].urgency).toBe('soon');
  });

  it('says it is urgent once it has stopped resolving itself', () => {
    const state = game();
    calm(state);
    aggrieve(state, someone(state), APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)[0].urgency).toBe('now');
  });

  /**
   * The promise beats the grudge underneath it.
   *
   * A man with both leads with the promise, because that is the thing the
   * player can act on today and the thing he would actually open with.
   */
  it('leads with the promise when there is one coming due', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    npc.stats.grievance = APPROACH.grievanceUrgentAbove + 5;
    makePromise(state, npc.id, 'promoted');
    // Wind it down to inside the window without moving anything else.
    const owed = state.promises!.find((p) => p.npcId === npc.id)!;
    owed.dueDay = state.day + 1;

    const waiting = approaches(state);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].urgency).toBe('now');
    expect(waiting[0].text).toContain(PROMISES.promoted.outstanding.toLowerCase());
  });

  it('does not come back the week after being heard', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);

    openSitdown(state, 'crew', npc.id, 'settle');
    endSitdown(state);

    expect(approaches(state)).toHaveLength(0);
  });

  it('comes back once enough time has gone by', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    openSitdown(state, 'crew', npc.id, 'settle');
    endSitdown(state);

    state.day += APPROACH.quietDaysAfterMeeting;
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);
  });

  it('never puts more than a queue at the door', () => {
    const state = game(8);
    calm(state);
    for (const npc of crewList(state)) {
      aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    }
    expect(approaches(state).length).toBeLessThanOrEqual(APPROACH.most);
  });

  it('says nothing while you are already in a room', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    const other = crewList(state)[1];
    if (other) aggrieve(state, other, APPROACH.grievanceUrgentAbove + 5);

    openSitdown(state, 'crew', npc.id, 'settle');
    expect(approaches(state)).toHaveLength(0);
  });

  it('leaves the dead and the unreachable where they are', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    npc.status = 'arrested';
    expect(approaches(state)).toHaveLength(0);
  });

  /**
   * A number on its own is not a reason to knock.
   *
   * This is the measured fix. Gated on grievance alone, one man waited 124
   * consecutive days of a 300-day career and the feature averaged two
   * distinct people across four seeds. A grudge nobody has added to lately is
   * a man getting on with it, which is most unhappy people most of the time.
   */
  it('does not come for a grudge that nothing has fed lately', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    npc.stats.grievance = APPROACH.grievanceUrgentAbove + 5;
    expect(approaches(state)).toHaveLength(0);

    remember(npc, state.day, 'passed_over');
    expect(approaches(state)).toHaveLength(1);
  });

  it('stops coming once the reason has gone stale', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    aggrieve(state, npc, APPROACH.grievanceUrgentAbove + 5);
    expect(approaches(state)).toHaveLength(1);

    state.day += APPROACH.memoryFreshDays + 1;
    expect(approaches(state)).toHaveLength(0);
  });

  /**
   * The branch that was ninety-nine point seven percent of the feature.
   *
   * Gated on `fear >= 65` and any bad memory, this fired for the whole crew
   * from about day 90 of every career: crew fear is a one-way ratchet, so a
   * boss who sends anybody out at all reaches a median crew fear of 94 by day
   * 300 while one who never works stays at 48. The bar was measuring whether
   * the player had played. The doorway was lit on 71% of days at its cap of
   * three, saying one sentence.
   */
  it('does not come for a man who is frightened because he always was', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    // Rolled jumpy, and no more frightened now than the day he was hired.
    npc.fearBase = APPROACH.fearAsksAbove + 5;
    npc.stats.fear = APPROACH.fearAsksAbove + 5;
    remember(npc, state.day, 'took_a_charge');
    expect(approaches(state)).toHaveLength(0);

    // The same man, after something moved him well off his own nerve.
    npc.stats.fear = npc.fearBase + APPROACH.fearRiseAbove;
    expect(approaches(state)).toHaveLength(1);
  });

  /**
   * And it has to be a fright rather than any bad week.
   *
   * `tone: 'bad'` covers going unpaid and being passed over as readily as it
   * covers an arrest, so the old gate had a man coming to be reassured about
   * his wages. Those are grudges and have their own lines.
   */
  it('comes for a fright, not for a grudge', () => {
    const state = game();
    calm(state);
    const npc = someone(state);
    npc.fearBase = 20;
    npc.stats.fear = Math.max(APPROACH.fearAsksAbove, 20 + APPROACH.fearRiseAbove) + 5;

    // Aggrieved, and nothing has frightened him: the fear branch stays shut.
    // (`went_unpaid` has its own line, which is why this asserts the text.)
    remember(npc, state.day, 'passed_over');
    expect(approaches(state)).toHaveLength(0);

    remember(npc, state.day, 'was_hurt');
    const waiting = approaches(state);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].text).toContain('waiting outside');
  });

  /**
   * Every kind named in config actually reaches him.
   *
   * The list is a design statement about what frightens somebody, and a
   * memory kind renamed out from under it would silently narrow the branch
   * rather than break anything.
   */
  it('is frightened by everything the config says frightens him', () => {
    for (const kind of APPROACH.frightenedBy) {
      const state = game();
      calm(state);
      const npc = someone(state);
      npc.fearBase = 20;
      npc.stats.fear = Math.max(APPROACH.fearAsksAbove, 20 + APPROACH.fearRiseAbove) + 5;
      remember(npc, state.day, kind);
      expect(approaches(state), `${kind} does not bring him`).toHaveLength(1);
    }
  });

  /**
   * It reads hidden stats and must never print one.
   *
   * The licence for reading grievance is that the man is telling you, and
   * that licence ends the moment a line says a number. Checked against every
   * branch rather than against the one being exercised.
   */
  it('never puts a number or a stat name on screen', () => {
    const state = game(12);
    const npc = someone(state);
    npc.stats.grievance = 91;
    npc.stats.ambition = 88;
    npc.stats.fear = 90;
    remember(npc, state.day, 'passed_over');
    remember(npc, state.day, 'went_unpaid');
    makePromise(state, npc.id, 'next_in_line');

    for (const a of approaches(state)) {
      expect(a.text).not.toMatch(/\d/);
      expect(a.text.toLowerCase()).not.toMatch(/grievance|ambition|loyalty|fear|stat/);
    }
  });
});

describe('the read changes nothing', () => {
  /**
   * A reporting system that touches the causal stream reorders every later
   * draw in the simulation. `whispers.ts` learned this by breaking two
   * operations tests, and states the rule at the top of the file.
   */
  it('consumes no random draws', () => {
    const state = game(5);
    const before = state.rng.calls;
    approaches(state);
    approaches(state);
    expect(state.rng.calls).toBe(before);
  });

  it('moves nothing on the state it reads', () => {
    const state = game(6);
    const npc = someone(state);
    npc.stats.grievance = 80;
    const snapshot = JSON.stringify(state);
    approaches(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  /**
   * The architectural claim, guarded.
   *
   * The engagement layer is a read specifically so that it does not compete
   * for `tickEvents`'s shared quarter-memo a day. If an approach ever became
   * an event, that would silently stop being true.
   */
  it('queues no memo', () => {
    const state = game(7);
    for (const npc of crewList(state)) npc.stats.grievance = 90;
    const before = state.pendingEvents.length;
    approaches(state);
    expect(state.pendingEvents.length).toBe(before);
  });

  /**
   * Two identical careers must produce identical doorways.
   *
   * Weaker than it looks unless the days are actually run: the read is pure,
   * so what this really guards is that nothing it calls has become impure.
   */
  it('is the same on the same seed', () => {
    const run = () => {
      const state = game(31);
      for (let d = 0; d < 90; d++) advanceDay(state);
      return approaches(state).map((a) => `${a.npcId}:${a.urgency}:${a.text}`);
    };
    expect(run()).toEqual(run());
  });

  it('survives a save that predates it', () => {
    const state = game(9);
    delete (state as { promises?: unknown }).promises;
    expect(() => approaches(state)).not.toThrow();
  });

  /**
   * And a crew written before anybody had a `fearBase`.
   *
   * The fear branch asks how far a man has moved off his own nerve, and an old
   * save does not record what that was. Falling back to his *current* fear
   * would read as a rise of zero and silently delete the branch for every
   * pre-existing crew — so it falls back to the middle of the roll, which is
   * the same guess `npc.ts` makes for the settle drift.
   */
  it('still opens the door for a crew that has no record of its own nerve', () => {
    const state = game(13);
    calm(state);
    const npc = someone(state);
    delete (npc as { fearBase?: number }).fearBase;
    npc.stats.fear = 95;
    remember(npc, state.day, 'took_a_charge');
    expect(approaches(state)).toHaveLength(1);
  });
});

/**
 * And it is not wallpaper, which is the one property the file is tuned against.
 *
 * `config/approaches.ts` states it at the top — *most people, most weeks, are
 * not at your door* — and it was not holding. Measured across twelve careers,
 * the doorway was lit on **71% of days** with the list pinned at its cap of
 * three, and 6,331 of 6,353 approaches were one sentence.
 *
 * The cause was the fear branch reading an absolute bar. Crew fear is a
 * one-way ratchet — seventeen places add to it against a 1.5-a-week settle —
 * so a career that sends anybody out reaches a median crew fear of 94 by day
 * 300 while one that never works stays at 48. `fear >= 65` was a bar on having
 * played the game, and the doorway was measuring the calendar.
 *
 * **What is guarded here is the discrimination rather than a threshold.** The
 * old gate produced 71% for a boss who grinds his crew and 76% for one who
 * barely works them — the signal did not depend on anything the player did,
 * which is the whole of what was wrong with it. It now does:
 *
 *     promotes, works them every third day     0%
 *     promotes, grinds them daily              9%
 *     never promotes, works them every third  40%
 *     never promotes, grinds them daily       53%
 *
 * The mechanism is not authored and is the better for it: a boss who moves
 * people up sends better crews, better crews come home, and men who come home
 * do not turn up frightened. A boss who never advances anybody should have a
 * queue at his door.
 *
 * These run the days rather than setting stats, because that is the only way
 * to catch it: every stat-level test in this file passed throughout the
 * failure, and would again.
 */
describe('the doorway is not always full', () => {
  /**
   * A career, played two ways.
   *
   * `runDaysSolvent`'s default answer is `answerFirst`, which takes the first
   * open choice — on a crew memo that is the generous one. Both bosses below
   * are therefore generous in the memo queue, and the only thing separating
   * them is whether they promote and how hard they work people. That is
   * deliberate: it keeps the comparison to one lever rather than three.
   */
  function career(seed: number, everyDays: number, promotes: boolean): number {
    const state = newGame({ name: 'Fill', difficulty: 'normal', seed });
    let lit = 0;
    let days = 0;
    runDaysSolvent(state, 220, {
      floor: 250_000,
      onDay: (s, d) => {
        days++;
        if (approaches(s).length) lit++;
        if (d % everyDays === 0 && !isLayingLow(s)) {
          const free = crewList(s).filter((n) => n.status === 'active');
          const def = availableOperations(s)
            .filter((o) => o.crewRequired > 0 && o.crewRequired <= free.length)
            .sort((a, b) => b.crewRequired - a.crewRequired)[0];
          const where = operableTerritories(s)[0];
          if (def && where) {
            launchOperation(
              s,
              def.id,
              free.slice(0, def.crewRequired).map((n) => n.id),
              where.territory.id,
            );
          }
        }
        for (const id of Object.keys(s.recruits)) {
          if (canRecruit(s, id).ok) {
            recruit(s, id);
            break;
          }
        }
        if (promotes) {
          for (const npc of crewList(s)) {
            if (canPromote(s, npc).ok) {
              promote(s, npc.id);
              break;
            }
          }
        }
      },
    });
    return Math.round((lit / Math.max(1, days)) * 100);
  }

  const share = (everyDays: number, promotes: boolean) =>
    median([1, 2, 3, 4, 5, 6].map((seed) => career(seed, everyDays, promotes)));

  /**
   * The boss the property is written about. Measured at 9%; the bar is set
   * well above that and well under the 71% the broken gate produced, so this
   * is a guard rather than a pin — red if the doorway becomes permanent again,
   * quiet through ordinary tuning.
   */
  it('leaves most days quiet for a boss who looks after his people', () => {
    const pct = share(1, true);
    expect(
      pct,
      `somebody is at the door on ${pct}% of days of a career where people get ` +
        `moved up; it was 71% when the fear branch read an absolute bar, and this ` +
        `file is tuned on the opposite property`,
    ).toBeLessThan(30);
  });

  /**
   * And the signal depends on the player, which the old one did not.
   *
   * This is the test that would have caught the fault. The broken gate gave
   * 71% and 76% for these two bosses — indistinguishable, and both wallpaper.
   */
  it('is louder for a boss who never advances anybody', () => {
    const kind = share(1, true);
    const hard = share(1, false);
    expect(
      hard - kind,
      `a boss who promotes sees the door at ${kind}% and one who never does at ` +
        `${hard}% — the doorway has stopped depending on how the player plays`,
    ).toBeGreaterThan(15);
  });

  /**
   * And it has not been shut off altogether.
   *
   * The failure mode of this repair is the mirror of the fault: a gate tight
   * enough that nobody ever comes deletes the feature rather than fixing it.
   */
  it('still opens for somebody', () => {
    expect(share(1, false)).toBeGreaterThan(0);
  });
});
