# Manufacture, and orders from other people

**Status: built. Both phases shipped 23 Aug 2026.** This document was written
as a proposal and is kept as the record of what was built, with every figure
replaced by the one that was actually measured. Where the build departed from
the proposal, the departure is marked and the reason is given in section 6.

| | proposed | shipped |
|---|---|---|
| Phase one, the plant | `PLANT`, sized by measurement | `PLANT`, $250,000 |
| Phase two, orders | deferred behind a reach measurement | built |
| New tests | — | `plant.test.ts` (14), `orders.test.ts` (19) |
| Save version | must not move | 13, unmoved |

The developer asked two questions in sequence: the game has drug smuggling, so
what about manufacturing — and then, write in the eventual ability to
manufacture and fulfil orders for other families or street gangs.

This document answers both, measures the ground they would sit on, and splits
them into two phases with the second explicitly deferred.

---

## 0. What the measurement says first

The reflex answer to "product should have a workshop too" is the matrix:

|             | buy                        | make               |
|-------------|----------------------------|--------------------|
| **product** | 3 suppliers, $40k–$90k     | *nothing*          |
| **arms**    | 1 supplier, $26k           | `WORKSHOP`, $120k  |

The arms trade got its buy-side door because the $120,000 workshop was
reachable by fewer than one career in ten — the `PATRON` shape, the best
content priced for a run that has already succeeded. The obvious move is to
add the mirror door on the other row.

**The product trade does not have that problem.** Measured over 24 careers of
365 days, with a bot that opens a supply and a route the moment it is allowed
to:

    trade unlocked (2 fronts)   24/24    median day 45
    opened a supply             23/24    median day 169
    units moved in the year     p10 3    median 209    p90 512
    trade income for the year   p10 $17,824   median $1,473,652   p90 $3,604,242

    weekly throughput while a supply is open
      what the ROUTES could carry    p10 2.7   median 14.3   p90 33.9
      what the CREW could carry      p10 9.0   median 36.0   p90 162.0
      the lesser of the two          p10 0.0   median  9.0   p90 27.8
      weeks where CREW was binding   26%
      weeks with ZERO throughput     14%

Twenty-three careers in twenty-four get in, and the median one earns $1.47M a
year from it — comparable to everything else the outfit does combined. There
is no access problem to fix.

**Two instruments lied on the way to that number and both were mine.** The
first watched `stock.product` for decreases and reported a median of half a
unit a year; `tickContraband` buys only what the routes can carry and moves it
in the same weekly tick, so the shelf is empty before and after and the delta
never fires. The second was a prediction rather than a measurement — that crew
would be the bottleneck, because `throughput` reads only crew whose status is
`active`. Routes bind 74% of weeks, not crew. Recorded here because the first
draft of this document was going to open by declaring the product trade broken.

---

## 1. Why the mirror is the wrong build

`config/contraband.ts` opens by stating the asymmetry as a design position
rather than an oversight:

> product is **bought** from somebody outside the city, and arms are **made**
> in a workshop you own. That makes the first a relationship you have to
> maintain and the second a capital asset somebody can raid.

Those are two genuinely different textures, and each has a whole subsystem
hanging off it. A supplier can walk — `supplierTrust`, `walkChance` and
`shakeSupplierTrust` exist for no other reason. A workshop can be raided —
`WORKSHOP.raidRefundShare` and its `exposure` of 1.1 a week exist for no other
reason.

Give product a unit-producing facility and both rows become *spend capital,
receive units, hope no warrant arrives*. The relationship half of the product
trade turns into flavour a player can buy their way out of, and the one
structural distinction between the two trades is gone.

So: **not a second `WORKSHOP`.**

---

## 2. Phase one — manufacture as a change of terms

A product facility does not produce units. It changes what a unit costs and
who can take the arrangement away from you.

| | keep buying | build the facility |
|---|---|---|
| unit cost | supplier's price, moves with the port | materially lower, fixed |
| can it stop? | yes — `walkChance`, every week | no |
| can it be taken? | no | yes, it is an address on a warrant |
| weekly cost | retainer amortised | upkeep whether or not you sell |
| exposure | delivery pattern somebody notices | a fixed address |

The fork stays honest in both directions: keep paying somebody who might
disappear, or own the problem and give the police somewhere to point. Neither
dominates, which is the test `armsSource.test.ts` already applies to the arms
fork and which this must pass in the same form.

This also leaves the arms `WORKSHOP` a distinct thing — it *makes units*, this
one *changes terms* — so the two rows of the matrix stay different after the
gap is closed.

### Shape

Follows `WORKSHOP` for its config surface, because the raid, upkeep and
exposure machinery already reads that shape:

    cost            capital, sized between the median and 75th of measured
                    peak funds at the day the trade opens (day 169), not by eye
    unitCostShare   what a unit costs as a share of the supplier price
    upkeep          weekly, paid whether or not anything moves
    minControl      the district has to be genuinely held
    max             a ceiling, so this cannot become the whole answer
    exposure        per week, per facility — a fixed address
    raidRefundShare what survives a warrant

Every number set from a plotted distribution before it ships, per DIRECTOR §5.
None of them guessed.

### What must not happen

- It must not remove the supplier from the game. A player who builds one keeps
  any arrangement they hold, exactly as the arms trade lets both run at once.
- It must not make `supplierTrust` pointless. Trust reaches full at 12 weeks;
  the facility has to be dear enough that riding out a relationship is still a
  real answer for most of a career.
- It must not bypass `throughput`. Routes bind 74% of weeks today and that is
  the trade's actual governor. Cheaper units must not become more units.

---

## 3. Phase two — orders from other people

**Deferred. Specified here so that phase one does not foreclose it.**

Half of this already exists. `ARMS_SALE` sells crates to a rival family at
1.45× unit value, and it is the most double-edged thing in the game:

> A player who funds their war with arms sales is arming the people they will
> be at war with in eighteen months. Nothing warns them. The strength number on
> the Rivals panel simply goes up.

`ARMED` then pins the rate a buyer gains to the rate the player loses, so every
crate sold moves the same quantity from one column to the other. That is the
pattern to extend, not to reinvent.

### What "orders" adds over the current sale

Today a sale is a spot transaction: you have crates, they will buy, done. An
order is a **commitment with a deadline**, which is a different decision:

- a named buyer wants *n* units by a given day
- accepting is a promise; the game already models promises with deadlines and
  already writes a memory rather than a stat when one breaks
- delivering early or in full is worth more than scraping in
- failing costs the relationship, and the relationship is the thing the buyer
  was for

That turns production from a stockpile question into a scheduling one, and it
gives the facility in phase one something to be *for* beyond a cheaper unit.

### The structural constraint that decides the shape

**`FactionId` is a closed four-member union** — `'player' | 'falcone' |
'vasari' | 'kestler'` at `config/factions.ts:13` — and it doubles as a save
format slot key. **Street gangs cannot be factions.** A gang has no `capos`,
no `strength`, no `wealth`, no `agenda` and no weekly AI turn, and adding one
to that union is a save-format change.

So buyers are their own lightweight thing, not factions:

    id, name, blurb
    kind        'family' | 'gang'
    wants       which trade
    scale       how large an order they place
    pays        multiplier on unit value
    consequence what fulfilling them does to the world

A `kind: 'family'` buyer resolves its consequence through the existing bond and
`ARMS_SALE.strengthPerCrate` machinery. A `kind: 'gang'` buyer resolves through
something cheaper — district sentiment, heat, a favour owed — because a gang is
not a faction and must not pretend to be one.

### The consequence has to bite differently per buyer

`ARMS_SALE` earns its place because arming a rival is legible and awful. Orders
need the same property or they are a payout table:

- **a family** becomes measurably harder to fight, as now
- **a street gang** in a district you hold changes what that neighbourhood is
  like to operate in — sentiment, heat, and who the police are looking at

Neither is a warning message. Both are numbers that move on a panel the player
can already read.

### State, and the save

New state is optional with a lazy initialiser — `orders?: Order[]` on
`GameState`, exactly as `promises?: Promised[]` does. It **must not** be added
to `validate()` in `save.ts`, and `SAVE_VERSION` **must not** move. Nine
existing optional fields follow this idiom.

### The daily memo slot

An authored event costs one of the pacing "firsts", and `dailyMemo` fills one
slot a day. Orders arriving as authored events would compete with the events
that carry the opening hours, which currently score 8–9. An order should
arrive on its own surface — the Contraband panel — and take a memo only when it
is about to lapse.

---

## 4. Build order, and what gates phase two

1. **Phase one.** Self-contained, closes a real matrix gap, preserves the
   distinction the header defends. **Built.**
2. **Measure whether anyone builds it.** The question that killed the mirror
   design is the one to ask again: what share of careers build a facility, and
   at what day. If it reads like `WORKSHOP` did at fewer than one in ten, the
   price is wrong and phase two would be built on content nobody sees.
   **Measured: 84 of the 131 careers that reach the trade ever hold the price,
   and 102 of 144 careers are offered at least one order.** Not the PATRON
   shape. The figures, and the instrument that nearly got them wrong, are in
   section 6.
3. **Phase two, only if phase one is reached.** An order book for a facility
   most careers never build is the `PATRON` shape a third time. **Gate cleared;
   built.**

### Preconditions that are not this document's to fix

- **F5 still limits the family half.** Rivals at strength 84/100/100 stayed
  Neutral for 224 days. A buyer who becomes "harder to fight" is a consequence
  the player may never feel while rivals do not act.
- **`ARMS_SALE.requiresPeace` is true.** Nobody buys from somebody they are
  shooting at, so the family orders are unavailable in exactly the war the
  arms trade exists to fund. That tension is good and should be preserved, but
  it means gang buyers carry the wartime half of the feature.
- The abstract-economy rule in the `config/contraband.ts` header stands for
  everything above. Units, capacity, upkeep, exposure, deadlines. Nothing here
  describes how anything is made, moved or concealed, and nothing added to it
  should.

---

## 5. Open, from the work that preceded this

Four tests are failing on the branch from the rank-ladder removal, three of
them marginal pacing drift. The fourth is a design question that is the
developer's to answer: the alderman watches mean sentiment across worked
districts, and now that careers spread rather than concentrate, sentiment sits
at ~50 everywhere and 35 of 36 careers clear the bar. No threshold can
discriminate against a quantity that has collapsed to one value. The repair is
changing **what that figure watches** — the suggestion on the table is
sentiment in the player's *worst* district rather than the mean.


---

## 6. What was actually built, and what the measurements said

### Phase one, the plant

`config/contraband.ts` `PLANT`; `sim/contraband.ts` `plantList`,
`canBuildPlant`, `buildPlant`, `productSources`; `Contraband.plants?` on the
state; a **Making it yourself** panel; `plant.test.ts`.

It behaves as this document described. There is no `outputPerWeek` field and a
test asserts it never gains one. What a plant does is join `productSources`, a
cheapest-first list the weekly buy walks — so a family holding a plant *and* an
arrangement fills its base load from the building and its peaks from the
relationship.

| | value | why |
|---|---|---|
| `cost` | $250,000 | just above the median of measured peak funds after the trade opens |
| `unitCostShare` | 0.45 | against arrangement multipliers of 0.85, 1.15 and 1.40 |
| `supplyPerWeek` | 10 | under the smallest arrangement ceiling of 28, so the supplier survives |
| `max` | 3 | a full set of 30 is still under the waterfront alone at 90 |
| `upkeep` | $2,600 a week | paid whether or not a unit moves |
| `exposure` | 1.6 a week | above every arrangement — the price of never being walked out on |
| `raidRefundShare` | 0.1 | the share a workshop gets; `SEIZURE.plantChance` is 0.35 |

**The price was wrong once, and the instrument was the reason.** The first pass
put it at $185,000 off a bot written for this feature, which reported a median
peak of $176,843. That bot opened a supply in 14 careers of 36 where the
project's standard bot reaches two fronts in 132 of 144. Re-plotted on
`ladder.probe`'s bot across 144 careers, peak funds inside the first year after
the trade opened read **p10 $38,690, median $236,014, p75 $766,036**, and 84 of
the 131 careers that reach the trade ever hold $185,000. That is the third time
in this cycle an instrument written alongside a feature has flattered it.

### Phase two, orders

`config/orders.ts` holding `GANGS`, `ORDERS` and `ORDER_FAILURE`;
`sim/orders.ts`; `Order` and `GameState.orders?` on the state; a **What other
people want** panel above the trade tabs; `orders.test.ts`.

Built to the constraint in section 3. A gang is a name, a neighbourhood and
three per-unit figures, and `FactionId` was not touched. Three of them — the
river boys in Riverside wanting product, the crew off the yards in Rail Yards
wanting crates, the Southport men wanting product — each paying above what a
family pays and charging for it in sentiment, heat and ground rather than in
money.

The mechanism that makes an order a commitment rather than a sale is
`reservedUnits`, which lives in `contraband.ts` so that `orders.ts` can read it
without the dependency running the other way. Two places use it: the weekly buy
adds it to the target, and distribution subtracts it. **Both are mutation
tested** — deleting either one turns a named test in `orders.test.ts` red. The
first version of that file did not cover the distribution half, and deleting it
left all sixteen other tests green.

### The reach question, which is what gated phase two

Measured on `ladder.probe`'s bot across 144 careers, with the roll live:

    product trade unlocked   132/144
    arms trade unlocked      122/144
    saw at least one offer   102/144
    offers in the career     p10 0   median 2   p75 5   p90 9   max 19

Seventy-one percent, a median of two a year.

**A real fault turned up on the way to that figure**, and it would not have
shown in any unit test. The weekly roll picks *one* name out of the candidate
list. Listing every family at peace and letting `offerOrder` refuse them read
as harmless, and was not: three families who cannot buy because the arms trade
is shut crowd out the one gang who can. The list is filtered by `tradeUnlocked`
now. See `candidates` in `sim/orders.ts`.

### The offer roll runs on a stream of its own

The one deliberate departure from the proposal, and it is about measurement
rather than design.

`state.rng` is shared, ordered and load-bearing. Every probe plays a fixed set
of seeds, and several pre-committed bars sit within a point of their thresholds
by design — a target is supposed to be near what the game actually does. Wiring
one `rng.chance` a week into the shared stream reshuffled all 144 careers:
four failing probe assertions became five, two of the original four passed by
luck, two new ones appeared, and `config/civic.ts`'s captain bar went from 9
careers of 36 to 8 against a floor of 9.

DIRECTOR section 5 forbids moving a threshold to make something pass. The way
to honour that is to not disturb what the thresholds are watching. The
generator is stateless given seed and call count, so `offerStream` derives an
independent stream from the seed and the day — exactly as deterministic and
exactly as save-safe, both inputs already being on disk — and leaves
`state.rng.calls` untouched. Every seeded world is now bit-identical to what it
was before this work.

The captain bar was re-plotted to 44 while the disturbance was live, then put
back to 48 when it went away, and the episode is written into the comment. The
bar was never wrong. The measurement had been disturbed by the thing being
measured against it.

### The state of the suite

    909 passing, 4 failing, 8 skipped.  tsc -b clean.

The four failures are the four that were already failing before this work, at
identical values: grok.probe 59 against 60, the generated-memo share 0.3311
against 0.3333, the alderman at 35 against 33, and the scorecard's pacing axis.
Nothing here touches any of them.

The alderman remains the open design question in section 5. Its distribution
has an interquartile range of one point — median 50, p75 51 — so no threshold
placed on it can discriminate, and the repair is to change what the figure
watches rather than where the bar sits.


---

## 7. What both systems do across a population — measured 2026-08-23

Section 6 answered reach. It did not answer whether *using* either system does
anything, which is F7's question and the one this project had never asked of
any new system until the favour network.

`ladder.probe` gained two arms, and the split matters: the baseline bot **has
never opened an arrangement or a route in its life**, so every reading that
file has ever taken is a reading of a career with no contraband income at all.
Measuring "plant and orders" against it would have reported the entire
contraband economy as the effect of two features added in one afternoon.

- `RUNS_TRADING` — the standard bot, running the two trades as they have always
  existed.
- `RUNS_OWNED` — the same bot, plus a plant and orders.

Both 36 careers, 300 days, same seeds as `RUNS_300`.

### The trades themselves

    opened a product arrangement   29/36, median day 91
    opened an arms source          29/36, median day 98
    trade income over the career   p10 $0   median $1,632,268   p75 $2,046,563
    best estate, not trading vs trading   $541,253 vs $576,661

Four careers in five get into the trade and the median one earns $1.6M from it.
**And it moves the estate by 6.5%.** That gap is not this document's to close,
but it is worth writing down: $1.6M of trade income converts to $35,000 of what
the family is worth, because trade income is dirty and laundering capacity is
what binds. The trade funds the week; it does not build the estate.

### The plant

    the game offered one to        16/36
    the bot built one in            7/36, median day 203
    the 7 that built one, against themselves without it:
      paid per load                $2,252 -> $1,712
      trade income                 $1,800,914 -> $2,316,180

A quarter of careers reaching it was the pre-committed bar. Take-up read 7 of
36 and the assertion went red — and the line above it is why: the game said yes
to 16, and the gap is the bot's own refusal to spend below one and a half times
the price. The bar was repointed at reachability, take-up stays unasserted, and
**the number did not move**. Both facts are in the test's comment.

The paired figures are the ones that matter: the same career pays 24% less per
load after building one. The income rise is orders, not throughput — a
plant-holder in this arm is also filling orders, which books revenue a
street-only career never sees.

### Orders

    offered to                     23/36 careers
    taken by                        9/36
    accepted 11 · refused 50 · filled 10 · failed 1
    careers that ever supplied a gang   8
    worst public feeling in their neighbourhood   median 45

The shape is right. A player who takes only what the trade can plausibly carry
**refuses 82% of what is offered and delivers 91% of what they take** — the
decision is which ones to accept, which is what the feature was built to be,
and the one failure proves the deadline is not decoration. Supplying a gang
drops the neighbourhood from roughly 50 to 45.

### Two instrument faults found here, both recorded in HANDOFF §3

The volume assertion was a bound on median trade income and a mutation that
made a plant add forty units a week of throughput **left it green** — seven
careers in thirty-six hold a plant, so no minority effect can move that median.
It is gone; `plant.test.ts` tests the claim on the function it is about.

And the take-up bar above, which failed for pointing at the bot's caution
rather than at the game.
