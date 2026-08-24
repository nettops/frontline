# Scores: jobs you have to build before you can do them

**Status: proposal. Nothing here is built.** Revised 24 Aug 2026 after the heat
and evidence work, which changed both the numbers this rests on and whether the
central mechanic has anywhere to land.

| | proposal |
|---|---|
| New state | `state.scores?: Score[]`, optional and lazily initialised |
| Opening cost | a token in dirty money and one crew member for 28 days |
| What setups yield | **things** — masks, a vehicle, clean guns, a floor plan |
| What happens after | the gear is discarded, and badly-discarded gear is found |
| Retrofit surface | all five tier-4 and tier-5 jobs, free ones included |
| Save version | 13, unmoved |
| Was blocked by | the evidence pile. **Unblocked** — see §0.4 |

---

## 0. What the measurement says first

### 0.1 The stale objection

`config/operations.ts` records that "the five jobs above Capo were shut on 100%
of 3,600 measured days." That describes the table as it was when `minRank`
decided visibility. `opens` replaced it, and the top of the board is reachable.

### 0.2 When the surface actually arrives

Re-measured after the heat and evidence work. 36 careers, 300 days, default
policy.

    the highest tier the board opens
      tier 3   36/36   median day 70
      tier 4   35/36   median day 89
      tier 5   18/36   median day 211

    the tier-4 and tier-5 jobs WITH A STAKE, on their own
      board opened one    32/36    25th 112 · median 140 · 75th 189
      could afford one    32/36    25th 112 · median 140 · 75th 189

**Money is no longer a gate at all.** Every career that can see a paid job can
pay for it, on the same day. An earlier draft of this document raised an
affordability gap; it was comparing a day-93 wallet against a job that did not
exist until day 149, and it is withdrawn.

Reach also moved: the paid jobs opened for 57% of careers before the heat work
and open for **89%** now, arriving at day 140 rather than 149.

Both dates sit inside the stretch round 14 described as grinding, and F1 puts
the moment decisions stop changing at day 90 to 119. **Scores go on all five
tier-4 and tier-5 jobs, including the two with no stake**, which pulls first
contact back to day 89.

Prep on a free job appears to point "capital buys efficiency" backwards. It does
not, because under §2.4 prep is never free: it costs a crew member for the
duration, which is the one bill a broke player can still pay.

### 0.3 One reading in that table is an artefact

The probe prints "Crime Lord: 0/36". `standing()` returns the highest tier the
board opens, capped at 5 because no job declares tier 6, and the probe indexes
that into a seven-entry `RANKS` array. The seventh row can never be reached by
construction. It is a labelling bug in the instrument, not a wall in the game.

### 0.4 The thing that was blocking this is fixed

An earlier revision parked this work because its central consequence — gear the
police recover, writing evidence — pointed at a meter pinned at maximum. One
case in 795 ever closed, mean open strength was 94.6 of 100, and a cold case
grew in 90.4% of the weeks it was cold.

**That is repaired.** Held evidence now goes stale, `visibility` is gated on
`momentum`, and cold decay is a share of the file. A case starved for a year
closes; before, forty weeks of silence took a file from 60 to 89.

So evidence can now be spent as well as earned, and the disposal phase below is
a real consequence rather than a number added to a full bucket.

---

## 1. What already exists, and why none of it is enough

**Prerequisites already work.** `OperationDef.opens.met(board)` reads `opsBy`, a
lifetime count of every job run. A job that requires another first is a config
entry and no code.

It is also the wrong mechanic twice over. `opsBy` is a lifetime counter, so
casing a vault once opens every vault job for the rest of the career — a
permanent unlock, not a caper. And `opGates.test.ts` rules that a gate may ask
about work already done **only when that work is worth doing on its own**; a
setup that pays nothing and exists to be a prerequisite fails that by
construction.

**Commitments with deadlines already work.** `orders.ts` holds stock back,
counts down, and settles on the due date. That is the shape a score's window
needs.

**A second decision axis already exists.** `APPROACHES` — quiet, straight,
heavy — was built against this same complaint. It changes how one night goes. It
cannot make a month have a shape.

**What is missing is per-instance stage state.** Nothing can say: *this* score,
against *this* target, has three of five setups done, one blown, and eleven days
left.

---

## 2. The design

### 2.1 The score

```ts
interface Score {
  id: Id;
  /** The job at the end of it. An existing `OperationDef.id`. */
  defId: string;
  territoryId: string;
  openedDay: number;
  /** The day the window shuts. Prep is wasted if the job has not run. */
  dueDay: number;
  /** Gear in hand for this score. Spent when it fires. */
  kit: string[];
  /** Setups attempted and blown. Each one raised alertness. */
  botched: string[];
  /** 0..100, subtracted from the main job's odds. */
  alertness: number;
  /** The man watching the place, unavailable until it fires or expires. */
  manId: Id;
}
```

`state.scores?: Score[]` — optional, lazily initialised, absent from
`validate()`, `SAVE_VERSION` unmoved. The idiom every late addition to this
state follows.

### 2.2 Setups yield things, not modifiers

This is the part that changed. An earlier revision had setups grant an abstract
bag — `gives: { success, payout, crew }`. They yield **gear**:

```ts
interface SetupDef {
  id: string;
  name: string;
  blurb: string;
  crewRequired: number;
  investment: number;
  durationDays: number;
  baseSuccess: number;
  attribute: AttributeId;
  heat: number;
  /** What you come away with. */
  yields: GearId;
}
```

Unmarked weapons. A getaway vehicle. Outfits. Masks. A floor plan. Somebody
inside.

The fiction picks the right levers by itself, which the modifier bag never did.
None of those five things is naturally "you get paid more" — a vehicle is about
getting out, masks are about not being identified, clean guns are about not
leaving a trail. Payout multipliers are gone from the design entirely, and with
them the pressure that was dragging prep toward being a money printer.

**Gear does not persist between scores.** It is used on the job and then got rid
of. That is the developer's call and it is the better one: it means there is no
permanent kit to assemble, so the second target costs as much work as the first,
and a career cannot solve prep once.

### 2.3 Getting rid of it is the third phase

The job is not over when the job is over.

Gear used on a score is discarded, and **discarding it can go wrong**. What the
police recover is written through `addEvidence` — which carries `npcIds`, so a
recovered vehicle names the specific men who were in it. That feeds arrests, the
informant gate, and every memory those men form about you afterwards.

Three things decide whether it is done properly, and all three read state that
already exists:

**District control where the score ran.** Dumping a car in a district you
dominate is clean; dumping it where the law watches is not. This gives ground a
job it does not currently have, and it means the choice of *where* has a tail
three days after the job.

**The approach.** Heavy uses more gear and leaves more witnesses to it going in
the river. So quiet-versus-heavy acquires a consequence that arrives late.

**Whether the job succeeded.** Eight men running from a blown port operation are
not carefully burning overalls. A failed score therefore punishes twice — once
now, and once when the case opens.

Deliberately **not** included: a purchasable disposal setup, which is a tax you
always pay, and crew skill, which is a fifth roll on a night that has enough.

### 2.4 How it plays

1. **Open a score** on any tier-4 or tier-5 job the board allows. It costs a
   token in dirty money and **one crew member, assigned for the whole window**.
   It runs 28 days.
2. **Its setups become launchable jobs.** They go through `launchOperation`
   unchanged — same crew, same territory, same approach, same failure
   consequences — but they pay nothing and yield gear.
3. **Hit the job whenever you like.** It reads the kit: each piece of gear moves
   the odds, the crew requirement, or the consequence table, and `alertness`
   subtracts from the odds.
4. **Then get rid of the gear**, which is where §2.3 happens.
5. **Or let the window shut.** The score closes, the gear and the days are lost,
   the man comes back, nothing further is charged.

**Skipping every setup is legal**, at the job's current odds. Prep is a dial,
not a gate — which keeps it clear of the `opGates` rule and makes the question
*how much prep is this worth* rather than *have I done the chores*.

#### Why opening costs a man

A free option with no downside is a button, not a decision — the dominant play
would be to open all five on the first eligible day.

It could not usefully cost money. At day 93 the median career holds $3,499 dirty
and $8,881 clean; any flat fee large enough to be felt is unpayable by half the
careers this exists for, which is the `PATRON` shape by another door.

A body is the right bill. It is the resource the game is short of — the measured
cause of a dead week is a shortage of people, never of money — and the median
career has 9 idle crew at day 93, so one man per score bites at three or four
open scores and not before. It is the same shape as delegation. And it leaves
the two jobs with no stake alone, because a player with nobody spare simply runs
the job bare, exactly as the floor rule requires.

**He comes straight back** on a blown setup, a botched score or an expired
window. Failure costs the prep and the days, not a person held hostage.

#### Where 28 days comes from

Careers hold the paid tier-4 jobs in the open-and-affordable state for a median
of 68 days, 25th percentile 36. A 42-day window would outrun affordability for a
quarter of careers. 28 fits inside the 25th, so a window expires because the
player was slow, never because the game moved the job out from under them.

### 2.5 What a blown setup costs

The prep and a warning. It wastes its stake and days, takes the ordinary
consequence roll, and raises `alertness`. The score stays open.

Burning the score outright on one bad setup was considered and rejected: a
player who loses a month of planning to one roll opens exactly one score in a
career.

---

## 3. Where it sits in the tick

    1.   jobs that finish today resolve      (existing — setups resolve here)
    1a.  the trades move                     (existing)
    1b.  orders hand over                    (existing)
    1b2. scores whose window has shut close   NEW

Beside `tickOrders`, and for the same reason: a deadline is a day, not a week.

Setup completion needs no phase — a setup is an `ActiveOperation` and resolves
in phase 1 like everything else, writing its gear into the score on the way
past. Disposal resolves with the main job, in the same phase.

---

## 4. Risks

### 4.1 `opsBy` inflation

Setups run through `launchOperation`, which increments `opsBy`, and two live job
gates read it — `fence_goods >= 5` and `freelance_muscle >= 6`. **Setups must
not count**, and that has to be a test.

*An earlier revision justified this risk with "sixteen careers in thirty-six end
blocked on the operations count". That came from the probe's `blockedBy`, which
scored careers against the deleted rank table. Both have since been removed and
the claim is withdrawn. The risk survives on two gates, not on the whole board.*

### 4.2 Bodies, not money

The measured cause of a dead week is a shortage of people. Setups tie crew up
for days and the score holds a man for all 28. The median career now has 31 crew
at day 300, so this probably holds — but "probably" is how the plant got priced
off a bot that could not afford one. It needs a probe arm reporting crew-idle
weeks, and the bar goes on the 25th percentile.

### 4.3 F7 applies in full

No bot opens a score, so every existing probe would be blind while continuing to
report confidently about everything around it. A `RUNS_SCORES` arm is part of
the work.

The precedent is now direct: the money-sink tier shipped with a shopping arm in
the same pass, and the first pricing was **wrong in a way only that arm could
show** — the yacht was bought zero times in thirty-six careers. Without the arm
it would have shipped looking fine.

---

## 5. How it gets measured

Paired against the same seeds, participants only, per `HANDOFF.md` §3.

| question | instrument | bar |
|---|---|---|
| Does an ordinary career open one? | share opening ≥1 score | plotted, between median and p75 |
| Early enough to be lived with? | median day of first score | well before the last fortnight |
| Is prep a decision or a chore? | setups run per score | not bimodal at 0 and all |
| Does it pay? | paired estate gap, participants only | ≥ 0 |
| Does it derisk? | crew lost on prepped against unprepped jobs | lower |
| Does disposal bite? | evidence written by recovered gear | above 0, and below the pile's own drain rate |

The last row is new and is the one the evidence work makes possible. Gear
recovery must be visible in the case file without re-pinning it — the meter now
drains, and this must not undo that.

---

## 6. Phases

**Phase one — the retrofit.** The `Score` object, gear, disposal, setup
definitions on the five existing tier-4 and tier-5 jobs, the panel, the odds
display, and the probe arm. No new job content.

**Phase two — named targets, deferred.** A bank vault, an armoury, a rail depot,
the records office. **Deferred behind the phase-one take-up measurement.** If the
median career does not open a score against a job it already has, writing four
it does not have will not help.

---

## 7. What this does not do

It does not touch the resolution roll, the consequence table, approaches, heat,
or any existing job's numbers. A player who never opens a score plays exactly
the game that exists today, which is also what makes the paired measurement mean
anything.
