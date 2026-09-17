/**
 * The room taking it off you.
 *
 * The point of this route is that it is the only way out of the chair a young,
 * careful boss can reach — conviction needs a case, assassination needs a war
 * you are losing, and the aging clock needs twenty-five years. So the tests
 * that matter are about reachability and about warning: it has to be able to
 * happen to somebody who has done nothing else wrong, and it must never happen
 * to a player who was not told first.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { canRecruit, recruit, recruitCost, canPromote, promote } from '../crew';
import { totalFunds, weeklyWageBill } from '../economy';
import {
  availableOperations,
  launchOperation,
  operationCost,
  successBreakdown,
} from '../operations';
import { operableTerritories } from '../territory';
import { availableCrew, crewList } from '../npc';
import { eligibleHeirs, nameHeir, tickDeposition, wouldTakeIt } from '../succession';
import { DEPOSITION } from '../../config/succession';
import { ROLE_ORDER } from '../../config/economy';
import type { GameState, Npc } from '../types';

function game(seed = 3): GameState {
  return newGame({ name: 'Chair', difficulty: 'normal', seed });
}

/**
 * A room full of people who have had enough, one of whom wants the chair.
 *
 * Throws rather than returning early if the world does not cooperate. A setup
 * helper that quietly produces four men when it was asked for six is how a test
 * ends up asserting nothing at all.
 */
function unhappyRoom(state: GameState, size = 5): Npc[] {
  const seed = crewList(state)[0];
  if (!seed) throw new Error('a career starts with somebody; this one did not');

  const men: Npc[] = [];
  for (let i = 0; i < size; i++) {
    const npc: Npc = {
      ...seed,
      id: `man_${i}`,
      name: `Man ${i}`,
      role: 'capo',
      status: 'active',
      stats: {
        ...seed.stats,
        respectForBoss: 20,
        grievance: 70,
        ambition: 40,
        leadership: 70,
        skill: 70,
        courage: 70,
      },
      daysInCrew: 900,
      opsCompleted: 40,
      notes: [],
      memories: [],
      ties: [],
    };
    state.npcs[npc.id] = npc;
    men.push(npc);
  }
  // One of them wants it.
  men[0].stats.ambition = 90;

  if (ROLE_ORDER.indexOf('capo') < 0) throw new Error('role table changed');
  return men;
}

/** Runs weeks of the deposition question without running the rest of the game. */
function weeks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.day += 7;
    tickDeposition(state, new Rng(state.rng));
    if (state.gameOver) return;
  }
}

describe('a boss the room has stopped wanting', () => {
  it('has somebody who would take it', () => {
    const state = game();
    unhappyRoom(state);
    expect(wouldTakeIt(state)?.id).toBe('man_0');
  });

  it('has somebody when only one man is angry, and he is the one', () => {
    /*
       `DEPOSITION.backersNeeded` dropped from 2 to 1 — see config/succession.ts
       for the measurement. `eligibleHeirs` sits at a median of 1 person in
       ordinary play, so "2 disaffected men" required a second senior man to
       exist at all, which most careers never have. One man who clears every
       bar on his own — wants it, has stopped respecting the boss, is carrying
       a real grievance, and the room would actually accept him — is now enough.
       This is the other side of that: it is still not "nobody at all", so
       `disaffected` still has to find somebody, not just the ambitious one
       before the other four bars are even checked.
    */
    const state = game();
    const men = unhappyRoom(state);
    for (const m of men) {
      m.stats.respectForBoss = 80;
      m.stats.grievance = 5;
    }
    expect(wouldTakeIt(state), 'nobody in the room is disaffected at all').toBeNull();
  });

  it('warns before it can happen, without naming him', () => {
    const state = game();
    unhappyRoom(state);
    state.day = 7;

    weeks(state, DEPOSITION.rumourAfterWeeks + 2);

    const warning = state.log.find((l) => l.text.includes('meeting you were not at'));
    expect(warning, 'a coup nobody saw coming is a coin flip with extra steps').toBeTruthy();
    expect(warning!.text).not.toContain('Man 0');
    expect(state.gameOver).toBeNull();
  });

  it('never happens to a player who was not told first', () => {
    /*
       The invariant, rather than a check on the length of the fuse.

       The first version of this test asserted only that nothing happened in the
       first two weeks — which stayed green when the warning gate was deleted
       outright, because the fuse is short and the roll is unlikely. What has to
       be true is a relation between two days, over worlds where the thing
       actually happened, so the test has nothing to be right about by accident.
    */
    let checked = 0;
    for (let seed = 40; seed < 60; seed++) {
      const state = game(seed);
      unhappyRoom(state);
      state.day = 7;
      weeks(state, 250);
      if (state.succession.generation === 1) continue;

      const took = state.succession.line[state.succession.line.length - 1].toDay;
      const warned = state.log.find((l) => l.text.includes('meeting you were not at'));
      expect(warned, 'it happened with no warning at all').toBeTruthy();
      expect(warned!.day, 'the warning arrived with the coup').toBeLessThan(took);
      checked++;
    }
    expect(checked, 'no world got as far as a deposition, so nothing was checked')
      .toBeGreaterThan(10);
  });

  it('eventually happens, and the man who wanted it is the one who has it', () => {
    const state = game();
    unhappyRoom(state);
    state.day = 7;
    const wanted = wouldTakeIt(state)!;

    // Long enough that a 3.5% weekly roll is close to certain, and not so long
    // that this is testing patience rather than the mechanism.
    weeks(state, 250);

    expect(state.succession.generation).toBeGreaterThan(1);
    expect(state.player.name).toBe(wanted.name);
  });

  it('forgets about it the moment the room settles', () => {
    const state = game();
    const men = unhappyRoom(state);
    state.day = 7;
    weeks(state, DEPOSITION.rumourAfterWeeks + 1);
    expect(state.flags['unrest_since']).toBeGreaterThan(0);

    // Whatever it was, it was dealt with.
    for (const m of men) {
      m.stats.grievance = 0;
      m.stats.respectForBoss = 90;
    }
    weeks(state, 1);
    expect(state.flags['unrest_since']).toBe(0);
  });
});

describe('naming an heir', () => {
  it('makes waiting the only thing between him and the chair', () => {
    /*
       The other half of a decision that used to cost only social capital. You
       have told a man he gets it eventually; the config doubles his weekly
       chance of deciding that eventually is now. Asserted through the config
       rather than by running two thousand worlds to see a 3.5% against a 7%.
    */
    const state = game();
    unhappyRoom(state);
    const mover = wouldTakeIt(state)!;
    expect(nameHeir(state, mover.id).ok).toBe(true);
    expect(DEPOSITION.namedHeirMultiplier).toBeGreaterThan(1);
  });
});

describe('an ordinary career', () => {
  it('is not deposed for no reason', () => {
    /*
       The guard against the obvious way to get this wrong. Everything above
       constructs a room that has given up on the player; this checks that a
       normal one does not quietly do the same thing on its own.
    */
    const state = game(9);
    for (let d = 0; d < 400; d++) {
      state.org.cash = Math.max(state.org.cash, 200_000);
      advanceDay(state);
      if (state.gameOver) break;
    }
    // ...and it has to have been a career, or this asserts that nothing
    // happens in a game that ended on day four.
    expect(state.day, 'the world stopped before the question was ever asked').toBeGreaterThan(300);
    expect(state.succession.generation).toBe(1);
  });
});

// ---------------------------------------------------- reachable, not built ---

/**
 * A career that plays itself into a deposition, rather than one built for it.
 *
 * Every test above hand-sets stats directly, which proves the *mechanism*
 * works and proves nothing about whether ordinary play can ever reach it. It
 * could not: measured across 40 seeded 300-day careers (confirmed at 15 seeds
 * x 1460 days) with this exact bot and the scorecard probe's own passive one,
 * `DEPOSITION.backersNeeded: 2` never held true once — `eligibleHeirs` sits at
 * a median of 1 person, so "2 disaffected men" needed a second senior man to
 * exist at all, which most careers never have. See config/succession.ts.
 *
 * A bot that recruits, works the best-EV job every day, promotes when it can,
 * and names an heir — nothing here breaks a promise, demotes anybody, or
 * withholds pay; it is not trying to cause this.
 */
function playOrdinaryCareer(seed: number, days: number): GameState {
  const s = newGame({ name: 'Diag', difficulty: 'normal', mode: 'career', seed });
  const rng = new Rng(s.rng);

  for (let d = 0; d < days; d++) {
    // Recruit and work the best-EV job first, promote and name an heir
    // second, events and the day itself last — order matters for a seeded
    // rng stream, and this is the exact sequence the measurement was taken
    // with.
    if (totalFunds(s) > weeklyWageBill(s) * 4 + recruitCost(s)) {
      for (const id of Object.keys(s.recruits)) {
        if (canRecruit(s, id).ok) {
          recruit(s, id);
          break;
        }
      }
    }
    const where = operableTerritories(s)[0]?.territory.id ?? null;
    if (where) {
      const avail = availableOperations(s).filter(
        (o) => availableCrew(s).length >= o.crewRequired,
      );
      const ev = (o: (typeof avail)[number]) => {
        const crew = availableCrew(s).slice(0, o.crewRequired);
        const mid = (o.payout[0] + o.payout[1]) / 2;
        return mid * successBreakdown(s, o, crew, where).total - operationCost(s, o);
      };
      const best = [...avail].sort((a, b) => ev(b) - ev(a))[0];
      if (best && availableCrew(s).length >= best.crewRequired) {
        const crew = availableCrew(s).slice(0, best.crewRequired);
        launchOperation(s, best.id, crew.map((n) => n.id), where);
      }
    }

    for (const npc of crewList(s)) {
      if (canPromote(s, npc).ok) {
        promote(s, npc.id);
        break;
      }
    }
    if (!s.succession.heirId) {
      const heir = eligibleHeirs(s)[0];
      if (heir) nameHeir(s, heir.id);
    }

    let guard = 0;
    while (s.pendingEvents.length > 0 && guard++ < 20) {
      const event = s.pendingEvents[0];
      const choice = event.choices.find((c) => !c.disabledReason) ?? event.choices[0];
      resolveEvent(s, rng, event.id, choice.id);
    }
    advanceDay(s);
    if (s.gameOver) break;
  }
  return s;
}

describe('deposition, played into rather than built', () => {
  /*
     Watched to fail: with `DEPOSITION.backersNeeded` reverted to its old value
     of 2, this exact seed runs the full 1460 days and `generation` stays 1 —
     confirmed by hand while developing this test, per this project's own
     "write the failing test first, then put the fault back" rule. Restoring
     `backersNeeded: 1` is what makes it pass; nothing else about the seed or
     the bot changes.

     Reseeded from 4000 to 4011 for Milestone 2's cold-reception change
     (`goHome` halving what a visit clears at `neglect >= 75`, `sim/personal.ts`):
     that is an intentional change to the neglect trajectory, and this bot
     attends every family-dilemma memo it meets, so the exact day neglect
     crosses each `GEN_WHEN.neglect` gate elsewhere in the generated table
     shifted — which shifts how many rng calls those `applies()` checks
     consume, which reshuffles the causal stream for the rest of the run.
     Seed 4000 happened to land on "nobody deposed" on the other side of that
     reshuffle; it was never the substance of the test, which is that ordinary
     play can reach a deposition at all. A scan of 100 seeds after the change
     found roughly 30 that still do (4011, 4013, 4016, 4023, ... all generation
     2, all "nobody was killed and nobody was arrested"), so reachability
     itself did not regress — re-confirmed the same way the original seed was:
     reverting `backersNeeded` to 2 and watching this fail before restoring it.

     Reseeded again from 4011 to 4022 for Milestone 3's `gen_panic_episode`
     (`sim/eventgen.ts`, `config/eventgen.ts`): a new generated shape that can
     become eligible on some days is exactly the same class of change —
     `tickEvents`'s daily scan now calls one more `applies()` on every day of
     a 1460-day run, and on the days this bot's stress has actually crossed
     `STRESS.panicThreshold` and the memo is answered, `resolveGenerated`
     consumes rng calls the old stream never did, reshuffling everything
     downstream. A scan of seeds 4011-4110 after the change found 18 that
     still reach generation > 1 (4022, 4031, 4033, 4042, 4043, 4045, 4046,
     4053, 4056, 4061, ...), so reachability again did not regress. Seed 4022
     confirmed to produce the same "nobody was killed and nobody was
     arrested" fate, and the guard re-confirmed the same way both times
     before it: reverting `backersNeeded` to 2 and watching this fail before
     restoring it.

     Reseeded a third time from 4022 to 4025 for lengthening
     `gen_family_dilemma`/`gen_panic_episode`'s cooldowns (32/35 -> 38/45,
     `config/eventgen.ts`) to relieve the two shapes crowding a third
     generated shape ("an order is a decision rather than a payout") out of
     the shared daily slot — `npm run probe` found. Same mechanism again:
     fewer eligible days for these two shapes changes how many `applies()`
     calls the daily scan makes on which days, reshuffling the stream. A scan
     of seeds 4011-4110 after the cooldown change found 22 that still reach
     generation > 1 (4025, 4033, ...), so reachability held a third time.
     Seed 4025 confirmed to produce the same "nobody was killed and nobody
     was arrested" fate, and the guard re-confirmed the same way all three
     times before it: reverting `backersNeeded` to 2 and watching this fail
     before restoring it.

     Briefly reseeded a fourth time, 4025 to 4011, while a further
     weight-and-cooldown retune (2/38-45 -> 1/50-60) was tried against the
     same orders-bar failure. That retune was measured to trade one failure
     for two new ones elsewhere in `ladder.probe.test.ts` and was abandoned
     — see `gen_family_dilemma`'s own comment in `config/eventgen.ts` for
     the full account. Reverted to 4025 along with the config, since 4025 is
     what this exact 38/45 setting was confirmed against the third time.

     Reseeded a fifth time, 4025 to 4046, for moving `tickEvents`'s generated
     half onto `generatedStream(state)` — its own `(seed, day)`-derived
     stream, never touching `state.rng.calls` (`sim/events.ts`, mirroring
     `offerStream` in `sim/orders.ts`). This is the fix for the whole class of
     reshuffle the last four reseeds of this test were absorbing one at a
     time: every prior entry above changed how many causal-rng calls the
     daily generated-event scan made, which reshuffled the stream for every
     day after. After this fix the generated half consumes none of
     `state.rng`'s calls at all, so this is meant to be the last reseed this
     test needs for that reason. Seed 4025 itself landed on "nobody deposed"
     on the far side of this particular reshuffle. A scan of seeds 4025-4125
     after the fix found 20 that still reach generation > 1 (4046, 4048,
     4051, 4057, 4061, ...), so reachability did not regress. Seed 4046
     confirmed to produce the same "nobody was killed and nobody was
     arrested" fate, and the guard re-confirmed the same way as every prior
     reseed: reverting `backersNeeded` to 2 and watching this fail before
     restoring it.

     Reseeded a sixth time, 4046 to 4062, for Milestone 5. Two separate
     changes landed together and each reshuffled this seed on its own:

     (1) The Civic Insulation multiplier itself
     (`config/civic.ts`'s `PublicStandingTier.caseGrowthMultiplier`, applied
     in `investigation.ts`'s `tickInvestigations`) is not a causal-rng-call-
     count change like every prior reseed above — it is a genuine mechanical
     change to how fast federal cases grow, which changes *when* (or
     whether) a case reaches indictment or trial on a given seed, which
     changes how many rng calls `advanceStage`/`resolveTrial` draw and on
     which day, reshuffling the stream downstream the way a real balance
     change is expected to. A scan of seeds 4046-4146 with only this change
     in place found seed 4048 still reachable.

     (2) `gen_social_gathering`'s own eligibility gate — added afterward so
     the shape does not fire against a brand-new career with no public
     footprint at all (`eventgen.test.ts`'s "none of them fires against an
     empty world") — is exactly the class of change this test's own history
     already names three times over: a shape's `applies()` becoming
     eligible or not on a given day changes which shape wins that day's
     `generatedStream` pick, and a *different* generated memo firing (or not
     firing) that day changes what its `resolveGenerated` branch does on the
     real causal `rng`, reshuffling everything after. Seed 4048 (this test's
     own value from change (1) above) landed on "nobody deposed" once this
     second change was also in place.

     A scan of seeds 4046-4246 with both changes in place found 42 that
     still reach generation > 1 (4062, 4073, 4077, 4079, 4083, 4089, 4097,
     4101, ...), so reachability did not regress either time. Seed 4062
     confirmed to produce the same "nobody was killed and nobody was
     arrested" fate, and the guard re-confirmed the same way as every prior
     reseed: reverting `backersNeeded` to 2 (generation stayed at 1) and
     restoring it to 1.

     Reseeded a seventh time, 4062 to 4064, for Milestone 6. The confidant
     layer reshuffles this seed the same way Milestone 5's item (1) did, and
     for the same reason rather than the `applies()`-call-count reason of the
     four before it: the wiretap term in `tickInvestigations` is a real
     mechanical change to how fast a federal case grows once discretion
     falls, so a case reaches indictment or trial on a different day, drawing
     `advanceStage`/`resolveTrial`'s own rolls on a different day. The new
     `gen_affair_fallout` shape adds to it from the other side — its answers
     move cash, neglect and stress in a career the bot plays forward on those
     numbers.

     A scan of seeds 4062-4262 with the milestone in place found 4064, 4073,
     4074, 4083, 4100, 4104, 4106 and 4111 all still reaching generation > 1
     with the same quiet fate, so reachability did not regress. Seed 4064
     confirmed, and the guard re-confirmed the same way as every prior
     reseed: reverting `backersNeeded` to 2 (generation stayed at 1) and
     restoring it to 1.
  */
  it('fires from an ordinary career under the current gate', () => {
    const state = playOrdinaryCareer(4064, 1460);
    expect(
      state.succession.generation,
      'nobody was deposed — this is the reachability the config change exists to fix',
    ).toBeGreaterThan(1);
    const line = state.succession.line[state.succession.line.length - 1];
    expect(line.fate).toContain('Nobody was killed and nobody was arrested');
  });
});
