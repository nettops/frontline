/**
 * What the no-capital ladder actually looks like, and why it was left alone.
 *
 * Round 16's tester stopped playing the game at day 92: *"Call In Tribute is
 * four crew, eight days, no money up front, $74-140K — nothing else on the
 * board is within a factor of four, so the game solves itself."* Their last
 * thirty days were one button.
 *
 * ## The measurement, which half-confirmed them
 *
 * It is not the best job on the board — fifth of twenty-three on expected
 * money per crew-day. What makes it dominant is that it costs nothing:
 *
 *     3,909/crew-day  Citywide Distribution   stake 170,000
 *     3,575           Enforce the Peace       stake 0
 *     2,496           Port Operation          stake  54,000
 *     2,465           Financial Scheme        stake  50,000
 *     2,341           Call In Tribute         stake 0
 *
 * They had $5,600 at day 90. Of the top five only the free ones were
 * reachable, so from where they sat it *was* the only game in town. And the
 * rung a player can always reach cliffs at exactly that rank:
 *
 *     t0 Work It Yourself    246      t3 Sit-Down Fees       644
 *     t1 Freelance Muscle    471      t4 Call In Tribute   2,341   <- 3.6x
 *     t2 Rent Out the Crew   481      t5 Enforce the Peace 3,575
 *
 * ## And the obvious repair was wrong
 *
 * Both free jobs were retimed to flatten that cliff — Call In Tribute to five
 * crew over 23 days, Enforce the Peace to eight over 32 — and `ladder.probe`
 * refused it. *"What the ground is for"* runs the same bot on the same seeds
 * with district yields live and with them paying nothing, and asks whether
 * more than half of 36 careers do better with them live. It came back at
 * exactly 18 of 36. A coin flip.
 *
 * The reason is that both of these jobs are **district-gated** — two districts
 * controlled and eight on the books for one, three districts and a rival who
 * trusts you for the other. They are not incidentally good, they are a large
 * part of what holding ground pays for. Slowing them by three times removed
 * the measurable value of controlling territory, which is a worse fault than
 * the one being fixed.
 *
 * So the change was reverted and the finding is recorded here instead. **The
 * cliff is real and the cause is upstream of these two jobs**: paid tier-4
 * work asks $50,000 and $54,000, and a player at $5,600 cannot reach any of
 * it. The free job is not too good — the paid alternatives beside it are
 * unreachable, which is a capital-wall problem and wants measuring as one.
 *
 * These tests therefore assert what is true today and pin the numbers, so the
 * next person starts from the reading rather than from the intuition.
 */
import { describe, expect, it } from 'vitest';
import { OPERATIONS } from '../../config/operations';
import type { OperationDef } from '../types';

/** Expected money, which is what "worst money" means. See the file header. */
const ev = (o: OperationDef) => ((o.payout[0] + o.payout[1]) / 2) * o.baseSuccess - o.investment;
const crewDays = (o: OperationDef) => Math.max(1, o.crewRequired) * o.durationDays;
const perCrewDay = (o: OperationDef) => ev(o) / crewDays(o);

const byTier = new Map<number, OperationDef[]>();
for (const o of OPERATIONS) {
  byTier.set(o.tier, [...(byTier.get(o.tier) ?? []), o]);
}

const freeAt = (tier: number) => (byTier.get(tier) ?? []).filter((o) => o.investment === 0);
const paidAt = (tier: number) => (byTier.get(tier) ?? []).filter((o) => o.investment > 0);

describe('the way back in, at every rank', () => {
  /**
   * The one clause of the table's rule that has always held, and the one that
   * matters most: a broke player is never out of moves.
   */
  it('exists, so being broke is never the end of the game', () => {
    for (const [tier] of byTier) {
      expect(freeAt(tier).length, `tier ${tier} has no way back in`).toBeGreaterThan(0);
    }
  });

  /**
   * The cliff, pinned as a number rather than left as an impression.
   *
   * Not asserted away — it is real, it is what a tester met, and the repair is
   * not in this file. What this guards is that it does not get *worse* without
   * somebody noticing, and that if it is ever fixed properly this goes red and
   * the fixer has to come and update the record.
   */
  it('cliffs at tier 4, which is where the game stops having answers', () => {
    const rungs = [...byTier.keys()]
      .sort((a, b) => a - b)
      .map((tier) => ({ tier, pay: Math.max(...freeAt(tier).map(perCrewDay)) }))
      .filter((r) => Number.isFinite(r.pay));

    const steps = rungs.slice(1).map((r, i) => ({ tier: r.tier, step: r.pay / rungs[i].pay }));
    const worst = steps.reduce((a, b) => (b.step > a.step ? b : a));

    expect(worst.tier, 'the biggest jump has moved off tier 4 — re-read this file').toBe(4);
    expect(
      worst.step,
      `the free ladder now jumps ${worst.step.toFixed(1)}x into tier 4; it was 3.6x when ` +
        `a tester reported the game solving itself, and this is not the place to fix it`,
    ).toBeLessThan(4.2);
  });

  /**
   * The capital wall, which is the actual cause.
   *
   * At tier 4 the cheapest paid job asks $50,000. A player who has just
   * unlocked the rank has nothing like it, so the free job is not competing
   * with the paid ones — it is competing with nothing.
   */
  it('is the only tier-4 work a player without capital can reach', () => {
    const cheapestPaid = Math.min(...paidAt(4).map((o) => o.investment));
    expect(cheapestPaid).toBeGreaterThan(20_000);
    expect(freeAt(4).length).toBe(1);
  });
});

describe('what capital buys, measured rather than assumed', () => {
  /**
   * The table's own header says the free job is "always the worst money on the
   * board per crew per day". Measured, it holds at every rank from tier 2 up,
   * including tier 4 — Call In Tribute is $2,341 against Financial Scheme's
   * $2,465 — and fails only on the street.
   *
   * Which sharpens the finding above rather than softening it. The dominant
   * job at tier 4 is *correctly priced against its own rank*. What makes it
   * the only move is that the two jobs beating it ask $50,000 and $54,000, and
   * the player who has just reached that rank has neither. The fault is the
   * capital wall, and it is not in this job's numbers.
   */
  it('buys efficiency from tier 2 up', () => {
    for (const tier of [2, 3, 4, 5]) {
      const free = freeAt(tier);
      const paid = paidAt(tier);
      if (!free.length || !paid.length) continue;
      expect(
        Math.max(...free.map(perCrewDay)),
        `tier ${tier}: free work is not the worst money at its own rank`,
      ).toBeLessThan(Math.min(...paid.map(perCrewDay)));
    }
  });

  /**
   * And buys nothing at the bottom, which is deliberate.
   *
   * The header protects the street: its $150 to $800 stakes are untouched
   * because "a tidier curve is not worth taking that floor away". Pinned so
   * that if it ever flips, somebody decided that on purpose.
   */
  it('buys nothing on the street, and that is the floor working', () => {
    for (const tier of [0, 1]) {
      const free = freeAt(tier);
      const paid = paidAt(tier);
      if (!free.length || !paid.length) continue;
      expect(
        Math.max(...free.map(perCrewDay)),
        `tier ${tier} now obeys the rule — the exemption can go`,
      ).toBeGreaterThan(Math.min(...paid.map(perCrewDay)));
    }
  });

  /**
   * The clause the header states and the table has never met, recorded so
   * nobody else spends an afternoon discovering it.
   *
   *     t0  free 1 crew-day    longest paid 2
   *     t1  free 2             longest paid 9
   *     t2  free 8             longest paid 42
   *     t3  free 18            longest paid 60
   *     t4  free 32            longest paid 112
   *     t5  free 72            longest paid 252
   *
   * "Ties up its crew longer than the paid jobs of the same rank" is design
   * intent, not a property of this table, at any rank.
   */
  it('does not buy shorter commitments — the free job is always the quick one', () => {
    for (const [tier] of byTier) {
      const free = freeAt(tier);
      const paid = paidAt(tier);
      if (!free.length || !paid.length) continue;
      expect(
        Math.min(...free.map(crewDays)),
        `tier ${tier} free work now commits longer than paid work — the header's clause ` +
          `has started being true and this record is stale`,
      ).toBeLessThan(Math.max(...paid.map(crewDays)));
    }
  });
});
