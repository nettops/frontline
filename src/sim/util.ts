/**
 * Small shared helpers. Imports types only — and `Rng`, which imports nothing
 * at all — so every system can use it without creating an import cycle.
 */

import { Rng } from './rng';
import type {
  EvidenceTrace,
  GameState,
  Id,
  LogEntry,
  LogKind,
  PendingEvent,
} from './types';

export function nextId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}_${state.nextId}`;
}

/**
 * Records something an investigator could later use. Agencies read these to
 * decide whether they have a case, so anything that would leave a thread for
 * somebody to pull should call this.
 */
export function addEvidence(
  state: GameState,
  trace: Omit<EvidenceTrace, 'id' | 'attachedTo'> & { attachedTo?: Id[] },
): EvidenceTrace {
  const id = nextId(state, 'ev');
  const full: EvidenceTrace = { attachedTo: [], ...trace, id };
  state.evidence[id] = full;
  return full;
}

/** Newest entries first. Trimmed so a long game does not grow unbounded. */
const LOG_LIMIT = 400;

/**
 * One of several ways of saying the same thing, chosen without rolling a die.
 *
 * **Use this and not `rng.pick` for prose.** Determinism here is not the
 * problem — `rng.pick` is perfectly deterministic. The problem is that it
 * *advances the stream*, so a sentence gaining four variants moves every later
 * job outcome, defection check and heat event in the game by one call. The
 * first version of the voice repair did exactly that and `scorecard.probe`
 * watched Difficulty fall from 5.8 to 3.8 — careers ending early went from 56%
 * to 67% — because of a change that only touched words.
 *
 * That is the second time in one session. The nickname roll drew from
 * `state.rng` for the same reason and it took four full `ladder.probe` runs to
 * find, because a text change is the last place anybody looks for a balance
 * regression.
 *
 * `Rng.stableNoise` is the documented way to get a number without touching the
 * stream. The key should name the thing being described and the day, so a
 * replay reads identically and two events on one morning do not pick the same
 * line.
 */
export function say(key: string, day: number, lines: string[]): string {
  if (lines.length === 0) return '';
  return lines[Math.floor(Rng.stableNoise(key, day) * lines.length) % lines.length];
}

export function addLog(state: GameState, text: string, kind: LogKind = 'neutral'): void {
  const entry: LogEntry = { day: state.day, text, kind };
  state.log.unshift(entry);
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

/**
 * Queues an event for the player. Event *definitions* live in events.ts; this
 * is just the plumbing, so any system can raise one without importing the
 * event catalogue and creating a cycle.
 */
export function pushEvent(
  state: GameState,
  event: Omit<PendingEvent, 'id' | 'day'>,
): PendingEvent {
  const full: PendingEvent = { id: nextId(state, 'evt'), day: state.day, ...event };
  state.pendingEvents.push(full);
  return full;
}

// -------------------------------------------------------------- calendar ---

/** The world starts here. Day 1 is this date. */
const EPOCH = Date.UTC(1978, 2, 6);

function dateForDay(day: number): Date {
  return new Date(EPOCH + (day - 1) * 86_400_000);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDay(day: number): string {
  const d = dateForDay(day);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShortDay(day: number): string {
  const d = dateForDay(day);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ----------------------------------------------------------- formatting ---

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** Compact form for tight table cells: $1.2M, $48K. */
export function formatMoneyShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  /*
     Billions, because they are now reachable.

     The largest figure this had ever been shown was a five-figure balance, and
     it stopped at millions — so a long sandbox run rendered "$1250M" in a stat
     bar cell sized for "$48K". Holdings compound at 0.45% a week and the best
     measured four-year estate is $40M, which puts a decade at four digits of
     millions.
  */
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * "a" or "an", chosen by the word that follows.
 *
 * Six sites wrote `a ${ROLE_LABEL[...]}` and three of the seven roles start
 * with a vowel — Associate, Enforcer, Underboss — so half the ladder rendered
 * "as a Associate". Round 11 read it in a promotion memo. The writing is the
 * highest-scoring thing in this project; it should not be let down by a
 * hard-coded article.
 *
 * Deliberately naive: it reads the first letter and nothing else. Every word
 * this is used on is a role or a rank from config, none of which is an
 * "hour" or a "university", and a full heuristic would be a pretend solution
 * to a problem the game does not have.
 */
export function article(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';
}

/** The word with its article already attached. */
export function withArticle(word: string): string {
  return `${article(word)} ${word}`;
}

// ---------------------------------------------------------------- random ---

/** Weighted pick. Returns the id of the chosen entry. */
export function weightedPick<T extends { weight: number }>(
  items: readonly T[],
  roll: number,
): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let target = roll * total;
  for (const item of items) {
    target -= item.weight;
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}
