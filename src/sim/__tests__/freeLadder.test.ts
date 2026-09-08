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
 * ## And the second guess was wrong too
 *
 * The revert came with a theory: the paid alternatives ask $50,000 and $54,000,
 * the tester had $5,600, so the fault must be a capital wall. `ladder.probe`
 * was instrumented to check it before anything else was touched, and it is not
 * true either:
 *
 *     36/36 careers opened tier-4 work, median day 62
 *     funds that day, 25th / median / 75th:  10,914 / 22,384 / 39,095
 *     reached $50,000 afterwards:            36/36, median 9 days later
 *     paid tier-4 launched:  Financial Scheme 536, Port Operation 175
 *     free tier-4:           Call In Tribute 1,392
 *
 * Nine days is a speed bump, not a wall, and the bot runs the paid jobs. A
 * mid-cost tier-4 job — the obvious third guess — would have fixed nothing.
 *
 * ## What is actually true
 *
 * Call In Tribute is run twice as often as both paid tier-4 jobs together, and
 * affordability is not why. It is that it **risks nothing**. With $50,000 in
 * hand you can afford Financial Scheme; running Tribute still costs no capital,
 * so it wins whenever you would rather not put money on a roll. That is
 * dominance by risk-free-ness, and it is a different lever from anything tried
 * here.
 *
 * ## And the third guess was wrong too, in a more useful way
 *
 * If the fault is risk-free-ness, charge it something that is not money. Call
 * In Tribute's own description promises exactly that — *"You are spending
 * standing rather than money, and standing spent this way is noticed"* — and
 * it spends nothing; `CIVIC_WORK` charges nine standing for a $5,000 errand of
 * the identical fiction, so the small version of leaning on the city was
 * priced and the large one was free. An optional `standingCost` was built, set
 * at 12 here and 20 on Enforce the Peace, and charged at launch beside the
 * money so it was a stake rather than a bill.
 *
 * `ladder.probe` threw it out on three counts at once:
 *
 *     careers where any civic figure owes you    4/36, needs 18
 *     careers reaching Boss                      0/36, needs 8
 *     Call In Tribute launches                   1,392 -> 1,495
 *
 * **Standing is not a resource pool, it is a set of thresholds.** Favours are
 * granted above `owesAbove` — 68 for the captain, 78 for the judge — and the
 * rank ladder gates on `owedTotal`, so what the drain actually did was hold
 * every figure permanently under every bar and delete the civic network from
 * the game. Twelve every eight days against `CIVIC.driftPerWeek` of 6.2 is a
 * net loss with no floor.
 *
 * And it did not even do the job it was for. Tribute went *up*, because Port
 * Operation went from 175 launches to nought: the bot lost its alternatives
 * before it lost the dominant one. Any cost that scales with what a job pays
 * will do this, because the free job is the cheapest thing on the board to
 * keep running whatever currency you charge in.
 *
 * ## And the fourth guess was wrong for the same reason as the third
 *
 * Limit repetition rather than price the job. `PATTERN` already does exactly
 * that — a groove worn on a job-and-district pair, charged in heat and odds,
 * fading when nobody works the pair — and `config/standingOrders.ts` already
 * claimed it applied here: *"charged to anybody working the pair, not only to
 * the order; the police watch the pattern, not your minutes. Without that the
 * play is to let the order wear the groove and hand-run the same job past it
 * for free."* The accrual never left `tickStandingOrders`, so a player who set
 * no order wore no groove at all, and the exploit the config names was open.
 *
 * It was moved onto a pair-keyed book charged by `launchOperation`, so a
 * hand-run job, a standing order and the autopilot all wore it. The whole game
 * deflated about thirty percent — jobs finished 291 to 200, the odds work
 * actually ran at 57% to 43%, laundering capacity used 82% to 45%, the fronts
 * arm's estate $2.65M to $1.09M — and it broke the decision `PATTERN` exists
 * to create: moving a standing order stopped beating leaving it, 14 careers of
 * 36 against a bar of 18.
 *
 * And on the thing it was for:
 *
 *                       Call In Tribute   paid tier-4   ratio
 *     before                      1,392           711   1.96
 *     grooves on hand play        1,110           214   5.19
 *
 * ## The finding, which is worth more than any of the four attempts
 *
 * **Call In Tribute is dominant because it is the most robust thing on the
 * board, so any cost applied broadly removes its competitors before it
 * removes it.** A second currency killed Port Operation outright (175 to 0)
 * and left Tribute higher than it started. A repetition tax cut Tribute by
 * 20% and the paid tier-4 jobs by 70%. Both made the imbalance the change was
 * aimed at measurably worse, by the same mechanism, from opposite directions.
 *
 * The corollary is that the repair has to be **specific to this job** rather
 * than a rule the whole board obeys — a cooldown on Tribute itself, or
 * diminishing returns on running it again — and that anything shaped like a
 * new system will fail here for a fifth time.
 *
 * ## And the fifth attempt, which took the corollary literally and worked
 *
 * `OperationDef.cooldownDays`, set to 14 on `call_in_tribute` and absent on
 * every other definition in the game. One number, one job, enforced in
 * `canLaunch`, saying what that job's own description always said: you cannot
 * go round everyone who owes you and ask again next week.
 *
 *     over 36 careers          Tribute   paid tier-4   ratio
 *     shipped                    1,392           711    1.96
 *     a standing cost            1,495           214    5.19
 *     grooves on hand play       1,110           214    5.19
 *     a 14-day cooldown            429           664    0.65
 *
 * **Tribute falls 69% and its competitors do not follow.** Port Operation goes
 * the other way, 175 launches to 212, and Financial Scheme holds at 452 against
 * 536. The ratio inverts: the free job at that rank is now run less often than
 * the paid ones, which is what the header's own rule says should be true.
 *
 * `ladder.probe` stayed green throughout, so no pre-committed figure was moved
 * to reach it, and the eight probe files and 1,392 unit tests are unchanged.
 * The reading that made it work is the one the four failures produced, and it
 * is the reason this file exists: a broad cost could never have done this,
 * because the thing being taxed is the most robust thing on the board.
 *
 * A second corollary, about method rather than about the game: `PATTERN`'s
 * numbers were swept against automated play, and the config says so — *"only
 * the automated arms move"*. Applying them to all play without re-sweeping
 * used a calibration outside the domain it was calibrated in. If the groove is
 * ever extended, its four constants need their own sweep first.
 *
 * The tester is not contradicted by this. They had $5,600 at day 90, below the
 * 25th percentile of $10,914 at day 62 — a career in the bottom quartile, where
 * nine days is a long time. **The wall is real from where they sat and not real
 * on average**, which is the kind of thing one career cannot tell you and
 * thirty-six can.
 *
 * These tests assert what is true today and pin the numbers, so the next person
 * starts from the reading rather than from a third intuition.
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
   * The shape of tier 4, pinned — and explicitly *not* a claim that it is a
   * wall, because measurement says it is not.
   *
   * One free job, and the cheapest paid one asking $50,000. A career arrives
   * with a median of $22,384 and clears the bar nine days later, so what this
   * guards is that the arrangement does not change without somebody noticing:
   * if a mid-cost job appears, or the free one gains a rival, the reading in
   * the header is stale and whoever did it has to come and say so.
   */
  it('has one free job and nothing cheap beside it', () => {
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
