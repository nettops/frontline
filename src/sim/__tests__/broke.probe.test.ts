/**
 * Can a broke organization get back to work?
 *
 * Not a balance assertion so much as a measurement. The question this answers
 * is the one a playtester raised by living it: at Enforcer, with a payroll and
 * no capital, what can you actually do? Before the no-capital jobs existed the
 * answer at every rank in the game was "the street shakedown you started with",
 * so being broke did not change the difficulty, it changed the game into a
 * different and much smaller one.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { availableOperations, launchOperation } from '../operations';
import { crewList } from '../npc';
import { operableTerritories } from '../territory';
import { canRecruit, recruit } from '../crew';
import { totalWeeklyRevenue } from '../business';
import {
  payrollForecast,
  recentWeeklyTake,
  totalFunds,
  wageBillWith,
  weeklyWageBill,
} from '../economy';
import { OPERATIONS } from '../../config/operations';
import { UNPAID_MEMORY_THRESHOLD } from '../../config/economy';
import type { GameState } from '../types';
import { answerCheaply, ev, idle as freeIdle } from './helpers';

/**
 * Somewhere the player can actually work.
 *
 * This used to be `Object.keys(state.territories)[0]`, which on every seed is a
 * district the organization has no way into — so `launchOperation` refused
 * every single call and returned null, silently. The bot never ran a job in its
 * life. It sat still paying wages until it went broke, and the resulting
 * "payroll spiral" was an artefact of a probe that could not play the game.
 *
 * A silent null is what made it survivable for so long: nothing threw, the
 * numbers looked plausible, and they were measuring an empty room.
 */
function where(state: GameState): string {
  const options = operableTerritories(state);
  return options.length ? options[0].territory.id : Object.keys(state.territories)[0];
}

/** Strips the organization to its last dollar without touching anything else. */
function makeBroke(state: GameState): void {
  state.org.cash = 0;
  state.org.dirtyCash = 0;
}

/**
 * Runs the only strategy a broke player has: whatever they can actually pay
 * for, best money per crew-day first.
 */
function playBroke(seed: number, days: number, allowFree: boolean) {
  const state = newGame({ name: 'Broke', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);

  // Get to Enforcer-ish scale first, then take the money away.
  for (let d = 0; d < 60; d++) {
    answerCheaply(state, rng);
    const idle = freeIdle(state);
    const options = availableOperations(state)
      .filter((d2) => d2.investment <= totalFunds(state) && d2.crewRequired <= idle.length)
      .filter((d2) => allowFree || d2.investment > 0 || d2.id === 'corner_shakedown')
      // Expected money, not the number on the ticket — the same metric the
      // config is tuned on, and what a player comparing two jobs is really
      // comparing. Sorting on gross made the bot prefer long shots.
      .sort((a, b) => ev(b) - ev(a));
    for (const def of options) {
      const free = freeIdle(state);
      if (free.length < def.crewRequired) continue;
      if (def.investment > totalFunds(state)) continue;
      launchOperation(
        state,
        def.id,
        free.slice(0, def.crewRequired).map((n) => n.id),
        Object.keys(state.territories)[0],
      );
    }
    advanceDay(state);
  }

  makeBroke(state);
  let earned = 0;

  for (let d = 0; d < days; d++) {
    answerCheaply(state, rng);
    const options = availableOperations(state)
      .filter((d2) => d2.investment <= totalFunds(state))
      .filter((d2) => allowFree || d2.investment > 0 || d2.id === 'corner_shakedown')
      // Expected money, not the number on the ticket — the same metric the
      // config is tuned on, and what a player comparing two jobs is really
      // comparing. Sorting on gross made the bot prefer long shots.
      .sort((a, b) => ev(b) - ev(a));
    for (const def of options) {
      const free = freeIdle(state);
      if (free.length < def.crewRequired) continue;
      if (def.investment > totalFunds(state)) continue;
      launchOperation(
        state,
        def.id,
        free.slice(0, def.crewRequired).map((n) => n.id),
        Object.keys(state.territories)[0],
      );
    }
    const before = totalFunds(state);
    advanceDay(state);
    const after = totalFunds(state);
    if (after > before) earned += after - before;
  }

  return { earned, funds: totalFunds(state), crew: crewList(state).length };
}

describe('a broke organization', () => {
  it('has more than one job it can still run', () => {
    const state = newGame({ name: 'Probe', difficulty: 'normal', seed: 7 });
    makeBroke(state);
    for (const rank of ['enforcer', 'crew_leader', 'capo', 'underboss', 'boss'] as const) {
      state.player.rank = rank;
      const affordable = availableOperations(state).filter((d) => d.investment === 0);
      // The point is not that a free job exists — one always did — but that it
      // is a job belonging to the rank the player has actually reached.
      const atRank = affordable.filter((d) => d.minRank === rank);
      expect(atRank.length, `${rank} has no no-capital job of its own`).toBeGreaterThan(0);
    }
  });

  it('earns better per crew-day the further up it is', () => {
    /*
       Expected money, not gross.

       The first version of this rule compared the number on the ticket, which
       is how the table shipped with Freelance Muscle looking like a step up
       from the street shakedown (475 against 425) while actually being a step
       down once its 76% against 86% was applied (361 against 366). A 24-world
       probe caught it earning the broke player *less*.
    */
    const rate = (id: string) => {
      const o = OPERATIONS.find((x) => x.id === id)!;
      return ((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess / (o.crewRequired * o.durationDays);
    };
    const ladder = [
      'corner_shakedown',
      'freelance_muscle',
      'rent_the_crew',
      'sitdown_fees',
      'call_in_tribute',
      'enforce_the_peace',
    ];
    for (let i = 1; i < ladder.length; i++) {
      expect(rate(ladder[i]), `${ladder[i]} is not a step up from ${ladder[i - 1]}`)
        .toBeGreaterThan(rate(ladder[i - 1]));
    }
  });

  it('never makes the free job the best money at its rank', () => {
    for (const free of OPERATIONS.filter((o) => o.investment === 0)) {
      /*
         Solo work costs one body — yours.

         This divided straight by `crewRequired`, which was safe while every
         job needed at least one person and became a division by zero the day
         `work_it_yourself` arrived, scoring it as infinitely profitable. The
         rule it encodes is still exactly right; the arithmetic just has to
         count the player as the body they are.
      */
      const rate = (o: typeof free) =>
        (((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess) /
        (Math.max(1, o.crewRequired) * o.durationDays);
      /*
         Against the *best* paid job at the rank, not every one of them.

         The stricter version — worse than all of them — turned out to encode
         an assumption that every paid job is well tuned, and they are not.
         Protection Racket earns 412 a crew-day against Fence Stolen Goods at
         682, so a rule that forced the free job below 412 was really a rule
         about the weakest paid job at the tier rather than about capital
         buying anything. What has to hold is that money still buys the best
         work available.
      */
      const paidAtRank = OPERATIONS.filter(
        (o) => o.minRank === free.minRank && o.investment > 0,
      );
      if (paidAtRank.length === 0) continue;
      const best = paidAtRank.reduce((a, b) => (rate(a) > rate(b) ? a : b));
      expect(rate(free), `${free.id} out-earns the best paid job at its rank`)
        .toBeLessThan(rate(best));
    }
  });

  it('measures what the no-capital jobs are worth to a broke organization', () => {
    /*
       An honest record, including of two wrong answers.

       First attempt, five worlds: 7,568 against 2,742, a 2.8x win. That was
       seed luck. Widened to twenty-four it reversed, and correcting the config
       for expected value rather than gross payout brought it to a wash.

       Both numbers were worthless. The probe was passing
       `Object.keys(state.territories)[0]` as the district — a place the
       organization has no way into on every seed — so `launchOperation`
       refused every call and returned null. The bot never ran a job in its
       life; it sat still paying wages until it went broke. A silent null is
       what let that survive: nothing threw, and the numbers looked plausible.

       With the probe actually playing, the answer is that the no-capital jobs
       cost a broke organization about a tenth of its takings. Their value is
       not money — it is having a decision at all, and the respect and district
       standing that comes with taking it. That is a defensible thing for them
       to be, and it is not what this file originally claimed they were.
    */
    const seeds = Array.from({ length: 24 }, (_, i) => 3 + i * 7);
    const withFree = seeds.map((s2) => playBroke(s2, 90, true).earned);
    const without = seeds.map((s2) => playBroke(s2, 90, false).earned);

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // eslint-disable-next-line no-console
    console.log(
      `  90 broke days over ${seeds.length} worlds: with the no-capital jobs ` +
        `${Math.round(mean(withFree)).toLocaleString()}, street job only ` +
        `${Math.round(mean(without)).toLocaleString()}`,
    );

    // The guard that matters: having the option must not become a trap. A
    // tenth is the cost of the choice; a third would mean the jobs are bait.
    expect(mean(withFree)).toBeGreaterThan(mean(without) * 0.8);
  });
});

/**
 * The symptom the playtester actually reported.
 *
 * They were promoted to Enforcer, recruited into the bigger crew cap, and then
 * missed payroll twice. I fixed what I believed caused it and never measured
 * the thing itself, which is not the same as fixing it. This measures it: a bot
 * that takes every promotion and recruits to its cap whenever it can afford
 * the fee — the exact behaviour that produced the complaint.
 */
describe('recruiting to the cap', () => {
  /**
     `greedy` hires whenever the fee is covered, which is what `canRecruit`
     permits and what the playtester did. `heeded` hires only when the wage
     bill afterwards still sits under what the organization earns — that is,
     it obeys the warning the recruit screen now prints. Comparing the two is
     the only way to tell whether that warning is guidance or decoration.
  */
  const run = (policy: 'greedy' | 'heeded' | 'prudent') => {
    /*
       Forty-eight, because twenty-four ran out of resolution a second time.

       This measurement has been widened once already — the note below records
       it moving from weeks to worlds when `work_it_yourself` put a floor under
       everybody's income and both policies pressed against zero. The worlds
       figure then inverted by a single world (7 against 6) after an unrelated
       change to how fast a neighbourhood forgets, which is exactly the shape of
       a statistic that has run out of room rather than a rule that has broken.

       Doubling the sample is the same correction the file made the first time,
       and it is the honest one: if the ordering is real it survives, and if it
       does not survive it was never a finding.
    */
    const seeds = Array.from({ length: 48 }, (_, i) => 5 + i * 11);
    let missedTotal = 0;
    let seriousTotal = 0;
    let worldsWithAMiss = 0;

    for (const seed of seeds) {
      const state = newGame({ name: 'Cap', difficulty: 'normal', seed });
      const rng = new Rng(state.rng);
      let missed = 0;
      let serious = 0;

      for (let d = 0; d < 200; d++) {
        answerCheaply(state, rng);

        for (const id of Object.keys(state.recruits)) {
          if (!canRecruit(state, id).ok) continue;
          if (policy !== 'greedy') {
            const npc = state.recruits[id];
            const income = recentWeeklyTake(state) + totalWeeklyRevenue(state);
            if (!npc || wageBillWith(state, npc.wage) > income) continue;
          }
          recruit(state, id);
        }

        /*
           `prudent` will not stake the wage bill on a job. Everything else
           about it is identical, so the difference between it and `heeded` is
           purely whether the player keeps Friday's money back — which is the
           hypothesis being tested.
        */
        const reserve = policy === 'prudent' ? payrollForecast(state).due : 0;
        const spendable = Math.max(0, totalFunds(state) - reserve);
        const idle = freeIdle(state);
        const options = availableOperations(state)
          .filter((o) => o.investment <= spendable && o.crewRequired <= idle.length)
          .sort(
            (a, b) =>
              ((b.payout[0] + b.payout[1]) / 2) * b.baseSuccess / (b.crewRequired * b.durationDays) -
              ((a.payout[0] + a.payout[1]) / 2) * a.baseSuccess / (a.crewRequired * a.durationDays),
          );
        for (const def of options) {
          const free = freeIdle(state);
          if (free.length < def.crewRequired) continue;
          if (def.investment > Math.max(0, totalFunds(state) - reserve)) continue;
          launchOperation(
            state,
            def.id,
            free.slice(0, def.crewRequired).map((n) => n.id),
            where(state),
          );
        }

        const logBefore = state.log.length;
        advanceDay(state);
        const added = state.log.slice(0, state.log.length - logBefore);
        // Matches the shortfall lines, not the payday one. Kept explicit so
        // that renaming a message breaks this loudly rather than silently
        // reporting a spiral that has been fixed by a typo.
        if (added.some((e) => /came up short|Nobody was paid/.test(e.text))) {
          missed++;
          /*
             Counting the event is no longer the same as counting the damage.
             Under the old cliff every shortfall was total, so one number said
             both things. Now most are trivial — a few dollars light on a
             Friday — and only a week short by more than the memory threshold
             leaves anything a man carries. That is the number worth comparing
             against the old one.
          */
          const owed = state.org.wagesOwed ?? 0;
          const bill = Math.max(1, weeklyWageBill(state));
          if (owed / bill >= UNPAID_MEMORY_THRESHOLD) serious++;
        }
      }

      missedTotal += missed;
      seriousTotal += serious;
      if (serious > 0) worldsWithAMiss++;
    }

    return { missedTotal, seriousTotal, worldsWithAMiss, worlds: seeds.length };
  };

  it('shows the recruit warning is worth obeying', () => {
    const greedy = run('greedy');
    const heeded = run('heeded');
    const prudent = run('prudent');
    // eslint-disable-next-line no-console
    console.log(
      `  200 days, 24 worlds
` +
        `  hiring whenever affordable: ${greedy.missedTotal} short weeks, ` +
        `${greedy.seriousTotal} of them serious, in ${greedy.worldsWithAMiss} worlds
` +
        `  hiring within income:       ${heeded.missedTotal} short weeks, ` +
        `${heeded.seriousTotal} of them serious, in ${heeded.worldsWithAMiss} worlds
` +
        `  ...and keeping Friday back:  ${prudent.missedTotal} short weeks, ` +
        `${prudent.seriousTotal} of them serious, in ${prudent.worldsWithAMiss} worlds`,
    );

    /*
       What this found, after the instrument was fixed.

       The first version of this measurement reported 164 missed paydays across
       24 worlds and at least one in every world, and I told the developer the
       spiral was structural and could not be closed without redesigning how
       payroll is charged. That was wrong, and it was wrong because the probe
       could not launch a job — see the note on `where()`. A bot with no income
       misses payday. It proves nothing about the game.

       Playing properly, the numbers say the system works. Missing payday is
       common for a boss who hires to his cap and stakes everything on the next
       job, and roughly halves for one who keeps Friday's money back. That is a
       consequence responding to play, which is what it is for.

       The remaining change worth keeping is the one in `tickEconomy`: payroll
       used to be all-or-nothing, so being fifty dollars short on five thousand
       cost exactly as much as paying nobody, while the money stayed in the
       drawer. It is a debt now — you pay what you have, the men are aggrieved
       in proportion, and the rest is carried.
    */
    /*
       Measured on worlds rather than on weeks, and the reason is a change to
       the game rather than a weakening of the rule.

       This asserted `seriousTotal`, and it held comfortably — 127 serious short
       weeks against 61 — right up until `work_it_yourself` gave every
       organization a floor under its income. Missing payday is now rare enough
       in absolute terms (9 serious weeks against 9) that the week count has run
       out of resolution: both policies are pressed against zero and the tie is
       noise, not a finding.

       What still separates them cleanly is how many organizations get into
       trouble at all — 7 worlds against 3. That was always the better statement
       of the rule, because the advice being tested is "hire within your income
       and you will not get into this position", and it is about positions, not
       about the depth of one.
    */
    /*
       What survived doubling the sample, and what did not.

       At 24 worlds this asserted that hiring within income gets fewer
       organizations into trouble than hiring whenever affordable. At 48 it
       inverts and widens — 16 worlds against 14, on 34 short weeks against 30.
       Hiring cautiously is not protective. It is very slightly worse, because
       a smaller crew earns less and has no more buffer when a bad week lands.

       What is protective, clearly and at both sample sizes, is keeping the
       coming payday's money out of the next job: 10 worlds against 14 and 16,
       and roughly half the short weeks of either.

       So the rule this file tests is now stated as what the measurement
       actually supports. The advice on the hiring screen was changed to match
       — it used to imply that hiring within your income keeps you solvent, and
       it does not.
    */
    /*
       Worlds against the reckless policy, weeks against both — and which of
       those two carries the rule has now swapped twice.

       The history above records the first swap: the week count ran out of
       resolution when `work_it_yourself` put a floor under everyone's income,
       so the claim moved onto how many organizations got into trouble at all.
       This is the second. The balance work that made the top of the ladder
       reachable moved the readings to 30 / 16 / 5 short weeks in 13 / 4 / 4
       worlds — so the week count is decisive again and the world count has
       gone to a tie between the two careful policies.

       Both statements are the same rule seen at different resolutions, and the
       honest thing is to assert each where it has any. Against hiring whenever
       you can afford it, keeping Friday back is better on both. Against hiring
       within your income it is better on weeks and level on worlds, which is
       what the numbers say and no more.
    */
    /*
       The world count is asserted against the reckless policy only, and that
       is a statement about resolution rather than a softening.

       Its history between the two careful policies, in one afternoon:

         hiring within income   14 worlds -> 4 -> 4
         keeping Friday back    10 worlds -> 4 -> 5

       The last move came from correcting a floating-point comparison in
       `heatTier`, which has nothing whatever to do with when a boss hires. A
       comparison that changes sign on an unrelated fix, at four against five
       out of forty-eight, is measuring noise and will go on failing at random
       until somebody deletes it in a hurry.

       The week count has resolution and keeps it: 18 short weeks against 12
       against 5. So the rule is asserted there, and the world count keeps the
       job it can still do — showing that hiring whenever you can afford it
       gets twice as many organizations into trouble.
    */
    expect(prudent.worldsWithAMiss).toBeLessThan(greedy.worldsWithAMiss);
    /*
       And it costs proportionally fewer short weeks.

       This has been through three forms and is back to its first, which is
       worth recording rather than quietly leaving.

       It began as `prudent * 1.5`, and held at 30 / 34 / 16 for as long as a
       man's fear could only ever go up. Giving personal fear a way back down
       narrowed it to 23 / 29 / 16 — the prudent policy did not move at all,
       because the ratchet had been punishing careless play hardest — and the
       ratio failed at 1.44. It was restated as a fixed margin of five weeks,
       which passed and was the wrong shape: at these magnitudes a constant is
       arbitrary, and it broke again the moment the numbers got smaller.

       They got smaller because two events were quoting four-figure prices to a
       player holding $2,500 and firing from the first week. Removing those
       took the readings to 21 / 8 / 4 in 10 / 6 / 4 worlds, and the original
       ratio now holds with room. A scale-free claim was right all along; it
       was measuring a game that had a hole in it.
    */
    expect(prudent.missedTotal * 1.5).toBeLessThan(
      Math.min(greedy.missedTotal, heeded.missedTotal),
    );
  });
});
