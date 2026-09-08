# The financial rework — value the family by what it owns

**Status:** design, awaiting review.
**Decision taken:** rank measures the estate, not the balance.

---

## Why

Measured today, across 36 four-year careers:

```
a crew-week earns                     $1,073
a crew-week costs                       $257     the economy is 4x profitable
of which NEW CLEAN money                 $77     7%

clean money earned per career       $184,077
peak clean balance ever held         $24,908
Capo requires                        $45,000
```

A family earns four times the Capo requirement and never holds it once, because
clean cash is the pool every cost falls back on when dirty runs out. Rank counts
clean and nothing else, so the ladder is gated on a seventh of an economy that
is otherwise healthy. Capo arrives in 1 career of 36. Underboss and above have
never arrived, and a twenty-year run reached exactly the same rungs on exactly
the same days as a four-year one.

Attempts already made and their results are recorded in
`docs/plans/2026-08-19-fun-depth-pacing.md`: cutting the laundering
rate, holding working capital back for the fronts, giving neighbourhood goodwill
more headroom, making counsel affordable, letting fronts survive light pressure,
and letting money be put away. The best of them moved the peak balance 16%. The
gap is 80%. No rate applied to a seventh produces a whole.

## The change in one sentence

**A family's standing is the value of what it owns — cash, holdings, fronts and
ground — rather than the number in its wallet on the day somebody asks.**

## The engine already exists

The business catalogue is a compounding ladder and nobody has ever climbed it:

```
front           cost      revenue/wk    payback
laundromat    $12,000          $403        30w
restaurant    $25,000          $900        28w
trucking      $60,000        $2,160        28w
casino       $260,000        $8,640        30w
```

Payback is a flat 28–30 weeks at every rung, which is geometric growth under
reinvestment — roughly seven doublings in a four-year career. The measured
reality is **$356 per front-week**, below the nominal figure for the *cheapest*
front in the game, because families own three fronts across a career and buy
their last one with the $4,387 that is left after everything else.

**A family earns $180,000 of clean money over four years and reinvests two per
cent of it.**

## What the board can hold

Twelve districts, and at full control the density of the places allows **25
business slots**:

```
every slot holding a casino     $6,500,000 in assets
                                  $300,000 a week
                               $15,600,000 a year
```

So the ceiling is real and the top rank is not a fantasy. A family holding half
the city — six districts, about twelve slots — owns $3.1M of fronts earning
$7.5M a year. Crime Lord at a $5,000,000 estate is *that* family, a year or so
in, once what the fronts earn has been banked rather than spent. That is a
defensible thing for the top of a ladder to mean, and it leaves headroom above
it: the ceiling is $6.5M in fronts alone, so the top rank is a hard climb rather
than a perfect run.

---

## 1. The estate

A derived figure, computed on demand. **No new saved state**, in keeping with
`config/goals.ts` and `sim/standing.ts`.

```ts
export interface Estate {
  cash: number;       // clean in the wallet
  holdings: number;   // clean put where it cannot be spent
  fronts: number;     // what the businesses are worth
  ground: number;     // what the districts are worth
  total: number;
}

export function estate(state: GameState): Estate;
```

**Fronts are valued at what they would cost to buy today, scaled by condition.**
`acquisitionCost` already prices a business into this year's money and this
district's wealth; multiplying by `health / 100` means a front being run into
the ground is worth less than a sound one, and a shuttered front is worth
nothing. This makes the health system matter to standing as well as to income,
which it currently does not.

**Ground is valued with `districtWorth`**, which exists in `sim/delegation.ts`
and is already the game's own answer to "what is this district worth to me". It
is reused rather than reinvented so the two figures cannot drift apart.

**Dirty cash is not in the estate.** It is not standing; it is exposure sitting
in a room, which is what the Finances panel has always said about it. This is
the one place the old design was already right and it stays.

## 2. The ladder, renumbered

The `cleanCash` requirement becomes `estate`, and the figures are set against
the ceiling above rather than against the economy that never existed:

```
                 now (clean held)      estate
Street Criminal            $0              $0
Enforcer                   $0              $0
Crew Leader            $9,000         $12,500
Capo                  $45,000         $60,000
Underboss            $180,000        $300,000
Boss                 $650,000      $1,250,000
Crime Lord         $2,500,000      $5,000,000
```

The requirement rises because the measure is broader — a family holding three
fronts and two districts is worth six figures while its wallet holds four. The
figures keep the *shape* of the old ladder: each rung is roughly four times the
one below, which is what the front catalogue's own price ladder does.

**These are half of what this spec first proposed, and the halving is an
improvement rather than a concession.** The first draft put Crime Lord at
$10,000,000 against a board whose every slot filled with casinos is worth
$6,500,000 — so the top rung could only be reached by maxing the map *and* then
banking three and a half million on top of it. That is not a demanding target,
it is a target that requires the one play nobody makes. At $5,000,000 the top
rung sits below the asset ceiling, which means there is more than one shape of
empire that reaches it.

What each rung now means, concretely:

```
Crew Leader   $12,500   one laundromat, or the money to buy one
Capo          $60,000   a restaurant and an auto shop, and two districts held
Underboss    $300,000   six or seven mid fronts — a network, not a shop
Boss       $1,250,000   a third of the board, earning
Crime Lord $5,000,000   about half the city's slots, held long enough to bank
```

**Capo at $60,000 is passed by a family owning a restaurant and an auto shop.**
That is the point: the rung is met by *building something* rather than by
hoarding, and it is met at about the time a family that has been reinvesting
would reach it.

**Crime Lord at $5,000,000 needs about half the city's slots and a year or two
of what they earn.** Reachable, not by accident, and reachable by more than one
route — fronts, ground, or a hoard, in whatever mix a given family managed.

The high-water record from this morning applies to the estate as it did to the
balance: a rung once earned stays earned, through a bad year and through a
handover.

## 3. What has to be true for it to compound

The estate measure alone changes what is counted, not what is possible. Three
things currently stop reinvestment, and this design does not work without them.

**a. Clean money has to survive contact with the week.** $85,137 a career leaves
through job costs because dirty runs out and clean is the fallback. Making jobs
dirty-only was tried and **failed** `balance.test.ts > lets careful play build a
bigger organization` — a careful boss launders, and under a dirty-only rule his
laundered money can no longer fund work, so the greedy boss wins. That route is
closed.

The version that is not closed: **a front's takings are paid into holdings
rather than the wallet by default**, with the player able to draw them out. The
legitimate side's income is then reinvestment capital by default and spending
money by decision, which is the correct default for the thing the whole design
now rests on, and it uses the holdings mechanic that already exists.

**b. Fronts have to survive.** One in three goes under, and 36% of paydays
happen with no front operating. Recovery was made a rate this morning, which
stopped the mass die-off, but a hostile neighbourhood still costs -1.24 a
front-week and is the largest single term. `SENTIMENT_START` was raised to widen
the band and **reverted** — it broke `deep.test.ts`, which asserts that a
district worked hard loses population. `HEALTH.sentimentFine` at 45 is the
untried lever: it decides whether a front survives without touching where people
live.

**c. Buying the next front has to be the obvious move.** It currently competes
with wages, jobs, counsel and events out of one wallet, and loses — $4,387 a
career. (a) largely fixes this by giving front income its own pocket.

## 4. Deliberately not changed

- **`LEGITIMATE_REVENUE_SCALE` stays at 0.72.** The note above it records a
  balance pass where fronts out-earning jobs turned this into a business
  simulator with a crime setting. Crime stays the engine; the fronts convert
  what it produces and compound what is reinvested.
- **Wages, job payouts and heat are untouched.** The gross economy measures as
  healthy and nothing here is trying to make a man earn more.
- **Dirty cash stays out of standing.**
- **Rank requirements other than money are unchanged.** Crew, respect,
  operations and districts stay as they are; if the money gate stops binding and
  crew starts binding instead, that is a better problem and a separate one.

## 5. What could break, and what will catch it

Pre-committed conditions that must still pass, and which are the finding if they
do not:

- `balance.test.ts > lets careful play build a bigger organization` — the rework
  must not make hoarding beat building, nor greed beat care.
- `deep.test.ts > districts that change` — a district worked hard still loses
  people.
- `soak` and `save` round-trip — the estate adds no saved state, so a save
  written before it must load and value correctly.
- `ladder.probe` — the shape of the finding, not a threshold: rungs must start
  arriving above Crew Leader, and a twenty-year run must reach further than a
  four-year one. That second one is the test that the ladder is no longer stuck,
  and it is the single clearest signal this rework worked.

The risk I would watch hardest: **an estate measure makes rank easy to hold and
hard to lose.** A family that buys three fronts passes Capo and cannot fall
back, because the high-water record protects it. That is intended — it is the
"leave something behind" half of the design — but if it makes the middle of the
game slack, the answer is to make the *next* rung further away rather than to
take the last one back.

## 6. Verification

1. `estate()` unit tests: a shuttered front is worth nothing, a damaged one is
   worth less, dirty cash never counts, a save with no holdings values correctly.
2. `ladder.probe` at four years — rungs above Crew Leader arriving at all.
3. `ladder.probe` at twenty years — rungs arriving *further* than at four, which
   is the difference between slow and stuck and is currently the former only in
   theory.
4. The full suite, and the two named pre-committed tests specifically.
5. A browser pass on the Finances and Businesses panels, on an isolated
   instance via `npm run playtest`.
