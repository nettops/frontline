/**
 * A state the player is in that no screen named.
 *
 * Round 29's Part 2 findings are four of these and they share one shape: the
 * simulation knew something, the rule was correct, and nothing on any panel
 * said it. A poverty exemption that quietly stops charging you respect is
 * indistinguishable from a penalty you never noticed. An empty job table at
 * Crew Leader reads as a broken screen rather than as a promotion. Unspent
 * attribute points sit at the bottom of a long page and never announce
 * themselves.
 *
 * Plus two lines that said the opposite of what the choice does — the same
 * class of defect as rule 3, only in the copy rather than the number.
 *
 * Guarded against raw source in the idiom `sopranoControls.test.ts` and
 * `refusalShown.test.ts` established, with the commentary stripped first:
 * every repair in this project is explained in a comment above the code that
 * makes it, and those comments quote the strings they are about.
 */
import { describe, expect, it } from 'vitest';
import operations from '../panels/OperationsPanel.tsx?raw';
import finances from '../panels/FinancesPanel.tsx?raw';
import player from '../panels/PlayerPanel.tsx?raw';
import events from '../../sim/events.ts?raw';
import eventgen from '../../sim/eventgen.ts?raw';
import business from '../../sim/business.ts?raw';

/** The file with its commentary taken out. See the header. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* Collapsed as well as stripped: JSX wraps a sentence over three lines and a
   regexp for the sentence should not have to know where the wraps landed. */
const flat = (src: string): string => code(src).replace(/\s+/g, ' ');

const ops = flat(operations);
const fin = flat(finances);
const you = flat(player);

describe('being broke, named on the screen that prices it', () => {
  it('tells a seated boss that street work is excused while he is under the line', () => {
    expect(ops).toMatch(/handsOnPovertyExemptionFunds/);
    expect(ops).toMatch(/without the loss of standing/i);
  });

  it('reads the same threshold the sim charges on, not a copy of the number', () => {
    // A literal 2500 here is a second copy of `TRIBUTE.handsOnPovertyExemptionFunds`.
    expect(ops).not.toMatch(/2[,_]?500/);
  });

  it('warns in Finances when the wallet cannot reach the next payday', () => {
    expect(fin).toMatch(/weeklyWageBill\(state\)/);
    expect(fin).toMatch(/start leaving unpaid/i);
  });
});

describe('an empty board at a rank that no longer works corners', () => {
  it('says why there is nothing there instead of rendering bare headers', () => {
    expect(ops).toMatch(/open\.length === 0/);
    expect(ops).toMatch(/Somebody else's hands do that kind of thing now/);
  });
});

describe('points nobody spent', () => {
  it('announces unspent attribute points at the top of the page', () => {
    const head = you.slice(you.indexOf('export default function PlayerPanel'));
    expect(head).toMatch(/left > 0/);
    expect(head).toMatch(/unspent attribute/);
    // And says where to put them, or it is a number with nowhere to go.
    expect(head).toMatch(/What you are made of/);
  });
});

describe('copy that said the opposite of what the choice does', () => {
  it('does not describe refusing an extortion demand as paying somebody off', () => {
    expect(events).not.toMatch(/The neighbourhood watches you pay somebody off/);
    expect(events).toMatch(/watches you stand your ground/);
  });

  it('says hearing somebody out happened at all', () => {
    const branch = /case 'gen_wants_a_word':[\s\S]*?case 'gen_bad_blood':/.exec(eventgen);
    expect(branch, 'the branch is gone or renamed').not.toBeNull();
    expect(branch?.[0]).toMatch(/heard them out\.`, 'crew'\)/);
  });

  it('does not tell the player put-away money cannot buy a front', () => {
    expect(fin).toMatch(/remains available as capital for a business front/i);
  });
});

describe('money printed as money', () => {
  it('rounds the laundering line rather than showing cents', () => {
    const line = /Businesses took in[\s\S]*?'money',/.exec(business);
    expect(line, 'the laundering log line is gone or renamed').not.toBeNull();
    expect(line?.[0]).not.toMatch(/\$\$\{(?!Math\.round)/);
  });
});
