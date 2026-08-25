# The middle game — blueprint

**Status: proposal. No code changes accompany this document.**

The developer proposed four things for the middle of the game: dynamic
obstacles, more random events, buying real estate and cars and jewellery, and a
gambling system for heirlooms or perks.

This document measures each against what the game actually does today, and
recommends a build order. It also corrects a number I reported to the developer
two hours ago that is no longer true.

---

## 0. The correction, first

I said the front fork was **27 careers flat against 9 compounding**, and that an
arm of the probe which borrows to reach a front moved careers past $100,000
from **9 in 36 to 14 in 36**.

Re-measured on `main` as it stands after the merge:

    flat (under $100,000)        30 careers, median 1 front
    compounded (>= $100,000)      6 careers, median 5 fronts

    careers reaching $100,000, baseline → borrowing arm:   6/36 → 7/36

**The fork has widened and the repair has eroded.** Both halves of the
population got poorer when the rival families started acting, and the lender
route — which I shipped a tip for this morning on the strength of 9 → 14 — now
buys almost nothing. That is not an argument against active rivals. It is the
measurement saying the second front is a bigger wall than it was, and that the
teaching fix alone is no longer enough.

Everything below is sized against these numbers rather than this morning's.

---

## 1. What the middle game measurably lacks

Round 15, blind, 245 days, stopped deliberately:

> *"By 100 the job screen was a solved sort... After 160, at permanent heat
> 80–100, even that collapsed. Nothing new came up because the two things that
> would have opened new decisions — a second district and a second front — were
> both gated behind capital I could no longer accumulate, and the third, the
> drug trade, wanted a $40,000 retainer I never got near."*

Three facts sit under that.

**It is not a content shortage.** Task 1 added ten generative shapes, and they
now supply **35% of every new situation a career meets after day 180** — the
number was pre-committed before the work and met after it. Round 15 still
flattened at day 100. More events did not move the thing more events were
supposed to move.

**It is a capital shortage, and the probe agrees.** Across every week a career
owns no front, the blocker is **money in 97% of them**. Control, slots and
public feeling account for none of it. The median career at day 300 has an
estate of $29,759 against a trade retainer of $40,000 and a mid-tier front at
$60,000 to $90,000.

**And there is nothing to lose.** Asked what would have gone if it had all
gone, the tester answered:

> *"Honestly: not much, and that is the damning part."* $673, a laundromat worth
> half what he paid, one district, six men, three of them in custody.

Then corrected himself, and this is the most useful sentence in the report:

> *"What I would actually have lost was Little Sicily... a neighbourhood I had
> ruined and was trying to repair, and four men whose loyalty readings I could
> recite from memory. The money and the rank I would not have missed at all."*

The game already makes people and places matter. It makes **property** matter
not at all.

---

## 2. The four proposals

### 2.1 More random events — already done, and it did not work

**Verdict: build nothing.** Ten shapes ship today, drawn on their own daily roll
so they cannot crowd out the authored pool, supplying just over a third of the
late-career novelty. The pre-commit was met. The tester still stopped at day
100.

That is worth stating plainly because it is the cheapest thing on the list and
the most tempting: **the middle game did not go quiet for want of things
happening.** It went quiet because the things happening stopped changing what
the player could do about them.

### 2.2 Dynamic obstacles — the only one that reaches the stuck majority

**Verdict: build, and define it narrowly.**

The game throws plenty *at* the player. What round 15 lacked was an obstacle
that changes **what you do next** rather than **what you pay**. Every obstacle
in the back half of that run resolved to a priced option the tester could not
afford:

> *"From then on I spent 126 days in a state where the paid option on every
> event was greyed out with 'You have $2,399' next to a $6,000 price. On day 202
> I was offered three ways to stop Maria Vitale flipping and could afford none
> of them; the only clickable option was 'Leave them to it.' That is not a
> decision, it is a cutscene with a button."*

So the design rule this proposal has to obey, and it is the whole of it:

> **An obstacle a broke boss cannot answer is not an obstacle. It is a
> notification.**

Every obstacle worth adding must have at least one answer priced in something
other than money — people, ground, standing, reputation, time, or a favour. The
game already keeps all six. This is not a new subsystem; it is a constraint on
the existing event generator, and it is testable: *no generated obstacle may
present a set of options whose only non-trivial answers cost cash.*

That test does not exist and would have caught what round 15 walked into.

### 2.3 Real estate, cars, jewellery — build, but not first

**Verdict: build second. It answers the best line in the report and it cannot
be reached by the players who most need reaching.**

What it answers: `estate.ts` today values a wallet, protected holdings, fronts
and ground. There is no such thing as a possession. A boss cannot own anything
that is his rather than the organization's, which is why "what would you have
lost" got the answer it got.

What it does not answer: a sink only bites somebody with money, and **30 of 36
careers finish under $100,000**. Shipped before the fork moves, this is content
for the sixth of players who least need content — which is precisely the
mistake this project made putting the diplomatic doors at the 75th percentile
of a distribution nobody had plotted, and had to correct twice.

The shape it should take, when it is built:

- **A possession is visible.** It should feed `legitimacy` — which already reads
  what you visibly own — and it should feed notoriety. A man with a car like
  that is a man the papers can describe.
- **A possession is not liquid.** It counts toward `estate` and therefore toward
  rank, and it sells back at a loss, exactly as `holdings` already does. That is
  the trade: standing against liquidity, which the game already models and has a
  comment defending.
- **A possession can be taken.** Seizure is the point. An asset a warrant can
  reach is the only kind that makes a boss feel exposed, and the evidence and
  warrant machinery already exists.
- **Real estate is mostly already here.** Fronts and districts are property. What
  is missing is the *personal* half — a house, a place of his own — which is
  also where the personal-life layer built in Task 5 would find something to be
  about.

### 2.4 Gambling, heirlooms, perks — half of it, and not the half with perks

**Verdict: build the gambling as a sink. Do not build perks.**

Gambling fits: a money sink with variance, in a game about a man who runs card
games for a living, and it is a decision a rich boss makes and a broke one
cannot. Heirlooms are possessions by another name and fold into 2.3.

**Perks that boost your character should not be built.** Every number a player
has in this game was earned by doing the thing it describes — intimidation from
shakedowns, business from fronts, influence from counsel and approaches. That
rule is the reason the attribute screen means anything, and eleven rounds of
work sit on it. A perk from a dice roll is a different game's mechanic, and the
brief's own list of prohibitions opens with *do not add features because they
sound cool*.

If the developer wants them anyway, that is their call and I will build them
properly — but the argument against is recorded here rather than skipped.

---

## 3. Build order

Ranked by the evidence, not by the order they were proposed.

**1. The second front.** The diagnosed cause of the middle game going quiet, and
everything else on this list sits behind it. 97% of front-less weeks are a money
problem, 30 of 36 careers never clear it, and the teaching repair shipped this
morning now moves 6 careers to 7. This needs an economy change, not a signpost.
The candidates, in order of how little they disturb:

- Front prices scale with what the family has ever been worth, so the *second*
  one is priced against a small organization rather than against the catalogue.
- Income from a front compounds into holdings today. A second front is
  therefore a step change; a **partial stake** in one would be a ramp.
- The lender ceiling is $40,000 flat. Tying it to the estate would let a
  small-but-real organization borrow into its first expansion.

Whichever is chosen, the measurement is the same and already exists: the flat
and compounded halves of `ladder.probe`'s 300-day distribution.

**2. Obstacles with a non-cash answer.** Reaches the stuck majority immediately,
needs no new state, and carries a test the project does not have.

**3. Possessions.** Answers "what would I have lost". Feeds legitimacy,
notoriety, estate, seizure and the personal life. Worth real design time.

**4. Gambling.** A sink with teeth, once there is money to sink.

**Not scheduled: perks.**

---

## 3a. What was built, and what it measured

Added after the build, so the document does not go on describing a plan that
has been overtaken.

**1. The second front — done.** `ACQUISITION_SCALE` prices a front against the
family's high-water estate rather than the catalogue, so the discount is
largest for an organization that has never been worth anything and gone by the
time one is. Median fronts **1 → 2**, compounding careers **6 → 12 of 36**,
first front on day 35 in 36 of 36. Capo 13 → 19, still short of the
pre-committed 24.

**2. Obstacles with a non-cash answer — done.** `obstacles.test.ts` encodes the
rule as a property of the catalogue: *every event that asks for money must also
offer something that does not, and the free answer has to change the world.*
It went red on `opportunity_score`, whose decline branch was
`if (choiceId !== 'take') return;` — a button that did nothing, which is
exactly what round 15 described as "a cutscene with a button". That memo now
offers **sending your own people instead**: no money, a smaller cut, worse
odds, and on failure somebody comes back hurt.

The first version of that answer locked two men out as `busy` for three days
and the soak refused it — `busy` means *on an operation*, and a man marked busy
with no operation is a hole in the model. The refusal was right for a better
reason than it gave. Time was a weak price; people are the right one, and round
15 said so directly.

**3. Possessions — done, and measured before being believed.** Nine items
across property, cars and jewellery. The four properties the section above
asked for, each falling out of a system that already existed:

- Counted at face in `estate`, exactly as `holdings` is, so buying one moves
  rank **not at all**. What it costs is that the money has stopped being money.
- Sells back at 0.6, worse than holdings' 0.85, because a bond is a bond and a
  two-year-old car is a two-year-old car.
- The **visible share** feeds `legitimacy`, which already asks what proportion
  of a family's worth is out where people can see it.
- The **same visibility** runs a newspaper item, which raises notoriety, which
  `legitimacy` punishes and every civic figure reads as a reason to keep their
  distance. So the flashy car is genuinely two-sided and nothing was built to
  make it so.
- A warrant takes the best single thing in the house, and nothing comes back.
- Clean money only. A house bought out of a suitcase is a laundry, and
  laundering is what fronts are for.

And the reachability question this document raised against itself — *"content
for the sixth of players who least need content"* — was answered by plotting it
rather than by asserting it. Across 36 careers of 300 days:

    careers that could ever afford anything     36/36, median first day 7
    weeks something was affordable              61%
    weeks a home of your own was affordable     14%
    dearest ever in reach                       median $14,000, best $75,000

The first pricing put the cheapest home at $22,000, **above the median
career's ceiling of $14,000** — so half of all careers would never have reached
the one item that hooks into the personal-life layer. It is $13,000 now, and
`ladder.probe` carries a standing condition on home reachability rather than
trusting the comment, because the price was corrected *after* seeing the
reading rather than before it and that is the weaker kind of evidence.

The Merriweather place at $160,000 is reachable by nobody in 300 days. That is
deliberate and it is recorded here rather than discovered later.

**4. Gambling — done, and it is not a slot machine.** A standing weekly game in
three rooms, and the whole design is one sentence: *you choose the room, you
choose how to play it, and somebody specific is sitting opposite you.*

Three postures, and they are genuinely different decisions:

- **Straight** is a sink. `maxWin × payout` is under 1 at the *ceiling* of the
  attribute that helps, not merely at the average — checked by a test, because
  a house edge that dies against a good player is a delayed exploit.
- **Lose on purpose** always costs the stake, and buys a favour from the person
  opposite. This is the mechanic the section above did not anticipate and it is
  the best thing here: civic standing *drifts toward a target* every week, so a
  one-off boost would be gone inside a fortnight — the durable thing a judge can
  give you is a favour owed. Capped by the same `CIVIC.maxOwed` every other
  route respects, so it is a **faster** road to a favour and never a bigger
  stock of them. The slow road is thirteen quiet weeks.
- **Play hard** pays 1.4 to 1 against straight's 0.8, deliberately. A "risky
  option" that returns less in every currency is a trap with a label, not a
  choice. The price is standing, notoriety, and being watched: suspicion rises
  every time you try it and a great deal when it lands, so the profitable line
  is self-limiting — twice a year never meets the mechanism and every week is
  caught most weeks.

And the tie-in the section above asked for: **heirlooms fold in as possessions.**
You may put something of your own up when the money will not cover the stake,
which is the obstacles rule applied to an opportunity instead of a threat. Lose
it and the post-mortem says *"the necklace with a history (lost at cards on day
212)"*.

The tiers were sized against a plotted distribution, and the first attempt was
not. They went in at respect 0 / 25 / 55 on intuition; the probe now prints the
share of weeks a career spends at or above a ladder of bars:

    respect at least   25    55    85   120   150   180   220
    share of weeks     89%   77%   62%   46%   36%   27%   21%

At 55 the "invitation you cannot ask for" was cleared in **77% of weeks**. The
club sits at 85 and the room upstairs at 180 now, which measures as:

    weeks each room would have seated you   96% / 48% / 14%
    careers ever invited upstairs           28 of 36

That last figure is the one that matters and a share of weeks hides it: 27% of
weeks is the same number whether a quarter of careers are welcome always or
every career is welcome eventually, and only the second is an invitation.

**Perks remain unbuilt**, and the argument against them in 2.4 stands
unchallenged.

---

## 4. Constraints any of this must satisfy

From `HANDOFF.md` §2, unchanged:

- No jsdom, no `@types/node`. Config must not import sim.
- New state fields are optional. **Never bump `SAVE_VERSION`**, never add to
  `validate()`.
- Determinism: any change reshuffles every later `rng` call. Measure over a
  population, and remember that 36 careers was not enough to tell a five-point
  shift from noise when it mattered.
- **Never adjust a probe threshold to make it pass.**
- Write the test first, watch it fail for the right reason.
- The game's voice is load-bearing.

And two this document adds:

- **A bar goes between the median and the 75th of a distribution somebody has
  plotted** — and the plot has to include where the quantity *starts*. A bar
  below `STARTING_RESPECT_FOR` opened a door on day one this week.
- **A guard is written against the claim, not against the sentence.**
  `layLowHonesty` hunted three specific strings and round 15 walked into a
  fourth, a fifth and a sixth.

---

## 5. What this document does not claim

It does not claim possessions will work. Nobody has asked for them; the
strongest evidence for them is one sentence from one tester about a
neighbourhood, and a neighbourhood is not a car.

It does not claim the second front is the only cause of the flat middle game. It
claims it is the one the instruments agree on, and that the others cannot be
told apart from it until it moves.

It does not claim the front-fork repair from this morning was wrong — only that
it is now worth 6 careers to 7, and that a signpost to a route that no longer
pays is a signpost to nothing.
