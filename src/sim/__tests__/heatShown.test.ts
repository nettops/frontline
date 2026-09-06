/**
 * What a job costs in attention, and where a player reads it.
 *
 * Round 20 reported Call In Tribute as an outlier: *"+26 to +34 heat on
 * failure, seen three times, versus +2 to +12 for every other job at similar
 * crew size, with nothing in its listing that distinguishes it."*
 *
 * The premise is wrong and the finding is right, which is why both halves are
 * guarded here. Every job on the board fails at roughly twice what it succeeds
 * at, and the figure scales with tier — tribute at 20/36 sits between
 * `financial_scheme` at 18/34 and `port_operation` at 22/40. What he had
 * compared was a tier-4 job against tier-0 and tier-1 jobs, and he did it by
 * crew size because the tier is not in the column he was reading.
 *
 * He could compare them that way because the Heat column showed one number:
 * what a *success* costs. The launch panel had both all along — "+X heat if it
 * goes well, +Y if it does not" — but that is after the job is chosen, and the
 * table is where the choosing happens.
 */
import { describe, expect, it } from 'vitest';
import operationsPanel from '../../ui/panels/OperationsPanel.tsx?raw';
import { OPERATIONS } from '../../config/operations';

describe('what a job costs in attention', () => {
  it('is not an outlier on any job, tribute included', () => {
    /*
       The claim the round got wrong, pinned so nobody re-derives it from a
       report. A bar on the *shape* — failure against success, per job — rather
       than on the figures, which are balance and move.
    */
    const ratios = OPERATIONS.map((op) => ({
      id: op.id,
      ratio: op.heatOnFailure / Math.max(op.heatOnSuccess, 0.01),
    }));
    for (const { id, ratio } of ratios) {
      expect(ratio, `${id} does not fail at about twice what it succeeds at`)
        .toBeGreaterThan(1.5);
      expect(ratio, `${id} fails at far more than twice what it succeeds at`)
        .toBeLessThan(2.5);
    }

    // And tribute specifically sits inside its own tier rather than above it.
    const tier4 = OPERATIONS.filter((op) => op.tier === 4);
    const tribute = OPERATIONS.find((op) => op.id === 'call_in_tribute')!;
    expect(tier4.length, 'there is nothing to compare tribute against').toBeGreaterThan(1);
    expect(tribute.heatOnFailure).toBeLessThanOrEqual(
      Math.max(...tier4.map((op) => op.heatOnFailure)),
    );
    expect(tribute.heatOnFailure).toBeGreaterThanOrEqual(
      Math.min(...tier4.map((op) => op.heatOnFailure)),
    );
  });

  it('names both figures on the screen where jobs are compared', () => {
    /*
       Reads the source, in the idiom of `oneName.test.ts`: what is guarded is
       a property of the screen, and a rendered-and-asserted test would have
       passed throughout — the column was present, correct, and showed half the
       story.
    */
    expect(
      operationsPanel,
      'the job table is back to quoting only what a success costs',
    ).toMatch(/op\.heatOnFailure \* scale/);
    expect(operationsPanel).toMatch(/op\.heatOnSuccess \* scale/);
  });
});
