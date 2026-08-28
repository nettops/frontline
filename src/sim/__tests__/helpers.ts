/**
 * Shared test helpers.
 */

import { Rng } from '../rng';
import { advanceDay } from '../clock';
import { resolveEvent } from '../events';
import { crewList } from '../npc';
import type { Business, GameState, Npc } from '../types';
import { acquireBusiness, canAcquire } from '../business';
import { BUSINESSES } from '../../config/businesses';
import { CONTROL_THRESHOLDS, SENTIMENT_HOSTILE_BELOW } from '../../config/territories';

/**
 * Answers every pending event with its first open choice.
 *
 * grok.probe's bot models a curious player rather than an optimiser: it takes
 * every kind of move open to it rather than hunting for the cheapest, so the
 * record of what it did is a record of what the game was offering. Also the
 * default drain for `runDays`/`runDaysSolvent` below — it was a third inline
 * copy of this exact loop before this existed.
 */
export function answerFirst(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.pendingEvents.length && guard++ < 20) {
    const e = state.pendingEvents[0];
    const pick = e.choices.find((c) => !c.disabledReason) ?? e.choices[0];
    resolveEvent(state, rng, e.id, pick.id);
  }
}

/** A day's play, for the `onDay` hook below. `rng` is whichever one the run is using. */
type DayFn = (state: GameState, day: number, rng: Rng) => void;

interface RunDaysOptions {
  /** How to answer each day's events. Defaults to `answerFirst`. */
  answer?: (state: GameState, rng: Rng) => void;
  /** Runs once per day, after events are answered and before the day advances. */
  onDay?: DayFn;
}

/**
 * Advances `days` days, answering any event that comes up.
 *
 * Use this instead of `advanceDays` whenever a test means to cover a long
 * span. `advanceDays` deliberately stops the moment a new event needs the
 * player — correct for the UI, quietly disastrous in a test, where it turns
 * "run two years" into "run until the first thing happens", often two days.
 * Several invariant tests were doing exactly that before this existed.
 *
 * `options.onDay` is for a probe with its own per-day play — recruiting,
 * launching operations, whatever it's testing — so it doesn't have to
 * reimplement the surrounding loop, the event drain, and the gameOver guard
 * to get one. Omit it and this is exactly what it always was.
 */
export function runDays(
  state: GameState,
  days: number,
  rng = new Rng(state.rng),
  options?: RunDaysOptions,
): number {
  const answer = options?.answer ?? answerFirst;
  for (let i = 0; i < days; i++) {
    answer(state, rng);
    options?.onDay?.(state, i, rng);
    advanceDay(state);
    if (state.gameOver) return i + 1;
  }
  return days;
}

/**
 * Advances `days` while keeping the player solvent, so the world keeps
 * turning. For testing what happens around the player rather than to them.
 *
 * `options.floor` is the cash floor — 1,000,000 unless a probe needs its own,
 * because "keep it solvent" doesn't mean the same amount to every bot. See
 * `runDays` for `onDay`.
 */
export function runDaysSolvent(
  state: GameState,
  days: number,
  options?: RunDaysOptions & { floor?: number },
): number {
  const rng = new Rng(state.rng);
  const floor = options?.floor ?? 1_000_000;
  const answer = options?.answer ?? answerFirst;
  for (let i = 0; i < days; i++) {
    state.org.cash = Math.max(state.org.cash, floor);
    answer(state, rng);
    options?.onDay?.(state, i, rng);
    advanceDay(state);
    if (state.gameOver) return i + 1;
  }
  return days;
}

/**
 * Middle value of a sample.
 *
 * The default statistic for every population this project reports. These
 * careers have a long right tail — F15 says the economy forks on fronts, and a
 * quarter of them run away with it — so the mean describes a family nobody
 * plays.
 *
 * **Never put a median and a `mean` in the same expression.** A readout in
 * `ladder.probe` subtracted a per-career mean of the wash cut from a median of
 * sales and reported the difference as a ledger; the cut line was overstated by
 * $30,577 and the mistake was invisible because both were dollars. If a line
 * needs both, print them as separate figures and label each.
 */
export function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/**
 * Arithmetic mean of a sample.
 *
 * Here so that a probe never has to write `total / RUNS.length` inline — which
 * is how a mean ends up in a line of medians without anybody noticing what
 * changed. Use it when the quantity genuinely wants totalling across the
 * population (money the whole population lost to something, weeks summed over
 * careers) and say "mean" wherever the number is printed.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The median of a per-career difference, against the same seed in another arm.
 *
 * **The only valid way to compare two probe arms.** Arms are separate
 * simulations that diverge at the first decision a policy changes, so their
 * populations are not the same worlds and a median-to-median difference is two
 * distributions quoted side by side. Measured: `RUNS_BOOKS` read $359,270
 * lower sales than `RUNS_TRADING` on the medians while stock spend was flat —
 * a difference neither arm's policy can produce. Paired, the same figure is
 * zero.
 *
 * `arm` and `against` must be built from the same seed list, in the same order.
 *
 * `participated` is the second half of the rule and is not optional in
 * practice: **restrict the pairs to careers that actually used the thing.** A
 * gap measured across a population containing non-participants mixes adoption
 * into the effect size and measures neither. Three bars in `ladder.probe` were
 * placed that way and all three had to be repointed — the plant's take-up read
 * 7 of 36 built when the game had offered one to 16, the plant's volume median
 * could not see a seven-career effect at all, and the launderer's rate read
 * 18.4% because nine careers that never hired anybody sat in the average at
 * 22.8%. Leave it out only when every career in the arm is a participant by
 * construction.
 */
export function pairedGap<T>(
  arm: T[],
  against: T[],
  pick: (row: T) => number,
  participated?: (row: T) => boolean,
): number {
  const n = Math.min(arm.length, against.length);
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) {
    if (participated && !participated(arm[i])) continue;
    gaps.push(pick(arm[i]) - pick(against[i]));
  }
  return gaps.length ? median(gaps) : 0;
}

/**
 * Answers every pending event with its cheapest open choice.
 *
 * The honest model of somebody trying not to go broke, and the policy a
 * player under financial pressure actually follows. Taking the first enabled
 * choice instead answers "send a real lawyer, $20,000" on a treasury of nine
 * hundred dollars, then reports the empty drawer as a flaw in the game.
 *
 * Was five byte-identical copies across the probe files before this. spread.
 * probe keeps its own — its header says why — everything else routes here.
 */
export function answerCheaply(state: GameState, rng: Rng): void {
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

/** Crew members free to be sent on something. */
export function idle(state: GameState): Npc[] {
  return crewList(state).filter((n) => n.status === 'active');
}

/**
 * Expected money per crew-day: payout times odds, over the time it locks up.
 *
 * Solo work occupies you rather than a crew member, so it is costed as one
 * body for the purpose of comparing it against everything else. Without the
 * floor, a zero-crew job (`work_it_yourself`) divides by zero and sorts first
 * unconditionally — the bug one uncoupled copy of this function carried.
 */
export function ev(o: {
  payout: [number, number];
  baseSuccess: number;
  crewRequired: number;
  durationDays: number;
}): number {
  const bodies = Math.max(1, o.crewRequired);
  return (((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess) / (bodies * o.durationDays);
}

/**
 * Gives the outfit `count` working fronts, however many districts that takes.
 *
 * The trades used to open on rank, so a test that wanted to reach one wrote
 * `state.player.rank = 'capo'` and moved on. They open on fronts now — the
 * product trade wants two and the arms trade three — and a front needs a
 * district that will sell into it, so "grant the prerequisite" stopped being
 * one line. This is that line again, in one place, rather than the same
 * fifteen copied into every trade test.
 *
 * Returns what it managed to open, which will be short of `count` if the map
 * has run out of room. Callers that depend on the number should assert on it.
 */
export function withFronts(state: GameState, count: number): Business[] {
  const made: Business[] = [];
  /*
     Districts the player already holds come first, and nothing is nudged
     further than the sale itself requires.

     The first version set `influence.player = 80` on whatever district came to
     hand, which is Dominance — and `supplyTrust.test.ts` promptly stopped
     measuring what it was written to measure, because a route out of a
     dominated district moves several times the product and draws the
     attention to match. A fixture that grants a precondition has to grant only
     that precondition.
  */
  const ordered = Object.values(state.territories).sort(
    (a, b) => (b.influence.player ?? 0) - (a.influence.player ?? 0),
  );
  for (const t of ordered) {
    if (made.length >= count) break;
    for (const def of BUSINESSES) {
      if (made.length >= count) break;
      const floor = CONTROL_THRESHOLDS.find((c) => c.level === def.minControl)?.min ?? 0;
      const before = { influence: t.influence.player ?? 0, sentiment: t.sentiment };
      t.influence.player = Math.max(before.influence, floor);
      t.sentiment = Math.max(before.sentiment, SENTIMENT_HOSTILE_BELOW + 1);

      const check = canAcquire(state, def.id, t.id);
      if (!check.ok) {
        // Only the price is worth papering over. Anything else is the game
        // saying no for a reason a fixture has no business overriding.
        if (!/short\.$/.test(check.reason ?? '')) {
          t.influence.player = before.influence;
          t.sentiment = before.sentiment;
          continue;
        }
        state.org.dirtyCash += check.cost;
      }
      const opened = acquireBusiness(state, def.id, t.id);
      if (opened) made.push(opened);
      else {
        t.influence.player = before.influence;
        t.sentiment = before.sentiment;
      }
    }
  }
  return made;
}
