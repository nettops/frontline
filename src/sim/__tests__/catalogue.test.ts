/**
 * What the ten fronts are, as a set of choices.
 *
 * `config/businesses.ts` opens by saying the trade-off is built into the stats:
 * *"a laundromat moves a little money and looks like nothing, a casino moves
 * enormous amounts and is a permanent address for anyone building a case.
 * Legitimacy and launder capacity pull against each other on purpose."*
 *
 * Measured off the catalogue, that was not true:
 *
 *     strictly dominated entries, price included     0
 *     beaten on every quality axis by something      7 of 10
 *     revenue per $1,000 of cost                     37.8 to 51.1, most at 50.0
 *     capacity against legitimacy                    r = -0.41
 *
 * Nothing was *dead* — every entry was cheaper than the thing that beat it. But
 * `real_estate` had the second-highest capacity in the game **and** the highest
 * legitimacy, beating six other entries outright on revenue, capacity, exposure
 * and discretion at once. Seven of ten existed only because they cost less, and
 * revenue per dollar was flat across the whole list. So the only input to which
 * front you bought was how much money you had, which is not a decision — and
 * F15 says the same thing from the other end, finding money the blocker in 97%
 * of the weeks a career owns no front.
 *
 * The properties this file holds:
 *
 * 1. **Every entry is best at something.** A front that is beaten on every
 *    quality by another front is a rung on a ladder, not a choice, and the
 *    only question it can ever ask is what you can afford.
 * 2. **Capacity and discretion really do pull against each other**, because
 *    the file has been claiming they do since it was written.
 * 3. **There is a real choice at every stage of the game**, not only at the
 *    top. A player at foothold has to pick a character, the same as a player
 *    at dominance.
 * 4. **This is a redistribution and not a buff.** The catalogue's totals stay
 *    where they were, so no estate, laundering or legitimacy reading in the
 *    probe moves because the economy got richer.
 */
import { describe, expect, it } from 'vitest';
import { BUSINESSES } from '../../config/businesses';
import type { BusinessDef } from '../../config/businesses';
import type { ControlLevel } from '../../config/territories';

/**
 * What a front is worth, as four numbers where more is better.
 *
 * Exposure is inverted here so every axis reads the same direction, which is
 * the only way a dominance check stays legible.
 */
function qualities(b: BusinessDef): number[] {
  return [b.revenue, b.launderCapacity, -b.exposureRate, b.legitimacy];
}

/** True when `over` is at least as good everywhere and better somewhere. */
function beats(over: BusinessDef, under: BusinessDef): boolean {
  const a = qualities(over);
  const c = qualities(under);
  return a.every((v, i) => v >= c[i]) && a.some((v, i) => v > c[i]);
}

function corr(xs: number[], ys: number[]): number {
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const vx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const vy = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return cov / Math.sqrt(vx * vy);
}

describe('the ten fronts', () => {
  /*
     The property, and the one the old catalogue failed seven times over.

     Stated on quality alone rather than "quality at the same price", because
     price is exactly the excuse that let this rot: every dominated entry was
     cheaper than the thing beating it, so a check that counted price passed
     while the catalogue was a ladder. What has to be true is that each front
     is the best answer to *some* question — otherwise it is only ever the
     answer to "what can I afford", and there are already four other systems
     asking that.
  */
  it('has no entry that another entry simply beats', () => {
    const dominated = BUSINESSES.filter((b) => BUSINESSES.some((o) => beats(o, b)));
    expect(
      dominated.map((b) => b.id),
      'these fronts exist only because they are cheaper than the thing that beats them',
    ).toEqual([]);
  });

  /*
     And the sentence at the top of `businesses.ts`, made true.

     A file that describes a tension its numbers do not have is the same defect
     as a probe that returns believable readings while measuring nothing, and
     this project has now caught four of those. The claim is load-bearing —
     it is the whole reason there is more than one front in the game.
  */
  it('makes discretion and capacity pull against each other, as the file says', () => {
    const r = corr(
      BUSINESSES.map((b) => b.launderCapacity),
      BUSINESSES.map((b) => b.legitimacy),
    );
    expect(r, `capacity and legitimacy correlate at ${r.toFixed(2)}`).toBeLessThan(-0.6);
  });

  /*
     A choice at every stage, not only at the end.

     Three control bands gate the catalogue. If a band offers only one
     character of front then a player in that band has no decision to make, and
     the middle of the game — which is where a career actually lives — goes
     back to being a price ladder while the top of it looks designed.
  */
  it('offers opposite characters inside every band a player can buy in', () => {
    const bands: ControlLevel[] = ['foothold', 'control', 'dominance'];
    for (const band of bands) {
      const inBand = BUSINESSES.filter((b) => b.minControl === band);
      expect(inBand.length, `nothing is available at ${band}`).toBeGreaterThan(1);

      const washer = inBand.reduce((a, b) => (b.launderCapacity > a.launderCapacity ? b : a));
      const quiet = inBand.reduce((a, b) => (b.legitimacy > a.legitimacy ? b : a));
      expect(
        washer.id,
        `at ${band} the same front both washes best and looks best, so there is nothing to weigh`,
      ).not.toBe(quiet.id);
    }
  });

  /*
     And the constraint on the repair itself.

     Every number here feeds laundering, the estate, legitimacy and four bars
     in `ladder.probe`. A re-cost that also made fronts richer would move all
     of those and there would be no way afterwards to say which change did it.
     So the totals hold and only the distribution moves — this is the same
     discipline as the paired populations in the probe, applied to a config.

     The figures are the catalogue as it stood before the re-cost.
  */
  it('redistributes the catalogue without enriching it', () => {
    const sum = (pick: (b: BusinessDef) => number) => BUSINESSES.reduce((s, b) => s + pick(b), 0);
    const near = (got: number, was: number, what: string) => {
      const drift = Math.abs(got - was) / was;
      expect(drift, `${what} moved ${(drift * 100).toFixed(1)}% (${was} → ${got})`).toBeLessThan(
        0.05,
      );
    };

    near(sum((b) => b.revenue), 41_210, 'total weekly revenue');
    near(sum((b) => b.launderCapacity), 229_500, 'total launder capacity');
    near(sum((b) => b.cost), 900_000, 'total cost');
    near(sum((b) => b.legitimacy), 585, 'total legitimacy');
  });
});
