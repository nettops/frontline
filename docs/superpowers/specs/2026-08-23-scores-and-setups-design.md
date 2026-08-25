# Scores: jobs you have to build before you can do them

**Status: phase one built, 24 Aug 2026.** Revised earlier the same day after the
heat and evidence work, which changed both the numbers this rests on and whether
the central mechanic had anywhere to land. What shipped is in
`config/scores.ts`, `sim/scores.ts`, the setup branch of `sim/operations.ts`,
the Operations panel, `scores.test.ts` and the `RUNS_SCORES` arm of
`ladder.probe.test.ts`. §8 records what the arm measured and what it changed.

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

---

## 8. What the arm measured, and what it moved

> **Every figure in sections 8 and 9 was measured before the probe bot itself
> was repaired.** That bot stood still on two days in five. Section 11 carries
> the corrected readings; the sections below are left as they were written,
> because what was believed at the time is the point of the record.

Thirty-six careers, 300 days, the same seeds as every other bar in
`ladder.probe.test.ts`, against the same bot with the feature switched off.

### 8.1 Take-up

    careers opening at least one score   35/36
    first score, 25th / median / 75th    day 70 / 89 / 141
    opened 437 · 245 reached the night · 148 expired · 421 targets run bare
    setups 2,080 run, 1,319 landed
    pieces in hand on the night   0:3  1:2  2:2  3:202  4:2  5:34

Day 89 is the day the tier-4 board opens, which is what §0.2 asked for.

### 8.2 The mechanic itself

    odds at launch, prepared   61%   (245 nights)
                        bare   43%   (421 nights)
    bodies sent, prepared 3 against bare 4
    the groundwork bill, median career $62,933

**This is the row that matters.** The same targets done two ways, and a
prepared night is eighteen points better with one fewer man in it.

### 8.3 What it costs the career, and why no bar sits on it

    estate difference, 25th / median / 75th
      -$592,941 / -$61,322 / +$330,715
    careers that came out ahead   17/35
    heat-weeks                    -34

The first version of the fourth test asserted `pairedGap > 0` on the estate. A
sweep of the setup stakes at 100%, 50%, 25% and 10% returned **-61,322 /
+81,306 / -61,322 / +68,318** — two different stake scales giving the same
figure to the dollar, and no trend at all.

That is the median of thirty-five paired career differences landing on one
career, and which career that is moves for reasons unrelated to what is being
swept. **The median of this quantity at n=36 cannot price this feature**, and a
bar on it would have been a coin flip wearing a threshold — instance 40 of the
project's standing failure mode, caught by sweeping rather than by reasoning.

So the stakes stayed where the fiction put them, and the bars moved to
quantities the arm can carry: the night goes better, at least a third of
careers come out ahead, and not all of them do.

### 8.4 What the measurement changed

Two defects and two mispricings, all found by the arm and none visible without
it.

**A second job could spend the same kit.** `scoreOn` returned running scores as
well as open ones, so a second launch against the same target picked up the same
gear, took the same crew discount, and whichever job resolved first closed the
score out from under the other. The probe reported 632 prepared jobs against 479
scores, which is how it was found.

**The bot ran 143 jobs bare with the gear three days away.** `setupsLeft`
excludes setups that are currently out, so on its own it reads "everything is
running" as "everything is done".

**Setups were priced as jobs rather than as groundwork.** They failed 47% of the
time at moderate and high risk, paid nothing, and cost days and bodies. Now all
five are `risk: 'low'`, cheaper, shorter, and land 63% of the time. The paired
estate gap moved from -$396,479 to roughly zero on that change alone.

**The gear was too weak for what it cost.** Odds contributions and crew relief
both went up; a full kit is now +43 points and four fewer bodies.

## 9. Why windows shut

"A third of scores expire" is a number with at least six meanings, two of which
are defects and four of which are the feature working. So the expiry reason was
sampled on every day of every open score and tallied at the moment it shut.

    148 of 437 windows shut. On the last day —
      too hot to work    53
      ready, not picked  42
      laying low         33
      still preparing    11
      could not stake it  5
      nobody to send      4

    across every day a doomed score ever stood (3,996 days) —
      too hot to work    39%
      still preparing    21%
      ready, not picked  18%
      laying low         14%
      nobody to send      6%
      could not stake it  2%
      came off the board  1%

### 9.1 Two of them were the game taking the window away

§2.4 says a window expires because the player was slow, **never because the
game moved the job out from under them**. Two entries in that list are exactly
that, and both were live before this feature shipped.

**Going dark.** `canLaunch` refuses anything but quiet work while laying low,
and `LAY_LOW_DURATION_DAYS` is 14 — precisely half a window. A player who takes
the correct cure for heat lost the month of planning for it, which is round
13's complaint with a deadline bolted on: *the punishment for heat is not
danger, it is 14 days of pressing +1 week.* `tickScores` now stops the clock
while the family is dark, and moves the held man's timer with it.

**The gate behind the target shutting.** `opens` reads live state — fronts
running, ground held, who owes you — so a front closing or a favour lapsing
could take the job away from somebody who had already put a man and most of a
month into it. `canLaunch` never checked `opens`, so the simulation always
allowed it; the board was the only thing saying no.
`availableOperations` now holds a scored target on the board.

Both are guarded by bars in the probe rather than by prose.

### 9.2 One of them was the instrument

**"Ready, not picked" is the probe, not the game.** 533 of those 693 days —
77% — were the bot breaking out of its own job loop over a job it could not
crew, while a ready, fully staffable score target sat further down a list
sorted by expected value rather than by bodies. That `break` should be a
`continue`. It is left alone: it is a defect in the bot, every pre-committed
bar in that file was set against a bot that does it, and changing it is its own
piece of work with its own re-baselining.

### 9.3 Heat is deliberately not paused

Two days in five is the largest single entry, and it is not caused by this
feature. Paired against the same bot with scores switched off:

    weeks too hot or dark, share of all weeks
      building up to jobs   31% / 44% / 52%
      never preparing       29% / 40% / 52%

The family lives in that weather either way. And heat is not a wall: at 85 the
odds carry a 25-point penalty and nothing is refused, so working through it is
a bad decision rather than a refusal — a clock that paused for that would be
pausing for a choice the player is free to make.

A score expiring because you spent its month getting too hot to move is the
feature working. It says you built up to a big job and then made yourself
unable to run it.

### 9.4 Where it landed

    windows shut     148/437 (34%)  →  116/414 (28%)
    came off the board       1%     →  0
    laying low, last day     33     →  1
    estate difference, median  -$61,322 → -$61,485

Of the 116 that remain, 34 are the probe's `break` and the other 82 — 20% of
all scores opened — are the player: too hot because of what they did, unable to
stake it, nobody to send, or still preparing on the last morning.

---

## 10. Still open

**~~The probe's `break`.~~** Done — §11.

**Phase two stays deferred.** The take-up bar is met, so named targets are no
longer blocked by §6's condition; they are simply not built.

---

## 11. The instrument was wrong underneath all of it

Everything above was measured through `ladder.probe`'s bot, and that bot's job
loop ended:

    for (const def of options) {
      const bodies = crewNeeded(state, def);
      if (idle(state).length < bodies) break;

`options` is sorted by expected value, not by how many bodies a job needs. So
one twelve-man job at the top of the list stopped every cheaper job below it
from being considered, and on a day the family could not crew its best option
it did nothing at all. Because the best option gets bigger as the board opens,
the freeze deepened over a career.

    jobs launched per career, median   before day 90 / 90-179 / 180+
      with the break                        46 / 22 / 21
      with continue                        109 / 84 / 94
    days the job loop ran and launched nothing
      with the break                   116 of 300
      with continue                      0

Found while diagnosing section 9's "ready, not picked". Recorded there as the
instrument's fault and then fixed, along with the second thing it was hiding.

### 11.1 The bot had no answer to heat, and that was the bigger half

With the freeze gone the bot worked every day, and mean heat went from 56.8 to
**65.4** with **0 of 804** cases ever closing. Its rule at 70 was to *stop* —
which is the worst answer available, because it loses the income and does not
get the accelerated decay either. Round 13's loudest complaint was that the
punishment for heat is fourteen days of pressing +1 week, and this bot was
doing exactly that on purpose. F7 in full: no instrument in this project had
ever laid low.

The same 70 now triggers `startLayLow` instead of a wait. No new threshold —
the number was already the bot's.

**The first version of that kept working on quiet jobs while dark**, since
`canLaunch` allows it. Mean heat went to **98.9**. `addHeat` resets
`quietDays`, so a family that runs one quiet job a day while dark pays the
respect and never cools — which is what `canLaunch`'s own comment says keeps
quiet work a decision rather than a free lunch. The bot was taking the lunch.
Going properly dark brought mean heat to **57.4** while doing five times the
work of the frozen bot.

### 11.2 What that did to this feature

    take-up               35/36 careers   ->  36/36
    first score, median   day 89          ->  day 67
    windows shut          116/414 (28%)   ->  12/594 (2%)
    prepared night        59% odds        ->  58%
    bare night            43%             ->  42%
    bodies, prepared/bare 3 / 4           ->  3 / 4

**Section 9.3 needs correcting.** It argued heat should not pause the clock,
and that a score dying of heat was the feature working — measured against a bot
with no answer to heat, where "too hot to work" was 40% of every day a doomed
score lived. With the counterplay it is **3%**, and expiry is almost entirely
money: 9 of the 12 remaining windows shut because the family could not stake
the job.

The conclusion stands and the evidence for it does not. Heat still should not
pause the clock — it is a choice and not a refusal — but the case for that is
now that a player with the counterplay barely meets it, rather than that
meeting it is a fair punishment.

### 11.3 Three bars are red and stay red

The fixed instrument reports three things the frozen one could not see. All
three are pre-committed targets whose own comments forbid moving them, and all
three are config work rather than probe work.

**The union owes every career** — 36 of 36, whatever they do. A subscription
rather than a relationship.

**The alderman owes nobody** — 0 of 36, down from 14. He reads mean sentiment
across worked districts, and working a district is what costs sentiment, so his
favour is the one thing in this game that gets further away the more you play.
`config/civic.ts` already predicted he would need "a sharper input"; this is it.

**The Kingpin names 35 careers in 36.** `SHAPE_BARS.kingpinDistricts` is 4 and
the district count has collapsed to a point mass — 35 careers hold exactly 4,
one holds 3. No value of that bar separates anybody. It needs a reading with
spread in it, not a re-plot.

Recorded at each bar and in `config/civic.ts` and `config/legacy.ts`.
