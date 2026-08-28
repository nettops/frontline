# The file that never closes

**Status: proposal.** Every figure was measured after the heat work landed;
instrumentation was temporary and has been reverted, `tsc -b` is clean.

| | proposal |
|---|---|
| Change 1 | evidence a case holds goes stale like everything else |
| Change 2 | `visibility` is gated on `momentum`, as `work` already is |
| Change 3 | a cold case decays as a share of its own strength |
| Save version | 13, unmoved — balance and one skipped line |
| Unblocks | the trades, the laundering ceiling, scores-and-setups |

One case in 795 ever closes. This document is about why, and it turns out to be
four lines of code rather than a balance problem.

---

## 0. What the measurement says

### 0.1 The case file only goes up

Four-year careers, 17,051 case-weeks, after the heat work.

    mean open case strength   94.6      (of 100)
    peak case strength       100.0      every career
    cases opened               795
    closed by decay              1
    case-weeks cold            13%
    weeks a career on retainer 127 of 159 spent under investigation

    what moves a case, per case-week
      evidence absorbed   +10.98
      their own work       +1.79
      being visibly loud   +2.20
      decay                -0.24
                           ------
      net                 +14.73

**Inflow beats outflow 62 to 1.**

### 0.2 It got worse when the game got better

The same figures before the heat work, for comparison:

                          before     now
      mean heat            76.2      57.4
      mean open case       85.4      94.6
      evidence absorbed   +8.62    +10.98
      decay               -0.24     -0.24
      weeks on retainer  12 of 97  127 of 159

Heat fell by a quarter and the case file got *worse*, because a richer, busier
family runs more jobs, holds more people and owns more fronts — and every one
of those is a source of traces. **The counterplay is now bought and still
loses**: counsel is retained for 80% of the weeks a case is open, against 12%
before, and absorption rose anyway.

### 0.3 A cold case grows

This is the finding the whole document rests on.

    5,234 cold case-weeks
      their own work      +1.61
      being visibly loud  +2.07   ← ungated by momentum
      decay               -1.80
                          ------
      net                 +1.88

    cold weeks in which the case still GREW:  90.4%

`COLD_CASE_AFTER_DAYS` and `COLD_CASE_DECAY_PER_WEEK` exist to let a player
starve an investigation. The mechanism fires — 13% of case-weeks are cold — and
**in nine of ten of them the case gets stronger anyway.**

### 0.4 And no evidence a case has touched ever dies

    traces alive at the end:              98
    of which held by at least one case:   98   (100%)

---

## 1. Why

### 1.1 An absorbed trace is immortal

`decayEvidence`, in full:

```ts
for (const trace of Object.values(state.evidence)) {
  if (trace.attachedTo.length > 0) continue;
  if (state.day - trace.day < EVIDENCE_STALE_AFTER_DAYS) continue;
  trace.strength -= EVIDENCE_DECAY_PER_WEEK;
  if (trace.strength < EVIDENCE_WORTHLESS_BELOW) delete state.evidence[trace.id];
}
```

**Line two.** A trace any case is holding is skipped forever. It is released
only by `closeCase`, and one case in 795 closes.

The intent is coherent and is stated in `closeCase`: *"The trail dies with the
case. Anything no other agency is still holding is gone for good."* Evidence
lives while somebody is working it and dies when they give up. That is a good
rule **in a game where cases end**. Here it is a circle: traces do not decay
because cases hold them, and cases do not close because evidence keeps arriving.

The measured consequence is that 100% of surviving evidence is permanent, and a
case opened in year four absorbs year-one traces at their original strength.

### 1.2 `visibility` walks past the brake

    const momentum = absorbed > 0 ? 1 : clamp((state.org.heat - MOMENTUM_HEAT_FLOOR) / 50, 0, 1);
    const work = agency.skill * diff.heatGain * keptOut * momentum * ...;
    const visibility = state.org.heat * HEAT_EVIDENCE_CONTRIBUTION;
    investigation.strength += work + visibility;

`work` is multiplied by `momentum`. `visibility` is not. So the term meant to
represent *ambient attention* — the reason they are looking, not something they
found — is the one term a player cannot starve.

At 2.07 a week it alone exceeds `COLD_CASE_DECAY_PER_WEEK` of 1.80. **A case
that has correctly gone cold still grows on visibility alone.**

The comment directly above this code diagnoses the identical bug in an earlier
form and says the fix "walked straight past it". That fix was applied to
`lastProgressDay`, so the case now goes cold on schedule and then keeps growing.

### 1.3 Counsel cannot reach it either

`evidenceMultiplier` scales `absorbed` and `work`. It does not scale
`visibility`. So the most expensive counterplay in the game structurally cannot
touch 2.20 of the 14.73 points a case gains each week — and it is bought for 127
weeks of a career now, which is why "retain a lawyer" reads as doing nothing.

---

## 2. The changes

### 2.1 Evidence a case holds goes stale like everything else

Delete the `attachedTo.length > 0` skip. Old crimes go cold whether or not
somebody has the file open, which is both the fiction and what
`EVIDENCE_STALE_AFTER_DAYS` already says.

**This does not reduce any case's current strength**, because
`investigation.strength` is a running total that banked the points when the
trace was absorbed. What it does is stop the pile being a permanent archive: a
new agency opening a case in year four finds year-one evidence worth almost
nothing, and `looseEvidence` stops reporting a decade of history as live.

Traces held by a case should probably decay *slower* than loose ones — somebody
is actively working them — so this wants a multiplier rather than the same rate.
The figure is not proposed here; it gets plotted.

### 2.2 Gate `visibility` on `momentum`

    const visibility = state.org.heat * HEAT_EVIDENCE_CONTRIBUTION * momentum;

One line. Ambient attention is why they are looking; it is not something they
found, and a player who has genuinely gone still should not be feeding it.

On its own this takes the cold-case net from +1.88 to about +1.16 at the
measured heat — **still positive**, which is why it is not sufficient alone.

### 2.3 A cold case decays as a share of its own strength

`COLD_CASE_DECAY_PER_WEEK` is a flat 1.80. A file at 100 with nothing new in it
sheds the same as a file at 10, so the strongest cases — the ones a player most
needs to be able to starve — are proportionally the hardest to kill. From 100 to
`CASE_CLOSED_BELOW` of 6 is 52 weeks of perfect silence even with nothing
opposing it.

This is the same defect the heat meter had, and it takes the same repair: decay
as a share of the load. The coefficient gets plotted against the case-strength
distribution, not picked.

**Order matters.** 2.2 before 2.3, because 2.3's coefficient has to be fitted
against a cold case that is no longer being fed by visibility.

---

## 3. What this is expected to unblock

Three open problems trace back to this file, all measured:

**The laundering ceiling.** `FINANCIAL_LAUNDER_PENALTY` halves capacity
whenever a case reaches the financial stage, and that stage is live on **71.3%
of days**. Capacity is the wall between trade income and standing.

**The trades not paying.** A trading career earns $2,655,277 and ends with a
*smaller* estate than one that never touches contraband, because only $1.63M can
be washed and `estate` never counts dirty money. Two probe tests currently fail
on this and should not be closed any other way.

**Scores and setups.** The heist design's disposal phase writes evidence when
gear is recovered. That is a good rule pointed at a meter pinned at maximum; it
becomes a real consequence only once the pile can drain.

---

## 4. How it gets measured

| question | instrument | bar |
|---|---|---|
| Do cases close? | closed-by-decay against opened | well above 1 in 795 |
| Can a quiet career starve one? | net movement in cold weeks | negative |
| Is pressure still real? | mean open case strength | clearly below 94.6, clearly above 0 |
| Does counsel do anything? | paired case strength, retained against not | lower |
| Is the trade unblocked? | the two failing probe tests | passing without their bars moving |

**The third row is the one to watch.** A game where no case ever closes and one
where every case closes are both broken, and the second is easier to ship by
accident.

**F7 applies.** No probe bot goes quiet in response to pressure — it never lays
low, and it retains counsel on a fixed rule rather than a reactive one. A
repaired starvation mechanic could read as no change at all. An arm that reacts
to a case is part of this work.

---

## 5. Risks

**Over-correction into no law at all.** 95% of careers are indicted today. If
that goes to 5% the game has lost its only real antagonist. The bar is a
distribution, not a direction.

**The economy moves again.** Cases restrict laundering, laundering gates the
estate, the estate is what everything is measured against. Expect the trades to
swing hard and every money bar to need re-reading — the same re-baselining the
heat change required, and it should be budgeted rather than discovered.

**Change 2.1 alone looks like it does nothing.** It does not touch any existing
case's strength. Its effect is on cases opened *later*, which a 300-day probe
sees weakly and a four-year one sees clearly. Judge it on the four-year arm.

---

## 6. What this does not touch

`EVIDENCE_ABSORPTION`, the agency focus lists, the stage ladder, arrests, the
trial, and `addEvidence`'s call sites all stay as they are. The traces being
written are not the problem — 76% of them come from violence and informants and
that is correct. The problem is that nothing ever takes one away.

Save format, state shape and `SAVE_VERSION` are untouched.
