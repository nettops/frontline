/**
 * What happens to a career that stumbles.
 *
 * A playtester spent a hundred and sixty days without ever leaving the bottom
 * of this game — never past Associate, never above six thousand dollars, never
 * able to afford the cheapest front at twelve. They put the moment their
 * decisions stopped changing at **day five**. The previous tester, who got
 * solvent, put it at day sixty to seventy and scored the same build a point
 * higher across the board.
 *
 * Every instrument in this suite has been measuring the second player. The
 * balance test holds a scripted line, the informant probe pins the treasury at
 * half a million, and the grokking probe holds the bot solvent *by design* so
 * that the thing under test is the only thing moving. All of that is correct
 * for what those files ask. It also means nothing here has ever watched the
 * failure case, and the failure case is where a real player spends their time.
 *
 * This one is allowed to fail. There is no floor under the treasury, no
 * scripted income, and no rescue. What it measures is the shape of being stuck:
 *
 *   stuck week   a week in which, after wages, the organization cannot afford
 *                to launch a single operation available to it
 *
 * That is the tester's experience stated as a number — not "did it go bankrupt"
 * but "was there anything to do".
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { availableOperations, launchOperation, operationCost } from '../operations';
import { crewList } from '../npc';
import { operableTerritories, playerInfluence, territoryList } from '../territory';
import { canRecruit, recruit, recruitCost } from '../crew';
import { totalFunds, weeklyWageBill } from '../economy';
import { isLayingLow } from '../heat';
import { acquireBusiness, canAcquire } from '../business';
import { BUSINESSES } from '../../config/businesses';
import { ROLE_ORDER, rankIndex } from '../../config/economy';
import { eligibleStewards, needsSteward, putInCharge } from '../delegation';
import type { GameState, OperationDef } from '../types';
import { answerCheaply, ev, idle, median } from './helpers';

function where(state: GameState): string | null {
  const options = operableTerritories(state);
  return options.length ? options[0].territory.id : null;
}

/** Everything the organization could actually launch right now. */
function launchable(state: GameState): OperationDef[] {
  if (isLayingLow(state)) return [];
  const free = idle(state).length;
  const funds = totalFunds(state);
  return availableOperations(state).filter(
    (d) => d.crewRequired <= free && operationCost(state, d) <= funds,
  );
}

/** Bodies by what they were doing, summed across sampled weeks. */
interface Where {
  idle: number;
  busy: number;
  out: number;
  /** Operations in flight, and how many of those needed nobody. */
  ops: number;
  soloOps: number;
  n: number;
}

/** Days counted by what stopped the organization working that day. */
interface Why {
  layingLow: number;
  tooHot: number;
  /** No district held or adjacent — nowhere a job could be run. */
  noGround: number;
  noBodies: number;
  noMoney: number;
  /** Only the solo job was affordable and one was already running. Benign. */
  soloAlreadyRunning: number;
  /** Something was launchable and nothing launched. Should be rare. */
  optionsButNoLaunch: number;
  launched: number;
}

interface Run {
  days: number;
  /** Weeks with nothing affordable to do. The number this file exists for. */
  stuckWeeks: number;
  /** The longest unbroken run of them. Being stuck for a fortnight is a bad
   *  week; being stuck for four months is the game not being playable. */
  longestStuck: number;
  rank: number;
  peakFunds: number;
  crewAtEnd: number;
  gameOver: boolean;
  /** Day the organization first held a front, or null. */
  firstFront: number | null;
  /** Why the stuck weeks were stuck. */
  blockedByBodies: number;
  blockedByMoney: number;
  blockedByOther: number;
  /** Stuck weeks where a hire was affordable and available. Not the game's fault. */
  blockedButCouldHire: number;
  /**
   * What the organization cleared each week, keyed by how big it was.
   *
   * The question underneath the day-sixty plateau, and it is not "is this
   * outfit poor". It is whether an outfit can *stop* being poor by growing.
   * Job income scales with crew and wages scale with crew, so if the surplus
   * is flat across every size then there are no economies of scale, and
   * raising payouts lifts the whole line without changing its slope — the
   * plateau moves a fortnight later and stays.
   */
  surplusByCrew: Map<number, number[]>;
  /** The weekly wage bill at each size, to read a negative surplus against. */
  wageByCrew: Map<number, number[]>;
  /** Where the bodies were at each size, summed over the weeks sampled. */
  idleByCrew: Map<number, Where>;
  /** Day the player made Crew Leader, or null. The gate the plateau sits at. */
  crewLeaderDay: number | null;
  /** Jobs actually started across the whole career. */
  launches: number;
  /** Expected money from every job started, and the slice of it that was solo. */
  jobIncome: number;
  soloIncome: number;
  /** Nights out per person per eight-week window, every weekly sample. */
  nightsSeen: number[];
  /** How often the proposed carry/bench marks would have fired. */
  marks: { carrying: number; benched: number; people: number; samples: number };
  /** Days counted by what stopped work happening. */
  why: Why;
}

/**
 * One career, played competently and without a safety net.
 *
 * The bot is deliberately not an optimiser and deliberately not reckless. It
 * takes the best expected money per crew-day it can pay for, hires when the
 * wage bill stays under what recent weeks actually earned, and stops working
 * when the heat is high enough to be dangerous. That is roughly what a careful
 * player does, and it is the only kind of player worth measuring here — a
 * reckless bot's troubles are its own fault and tell us nothing about the floor.
 */
function play(seed: number, days: number): Run {
  const state = newGame({ name: 'Floor', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);

  let stuckWeeks = 0;
  let longestStuck = 0;
  let currentStreak = 0;
  let peakFunds = totalFunds(state);
  let firstFront: number | null = null;
  let blockedByBodies = 0;
  let blockedByMoney = 0;
  let blockedByOther = 0;
  let blockedButCouldHire = 0;
  const surplusByCrew = new Map<number, number[]>();
  const wageByCrew = new Map<number, number[]>();
  const idleByCrew = new Map<number, Where>();
  let crewLeaderDay: number | null = null;
  const nightsSeen: number[] = [];
  const marks = { carrying: 0, benched: 0, people: 0, samples: 0 };
  let launches = 0;
  let jobIncome = 0;
  let soloIncome = 0;
  const why: Why = {
    layingLow: 0,
    tooHot: 0,
    noGround: 0,
    noBodies: 0,
    noMoney: 0,
    soloAlreadyRunning: 0,
    optionsButNoLaunch: 0,
    launched: 0,
  };
  let fundsLastWeek = totalFunds(state);

  for (let d = 0; d < days; d++) {

    answerCheaply(state, rng);

    // Hire only what the last few weeks could carry. The probe that hired
    // whenever it could afford the fee went short on payroll twice as often.
    const bill = weeklyWageBill(state);
    for (const id of Object.keys(state.recruits)) {
      if (totalFunds(state) < recruitCost(state) * 3) break;
      if (bill > totalFunds(state) / 4) break;
      if (canRecruit(state, id).ok) {
        recruit(state, id);
        break;
      }
    }

    /*
       Hand a district to somebody who can run it.

       Added when the surplus measurement showed the organization getting
       poorer as it grew, and the proposed answer was delegation — at which
       point it turned out this bot had never delegated in its life. A probe
       that cannot perform the fix cannot say whether the fix works, and this
       project has shipped that mistake before: the informant probe's bot never
       hired, so every world was discarded and the instrument reported the
       record unreadable.

       The policy is the obvious one a player would follow. If there is ground
       standing idle and somebody senior enough to stand in it, put the most
       senior free man on the district where you have the most standing.
    */
    if (state.day % 7 === 0 && needsSteward(state)) {
      const candidates = eligibleStewards(state);
      const loose = territoryList(state)
        .filter((t) => !t.stewardId && playerInfluence(t) > 20)
        .sort((a, b) => playerInfluence(b) - playerInfluence(a));
      if (candidates.length && loose.length) {
        const man = [...candidates].sort(
          (a, b) => ROLE_ORDER.indexOf(b.role) - ROLE_ORDER.indexOf(a.role),
        )[0];
        putInCharge(state, man.id, loose[0].id);
      }
    }

    /*
       Why nothing was started today.

       Throughput came out flat at every crew size — about four tenths of a job
       running whether the outfit had two people or seven — and the honest
       answer to "why" was that nobody knew. Three readings of this probe had
       already been wrong, twice from sampling and once from a bot that could
       not perform the fix it was being asked to test, so the reason a day
       passes with nobody working is counted here rather than reasoned about.
    */
    let launchedToday = 0;
    if (isLayingLow(state)) {
      why.layingLow += 1;
    } else if (state.org.heat >= 70) {
      why.tooHot += 1;
    } else {
      const target = where(state);
      const options = launchable(state).sort((a, b) => ev(b) - ev(a));
      if (!target) {
        why.noGround += 1;
      } else if (options.length === 0) {
        // Split the empty menu into its two very different causes.
        const free = idle(state).length;
        const anyStaffable = availableOperations(state).some((d) => d.crewRequired <= free);
        if (!anyStaffable) why.noBodies += 1;
        else why.noMoney += 1;
      } else {
        for (const def of options) {
          const free = idle(state);
          if (free.length < def.crewRequired) break;
          /*
             One solo job at a time — there is only one of you.

             `canLaunch` enforces this now. The check stays here because the
             `why` accounting below reads it to tell "had an option and took
             none of it" apart from "was blocked", and that classification
             would otherwise mislabel a refused solo job as idleness.

             Worth recording that this comment predates the fix. The rule was
             understood well enough to be written down in a probe and never
             put in the game, where a blind tester found it on day two.
          */
          if (def.crewRequired === 0 && Object.keys(state.activeOperations).length > 0) continue;
          if (operationCost(state, def) > totalFunds(state)) continue;
          if (
            launchOperation(
              state,
              def.id,
              free.slice(0, def.crewRequired).map((n) => n.id),
              target,
            )
          ) {
            launchedToday += 1;
            const gain = ((def.payout[0] + def.payout[1]) / 2) * def.baseSuccess - def.investment;
            jobIncome += gain;
            if (def.crewRequired === 0 && def.investment === 0) soloIncome += gain;
          }
        }
        if (launchedToday > 0) {
          why.launched += 1;
        } else if (
          options.every(
            (d) => d.crewRequired === 0 && Object.keys(state.activeOperations).length > 0,
          )
        ) {
          /*
             The one benign way to have an option and take none of it: the only
             thing you can afford is the solo job and you are already doing it.
             Classified rather than tolerated, so the guard below stays tight
             enough to still catch a bot that is genuinely failing to act.
          */
          why.soloAlreadyRunning += 1;
        } else {
          why.optionsButNoLaunch += 1;
        }
      }
    }
    launches += launchedToday;

    {
      /*
         Where the bodies are, counted after the day's work has been set going.

         Two sampling errors were made here before this line was right, and
         both of them produced a confident, plausible, wrong number. The first
         sampled weekly, so a one-to-five-day job was caught only sometimes.
         The second sampled at the top of the day — after `advanceDay` had
         resolved everything and before the bot had launched anything — which
         makes every single-day job structurally invisible, and the two
         cheapest jobs in the game both run a single day.

         It belongs here: after the work has been set going, before the clock
         resolves it.
      */
      const all = crewList(state).filter((n) => n.status !== 'dead');
      const size = all.length;
      const bucket = idleByCrew.get(size) ?? { idle: 0, busy: 0, out: 0, ops: 0, soloOps: 0, n: 0 };
      bucket.idle += all.filter((n) => n.status === 'active').length;
      bucket.busy += all.filter((n) => n.status === 'busy').length;
      bucket.out += all.filter((n) => n.status === 'injured' || n.status === 'arrested').length;
      bucket.n += 1;
      /*
         Jobs actually in flight, split by whether they use anybody.

         `work_it_yourself` needs no crew, so a bot living on solo work shows
         zero people "busy" while working every day of its life. Without this
         split, "nobody is working" could mean either the organization is idle
         or that it is scraping by alone — opposite diagnoses with opposite
         fixes.
      */
      const running = Object.values(state.activeOperations);
      bucket.ops += running.length;
      bucket.soloOps += running.filter((o) => o.crewIds.length === 0).length;
      idleByCrew.set(size, bucket);
    }

    /*
       Buy a front when one is affordable and the wage bill is still covered.

       The first version of this probe had no way to buy anything and duly
       reported that 0 of 24 careers ever held a front — a fact about the bot,
       not about the game, and exactly the class of finding this project keeps
       having to catch. A reserve of four weeks' wages is what stops it being a
       bot that spends its last dollar on a laundromat and then cannot make
       payroll.
    */
    for (const t of Object.values(state.territories)) {
      const reserve = weeklyWageBill(state) * 4;
      let bought = false;
      for (const def of BUSINESSES) {
        const check = canAcquire(state, def.id, t.id);
        if (!check.ok) continue;
        if (check.cost + reserve > totalFunds(state)) continue;
        if (acquireBusiness(state, def.id, t.id)) bought = true;
        break;
      }
      if (bought) break;
    }

    if (firstFront === null && Object.keys(state.businesses).length > 0) firstFront = state.day;
    peakFunds = Math.max(peakFunds, totalFunds(state));

    // The measurement, taken once a week on payday's doorstep.
    if (state.day % 7 === 0) {
      /*
         What the week cleared, against how many people it was carrying.

         Taken as the change in total funds rather than as income minus the
         wage bill, because that is the figure the player actually experiences
         and it cannot drift from the systems the way a re-derived sum can. It
         includes everything — jobs, fronts, the retainer, arrears, a loan —
         which is the point: the question is whether the organization ends the
         week ahead, not whether one ledger line does.
      */
      const now = totalFunds(state);
      const size = crewList(state).filter((n) => n.status !== 'dead').length;
      const bucket = surplusByCrew.get(size) ?? [];
      bucket.push(now - fundsLastWeek);
      surplusByCrew.set(size, bucket);
      fundsLastWeek = now;

      // What the week's wage bill was at that size, so a negative surplus can
      // be read as "wages outran income" or not, rather than guessed at.
      const wageBucket = wageByCrew.get(size) ?? [];
      wageBucket.push(weeklyWageBill(state));
      wageByCrew.set(size, wageBucket);


      /*
         Whether "who you send" is a decision this game holds enough of.

         The design for marking people who carry the work reads a ratio: your
         nights out over the last eight weeks against the crew average. A ratio
         is only a signal if there is something to count, and a career that
         starts fifty-odd jobs in a hundred and eighty days may simply not put
         enough nights on enough people for the number to mean anything. This
         measures that before the mechanic is built, rather than building it
         and then discovering the probe cannot tell two policies apart.
      */
      {
        const active = crewList(state).filter(
          (n) => n.status === 'active' || n.status === 'busy',
        );
        if (active.length > 0) {
          const window = state.operationHistory.filter((r) => state.day - r.day <= 56);
          const nights = active.map(
            (n) => window.filter((r) => r.crewIds.includes(n.id)).length,
          );
          const total = nights.reduce((a, b) => a + b, 0);
          for (const n of nights) nightsSeen.push(n);
          if (total > 0) {
            const mean = total / active.length;
            for (const n of nights) {
              const share = n / mean;
              if (share >= 1.6) marks.carrying += 1;
              else if (share <= 0.4) marks.benched += 1;
              marks.people += 1;
            }
            marks.samples += 1;
          }
        }
      }

      const nothingToDo = launchable(state).length === 0 && !isLayingLow(state);
      if (nothingToDo) {
        /*
           Why there was nothing to do, which is the whole diagnosis.

           A no-capital job exists at every rank by design, so money alone
           should never be able to lock the player out. If it turns out the
           blocker is bodies rather than dollars then the floor is not an
           economic problem at all — it is the arrest and injury system taking
           the crew away for months at a time, and no amount of cheaper jobs
           would touch it.
        */
        const free = idle(state).length;
        const cheapest = availableOperations(state)
          .filter((d) => d.crewRequired <= free)
          .reduce((lo, d) => Math.min(lo, operationCost(state, d)), Infinity);
        /*
           And could the player have hired their way out of it?

           The bot's own hiring rule is deliberately cautious, so "no bodies"
           on its own does not prove the game locked anybody out — it might
           only prove this bot would not spend. Splitting the two is the
           difference between a design defect and a probe reporting its own
           policy as one.
        */
        if (free === 0) {
          const couldHire = Object.keys(state.recruits).some((id) => canRecruit(state, id).ok);
          if (couldHire) blockedButCouldHire++;
          else blockedByBodies++;
        }
        else if (cheapest > totalFunds(state)) blockedByMoney++;
        else blockedByOther++;
        stuckWeeks++;
        currentStreak++;
        longestStuck = Math.max(longestStuck, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    advanceDay(state);

    if (crewLeaderDay === null && rankIndex(state.player.rank) >= rankIndex('crew_leader')) {
      crewLeaderDay = state.day;
    }

    if (state.gameOver) {
      return {
        days: d + 1,
        stuckWeeks,
        longestStuck,
        rank: rankIndex(state.player.rank),
        peakFunds,
        crewAtEnd: idle(state).length,
        gameOver: true,
        firstFront,
        blockedByBodies,
        blockedByMoney,
        blockedByOther,
        blockedButCouldHire,
        surplusByCrew,
        wageByCrew,
        idleByCrew,
        crewLeaderDay,
        launches,
        jobIncome,
        soloIncome,
        nightsSeen,
        marks,
        why,
      };
    }
  }

  return {
    days,
    stuckWeeks,
    longestStuck,
    rank: rankIndex(state.player.rank),
    peakFunds,
    crewAtEnd: idle(state).length,
    gameOver: false,
    firstFront,
    blockedByBodies,
    blockedByMoney,
    blockedByOther,
    blockedButCouldHire,
    surplusByCrew,
    wageByCrew,
    idleByCrew,
    crewLeaderDay,
    launches,
    jobIncome,
    soloIncome,
    nightsSeen,
    marks,
    why,
  };
}

const DAYS = 180;
const RUNS = Array.from({ length: 24 }, (_, i) => play(900 + i, DAYS));

describe('a career with no safety net', () => {
  it('played, and was allowed to fail', () => {
    /*
       The guard first. A probe that dies on day four reports a very impressive
       zero stuck weeks, and every instrument in this project that measured
       nothing did so while returning a plausible number.
    */
    expect(RUNS.length).toBe(24);
    expect(RUNS.filter((r) => r.days > 60).length).toBeGreaterThanOrEqual(20);
  });

  it('reports the shape of being stuck', () => {
    const stuck = RUNS.map((r) => r.stuckWeeks);
    const longest = RUNS.map((r) => r.longestStuck);
    const weeks = DAYS / 7;
    const fronts = RUNS.filter((r) => r.firstFront !== null);

    // eslint-disable-next-line no-console
    console.log(
      `floor: over ${DAYS} days (${Math.round(weeks)} weeks), median ${median(stuck)} stuck weeks ` +
        `(worst ${Math.max(...stuck)}), median longest unbroken run ${median(longest)} ` +
        `(worst ${Math.max(...longest)})\n` +
        `       median peak funds $${median(RUNS.map((r) => Math.round(r.peakFunds))).toLocaleString('en-US')}; ` +
        `median rank reached ${median(RUNS.map((r) => r.rank))}; ` +
        `${fronts.length}/${RUNS.length} ever held a front` +
        (fronts.length ? ` (median day ${median(fronts.map((f) => f.firstFront!))})` : '') +
        `; ${RUNS.filter((r) => r.gameOver).length}/${RUNS.length} ended
` +
        `       stuck because: no bodies ${RUNS.reduce((n, r) => n + r.blockedByBodies, 0)}, ` +
        `no money ${RUNS.reduce((n, r) => n + r.blockedByMoney, 0)}, ` +
        `something else ${RUNS.reduce((n, r) => n + r.blockedByOther, 0)}, ` +
        `no bodies but could have hired ${RUNS.reduce((n, r) => n + r.blockedButCouldHire, 0)}`,
    );

    /*
       The rule, now that the diagnosis is in.

       Before `work_it_yourself` existed: median 5 stuck weeks of 26, worst 14,
       longest unbroken run 8 weeks — and all 144 of them were a shortage of
       bodies rather than money. After: zero, in every world.

       Asserting zero rather than "few" is deliberate. There is now a job that
       needs nobody, costs nothing and is available at every rank, so a stuck
       week can only mean something has broken — the job was gated by accident,
       or `availableOperations` stopped returning it. There is no honest reason
       for this number to be one.
    */
    expect(
      Math.max(...stuck),
      'a career was left with nothing it could do — see work_it_yourself',
    ).toBe(0);

    /*
       ...and the rescue must not have become the strategy.

       This read `median(peakFunds) < 40_000` and called it a test of solo
       work, on the reasoning that if the rescue were worth doing on its own
       the treasury would climb. That holds only while nothing else about the
       job table moves, and it is a proxy two steps from the claim: it watches
       a *career's* wealth to decide something about *one job*.

       Restaking the paid jobs above the street moved the treasury to $51,330
       and this failed, having detected a change that had nothing to do with
       solo work — the paid jobs got cheaper to enter, which is the opposite of
       solo becoming attractive. Measured at the same moment, solo work was
       0.6% of expected job income across 24 careers.

       So it asks the question directly now. A quarter of all launches being
       solo is fine and expected, because the bot reaches for it whenever the
       crew is out; what would be wrong is solo work *paying* for the career.
       The bar is 5% of income, which is an order of magnitude above the 0.6%
       measured and still far below any reading that could be called a
       strategy.
    */
    const soloShare =
      RUNS.reduce((n, r) => n + r.soloIncome, 0) / RUNS.reduce((n, r) => n + r.jobIncome, 0);
    expect(
      soloShare,
      `solo work is ${(soloShare * 100).toFixed(1)}% of expected job income`,
    ).toBeLessThan(0.05);
  });
  it('reports whether the organization can grow its way to a surplus', () => {
    /*
       The question the day-sixty plateau actually asks.

       A blind playtester reached day 179 stuck four-fifths of the way to Crew
       Leader, blocked on nine thousand dollars of clean money against a front
       earning three hundred and sixty-five a week. The tempting reading is
       that the game is too poor and payouts should go up. The reading this
       measures instead is whether an outfit can grow its way out — because job
       income scales with crew and wages scale with crew, and if the surplus is
       the same at four people as at twelve, then raising payouts lifts the
       whole line without changing its slope and the plateau simply arrives a
       fortnight later.

       What is done about the answer is committed in the plan before this ever
       printed a number, so that it cannot be read to suit whichever fix was
       already wanted.
    */
    const sizes = new Map<number, number[]>();
    for (const run of RUNS) {
      for (const [size, weeks] of run.surplusByCrew) {
        sizes.set(size, [...(sizes.get(size) ?? []), ...weeks]);
      }
    }

    const rows = [...sizes.entries()]
      .filter(([, weeks]) => weeks.length >= 8)
      .sort((a, b) => a[0] - b[0])
      .map(([size, weeks]) => {
        const wages = RUNS.flatMap((r) => r.wageByCrew.get(size) ?? []);
        return {
          size,
          weeks: weeks.length,
          median: median(weeks),
          wage: wages.length ? median(wages) : 0,
        };
      });

    const reached = RUNS.map((r) => r.crewLeaderDay).filter((d): d is number => d !== null);

    // eslint-disable-next-line no-console
    console.log(
      'surplus: ' +
        rows
          .map(
            (r) =>
              `${r.size} crew ${r.median >= 0 ? '+' : ''}${r.median}/wk on a ${r.wage} wage bill (n=${r.weeks})`,
          )
          .join(', ') +
        '\n         where the bodies were: ' +
        rows
          .map((r) => {
            const w = RUNS.reduce(
              (acc, run) => {
                const x = run.idleByCrew.get(r.size);
                return x
                  ? { idle: acc.idle + x.idle, busy: acc.busy + x.busy, out: acc.out + x.out, ops: acc.ops + x.ops, soloOps: acc.soloOps + x.soloOps, n: acc.n + x.n }
                  : acc;
              },
              { idle: 0, busy: 0, out: 0, ops: 0, soloOps: 0, n: 0 },
            );
            return w.n
              ? `${r.size}: ${(w.idle / w.n).toFixed(1)} idle / ${(w.busy / w.n).toFixed(1)} on a job / ${(w.out / w.n).toFixed(1)} out, ${(w.ops / w.n).toFixed(2)} jobs running of which ${(w.soloOps / w.n).toFixed(2)} solo`
              : '';
          })
          .filter(Boolean)
          .join(', ') +
        `
         Crew Leader reached in ${reached.length}/${RUNS.length} worlds` +
        (reached.length ? `, median day ${median(reached)}` : ''),
    );

    /*
       The guard, not the finding.

       This asserts only that the instrument saw enough weeks at enough
       different crew sizes to say anything at all. Every instrument in this
       project that measured nothing did so while returning a plausible number,
       and a probe whose crew never changed size would report a beautifully
       flat line that meant only that it never hired anybody.
    */
    expect(rows.length, 'the probe never saw the crew change size').toBeGreaterThanOrEqual(3);
  });
  it('says why the organization was not working', () => {
    /*
       The question the throughput number could not answer.

       Jobs running held flat at four tenths whatever the size of the crew,
       which says hiring does not buy work and does not say why. Reasoning
       about it was how the last two wrong answers here were produced, so this
       counts the days instead: every day the organization did not start
       anything falls into exactly one bucket, and the buckets have different
       fixes. `noGround` would mean the constraint is territory. `noBodies`
       means arrests and injuries. `optionsButNoLaunch` would mean this probe
       is lying again.
    */
    const total = RUNS.reduce(
      (acc, r) => ({
        layingLow: acc.layingLow + r.why.layingLow,
        tooHot: acc.tooHot + r.why.tooHot,
        noGround: acc.noGround + r.why.noGround,
        noBodies: acc.noBodies + r.why.noBodies,
        noMoney: acc.noMoney + r.why.noMoney,
        soloAlreadyRunning: acc.soloAlreadyRunning + r.why.soloAlreadyRunning,
        optionsButNoLaunch: acc.optionsButNoLaunch + r.why.optionsButNoLaunch,
        launched: acc.launched + r.why.launched,
      }),
      {
        layingLow: 0,
        tooHot: 0,
        noGround: 0,
        noBodies: 0,
        noMoney: 0,
        soloAlreadyRunning: 0,
        optionsButNoLaunch: 0,
        launched: 0,
      },
    );
    const days = Object.values(total).reduce((a, b) => a + b, 0);
    const pc = (n: number) => `${Math.round((n / days) * 100)}%`;

    // eslint-disable-next-line no-console
    console.log(
      `why not working, over ${days} crew-days: started something ${pc(total.launched)}, ` +
        `no ground to work ${pc(total.noGround)}, no bodies ${pc(total.noBodies)}, ` +
        `no money ${pc(total.noMoney)}, too hot ${pc(total.tooHot)}, ` +
        `laying low ${pc(total.layingLow)}, already doing the solo job ${pc(total.soloAlreadyRunning)}, ` +
        `could have and did not ${pc(total.optionsButNoLaunch)}` +
        `
         ${median(RUNS.map((r) => r.launches))} jobs started in the median career`,
    );

    /*
       The instrument on trial, again.

       If the probe reports days where something was launchable and nothing
       launched, then the bot is failing to act and every throughput number
       above is a fact about the bot. It has happened twice already in this
       file's history and it is cheaper to assert than to re-derive.
    */
    expect(
      total.optionsButNoLaunch / days,
      'the bot had a job it could run and did not run it — the throughput numbers are about the bot',
    ).toBeLessThan(0.02);
  });
  it('says whether who-you-send is a decision the game holds enough of', () => {
    /*
       The pre-check on the marking mechanic, run before it is built.

       "Work marks people" reads a ratio — your nights out over eight weeks
       against the crew average — and a ratio built on two or three events is
       noise wearing a decimal point. If the marks would almost never fire, the
       mechanic is a diary rather than a decision and the honest thing is to say
       so here rather than to ship it and have a probe report two policies as
       indistinguishable when what it measured was that neither had any
       material to work with.
    */
    const nights = RUNS.flatMap((r) => r.nightsSeen);
    const carrying = RUNS.reduce((n, r) => n + r.marks.carrying, 0);
    const benched = RUNS.reduce((n, r) => n + r.marks.benched, 0);
    const people = RUNS.reduce((n, r) => n + r.marks.people, 0);

    const busy = nights.filter((n) => n > 0).length;

    // eslint-disable-next-line no-console
    console.log(
      `standing material: median ${median(nights)} nights per person per 8 weeks ` +
        `(${Math.round((busy / nights.length) * 100)}% of readings above zero, ` +
        `worst-to-best ${Math.min(...nights)}-${Math.max(...nights)})` +
        `
         marks would fire on ${Math.round((carrying / people) * 100)}% carrying, ` +
        `${Math.round((benched / people) * 100)}% benched, of ${people} person-readings`,
    );

    expect(nights.length, 'nobody was ever looked at').toBeGreaterThan(100);
  });
});
