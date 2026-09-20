/**
 * The Approve click must not spend the offer.
 *
 * Round 30's MUST FIX 1, panel half. `OperationsPanel`'s `approve` called
 * `approvePitch` on the click, which took the pitch off the board before the
 * job existed; Cancel, another tab or a second Approve then lost it silently.
 * The panel now only remembers which pitch the assemble screen was opened
 * for, and the launch settles it (`launchPitched`, tested in
 * `sim/__tests__/pitchLaunch.test.ts`).
 *
 * Guarded against raw source in the idiom `statesShown.test.ts` uses, with the
 * commentary stripped first — every repair here is explained in a comment
 * above the code that makes it, and those comments quote the calls they are
 * about.
 */
import { describe, expect, it } from 'vitest';
import operations from '../panels/OperationsPanel.tsx?raw';

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const ops = code(operations).replace(/\s+/g, ' ');

/** Everything from `const approve = ` to the arrow function's closing `};`. */
const approveBody = /const approve = \(([^)]*)\) => \{(.*?)\};/.exec(ops)?.[2] ?? '';

describe('a pitch that has been approved but not launched', () => {
  it('is still there: the Approve click does not settle it', () => {
    expect(approveBody, 'the approve handler is gone or renamed').not.toBe('');
    expect(approveBody).not.toMatch(/approvePitch/);
  });

  it('remembers which pitch the assemble screen was opened for', () => {
    expect(approveBody).toMatch(/setAssemblingPitchId\(pitchId\)/);
  });

  it('is settled by the launch, not by anything before it', () => {
    expect(ops).toMatch(/launchPitched\(/);
    // The only remaining call is inside the sim helper; the panel never
    // spends a pitch on its own.
    expect(ops).not.toMatch(/approvePitch\(/);
  });

  it('is not carried onto a job picked by hand', () => {
    const chooseBody = /const choose = \(([^)]*)\) => \{(.*?)\};/.exec(ops)?.[2] ?? '';
    expect(chooseBody, 'the choose handler is gone or renamed').not.toBe('');
    expect(chooseBody).toMatch(/setAssemblingPitchId\(null\)/);
  });
});

describe('a pitched job that is being cased', () => {
  it('says so on the card, so the offer does not look like it has gone', () => {
    expect(ops).toMatch(/Casing in progress/);
  });
});
