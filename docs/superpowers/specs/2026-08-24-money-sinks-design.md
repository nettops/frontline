# Somewhere for the money to go

**Status: proposal.** Four rows and one new field. Every figure below was
measured; the instrumentation was temporary and has been reverted.

| | proposal |
|---|---|
| New field | `PossessionDef.upkeep`, optional, absent on the existing nine |
| New field | `PossessionDef.effect`, optional, one key so far |
| New kinds | `vessel`, `club`, `institution` beside `home / car / jewellery` |
| New rows | four: a boat, a country club, a yacht, a foundation |
| New tick | `tickPossessions`, weekly, charges upkeep and applies effects |
| Save version | 13, unmoved — `possessions` is already an optional array |
| Deferred | the aircraft, the hospital, the newspaper, the sports franchise, private security |

---

## 0. What the measurement says

The developer asked for money sinks and listed seventeen. Getting to a design
took five wrong turns, all mine, all corrected by measuring. The corrections
are recorded because each one closes off a plausible-sounding alternative.

### 0.1 The surplus is real

Trading arm, per career. **This line is means, not medians.**

    clean in                                        $1,128,015
    clean out   hires   $2,222
                jobs   $60,730
                fronts $12,949
                events $29,332
                upkeep $37,064
                total                                 $142,297

**Twelve per cent of the clean money a family earns is ever spent on
anything.** The estate at the end reads
`$1,466,460 = cash $149,992 + put away $893,628 + fronts $497,600` — sixty-one
per cent of everything the family is worth is a savings account. Every arm does
it, including the one that never touches the trades.

### 0.2 Where it can go, and how much room there is

    peak clean purse (cash + put away) per career, 36 careers
      10th    190,234    25th    455,551    median    982,554
      75th  1,678,087    90th  1,908,305    best    2,578,335
      median day the peak arrived: 294

      ever over  250k 31/36 · 500k 24/36 · 750k 23/36 · 1.2m 12/36 · 2m 2/36

Two facts shape the whole catalogue.

**The peak lands on day 294 of 300.** The pile finishes forming as the run
ends. Anything priced near the top is affordable for a fortnight, which is the
`PATRON` shape reached by a different road: content priced for a run that has
already succeeded.

**The spread is a factor of ten**, 10th to 90th. One price lands very
differently across the population, so the rungs have to sit at genuinely
different heights.

### 0.3 Four things that are not the problem

**Front upkeep is a weak, noisy tax.** Swept at $0 / $1,200 / $2,400 / $4,000 /
$6,000 a week per front: the front count stayed at **8 at every level**, and the
estate column was non-monotonic between $2,400 and $4,000. A flat fee across a
catalogue spanning $560 to $12,000 a week of revenue is invisible at the top and
lethal at the bottom, so it skims the winners and changes no decision. That is
the F23 shape — a charge that buys nothing.

**Prices are not too low.** The dearest possession is $160,000 and, on the
cash-only rule, it was reachable on **0%** of 10,569 career-days. Raising prices
would have made the top of the catalogue further out of reach, not nearer.

**The 15% withdrawal toll was not the barrier.** Measured three ways:

    cash only (the rule then)  dearest ever  $75,000 | days at 160k   0%
    cash + holdings at 85%     dearest ever $160,000 | days at 160k  39%
    cash + holdings, no toll   dearest ever $160,000 | days at 160k  39%

The toll costs one percentage point. What mattered was whether holdings counted
at all.

**And the savings account is not dead money.** It compounds at 0.45% a week —
about 26% a year — buys fronts and pays tribute with no penalty, and counts at
face in the estate. An earlier draft of this document called it "money with
nowhere to go", and that was wrong. It is a real, deliberately mediocre,
completely safe investment.

### 0.4 What was actually wrong, and is now fixed

Possessions were payable in cash only, while fronts and tribute both drew on
holdings without penalty. The exclusion was a side effect of a rule written
about **dirty** money — the refusal message says so — and holdings are clean by
construction, because `putAway` only ever draws on the clean pool.

**Landed already.** `cleanPurse()` counts cash plus holdings, `buyPossession`
draws holdings first at no toll, and four tests cover it. The top of the
existing catalogue went from reachable on 0% of days to 39%.

---

## 1. The benchmark

Holdings pay 26% a year, carry no risk and no attention, count at face, and buy
fronts penalty-free. **That is what every new row competes against**, and it is
why price alone cannot make a sink: anything that merely stores value loses to
the thing that stores value and pays.

So every new row carries three properties.

**Weekly upkeep.** The problem is a flow of roughly $3,000 a week with nowhere
to go, not a one-time pile. A $700,000 yacht absorbs six months. A $700,000
yacht at $4,500 a week absorbs it for good, and has to be wanted again every
quarter.

**Something holdings cannot give** — standing, quiet, or reach.

**A cost that is not money.** `visibility` already does this: it feeds the
visible share of worth that `legitimacy` reads, and it scales the newspaper item
`cover()` runs when you buy. One field, both halves.

---

## 2. The four rows

**Built and measured.** The prices below are the corrected ones; §2.5 records
what the first attempt did and why it was wrong.

```
                            price     upkeep/wk   visibility   bought by
  a boat at the marina     $120,000       $800       0.5        51 careers
  a charitable foundation  $200,000     $3,000       0.6        40
  the country club         $250,000     $1,800       0.7        26
  the yacht                $400,000     $3,200       0.9        11
```

Counts are purchases across 36 careers, so they run past 36 — a warrant takes
things and the family buys another.

Upkeep runs 0.7–1.5% of price a week — 35–75% a year, deliberately **worse**
than the 26% holdings pay. That gap is the trade: you turn something that
compounds into something that depreciates and buy standing with the difference.

The foundation costs nearly twice the boat to run at under twice the price,
because it does something.

### 2.5 What the first pricing did, and why

The tier was first set at $220k / $350k / $400k / $700k, plotted against **peak
purse per career**. Measured on a bot that shops:

    28/36 bought anything · first purchase median day 175 · median 7 weeks kept
    boat 56 · country_club 24 · yacht 0 · foundation 3

**The yacht was bought zero times in thirty-six careers**, and the foundation
three. Two mistakes, both mine.

**Peak is the wrong statistic.** The peak arrives on day 294. What matters is
the purse *curve*:

    clean purse by day        25th   median    75th    90th
      day 120                  28k      62k     122k    188k
      day 180                  72k     329k     464k    596k
      day 240                 290k     700k    1089k   1244k

    careers whose purse ever passes a figure BY day 200, of 36
      150k 25 · 200k 23 · 250k 21 · 400k 19 · 500k 16 · 700k 6

Six careers in thirty-six pass $700,000 by day 200. The yacht was priced
almost exactly where nothing could reach it in time to keep it.

**And the row that does something was gated hardest.** The foundation's heavier
upkeep pushed its affordability bar *above* a country club that cost more, so
the ornament won on a technicality.

Two things changed with the prices, both in the bot rather than the game:

- It reserves **twelve weeks** of the new bill rather than twenty-six — the same
  horizon the liquidity buffer already uses.
- It buys **cheapest first** rather than the dearest it can cover, so the entry
  row is owned longest, which is what "lived with" means.

After both:

    31/36 bought something · first purchase median day 161 · median 14 weeks kept
    boat 51 · foundation 40 · country_club 26 · yacht 11
    rows owned per career — 0:5  1:8  2:9  3:5  4:9
    paired estate gap, participants only: -$334,136

### 2.1 What the foundation does

It raises public sentiment, a few points a week, in the districts the family
works.

**The alderman watches sentiment.** So a foundation buys civic standing
*indirectly* — you changed the world, and his opinion drifts toward the world.
That is the only route `civic.ts` permits, and its header is explicit about why:
*"Nothing in this file is spent or bought — which is the thing that
distinguishes it from the `contactCost` shop it replaces."*

A direct donation button is not in this spec for the same reason.

Sentiment is not only the alderman. It feeds front health, territory control and
what the trades can move, so the foundation is a genuine economic instrument
rather than a standing purchase wearing a charity's name.

### 2.2 The shape in config

```ts
/** What it costs to keep, per week. Absent means nothing — see the nine. */
upkeep?: number;
/** What owning it does. One key so far; a second gets added when earned. */
effect?: { sentimentPerWeek?: number };
```

Both optional, so the existing nine are untouched and the developer's decision
that upkeep applies to the new tier only holds by construction.

### 2.3 Where it ticks

    3a.  wages out                          (existing)
    3b.  what the boss keeps, and what it   NEW
         does for him
    5d.  rule off the week's book           (existing)
    7.   influence and sentiment drift      (existing)

Weekly. **After wages**, because upkeep is a standing bill and belongs with the
other standing bills. **Before the ledger close at 5d**, or the charge lands in
`unaccounted`. **Before the territory drift at 7**, for the same reason
delegation runs at 6a — a district the foundation worked this morning should be
read as worked when the drift asks this afternoon.

Upkeep is booked to `premises`, which is where retainers and standing
arrangements already go.

### 2.4 What happens when you cannot pay

The bill is skipped and the thing is not lost. A yacht is not repossessed for
one missed week, and a family that misses payroll has larger problems than the
boat.

**But it stops working.** An unpaid foundation moves no sentiment that week.
That keeps the decision honest — the thing you bought is only worth what you can
afford to keep running — without adding a repossession system nobody asked for.

---

## 3. Deferred, and why

**The aircraft ($1.15M), the hospital ($900k) and the newspaper ($1.4M).** All
three land at roughly a quarter of careers or fewer, and all arrive near day
294. Build them once the first four are measured as bought *and lived with*.
This is the same discipline the scores spec put on named heist targets.

**Sports franchises, and hotels or media at scale.** These launder and earn, so
they are fronts, not possessions. Fronts are gated by district slots, and slots
need ground — which is the right wall for them and a different piece of work.

**Private security.** The only genuinely new machinery on the original list: a
weekly retainer that reduces war casualties, raid losses and seizure. Shaped
like `launderers.ts`. Its own spec.

**Political campaigns and donations.** Cut. Both buy an outcome directly, which
is the shop `civic.ts` exists to replace. The foundation reaches the same
fantasy through the door the design leaves open.

---

## 4. How it gets measured

Paired against the same seeds, per `HANDOFF.md` §3 — paired comparisons only, no
bar pointed at a population containing non-participants.

| question | instrument | bar |
|---|---|---|
| Is anything bought at all? | careers owning ≥1 new-tier item | plotted, then set between median and p75 |
| Is it bought early enough to live with? | median day of first purchase | well before day 294 |
| Does upkeep bite? | holdings at day 300, with against without | lower |
| Is it a choice or a formality? | spread of how many rows a career owns | not bimodal at 0 and all |
| Does the foundation reach the alderman? | alderman standing, owners against not, paired | higher |

**The second row is the one that decides whether this worked.** The surplus
peaks on day 294. If the catalogue is only bought in the last fortnight it has
absorbed money without ever having been a decision.

**And F7 applies.** No probe bot buys a possession today — it banks and it buys
fronts. An arm that shops is part of this work, not a follow-up, or the whole
thing measures nothing.

---

## 5. Risks

**The bot will not use it, and that will look like the feature failing.** See
above. The shopping arm has to exist before any of the bars mean anything.

**Upkeep may be as weak here as it was on fronts.** The front sweep found a flat
fee changed no decision. The difference is that these prices span 220k to 700k
rather than 12k to 260k, and the upkeep is proportional to price rather than
flat — but that is an argument, not a measurement, and the sweep should be run
before the numbers are fixed.

**The foundation could make the alderman trivial.** He is already owed by 34 of
36 careers against a bar of 33 — and the civic reachability test currently fires
on the captain, who sits at the same 34/36, so the alderman is one career behind
a second failure. An instrument that raises sentiment on purpose could push him
to 36 and delete him. His bar gets re-read after this lands, and the
foundation's sentiment rate plotted against it rather than picked.

Note also that the measured mean sentiment where a family works is 45, and the
alderman's bar is 45. He is sitting exactly on the line, which is why he is
sensitive to anything that touches sentiment at all.

---

## 6. What this does not touch

The existing nine possessions keep their prices and gain no upkeep.

Fronts, holdings, the estate, the wash and the trades are unchanged.

`SAVE_VERSION` stays at 13. `possessions` is already an optional lazily
initialised array and gains rows, not a new shape.
