/**
 * The populations in `ladder.probe` are built when they are read, not when the
 * file is imported. This is the guard on the mechanism that makes that safe.
 *
 * The reason it needs one: the arrays are consumed at four hundred and thirty
 * call sites through every array idiom there is, and a proxy that got any of
 * them subtly wrong would not throw — it would return a different population
 * and every reading in the file would quietly be about something else.
 */
import { describe, expect, it, vi } from 'vitest';

import { lazyRuns } from './helpers';

describe('a population built when it is read', () => {
  it('does not build until somebody looks', () => {
    const build = vi.fn(() => [1, 2, 3]);
    const runs = lazyRuns(build);
    expect(build).not.toHaveBeenCalled();
    expect(runs.length).toBe(3);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('builds once however many times it is read', () => {
    const build = vi.fn(() => [1, 2, 3]);
    const runs = lazyRuns(build);
    runs.map((n) => n);
    runs.filter((n) => n > 1);
    void runs[0];
    void [...runs];
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('behaves like the array it stands in for', () => {
    const real = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const runs = lazyRuns(() => real.map((x) => ({ ...x })));

    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBe(3);
    expect(runs[1].n).toBe(1);
    expect(runs.map((x) => x.n)).toEqual([3, 1, 2]);
    expect(runs.filter((x) => x.n > 1).length).toBe(2);
    expect([...runs].length).toBe(3);
    expect(Array.from(runs).length).toBe(3);
    expect(runs.reduce((s, x) => s + x.n, 0)).toBe(6);
    expect([...runs].sort((a, b) => a.n - b.n).map((x) => x.n)).toEqual([1, 2, 3]);
    expect(runs.some((x) => x.n === 2)).toBe(true);
    expect(runs.every((x) => x.n > 0)).toBe(true);
    expect(runs.slice(1).length).toBe(2);
    expect(runs.find((x) => x.n === 2)?.n).toBe(2);
    expect(runs.findIndex((x) => x.n === 2)).toBe(2);
    expect(Object.keys(runs).length).toBe(3);

    let seen = 0;
    for (const _ of runs) seen += 1;
    expect(seen).toBe(3);
  });

  it('is the same objects every time, so a run is one career and not two', () => {
    // The property the whole file depends on: two tests reading the same
    // population have to be reading the same careers.
    const runs = lazyRuns(() => [{ n: 1 }]);
    expect(runs[0]).toBe(runs[0]);
    expect(runs.map((x) => x)[0]).toBe(runs[0]);
  });
});
