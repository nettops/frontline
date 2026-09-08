/**
 * The bot's own scorecard, on the same nine categories a human tester scores.
 *
 * The playtest brief asks a cold tester to rate nine things 1-10. Comparing one
 * build against the last has meant waiting for a person, and people are slow,
 * expensive and — as this project's own history shows — land in completely
 * different halves of the game, so the scores move with that rather than with
 * the build.
 *
 * So this scores what a simulation honestly can, on the same axes, with the
 * rubric written down before the run rather than fitted to the output.
 *
 * ## What is deliberately not scored
 *
 * Three of the nine are left blank, and that is the point of the file rather
 * than a gap in it. **Fun**, **Writing and tone** and **Interface and
 * information design** cannot be measured by something with no eyes and no
 * boredom. This session found eighteen separate cases of a probe returning a
 * believable number about itself instead of about the game; emitting a 7.4 for
 * Fun would be the nineteenth and the worst of them, because it would look
 * exactly like an answer.
 *
 * One sub-property of Writing *is* measurable and is reported without being
 * scored: how often a player is shown a line they have already read.
 *
 * ## What it plays, which is not the whole game
 *
 * This bot recruits, launches one operation a day, and answers events with the
 * cheapest enabled choice. That is four of roughly fifteen systems. It has
 * never held a sit-down, never bought a police contact, never approached
 * another family, never run a trade, never put a man on a district.
 *
 * That narrowness is deliberate and is what makes the file work: a regression
 * instrument has to hold its own behaviour still, or a change in the reading
 * cannot be attributed to a change in the game. A bot that explored would
 * produce livelier numbers and no comparisons.
 *
 * But it means **Depth and Pacing here describe the job-and-crew loop, not the
 * game.** Pacing counts three kinds of first — a new job kind, a new district,
 * a rung — and the first front, the first trade, the first war, the first
 * handover and the first district at Control are none of them. Quote these
 * figures as what they are, or they become the twentieth case of an instrument
 * reporting a fact about itself.
 *
 * ## How to read it against a human round
 *
 * These are not the tester's numbers and will not match them. This is a
 * regression instrument: run it before and after a change and watch which axis
 * moved. A human round says whether the game is good. This says whether it got
 * worse while nobody was looking.
 */
import { describe, expect, it } from 'vitest';

import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { canRecruit, recruit, recruitCost } from '../crew';
import { totalFunds, weeklyWageBill } from '../economy';
import {
  availableOperations,
  launchOperation,
  operationCost,
  opsBoard,
  standing,
  successBreakdown,
} from '../operations';
import { controlledTerritories, operableTerritories, playerInfluence } from '../territory';
import { OPERATIONS } from '../../config/operations';
import { TERRITORIES } from '../../config/territories';
import { availableCrew, crewList } from '../npc';
import type { GameState } from '../types';

/*
   Twelve until an unrelated change moved Pacing from 3.8 to 2.6 and the axis
   read as collapsed.

   It had not collapsed. Re-run at 48 the same two builds read 3.4 against 3.4,
   with the longest quiet stretch at 406 days against 403 — the entire apparent
   drop was the random stream being reshuffled, which every change to this
   project does. Pacing is the axis most exposed to it: `longestGap` is a mean
   of *per-career maxima*, and a mean of maxima at twelve samples moves further
   on noise than most real changes move it on purpose.

   So the bar of 3 was being read off an instrument whose noise band is wider
   than the bar. Raising the sample is not moving the threshold — it is making
   the threshold mean something. Costs about twenty seconds.
*/
const WORLDS = 48;
const DAYS = 1460;

interface Run {
  /** What the screen promised, against what happened, per job. */
  predicted: number[];
  landed: boolean[];
  /** Weeks a headline number moved, and how many of those also wrote a line. */
  movedWeeks: number;
  explainedWeeks: number;
  /** Days on which something happened for the first time. */
  firstsByDay: number[];
  kinds: Set<string>;
  /** Weeks where the best-looking job differed from the week before. */
  choiceChanges: number;
  choiceWeeks: number;
  firstJobBy: number | null;
  firstHireBy: number | null;
  firstRankBy: number | null;
  lines: number;
  repeats: number;
  /**
   * How often each exact sentence was written, and how many days said nothing
   * new at all.
   *
   * `repeats` is a share and a share is the wrong shape for this. A payday
   * line recurring every Friday is the game working; one sentence being a
   * third of everything the player ever reads is not, and both land in the
   * same percentage. These two separate them.
   */
  byText: Map<string, number>;
  daysWithLines: number;
  daysAllOld: number;
  endRank: number;
  endedEarly: boolean;
}

/*
   One day, with the money left alone.

   The first version used `runDaysSolvent`, which is the right helper for
   measuring whether a *simulation* holds together over decades and exactly the
   wrong one here: it sets the wallet to a million dollars every morning. The
   Difficulty axis duly reported that 0% of careers ended early and every one of
   them finished at the same rank, which is what a game with cheats switched on
   looks like from the inside.

   Events are still answered, because a career that stops on an unanswered memo
   is not a career. The cheapest enabled choice, which is the same rule the
   other probes in this directory use.
*/
function runDay(s: GameState, rng: Rng): boolean {
  let guard = 0;
  while (s.pendingEvents.length > 0 && guard++ < 20) {
    const event = s.pendingEvents[0];
    const choice = event.choices.find((c) => !c.disabledReason) ?? event.choices[0];
    resolveEvent(s, rng, event.id, choice.id);
  }
  advanceDay(s);
  return !s.gameOver;
}

function snapshot(s: GameState) {
  return {
    cash: s.org.cash,
    dirty: s.org.dirtyCash,
    respect: s.org.respect,
    heat: s.org.heat,
    crew: crewList(s).length,
  };
}

/** A number the stat bar shows, moving by enough that a player would notice. */
function moved(a: ReturnType<typeof snapshot>, b: ReturnType<typeof snapshot>): boolean {
  return (
    Math.abs(b.cash - a.cash) > 250 ||
    Math.abs(b.dirty - a.dirty) > 250 ||
    Math.abs(b.respect - a.respect) >= 1 ||
    Math.abs(b.heat - a.heat) >= 3 ||
    b.crew !== a.crew
  );
}

function play(seed: number): Run {
  const s = newGame({ name: 'Bench', difficulty: 'normal', mode: 'career', seed });
  const rng = new Rng(s.rng);
  const r: Run = {
    predicted: [],
    landed: [],
    movedWeeks: 0,
    explainedWeeks: 0,
    firstsByDay: [],
    kinds: new Set(),
    choiceChanges: 0,
    choiceWeeks: 0,
    firstJobBy: null,
    firstHireBy: null,
    firstRankBy: null,
    lines: 0,
    repeats: 0,
    byText: new Map(),
    daysWithLines: 0,
    daysAllOld: 0,
    endRank: 0,
    endedEarly: false,
  };
  const seenKinds = new Set<string>();
  const seenDistricts = new Set<string>();
  const seenText = new Set<string>();
  /*
     Predictions are paired to outcomes by operation id, not by array position.

     `operationHistory` is the third ring buffer in this file's story: unshift,
     capped at 200. Reading `slice(previousLength)` therefore collected outcomes
     only until the cap was reached and nothing afterwards, while predictions
     went on accruing for the whole four years — so the early, easy, high-odds
     jobs were being compared against the odds quoted for an entire career. It
     reported the screen promising 51% on work that landed 73% of the time, and
     called the game's own honesty a twenty-two point lie.
  */
  const promised = new Map<string, number>();
  let lastBest: string | null = null;
  /*
     How far up the board the career has got.

     All three of these read `rankIndex(s.player.rank)`, and `player.rank` has
     been pinned at the first rung since the ladder came out — so `lastRank`
     never moved, the "first" below never fired once in any career, and
     `endRank` was the same number in every world. That silently zeroed half of
     the Difficulty axis (`distinctEnds` was always 1) and starved the Pacing
     axis of the firsts it counts.

     `standing()` is the live measure and is what `ladder.probe` switched to:
     the highest tier of the job table the board actually opens.
  */
  let lastRank = standing(s);
  /*
     The log is read by date, not by length, because it is a ring buffer.

     `addLog` unshifts and then truncates to `LOG_LIMIT`, so `state.log.length`
     saturates and stops moving, and `slice(previousLength)` reads the *newest*
     entries over and over. Both of the readings that depend on the log were
     wrong because of it: weeks-that-explained-themselves sat at 4%, which would
     have been a devastating finding about the game, and 98% of lines were
     reported as repeats, which would have been a devastating one about the
     writing. Neither was true. Counting entries stamped with today's date is
     immune to the cap.
  */
  let prev = snapshot(s);
  let explainedThisWeek = false;

  for (let d = 0; d < DAYS; d++) {
    /*
       Hires within reach of the payroll, rather than to the cap.

       Without a reserve this bot hired every face it was offered and half the
       careers ended broke, which is a statement about the bot's judgement and
       not about whether the game is fair. Four weeks of the wage bill is the
       same test `ladder.probe` applies.
    */
    if (totalFunds(s) > weeklyWageBill(s) * 4 + recruitCost(s)) {
      for (const id of Object.keys(s.recruits)) {
        if (canRecruit(s, id).ok) {
          recruit(s, id);
          if (r.firstHireBy === null) r.firstHireBy = s.day;
          break;
        }
      }
    }

    /*
       Works its stronghold, and spends a week in three opening the next place.

       The first version always took the strongest district, which meant it
       never opened a second one — so Pacing measured a 527-day stretch with
       nothing new in it and called that the game's fault. It was a bot that
       had been told to stay home. This is the rule `ladder.probe` settled on
       for the same reason: earn where you are established, expand while you
       are short of what the next rank asks for.
    */
    const ranked = [...operableTerritories(s)].sort(
      (a, b) => playerInfluence(b.territory) - playerInfluence(a.territory),
    );
    const unfinished = ranked.filter((o) => playerInfluence(o.territory) < 50);
    /*
       How much ground the next thing worth having asks for.

       This read `RANKS[rankIndex(player.rank) + 1].requires.territories`, and
       `player.rank` is pinned — so it was always Enforcer's requirement, which
       is 0, so `expanding` was always false and this bot never expanded on
       purpose in its entire run. `ladder.probe` hit the same bug and fixed it
       by asking the job gates instead; this does the same, more cheaply.
    */
    const board = opsBoard(s);
    const wanted = OPERATIONS.filter((o) => o.opens && !o.opens.met(board))
      .sort((a, b) => a.tier - b.tier)
      .reduce<number>((need, op) => {
        if (need > 0) return need;
        for (let n = board.districtsControlled + 1; n <= TERRITORIES.length; n++) {
          if (
            op.opens!.met({
              ...board,
              districtsControlled: n,
              districtsHeld: Math.max(board.districtsHeld, n),
            })
          ) {
            return n;
          }
        }
        return 0;
      }, 0);
    const expanding =
      controlledTerritories(s).length < wanted && unfinished.length > 0 && s.day % 21 < 7;
    const where = (expanding ? unfinished[0] : (ranked[0] ?? unfinished[0]))?.territory.id ?? null;

    if (where) {
      const options = availableOperations(s).filter(
        (o) => availableCrew(s).length >= o.crewRequired,
      );
      if (options.length && s.day % 7 === 0) {
        const best = options
          .map((o) => ({
            id: o.id,
            p: successBreakdown(s, o, availableCrew(s).slice(0, o.crewRequired), where).total,
          }))
          .sort((a, b) => b.p - a.p)[0];
        r.choiceWeeks += 1;
        if (lastBest !== null && lastBest !== best.id) r.choiceChanges += 1;
        lastBest = best.id;
      }
      /*
         One job at a time, best expected money, leaving bodies free.

         Two corrections in one. Launching every affordable option every day
         meant the family always had work running, and `checkGameOver` needs no
         active work — so no career could end and Difficulty read 0%. Then
         picking the *safest* job instead collapsed Depth to two job kinds and
         an 8% week-to-week change, because always-highest-odds is a degenerate
         player rather than a careful one.

         Expected money is the rule `ladder.probe` uses and the one the config's
         own header describes: the payout multiplied by the odds, less what it
         costs to put out.
      */
      const ev = (o: (typeof options)[number]) => {
        const crew = availableCrew(s).slice(0, o.crewRequired);
        const mid = (o.payout[0] + o.payout[1]) / 2;
        return mid * successBreakdown(s, o, crew, where).total - operationCost(s, o);
      };
      const byValue = [...options].sort((a, b) => ev(b) - ev(a));
      for (const def of byValue.slice(0, 1)) {
        if (availableCrew(s).length < def.crewRequired) break;
        const crew = availableCrew(s).slice(0, def.crewRequired);
        /*
           The prediction is only kept when the job actually went out.

           The first version pushed one for every attempt, including the ones
           `launchOperation` refused, and then compared that against outcomes
           that only exist for jobs that ran. It reported the screen quoting 44%
           on work that landed 75% of the time — a thirty-one point lie that was
           entirely an unpaired sample.
        */
        const chance = successBreakdown(s, def, crew, where).total;
        const started = launchOperation(
          s,
          def.id,
          crew.map((n) => n.id),
          where,
        );
        if (!started) continue;
        promised.set(started.id, chance);
        if (r.firstJobBy === null) r.firstJobBy = s.day;
        if (!seenKinds.has(def.id)) {
          seenKinds.add(def.id);
          r.firstsByDay.push(s.day);
        }
        if (!seenDistricts.has(where)) {
          seenDistricts.add(where);
          r.firstsByDay.push(s.day);
        }
        r.kinds.add(def.id);
      }
    }

    if (!runDay(s, rng)) {
      r.endedEarly = true;
      break;
    }
    for (const res of s.operationHistory) {
      const said = promised.get(res.id);
      if (said === undefined) continue;
      promised.delete(res.id);
      r.predicted.push(said);
      r.landed.push(res.success);
    }

    const rankNow = standing(s);
    if (rankNow > lastRank) {
      lastRank = rankNow;
      if (r.firstRankBy === null) r.firstRankBy = s.day;
      r.firstsByDay.push(s.day);
    }

    const today = s.log.filter((e) => e.day === s.day);
    let somethingNew = false;
    for (const entry of today) {
      r.lines += 1;
      explainedThisWeek = true;
      r.byText.set(entry.text, (r.byText.get(entry.text) ?? 0) + 1);
      if (seenText.has(entry.text)) r.repeats += 1;
      else {
        seenText.add(entry.text);
        somethingNew = true;
      }
    }
    if (today.length > 0) {
      r.daysWithLines += 1;
      if (!somethingNew) r.daysAllOld += 1;
    }

    if (s.day % 7 === 0) {
      const now = snapshot(s);
      if (moved(prev, now)) {
        r.movedWeeks += 1;
        if (explainedThisWeek) r.explainedWeeks += 1;
      }
      prev = now;
      explainedThisWeek = false;
    }
  }

  r.endRank = standing(s);
  return r;
}

/**
 * A measured value against a floor and a target, both committed before the run.
 *
 * `floor` is the reading that earns a 1 and `target` the reading that earns a
 * 10. Either may be the larger of the two — a longer quiet stretch is worse, a
 * wider catalogue is better — so the direction lives in the call rather than
 * in here.
 */
function scale(value: number, floor: number, target: number): number {
  if (target === floor) return 5;
  const t = (value - floor) / (target - floor);
  return Math.max(1, Math.min(10, 1 + t * 9));
}

const one = (n: number) => `${Math.round(n * 10) / 10}`;
const pc = (n: number) => `${Math.round(n * 100)}%`;

describe('the scorecard', () => {
  const runs = Array.from({ length: WORLDS }, (_, i) => play(i + 1));
  const flat = <T,>(pick: (r: Run) => T[]): T[] => runs.flatMap(pick);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  /*
     The median lives beside the mean here rather than replacing it.

     Rule 3 in the handoff forbids the two appearing in one expression, not in
     one file. The axes above are means by design — they average scores across
     careers — and the two readings below are shares with a tail, which is
     what `median` is for.
  */
  const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  // Clarity — is the number on the screen the number you get?
  const predicted = mean(flat((r) => r.predicted));
  const actual = mean(flat((r) => r.landed.map((x) => (x ? 1 : 0))));
  const calibration = Math.abs(predicted - actual);
  const clarity = scale(calibration, 0.15, 0.02);

  // Feedback — when a headline number moved, did anything say why?
  const movedW = runs.reduce((a, r) => a + r.movedWeeks, 0);
  const explainedW = runs.reduce((a, r) => a + r.explainedWeeks, 0);
  const coverage = movedW ? explainedW / movedW : 0;
  const feedback = scale(coverage, 0.5, 1);

  // First hour — does a cold start reach the three things that teach the game?
  const within60 = (pick: (r: Run) => number | null) =>
    runs.filter((r) => {
      const v = pick(r);
      return v !== null && v <= 60;
    }).length / runs.length;
  const milestones =
    (within60((r) => r.firstJobBy) + within60((r) => r.firstHireBy) + within60((r) => r.firstRankBy)) / 3;
  const firstHour = scale(milestones, 0.4, 1);

  // Depth — do the decisions keep changing, and is the catalogue used?
  const churn = mean(runs.map((r) => (r.choiceWeeks ? r.choiceChanges / r.choiceWeeks : 0)));
  const breadth = mean(runs.map((r) => r.kinds.size));
  const depth = (scale(churn, 0.02, 0.25) + scale(breadth, 3, 14)) / 2;

  // Pacing — how often does something happen for the first time?
  const firsts = mean(runs.map((r) => r.firstsByDay.length));
  const longestGap = mean(
    runs.map((r) => {
      const days = [0, ...r.firstsByDay].sort((a, b) => a - b);
      let worst = 0;
      for (let i = 1; i < days.length; i++) worst = Math.max(worst, days[i] - days[i - 1]);
      return worst;
    }),
  );
  const pacing = (scale(firsts, 6, 24) + scale(longestGap, 500, 90)) / 2;

  /*
     And when the last new thing happened, which is the flatline itself.

     `longestGap` finds the worst silence anywhere in a career; this finds where
     the silences stop being interruptions and become the rest of it. Round 17's
     three scorers all reported the same shape without being able to name it —
     decisions stopped changing at days 120, 130 and 180 — and the axis above
     could not distinguish a long gap in the middle from a career that simply
     ran out.

     The pool of firsts is finite by construction: a job kind, a district, a
     rank, each counted once. So a career that has run everything it can reach
     has nothing left that can be new, and the number below is the day that
     happened. Reported rather than scored, because what to do about it is a
     question about how much game there is rather than about tuning.
  */
  const lastFirst = mean(
    runs.map((r) => (r.firstsByDay.length ? Math.max(...r.firstsByDay) : 0)),
  );
  const flatShare = mean(
    runs.map((r) => {
      const last = r.firstsByDay.length ? Math.max(...r.firstsByDay) : 0;
      /*
         Against the full span rather than a per-run one, because `Run` does not
         record where it stopped and a career that ended early has a short flat
         tail for the opposite reason — it died, it did not run dry. Careers
         that end early are already the Difficulty axis's business.
      */
      return (DAYS - last) / DAYS;
    }),
  );

  /*
     Difficulty — a spread of outcomes rather than one outcome.

     A game everybody survives is not fair, it is inert; one nobody survives is
     not fair either. The target is about a third of careers ending early and a
     real spread of ranks reached, which is the shape the succession system was
     built to produce.
  */
  const endedEarly = runs.filter((r) => r.endedEarly).length / runs.length;
  const distinctEnds = new Set(runs.map((r) => r.endRank)).size;
  const fairness = 1 - Math.abs(endedEarly - 0.33) / 0.67;
  const difficulty = (scale(fairness, 0.2, 1) + scale(distinctEnds, 1, 5)) / 2;

  const repetition = mean(runs.map((r) => (r.lines ? r.repeats / r.lines : 0)));

  /*
     The two readings that say what the repetition actually is.

     `loudest` is the share of everything a player reads that one single
     sentence accounts for. `deadDays` is the share of days on which the whole
     screen was lines they had already met.

     Neither is a judgement about prose — the axis above stays unscored and
     still needs eyes. These are countable facts about supply, and they are
     here because the axis was printing 43% with no way to tell a Friday
     payday line from one sentence swallowing the log.
  */
  const loudestOf = (r: Run) => {
    let top = 0;
    let text = '';
    for (const [t, n] of r.byText) if (n > top) [top, text] = [n, t];
    return { share: r.lines ? top / r.lines : 0, text, count: top };
  };
  const loudest = runs.map(loudestOf).sort((a, b) => b.share - a.share);
  const loudestShare = median(loudest.map((x) => x.share));
  const deadDays = median(runs.map((r) => (r.daysWithLines ? r.daysAllOld / r.daysWithLines : 0)));

  /*
     And the sentences themselves, summed across the population, because a
     line that is loud in one career is usually loud in all of them.
  */
  const across = new Map<string, number>();
  let allLines = 0;
  for (const r of runs) {
    allLines += r.lines;
    for (const [t, n] of r.byText) across.set(t, (across.get(t) ?? 0) + n);
  }
  const worst = [...across].sort((a, b) => b[1] - a[1]).slice(0, 8);

  /*
     The same count again, on the last sentence of each line.

     The whole-line reading above says the loudest sentence is 4% and that is
     true and it is not what a player feels, because the loud writing in this
     game is templated: `${job} in ${district} failed. It came apart, but
     everyone walked away.` is one sentence wearing a hundred different hats,
     and the whole-line count files each hat separately. Taking the text after
     the last full stop puts them back together. On lines with nothing to
     strip it is the line, which is the honest no-op.

     Plotted first, repaired, then barred — the order DIRECTOR section 5 asks
     for. What the plot found and what the repair did:

         reading                                before   after
         lines that were ones you had read       43%      36%
         loudest whole line                       4%       2%
         days that said nothing new              24%      17%
         loudest last sentence                  7.2%     1.1%
         the top eight last sentences, summed  22.9%     7.9%

     The repair is variants with a subject out of the state — the man who was
     on it, the street it happened on, the face on the new list — in
     `operations.ts`, `npc.ts` and `crew.ts`.
  */
  const tail = (t: string) => {
    const parts = t.split('. ');
    return parts.length > 1 ? parts[parts.length - 1] : t;
  };
  const byTail = new Map<string, number>();
  for (const [t, n] of across) byTail.set(tail(t), (byTail.get(tail(t)) ?? 0) + n);
  const worstTails = [...byTail].sort((a, b) => b[1] - a[1]).slice(0, 8);

  it('prints the scorecard', () => {
    console.log(
      [
        '',
        `         the bot's scorecard — ${WORLDS} careers of ${DAYS} days`,
        '',
        `         First hour ......................... ${one(firstHour)}   job, hire and rank inside 60 days: ${pc(milestones)}`,
        `         Clarity ............................ ${one(clarity)}   quoted ${pc(predicted)}, landed ${pc(actual)} — ${Math.round(calibration * 100)} points out`,
        `         Feedback ........................... ${one(feedback)}   ${pc(coverage)} of weeks a number moved also said why`,
        `         Depth .............................. ${one(depth)}   best job changed ${pc(churn)} of weeks, ${Math.round(breadth)} kinds used`,
        `         Pacing ............................. ${one(pacing)}   ${Math.round(firsts)} firsts, longest quiet stretch ${Math.round(longestGap)} days`,
        `                                                    nothing was new after day ${Math.round(lastFirst)} — ${pc(flatShare)} of the career`,
        `         Difficulty ......................... ${one(difficulty)}   ${pc(endedEarly)} ended early, ${distinctEnds} different ranks reached`,
        `         Writing and tone ................... not scored   ${pc(repetition)} of lines were ones you had read before`,
        `                                                          the loudest single sentence is ${pc(loudestShare)} of everything read`,
        `                                                          ${pc(deadDays)} of days said nothing that was not already said`,
        ...worst.map(
          ([t, n]) =>
            `                                                          ${String(Math.round((1000 * n) / allLines) / 10).padStart(5)}%  ${t.slice(0, 74)}`,
        ),
        `                                                          and the same count on the last sentence of each line:`,
        ...worstTails.map(
          ([t, n]) =>
            `                                                          ${String(Math.round((1000 * n) / allLines) / 10).padStart(5)}%  ${t.slice(0, 74)}`,
        ),
        `         Interface and information design ... not scored   needs eyes`,
        `         Fun ................................ not scored   needs a person`,
        '',
      ].join('\n'),
    );
    expect(runs.length).toBe(WORLDS);
  });

  /*
     The only assertion, and it is a floor rather than a target.

     A scorecard that fails whenever a build is merely mediocre is one somebody
     will delete. This fails only when an axis collapses, which is the case
     worth stopping a commit for — and is exactly what happened twice in one
     afternoon when a heat change took Boss from seventeen careers to none.
  */
  /*
     One sentence must not be the game's voice.

     Pre-committed before the first reading was taken, and stated about the
     shape rather than fitted to a number: no single sentence may be more than
     a tenth of everything a player reads in a career. Ten percent is already
     generous — it is one line in ten, from a game with a hundred of them —
     and the point of putting it here is that it is the kind of thing nobody
     notices while writing and everybody notices while playing.

     A target for the writing, not a threshold on this file. If it fails, the
     repair is to give that sentence variants and a subject out of the
     simulation, which is the trick `eventgen.ts` and `whispers.ts` already
     use; it is not to move this.
  */
  it('does not let one sentence become the whole voice', () => {
    expect(
      loudestShare,
      `"${loudest[Math.floor(loudest.length / 2)]?.text ?? ''}" is most of what the game says`,
    ).toBeLessThanOrEqual(0.1);
  });

  /*
     And the same rule for the sentence underneath the template.

     Not a percentile placement — this is a share across a population rather
     than a distribution of careers, and pretending otherwise would be the
     dressing-up this file's own rules exist to stop. It is placed where the
     defect was: `clean_break` sat at 7.2% with one sentence, the repair took
     it to 1.1%, and 3% is comfortably above ordinary drift and comfortably
     below a line becoming the voice again.

     The whole-line bar above cannot catch this on its own. It read 4% while
     one sentence was 7.2% of everything a player met, because
     `${job} in ${district} failed.` files every instance under a different
     heading. Both bars are needed and neither is redundant.
  */
  it('does not let one sentence hide inside a template', () => {
    const [text, n] = worstTails[0] ?? ['', 0];
    expect(n / allLines, `"${text}" is most of what the game says`).toBeLessThanOrEqual(0.03);
  });

  it('does not let any measured axis collapse', () => {
    const scores = { firstHour, clarity, feedback, depth, pacing, difficulty };
    const collapsed = Object.entries(scores)
      .filter(([, v]) => v < 3)
      .map(([k]) => k);
    expect(collapsed).toEqual([]);
  });
});
