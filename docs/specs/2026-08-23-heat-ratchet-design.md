# The heat ratchet

**Status: proposal, ready to build.** Every figure was measured before it was
written. All instrumentation was temporary and has been reverted; `tsc -b` is
clean and no source file has changed for this document.

| | proposal |
|---|---|
| The change | heat decay becomes a share of current heat, `heat × 0.026` a day |
| Replaces | `HEAT_DECAY_PER_DAY × HeatTier.decayMultiplier` on the base decay path |
| Save version | 13, unmoved — this is balance |
| Blast radius | median estate ×2.75, surviving crew ×4, every probe bar |
| Does **not** fix | investigations. Measured, and it is a separate spec |
| Blocks | the scores-and-setups spec, now parked behind the evidence work |

This began as a question about heists. Prep and disposal needed recovered
evidence to mean something, so the evidence pile got measured, and the pile
turned out to be full. Following that upstream produced everything below.

---

## 0. What the measurement says

### 0.1 Heat does not live in its own range

74,585 career-days, 300-day careers, pooled across the eight probe arms.

    p10 33 · p25 59 · median 80 · p75 97 · p90 100

    Quiet                       3.1%
    Suspicious                  3.6%
    Investigating               6.3%
    Major Investigation        11.5%
    Intensive Task Force       24.5%
    Organization Under Siege   13.6%
    Nothing Left To Watch      33.2%

**A third of every career sits in the top tier of seven** — the band whose
description reads "This does not get worse. It only ends." Seventy-one per cent
of days are Intensive Task Force or above. Thirteen per cent are below Major
Investigation.

A meter that reads near maximum two days in three carries no information. A
player cannot tell a careful month from a reckless one, because both render as
the same tier name and the same colour.

### 0.2 Inflow beats outflow by 40%, and a quarter of it is discarded

101,664 career-days, every `addHeat` and every `tickHeat` counted as it ran.

    added per day      1.295   (plus 0.469 a day discarded at the 100 clamp)
    removed per day    0.924
    ratio, net         1.40
    ratio, gross       1.91

    tier decay actually ran on    70.1% of days
    absorption removed something  70.0% of days
    mean quietDays at tick        3.57

**This is a modest persistent surplus, not a broken brake.** An earlier draft
named the quiet-days gate as the root cause. It does not jam — decay runs on
70% of days. That claim was inferred from reading `addHeat` and never counted;
it is withdrawn, and §1.1 records why.

The second number is the one that matters. **0.469 points a day — 27% of all
heat generated — is thrown away at the ceiling.** Over a quarter of everything
the player does already has no effect at all.

### 0.3 What puts it there

Every `addHeat` call, by total points contributed.

    street: open warfare                31.6%   9,406×   6.00 each
    street: Call In Tribute went wrong   7.5%   1,266×  10.51
    street: a public answer              6.9%   1,375×   9.00
    street: work in Little Sicily        6.4%   8,527×   1.33
    street: the job drew attention       5.2%     886×  10.48
    street: short-notice job went wrong  4.2%     698×  10.72
    street: short-notice job             3.3%     879×   6.68
    street: Call In Tribute              3.1%     990×   5.56
    street: work in Old Quarter          2.9%   3,948×   1.33
    street: Freelance Muscle went wrong  2.8%   1,096×   4.64
    street: Freelance Muscle             2.8%   1,909×   2.60
    street: Debt Collection went wrong   2.7%   1,920×   2.49
    street: Warehouse Job went wrong     2.6%     771×   6.00
    street: Debt Collection              1.9%   2,826×   1.21
    street: work in The Docks            1.8%   2,435×   1.34
    street: The product trade            1.6%   2,427×   1.21
    street: work in Riverside            1.6%   2,095×   1.39
    street: Smuggling Run went wrong     1.0%     274×   6.42

**War is a third of all heat in the game.** `WAR.heatPerClash` is 6 and it
fired 9,406 times. Nothing else is close.

**Routine district work fires about 17,000 times at 1.33 apiece** — 12.7%
between four named districts. Individually negligible, collectively the second
largest source.

### 0.4 The evidence pile is already at ceiling

40 careers, 300 days, default policy. 25th / median / 75th.

    operations run             50 /  61 /  70
    of those, failed           22 /  27 /  35
    evidence traces held       47 /  70 /  87
    total evidence strength   562 / 749 / 938
    cases ever opened           4 /   5 /   5
    peak case strength        100 / 100 / 100
    days with a live case     238 / 266 / 280   of 300
    careers ever indicted            38/40
    traces by source     informant 39% · violence 37% · operation 23%

### 0.5 And the case ledger says why

`state.law.ledger` already records this; it was read, not rebuilt. Four-year
careers, 408 cases, 8,723 case-weeks.

    what moves a case, per case-week
      evidence            +8.62
      their own work      +2.34
      being visibly loud  +2.97
      decay               -0.24
                          ------
      net                +13.69

    14% of case-weeks cold
    1 file closed by decay, against 408 opened
    12 weeks a career on retainer, of 97 spent with a case open
    mean heat 76.2 · mean open case 85.4 · peak case 100.0

**Absorbed evidence is 63% of what moves a case, and heat does not touch it.**
Hold that number; §2 is entirely about its consequence.

---

## 1. The causal chain

**1. Heat generation exceeds removal by 40%, every day, structurally.** 1.295
in against 0.924 out. Small enough to look harmless in any single week, large
enough to walk a career to the ceiling and hold it there.

**2. Removal does not scale with anything the player does; generation does.**
Outflow is `HEAT_DECAY_PER_DAY` (1.1) times a tier multiplier, a difficulty
multiplier and a per-channel multiplier, plus `HEAT_ABSORPTION`, which scales
with headcount but caps at 5.75 a day — a cap that binds at 32.75 crew, which
almost no career reaches. Inflow scales with jobs run, districts worked, trade
moved and weeks at war, all unbounded. There is a fixed activity level above
which every career pins, and every measured career is above it.

**3. And removal is weakest exactly where the surplus is largest.**
`decayMultiplier` falls 1.0 to 0.85 to 0.7 to 0.55 to 0.42 to 0.32 to 0.22 as
heat rises, and `HEAT_ABSORPTION` is multiplied by the same figure. At the top
band, tier decay contributes 1.1 × 0.22 = 0.24 a day and absorption at 13 crew
returns 0.40. **This is the ratchet.** The falling curve is deliberate and its
intent is sound — "you cannot idle your way down from 80" — but it was written
to make high heat sticky, and against a standing 40% surplus it makes high heat
permanent.

**4. Once pinned, the meter stops carrying information.** 0.469 points a day
discarded at the clamp. Median 80, a third of days at 93 or above, 71% at
Intensive Task Force or above.

### 1.1 Two claims this document made and withdrew

Both were the same error: a mechanism read out of source and reported as
behaviour without being counted.

**"Clean jobs leave no evidence, which is why the pile is small."** True in the
code — both `addEvidence` calls in `operations.ts` sit inside the failure
consequence switch — and irrelevant in play. The pile is at ceiling. Operations
are only 23% of traces; violence and informants are 76%.

**"The quiet-days gate jams, so tier decay never runs."** Decay runs on 70.1%
of days, mean `quietDays` 3.57. `HEAT_ABSORPTION`'s comment describes exactly
this failure, but it describes an earlier state of the code, and the workaround
is doing its job.

Reading a function tells you what it can do. It does not tell you how often it
does it, and in a simulation the second number decides whether anything is
broken.

---

## 2. Investigations are a separate problem, and this does not fix them

This was the hard part to get right, and it inverts what an earlier draft said.

`momentum` is `clamp((heat - 20) / 50, 0, 1)` and saturates at heat 70, so at
median 80 it is permanently 1 — a player who has gone completely still gives
the agency **full** traction. And `visibility = heat × HEAT_EVIDENCE_CONTRIBUTION`
sits outside the `momentum` gate entirely, so a case that has correctly gone
cold still gains 2.8 a week against `COLD_CASE_DECAY_PER_WEEK` of 1.8. Both are
real bugs. Neither is load-bearing.

**The coefficient sweep proves it.** Across every value tried, including one
that drops median heat from 80 to 46:

    peak case strength    100      at every coefficient
    days with a live case 266      at every coefficient
    cases opened / closed 5 / 2    at every coefficient
    careers indicted      244-251 of 252, no trend

Two independently written instruments produced this, the second after the first
was suspected and rebuilt against `status` instead of `stage`. The arithmetic
agrees: absorbed evidence is +8.62 a week and heat gates none of it, because
76% of traces come from violence and informants. A case is never starved for
the 35 days it needs to go cold, so it never decays, so it never closes.

**So the law system needs its own fix, on the evidence side** —
`EVIDENCE_DECAY_PER_WEEK` at 0.55 a week behind a 45-day staleness gate,
`EVIDENCE_ABSORPTION` at 0.55, and the fact that several agencies can absorb
the same trace. That is a separate spec, and it is what the scores work is
actually blocked on.

### 2.1 What the pinned meter costs today

**Every heat-gated mechanism reads a pinned input.** Operation success, loyalty
drift (heat is the largest single term at -1.03 per crew-week), the launderer
trust ratchet, agency interest and civic standing are all evaluated at one end
of their range.

**Two counterplays are measured as ineffective and two more are suspect.**
Going quiet cannot engage. Counsel cannot reach `visibility`. Laying low and
buying an agency contact have **not** been measured and are listed as suspects
only.

**A playtester reported the symptom and it was half-diagnosed.** The header of
`layLowHonesty.test.ts` records round 11 paying $5,154 to go quiet on day 130,
and the log reading "Attention on the organization has risen: Intensive Task
Force" on day 132. That was treated as a wording problem — work already out
finishes, which is correct and was not what the sentence promised — and the
test checks the wording. The wording was one of two things wrong.

---

## 3. The change

    // today
    const decay =
      HEAT_DECAY_PER_DAY *
      tier.decayMultiplier *
      diff.heatDecay *
      DECAY_BY_CHANNEL[channel] *
      (laying ? LAY_LOW_BY_CHANNEL[channel] : 1);

    // proposed
    const decay =
      org.heat * HEAT_DECAY_SHARE *
      diff.heatDecay *
      DECAY_BY_CHANNEL[channel] *
      (laying ? LAY_LOW_BY_CHANNEL[channel] : 1);

    export const HEAT_DECAY_SHARE = 0.026;

Removal becomes a share of the load rather than a flat figure that shrinks as
the load grows. Both broken properties go at once: outflow now scales, and it
is strongest where the surplus is largest instead of weakest.

**`HeatTier.decayMultiplier` stays**, but only `HEAT_ABSORPTION` reads it. Its
doc comment says "multiplies the base decay rate" and needs rewording.
`HEAT_DECAY_PER_DAY` becomes unused and should be deleted rather than left for
a future audit to find.

**The design rule survives, in the right currency.** "You cannot idle your way
down from 80" was written as a rate that collapsed; it becomes a matter of
time. Street heat carries `DECAY_BY_CHANNEL` of 1.25, so on normal difficulty
the effective rate is 0.0325 a day and the half-life is about 21 days of
decay — roughly 30 calendar days, since the quiet-days gate lets decay run on
70% of them. Eighty down to forty is a month of doing nothing. Expensive, and
possible, which is what a counterplay is.

The other two channels keep their own speeds: `money` at 0.8 and `inside` at
0.6, so paper and a man already talking still clear far more slowly than the
street does. That distinction is the point of the channel split and this change
does not touch it.

### 3.1 How the shape was chosen

Three candidates plotted against the base. 36 careers × 7 arms, 300 days.

```
                 p10 p25 med p75 p90 |  q+s   inv   maj    tf siege   top |  est. median  crew
base              33  59  80  97 100 |  6.9   6.3  11.5  24.5  13.6  33.2 |    $541,253     6
A  tier >= 0.55   23  48  71  89  98 | 11.0   8.1  16.0  26.5  14.3  19.6 |    $850,306    17
B  perCrew 0.5     0   8  39  78  98 | 41.0   8.8  10.1  15.1   6.7  15.2 |  $2,321,195    29
C  heat x 0.022   16  33  57  76  92 | 17.2  14.1  20.4  24.3  10.9   8.7 |  $1,306,222    25
```

**A** is too timid — median 71 is still Intensive Task Force and a fifth of
days remain in the top band. **B** is the over-correction §5 warns about: p10
of 0, 41% of days quiet-or-suspicious, the meter pinned at the bottom instead
of the top. **C** is the only one where no band dominates.

B was re-specified before plotting. As originally written the candidate was
"raise the `HEAT_ABSORPTION` cap", and the cap binds at 32.75 crew — raising it
would have changed nothing for almost every career. It was plotted as a
`perCrew` rise instead.

### 3.2 How the coefficient was chosen

```
  k       p10 p25 med p75 p90 |  q+s   inv   maj    tf siege   top | est. median  crew  end
------------------------------------------------------------------------------------------
  base     33  59  80  97 100 |  6.9   6.3  11.5  24.5  13.6  33.2 |   $541,253     6    2
  0.010    40  57  73  89  98 |  3.7   6.4  17.0  33.0  14.6  20.0 |   $732,130    11    5
  0.014    29  46  69  86  97 |  7.3  11.1  18.9  27.4  14.0  15.8 |   $736,160    17    3
  0.018    22  39  64  83  95 | 12.0  13.3  18.6  25.1  13.3  13.0 | $1,353,818    22    3
  0.022    16  33  57  76  92 | 17.2  14.1  20.4  24.3  10.9   8.7 | $1,306,222    25    1
  0.026    12  27  49  71  87 | 22.7  15.5  20.9  21.7   8.6   5.8 | $1,490,048    27    3
  0.030    10  24  46  68  84 | 25.7  16.3  21.5  19.8   7.6   4.6 | $1,670,587    27    0
```

The estate column is non-monotonic between 0.018 and 0.022; that is noise at
n = 36. All it supports is "the economy roughly doubles at any k of 0.018 or
above."

### 3.3 Why 0.026 and not something gentler

0.014 was recommended first, on two grounds. One was not real and the other did
not exist.

**"Fewer indictments at 0.026."** Not real. The column reads 249, 251, 250,
249, 244, 251 across the sweep — no trend, and 0.030 goes back up.

**"Tripling estate could break the rank ladder's pacing."** There is no rank
ladder. `nextRank` and `rankRequirements` were deleted, `player.rank` is pinned
at the first rung, and estate gates nothing. The caution rested on a system
that does not exist.

What the pacing actually does, base / 0.014 / 0.026:

```
                       base          k=0.014        k=0.026
tier 3             34/36  d72     36/36  d71     36/36  d70
tier 4             31/36  d93     36/36  d98     36/36  d89
tier 5              9/36 d190     15/36 d176     20/36 d161
respect               261             342            479
peak crew              23              30             32
estate            $541,253        $736,160     $1,490,048
operations             32              37             44
districts               2               3              3
ended early          2/36            3/36           3/36
flat (<$100k)        4/36            2/36           0/36
```

Two things carry the decision.

**The top of the job table opens for 20 of 36 careers at day 161, against 9 of
36 at day 190.** That is the direct answer to round 14's "the last hundred and
eighty were grinding a position I could not win."

**F15's flat tail disappears.** Four careers end under $100,000 at base, two at
0.014, none at 0.026. The economy splitting into a compounding half and a stuck
half is an open finding, and it closes as a side effect.

A third argument was made and withdrawn: that the binding constraint shifts
from operation count to districts. That reading came from the probe's
`blockedBy`, which scored careers against the dead rank table. Both have since
been deleted.

**The pacing table's rank names are job tiers.** `finalRank` is
`RANKS[standing(state)].id` — the highest tier the board opens, wearing the old
labels. There is no promotion. The "Crime Lord 0/36" row the probe used to
print can never read anything else, because no job declares tier 6; it was an
artefact of indexing a 0..5 result into a seven-entry array, and it is not
evidence of anything.

---

## 4. What will move, and how it gets re-baselined

**Median estate ×2.75. Surviving crew 6 to 27.** That second number deserves
saying plainly: the game today removes about three quarters of every crew a
career ever holds, against a peak of 23. After this change crew survives. That
is a larger change to how the game feels than the heat number is, and nobody
asked for it.

The sequence:

1. Write the failing test first, watch it fail, then implement.
2. Land the change **alone**. Nothing else in the same pass.
3. Re-run every probe and record the new baseline as a fresh table, not as a
   diff against the old one.
4. Repair whatever bars it breaks — by re-plotting, never by moving a bar to
   make it pass.

Bars that will need re-plotting rather than defending: anything reading heat
tiers, the `layLowHonesty` expectations, the four already-failing tests
(`grok.probe` 59 against 60, the generated-memo share, the alderman, the
scorecard's collapsed axis), and the case-ledger assertions in the four-year
probe.

---

## 5. Risks

**Over-correction.** Heat that clears freely makes the law system decorative in
the other direction. The bar is the distribution, not the mean: real mass below
Major Investigation and real mass above Intensive Task Force, moving between
them within a career. Variant B is what failure looks like.

**The economy is the dominant unknown.** ×2.75 is not a tuning shift. Money
priced against the old distribution becomes cheap — the possessions catalogue,
launderer retainers at $45,000 to $260,000, agency contacts at $30,000 to
$150,000, the patron at $120,000, legal retainers. The `PATRON` complaint —
best content priced for a run that has already succeeded — flips to the
opposite problem. That is a re-pricing job that follows this change and must
not be attempted inside it.

**F7 applies to the measurement.** No probe bot goes quiet, retains counsel or
buys a contact in response to pressure, so a repaired counterplay can read as
no change at all. An arm that reacts to heat is part of the work.

---

## 6. What this does not touch

`WAR.heatPerClash` stays at 6. War being loud is correct, and 31.6% of all heat
coming from open warfare is a statement about how often the player is at war —
F5's territory, and a separate investigation.

The quiet-days gate stays. It works.

Investigations stay broken. See §2.

The scores-and-setups spec stays parked, and is now blocked behind the evidence
work rather than behind this. Its disposal mechanic — gear the police recover,
writing evidence that names the men who carried it — is a good rule pointed at
a currency with no value until the pile can drain.

Save format, state shape and `SAVE_VERSION` are untouched.
