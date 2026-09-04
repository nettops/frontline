# Fun, depth and pacing

Design for the three lowest scores in the sixth blind playtest: Fun 7, Depth 6,
Pacing 6. All three trace to one sentence in that report — *"no new tool being
handed to me to change that rhythm"* between day 60 and day 150.

> **Revised 2026-08-19, after measurement.** Sections 1 to 4 below were written
> from a diagnosis that turned out to be wrong, and the corrected version is in
> **Part Two** at the end of this document. The original text is kept rather
> than edited in place, because the wrong diagnosis was reasonable, was held
> confidently, and is the sort of thing that gets re-proposed by whoever reads
> this next.
>
> The short version: the constraint is not money and never was. It is heat.
> Seventy-three per cent of an organization's life is spent unable to work
> because of attention; territory, bodies and money account for zero days. See
> the plan's Probe results for the numbers.

## The problem, stated once

The tester reached day 179 and never left Enforcer. They were four of five
conditions toward Crew Leader for the last sixty days, blocked entirely on
`cleanCash: 9_000`.

The arithmetic, all of it from config rather than from their report:

- Their one laundromat earned **$365 a week** clean, bought on day 84. That
  alone is twenty-four weeks — day 256.
- Laundering was supposed to be the accelerant. `tickBusinesses` holds the
  coming wage bill back out of dirty cash before washing anything
  (`src/sim/business.ts`, `keepBack = weeklyWageBill(state)`), and at five to
  six crew their job income *was* their wage bill. Their surplus was near zero,
  so the $2,690 of capacity they owned washed almost nothing.

The held-back rule is correct and stays. Laundering money that goes straight
back out the door the same day pays the cut for nothing. The problem is
upstream of it.

**The organization has no economies of scale.** Job income scales with crew;
wages scale with crew; at roughly the same rate. So growth never produces a
surplus, and everything downstream — more ground, a second front, clean money,
rank, and the entire back half of the content — is bought out of a surplus that
does not exist. You cannot grow out of it. You can only get lucky.

That is why the plateau is at day 60 and why it lasts.

Two prior attempts on this are worth recording so nobody repeats them. The
laundering starvation was diagnosed once already and answered with a readout
(`launderOutlook`, and the comment above it says exactly this) — the
explanation shipped and round 6 hit the same wall, so explanation is not the
fix. And the economy floor work before it fixed a *broke* player's inability to
act; it did nothing for a *lean* player's inability to accumulate. These are
different problems and the second one is this document.

---

## 1. The surplus

### 1a. Delegation, which already solves this and nobody uses

A steward earns `DELEGATION.worthPerWeek` (420) × standing × prosperity from a
district **without occupying a body you could otherwise send on a job**. It is
the only income in the game that is not paid for in crew-nights. That is the
economies-of-scale mechanism, already built, already tested.

Round 6 never touched it. Not because it was locked — `DELEGATION.minRoleIndex`
is 2, the enforcer role, which an Enforcer-rank player can appoint. Because of
this, in `src/ui/Rail.tsx`:

```tsx
{entry.id === 'territory' && held === 0 && handOver && <span className="rail-badge">!</span>}
```

The prompt to hand a district over is shown **only to players holding zero
districts** — that is, only to players with nothing to hand over. Taking your
first district suppresses it permanently. Anybody who could actually delegate
never sees the suggestion.

**Change:** the badge fires when you hold ground nobody is running for you,
which is what it was always meant to mean. It coexists with the held-count
badge rather than being replaced by it.

### 1b. Say what a steward is worth before you appoint one

The handover screen states what the district is worth per week against what the
man costs — the same shape as the hire screen, which already states a wage
against income. Today you find out by doing it and waiting a month.

### 1c. Payouts and wages — measured, not adjusted

Raising payouts is the most direct lever on surplus and it is not wrong: at
fixed crew, surplus rises linearly with payout. There is also real evidence the
early game needs it. Round 6 had **$72 on hand at day 30** and missed payroll
twice inside six weeks; a run decided by whether one Protection Racket lands is
noise picking the winner, not earned difficulty.

But a flat payout rise gives a five-man crew and a twenty-man crew the same
proportional gain. The curve gets taller, not differently shaped — still linear
in bodies, still eaten by a wage bill that is also linear in bodies. The
plateau moves from day 60 to perhaps day 75 and does not go away. It is also
strictly free: payout rises, heat does not, so every job improves with no
counterweight. That is the change most likely to raise a playtest score while
the game plays identically, which is the failure mode this project keeps
hitting.

So the numbers are set by measurement, and **the decision rule is committed
here, before the data exists**:

- Sample weekly `income − payroll` across ~30 worlds, bucketed by crew size,
  with a bot playing each job at its best expected value.
- **Flat or negative at every crew size** → structural. Delegation is the fix.
  Payouts change nothing about the shape and are left alone.
- **Negative in weeks 1–8, positive later** → the early game is genuinely
  underpaid. Raise early-tier payouts, or cut early wages, by the measured
  shortfall — not by a round number.
- **Positive throughout and still nobody reaches Crew Leader** → the problem is
  the $9,000 threshold or the conversion rate, not income, and the diagnosis
  above is wrong.

The first two can both come back true. Then do both.

### Deliberately not done

Lowering the $9,000, or raising business revenue. Both make the number arrive
without making the organization work differently.

---

## 2. Unlocks: a second route, not a replacement

`availableOperations` is one line:

```ts
return OPERATIONS.filter((op) => rankIndex(op.minRank) <= rank);
```

It becomes one of two routes. Following the `config/goals.ts` pattern exactly —
config must not import the simulation, so the predicate reads a flattened
summary of the board:

```ts
// src/sim/types.ts
export interface OpsBoard {
  rank: number;
  districtsHeld: number;
  fronts: number;
  crew: number;
  /** Times you have run each job. */
  opsBy: Record<string, number>;
  friendlyHouses: number;
}

// src/config/operations.ts — optional, per job
opens: {
  need: 'Three truck jobs and somewhere to put the load',
  met: (b: OpsBoard) => (b.opsBy.truck_hijacking ?? 0) >= 3 && b.fronts >= 1,
}
```

A job with no `opens` behaves exactly as it does today. Seven entries with one
predicate each; no rewrite.

**Which get one:** the six `crew_leader` operations in `config/operations.ts`,
and the product trade in `config/contraband.ts`, which carries its own
`minRank: 'crew_leader'` and therefore needs the same treatment in its own
file. Those seven are the entire back half of the content and they all sit
behind the same `cleanCash: 9_000`. The point is to decouple content from the
money wall completely, so that the day 60–150 stretch opens even if the work in
section 1 underperforms.

The contraband header rule is untouched by any of this: nothing about how
anything is made, moved or concealed enters the unlock conditions, which are
counts of jobs run, ground held and fronts owned.

**The conditions are specific, never generic.** "Three truck jobs and a front"
opens the Warehouse Job for somebody who has been hijacking trucks. It opens
none of the other five. Content arrives adjacent to how you are already
playing, which is what makes it read as earned rather than granted, and it
means two players get two different second halves.

**Display:** `lockedOperations` already greys these out as visible goals. Each
locked row states whichever route is closer — *"Crew Leader, or three truck
jobs (you have one)"* — so the second route is something to aim at rather than
a surprise.

**The risk, named:** two routes double the balance surface, and if the
behavioural route is easier than the rank route across the board, rank becomes
cosmetic. Specific conditions should prevent it, and it is checkable — the
probe reports how many jobs each world opened by rank versus by behaviour. If
behaviour opens everything first in every world, the conditions are too soft.

`heatScale` continues to key off `minRank`, so a job opened early still draws
the full attention of work above your standing. Arriving sooner should not also
make it quieter.

---

## 3. Work marks people

The recurring decision is *"which two or three jobs can I afford, assign
whoever is free."* This gives it the dimension it lacks: **who you send changes
them**, and you can see what you did without being shown what it moved.

### No new state

`state.operationHistory` already holds every job with its `crewIds`, capped at
200 entries — fifty-plus weeks at a normal rate, and already the source
`informants` reads across 180 days. Standing is derived from it. Nothing new
serialises and `SAVE_VERSION` does not move.

A new leaf module, the same shape as `sim/memory.ts` — takes state and an id,
imports nothing that imports it back:

```ts
// src/sim/standing.ts
const WINDOW = 56;                              // eight weeks
export function nightsWorked(state, npcId): number
export function share(state, npcId): number     // his nights ÷ the crew average
```

### The two marks

Evaluated weekly, in the npc tick. Every threshold and magnitude below — what
counts as above or below the average, and how far each stat moves — lives in a
new `config/standing.ts` alongside the other balance numbers, not in the
simulation. The values are set by the `spread` probe in section 5, not by feel.

**Carrying the work** — `share` well above the crew average. He knows he is
load-bearing. His wage expectation rises, his ambition rises, his claim on the
chair rises, and breaking a promise to him costs more. **He does not become
more loyal.** That is the whole sting: the man who does the most is
simultaneously the most expensive to keep and the most damaging to lose.

**Left on the bench** — `share` well below the average while the crew has been
working. Loyalty drifts down, grievance up, poachable up. Not because you did
anything to him. Because you did nothing with him.

Two new `MemoryKind` entries carry both. That is deliberate: memories are
already read by sit-down reasons, defection, `claimFrom` and goals, so this
feeds four systems that exist, were built for exactly this, and go unmet in
real runs. No new consumers are written.

### The decision it creates

Send your best three every time and you build two or three men who own you and
a tail of resentful ones. Rotate and you take worse odds tonight for a steadier
organization. Neither is free, and it starts biting around day 20 rather than
day 120.

### What the player sees

The record, and only the record.

- **A note for everybody who ran the job.** Today only the hurt and the
  arrested get one (`src/sim/operations.ts`), so a job that goes clean marks
  nobody. `"Third out on the Warehouse Job. It went clean."`
- **A Nights column** in the crew table **and in the assemble panel's crew
  picker**. The raw count over the window — a fact about what you did, not a
  stat about him. The second placement is what makes it a decision rather than
  a diary: the imbalance is in front of you at the moment you are choosing.

### What the player never sees

The memory, the ambition drift, the wage expectation moving. You find out when
he asks for more, or when he does not take it well.

### Where this goes wrong, and the guard

The bench mark punishing a player for holding a reserve — which is a legitimate
thing to do, and which the arrest and injury systems make necessary. So the
bench mark requires all three of: the crew was genuinely busy while he sat, he
is not recently hurt or inside, and he is not newly hired. Three conditions and
a test.

---

## 4. Complicity

Thin. Two sort keys and a bug, reusing `nightsWorked` from section 3. No new
state.

**The sweep is a lottery.** In `src/sim/investigation.ts`, the `arrests` stage
takes `rng.sample(available, count)` — uniformly random names off the payroll.
Weight it by nights worked, and the men the law takes are the men who were
actually out there. This makes section 3's decision bite in a second place:
concentrating the work concentrates the risk. It also converts round 6's lost
soldier from a dice roll into forty days of sending the same man.

**Witnesses are picked by fear alone.** The `witnesses` stage sorts on
`b.stats.fear - a.stats.fear`: whoever looks most likely to talk. Reasonable,
and unconnected to who was there. Blend presence into it — the law goes to
people who were present, and among those, to the breakable ones.

**The bug:** the sweep rolls `ARREST_SWEEP_DAYS` with no `sentenceMultiplier`.
The retainer shortens a sentence from an on-the-job arrest and does nothing for
a man taken in a sweep — the same lawyer giving two answers depending on how he
was picked up. Every site that puts somebody inside applies the multiplier.

---

## 5. Verification

Three probes. Pass conditions are committed here, before the numbers exist,
because this project's standing failure mode is instruments that return
believable numbers while measuring nothing.

| Probe | Measures | Passes if |
|---|---|---|
| **surplus** (extends `floor.probe`) | weekly `income − payroll` bucketed by crew size; day Crew Leader is reached | surplus grows with crew size rather than staying flat, and Crew Leader lands day 70–110 in the median world |
| **grok** (exists) | the week the last new *kind* of move appears | later than its current recorded baseline — the direct measure of the day-60 plateau |
| **spread** (new, small) | share of jobs going to the top three men; how many worlds end with somebody carrying a real grievance from it | the always-best and rotate policies separate. If they do not, the marks are not biting |

The third is the honest check on section 3. If a bot that always sends its best
three ends in the same state as one that rotates, then "work marks people" is a
diary and this document should say so rather than ship it.

The `spread` probe also reports the section 2 check: how many jobs each world
opened by rank versus by behaviour.

All new note and memory text goes through the existing pronoun guard in
`voice.test.ts`.

---

## Scope boundary

Not in this design, deliberately:

- Any change to `cleanCash: 9_000` or to business revenue.
- Job specialisation — repeated work making a man better at that work. It
  rewards the rut the tester was already stuck in, and it makes the obvious
  choice better rather than costlier, which removes a decision instead of
  adding one.
- The `Influence` attribute reading 0 across a 179-day run. Real, unexplained,
  and unrelated to these three scores. It gets its own pass.

---

# Part Two — the revision

Written after Tasks 1 to 4 of the implementation plan, which measured the thing
Part One assumed.

## What was wrong

Part One's diagnosis was that the organization has no economies of scale
because job income scales with crew and wages scale with crew. The first half
is right and the second half is beside the point.

What the measurement found, over 4320 crew-days across 24 careers:

```
started something 25%
too hot 53%
laying low 20%
already doing the solo job 2%
no ground 0%, no bodies 0%, no money 0%, could have and did not 0%
```

Money was never once the reason a day passed without work. Neither were bodies,
and neither was territory. **Heat is the only constraint that binds**, and it
binds for nearly three quarters of every career.

Everything in Part One's section 1 follows from that being false, so all of it
is withdrawn: the payout question, the `worthPerWeek` question, and the framing
of delegation as the economies-of-scale lever. Delegation is still worth having
and the two changes already shipped for it are still right — the prompt that
reached nobody, and the readout that said nothing — but it is worth about $100
a week against a $650 a week hole and it is not the answer.

## The mechanism

> Throughput is capped by heat. Heat is global and does not scale with the
> organization. So every body hired past the point where heat binds is pure
> cost, and the organization gets poorer as it grows.

That is the diseconomy of scale. Peak surplus is at three people because three
people is roughly what the heat budget supports; the fourth adds a wage and no
work.

And the game already has the answer built. `HEAT_BY_RANK_GAP` in
`config/operations.ts` is `[1, 0.6, 0.38, 0.24, 0.15]`, and its comment says
plainly: *"This is the main strategic answer to heat."* Work four ranks beneath
you draws 15% of the attention. It is exactly the right idea.

It is indexed on rank gap alone. Rank was reached in **0 of 24 worlds**. So:

> The only lever against the only binding constraint is gated behind the thing
> that constraint prevents.

Clean money needs throughput, throughput needs heat headroom, heat headroom
needs rank, rank needs clean money. Crew Leader in 0 of 24 worlds is that
circle, measured.

## Section 1, revised — distance, not rank

Keep `HEAT_BY_RANK_GAP` and the whole shape of the mechanic. Change what feeds
the index, from *rank gap* to *how far the work is from you* — of which rank is
one contributor among several the player can actually build.

```ts
// config/operations.ts
export interface Distance {
  /** As now: your rank against the job's. */
  rankGap: number;
  /** The seniority of whoever you sent. Doing it yourself is no distance. */
  sentSeniority: number;
  /** Whether somebody else's name is on the ground it happens in. */
  stewarded: boolean;
  /** How many people stand between you and a street corner. */
  crew: number;
}
export function heatScaleForDistance(d: Distance): number
```

Why this is the right shape rather than simply making heat decay faster:

- **It makes growth pay in the currency that binds.** Hiring currently buys a
  wage bill and an idle body. Under this it buys quiet, which is the only thing
  the organization is actually short of.
- **It is the fiction, exactly.** A boss doing his own shakedowns is a man the
  police can see. A boss four layers back, whose districts have other people's
  names on them, is a rumour. Nothing here needs inventing; it needs connecting.
- **It rewards the systems that already exist and go unused.** Promotion,
  delegation and hiring all become heat decisions, which is a real reason to
  engage with three screens a playtester never opened.
- **It breaks the circle without deleting a gate.** The clean-money threshold
  for Crew Leader stays exactly where it is. What changes is that a player can
  buy headroom with organization instead of only with rank.

**The number to fix by measurement, not by feel:** how much distance each
contributor is worth. The probe already reports "started something 25%" — the
target is that a growing organization moves that figure, and that peak surplus
moves off three people. Both are already instrumented.

**Deliberately still not done:** raising payouts, lowering the $9,000, raising
business revenue, or speeding up heat decay. The first three are refuted by the
measurement. The fourth would work and is the wrong shape: it makes waiting the
answer, and waiting is what 73% of a career already consists of.

## Section 2, revised — unchanged, and now load-bearing

Behavioural unlocks were a second route to content. With rank measured at 0 of
24 worlds they are, for most careers, the *only* route. Build as specified in
Part One. Nothing about the design changes; its priority rises.

## Section 3, revised — same design, later

"Work marks people" is untouched as a design and cannot be built yet.

Forty-six jobs are started in a median 180-day career. At roughly two crew per
job that is about 92 crew-nights spread over 26 weeks and 5 to 7 people —
around four nights each inside the eight-week window `share` is measured over.
A ratio built on four events is noise, the marks would fire on rounding, and
the `spread` probe would report two policies as indistinguishable when what it
had actually measured was that neither policy had enough material to act on.

So section 3 follows section 1. Once throughput moves, the same mechanic has
something to read. If throughput does not move, section 3 should not be built
at all, and that is the honest outcome rather than a disappointing one.

## Section 4, revised — same design, later, and one part now doubtful

Complicity depends on the same `nightsWorked` figure and inherits the same
problem, so it follows section 1 for the same reason.

One part needs re-thinking rather than re-scheduling. Weighting the arrest
sweep toward the people who were out most was meant to convert a dice roll into
a consequence. The measurement shows 1.9 of 7 crew are already injured or in a
cell at any moment, and that arrests are *not* what binds throughput — bodies
were never the reason a day passed without work. Concentrating arrests on the
few people who do work would bite considerably harder than intended in a world
where working is already the rare state. Revisit the weighting once section 1
has moved throughput, and size it against the new figure.

The `sentenceMultiplier` bug in the sweep is unrelated to any of this and should
be fixed on its own: the same retainer currently gives two different answers
depending on how a man was picked up.

## Sequence

1. Section 1 — distance instead of rank gap. Re-run the surplus and why-not-
   working probes; the target is that "started something" rises and peak
   surplus moves off three crew.
2. Section 2 — behavioural unlocks.
3. Re-measure. If throughput has not moved, stop and re-open this document
   again rather than building on it.
4. Sections 3 and 4.
