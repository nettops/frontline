/**
 * Capital buys efficiency, which is the rule that holds the job table
 * together — and which nothing was checking.
 *
 * `config/operations.ts` states it at the top: every rank has exactly one job
 * that costs nothing to start, and it is "always the worst money on the board
 * per crew per day, ties up its crew longer than the paid jobs of the same
 * rank, and carries more heat for the same work."
 *
 * Two of those three clauses had tests. `broke.probe` guards that the floor
 * exists and `opReturn` guards return on capital rising with tier. The middle
 * clause had none — and measuring it found the table has never obeyed it at
 * any rank, so it reads as design intent rather than as a property. The real
 * numbers are recorded below.
 *
 * The consequence is what round 16's tester met at day 92: the only high-value
 * work a player without capital can reach was also the most efficient work on
 * the board, so the correct play collapsed to one button and their last thirty
 * days were pressing it. `opReturn` could not see it, because it measures
 * return on stake and these jobs have no stake.
 */
import { describe, expect, it } from 'vitest';
import { OPERATIONS } from '../../config/operations';
import type { OperationDef } from '../types';

/** Expected money, which is what "worst money" means here. See the file header. */
const ev = (o: OperationDef) => ((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess - o.investment;
const crewDays = (o: OperationDef) => Math.max(1, o.crewRequired) * o.durationDays;
const perCrewDay = (o: OperationDef) => ev(o) / crewDays(o);

const byTier = new Map<number, OperationDef[]>();
for (const o of OPERATIONS) {
  byTier.set(o.tier, [...(byTier.get(o.tier) ?? []), o]);
}

/**
 * Tiers 0 and 1 are exempt, and that is a finding rather than a convenience.
 *
 * Both break the rule today, and neither was touched:
 *
 *     t0  Corner Shakedown   free, $366/crew-day, 1 crew-day
 *         Boost Cars         $200 stake, $300/crew-day, 2 crew-days
 *     t1  Freelance Muscle   free, $471/crew-day, 2 crew-days
 *         Protection Racket  $500 stake, $329/crew-day, 6 crew-days
 *
 * So at the bottom of the table, capital buys nothing — the free job is both
 * better paid and faster than paid work beside it.
 *
 * They are left alone rather than tuned, because this file's own header rules
 * it out: the street tier keeps its $150 to $800 stakes untouched, and "a
 * tidier curve is not worth taking that floor away". At stakes that small the
 * rule is not doing the work it does higher up, and the floor exists so a
 * broke player always has something to press.
 *
 * **This is a live finding, not a settled one.** The tier-4 violation this
 * file was written for was three and a half times worse and cost a tester
 * their last thirty days; these are small and at the end of the table where a
 * career is not decided. Somebody should still decide about them on purpose,
 * which is what recording the numbers here is for — the tier-4 version shipped
 * precisely because nobody was looking.
 */
const EXEMPT = new Set([0, 1]);

/** Ranks that have both a free job and paid work to compare it against. */
const comparable = [...byTier.entries()]
  .map(([tier, ops]) => ({
    tier,
    free: ops.filter((o) => o.investment === 0),
    paid: ops.filter((o) => o.investment > 0),
  }))
  .filter((r) => !EXEMPT.has(r.tier) && r.free.length > 0 && r.paid.length > 0);

describe('the no-capital job at each rank', () => {
  it('is comparing something, on more than one rank', () => {
    expect(comparable.length).toBeGreaterThan(2);
  });

  it('exists at every rank, so being broke is never the end of the game', () => {
    for (const [tier, ops] of byTier) {
      expect(ops.some((o) => o.investment === 0), `tier ${tier} has no way back in`).toBe(true);
    }
  });

  it('is the worst money per crew-day at its own rank', () => {
    for (const { tier, free, paid } of comparable) {
      const bestFree = Math.max(...free.map(perCrewDay));
      const worstPaid = Math.min(...paid.map(perCrewDay));
      expect(
        bestFree,
        `tier ${tier}: free work pays ${Math.round(bestFree)}/crew-day against ` +
          `${Math.round(worstPaid)} for the cheapest paid job — capital is not buying anything`,
      ).toBeLessThan(worstPaid);
    }
  });

  /**
   * Crew-days, recorded rather than asserted — because the table has never
   * obeyed this clause, and a test that pretended otherwise would be a lie.
   *
   * The header says the free job "ties up its crew longer than the paid jobs
   * of the same rank". Measured across the whole table:
   *
   *     t0  free 1 crew-day    longest paid 2
   *     t1  free 2             longest paid 9
   *     t2  free 8             longest paid 42
   *     t3  free 18            longest paid 60
   *     t4  free 115           longest paid 112   <- only since this change
   *     t5  free 256           longest paid 252   <- only since this change
   *
   * It holds at exactly the two ranks that were just retimed and nowhere else.
   * Asserting it at those two alone would be asserting that the change
   * happened, which is not a property of the game.
   *
   * So the change stands on the measurement instead, and on the two tests
   * either side of this one: at tier 4 the free job was fifth-best on a board
   * of twenty-three with no stake at all, which made it the only high-value
   * work a player without capital could reach and the obviously correct move
   * forever after.
   */
  it('commits more crew-days than paid work, at the two ranks that were retimed', () => {
    for (const { tier, free, paid } of comparable.filter((c) => c.tier >= 4)) {
      const longestPaid = Math.max(...paid.map(crewDays));
      for (const o of free) {
        expect(
          crewDays(o),
          `tier ${tier}: ${o.name} commits ${crewDays(o)} crew-days against ${longestPaid}`,
        ).toBeGreaterThan(longestPaid);
      }
    }
  });

  /**
   * And the free ladder rises rather than jumping.
   *
   * Not in the file header, and it is the shape the header's rule implies: if
   * capital buys efficiency, then the rung you can always reach should improve
   * gently with rank. Before this change it went 246, 471, 481, 644 and then
   * 2,341 — a 3.6x cliff at tier 4, which is precisely where the game stopped
   * having more than one answer.
   */
  it('rises gently rather than cliffing', () => {
    const rungs = [...byTier.entries()]
      .filter(([tier]) => !EXEMPT.has(tier))
      .sort((a, b) => a[0] - b[0])
      .map(([tier, ops]) => {
        const free = ops.filter((o) => o.investment === 0);
        return free.length ? { tier, pay: Math.max(...free.map(perCrewDay)) } : null;
      })
      .filter((x): x is { tier: number; pay: number } => x !== null);

    for (let i = 1; i < rungs.length; i++) {
      const step = rungs[i].pay / rungs[i - 1].pay;
      expect(
        step,
        `the free job at tier ${rungs[i].tier} pays ${step.toFixed(1)}x the one below ` +
          `(${Math.round(rungs[i - 1].pay)} to ${Math.round(rungs[i].pay)})`,
      ).toBeLessThan(2.2);
    }
  });
});

/**
 * The street, asserted as it actually is.
 *
 * Not a second-class test: pinning the exception means that if somebody later
 * decides the floor should obey the rule after all, this goes red and they
 * have to say so, rather than the two halves of the table quietly disagreeing.
 */
describe('the bottom of the table, which is exempt for now', () => {
  it('still has free work at every exempt rank, which is the point of the floor', () => {
    for (const tier of EXEMPT) {
      const ops = byTier.get(tier) ?? [];
      expect(ops.some((o) => o.investment === 0), `tier ${tier} has no way back in`).toBe(true);
    }
  });

  /**
   * The exception, pinned as it actually is.
   *
   * Not a second-class test. If somebody later decides the floor should obey
   * the rule after all, this goes red and they have to say so, rather than the
   * two halves of the table quietly disagreeing — and if it flips on its own,
   * that is a balance change nobody meant to make.
   */
  it('is where capital does not buy efficiency, which somebody should decide about', () => {
    for (const tier of EXEMPT) {
      const ops = byTier.get(tier) ?? [];
      const free = ops.filter((o) => o.investment === 0);
      const paid = ops.filter((o) => o.investment > 0);
      if (!free.length || !paid.length) continue;
      expect(
        Math.max(...free.map(perCrewDay)),
        `tier ${tier} now obeys the rule — the exemption can go`,
      ).toBeGreaterThan(Math.min(...paid.map(perCrewDay)));
    }
  });
});
