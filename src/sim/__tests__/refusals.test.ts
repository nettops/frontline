/// <reference types="vite/client" />
/**
 * A refusal gated on a number has to say the number.
 *
 * This is the most expensive recurring defect in the project, measured in
 * rounds rather than in bugs. `canAcquire` refused every front in a district
 * with "Nobody in Little Sicily will sell to you right now" while its three
 * sibling refusals in the same function each named their exact requirement.
 * Round 7 lost ninety days to it, round 11 reported it in almost the same
 * words, round 12 lost two hundred days and its career to it, and three
 * separate repairs — a tooltip on another panel, a banner reordering, a
 * rewritten header — each landed somewhere other than the sentence.
 *
 * A blind round is a bad way to find this. It costs about ninety minutes and it
 * only finds the instance the tester happened to walk into. The property is
 * textual and the check is cheap, so it belongs here, running on every commit,
 * on every refusal in the tree at once.
 *
 * What it looks for, and what it deliberately does not. A guard that compares
 * something against a named constant is a threshold, and a player who trips one
 * needs to know where the bar is and where they are. A guard that does not —
 * "They are in a cell. There is no back room to sit in." — is a state, and a
 * number would be noise. So the rule is narrow on purpose: only branches whose
 * *condition* names a constant, and only refusals, never the success paths.
 *
 * It is a heuristic over source text, not a type system. When it is wrong, the
 * fix is to make the detector sharper or to say the number anyway — never to
 * add an entry to a list of things allowed to stay silent. There is no such
 * list, and there should not be one: this defect has survived four rounds by
 * being individually excusable every single time.
 */
import { describe, expect, it } from 'vitest';
import { newGame } from '../state';
import { Rng } from '../rng';
import { crewList } from '../npc';
import { EVENT_DEF_BY_ID } from '../events';
import { formatMoney } from '../util';

const SOURCES = import.meta.glob('../*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * A comparison, and a named constant somewhere in the same condition.
 *
 * Deliberately not "the constant sits next to the operator". The first version
 * required adjacency and walked straight past
 * `funds < priced(state, WORKSHOP.cost)` — the same defect wrapped in a call,
 * which is how most of the money checks in this codebase are written. It found
 * six refusals and missed three more of exactly the kind it was built for.
 *
 * A detector with a blind spot shaped like the thing it hunts is HANDOFF §3's
 * whole subject, and this one had one for about ten minutes.
 */
const COMPARISON = /[<>]=?/;
const NAMED_CONSTANT = /\b[A-Z][A-Z0-9_]{2,}\b|\b[A-Z][A-Za-z]*\.[a-zA-Z]+/;
const THRESHOLD = {
  test: (line: string) => COMPARISON.test(line) && NAMED_CONSTANT.test(line),
};

/** The refusal's text, however this file happens to spell the field. */
const REFUSAL_TEXT = /(reason|message)\s*:\s*(`|')/;

/** Says no. `...none` is the shorthand two files use for a rejected check. */
const IS_REFUSAL = /ok:\s*false|\.\.\.none/;

/**
 * A figure — a literal digit, or an interpolation that is carrying one.
 *
 * The first version accepted any `${...}` at all, on the reasoning that most
 * refusals name their number by interpolating it. It was wrong in the way this
 * project keeps being wrong: the very string it was written to catch,
 * "Nobody in ${territoryDef(t.id).name} will sell to you right now", passed —
 * because it interpolates a *district name*. The check went green with F10
 * reinstated, and was found only by reinstating it on purpose.
 *
 * So an interpolation counts only when what is inside it looks like a quantity:
 * a named constant, a rounding, or a length. HANDOFF §3, instance 23, and the
 * first one that was an instrument built to prevent §3.
 */
const NAMES_A_NUMBER =
  /\d|\$\{[^}]*(?:[A-Z][A-Z0-9_]{2,}|Math\.round|Math\.max|Math\.min|\.length)/;

interface Silent {
  where: string;
  condition: string;
  text: string;
}

function silentRefusals(): Silent[] {
  const found: Silent[] = [];
  for (const [path, source] of Object.entries(SOURCES)) {
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const condition = lines[i];
      if (!/\bif\s*\(/.test(condition) || !THRESHOLD.test(condition)) continue;

      // The refusal belongs to this guard only if it is inside it, so look a
      // short way ahead and stop at the first one.
      for (let j = i; j < Math.min(i + 12, lines.length); j++) {
        if (!REFUSAL_TEXT.test(lines[j])) continue;
        /*
           The window runs from the guard, not from the refusal text.

           It used to start at the `reason:` line and look forward, and `ok:
           false` is written *above* the reason in every multi-line return in
           this codebase — so no multi-line refusal was ever recognised as one,
           and the check silently examined only the single-line cases. Second
           fault of this kind in this file inside ten minutes; both were found
           by reinstating a real defect and watching for red.
        */
        const chunk = lines.slice(i, j + 4).join(String.fromCharCode(10));
        if (IS_REFUSAL.test(chunk) && !NAMES_A_NUMBER.test(chunk)) {
          found.push({
            where: `${path.replace('../', 'src/sim/')}:${i + 1}`,
            condition: condition.trim(),
            text: lines[j].trim(),
          });
        }
        break;
      }
    }
  }
  return found;
}

describe('refusals name the number they are enforcing', () => {
  it('reads the source it is asserting about', () => {
    // The check is worthless if the glob silently matches nothing, which is
    // exactly how this project's instruments have failed twenty-two times.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    expect(Object.values(SOURCES).join('').length).toBeGreaterThan(100_000);
  });

  it('finds the guards it is supposed to find', () => {
    // A detector that matches nothing would pass the real assertion below
    // while measuring nothing at all. This proves it can still see a threshold.
    const guards = Object.values(SOURCES)
      .flatMap((s) => s.split('\n'))
      .filter((l) => /\bif\s*\(/.test(l) && THRESHOLD.test(l));
    expect(guards.length).toBeGreaterThan(30);
  });

  it('leaves nobody guessing where the bar is', () => {
    const silent = silentRefusals();
    const report = silent
      .map((s) => `\n  ${s.where}\n    guard: ${s.condition}\n    says:  ${s.text}`)
      .join('');
    expect(silent, `refusals gated on a threshold that never name it:${report}\n`).toEqual([]);
  });
});

/*
   The class the scanner above cannot see, found by round 14.

   Every priced memo option puts its figure in `hint` and its refusal in
   `disabledReason`, and `MemoModal` renders `disabledReason ?? hint` — so the
   price is thrown away at exactly the moment the player cannot pay it. Round
   14 hit it five times across four memo families and proved it from the DOM:
   the element contained the words "You cannot cover it" and no number
   anywhere, while the same option printed "$6,000 — cheaper, and it buys back
   some ground" whenever the money was there.

   `refusals.test.ts` was written to prevent precisely this and did not, for a
   reason worth writing down: it looks for a threshold comparison and a refusal
   string in the same few lines, and this refusal is produced by a *shared
   helper* with the amount arriving as an argument. There is no comparison
   against a named constant at the site to find. A scanner that reads guards
   cannot see a guard that has been factored out.

   So this half is behavioural. It builds the events rather than reading them.
*/
describe('a priced refusal still names its price', () => {
  /** A broke organization with somebody unhappy enough to raise things. */
  function destitute() {
    const state = newGame({ name: 'Broke', difficulty: 'normal', seed: 77 });
    state.org.cash = 0;
    state.org.dirtyCash = 0;
    state.org.holdings = 0;
    for (const npc of crewList(state)) {
      npc.stats.grievance = 90;
      npc.stats.ambition = 90;
      npc.stats.loyalty = 5;
      npc.daysInCrew = 60;
    }
    return state;
  }

  /** Every choice any event would show this state, with the cost it carries. */
  function pricedChoices() {
    const state = destitute();
    const rng = new Rng(state.rng);
    const out: {
      event: string;
      label: string;
      hint?: string;
      cost: number;
      refusal?: string;
    }[] = [];
    for (const def of Object.values(EVENT_DEF_BY_ID)) {
      const ctx = def.applies(state, rng);
      if (!ctx) continue;
      for (const choice of def.build(state, rng, ctx).choices) {
        if (!choice.cost) continue;
        out.push({
          event: def.id,
          label: choice.label,
          hint: choice.hint,
          cost: choice.cost,
          refusal: choice.disabledReason,
        });
      }
    }
    return out;
  }

  it('finds priced options to assert about', () => {
    // The instrument first. An empty list would pass the test below in silence.
    expect(pricedChoices().length, 'no priced memo option was raised at all').toBeGreaterThan(0);
  });

  /*
     Stated as what the player can read, not as which field carries it.

     Some events put the figure in the label ("Pay them — $2,328") and some
     leave it to the hint, and both are fine — `MemoModal` now renders the
     refusal *and* the hint rather than one replacing the other, so whichever
     one holds the number, the number is on the screen. What must never happen
     again is a refused option where neither does.

     The second half is the one round 14 actually wanted: being told you cannot
     cover it is useless without knowing whether you are $50 or $20,000 short.
  */
  it('never refuses an option without saying what it would have cost', () => {
    const silent = pricedChoices().filter(
      (c) => c.refusal && !`${c.label} ${c.hint ?? ''}`.includes(formatMoney(c.cost)),
    );

    expect(
      silent,
      'a blocked option must still name its price — being broke is when the number matters most:' +
        String.fromCharCode(10) +
        silent
          .map((c) => `  ${c.event}: "${c.label}" costs ${formatMoney(c.cost)} but shows no figure`)
          .join(String.fromCharCode(10)),
    ).toEqual([]);
  });

  it('says what you have when it refuses you for money', () => {
    const refused = pricedChoices().filter((c) => c.refusal);
    expect(refused.length, 'nothing was refused, so nothing was asserted').toBeGreaterThan(0);

    // Everything here was built against an organization holding nothing.
    const vague = refused.filter((c) => !c.refusal!.includes(formatMoney(0)));
    expect(
      vague,
      'the refusal has to say how short you are, not that you are short:' +
        String.fromCharCode(10) +
        vague.map((c) => `  ${c.event}: "${c.refusal}"`).join(String.fromCharCode(10)),
    ).toEqual([]);
  });
});
