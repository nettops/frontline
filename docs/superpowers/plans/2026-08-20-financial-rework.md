# Financial rework — implementation plan

Spec: `docs/superpowers/specs/2026-08-20-financial-rework-design.md`

**Goal:** rank measures the estate — cash, holdings, fronts and ground — so that
$60,000 is reachable by building something and $5,000,000 is reachable by
compounding, in a game where a family currently earns $184,077 and holds
$24,908.

**Architecture:** one new leaf module `sim/estate.ts`, following `sim/standing.ts`
— derived on demand, no new saved state, imports the sim and is imported by
`player.ts` and the UI. Two behavioural changes in `business.ts`. One config
table renumbered.

## Global constraints

- No `SAVE_VERSION` bump. Anything new on state is `foo?: T`.
- Balance numbers live in `src/config/`, never in `src/sim/`.
- `LEGITIMATE_REVENUE_SCALE` stays 0.72. Crime is the engine.
- Dirty cash is never part of standing.
- These pre-committed tests must still pass and are the finding if they do not:
  `balance.test.ts > lets careful play build a bigger organization`, and
  `deep.test.ts > districts that change`.
- No jsdom in this project. UI is verified in a browser via `npm run playtest`,
  never by unit test.

---

## Task 1 — `estate()`

**Files:** create `src/sim/estate.ts`, test `src/sim/__tests__/estate.test.ts`

A leaf module. `economy.ts` cannot host this: `business.ts` already imports
`economy.ts` for `spend`/`earnClean`, so an `economy.ts` that imported
`business.ts` back would be a cycle.

**Produces:**

```ts
export interface Estate {
  cash: number; holdings: number; fronts: number; ground: number; total: number;
}
export function estate(state: GameState): Estate;
```

- `cash` — `state.org.cash`
- `holdings` — `state.org.holdings ?? 0`
- `fronts` — for each operating business, `acquisitionCost(state, def, territory)`
  scaled by `health / 100`. Shuttered businesses are worth nothing.
- `ground` — `districtWorth` from `sim/delegation.ts`, over controlled districts
- `total` — the sum. Dirty cash never appears.

**Steps:** write the failing tests first (a shuttered front is worth nothing; a
half-dead front is worth about half; dirty cash never moves the total; a save
with no `holdings` values correctly), watch them fail, implement, watch them
pass.

## Task 2 — rank reads the estate

**Files:** `src/sim/player.ts`, `src/sim/types.ts`

- `rankRequirements` — the `Clean money` row becomes `What the family is worth`,
  reading `estate(state).total`.
- `tickRecord` — `record.cleanWorth` becomes `record.estate`, the high-water of
  the estate rather than of the wallet. Both `record` and its fields were added
  today and no shipped save carries them, so this is a rename rather than a
  migration; `tickRecord` already tolerates a missing `record`.
- `dynasty.test.ts` updates with it — the tests about remembering a peak still
  hold, they just hold about a broader number.

## Task 3 — renumber the ladder

**Files:** `src/config/economy.ts`

`RANKS[].requires.cleanCash`: 0, 0, 12_500, 60_000, 300_000, 1_250_000,
5_000_000. Comment records the board's ceiling — 25 slots, $6.5M in fronts —
and that the top rung deliberately sits below it.

## Task 4 — front takings compound

**Files:** `src/sim/business.ts`, `src/config/economy.ts`, tests

Two halves, and the second is what makes the first work.

**a. A front's own revenue pays into holdings, not the wallet.** In
`tickBusinesses`, `earnClean(state, revenue + cleaned)` splits: `cleaned` — money
the player chose to wash — stays liquid; `revenue` — what the business took over
the counter — goes to holdings. The legitimate side becomes reinvestment capital
by default and spending money by decision.

**b. Holdings can buy fronts, and nothing else.** Otherwise (a) taxes every
reinvestment 15% through `takeBack`, which fights the whole design. Moving money
from a box at a bank into a building is not selling in a hurry.
`acquireBusiness` draws holdings first, then the wallet.

**Risk to watch, stated before measuring:** diverting front revenue out of the
wallet removes it from the payroll pool. Wages are paid dirty-first and dirty is
plentiful at $996 a crew-week, so this should be absorbed — but missed payroll
is the most expensive thing that can happen to a crew, and the probe reports it.

## Task 5 — measure

**Files:** none changed; `ladder.probe` read at two horizons.

1. Four years. Rungs above Crew Leader arriving at all.
2. Twenty years. Rungs arriving *further* than at four. Today the two are
   identical, which is the definition of stuck; they must stop being identical.
3. The full suite, and the two named pre-committed tests specifically.

The probe's bot must buy fronts out of holdings once it can, or Task 4b is
untestable — the fifth instance this month of a probe that cannot perform the
thing it measures, and it is checked for deliberately.

## Task 6 — show it

**Files:** `src/ui/panels/PlayerPanel.tsx`, `src/ui/panels/FinancesPanel.tsx`

The rank screen shows the four parts of the estate rather than one number, so a
player can see that buying a front moved their standing. Finances shows the
same total beside the wallet.

Verified in a browser on an isolated instance, not by unit test.

---

## Results — tasks 1 to 5

`estate()` built as a leaf module with ten tests, rank reads it, the ladder is
renumbered, front takings compound into holdings and holdings buy fronts
directly. **579 tests pass, build clean.**

```
                          before          after
best estate ever         $24,908       $218,386
Crew Leader           36/36 d198      35/36 d121
Capo                        1/36           1/36
handovers                     19    26 across 18/36
rank held at handover         18             21
```

**The measure works.** What a family is worth peaked at $24,908 when it meant
the wallet and peaks at $218,386 when it means the estate — past Capo at
$60,000 and a good part of the way to Underboss at $300,000. Crew Leader
arrives on day 121 rather than day 198, because buying a laundromat now counts
as having built something instead of as having spent everything.

**Two pre-committed tests changed, and both were the quantity changing rather
than a threshold being nudged.** Said plainly because the distinction is easy
to abuse:

- `foresight > asks for less than a season of laundering` asserted
  `cleanCash <= 10_000` and explained itself as a statement about laundering
  throughput. The requirement no longer reads throughput. Rewritten to assert
  the intent that survives — the first gate must be payable by the cheapest
  front on the shelf — plus a new test that the rungs keep their fourfold step.
- `territory > converts dirty cash to clean` asserted the wallet gained revenue
  *and* washed money together, which is the behaviour Task 4 deliberately
  splits. Rewritten to assert the split, and that the family is no worse off
  across both pools.

The two tests the spec named as untouchable — `balance > lets careful play
build a bigger organization` and `deep > districts that change` — both still
pass unmodified.

**An experiment that measured worse, kept because it is the interesting half.**
Paying the week's bills out of front takings and compounding only the surplus
looked obviously right: it would stop a family paying the hurry price to reach
its own money. Best estate fell $218,386 to $143,222 and the median $24,229 to
$13,034. Money that lands in the wallet goes on the next job, so paying bills
from takings hands the compounding pool back to the leak it exists to escape.
Reverted, with the reasoning in the code.

**What has not moved: Capo is still 1/36, and the median family ends at
$24,229.** The ceiling rose eightfold and the median did not follow. The best
family reaches $218k; the ordinary one owns three fronts, buries one, and ends
where it started. That is now a *distribution* problem rather than a ceiling
problem, which is a different and more tractable thing than this morning's.

**Outstanding:** Task 5's twenty-year run, and Task 6, the panels. The
twenty-year comparison is the one that says whether the ladder is still stuck,
and it should be run before any further tuning.

## The district finding — and Underboss

Asked which of Capo's five lines a career ever met, since rank reads the
high-water record and a requirement is met the moment it is *ever* satisfied:

```
crew (10)          35/36        best crew ever: median 14, highest 22
operations (35)    35/36
respect (140)      29/36
worth ($60,000)    17/36
districts (2)       1/36
```

**The wall was never money or people.** A family reaches fourteen men and needs
ten. One career in thirty-six ever held two districts.

The probe's "furthest requirement" line had said `clean money` all day, because
it reports the smallest *ratio* and a money ratio always looks worse than
1-against-2. A correct instrument answering a slightly different question than
the one being asked — a sixth kind of measurement fault, and a new one.

**Then influence, which had never been measured once.** Highest any district
reached: **100** in the median career. Mean influence where the family worked at
all: **65.6**, well above the 50 Control needs. Districts ever reaching each
band: presence 7, foothold 4, **control 1**.

Influence is not hard to build. A family took one district to 100 and never
took a second past 50 — because the bot read
`operableTerritories(state)[0]` and worked the first entry on the list, every
day, for four years. Round 7's human tester spread out unprompted and wrote
that reaching The Docks was what finally produced a purchasable front.

**Two corrections, because the first overshot.** Always working the best
*unfinished* district dropped the stronghold the moment it passed 50 and sent
the bot to where it was weakest: districts went 1/36 to 25/36 and everything
else collapsed — Crew Leader 35/36 to 24/36, respect met 29 to 8, best estate
$218k to $127k. A job run where you have no standing is a job you fail, and
respect is paid on success.

The rule that works is a boss expanding rather than wandering: earn where you
are established, and spend one week in three opening the next place up, until
two districts are held.

```
                        one district   spread hard   earn and expand
Crew Leader              35/36 d121    24/36 d257      31/36 d156
Capo                       1/36          4/36          11/36
Underboss                  0/36          0/36           1/36 d1051
best estate ever          $218,386      $126,760     $1,310,458
median estate at end       $24,229            —          $41,054
districts ever controlled       1             4               2
```

**Underboss has been reached. It is the first time any rank above Capo has
arrived in this project**, and the best estate is now $1.3M against $24,908
this morning — past Boss's $1,250,000 line, though not by a family that met the
rest of it.

**Twenty years against four, which is the test for stuck:**

```
                    4 years        20 years
Capo             11/36 d589      11/36 d589
Underboss         1/36 d1051      1/36 d1051
best estate      $1,310,458      $1,348,568
careers ended       15/36           32/36
median length        1461            1309
```

**Still identical, and that is now a different problem.** The rungs do not move
because careers do not last: the median organization is finished at 1,309 days
and the extra sixteen years belong to nobody. The ladder is no longer stuck on
money — Capo went from 1 to 11 — it is stuck on survival, which is where this
morning's twenty-year run pointed before the economy work started.

579 tests pass.

## Task 6 — showing it, and what showing it exposed

A `What the family is worth` panel on the rank screen with the parts broken
out, and the same total in Finances beside the wallet.

**A display bug older than any of this.** The rank panel chose money formatting
with `req.label.includes('Cash')`, and the label has been `Clean money` since it
was written — so the one row that is money has always rendered as
`45000 / 45000`. Replaced with a `money` flag set where the row is built, which
cannot drift from a label the way a string test does. `rankRequirements` had the
same fault in its filter and would have silently hidden the row the moment the
rename landed.

**Ground came out of the estate, and it took three attempts to accept.** The
browser showed a held district valued at $258 against a $12,000 laundromat,
because `districtWorth` is a week's takings and the estate wanted a valuation.
Capitalising it at the catalogue's own 30-week payback fixed the scale and broke
`balance > lets careful play build a bigger organization`:

```
weekly figure, capitalised 30x       careful 1.50, greedy 1.71
...with the influence term dropped   careful 1.50, greedy 1.71
...discounted by neighbourhood mood  careful 1.50, greedy 1.63
ground removed from the estate       passes
```

Districts are taken by running operations, and running every operation
available is the entire definition of greedy play. Any valuation of ground
large enough to be worth showing inverts the game's central promise, and three
goes at buying it back moved 1.71 to 1.63.

It was also double counting from the start: the rank table already asks for
districts on their own line. So the estate is what a family **bought** — cash,
what it put away, and the businesses it owns — and what it **took** stays
counted as districts held. The panel shows districts as a count beside the
money, which is what they are.

**Final four-year state:**

```
Crew Leader   31/36  day 156
Capo          10/36  day 631
Underboss      1/36  day 1051
estate         $40,693 median, $1,309,727 best
```

Against this morning: Capo 1/36, Underboss never, best worth $24,908.

## Round 8, and one unresolved test

The rework worked, judged by the only instrument that can judge it. Round 7's
tester ended at Enforcer with 2 districts; round 8's reached **Crew Leader on
day 73 with 5 districts and 3 fronts**, and worked out the district mechanic
unaided — "public feeling is damaged per job, not per dollar" — which they
called the best moment of the run. They named successors off the nav badge.
They finished $4,885 short of Capo on net worth.

Two of the three strategies the bot had to be told, a human found alone. The
third — putting money away — they never discovered.

### The priced-choice audit

Their first MUST FIX: the $12,000 that buys back a hostile district renders
enabled at any balance, and picking it while broke consumes the memo and does
nothing. Confirmed in the code — the choice carries no `disabledReason`, and
`spend` fails silently into a log line.

Audited the class rather than the instance. **Twelve memo choices quote a
price. One of them checked.** That one is the front purchase, guarded after an
earlier playtester called the unexplained failure the game's worst moment — and
the fix was never applied to its eleven siblings. Same shape as the zero-crew
job: a rule understood, written down once, and not carried across.

All eleven now go through one `payable(state, amount, note)` that returns the
hint and the guard together, so a thirteenth cannot be added wrong.

### And it fails `balance > lets careful play build a bigger organization`

careful 1.50, greedy 1.58. The mechanism is understood, which is why it is
recorded rather than tuned away:

The balance bots pick the first choice that is not disabled. `community_friction`
lists `money` first, so a broke bot used to pick it, fail silently and consume
the memo — the district stayed hostile. With the guard, that bot falls through
to `Be seen, personally`, which is free and actually repairs sentiment.

**So fixing the bug helps reckless play more than careful play, because
reckless play is what creates the wrecked districts the repair repairs.**
careful has read 1.50 in every measurement today; greedy moved.

That is a real property of the game and not obviously wrong — a working repair
should help whoever needs repairing. But the pre-committed test says careful
must come out ahead, and it now does not. Two ways out, and it is a design call
rather than a coding one:

1. Accept it and rewrite the test's intent: careful play should beat greedy on
   *heat and win rate* — which both still pass, unmodified — and rank is a poor
   proxy once repairs work.
2. Make the repair cost something careful play has and greedy play does not.
   `Be seen, personally` scales with leadership and is otherwise free; a
   version that costs days or respect would price it against the reckless.

Not resolved. The suite is red on that one test and the defect fix is staying
in, because it was reproduced twice by a cold tester and confirmed in the code.
