/**
 * The guard that asks whether a sample can carry its own bar.
 *
 * `helpers.resolves` is rule 4, and the five failures that produced it are
 * listed above the function. This file checks it against those five by their
 * real numbers, because a guard written from the shape of a problem rather
 * than from its instances is a guard that agrees with whatever you were
 * already thinking.
 */
import { describe, expect, it } from 'vitest';
import { resolves } from './helpers';

describe('whether the sample can say it', () => {
  it('refuses a bar finer than one observation', () => {
    /*
       The score-expiry bar, by its real numbers: one expiry attributed to
       going dark, ten expiries in the sample, a bar of 5%. Only zero passes.
    */
    const r = resolves(1, 10, 0.05);
    expect(r.ok).toBe(false);
    expect(r.why).toContain('bar of zero');
    expect(r.why, 'it does not say how many are needed').toMatch(/at least 20/);
  });

  it('refuses a margin inside the sampling error', () => {
    /*
       `informants.probe` before the widening: 3 framed in 20 usable worlds
       against a bar of 5. A ten-point margin against a ten-point error.
    */
    const r = resolves(3, 20, 5 / 20);
    expect(r.ok).toBe(false);
    expect(r.why).toContain('cannot tell them apart');
    /*
       And it has to say which side of the bar the reading sits on. A message
       that reads the same whether a claim is nearly true or nearly false sends
       the reader after a bigger sample in both cases, and only one of them is
       a sample problem.
    */
    expect(r.why, 'the message does not say which side it is on').toContain('under a bar');
  });

  /*
     A bar sitting on its own reading is not the same failure and must not give
     the same advice. The needed-size formula divides by the margin, so this
     case used to emit a number with eighteen digits in it.
  */
  it('does not tell you to widen a sample when widening cannot help', () => {
    const r = resolves(12, 36, 1 / 3);
    expect(r.ok).toBe(false);
    expect(r.why).toContain('the same number');
    expect(r.why, 'it is still offering the sample as the fix').not.toContain('Widen the sample;');
  });

  it('names a sample size that would actually work', () => {
    const r = resolves(3, 20, 5 / 20);
    const needed = Number(/about (\d+) observations/.exec(r.why)?.[1]);
    expect(needed, 'no figure in the message').toBeGreaterThan(20);
    // And the figure it names has to be one that passes, or it is advice
    // that does not work. Same reading, same bar, the sample it asks for.
    expect(resolves(Math.round(needed * (3 / 20)), needed, 5 / 20).ok).toBe(true);
  });

  it('passes a margin the sample can see', () => {
    /*
       `informants.probe` after the widening: 9 framed against a bar of 16 in
       roughly 66 usable worlds. That is the reading the repair was for.
    */
    expect(resolves(9, 66, 16 / 66).ok).toBe(true);
  });

  it('would have passed the same claim before the pool changed, and did not', () => {
    /*
       The pair that started it. 3 in 20 and 7 in 22 are the same 13%
       population rate, and the bar sat between them — so one run was green and
       the next was red for no reason anybody could point at.
    */
    const before = resolves(3, 20, 5 / 20);
    const after = resolves(7, 22, 11 / 22);
    expect(before.ok, 'the narrow sample is being reported as adequate').toBe(false);
    expect(after.ok, 'the narrow sample is being reported as adequate').toBe(false);
  });

  it('says so plainly when there is nothing to read', () => {
    const r = resolves(0, 0, 0.5);
    expect(r.ok).toBe(false);
    expect(r.why).toContain('empty');
  });

  /*
     The property that matters for using it: widening a sample while the
     reading stays put must eventually make the claim assertable. If it does
     not, the advice in every message above is wrong.
  */
  it('is satisfiable by widening alone', () => {
    let n = 20;
    while (n < 100_000 && !resolves(Math.round(n * 0.13), n, 1 / 3).ok) n *= 2;
    expect(n, 'no sample size ever resolves a 13% reading against a third').toBeLessThan(100_000);
  });
});
