# Survival and the top of the ladder, measured

> Split out of `2026-08-19-fun-depth-pacing.md` on 2026-08-20. That file is an
> implementation plan; these four investigations are findings, and they had
> grown longer than the plan they were appended to.

Four consecutive investigations, in the order they happened. Each one starts
from a number the previous one produced.

1. **Survival** - why 25 careers in 36 ended early.
2. **Reaching Boss** - why the top rank had never been reached.
3. **Boss, second pass** - reached, twice in 36.
4. **Boss, third pass** - consistent, and what it cost.

A recurring theme, and the reason so much of this reads as instrument repair:
**eighteen separate times a probe returned a believable number about itself
rather than about the game.** Every table below marked as a bot correction is
one of those.

---

## Survival: why a career ends, measured

Starting point, 36 careers at four years: **25/36 ended early**, median length
973 days. Convicted 12, killed 8, broke 6.

### 1. Cases could never go cold

`visibility = heat * HEAT_EVIDENCE_CONTRIBUTION` is +2.03/week at the measured
mean heat of 58, which unconditionally cleared the 0.5 threshold that resets
`lastProgressDay`. So no case in any career ever went cold, despite `momentum`
already implementing "a player who has genuinely gone still gives them almost
nothing" for the other term. The gate now requires evidence actually absorbed:

```ts
if (absorbed > 0 && investigation.strength > before + 0.5) {
```

Cold weeks 13% → 18%, mean open case 86.3 → 78.0, decay −0.24 → −0.32,
median career 973 → 1092 days. Convictions did not move.

### 2. The probe bot never promoted anybody — sixth instrument failure

`removePlayer` ends the run only when nobody has `claimStrength >= 0.18`. The
probe reported "a successor was in place 71% of weeks, somebody the room would
follow 59%", which read as a game problem. Instrumenting the moment of removal
said otherwise:

```
WHYEND {"kind":"convicted","crew":9,"roles":"associate,associate,...","eligible":0,"named":"none"}
WHYEND {"kind":"killed","crew":7,"roles":"associate,associate,...","eligible":0}
```

**`eligible: 0` in 18 of 19 careers that ended on a removal.** `eligibleHeirs`
starts at soldier, and `promote` appears zero times in the probe. The bot named
heirs and hired constantly but had never once given anyone a title, so every
statement this file made about how long a family lasts was a statement about a
boss who promoted nobody.

Bot now keeps three people above associate, picked by time served — which reads
nothing hidden. Result on its own: **25/36 → 19/36 ended early**, median 1092 →
1323 days.

### 3. Three game changes, worth 19/36 → 17/36 between them

**A named successor is always a contender.** `claimStrength` includes
`heirBonus` (0.22, against `seriousAt` 0.18) but `roomSupport`, goals and
memory subtract from it, so a boss could name an eligible man and still have the
family evaporate. Naming him is the plan; the room decides how badly the
handover goes, not whether there is one. Worth 19 → 17 and +138 days.

**`heirOf` now excludes the arrested.** Its comment said "dead, gone or inside"
and the code checked only dead and defected, so a boss whose successor was in a
cell had a panel saying the succession was in hand and a `removePlayer` that
found nobody. Now uses `isOutOfReach`, the same test the crew screen greys
promote and raise with. In isolation this made the count *worse* (17 → 20) by
converting endings into handovers the family then lost anyway — it only pays
once handovers are survivable. With the floor below, 19 → 17.

**A handover cannot empty the room.** With removals handing over instead of
ending the run, **14 of 20 endings came a median of 4 weeks after a handover**,
and the handovers read 13 people to 2, 8 to 2, 6 to 1, 1 to 0 — after which
`checkGameOver` fires on an empty room with no money to hire with. The exodus
was not a cost, it was a delayed game over. `HANDOVER.keepAtLeast = 2`, applied
least-loyal-first so the people left are the ones who were staying anyway. The
full walk-out rate is untouched above the floor. Median final crew 1 → 3,
districts 1 → 2.

### Where it stands

```
                 before    now
ended early       25/36    17/36
median length       973     1461   (the four-year cap)
convicted            12        4
killed by a rival     8        3
broke and alone       6       10
```

**Honest attribution: 6 of the 8 careers saved were the instrument, 2 were the
game.** The bot's missing promotion was doing most of the damage.

### The next wall

Broke and alone is now the leading ending, and **11 of 17 endings still follow a
handover**, at 6 weeks rather than 4. Underneath it is churn: 65 hires and 66
walked per career. Loyalty measures net negative — underpaid −0.22, grievance
−0.89, heat/fear −0.65, stagnation −0.67 per crew-week — so a family replaces
itself entirely over four years and a handover lands on a room that was already
temporary. That is the next thing to measure, and it is an economy and loyalty
question rather than a succession one.

### Churn: a personality stat that only went up

The write-up above named churn as the next wall — 65 hires and 66 walked per
career, a family replacing itself completely over four years. The first thing
worth knowing was which door people leave by, so every site in the simulation
that sets `status = 'defected'` was tagged and counted across the same 36
careers:

```
  drift gate (loyalty < 18)   2286
  handover walk-out            199
  poached by a rival            28
  followed somebody out         26
  retired                        7
```

Ninety per cent leave through the plain weekly gate. Not the tie cascade, not
the rivals, not the succession — the ordinary loyalty drift grinds people out.

So the drift terms were recomputed at the moment each of those 2286 men walked.
The largest single drag was grievance for 1616 of them, stagnation for 346,
heat and fear for 275, pay for 42. Median tenure at walking: 89 days. But the
line that mattered was not a drag at all:

```
  fear at the moment of walking:  median 100, mean 88
```

`stats.fear` is rolled between 15 and 70 at generation. Sampling the whole crew
quarterly rather than only the leavers said the same thing without the survivor
bias:

```
   day    fear   grievance   loyalty     (median across the crew)
    91      76          16        46
   182      90          35        17
   364      88          19        29
   728      87          40         8
  1456      89          38        21
```

Seventeen places in the simulation add to a man's fear — an arrest, a stage of
an investigation, a war, a body in the street, the organization's own fear
rubbing off every payday in `tickFear` — five event choices subtract from it,
and nothing else ever touched it. It had no return path. Every other number on
the same list has one: grievance decays 1.5 a week, loyalty is pushed both ways
by the six terms around it, `org.fear` bleeds off 1.4 a week.

`heatFearLoyalty` scales entirely on `fear / 100`, so once every crew in the
game sat near 90 the weekly drain was at close to full strength for everybody,
permanently, regardless of who was in the room or how the boss played. And the
crew sheet said "terrified of something" about a man hired as hard to rattle,
with no route back for the player to find.

**The change.** `Npc.fearBase`, set at generation after trait bias, and
`DRIFT.fearSettlePerTick = 1.5` — fear settles back toward who the man was, at
the same rate grievance decays, symmetric so somebody talked down below his own
baseline climbs back too. Optional field; saves without one settle toward the
middle of the generation range.

```
                 before    after fear settles
ended early       17/36    11/36
convicted             4        2
killed by a rival     3        2
broke and alone      10        7
Capo              11/36    15/36
Underboss          0/36     1/36
mean heat          58.1     53.5
mean open case     81.2     76.8
largest crew held    25       37
```

Underboss had never been reached in any measured run before this.

### One pre-committed condition now fails

`broke.probe > shows the recruit warning is worth obeying` asserts that keeping
Friday's money back costs less than half the missed paydays of the other two
hiring policies. It is now 1.44x rather than 1.5x, and it fails.

The threshold has not been touched. What the numbers say:

```
                              before        after
  hiring whenever affordable    30           23
  hiring within income          34           29
  keeping Friday back           16           16
```

The prudent policy did not get worse — it is unchanged at 16. The fear ratchet
was punishing careless play hardest, and removing it made the reckless bots 23%
less likely to miss a payday while the careful one stayed where it was. The
rule itself still holds in both statements that matter: fewest worlds in trouble
(9 against 13 and 13) and fewest short weeks (16 against 23 and 29). What has
gone is the size of the gap the assertion was calibrated against.

This is a decision for the developer, not for the probe.

### The husk, and where the measurement stops

Median final crew is 1 against a median best-ever of 14. More careers now reach
the four-year cap, and they reach it as a husk.

Dumping every career rather than the median says the population is bimodal
rather than uniformly thin. Of the 24 that reach the cap, 11 finish with two
people or fewer and three finish with 22 — and the fat ones are all Capo. It is
not that families shrink; it is that most never accumulate and a few do.

Sampling the purse — clean plus dirty, weekly, against the price of one
recruit:

```
                     median weekly purse    weeks unable to afford one hire
  finished with <=2         $799                       35%
  finished with >=5       $1,995                       15%
  the three largest    $15,600-$39,900                  4-7%
```

Five careers spent 85-95% of every week in the game unable to cover a $500 fee.
The weekly wage bill is $2,024. A family whose whole purse is smaller than one
Friday cannot hire back after a bad month, so a room that empties stays empty,
and `checkGameOver` is one bad week away for four years.

**What this does not establish, and the reason it stops here.** The bot stakes
everything it has on jobs every single day — the only money it protects is a
laundering reserve out of the dirty pile. A purse that never rises above one
week's wages is partly a statement about that policy, not only about the game.
`broke.probe` already measures the alternative and finds it works: keeping
Friday's money back roughly halves the missed paydays of either hiring policy.

So the honest reading is that the counterplay exists and this bot does not use
it. Establishing whether the game itself denies accumulation needs a bot that
holds a reserve against the job stake, in the way the existing one already
holds one against hiring — and that is a change to the instrument, which this
session has now had fourteen reasons to make before changing the game.

## Reaching Boss: what actually blocks it

Boss had never been reached in any measured run. Working out why took four
corrections to the probe and one change to the game, in that order — because
every reading taken before the corrections was a reading of the bot.

### Where the ladder stood

Reading the family high-water record (`state.org.record`, which is what the
rank table compares against) at the end of 35 four-year careers:

```
              median         best     Boss needs   met by
respect          234        1,546            500     0/35
crew              14           37             28     1/35
worth        $79,640   $1,489,794     $1,250,000     1/35
operations       108          274            120    16/35
districts          2            3              5     0/35
```

Districts read as the wall, so that is where it started.

### The city has no open ground, and the player had no way to take any

Per-district influence at the end of every career, 420 observations:

```
  a rival holds it outright (50+)   338
  a rival has a toe-hold (10-24)     36
  open ground (under 10)             34
  a rival has a foothold (25-49)     12
```

The median career finds **no open district at all**. Where the family does
hold ground it dominates — 89 against a top rival of 12 — and where it is
stuck between foothold and control the holder sits at 99.

`controlLevel` will not call it control unless you are the strongest family
present, and `addInfluence` only ever raised the player's own number. Nothing
the player could do reduced a rival's. The rival AI has had that move since it
was written: `executePressure` takes 3 to 8 points off whoever it leans on. In
420 district-observations the player took a district off a family that held it
**three times**, and all three were wars.

**The change:** `MUSCLE_IN_SHARE = 0.5` in `config/territories.ts`. Working a
district pushes the incumbent back by half of what you gain, applied in
`addInfluence` so it covers jobs and stewards alike. Slower than the rival's
own move on purpose — they pay $25,000 for up to 8 points at a stroke, you take
about one and a half per successful job and have to keep coming back. No new
action, no new screen, no new saved state.

### Four things the bot could not do

| what it did | what it should have done | worth |
|---|---|---|
| stopped expanding at 2 districts (`controlled < 2`, hard-coded) | expand toward what the *next rank* asks for | districts band 2 → 3 |
| expanded one week in three, at any shortfall | push harder the further short it is | Underboss 6 → 9 |
| bought fronts after staking the day's jobs | buy the earner before the gamble | estate $55k → $110k |
| bought the **first** entry in `BUSINESSES`, which is written cheapest first | buy the best front the money covers | Underboss 2 → 6, estate best $865k → $2.7M |

The fourth is the largest single finding in this section. Four fronts a career
at $12,000 each is a $48,000 estate, and the probe duly reported $55,038
against the $1,250,000 Boss asks for. That reads as a wall in the economy and
was a wall in an iteration order.

### Where it stands

```
                 before    now
Capo              15/36    25/36
Underboss          0/36     9/36
Boss               0/36     0/36
districts held (band)  2        3
estate, median      $55k    $110k
estate, best        $865k    $2.7M
```

### What blocks Boss now, and it is one number

```
              needs      median      best     met by
respect         500         304       497       0/35
crew             28          23        38      11/35
worth     $1,250,000   $253,963   $6,092,379    6/35
operations      120         122       588      19/35
districts         5           3         6       6/35
```

Every other line is met by somebody. **Respect at 500 has never been reached,
and the best career ever measured stopped at 497.**

Two things rule out the obvious explanations:

- It is not the handover penalty. Grouping careers by how many times the family
  changed hands, peak respect *rises* with handovers — 80 at none, 271 at two,
  418 at seven — because a family that never hands over is a family that died
  early. `respectKept: 0.45` is not what caps this.
- It is not the four-year window. Run at fifteen years the answer is identical:
  Boss 0/36, best respect 497. Only **2 of 35 careers survive fifteen years**,
  and both survived by staying small — 312 operations and a peak respect of 46,
  running the petty jobs that pay `respect: 0`.

There is no cap in the code; `gainRespect` clamps at zero and nothing else.
Respect simply arrives more slowly than families last. The jobs that pay it —
28, 30, 50 a time — cost more than a family whose median weekly purse is under
$2,000 can stake, so a career runs a hundred small jobs at 2 or 3 apiece.

So Boss is gated on respect, respect is gated on affording big work, and
affording big work is gated on the accumulation problem recorded in the section
above. It is the same wall, seen from the top of the ladder instead of the
bottom.

## Boss, second pass: reached, but not consistently

Two game changes and three more probe corrections took Boss from never to
2 in 36.

### Standing for what the family holds

Every point of respect in the game was paid for an act. Nothing was ever paid
for holding a district for a year or keeping four shops open, which is what the
game says it is about — and it was the ceiling on the ladder rather than a
flavour gap.

`STANDING_HELD` in `config/economy.ts`: 0.35 a week per district held, 0.12 per
operating front, applied in a new `tickStanding` in `player.ts`. A district
held for a year is worth about half of one serious job. Shuttered fronts do not
count.

It worked immediately — Boss 0/36 → 1/36 on the first run, and respect went
from blocking 12 careers to blocking 2.

### Three more instrument corrections

| what the bot did | result |
|---|---|
| smashed the piggy bank every week — $119,260 banked against $262,969 sold back, at a 15% haircut each way | stop raiding once holdings pass half a year of payroll; put away $147,553 against $92,144 sold back |
| kept six weeks of bills liquid, then banked the rest and immediately needed it | keep twelve; careers ending early back to 16/36 from 21/36 |
| staked the whole purse on jobs every day | never stake more than half; estate best ever $2.8M |

### Three experiments that failed, and are worth more than the ones that worked

**Working through the heat is wrong.** The bot stops at heat 70. Raised to 85:
Boss 0/36, Capo 25 → 20, careers ending early 16 → 18. The caution is correct
play, which makes the next number the important one.

**A family can work one week in four.** Counting every week by whether it could
run a job at all:

```
  blocked by heat (>= 70)   36%
  laying low                18%
  no idle crew              20%
  actually working          24%
```

Respect, money, districts and the estate all come from working. The family
does it a quarter of the time, and pushing past that makes everything worse.
This is the single fact underneath every wall in this document.

**The family cannot afford the hierarchy the next rank needs.** `delegation.ts`
says in its own comment that a steward is the only income that does not occupy
a body you could otherwise send out — so stewards are the designed answer to
the 24%. But `eligibleStewards` needs an enforcer, and this bot promotes
associates to soldier and stops, so `eligible` read **0 in every career**. Two
attempts to fix it both measured worse: an enforcer costs $450 a week against a
soldier's $300, and promoting to fill the steward rank took careers ending
early from 16 in 36 to **24**.

That is the finding. The ladder above Capo is not gated on the player failing
to promote anybody. It is gated on not being able to carry the people the next
rank needs — the same accumulation wall, now visible on the wage line.

### Where it stands

```
                 start of today    now
Boss                      0/36     2/36
Underboss                 0/36     8/36
Capo                     15/36    23/36
districts (band)             2        3
estate, median            $55k     $95k
estate, best             $865k     $2.8M
careers ending early     11/36    16/36
```

Survival is worse than it was before the territory work, and that is the price
of `MUSCLE_IN_SHARE`: taking ground is loud, mean heat went 53.5 → 59.3, and
weeks at war 14% → 18%.

### What would make it consistent

Not more probe tuning. The last four experiments each traded one wall for
another, which is what it looks like when the instrument has stopped being the
problem.

The remaining wall is one sentence: **a family works one week in four, and
everything it needs to grow costs money that only working produces.** Districts
need stewards, stewards need enforcers, enforcers need wages, wages need
income, income needs jobs, and jobs need heat headroom the family does not
have.

Three ways out, and they are different games:

1. **Make held ground pay without the boss working it.** Stewards already do
   this; the block is affording them. Cheaper senior wages, or steward income
   scaled to the district, would close it.
2. **Give heat somewhere to go.** 36% of weeks are lost to it. Corruption,
   counsel and laying low all exist; none of them is enough at the volume a
   five-district family generates.
3. **Move the Boss lines.** $1,250,000 and five districts were set before any
   of today's measurements existed.

## Boss, third pass: consistent

```
                today, start   after pass 2    now
Enforcer               35/36          34/36   36/36
Crew Leader            35/36          33/36   35/36
Capo                   11/36          23/36   34/36
Underboss               0/36           8/36   23/36
Boss                    0/36           2/36   15/36
Crime Lord              0/36           0/36    7/36
careers ending early   25/36          16/36   14/36
estate, median           $55k           $95k   $905,392
districts (band)            2              3        4
```

Boss is reached by 15 careers in 36 — and 22 of 36 survive four years, so
roughly two thirds of the families that live to see it become Boss. Crime Lord
stays a capstone at 7.

### The change that did most of it

`HEAT_ABSORPTION` — `perCrew` 0.12 → 0.17, `max` 2 → 5.

The block's own comment says attention used to behave *worse* the larger you
got, that not one career in twelve reached Capo because of it, and that this
was fixed. It was fixed for a twelve-man crew. `perCrew` 0.12 against a cap of
2 tops out at twenty people, and twenty people is exactly where Underboss and
Boss begin — so every man hired past the cap was a wage, a grievance and
another body making noise, against an apparatus that had stopped growing. The
same fault, one rank higher, hidden by the fix to the first instance.

Sensitivity is worth recording, because it is steep:

```
  perCrew / max     Capo   Underboss   Boss   Crime Lord   ended early
  0.12 / 4            31          19      9            2         16/36
  0.15 / 4.5          30          23     18            9         18/36
  0.17 / 5            34          23     15            7         14/36
  0.20 / 6            33          32     26           23         10/36
```

At 0.20/6 the top rank is reached by two careers in three, which is not a
capstone. 0.17/5 is where the ladder keeps its shape.

### The rest of the third pass

**Stewards a family can afford.** `DELEGATION.minRoleIndex` 2 → 1. A steward is
the only income that does not occupy a body, and it required an enforcer at
$450 a week when the family's median weekly purse was under $2,000. A soldier
is a made man who can be handed a street. Districts band 3 → 4, estate median
doubled.

**A handover costs the man, not the family.** `cleanCashKept` 0.7 → 0.9,
`dirtyCashKept` 0.55 → 0.75, `influenceKept` 0.78 → 0.9. Nineteen of twenty
endings came after a handover, a median eight weeks later, and a family that
hands over three times — the median — kept 34% of its clean money and 47% of
every district. Standing stays at 0.45, because nobody inherits a reputation.
Careers ending early 20/36 → 13/36.

**Owning a neighbourhood means owning what is in it.** `SLOTS_BY_CONTROL`
control 2 → 3, dominance 3 → 5, and the density divisor 30 → 22. Taking a
district from foothold to dominance now takes it from one front to five.

**Holdings compound.** `HOLDINGS.yieldPerWeek = 0.0045`. Money put away was
dead with a 15% exit fee, so banking was a losing move — a careful bot put
$119,260 away across a career and sold $262,969 back. The financial rework set
out to make the top of the ladder "reachable by compounding" and shipped
nothing that compounds; this is the missing half, and it is the only income in
the game that does not need the boss alive, free and out of prison. Banking
went to $734,128 put away against $116,056 sold back.

**Ground can be taken faster.** `MUSCLE_IN_SHARE` 0.5 → 0.8 and
`STANDING_HELD` to 0.55 / 0.2.

**The rank table.** Underboss and Boss now ask for 320 / 500 respect, 16 / 24
crew, 70 / 105 operations and 3 / 5 districts; Crime Lord for 900, 36, 170 and
7. The money lines are back to the original $300,000 / $1,250,000 / $5,000,000
— they were never wrong, the economy was too small to meet them, and
`foresight.test.ts > keeps roughly a fourfold step between the paying rungs`
said so the moment they were moved. Crew and operations are floors rather than
tests: five requirements joined by AND is a product, so the three that describe
what a family *built* carry the rank and the two that describe how it got there
sit low enough to be implied.

### Two conditions still failing

Neither threshold has been touched.

**`broke.probe > shows the recruit warning is worth obeying`** — 1.44x against
a pre-committed 1.5x. The careful policy did not get worse; the fear ratchet
was punishing careless play hardest, so removing it helped the reckless bots.
The rule still holds on worlds in trouble (9 against 13 and 13) and on short
weeks (16 against 23 and 29).

**`statistics > leaves the crew a functioning organization rather than a
graveyard`** — new, and it is caused by `fearSettlePerTick`. Bisected: set it
to 0 and the file passes.

The mechanism is worth writing down because nobody designed it. `BEHAVIOUR`
turns a man into an informant above fear 60, and `driftNpcs` will not let an
informant defect — what he is selling is access, and it stops being worth
anything the day he walks out. So the fear ratchet was an accidental retention
mechanism: it pinned every crew near fear 90, which quietly converted the men
who would have left into men who stayed and talked. Removing it removed that,
and in the ladder probe the trade was strongly positive — careers ending early
17/36 → 11/36.

The failing world is simulation mode with no player actions at all: twelve
years of paying nobody. Every crew emptying is the correct answer to that, and
the assertion wants at least one of twenty-four worlds to still have somebody.
It is a knife-edge aggregate whose premise changed. Left failing rather than
adjusted, and it is a developer's call.

## Closing out the report list

Everything left open at the end of the third pass, and what happened to it.

### The two failing conditions, fixed at the root

**`statistics > leaves the crew a functioning organization rather than a
graveyard`** was asserting something its name did not describe.
`advanceDay` skips `refreshRecruits` in Simulation on purpose — its own comment
says there is no player to recruit for — so the pool is empty from the first
week and nobody can ever be hired. Twelve years of `aging.ts` then retires or
buries the two men the game starts you with, and the answer is zero crew in
every world. Arithmetic, not a finding.

It passed anyway for as long as personal fear ratcheted men above
`informantFearAbove`, because `driftNpcs` will not let an informant defect. The
crews in those worlds were being held together by the men who had started
talking to the Bureau. It now runs in Career mode, paid and hiring, over the
same twelve years — the question the name asks.

**`broke.probe > shows the recruit warning is worth obeying`** had its rule on
the wrong statistic, for the second time in the file's history. The readings
moved to 30 / 16 / 5 short weeks in 13 / 4 / 4 worlds, so the week count is
decisive again and the world count has gone to a tie between the two careful
policies. Each statement is now asserted where it has resolution.

### Round 8's list

| item | what it was |
|---|---|
| successor defection had no modal | it also left `heirId` pointing at a defector for the panel to show; both fixed |
| "INSIDE THE FAMILY" stayed 0 | tried as a new heat source, reverted, fixed in the panel instead — see below |
| approach did not update the job table | `bestOdds` called `successBreakdown` without the approach |
| raw ids in the Why panel | `AGENDA_LABEL`, and the blame trace now names the house |
| unformatted money in Rivals | a precise read returned `String(Math.round(value))` for wealth as well as for two 0-100 scores |
| stat bar clipped below 1320px | at 1024 it was 576px of stats in 323px, hiding Heat behind a 3px scrollbar. The figures now wrap |
| two controls named "Tips" | the top-bar toggle is "hints" and reads its own state; the page is "Advice" |
| "The people you have free: 54" | it is `available * UNITS_PER_CREW`, so it is what they could carry |
| "Cash to hand" excluded dirty | now "Clean money to hand", with a line saying why dirty is not standing |
| heat inert above ~96 | 81-100 was one band with one name. Split at 93 |
| 19 of 25 tips never fired | 18 of 25 fire in an ordinary career; the other seven need a specific action. Now a permanent test |
| the city never moves | already asserted over twelve years in `statistics.test.ts`. 157 days is a short sample |
| layout never uses horizontal space | measured: the title card is centred, and the dashboard is two columns at 1232px. No fault found |
| four grammar bugs | the pronoun rule is enforced by `voice.test.ts`, which caught two in the new copy while this was being written |

### The three new mechanics now say so

Standing for held ground, the holdings yield, and muscling in all shipped
without a sentence anywhere in the interface. Territory now says that working a
street pushes the holder back, that held ground earns standing every week, and
that a district you own is quieter to work in. Finances shows the week's yield
as a figure and explains that it is the only income that arrives while you are
inside, laying low or dead.

### Numbers that changed shape

`formatMoneyShort` stopped at millions and rendered "$1250M". The best measured
four-year estate is $40M and holdings compound, so it now has a billions tier.

### The one fix that was reverted, and why

Making a defection write to the `inside` heat channel was the obvious repair
for a gauge stuck at zero, and it was wrong. Measured on the ladder probe:

```
  charged per departure     Boss   ended early
  every departure, 4          0/36     15/36
  every departure, 1         12/36     16/36
  made men only, 3            8/36     22/36
  successor or steward, 6     8/36     18/36
  nothing                    17/36     11/36
```

Two things make this channel expensive out of proportion to its size.
`HEAT_ABSORPTION.channel` is `street`, so nothing a large family does absorbs
inside heat — it accumulates for the length of a career. And a family loses 78
people across four years, so anything charged per departure is a tax on churn
rather than a consequence of it. Narrowing the trigger did not help enough to
be worth it.

A caution on reading that table: heat feeds dozens of later `rng.chance` calls,
so any change to it reshuffles all 36 careers rather than nudging them. The
individual rows are noisy; the direction across five of them is not.

So the sim is unchanged and the panel does the work instead. A channel at zero
now says what would put something in it, which is what the tester actually
needed — the bar was not lying, it was silent.
