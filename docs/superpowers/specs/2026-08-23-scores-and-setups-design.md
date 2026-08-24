# Scores: jobs you have to build before you can do them

**Status: proposal.** Nothing in this document is built. It is written to be
argued with, and every figure in it was measured before it was written rather
than after.

| | proposal |
|---|---|
| New state | `state.scores?: Score[]`, optional and lazily initialised |
| Opening cost | a token in dirty money and one crew member for 28 days |
| Save version | 13, must not move |
| New resolution path | none — setups are `ActiveOperation`s |
| Retrofit surface | all five tier-4 and tier-5 jobs, free ones included — 86% reach |
| Named targets | deferred behind a take-up measurement |

The developer asked for two things in one sentence: jobs that require setup
work before the main job can be done, and heists. This document treats them as
one mechanic, because a heist is precisely a job whose setup is the interesting
part.

---

## 0. What the measurement says first

### 0.1 The stale objection

The reflex objection to retrofitting anything onto the top of the job table is
the paragraph in `config/operations.ts`, which records that "the five jobs
above Capo were shut on 100% of 3,600 measured days."

**That paragraph is stale.** It describes the table as it was when `minRank`
decided visibility. `opens` replaced `minRank`, and the top of the board is
reachable now.

### 0.2 When the surface actually arrives

Two numbers, and the difference between them is the whole placement argument.

    the highest tier the board opens, 36 careers, 300 days
      tier 0   36/36   median day 0
      tier 1   36/36   median day 3
      tier 2   36/36   median day 11
      tier 3   34/36   median day 72
      tier 4   31/36   median day 93
      tier 5    9/36   median day 190

    the PAID tier-4 jobs on their own, 288 careers pooled across 8 probe arms
      board opened one         164/288 (57%)   median day 149
      could ever afford one    155/288 (54%)   median day 150
                                               25th day 105, 75th day 203
      days spent affordable    25th 36 / median 68 / 75th 113

The first table counts `call_in_tribute`, the tier-4 job with no stake, gated
on eight people rather than six fronts. It is why tier 4 reads day 93. The
jobs with a stake worth prepping — `financial_scheme` at $50,000 and
`port_operation` at $54,000 — arrive on **day 149, in 57% of careers**.

**Money is not the wall.** 155 of the 164 careers that see a paid tier-4 job
can pay for it, and the median career can pay on the day it can see. An
earlier draft of this document raised an affordability gap; it was comparing a
day-93 wallet against a job that does not exist until day 149, and it is
withdrawn.

Both dates sit inside the stretch Round 14 described as grinding, and F1 — the
oldest open finding in the project — puts the moment decisions stop changing at
day 90 to 119. **Scores therefore go on all five tier-4 and tier-5 jobs,
including the two with no stake.** That takes reach from 57% to **86%** of
careers and pulls first contact from day 149 back to day 93.

Putting prep on a free job appears to point "capital buys efficiency"
backwards. It does not, because under §2.3 prep is never free: it costs a
crew member for the duration, which is the one bill a broke player can still
pay. The floor rule exists for exactly that player.

### 0.3 One reading in that table is an artefact

The probe prints "Crime Lord: 0/36". `standing()` returns the highest tier the
board opens, capped at 5 because no job declares tier 6, and the probe indexes
that into a seven-entry `RANKS` array. The seventh row can never be reached by
construction. It is a labelling bug in the instrument, not a wall in the game,
and it is recorded here so nobody spends a week trying to open it.

---

## 1. What already exists, and why none of it is enough

Half of this request is expressible in config today. The half that is not is
the half that matters.

**Prerequisites already work.** `OperationDef.opens.met(board)` reads
`OpsBoard`, which carries `opsBy` — a lifetime count of every job ever run. A
job that requires another job first is a config entry and no code at all.

It is also the wrong mechanic, for two independent reasons. `opsBy` is a
lifetime counter, so casing a vault once opens every vault job for the rest of
the career: a permanent unlock, not a caper. And `opGates.test.ts` already
rules that a gate may ask about work already done **only when that work is
worth doing on its own** — three of the original six gates failed exactly that
rule and were rewritten. A setup job that pays nothing and exists to be a
prerequisite fails it by construction.

**Commitments with deadlines already work.** `orders.ts` holds stock back,
counts down days, and settles on the due date. That is the shape a score's
window needs, and it should be copied rather than reinvented.

**A second decision axis already exists.** `APPROACHES` — quiet, straight,
heavy — was built against this same complaint, recorded in its own header: two
playtesters independently reported that the Operations panel stops teaching
anything after the first rank tier. Approaches were the right idea at the wrong
scale. They change how one night goes. They cannot make a month have a shape.

**What is missing is per-instance stage state.** There is no object in this
codebase that can say: *this* score, against *this* target, has three of its
five setups done, one of them was blown, and the window shuts in eleven days.

---

## 2. The design

### 2.1 The score

A score is a job you have decided to do, plus everything you have done to make
it go well, plus a clock.

```ts
interface Score {
  id: Id;
  /** The job at the end of it. An existing `OperationDef.id`. */
  defId: string;
  territoryId: string;
  openedDay: number;
  /** The day the window shuts. Prep is wasted if the job has not run. */
  dueDay: number;
  /** Setup ids completed, in the order they were done. */
  done: string[];
  /** Setup ids attempted and blown. Each one raised alertness. */
  botched: string[];
  /** 0..100, subtracted from the main job's odds. */
  alertness: number;
  /**
   * The man watching the place.
   *
   * Unavailable for anything else until the score fires or the window shuts.
   * This is the real cost of holding a score open, and the reason five of them
   * is a decision rather than a formality.
   */
  manId: Id;
}
```

It lives at `state.scores?: Score[]` — optional, lazily initialised, absent
from `validate()`, and `SAVE_VERSION` does not move. That is the idiom every
late addition to this state already follows — `sitdown`, `promises`, `civic`,
`ledger`, `orders`, `home`, `whispers`, `possessions`, `cards` and `leaks`, ten
for ten.

### 2.2 The setups

Declared per job in `config/operations.ts`, beside the job they belong to.

```ts
interface SetupDef {
  id: string;
  name: string;
  /** One line, in the language of the street rather than of a stat block. */
  blurb: string;
  crewRequired: number;
  investment: number;
  durationDays: number;
  baseSuccess: number;
  attribute: AttributeId;
  heat: number;
  /** What finishing it buys on the main job. */
  gives: { success?: number; payout?: number; crew?: number };
}
```

Roughly three per job, fifteen across the five. They are ordinary work with an
unusual payout: casing the building, buying the floor plan, turning somebody
who works there, arranging a way out, putting a man on the inside a month
early.

### 2.3 How it plays

1. **Open a score** on any tier-4 or tier-5 job the board already allows. It
   costs a token sum in dirty money and **one crew member, assigned to it for
   the whole window**. It runs for 28 days.
2. **The setups become launchable jobs** while the score is open. They go
   through `launchOperation` unchanged — same crew, same territory, same
   approach, same failure consequence table — but they pay nothing and write to
   `done` or `botched` instead.
3. **Hit the job whenever you like.** It reads the score:
   - `successChance += Σ gives.success − alertness/100`
   - `payout ×= Π gives.payout`
   - `crewRequired −= Σ gives.crew`
4. **Or let the window shut.** The score closes, the prep is lost, and nothing
   further is charged. The stakes and the days are already spent; there is no
   second bill.

**Skipping every setup is legal.** The job stays exactly as launchable as it is
today, at exactly today's odds. Prep is a dial, not a gate — which is what
keeps this clear of the `opGates` rule, and what makes the interesting question
*how much prep is this worth* rather than *have I done the chores*.

#### Why the cost is a man and not a fee

Opening had to cost something, or the dominant play is to open all five on the
first eligible day and forget about it. A free option with no downside is a
button, not a decision.

It could not usefully cost money. At day 93 the median career holds $3,499 in
dirty cash and $8,881 clean; any flat fee large enough to be felt is unpayable
by half the careers this feature exists for, which is the `PATRON` shape
arriving through a different door. Charging the scarce resource for an optional
feature means nobody opens one.

A body is the right bill. It is the resource the game is actually short of —
the measured cause of a dead week is a shortage of people, never of money — and
the median career has 9 idle crew at day 93, so one man per score starts to
bite at three or four open scores and not before. It is the same shape as
delegation, which already takes somebody off the board to hold a district. And
it works on the two jobs with no stake without touching the floor rule, because
a player with nobody spare simply runs the job bare at today's odds, exactly as
that rule requires.

**He comes straight back.** A blown setup, a botched score, an expired window —
the man is released immediately, with no cooldown. The cost of failure is the
prep and the days, not a person held hostage to a decision that already went
badly.

#### Where 28 days comes from

Careers hold the paid tier-4 jobs in the open-and-affordable state for a median
of 68 days, 25th percentile 36. A 42-day window would outrun affordability for
a quarter of careers before they could fire. 28 fits inside the 25th
percentile, which is the point: the window should expire because the player was
slow, never because the game moved the job out from under them.

### 2.4 What a blown setup costs

The prep and a warning. A failed setup wastes its stake and its days, takes the
ordinary operation consequence roll — a man hurt, a man arrested, evidence left
— and raises the target's `alertness`, which makes the main job harder. The
score stays open.

The alternative considered and rejected was burning the score outright on one
bad setup. It is tenser and it is a trap: a player who loses a month of
planning to one roll opens exactly one score in a career and never opens
another.

---

## 3. Where it sits in the tick

One new call, and it does almost nothing.

    1.   jobs that finish today resolve first        (existing)
    1a.  the trades move                             (existing)
    1b.  orders hand over                            (existing)
    1b2. scores whose window has shut close          NEW

Beside `tickOrders` and for the same reason: a deadline is a day, not a week.
It reads nothing any other phase writes and writes only its own array, so it
could sit anywhere in the day. It sits here because it is the same kind of
thing as the phase above it.

Setup completion needs no phase at all. A setup is an `ActiveOperation` and it
resolves in phase 1 like everything else; the resolution writes to the score on
its way past.

---

## 4. Three risks, named now rather than discovered later

### 4.1 `opsBy` inflation would unlock the top of the table as a side effect

Setups run through `launchOperation`, which increments `opsBy`. Sixteen careers
in thirty-six end with the *operations count* as their furthest unmet
requirement — it is the single most common thing blocking the top of the board.

A player who runs fifteen setups would therefore find the tier-5 jobs opening
because they planned a tier-4 one. **Setups must not count toward `opsBy`**, and
that has to be a test, not a comment.

### 4.2 Bodies, not money, are what lock a career up

The measured cause of a dead week is already on the record: a fifth of all
weeks had nothing the player could do, and **every one of those weeks was a
shortage of bodies, not money.** A three-man outfit loses its whole roster to
one bad night.

Setups tie crew up for days at a time, and under §2.3 the score itself holds a
man for all 28 of them. At day 93 the median career has 13 crew with 9 idle, so
one score costs a ninth of the spare capacity and three costs a third. That is
the intended bill and it is affordable at the median — but the 25th percentile
has **3 idle crew**, where a single score is a third of everything spare.

"Probably fine at the median" is how the plant got priced off a bot that could
not afford one. This needs a probe arm reporting crew-idle weeks with scores
open against without, and the bar goes on the 25th percentile rather than the
median.

### 4.3 F7 applies to this in full

No bot in this project opens a score, so every existing probe would be blind to
the feature while continuing to report confident numbers about everything
around it. That is the standing failure mode of this codebase, now at 39
recorded instances.

A `RUNS_SCORES` arm is part of the work, not a follow-up to it.

---

## 5. How it gets measured

Paired against `RUNS_300` on the same seeds, per the rule in `HANDOFF.md` §3 —
paired comparisons only, and no bar pointed at a population containing
non-participants.

| question | instrument | bar |
|---|---|---|
| Does an ordinary career ever open one? | share of careers with at least one score opened | 86% of careers reach the surface; the bar goes between median and p75 of the plotted take-up |
| Is prep a decision or a chore? | distribution of setups run per score | must not be bimodal at 0 and all |
| Does it pay? | paired estate gap, filtered to careers that opened one | greater than 0 |
| Does it cost bodies? | crew-idle weeks, scores arm against base, **at the 25th percentile** | no worse than base |
| Did the window ever bite? | share of scores that expired unfired | above 0 and below half |

The second row is the one that decides whether this shipped or failed. If
players run every setup every time, prep is not a decision and this is a chore
gate with extra steps. If they run none, the numbers are wrong.

---

## 6. Phases

**Phase one — the retrofit.** The `Score` object, the setup definitions on the
five existing tier-4 and tier-5 jobs, the panel section, the odds display, and
the probe arm. No new job content.

**Phase two — named targets, deferred.** A bank vault, an armoury, a rail
depot, the records office: each with its own setup list, its own story, and its
own place on a panel of its own. **Deferred behind the phase-one take-up
measurement.** If the median career does not open a score against a job it
already has, writing four new ones it does not have will not help, and the
`PATRON` shape — the best content in the game priced for a run that has already
succeeded — is the specific mistake being avoided.

---

## 7. What this does not do

It does not touch the resolution roll, the consequence table, approaches, heat,
or any existing job's numbers. A player who never opens a score plays exactly
the game that exists today, which is also what makes the paired measurement
mean anything.
