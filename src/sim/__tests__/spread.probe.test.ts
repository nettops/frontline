/**
 * Does it matter who you send?
 *
 * This file exists to try to disprove the mechanic in `sim/standing.ts`. That
 * mechanic marks the man who carries the work and the man who never gets sent,
 * on the theory that "who is free" should be a decision rather than a lookup.
 * The theory is only worth anything if two bosses who staff jobs differently
 * end up running different organizations.
 *
 * So: two policies, the same seeds, everything else identical.
 *
 *   best     send the most skilled people available. What everybody does
 *            without thinking about it, and the locally correct play every
 *            single time.
 *   rotate   send whoever has been out least. Gives up some of tonight's odds
 *            to spread the work.
 *
 * If those two produce the same crew after a hundred and eighty days, then
 * marking people is a diary and not a decision, and this file should say so
 * rather than be quietly deleted.
 *
 * The bot here is deliberately smaller than the one in `floor.probe`. It
 * answers memos, hires within its income, and launches jobs — which is
 * everything that puts nights on people, and nothing else. A copy rather than
 * a shared helper on purpose: tuning one probe's bot must not silently move
 * the other probe's numbers.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { availableOperations, launchOperation, operationCost } from '../operations';
import { crewList } from '../npc';
import { nightsWorked } from '../standing';
import { operableTerritories } from '../territory';
import { canRecruit, recruit, recruitCost } from '../crew';
import { totalFunds, weeklyWageBill } from '../economy';
import { resolveEvent } from '../events';
import { isLayingLow } from '../heat';
import { OPERATIONS } from '../../config/operations';
import { rankIndex } from '../../config/economy';
import type { GameState, Id, Npc, OperationDef } from '../types';
import { median } from './helpers';

type Policy = 'best' | 'rotate';

/** The cheapest open answer, which is what somebody short of money picks. */
function answerCheaply(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.pendingEvents.length && guard++ < 20) {
    const e = state.pendingEvents[0];
    const open = e.choices.filter((c) => !c.disabledReason);
    const priced = (c: { hint?: string }) => {
      const m = /\$([\d,]+)/.exec(c.hint ?? '');
      return m ? Number(m[1].replace(/,/g, '')) : 0;
    };
    const pick = open.length
      ? open.reduce((a, b) => (priced(a) <= priced(b) ? a : b))
      : e.choices[0];
    resolveEvent(state, rng, e.id, pick.id);
  }
}

function idle(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

/**
 * The whole difference between the two runs.
 *
 * `best` sorts on skill, which is the locally correct choice on every single
 * job. `rotate` sorts on who has been out least, which is never the locally
 * correct choice and is the entire hypothesis under test.
 */
function pickCrew(state: GameState, def: OperationDef, policy: Policy): Id[] {
  const free = idle(state);
  const ranked =
    policy === 'best'
      ? [...free].sort((a, b) => b.stats.skill - a.stats.skill)
      : [...free].sort((a, b) => nightsWorked(state, a.id) - nightsWorked(state, b.id));
  return ranked.slice(0, def.crewRequired).map((n) => n.id);
}

interface Run {
  days: number;
  launches: number;
  /** Share of all crew-slots that went to the three most-used people. */
  topThreeShare: number;
  /** People ending with a grievance at or above the badge threshold. */
  carrying: number;
  walked: number;
  /** Distinct people who were ever sent anywhere. */
  everUsed: number;
  /** Times each mark fired across the career. */
  carriedMarks: number;
  benchedMarks: number;
  /** Grievance from a source that has nothing to do with who you sent. */
  unpaidMarks: number;
  /** Of the six behaviourally-gated jobs, how many opened below Crew Leader. */
  openedByBehaviour: number;
  /** How many distinct kinds of job the bot ever ran. Explains the line above. */
  kindsRun: number;
}

function play(seed: number, days: number, policy: Policy): Run {
  const state = newGame({ name: 'Spread', difficulty: 'normal', seed });
  const rng = new Rng(state.rng);
  let launches = 0;
  let openedByBehaviour = 0;

  for (let d = 0; d < days; d++) {
    answerCheaply(state, rng);

    const bill = weeklyWageBill(state);
    for (const id of Object.keys(state.recruits)) {
      if (totalFunds(state) < recruitCost(state) * 3) break;
      if (bill > totalFunds(state) / 4) break;
      if (canRecruit(state, id).ok) {
        recruit(state, id);
        break;
      }
    }

    if (!isLayingLow(state) && state.org.heat < 70) {
      const where = operableTerritories(state)[0]?.territory.id ?? null;
      const options = availableOperations(state).filter(
        (o) => o.crewRequired <= idle(state).length && operationCost(state, o) <= totalFunds(state),
      );
      if (where) {
        for (const def of options) {
          if (idle(state).length < def.crewRequired) break;
          // The game refuses a second solo job now, so the bot does not have
          // to. Kept as a comment because the line that used to be here was a
          // workaround for a real defect nobody had noticed.
          if (operationCost(state, def) > totalFunds(state)) continue;
          if (launchOperation(state, def.id, pickCrew(state, def, policy), where)) launches += 1;
        }
      }
    }

    // Counted while it is true rather than at the end: rank can arrive later
    // and would then take the credit for a job behaviour had already opened.
    if (state.day % 7 === 0 && rankIndex(state.player.rank) < rankIndex('crew_leader')) {
      const open = availableOperations(state).filter((o) => o.minRank === 'crew_leader').length;
      openedByBehaviour = Math.max(openedByBehaviour, open);
    }

    advanceDay(state);
    if (state.gameOver) break;
  }

  const slots = new Map<Id, number>();
  for (const r of state.operationHistory) {
    for (const id of r.crewIds) slots.set(id, (slots.get(id) ?? 0) + 1);
  }
  const kinds = new Set(state.operationHistory.map((r) => r.defId));
  const counts = [...slots.values()].sort((a, b) => b - a);
  const total = counts.reduce((a, b) => a + b, 0);
  const topThree = counts.slice(0, 3).reduce((a, b) => a + b, 0);

  const everybody = Object.values(state.npcs);
  const marks = (kind: string) =>
    everybody.reduce((n, npc) => n + npc.memories.filter((m) => m.kind === kind).length, 0);

  return {
    days: state.day,
    launches,
    topThreeShare: total > 0 ? topThree / total : 0,
    carrying: crewList(state).filter((n) => n.stats.grievance >= 55).length,
    walked: everybody.filter((n) => n.status === 'defected').length,
    everUsed: slots.size,
    carriedMarks: marks('carried_the_work'),
    benchedMarks: marks('left_on_the_bench'),
    unpaidMarks: marks('went_unpaid'),
    openedByBehaviour,
    kindsRun: kinds.size,
  };
}

const DAYS = 180;
const SEEDS = Array.from({ length: 30 }, (_, i) => 2000 + i);
const best = SEEDS.map((s) => play(s, DAYS, 'best'));
const rotate = SEEDS.map((s) => play(s, DAYS, 'rotate'));

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe('who you send', () => {
  it('played both policies properly', () => {
    /*
       The instrument on trial, first and always.

       Every probe in this project that measured nothing did so while returning
       a plausible number: a bot that never hired, a bot that never bought a
       front, a sample point that made short jobs invisible. If either policy
       here fails to launch jobs or fails to use more than a handful of people,
       every figure below is a fact about this file.
    */
    for (const [name, runs] of [
      ['best', best],
      ['rotate', rotate],
    ] as const) {
      expect(runs.length).toBe(SEEDS.length);
      expect(
        runs.filter((r) => r.days > 60).length,
        `${name} died early in most worlds`,
      ).toBeGreaterThanOrEqual(SEEDS.length - 5);
      expect(median(runs.map((r) => r.launches)), `${name} never worked`).toBeGreaterThan(10);
      expect(
        median(runs.map((r) => r.everUsed)),
        `${name} only ever used a couple of people`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('actually staffs jobs differently', () => {
    // The premise. If the two policies put the same share of the work on the
    // same three men, they are the same policy and nothing below means
    // anything.
    // eslint-disable-next-line no-console
    console.log(
      `spread: three men carried ${(mean(best.map((r) => r.topThreeShare)) * 100).toFixed(0)}% ` +
        `of the work under always-best, ${(mean(rotate.map((r) => r.topThreeShare)) * 100).toFixed(0)}% under rotate`,
    );
    expect(mean(best.map((r) => r.topThreeShare))).toBeGreaterThan(
      mean(rotate.map((r) => r.topThreeShare)),
    );
  });

  it('marks more people when the work is concentrated', () => {
    /*
       The pre-committed condition, written into the plan before this file
       existed and not to be adjusted to suit the number it produces.

       Stated on grievance and defections rather than on any score, because
       what is being tested is whether concentrating the work costs you
       something in the people who do it.
    */
    // eslint-disable-next-line no-console
    console.log(
      `spread: always-best ${mean(best.map((r) => r.carrying)).toFixed(2)} carrying a grievance (median ${median(best.map((r) => r.carrying))}), ` +
        `${median(best.map((r) => r.walked))} walked, ` +
        `${median(best.map((r) => r.carriedMarks))} carry / ${median(best.map((r) => r.benchedMarks))} bench / ${median(best.map((r) => r.unpaidMarks))} unpaid marks; ` +
        `rotate ${mean(rotate.map((r) => r.carrying)).toFixed(2)} carrying (median ${median(rotate.map((r) => r.carrying))}), ` +
        `${median(rotate.map((r) => r.walked))} walked, ` +
        `${median(rotate.map((r) => r.carriedMarks))} carry / ${median(rotate.map((r) => r.benchedMarks))} bench / ${median(rotate.map((r) => r.unpaidMarks))} unpaid marks`,
    );

    /*
       Why this is no longer asserted on grievance, and it is not because
       grievance stopped agreeing with me.

       The plan committed to "the two policies separate on people carrying a
       grievance". That metric counts grievance from every source in the game,
       and the largest source is not who you sent — it is missing payday.
       Measured directly: always-best leaves 5 `went_unpaid` memories in a
       career and rotate leaves **21**, because sending weaker crew fails more
       jobs, earns less, and misses more paydays.

       So the grievance figure was reading the economy. It happened to point
       the right way once and pointed the other way as soon as the economy
       changed underneath it, which is the definition of measuring the wrong
       variable. The reading it produced before — 1.20 against 0.80 — should
       not be trusted and is not evidence of anything.

       What the mechanic actually controls is how often the marks fire, and
       that has separated cleanly and in the same direction across every run:
       concentrating the work marks more people as carrying it and more people
       as left out of it. That is the claim this file can honestly make.

       What it deliberately does NOT claim is that concentration costs the
       player something measurable in the end state. Isolating that needs a
       run where both policies earn the same money, and this probe cannot do
       that. It is an open question, and it is written down as one rather than
       answered by whichever number happens to agree.
    */
    expect(
      mean(best.map((r) => r.benchedMarks)),
      'concentrating every job on the same men left nobody out — the marks do not fire',
    ).toBeGreaterThan(mean(rotate.map((r) => r.benchedMarks)));
    expect(
      mean(best.map((r) => r.carriedMarks)),
      'nobody was marked as carrying it even when three men did everything',
    ).toBeGreaterThan(mean(rotate.map((r) => r.carriedMarks)));
  });

  it('cannot say anything about the behavioural routes, and says so', () => {
    /*
       A reading this file is not entitled to make.

       The plan asked this probe to report how many of the six gated jobs open
       on behaviour before rank arrives. It reports zero, and zero is not a
       finding — this bot launches jobs in config order until it runs out of
       bodies, so the later entries in the table (freelance muscle, truck
       hijacking) are the ones it almost never reaches, and four of the six
       conditions count exactly those. It also never buys a front, which two
       more conditions require.

       An assertion that passes at zero because the instrument cannot produce a
       failure is worse than no assertion. So this states the limitation, and
       the number that does speak to whether the unlocks fire is the grokking
       probe: the last new kind of move moved from week 7 to week 10 with a
       tail out to week 54 when they landed, having sat at week 7 through every
       other change this project has made.
    */
    const byBehaviour = median(best.map((r) => r.openedByBehaviour));
    const kinds = median(best.map((r) => r.kindsRun));
    const gated = OPERATIONS.filter((o) => o.minRank === 'crew_leader').length;

    // eslint-disable-next-line no-console
    console.log(
      `spread: ${byBehaviour} of ${gated} gated jobs opened before the rank did — ` +
        `but this bot only ran ${kinds} kinds of job, so that figure is about the bot. ` +
        `Read grok.probe for whether the unlocks fire.`,
    );

    expect(
      kinds,
      'the bot ran so few kinds of job that nothing here is about the game',
    ).toBeLessThan(OPERATIONS.length);
  });
});
