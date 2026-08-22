/**
 * A test harness for the people who play this game with a script.
 *
 * Round 7 took 213 tool calls and forty-four minutes, and almost none of that
 * was the game thinking. It was the shape of the conversation: click, read the
 * page back, decide, click again, with every observation costing a whole turn.
 * Two of the three defects that round found came from deliberately repeating
 * one action, not from playing — so the expensive part was the part that
 * taught us least.
 *
 * This collapses the mechanical half. `read()` answers "what is on screen"
 * once instead of three times, and `run()` performs a whole sequence and
 * reports what changed.
 *
 * ## Two rules it will not break
 *
 * **It clicks the real thing.** Every action here finds a real element by its
 * visible text and dispatches a real `MouseEvent`. Nothing calls into the
 * store, nothing sets state directly. If a button is disabled, the harness
 * fails the step and says so, exactly as a person would find it. A harness
 * that reached past the interface would be testing a game nobody plays.
 *
 * **It reads the DOM, never the state.** Half of this game is what it declines
 * to tell you — `perceive()` puts a fog over every stat on every person, and
 * the whole design rests on it. A reader that dumped `GameState` would hand a
 * tester the true numbers and quietly delete the thing being evaluated. So
 * this reads text off the page like a reader does, and knows nothing the
 * screen is not saying.
 *
 * ## What it is not for
 *
 * Batching the *first* visit to a screen. The value of a blind playtest is
 * somebody noticing that a panel is confusing, and a panel nobody looked at
 * cannot be confusing. Batch the tenth job assignment, never the first.
 */

import { NAMESPACE } from '../storage';
import { COUNTER_MS } from '../ui/motion';

// ------------------------------------------------------------------ types ---

export interface Snapshot {
  /** Storage namespace, so a run can prove it is not on somebody's save. */
  namespace: string;
  /** The stat bar, as label → text, exactly as rendered. */
  bar: Record<string, string>;
  /** Heading of the panel currently open. */
  panel: string | null;
  /** Title of whatever is demanding an answer, if anything. */
  modal: string | null;
  /** Left-hand navigation, with its badge counts. */
  nav: { label: string; badge: string | null; current: boolean }[];
  /** Every enabled control, by the text a person would click. */
  actions: string[];
  /** Every control that is present and refused, with the reason it gives. */
  refused: { label: string; why: string | null }[];
  /** Tables on the page, keyed by their heading, as records. */
  tables: Record<string, Record<string, string>[]>;
  /** The most recent log lines, newest first. */
  log: string[];
}

export type Step =
  /** Open a panel from the left-hand navigation. */
  | { go: string }
  /** Click a button by its visible text. */
  | { click: string }
  /** Click a table row containing this text, optionally within one table. */
  | { row: string; in?: string }
  /** Set a range or text input, found by the label nearest to it. */
  | { set: string; value: number | string }
  /** Advance the clock using the real buttons. */
  | { advance: 'day' | 'week' | 'month'; times?: number }
  /** Answer whatever memo is open, by the text of the choice. */
  | { answer: string }
  /** Let the page settle. Rarely needed; every step already waits. */
  | { settle: number };

export interface StepResult {
  step: Step;
  ok: boolean;
  /** Why it could not be done, in the words the interface used. */
  note?: string;
}

export interface RunResult {
  steps: StepResult[];
  /** Stopped early because a step failed. */
  stoppedAt: number | null;
  /** What moved in the stat bar across the whole sequence. */
  changed: Record<string, { from: string; to: string }>;
  /** Log lines that appeared during the run, oldest first. */
  happened: string[];
  after: Snapshot;
}

// ----------------------------------------------------------------- reading ---

const text = (el: Element | null | undefined): string =>
  (el instanceof HTMLElement ? el.innerText : (el?.textContent ?? '')).replace(/\s+/g, ' ').trim();

const visible = (el: Element): boolean => {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  return !!r && (r.width > 0 || r.height > 0);
};

function readTables(): Record<string, Record<string, string>[]> {
  const out: Record<string, Record<string, string>[]> = {};
  document.querySelectorAll('table').forEach((table, i) => {
    /*
       Named by the panel it sits in, which is what a person would call it.

       `closest('div')` finds the innermost wrapper, which in this app is a
       `.table-wrap` two levels below the panel and has no heading in it. The
       panel is the thing with a `.panel-title`, so ask for that specifically.
    */
    const panel = table.closest('.panel') ?? table.closest('section');
    const heading = panel?.querySelector('.panel-title, h1, h2, h3');
    const name = text(heading) || `table ${i + 1}`;
    const keys = [...table.querySelectorAll('thead th')].map((th) => text(th) || '?');
    const rows: Record<string, string>[] = [];
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = [...tr.querySelectorAll('td')];
      if (!cells.length) return;
      const row: Record<string, string> = {};
      cells.forEach((td, c) => {
        row[keys[c] || `col${c + 1}`] = text(td);
      });
      rows.push(row);
    });
    if (rows.length) out[name] = rows;
  });
  return out;
}

/**
 * The stat bar, read as pairs.
 *
 * Deliberately generic — it walks whatever the bar renders rather than naming
 * the fields, so a new stat appears here the day it appears on screen and
 * nobody has to remember to update a harness.
 */
function readBar(): Record<string, string> {
  const bar: Record<string, string> = {};
  document.querySelectorAll('header .stat').forEach((el) => {
    const key = text(el.querySelector('.stat-label'));
    const val = text(el.querySelector('.stat-value'));
    if (key && val) bar[key] = val;
  });
  const rank = text(document.querySelector('.statbar-rank'));
  if (rank) bar['Rank'] = rank;
  const day = text(document.querySelector('.clock-day'));
  if (day) bar['Day'] = day.replace(/^Day\s*/i, '');
  const date = text(document.querySelector('.clock-date'));
  if (date) bar['Date'] = date;
  if (Object.keys(bar).length === 0) {
    /*
       Degrade loudly rather than going silent.

       If the markup is renamed this returns the whole header as one string,
       which is ugly and obviously wrong — better than an empty object that
       reads as "the stat bar is empty" and quietly breaks every `changed`
       comparison in a run.
    */
    const header = document.querySelector('header');
    if (header) bar['header (unparsed)'] = text(header);
  }
  return bar;
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(visible) as HTMLButtonElement[];
}

export function read(): Snapshot {
  const nav = [...document.querySelectorAll('nav button, .rail button, aside button')]
    .filter(visible)
    .map((b) => ({
      label: text(b).replace(/\s*\d+$/, '').trim(),
      badge: text(b).match(/(\d+)$/)?.[1] ?? null,
      current: b.className.includes('current') || b.getAttribute('aria-current') === 'page',
    }));

  const all = buttons();
  const modalEl = document.querySelector('.memo, .modal, [role="dialog"]');

  return {
    namespace: NAMESPACE,
    bar: readBar(),
    panel: text(document.querySelector('.page-title, main h1')) || null,
    modal: modalEl ? text(modalEl.querySelector('h1, h2, h3')) || 'something is open' : null,
    nav,
    actions: all.filter((b) => !b.disabled).map((b) => text(b)).filter(Boolean),
    refused: all
      .filter((b) => b.disabled)
      .map((b) => ({ label: text(b), why: b.title || b.getAttribute('aria-label') })),
    tables: readTables(),
    /*
       `.log-entry` divs, not list items.

       The first version guessed at `li` and `tr` and matched nothing, so
       `read().log` was always empty and `run().happened` — which diffs the log
       to say what a sequence actually caused — silently reported that nothing
       ever happened. A reader that returns an empty array for "the game said
       nothing" and for "I cannot find the log" is worse than no reader.
    */
    log: [...document.querySelectorAll('.log .log-entry')]
      .slice(0, 12)
      .map((el) => text(el.querySelector('.log-text')) || text(el))
      .filter(Boolean),
  };
}

// ----------------------------------------------------------------- acting ---

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Two frames, because React commits after the handler returns and then paints. */
async function settle(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) await frame();
}

/**
 * Wait for the numbers to stop moving before reading any of them.
 *
 * `useCounter` eases every figure in the stat bar to its new value over
 * `COUNTER_MS`, so a read two frames after a click catches the number in
 * flight. The first version of this harness did exactly that and cheerfully
 * reported a clean balance of $2,400 for an account holding $700 — a figure
 * that was on screen, was wrong, and looked entirely plausible.
 *
 * Half a second per sequence, and it buys the difference between a reading and
 * a rumour. A person waits for the number to settle too.
 */
async function stillness(): Promise<void> {
  await settle();
  await pause(COUNTER_MS + 80);
  await settle();
}

/**
 * A real click, on the element a person would have clicked.
 *
 * `HTMLElement.click()` is not enough everywhere in this app — the district map
 * is SVG, and SVG elements ignore it. A dispatched `MouseEvent` with `bubbles`
 * is what a mouse produces and what React's delegated listener hears.
 */
function press(el: Element): void {
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function findButton(label: string): HTMLButtonElement | null {
  const want = norm(label);
  const all = buttons();
  return (
    all.find((b) => norm(text(b)) === want) ??
    all.find((b) => norm(text(b)).includes(want)) ??
    null
  );
}

/**
 * A row, optionally scoped to the table it should be in.
 *
 * The scope is not decoration. The Operations panel lists the same job in
 * "Work available" and again in "Running now" the moment it is launched, and a
 * bare text match takes whichever comes first in the document — which is how a
 * "click the job to set it up" step silently became "click the job you are
 * already doing". Found by using this harness, within a minute of finishing it.
 */
function findRow(needle: string, within?: string): HTMLElement | null {
  const want = norm(needle);
  let scope: ParentNode = document;
  if (within) {
    const wanted = norm(within);
    const panel = [...document.querySelectorAll('.panel')].find((p) =>
      norm(text(p.querySelector('.panel-title, h1, h2, h3'))).includes(wanted),
    );
    if (!panel) return null;
    scope = panel;
  }
  const rows = [...scope.querySelectorAll('tbody tr, .row-click, li')].filter(visible);
  return (rows.find((r) => norm(text(r)).includes(want)) as HTMLElement) ?? null;
}

async function one(step: Step): Promise<StepResult> {
  const fail = (note: string): StepResult => ({ step, ok: false, note });

  if ('settle' in step) {
    await settle(step.settle);
    return { step, ok: true };
  }

  if ('go' in step) {
    const btn = findButton(step.go);
    if (!btn) return fail(`No navigation item reading "${step.go}".`);
    if (btn.disabled) return fail(btn.title || 'That is disabled.');
    press(btn);
    await settle();
    return { step, ok: true };
  }

  if ('click' in step) {
    const btn = findButton(step.click);
    if (!btn) return fail(`Nothing on screen reads "${step.click}".`);
    /*
       A disabled control is a finding, not an obstacle to route around.

       The reason lives in the tooltip, and reporting it is the whole point —
       round 7's most useful moments were a button refusing and explaining why.
    */
    if (btn.disabled) return fail(btn.title || 'That control is refused, with no reason given.');
    press(btn);
    await settle();
    return { step, ok: true };
  }

  if ('row' in step) {
    const row = findRow(step.row, step.in);
    if (!row) {
      return fail(
        step.in
          ? `No row containing "${step.row}" in a table called "${step.in}".`
          : `No row containing "${step.row}".`,
      );
    }
    press(row);
    await settle();
    return { step, ok: true };
  }

  if ('set' in step) {
    const inputs = [...document.querySelectorAll('input, select, textarea')].filter(
      visible,
    ) as HTMLInputElement[];
    /*
       Widening outwards, in the order a person would describe the control.

       Most inputs in this game have no label element and no aria-label — they
       sit in a row beside a figure and a button, inside a panel whose title is
       the only thing naming them. `{set: 'put away'}` failed against the
       holdings slider for exactly that reason: its immediate neighbours read
       "$1,250 Put it away", and "put away" is not a substring of "put it
       away". The panel is what a tester means when they say which slider.
    */
    const want = norm(step.set);
    const inPanel = (i: Element) => {
      const panel = i.closest('.panel');
      return norm(text(panel?.querySelector('.panel-title, h1, h2, h3'))).includes(want);
    };
    const field =
      inputs.find((i) => norm(i.getAttribute('aria-label') ?? '') === want) ??
      inputs.find((i) => norm(text(i.closest('label')) ?? '').includes(want)) ??
      inputs.find((i) => norm(text(i.parentElement)).includes(want)) ??
      inputs.find(inPanel) ??
      (inputs.length === 1 ? inputs[0] : null);
    if (!field) {
      const seen = inputs
        .map((i) => norm(text(i.closest('.panel')?.querySelector('.panel-title'))) || '(unnamed)')
        .join(', ');
      // Naming what *is* there turns a dead end into the next thing to try.
      return fail(`No input near "${step.set}". Inputs found in: ${seen || 'nowhere'}.`);
    }
    /*
       React owns the value, so setting the property is not enough.

       The native setter has to be called on the prototype and then an input
       event dispatched, or React re-renders the old value straight back over
       it. This is the standard workaround and it is not a hack in the harness
       so much as the price of controlled inputs.
    */
    const proto = Object.getPrototypeOf(field);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(field, String(step.value));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    return { step, ok: true };
  }

  if ('answer' in step) {
    const modal = document.querySelector('.memo, .modal, [role="dialog"]');
    if (!modal) return fail('Nothing is waiting for an answer.');
    const want = norm(step.answer);
    const choice = [...modal.querySelectorAll('button, li, .choice')].find((c) =>
      norm(text(c)).includes(want),
    );
    if (!choice) return fail(`No choice reading "${step.answer}".`);
    if (choice instanceof HTMLButtonElement && choice.disabled) {
      return fail(choice.title || 'That choice is not available.');
    }
    press(choice);
    await settle();
    return { step, ok: true };
  }

  // advance
  const label = { day: '+1 day', week: '+1 week', month: '+1 month' }[step.advance];
  const times = step.times ?? 1;
  for (let i = 0; i < times; i++) {
    const btn = findButton(label);
    if (!btn) return fail(`No "${label}" control on screen.`);
    /*
       Stopping here is the correct behaviour, not a limitation.

       The clock refuses while a memo or a sit-down is open, and it says so in
       the tooltip. A harness that clicked past that would be inventing a way
       to play the game that no person has.
    */
    if (btn.disabled) {
      return {
        step,
        ok: false,
        note: `${btn.title || 'The clock is blocked.'} (stopped after ${i} of ${times})`,
      };
    }
    press(btn);
    await settle();
  }
  return { step, ok: true };
}

/**
 * Perform a sequence and report what it did.
 *
 * Stops at the first step that cannot be performed and returns everything up
 * to it, because a sequence written against a screen that turned out to be in
 * a different state should not keep going and do something else.
 */
export async function run(steps: Step[]): Promise<RunResult> {
  await stillness();
  const before = read();
  const logBefore = new Set(before.log);
  const results: StepResult[] = [];
  let stoppedAt: number | null = null;

  for (let i = 0; i < steps.length; i++) {
    const r = await one(steps[i]);
    results.push(r);
    if (!r.ok) {
      stoppedAt = i;
      break;
    }
  }

  await stillness();
  const after = read();
  const changed: Record<string, { from: string; to: string }> = {};
  for (const [k, v] of Object.entries(after.bar)) {
    if (before.bar[k] !== undefined && before.bar[k] !== v) {
      changed[k] = { from: before.bar[k], to: v };
    }
  }

  return {
    steps: results,
    stoppedAt,
    changed,
    happened: after.log.filter((l) => !logBefore.has(l)).reverse(),
    after,
  };
}

// ---------------------------------------------------------------- mounting ---

const HELP = `__frontline — a harness for driving this game with a script.

  read()        what is on screen now: stat bar, panel, tables, actions,
                refused actions with their reasons, and the recent log.

  run(steps)    do a sequence of things and report what changed. Stops at the
                first step that cannot be done and tells you what the interface
                said. Steps:

                  {go: 'Operations'}          open a panel
                  {click: 'Launch'}           press a button by its text
                  {row: 'Gino Rizzo'}         click a table row
                  {row: 'Truck Hijacking', in: 'Work available'}
                                              ...scoped, when the same name is
                                              in two tables at once
                  {set: 'amount', value: 500} put a number in a field
                  {advance: 'week', times: 4} run the clock with the real buttons
                  {answer: 'Do it the slow way'}  answer an open memo
                  {settle: 3}                 wait for the page

It clicks real elements and reads the rendered page. It cannot see anything the
screen is not showing, which is deliberate — most of this game is what it will
not tell you, and a harness that read the game state would delete that.

Do not batch the first visit to a screen. A screen nobody looked at cannot be
reported as confusing.`;

export function mount(): void {
  const api = { read, run, help: () => HELP, namespace: NAMESPACE };
  (window as unknown as { __frontline: typeof api }).__frontline = api;
  // eslint-disable-next-line no-console
  console.info(
    `__frontline harness ready (storage: ${NAMESPACE}). Call __frontline.help() for the vocabulary.`,
  );
}
