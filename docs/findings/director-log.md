# Director log

One entry per iteration. Read it before starting the next one; its purpose is to
make it obvious when the game has stopped improving.

Rules it operates under: `docs/DIRECTOR.md`.

---

## Iteration 0 — 2026-08-20 — baseline

Round 9, blind, day 150, Crew Leader. Full report in the conversation record.

    First hour 8 · Clarity 8 · Feedback 7 · Depth 7 · Pacing 6
    Difficulty 8 · Writing 9 · Interface 7 · Fun 7

**Findings taken forward, named:**

- **F1 — the loop closes at day 115.** "My turn was literally the same three
  launches every night, and nothing in the world pushed back hard enough to
  make me change it." Round 6 said the same thing at day 85. The bot scorecard
  says it independently: 250-day quiet stretch, Pacing 5.8. Three instruments.
- **F2 — Influence never moved off 0 in 150 days**, gating police contacts,
  city hall and two layers of the City panel. Tester could not tell whether it
  was their failure or a wall.
- **F3 — "Put away" fills itself** with front takings, silently, and caused a
  payroll failure on day 112 while $6,079 of the player's money sat in it.
- **F4 — counsel's weekly price is only visible after you commit to it.**
- **F5 — the rival families do nothing.** All three on GET RICH / consolidate
  for 150 days, all nine relationship cells Neutral at the end.

**Closed before iteration 1, in direct response to round 9:**

- The savings yield was advertised at 0.23% a year against an actual 23.4% —
  `* 5200` is already a percentage and the copy divided by 100 again.
- `heatTier` matched integer ranges against a floating number, so every reading
  in a gap reported *Quiet*. See iteration 1; this turned out to be much larger
  than a wrong label.

Caveat on this baseline, recorded because it limits everything above: the round
reached day 150 and Crew Leader. Six of the nine scores describe the first third
of the game. Round 10 onward plays to Capo or day 300.

---

## Iteration 1 — 2026-08-20

**Diagnosis.** F2. Influence gates three subsystems and is trained in exactly
two places in the entire game: a $25,000 choice inside one heat event, and
acquiring a police contact — which itself requires influence 5, 7 or 11 for
three of the four agencies. The main way to earn it was to already have it.
Meanwhile the Yourself panel tells the player attributes improve by use, which
for this one was untrue. That is the mechanical root under F1: a third of the
game's content cannot arrive, so nothing new arrives.

**Hypothesis.** If influence accrues from the two things a player already does
that the attribute's own description is about — keeping counsel on retainer,
and approaching another family — then F2 will not appear in round 10, because
an ordinary career reaches the first contact threshold without being told to.

**Change.**

    src/config/economy.ts    INFLUENCE_FROM { counselPerWeek 0.12, approach 0.6 }
    src/sim/economy.ts       a paid retainer trains it, scaled by the firm
    src/sim/diplomacy.ts     an approach trains it, made and paid for, refused or not

**Verification, and the thing it turned up.**

The ladder had moved sharply since the last reading — Boss 17/36 to 9, Crime
Lord 7 to 1 — so before measuring anything I isolated it by setting
`INFLUENCE_FROM` to zero and re-running. The ladder did not come back. My change
was not the cause.

The cause was the `heatTier` fix made in response to round 9. Every heat reading
that fell in a gap between the integer tier ranges had been reporting *Quiet*,
whose `decayMultiplier` is 1.0 — the fastest on the table. **The bug had been
accelerating heat decay for the life of the project, and every heat balance
number in the game was tuned on top of it.** Correcting the lookup made heat
behave as the table has always described, and cost the top of the ladder
fourteen careers.

So `HEAT_ABSORPTION` was re-measured against correct arithmetic for the first
time: `perCrew` 0.17 → 0.2, `max` 5 → 5.75.

    ladder            before fix   after fix   after re-tune
    Capo                   32/36        29/36          29/36
    Underboss              20/36        16/36          27/36
    Boss                   17/36         9/36          23/36
    Crime Lord             10/36         1/36           8/36
    ended early            11/36        17/36          11/36

Recorded as two things, not one, because they are: influence is the change
round 10 tests, and the absorption is a correction restoring a previously
measured shape after a bug fix moved it. Attribution for the blind round is
therefore clean only for F2.

    tsc clean · 586 tests, 41 files, green

**Blind round 10:** Capo on day 122, played on to day 187.

    axis          r9   r10
    First hour     8     8
    Clarity        8     9
    Feedback       7     9
    Depth          7     8
    Pacing         6     6
    Difficulty     8     8
    Writing        9     9
    Interface      7     8
    Fun            7     7

Four up, none down. None of that is attributable to this iteration; it is the
round 9 repairs landing.

**Result: FAILED. F2 did not close.** The tester finished at **Influence 0/20**
and named it directly — blocked by "an attribute I never found a way to train".

Diagnosed rather than guessed. The wiring is correct and fires; the *sizing*
was calibrated against a player who does not exist. `attributeProgressNeeded(0)`
is 3, and counsel pays `0.12 * costMultiplier` a week — 25 weeks of ordinary
counsel, or about 10 of a serious firm, for the first point. The note above this
constant assumed "a boss who keeps ordinary counsel for a year", and no measured
career can. This one bought a serious firm on day 61, was half-killed by it, and
sat pinned at $96 from day 86; when the retainer cannot be paid, `spend` fails
and counsel drops to `none`, which trains nothing. Perhaps eight paid weeks in
187 days. About 2.5 progress against a threshold of 3 — **just short of one
point in an entire career.**

The second source never fired at all, for a reason no amount of tuning would
have found: *"Diplomacy — I saw the panel but never worked out what I could do
there. It only ever showed a strength table and 'Nobody is fighting anybody'."*
The approach that was meant to train influence is not presented as an action.

So F2's root is now properly understood and is two things, neither of them the
rate: counsel is the wrong carrier because it lapses exactly when a player is
poor, and poor is the common state; and the other carrier is invisible in its
own panel.

**§3.6 says revert, and I am not reverting.** Recorded as a departure rather than
done quietly. Reverting restores a state where influence has *no* earnable source
whatsoever, which guarantees F2 forever and is strictly worse than a source that
is too small. The iteration is logged as failed, the finding stays open, and the
sizing is not being nudged upward to rescue it — that would be tuning the
instrument's cousin. §12 covers this: say so in the log and bring it up.

**F2 remains open**, with a real diagnosis attached for a later iteration.

---

---

## Iteration 2 — 2026-08-20

Started while round 10 was still out, so it does not touch anything round 10
measures. Round 11 is held until iteration 1 is decided.

**Diagnosis.** F1's second half, and F5, are the same mechanism: *nothing in the
world pushes back*. Measured over twelve four-year careers, with a bot that
works its stronghold and expands when a rank asks it to:

    pressure actions between the families      526
    pressure actions against the player         65
    weeks a family held "ruin the player"     0 of 2113
    weeks a family held "ruin a rival"          414
    districts a rival could have leaned on    0.84 -> 4.20 per week

Nine actions a career, one every nine months, against a board where the chances
to act quadrupled. Opportunity was never the constraint.

Two gates, found by A/B rather than by reading. Forcing an agenda review every
week took `ruin the player` from 0 to 9 weeks in 2,280 while `ruin a rival` went
414 to 822 — so cadence is real but small, and the player is simply never the
most-hated party on a board where three families brutalise each other. `ruin` is
a mood. **`pressure` is the thing the player actually feels**, and it was gated
on the family being *ahead* of its target in that district — a band the player
passes through once, early, and never re-enters.

Under that sat a smaller and worse one: `if (mine < 20) continue`, checked first.
Being driven out of a district removed the ability to answer for it.

**Hypothesis.** If a family will move on somebody who is taking its streets, and
not only on somebody it is already beating, then F5 will not appear in the next
blind round and F1 will not be reported as "nothing pushed back", because the
late game is where the ledger is fullest.

**Change.**

    src/config/factions.ts   GROUND_LOST { full 25, decayPerWeek 0.5 }
                             AI.pressure.grievingPresence 8
    src/sim/types.ts         Faction.groundLost?, keyed `culprit:territoryId`
    src/sim/faction.ts       noteInfluenceTaken writes the ledger
                             tickFactions fades it weekly
                             scorePressure reads it for the gate, the presence
                             floor, and in place of an advantage it lacks

**Two things tried and dropped, recorded because they are results.**

A relationship penalty for ground lost — the obvious first move — changed no
decision at all (`ruin` against the player stayed at 0 in 2,000 weeks) and took
careers ending early from 4 in 12 to 6. Removed. The config note from further
back had already recorded the same lesson: feelings were never the missing part,
memory was.

Opening the lead gate without scoring the grievance moved pressure against the
player from 71 to 74. They were let through the door and then scored at zero,
because `advantage` is zero the moment the target is stronger.

**Effect of the change that stayed.**

    pressure at the player      65 -> 111        by year: 16/25/19/11 -> 25/30/43/23
    ended early              4/12 -> 5/12
    weeks lived per year   624/587/485/417 -> 624/624/570/467

More pressure and *longer* careers, because the survival cost belonged to the
mood penalty rather than to the aggression. The player's share of what the
families do to each other goes 11% to 16%; parity between four organizations
would be 33%, so this is an improvement rather than a fix, and the blind round
is what decides whether it is enough.

**Verification, and the cost.**

    ladder            iteration 1   iteration 2
    Capo                    29/36         28/36
    Underboss               27/36         21/36
    Boss                    23/36         15/36
    Crime Lord               8/36          8/36
    ended early             11/36         19/36

    scorecard         iteration 1   iteration 2
    First hour                9.2           9.2
    Clarity                    10            10
    Feedback                   10            10
    Depth                     7.8           7.7
    Pacing                    4.4           4.4
    Difficulty                7.7           7.0   (33% -> 42% ended early)

A real cost, recorded rather than explained away. No rung became unreachable and
the spread arguably improved — 36/36/35/28/21/15/8 decays where the old curve
had a cliff between Boss and Crime Lord — and Difficulty stays above the floor
in §10.4. But careers ending early went from a third to a half, and that is the
direction the axis is *not* supposed to move.

**The caveat that stops me tuning it down on this reading.** §5: verify the bot
can perform the counterplay before concluding anything about the game. Neither
bot can. `ladder.probe` and `scorecard.probe` both hold sit-downs with their own
crew and **neither has ever called `doDiplomacy`** — no approach to a family, no
peace, no ally, in any run ever recorded. The change I made creates precisely
the situation whose answer is diplomacy, and both instruments measure its cost
against a player with that entire half of the game switched off. 19 in 36 is an
upper bound on the harm, not an estimate of it.

**And checking that caveat turned up a real gap, which is why §5 says to check
it.** The counterplay has to answer the mechanism, and it did not. `scorePressure`
targets off the ledger; `offer_tribute` bought *relationship*, which the scorer
reads only as a multiplier. A player could pay a family off and watch them keep
taking the same street — a pressure source with no lever, which is a worse game
than one where nobody pushes back at all. The action's own blurb already
promised otherwise: "the cheapest way to make somebody less interested in you".

So a tribute now settles the ledger, priced per dollar at `settledPer10k` 12 and
deliberately less than a district's worth per envelope, so a family aggrieved in
three places cannot be bought off with one. Oldest business first.

    src/config/factions.ts   GROUND_LOST.settledPer10k 12
    src/sim/diplomacy.ts     offer_tribute settles what they hold against you
    src/sim/__tests__/grievance.test.ts   four properties, new file

The ladder and scorecard readings above are unchanged to the digit after adding
it — because neither bot has ever paid a tribute. That is the §5 caveat stated
twice over: the instruments cannot see the pressure this iteration added, and
they cannot see the answer to it either.

One of those four tests earned its place immediately. The fade assertion failed
first time round because it called `tickFactions` twenty times on the same day,
and `tickFactions` returns immediately unless the day divides by seven — so it
had run the weekly work exactly zero times and would have passed happily had I
asserted the opposite direction. Nineteen.

    tsc clean * 590 tests, 42 files, green

Pacing did not move, and was not expected to: it counts firsts — new job kinds,
new districts, rungs — and a rival taking a street is none of those. Neither bot
can see the thing this iteration changed. The blind round is the only instrument
that can.

**New finding, raised and deliberately not acted on.**

**F6 — Pacing 4.4 is a statement about the probe, not about the game.** It is
the lowest axis on the scorecard and the only one under §10.4's floor of 6, so
on the face of it it blocks release by itself. Before treating it that way I
checked what it counts. A "first" is one of three things: a job kind used for
the first time, a district worked for the first time, a rung reached. The
catalogue holds 24 operations gated across all six ranks — 4, 4, 6, 4, 3, 2 —
so content does arrive at every rung. The bot reports 8 kinds because it
launches exactly one job a day and always the highest expected value, which is
one kind per rank-era plus a few switches.

And the three counted channels are a minority of the game's novelty. The first
front bought — day 42 in 35 of 36 careers, 14 a career — is not a first. Nor is
a first contraband trade, a first war, a first investigation reaching a stage, a
first district at Control, a first handover, a first man put on a district.

I am not widening the definition. Widening an instrument raises the number it
produces, and doing that in the same iteration that reports the number would be
the nineteenth case in this project's list. The honest position is that the
scorecard cannot currently speak to pacing, and it should say so rather than
emit a 4.4. Round 9's human gave Pacing 6.

**So the blind round decides it.** If round 11 also reports the loop going flat,
the game is what needs fixing and F1 stands. If round 11 does not, the instrument
is what needs fixing, and it gets repaired under §5 with these readings attached
rather than tuned toward a nicer figure.

**F7 — every instrument in this project plays the same narrow game.** Raised by
the developer watching round 10: the tester was not holding sit-downs, not saving
for a police contact, not using much of what is there. Checking it, the same is
true of the machinery. No career-length probe has ever acquired a contact or
approached a family; only `ladder.probe` has ever held a sit-down; and
`scorecard.probe` — the source of every Depth and Pacing figure in this log —
recruits, launches one job a day and answers events with the cheapest enabled
choice. Four systems out of roughly fifteen.

For the bots that is a property, not a defect: a regression instrument has to
hold its own behaviour still or a change in the reading cannot be attributed. It
becomes a defect only when a number from it is quoted as though it described the
whole game, which is what I have been doing all session.

For the human tester it is not a property, because the tester chose. But under-use
has four possible causes — never knew, could not work it out, understood it and
judged it not worth the cost, or was blocked — and they are different findings
with different repairs. The third is the one that cannot be seen from inside the
project: a system a player understood and correctly ignored does not need a
signpost, it needs its price or its design changed.

Handled by changing what gets asked, not by changing how anyone plays:

    docs/PLAYTEST.md    Part 4 splits non-use four ways and runs before the scores;
                   Part 2 requires a score to name the coverage it rests on, and
                   to be marked unscored where it rests on nothing
    docs/DIRECTOR.md    §4 extends the unscored discipline from rungs to systems, and
                   forbids prompting a tester mid-round; §5 records what each
                   instrument does not touch
    scorecard.probe.test.ts   states its own narrowness in its header

Round 10 was asked for a coverage account at write-up time, naming no feature, so
it cannot steer play. Its scores carry a mild contamination caveat for having
been asked at all; rounds 11 on have it in the brief from the start.

**A tenth axis: Standing in it.** Asked for by the developer — the player should
feel like they are running a family and be willing to do whatever it takes to
keep it running.

Recorded here mainly to fix what it must not become. In most projects that brief
turns into animation, sound and reward flourishes, which §5 already forbids on
measured grounds: round 9's strongest compliment was that the game never winks,
and Writing was the highest of its nine scores. The target is stakes, not
atmosphere, and it decomposes into three things the simulation either does or
does not do — the thing is yours and losing it would diminish you; it has needs
that do not wait and only you can answer; and keeping it running costs you things
you would rather not pay.

The third is load-bearing and the easiest to lose. Measured blind, never by bot:
it joins Fun, Writing and Interface on the list of things an instrument with no
eyes and no stake cannot score, and a number there would be the surest of the
nineteen.

    docs/PLAYTEST.md   Part 2 gains the axis, held apart from Fun and required not to
                  track it; Part 3 gains three questions it summarises — name
                  somebody without looking, name something you did that you did
                  not want to do, and say what you would have lost
    docs/DIRECTOR.md   §1 states the target and the prohibition

**This breaks comparability.** Rounds 1 to 10 have nine axes and round 11 has
ten. The nine stay comparable; Standing in it has no history and its first
reading is a baseline, not a movement. Round 10 was already running when the axis
was written, so it will not report one.

**H1, a hypothesis and not yet a finding.** `scorecard.probe` answers every event
with the cheapest enabled choice and still reaches Boss in 15 of 36 careers. If
consistently cheap play is that viable, the game may rarely make anybody pay for
anything they mind paying for — which is precisely the third component above.
Costs live in the resolvers rather than in the choice shape, so this cannot be
settled statically, and it is not worth building an instrument for before round
11 says whether a person felt it. Recorded so it is not re-derived.

**F8 — being convicted is the cheapest way to manage heat.** Raised by the
developer watching round 10 park at 100 heat, spam jobs, and never lay low or
care who was informing. The tester is not misplaying. It is playing correctly.

Measured over twelve careers with a bot that never lays low and launches
everything it can crew:

    mean heat 95.3; 85% of weeks at heat >= 90; 96% at >= 70
    91% of weeks with a case at arrests or beyond
    Bureau reached trial in 6 of 12 careers: 10 trials, 9 convictions
    careers ended early: 4

The law is not asleep — it fires, repeatedly, and it wins. The sanction is then
absorbed. `applyHandover` in sim/succession.ts:

    state.org.heat = heat * HANDOVER.heatKept          0.5
    investigation.strength *= HANDOVER.caseStrengthKept 0.4, and status -> cold
    cash * 0.9, dirtyCash * 0.75, influence * 0.9, respect * 0.45

A convicted boss hands over an organization at half the heat, with 60% of every
case erased and all files cold, keeping nine tenths of the money, the districts
and — per `ladder.probe` — the rank in 99 of 114 handovers. For a player already
at 100 with a maxed file, conviction is a **reset for a 10% fee**.

Both multipliers are there for a good reason and neither is sloppy: a successor
must not inherit a finished case and be convicted on day one for work they did
not do. The defect is in the net, not the parts. The relief is granted *for being
caught*, so the dominant strategy is to ignore heat entirely and let the state
clean up after you.

This is the mechanical floor under three separate things already open: F1 (nothing
in the world pushes back hard enough to change what you do), the whole heat
counterplay layer — lay low, counsel, contacts, informants — being priced against
a sanction that is not one, and component 1 of **Standing in it**, since a loss
you profit from is not a loss.

**Proposed, not implemented.** Separate the two reasons a handover happens. The
relief protects a successor who inherits by death or retirement; it should not be
paid out to a predecessor who was taken. Roughly: `heatKept` and
`caseStrengthKept` apply on a natural handover, and a conviction hands over the
heat and the file intact, the agencies having got their man and kept their work.

Held rather than done. Iteration 2 is already out for measurement and stacking a
third unmeasured change would make round 11 uninterpretable — and this one
changes what losing means, which is the developer's call rather than mine.

**Nineteen.** The first version of the probe behind this read `state.investigations`,
which does not exist; the field is `state.law.investigations`. `?? {}` turned the
miss into an empty object and it reported, with total composure, that no agency
had ever opened a case in 2,183 weeks at mean heat 95. Caught because zero of
everything was implausible, not because anything complained.

**F9 — being feared quietly strangles the crew, and no instrument had ever
noticed.** Developer hypothesis while watching round 10 sit at 100 fear: that
this is why the crew never grows enough to operate. Correct, with two
corrections.

First, the loyalty breakdown in `ladder.probe` was incomplete. Its four terms
mirror `driftNpcs` exactly — which is the error, because they are the four
things that move loyalty *in that function*, not the four things that move
loyalty. `tickFear` in player.ts charges every man `FEAR.loyaltyPerWeekAtMax`
every payday and lives in a different file. The readout that exists to explain
why crews leave was silent about it. Now counted, and the readout names heat and
fear separately with a total.

Second, the two are coupled, so the developer's "fear" and my "heat" are one
mechanism: `tickFear` also does `npc.stats.fear += level * 0.6`, and
`npc.stats.fear` is the multiplier on the heat term. Being feared raises the
price of being watched.

Measured, per crew-week over 84,469 of them:

    underpaid -0.20, grievance -0.52, heat -0.93, being feared -0.02,
    stagnation -0.68 — total -2.36

**Derived, not measured, for the state actually being observed** — heat 100 and
fear 100, from constants read directly:

    heat, at npcFear 100   -3.5 * (100-60)/55 * 1.00   = -2.54
    being feared, level 1  FEAR.loyaltyPerWeekAtMax    = -1.10
    plus grievance, stagnation, underpaid              = -1.40
                                                  total  -5.04

Against a 0-100 loyalty scale, per man, every week, for the whole career. The
ladder bot pays -2.36 and already loses 104 of its 109 hires, finishing with a
median crew of 2 against a Capo requirement of 10.

The `-0.02` is itself the finding within the finding: the bot barely uses
violence, so it never accrues fear, so **the entire fear system has never been
exercised by any instrument in this project.** F7 again, in a system nobody
checked.

Root is shared with F8. Neither number has any reason to come down — conviction
resets heat for a 10% fee, and fear decays at 1.4 a week against every violent
act pushing it back up — so both sit near maximum for the whole run and the crew
is drained by two near-ceiling terms simultaneously. Fixing F8 makes heat worth
managing; whether fear then needs its own answer is a question for after that,
not before.

Not implemented. Iteration 3 is F8, agreed with the developer, and F9 is
downstream of it.

**Blind round 11:** first attempt lost — the session hosting the tester and its
playtest server was restarted before the tester wrote anything, so there is no
partial run to recover. Re-dispatched against a fresh instance, still measuring
iterations 2 and 3 together.

## Round 10 — what else it found

**Fixed immediately.** MUST FIX #1, "buying a front spends Put away money which
the game says cannot be spent", reproduced twice with steps. Checked: the
behaviour is deliberate and correct — front income is paid *into* holdings, and
`acquireBusiness` draws on them so a reinvestment does not pay the 15%
`takeBack` price. **The sentence was wrong, not the transaction.** The Finances
copy said "nothing you do can spend it — not a job, not a wage, not a lawyer",
which is literally true and reads as absolute; the tester built a false model of
their own balance sheet from it and bought a front on it twice. Copy now names
the exception and says why.

**F5 confirmed a third time, and dated.** "All three families chose `consolidate`
almost every week with EXPAND 0.00 / PRESSURE 0.00, including Sokolov, whose
agenda is literally TAKE A DISTRICT. 0 WARS IN THE CITY for 187 days." Round 10
ran against the pre-iteration-2 build, so this is the *before* reading for the
grievance change. Round 11 is its test.

**F8 confirmed from the other side, by measurement I did not have.** "Laying low
drops it fast" is false where it matters: heat 57 to 19 in 10 days (-3.8/day),
but 100 to 91 across a full 14-day lay low (-0.6/day) at a cost of $5,636 and 4
respect. The advertised escape hatch is six times slower exactly when you are
desperate enough to pay for it — so conviction is not merely the cheapest heat
cure, it is close to the only working one.

**F1, dated precisely.** Decisions stopped changing around day 90, hard-locked by
107, last genuinely new decision day 61. The stated cause is new and better than
anything the probes produced: *"every system that could have offered me something
— the product trade ($40,000 retainer), an inside contact ($30,102), city hall
(Influence 9), the six-figure jobs — is priced in a currency I no longer had, and
the only unpriced actions were the small jobs I was already doing."* The late
game is gated on money, and the late game is where money stops.

**New, and not yet placed:**

- Sit-downs return byte-identical prose for different people across four runs.
  Filed MUST FIX because the sit-down is the only counterweight to the evidence
  table, the game's best system — once you know it reads from one card, the
  tension drains backwards out of the thing it was protecting.
- An indictment named "in front of a jury in 25 days" and was still sitting at
  Indictment 33 days later. Seen once, so not reproduced.
- Unaffordable memo options enabled inconsistently: a $6,000 option clicked with
  $3,842 held dismissed the modal, moved no money, and wrote no line.
- "Nobody in Little Sicily will sell to you right now" blocked every front there
  for ~100 days without naming its cause or its remedy, while every other refusal
  in the game names both.
- A memo advertised a front as "Below market" at $12,853 against a listed
  $10,573.

**COVERAGE, the first round to report it.** Confirms the developer's observation
with reasons, and the split matters: the trades, inside contacts and city hall
were all **"wanted to, was blocked"** — by money or by Influence 5/7/11 — not
"never knew". Two sit-down topics and the manual saves were "saw it, no reason
to". Diplomacy-as-an-action was "couldn't work out what I could do there". The
tester flagged Depth and Pacing as resting partly on content never reached and
declined to adjust them, which is exactly the discipline the brief now asks for.

---

## Round 10 repairs — 2026-08-20

Developer observation: "businesses really aren't making a lot of money."

**Measured first, and the diagnosis inverted.** Fronts realise 74-79% of their
catalogue revenue with health at 86 of 100 — the per-front economics are working
as designed, and `LEGITIMATE_REVENUE_SCALE` is deliberate: the note on it records
a balance pass where raising it made this "a business simulator with a crime
setting". Crime is the engine.

What was actually wrong is which fronts get bought. Same build, same seeds, the
only change being *best affordable* instead of *first affordable*:

    realised income per front   $418/week -> $1,373/week
    kinds ever bought           laundromat only -> trucking, hotel,
                                construction, social club, restaurant, auto shop

**Businesses are not underpowered. The good ones are never bought.** A laundromat
pays $418 a week against a wage bill of $4,966; a hotel pays $4,410. And the
first probe run reported 87 fronts bought across twelve careers, every one of
them a laundromat, because it took the first acquirable from a cheapest-first
list — it measured the entry tier and called it the system.

Round 10 shows why a player stays on the bottom rung: the tester experienced the
compounding ladder **as a bug**. Front income pays into holdings, holdings buy
the next front up without the 15% withdrawal price — and with $28 clean and
$21,998 put away, they read an enabled Buy button on a $21,741 restaurant,
concluded it was broken, and filed it as MUST FIX #1.

    FinancesPanel.tsx   the put-away copy names the exception and says why
    BusinessesPanel.tsx "N within reach — $X to spend", counting holdings
    business.ts         revenueIfBought(), so the buy table quotes what a front
                        will actually earn here rather than the catalogue figure

That last one is the savings-yield defect again in a different panel: every row
overstated its own income by about a quarter, and the buy table *is* the ladder,
so a player choosing which rung to save for was comparing two inflated numbers
that were inflated unequally.

**Priced memo choices.** Round 10 clicked a $6,000 option holding $3,842 and got
a dismissed modal, no money moved and no line written. `arrest_pressure` was the
only memo not using `payable` — the exact thirteenth-choice drift its comment
predicted. Fixed, and a pre-committed test added.

**Number twenty, caught by putting the bug back.** That test passed with the
defect present. Its bot advanced the clock and answered memos but never ran a
job, so it generated no heat, had no case opened, had nobody leaned on, and
`arrest_pressure` — the one event it was written for — never fired. Eleven event
kinds reached. Made it play: 24 kinds, and it failed on the real defect. **A test
that has never been watched to fail is not evidence.**

That then found three more, of a different kind: `disabledReason` is decided when
a memo is built, and memos queue while payroll drains underneath them — six
enabled-but-unaffordable choices, several inside a hundred dollars. `EventChoice`
now carries `cost`, and `MemoModal` re-checks it at the moment the player is
looking at the button.

**A memo that lied about its own price.** "Below market" at $12,853 against a
listed $10,573 — 21% above, saying the opposite. Priced off `acquisitionCost`
now, so it is true by construction.

**And `broke.probe` caught the first attempt at that.** A 12-28% discount narrowed
the gap between the prudent bot and the greedy one from 1.5x to 1.4x — a genuine
bargain tempts a careful player into spending too. Isolated by reverting only
that change and watching it pass again. The threshold was **not** touched; the
discount was set to a few per cent on its own merits, which is what "below
market" means anyway. Recorded because the temptation to move the number was the
obvious move and the standing rule forbids it.

    tsc clean * 591 tests, 43 files, green

---

## Iteration 3 — 2026-08-20 — F8, the conviction discount

Taken before round 11 at the developer's instruction, accepting that round 11
now measures iterations 2 and 3 together. Recorded so the attribution is not
reconstructed later as cleaner than it was.

**Change, and it is smaller than the diagnosis suggested.** Re-reading the case
relief changed the scope. `caseStrengthKept` is defensible even after a
conviction: the convicted file closes in `resolveTrial` regardless, and the
*other* open cases genuinely did lose the man they were built around. That is
what the number is about, and it stays.

The heat halving is the indefensible half. `heatKept` is the right rule for a
chair that empties on its own and exactly backwards when the agencies are the
reason it emptied — the city just watched it happen.

    src/config/succession.ts    heatKeptWhenConvicted: 1
    src/sim/succession.ts       applyHandoverCosts takes the removal kind
    src/sim/__tests__/succession.test.ts   a conviction keeps its heat, a
                                deposition sheds it

**One pre-committed assertion changed, and it was not weakened.** The test
"hands the successor a smaller organization but not a dead one" asserted
`heat < 80` on a `convicted` removal, and had passed for the life of the
project. Heat was incidental to it — its subject is the successor inheriting
less, which respect, cash, influence and rank still carry. The line now reads
`toBe(80)` with the reason and the measurements attached in place, so a later
reader does not mistake it for a threshold moved to get green.

**Verification.**

    tsc clean * 592 tests, 43 files, green

    ladder              iter 2   iter 3
    Capo                 28/36    28/36
    Underboss            21/36    19/36
    Boss                 15/36    14/36
    Crime Lord            8/36     5/36
    ended early          19/36    18/36
    median career length  1386     1461 days

    scorecard           iter 2   iter 3
    Depth                  7.7      7.7
    Difficulty             7.0      6.8
    Pacing                 4.4      3.6

The top of the ladder compresses — Crime Lord 8 to 5 — which is the expected
price of heat that no longer resets. Everything else is close to flat, and
Difficulty stays above §10.4's floor.

**Pacing 4.4 to 3.6 is not a regression and must not be read as one.** The
firsts count did not move: 14 either way. The *longest quiet stretch* went from
373 days to 438 because the median career now runs the full 1,461 days instead
of 1,386. Same amount of new happening, spread across more days lived, so the
metric marks it down. F6 said this axis measures the probe rather than the game;
this is the clearest demonstration yet — **it penalises survival.**

**§5 caveat, unchanged and now doubly binding.** Neither bot can lay low, buy a
contact, retain counsel deliberately, or approach a family. Both iterations 2
and 3 add pressure whose entire answer is counterplay neither instrument can
perform, so both ladders overstate the harm. What they are good for is
confirming nothing collapsed, and nothing did.

**Blind round 11:** Capo on day 119, played to **day 303** — the first round
ever to see the late game.

    axis           r9   r10   r11
    First hour      8     8     8
    Clarity         8     9     6
    Feedback        7     9     7
    Depth           7     8     6
    Pacing          6     6     4
    Difficulty      8     8     6
    Writing         9     9     8
    Interface       7     8     6
    Fun             7     7     6
    Standing in it  -     -     5   (new axis, no history)

**Do not read that as a regression, and do not read it as noise either.** Round
10 stopped at day 187; round 11 ran to 303. §2 says two testers landing in
different halves move the scores further than most changes do, and this is that,
in the direction the game has always been weakest. Round 11's own words: days
1-119 "genuinely tense", days 119-303 "a solved economy that then quietly fell
over twice". The lower numbers are the late game being scored for the first
time, not the last two iterations breaking something.

**Result: FAILED. F5 did not close.** "In 303 days nobody in the city fought
anybody. All three families stayed Neutral toward me and two of them stayed
'A NAME ONLY' the entire run despite my taking Southport off Kestler." No rival
pressure action was reported at all.

**Why it failed, and it is the same reason iteration 1 failed.** The grievance
ledger moved pressure against the player from 65 to 111 across twelve careers of
1,460 days. That is about nine actions per four-year career — roughly **1.8
actions in a 303-day run**, against a player holding three districts. The change
is real, it is measurable, and it is invisible at the timescale a person plays.

Iteration 1 was the same shape: influence accrued correctly, at a rate that
needed a year of unbroken counsel to produce one point, and the tester finished
at 2/20.

**So the finding is about me, not the game.** Two consecutive iterations sized a
change against a 1,460-day bot statistic and shipped something a human cannot
see in 300 days. §10 names two consecutive reverts as the signal to stop and
come back to the developer, and this is that signal arriving for a reason worth
naming: **the instruments measure four-year careers and every blind round is a
one-year one.** Any future change has to be sized against what happens in the
first 300 days, or it is being tuned for an observer that does not exist.

Iteration 2 is NOT reverted, on the same reasoning recorded for iteration 1:
reverting restores a world where a family will only ever lean on somebody it is
already beating, which is strictly worse than one where it does so rarely. Both
are logged as failures and both findings stay open.

**Iteration 3 is untested.** This tester was never convicted, so the conviction
rule never fired. Their heat behaviour was far better than round 10's — three
lay-lows, heat held around 58 — but the likely cause is the new "play to keep
the thing alive" stance in the brief, not F8. Recorded as unmeasured rather than
passed.

---

## Round 11 repairs — 2026-08-21

**MUST FIX 1, fixed. The odds row named one thing and reported two.** Four
readings against the top bar, 155 days apart: heat 27 charged 8 points, heat 11
charged 13. The arithmetic was never wrong — `successBreakdown` has always
summed honestly — but `heat` folded in `surveillancePenalty`, and the row was
labelled "Current heat".

The comment defending that said being watched was "a line they cannot act on
separately". It is the opposite: heat bleeds off when you stop and a case does
not, so they are the two costs with the most different cures in the game. The
tester bought two fourteen-day lay-lows, about **$10,500 and 28 idle days**, to
move a number that was only partly the number they were moving.

    src/sim/operations.ts   ChanceBreakdown gains `watched`; the two terms split
    OperationsPanel.tsx     a "Being watched" row, shown only when it is not 0
    src/sim/__tests__/oddsHonesty.test.ts   three properties

Written test-first under the new standing instruction, and the third test earned
it immediately: the first version set two heat levels and nothing else, and
**passed before the fix** — day one has no investigations, so surveillance was
zero on both sides and the defect was unreachable. Rewritten to open a case on
the low-heat side, which is the shape that made the row read backwards.

    tsc clean * 595 tests, 44 files, green

**MUST FIX 2, fixed. The trade panel blamed the player for the wrong thing.**
Day 250, cash $719 against a $2,263 load: "What is stopping you" reported 12
streets, 99 carriers, "You have more people than ground. Take more of the city."
Day 253, after selling the put-away, identical streets and identical carriers
moved 8 loads for $50,399. The variable was money and money was not on the
panel. The figure had been computed inside `tickContraband` every week to decide
what to buy, and thrown away. `TradeRead.affordable` now carries it, the panel
shows it as a third bar, and the diagnosis names money when money is the short
end.

**MUST FIX 3, fixed. Memos offering what the game refuses to sell.** `applies`
took the first district at foothold or better and never asked whether it had a
slot free, so the offer fired into a full district with its buy button disabled
and its own subtitle reading "No room". Round 11 saw it twice, 134 days apart,
the second time holding $146,000. The test found **sixteen** across six careers.

**MUST FIX 4, fixed. One label, two numbers.** The advancement table measures
the best the family has ever managed — a rung once earned stays earned — and the
rest of the game shows today. So "Crew 13 / 16" sat beside "Crew 8 of 22" and
"$92,017" beside "In all $80,917". `RankRequirement` now carries `now` beside
`current`, and the row appends "(now 8)" when they differ.

**Grammar, and it was ten lines rather than one.** Round 11 reported "They **has**
been the one you send". `CrewPanel` prefixes every memory with "They " or "Years
ago they ", and ten of the fourteen memory texts disagreed with it — eight of
them opening "was", so "They was arrested on a job you sent them on". The crew
detail panel is the one screen that makes a person out of a row.

Also fixed: `a ${ROLE_LABEL[...]}` at six sites, where three of the seven roles
begin with a vowel, so half the ladder rendered "as a Associate". A `withArticle`
helper now picks it. And `"you have $19,215.862"` — `funds` returns a float and
only one side of that sentence had ever been formatted.

**Two pre-committed tests are failing and I have not touched either.**

    balance.test.ts   "does not let anyone coast to the top in two years"
                      — one career reaches Boss, expected strictly below Boss
    grok.probe.test.ts guard: every career must run 20 weeks — one runs fewer

Isolated: both pass with the slot gate removed and fail with it in. The gate
takes `business_offer` out of the weighted pool when no district has room, which
changes which event fires and cascades through every later `rng` call — the
established behaviour of this project's determinism.

Both failures sit exactly on their boundary and they point in **opposite**
directions: one career climbing faster, one career dying sooner. That is the
signature of a reshuffle rather than a regression. Brought to the developer
rather than decided alone, because §5's repair clause had already been declined
once this session and reaching for it twice unprompted is how an instrument gets
tuned. Developer called it: restate both, with the evidence attached.

**Restated, and the shape of the repair is the same in both.** Each assertion
was written per-career over a seeded sample, which gives it no tolerance for a
reshuffle at all — it was measuring which seeds were lucky. Each is now stated
over the population, where it is what the name of the test already claimed.

    balance.test.ts   was: rank < boss, for every one of 48 careers
                      now: median rank < boss - 1, and nothing reaches Crime Lord

                      measured after the gate, across the 48:
                        rank 0 x3   1 x11   2 x22   3 x5   4 x8   5 x1   6 x0
                      one career in forty-eight reaching Boss is the top of a
                      spread, not a coast

    grok.probe.test.ts  was: every one of 8 careers runs >= 20 weeks
                        now: >= 75% clear 20 weeks, and the median clears 60

                        weeks lived: 120, 17, 120, 120, 67, 38, 120, 70
                        median 95 of a possible 120

Both restatements are strictly harder to satisfy by accident than the forms they
replace: a genuinely short ladder moves a median, and a bot that fell over in
week three fails both new conditions by a mile. Neither threshold was chosen to
make today's number pass — both are derived from the printed distribution, which
is recorded here and in the tests.

    tsc clean * 605 tests, 49 files, green

**All twelve remaining round 11 items, done in order.**

**1. Twenty of twenty-five tips never fired.** `nextTip` skips on `seenKey`,
which only the "got it" button writes; `markShown` writes a different key. So a
tip whose condition stays true, on a player who never presses the button, holds
the head of the queue forever and every later non-urgent tip is unreachable.
Round 11: "5 OF 25 SAID", all five inside 42 days, the same THE LAW tip pinned
for 258. `tips.reach.test.ts` was right that eighteen predicates come true —
they were coming true behind a tip nobody dismissed. `TIP_LINGER_DAYS` now
releases the slot after twelve days.

**2. Attributes did not improve by use, which the Yourself panel claims.** Every
`trainAttribute` call in the game was inside `events.ts`. Round 11 finished at
Business 1/20 after operating five fronts for 265 days, while Business buys down
the laundering cut it had been paying all career. Business now trains from
laundering, scaled by how much of the capacity actually moved — a token front in
a dead district teaches nothing. **Sized for 38 weeks rather than for four
years**, which is the correction iterations 1 and 2 both needed: it reaches
Business 4, not Business 1.

**3. Counsel quoted at one price, billed at another.** The picker showed
"×2.6 retainer" and one total for whichever tier was already retained. The bill
scales with how many agencies are working — correct, disclosed nowhere. Each
tier is now quoted against today's board.

**4. An indictment promised a jury it could not deliver.** One memo body served
every agency and all of them said "in front of a jury in 25 days". Only the
Bureau has `maxStage: 'trial'`. The Task Force stops at indictment, so round
11's case could never reach a courtroom — while the Overview read "TASK FORCE
CAN TAKE IT AS FAR AS INDICTMENT" the whole time. The clock was wrong even for
the Bureau: `daysToVerdict` runs from the day a case reaches trial, a stage
above indictment.

**5. Put away grew on its own and was never logged.** The takings were logged;
where they went was not. Round 11 reached $57,452 having never pressed the
button and sold the lot at the hurry price to survive a payroll.

**6. "Nothing moves" was false.** Work already out finishes and is noticed
finishing — the right mechanic, the opposite of the sentence.

**7. A strategy-defining fact lived in a hover.** That at Major Investigation
heat bleeds at a fraction of the usual rate and going quiet will not clear it,
reachable only by hovering the button you were about to press. Now on the
confirmation line, which is the last screen before the money goes.

**8. Every crew note was written twice**, by `resolveOperation` and
`creditOperation`, doubling the one screen that makes a person out of a row.

**9. The recruit list rotated silently.** It replaces itself wholesale and said
nothing; round 11 came back for two named men on day 14 and found four
strangers.

**10. Succession called an arrested heir gone.** `heirOf` returns null for a man
merely ineligible today, which includes one in custody with a release date. The
panel said "not here any more" while the Organization page showed him HELD 33D.

**11. Calling off a job costs heat and did not say so.**

**12. "YOU CAN COVER THE CHEAPEST" across a page where every Buy was disabled.**
The money was true and it was not the point; the blocker leads now.

Every one written test-first. Two of those tests earned it immediately: the
lay-low test asserted a phrase that did not exist yet, and the Business test
asserted a starting attribute of 0 when the game starts it at 1 — my assumption
about the game rather than the game, corrected to assert the mechanism.

    tsc clean * 616 tests, 54 files, green

**Nothing from round 11 remains open.** F2 stays open as a finding — Influence
still has no rate that reaches a player inside 300 days — and F1, F5, F6, F7 and
F9 stay open with it.

---

## Developer decision — 2026-08-21

§5's open question — whether changes should be sized against the ~300-day
career a blind tester actually plays, rather than the 1,460-day bot career
every instrument measures — was put to the developer and answered:

**Adopt the 300-day rule.** Any future balance change must be sized to move
something inside a ~300-day career, or it is being tuned for an observer that
does not exist. Iteration 4 (`BUSINESS_FROM.launderingPerWeek`, sized for 38
weeks) is confirmed as the pattern to follow.

This unblocks **blind round 12** (docs/HANDOFF.md §7), which measures iteration 2
(rival pressure / grievance ledger), iteration 3 (F8, the conviction heat
discount — still untested, no round has yet seen a conviction), and the round
11 repairs (16 items, all done) together.

Not dispatched this session — no browser tooling available. The next session
with browser access should run it directly per docs/DIRECTOR.md §4 / docs/PLAYTEST.md,
without re-litigating this decision.

---
## Blind round 12 — 2026-08-21

Instance `round12`, storage `mafia:run-round12:*`. Pre-flight: tsc clean, 616
tests, 54 files, green. Dispatched to a fresh agent with the tester half of
docs/PLAYTEST.md only.

**The tester played two careers and labelled them.** Run 1 blind, wiped out day
119 — "Nobody left and nothing to pay anyone with". Run 2, informed by run 1,
reached Capo on day 324. Everything about learning the game comes from run 1;
Part 1's second table and most of Part 4 come from run 2. Not what §4 asked for,
declared plainly, and it is the reason the round covers the late game at all.

**The round never saw the game.** Every `computer{action:"screenshot"}` returned
*the Browser pane is not displayed, so the page is not compositing frames*, from
the title screen to day 324.

**Corrected after the fact:** this was first written down as "a backgrounded
subagent has no fronted pane". That is wrong. A backgrounded subagent was later
pointed at the same live instance with the pane open and returned a normal
800x704 image. The variable is whether the pane is open at all, not how the agent
was dispatched. The
tester read the whole run through the DOM and correctly refused to score how
anything looks. **Interface's visual half is unscored for round 12, and this is a
harness defect, not a result.** Any future round must be dispatched so the pane
is displayed, or screenshots checked in the first five minutes rather than
discovered at the end.

### Scores

    axis           r9   r10   r11   r12
    First hour      8     8     8     8
    Clarity         8     9     6     6
    Feedback        7     9     7     8
    Depth           7     8     6     8
    Pacing          6     6     4     5
    Difficulty      8     8     6     6
    Writing         9     9     8     9
    Interface       7     8     6     7*   (*structure only, see above)
    Standing in it  -     -     5     6
    Fun             7     7     6     6

Feedback, Depth and Writing recovered. Clarity did not move, and the reason is
one finding rather than a mood. Fun and Standing were answered per-run and the
split is the most useful thing in the report: run 1 was "gripping and not
enjoyable", run 2 "enjoyable and not gripping".

### Verified against the code before recording

- **The front gate is real, and it is a round-7 repair that did not hold.**
  `business.ts:291` refuses on `t.sentiment < SENTIMENT_HOSTILE_BELOW` (30,
  `territories.ts:425`) with *"Nobody in X will sell to you right now."* — naming
  neither the stat nor the number, while the three sibling refusals in the same
  function each state their exact requirement. The explanation exists, on the
  Territory panel (`TerritoryPanel.tsx:498-510`), where a comment records round 7
  watching a tester refused every business for ninety days without learning why.
  **The repair was applied to the screen holding the number, not the screen
  making the refusal, and round 12 hit the identical wall for 170 days.** The
  tester bracketed the threshold at 29-32 empirically. Reproduced five times.
- **`Covered? Yes` can be shown on a week payroll misses.** `clock.ts:65` runs
  `tickLoans` — which spends — before `clock.ts:68` `tickEconomy`. But
  `payrollForecast` (`economy.ts:224`) computes `due = wages + legal + arrears`
  with no repayment term, under a doc comment claiming it "deliberately mirrors
  `tickEconomy` rather than approximating it". It does not. **Instance 22 of the
  recurring failure mode, and the first one in shipped UI rather than a probe.**
- **Typo confirmed.** `delegation.ts:101` — "It is their to answer for."
- **"Vasari" confirmed.** `contraband.ts:174` hard-codes a family name into
  waterfront supply copy. The roster in `factions.ts` holds more families than a
  career instantiates, so the string names a family many careers do not contain.
- **Rival heat is not settled by inspection.** The tester read heat 0 / strength
  100 for every rival in the Why panel. The mechanism exists — `faction.ts:501`
  and `:538` add heat, `:808` decays it — so either decay dominates accrual in
  practice or the panel reads a different field. **Needs a probe. Do not record
  it as fact either way.**

### Findings

**F2 confirmed a third time, and now with the faucet named.** Influence sat at 0
for 324 days. `economy.ts` accrues it from a paid counsel retainer — and the
tester cancelled counsel on day 84 when the tier rescaled to $1,060/wk, which is
the correct play and closes the only faucet. The rate was never the whole
problem; the faucet is behind a cost a struggling player must drop.

**F10 — new, and it outranks everything else. The front is the game's only tap
between the dirty economy and the clean one, and it is gated by an unnamed
number.** Clean cash sat at exactly $2,500 — the starting amount — for 200
consecutive days of run 2. Everything priced in clean money is invisible until
the first front. This is F1 and the Pacing score's actual cause: the loop did not
close, it never opened.

**F11 — new. The death screen has no post-mortem.** 495 bytes and one button. No
rank, no net worth, no roster, no week it turned.

**F8 still untested.** Neither run was convicted. Two rounds running.

**F5 unresolved rather than confirmed** — see the rival-heat note above. A rival
did take a district from the player in run 2, which is more than round 11 saw.

**F7 confirmed from the outside for the first time.** The tester understood
police contacts, priced them against a front, and correctly declined five times.
That is Part 4's third category — understood it, judged it not worth the cost —
and it is a design finding about the price, not a discoverability one.

Result: **no iteration run. This round is a measurement, and its findings are
the next iteration's input.** Round 11's repairs held — Clarity aside, every axis
they touched moved up or stayed.

---

## Iteration 5 — 2026-08-21

Findings open at the start:   F10, F1, F2, F11, F6, F7, F9; F5 unresolved; F8 unmeasured
Diagnosis:                    F10. The first front is the only tap between the
                              dirty economy and the clean one, and the refusal
                              that blocks it names neither the stat, the number,
                              nor the remedy — while its three siblings in the
                              same function each name theirs.
Hypothesis:                   If the refusal at `business.ts:291` names the
                              figure, the bar and the way back, then F10 will
                              not appear in the next blind round, because the
                              remedy is already free — `SENTIMENT_RECOVERY_PER_WEEK`
                              runs whether or not anybody knows it is running —
                              so the player was one piece of information short of
                              a fix they already had.

**This finding is three rounds old, and the entry above claiming "nothing from
round 11 remains open" was wrong.**

    round 7   refused every business in Little Sicily for ~90 days, never learned why
              repair: label + tooltip on the Territory panel  (TerritoryPanel.tsx:498)
    round 11  "blocked every front there for ~100 days without naming its cause or
              its remedy, while every other refusal in the game names both"
              repair #12: the Businesses banner leads with the blocker instead of
              the affordability line  (BusinessesPanel.tsx:310)
    round 12  clean cash at exactly $2,500 — the starting amount — for 200 days

Three repairs, three different screens, and **none of them touched the string**.
Round 11's banner change is the sharpest illustration: it correctly promoted the
blocker to the top of the page, and the blocker it promoted said nothing. The
header round 12 actually read was *"Nobody in Little Sicily will sell to you
right now. You can cover the price."*

**The lesson is not about this string.** A refusal is produced in one place and
read in several. Every repair so far was made where the player was standing when
they got confused, rather than where the sentence was written, so each one moved
the confusion one screen sideways. `canAcquire().reason` has six readers —
the panel header, the per-row tooltip, the offer memo's disabled option, the
fell-through log line, and two probes.

Change:
    src/sim/business.ts        the sentiment refusal names the figure, the bar
                               and the remedy; comment records why
    territory.test.ts          two tests, written first

Now: *"Public feeling in Little Sicily is 25; nobody there sells below 30.
Leaving the district alone brings it back."*

Verification:
    test first     both tests written before the change; the naming test failed
                   with `expected 'Nobody in Little Sicily will sell to …' to
                   contain '25'`, which is the defect stated as an assertion
    tsc            clean
    suite          618 tests, 54 files, green  (616 + the two new)
    scorecard      unchanged, and expected to be — this is a string, and the bot
                   does not read. First hour 9.2 · Clarity 10 · Feedback 10 ·
                   Depth 7.6 · Pacing 3.2 · Difficulty 6.4, 3 ranks reached.
                   **Quoted to show nothing moved, not as evidence of anything.**

Blind round 13:               NOT YET RUN
Result:                       PENDING — F10 closes or it does not, and only a
                              round that has never heard of it can say

New findings:                 none from this iteration

**Deliberately not fixed, and left open on purpose.** The `OPPORTUNITY` memo
still fires offering a front the gate refuses (`events.ts:1483`); it now explains
itself, because it reads this same string, but whether it should fire at all is a
design question and not this hypothesis. Fixing it here would make a failed round
13 impossible to attribute.

### Iteration 5, second half — the string was not the whole fix

The sim change above was correct and insufficient, and looking at it in a browser
is the only reason that is known. Measured in the live page at the real width:

    "Available to buy" panel header      761px
    single-line budget before the title
      starts being squeezed              592px
    the new reason + the header's
      existing "You can cover the price"  980px
    tightest sentence carrying all
      three facts                        704px

**No sentence naming a figure, a bar and a remedy fits in that header.** With the
full string in it the header grew 35px → 51px and broke "AVAILABLE TO BUY" across
two lines while every other panel header on the page stayed on one. Screenshotted
before and after; that is what the rule about screenshotting is for.

**Then the actual root cause, which three rounds of repairs had walked past.**
When `options.length > 0` and every row is refused — round 12's exact state — the
reason is rendered in precisely one place: the `title` attribute of a disabled
button. Round 7 added a tooltip on another panel. Round 11 promoted the blocker
into a header that cannot hold it. **At no point has the refusal ever been plain
visible text on the screen the player is looking at**, and a tooltip is something
you find by already suspecting it is there.

Change:
    BusinessesPanel.tsx   header action drops the interpolated reason for a
                          short fixed string; the reason moves into the panel
                          body above the table, shown when nothing is buyable

Verified in the browser against round 12's own Capo save:

    normal path (5 buyable)   header 35px, title 129px, new line absent — no regression
    blocked path              header 35px, title 129px, reason 733px on one line,
                              red, sentence case, above the table, no hover needed

    tsc        clean
    suite      618 tests, 54 files, green

**The generalisable finding, and it is worth more than this fix.** Every repair
to this finding was made where the player was standing when they got confused,
rather than where the sentence was produced or where they would actually read it.
Three rounds, three screens, and the information stayed one hover away the whole
time. Before repairing any "the game never told me X", establish where X is
currently rendered and whether a player who is not hunting for it would ever see
it.

Result: still PENDING. Round 13 decides.

---

## Blind round 13 — 2026-08-21

Instance `round13`, storage `mafia:run-round13:*`. Round 12's server was stopped
first, so a stray tab could not reach its Capo save. Pane opened and a screenshot
confirmed compositing **before** dispatch, and the brief told the tester to
screenshot once up front and stop if it failed.

**It worked.** *"Screenshots worked from the first call and throughout; every
visual judgement below rests on an image I actually saw."* Interface is fully
scored for the first time since round 11.

One career, day 1 → 300, Underboss, 22 crew, $332,471 net worth. No death.

### Scores

    axis           r10   r11   r12   r13
    First hour       8     8     8     8
    Clarity          9     6     6     9
    Feedback         9     7     8     8
    Depth            8     6     8     8
    Pacing           6     4     5     5
    Difficulty       8     6     6     7
    Writing          9     8     9     9
    Interface        8     6     7*    7
    Standing in it   -     5     6     6
    Fun              7     6     6     6

### Iteration 5 — RESULT: KEPT. F10 closed.

The hypothesis named Clarity's cause and Clarity moved **6 → 9**, the largest
single-axis move in the project's recorded history. But the score is not the
evidence. The evidence is that the tester used the words:

> *"on day 29 the game offered me a laundromat at $10,021 — under market — and
> the option was disabled because public feeling was 26 and 'nobody there sells
> below 30'."*

Set against round 12, blind on the same gate:

    round 12   200 consecutive days, clean cash frozen at the $2,500 start,
               never learned the cause, first front day 200
    round 13   blocked day ~15, knew the stat, the reading and the bar while it
               was happening, first front day 44, seven fronts by day 250

Round 13 also filed it under **"a setback I had unambiguously earned"**, and
named the days it had caused it on. That is the finding closing in the way §2
asks for: a later round, told nothing, did not report it.

**Do not read the Clarity jump as the measurement.** Round 13 is one career by
one agent and the axis moves on where a tester lands. The sentence above is the
result; the number is a trend line.

### What did not close, and it is narrower than F10

**F12 — new, and a genuine successor rather than a restatement.** The refusal now
explains itself *once you hit it*. Nothing teaches the coupling *before* you hit
it. Round 13's named blocker on First hour:

> *"nothing told me that working one district repeatedly burns its public
> feeling, and that public feeling gates buying fronts there."*

**F13 — new, and mine.** In the memo, the reason renders as the option's hint
line, which reads as a description of the choice rather than as a refusal. The
tester clicked a disabled "Buy it — $10,021" and nothing happened. The string
reached them; its styling did not say "blocked". Filed SHOULD FIX, not MUST FIX.

### Findings this round settles or moves

**F2 — CORRECTED, and it is worse than recorded.** The round 12 entry concluded
the faucet was the problem: Influence accrues from a *paid* counsel retainer, and
round 12 cancelled counsel. **Round 13 kept counsel — including the top tier at
$5,863/wk — and still finished at Influence 0.** So the rate is the defect, not
just the closed tap. It cost the tester the entire city-hall vertical and the two
better informants: *"A whole vertical of the game was invisible to me for 300
days because of one attribute I had no idea how to train."*

**F5 — CONFIRMED, no longer merely unresolved.** *"The rival families never
attacked me after day 76 — three houses with strength 84, 100 and 100 against my
~20 stayed Neutral for 224 days."* The rival-heat probe is still owed, but the
inertness at human timescale is now three rounds deep.

**F8 — STILL UNTESTED, three rounds running.** Round 13 had three cases open and
two dropped. Never convicted.

**F11 — UNTESTED.** Round 13 never died, so the death screen was never seen.

**The two defects deliberately left in to keep round 13 attributable both came
back, from an independent tester.** "the VASARI have counted twice" was reported
again, unprompted, by somebody who had never read round 12. The `Covered? Yes`
payroll bug was *not* reached, because round 13 never borrowed — it remains
code-confirmed and unmeasured.

### New MUST FIX, neither about fronts

1. **Lay low removes the game.** ~60 of 300 days across four stretches in which
   the only available input was "+1 week". *"The punishment for heat is not
   danger, it is 14 days of pressing +1 week."* This is the same complaint F6
   keeps mis-measuring as Pacing.
2. **The memo pool exhausts, and after Capo it is the only source of new
   content.** One memo fired six times with identical text and options. Between
   day 180 and day 300 the tester met exactly one memo it had not seen.

### The one worth reading twice

Round 13 never found the back-room sit-down until **day 300** — *"its entry point
looks like a list of flavour buttons"* — and called it probably the best-designed
system in the game. Round 12 found it on day 19 and said the same thing about its
quality. **Same build, same system, two testers, 281 days apart in discovery.**
That is the F10 shape exactly: a good thing behind a door that does not look like
a door, and it is now the strongest candidate for iteration 6.

---

## Defect clearance — 2026-08-21, after round 13

Not an iteration. Seven code-confirmed defects cleared in one pass, now that
round 13 is banked and fixing them costs no attribution. `tsc` clean, **621
tests**, 54 files, green. Scorecard byte-identical, as it should be — nothing
here touches balance.

**1. `Covered? Yes` on weeks payroll misses — instance 22 of §3, and the fix was
wrong first.**

Test written first; it failed with `expected 0 to be greater than 0` because the
forecast said covered. The obvious repair — add `weeklyRepayment` to the bill —
made it pass. **It was also wrong**, and only running it found out: at cash 325
against a 350 repayment `tickLoans` pays *nothing*, because it settles each loan
all-or-nothing, and the wages come out fine. The nominal-repayment version would
have cried wolf on exactly those weeks, which is the same defect pointing the
other way in a file whose thesis is that a warning the player learns to distrust
is worse than none.

So `market.ts` gained `repaymentAgainst(state, funds)`, mirroring `tickLoans`'s
order and its affordability rule, and the forecast subtracts what the book will
*actually* take rather than adding what it nominally owes. Three tests: the
shortfall case, the bounce case, and enough-for-both. The shortfall test was
re-run against the reverted code and failed for the right reason.

**2. The payroll warning omits the fix that works.** It said "Finish a job, call
one off, or borrow" and never mentioned selling the put-away pile back, which is
what round 13 actually used on day 278. Now named, with the figure, when there is
anything to sell.

**3. "Close" → "Sell up", armed before it fires.** The refund is
`SHUTTER_REFUND_SHARE = 0.35`, not the 85% round 13 assumed — an unconfirmed
click destroyed about two thirds of a five-figure asset, labelled with the same
word the district and person panels use for "dismiss". Same arm-then-confirm
shape as the lay-low control, quoting the money back.

**4. The roster "overflow" was not an overflow.** Measured in the live page at
the reported width: `documentElement.scrollWidth === clientWidth`, and
`.table-wrap` was scrolling exactly as designed. What round 13 saw was the Pay
column squeezed to 60px around "thinks they are worth more", shredding it one
word per line and making **every row 113px tall**. Two shared classes were the
real cause — `.name-cell` and `.read-band` — so the fix is two `white-space`
declarations, and it repairs every table with a name or a hedged read in it.
Rows 113px → 54px, uniform; page still does not overflow; wrapper still scrolls.
Screenshotted before and after.

**A note on reading reports.** The tester's *symptom* was right and their
*diagnosis* was wrong, and acting on the diagnosis would have produced a fix for
a problem the game does not have. This is the fourth time measuring first has
changed what got changed.

**5. The Why panel printed what Rivals hides.** `faction.ts` built its trace
string from raw `faction.wealth/strength/heat`, so one screen showed a rival's
exact money on a day the other said "unknown". The panel's own header calls
itself *"deliberately not a state inspector — a screen that printed everybody's
true stats would quietly switch [the perception system] off"*; it was doing
exactly that. Now routed through `readFaction`, the function documented as
"everything the Rivals panel is allowed to show, and nothing more", so the two
cannot drift apart again. **Decision scores are untouched** — they are the point
of the panel and both testers named them as the best thing in it.

**6. `delegation.ts:101`** — "It is their to answer for." → *theirs*.

**7. `contraband.ts:174`** no longer names the Vasari. A career draws three
rivals from a longer roster, so the family was often not in the city; rounds 12
and 13 both reported being told about a family they had never met. Config cannot
look up who holds the waterfront without importing sim, so the copy says
"somebody else" and lets the diplomacy screens do the naming.

**Still open, deliberately:** the `OPPORTUNITY` memo that offers a front the gate
refuses. It explains itself now, sharing the F10 string, but F13 is about that
reason not *looking* like a refusal — it renders as the option's hint line. That
is a styling finding and belongs with iteration 6, not here.

---

## Iteration 6 — 2026-08-21

Findings open at the start:   lay-low (round 13 MUST FIX 1), F14, F13, F12, F2,
                              F5, F6, F7, F9, F11; F8 unmeasured
Diagnosis:                    Going quiet does not cost the player anything *in*
                              the game. It costs them the game. Round 13 spent
                              ~60 of 300 days across four stretches whose only
                              available input was "+1 week".
Hypothesis:                   If Quiet-approach work is permitted while laying
                              low, then round 14 will not report lay-low as
                              removing the game, because the player gets a real
                              decision every day of the fortnight — take reduced
                              money and stop cooling today, or stay dark and cool
                              at four times the rate — where today there is one
                              button.

**The heat maths is deliberately untouched.** A job launched while dark still
resets `quietDays` and still costs that day's decay, exactly as it does now.
That is what keeps this a decision rather than a discount: work every day of the
fortnight and you have paid 4 respect to cool nothing. The alternative design —
holding the quiet counter open while dark — was considered and rejected as a
straight buff to the heat spine, which §6 records collapsing a ladder once
already.

Change:
    operations.ts        `canLaunch` takes an optional `approach`; while laying
                         low it permits `quiet` and refuses the rest, naming the
                         exception. Defaults to the loud one, so every existing
                         caller and every probe keeps its old meaning.
    OperationsPanel.tsx  passes the selected approach to the check, and the
                         "Same again" repeat reads its approach before checking
    layLowHonesty.test.ts  four tests, written first

Bundled, because a blind round is too expensive to spend on one line and these
cannot confound each other — no lay-low change can affect the day somebody finds
the back room:

    CrewPanel.tsx    F14. The four sit-down buttons now sit under a line saying
                     what they open: a conversation, three exchanges, once every
                     21 days. Numbers read from `SITDOWN` so the promise moves
                     with the mechanic.
    MemoModal.tsx    F13. A blocked option's reason renders in the memo's own
                     danger red with a ✕, instead of the same grey as a
                     description.
    theme.css        the rule for it, reusing `.memo-severity.danger`'s red
                     rather than introducing a second one

Verification:
    test first   all four lay-low tests failed first, three for the right reason
                 and one — "still refuses by default" — passing from the start as
                 the guard it was written to be
    tsc          clean
    suite        625 tests, 54 files, green
    ladder       **byte-identical.** 36/35/35/28/18/15/9, mean heat 64.9, 14/36
                 ended early, first front day 42.

**Read that identical ladder correctly.** It is not evidence the change is safe
to ship — it is evidence the instrument cannot see it. `floor.probe.test.ts:51`
returns no operations at all while laying low, so no bot in this project will
ever take the option that was just added. This is F7 exactly, and it is the
second time an iteration has been sized against a measurement that structurally
cannot move. What the identical ladder does prove is that nothing *else* moved,
which is the only question the scorecard was asked.

Browser-verified, all three, against round 13's own save:

    lay-low      Straight refused with "Only quiet work moves until that ends";
                 Quiet launchable, button enabled, no tooltip
    F14          the line renders above the four buttons; buttons correctly
                 disabled with "You sat down 1 day ago. Give it time.", which is
                 round 13's own last action showing up as its cooldown
    F13          blocked hint computes rgb(143,32,24) against a plain hint's
                 rgb(106,97,84), with the ✕ prefix on disabled options only

Blind round 14:               NOT YET RUN
Result:                       PENDING
New findings:                 none from this iteration

---

## Two checks and three changes — 2026-08-21

Not an iteration. The developer asked what the blind rounds are actually buying,
which is the right question: two rounds cost ~3 hours and ~800k tokens, and about
half of what they returned was recoverable more cheaply. This is the half being
moved off the expensive instrument.

`tsc` clean, **629 tests, 55 files**, green.

### Check 1 — `refusals.test.ts`. A refusal gated on a threshold must name it.

**It found six more instances on its first run**, none of which any round had
reported:

    capos.ts        "You do not know enough about them to know who to ask for."
    capos.ts        "A made man does not take a meeting with somebody at your level."
    capos.ts        cooldown, with no number of days
    capos.ts        "You cannot cover what it would take."
    contraband.ts   "You cannot run any more of them."
    contraband.ts   "You cannot cover it."
    perception.ts   "You cannot cover it."
    diplomacy.ts    "They would laugh at you. Be stronger first."

All fixed, each naming the figure and the bar. **The diplomacy one is worth
singling out**: round 13 read that screen four times and wrote it down as "shows
strengths and stances but I never found anything on it I could press". It now
says you lead by N and would need M, or would need K standing against your J —
two ways over a bar the player could not previously see at all.

There is no allowlist and there must not be one. This defect survived four rounds
by being individually excusable every single time.

### The check was instance 23 of §3, twice, before it worked

Written, run, green. Then reverted F10's string on purpose to watch it fail —
and **it stayed green**. Two faults, both the classic shape:

1. It counted any `${...}` as naming a number, so
   `Nobody in ${territoryDef(t.id).name} will sell to you right now` passed. The
   interpolation was a district name.
2. The detection window started at the `reason:` line and looked forward, and
   `ok: false` is written *above* the reason in every multi-line return in this
   codebase. **No multi-line refusal was ever recognised as a refusal.** It had
   been examining only the single-line ones.

Both found by reinstating a real defect and demanding red. An instrument built to
prevent §3 was itself §3, and the only thing that caught it was the rule §3
already states. It now reports F10 by file, line, guard and text.

The file also carries two self-checks — that the glob reads something, and that
the detector still matches thirty-plus guards — because a scan that matches
nothing passes every assertion it makes.

### Check 2 — the forecast agrees with the payday, over 120 states

The three named cases were written from a real report. This is the property they
are instances of, and **it immediately found a second divergence nobody had
reported**: `tickEconomy` *drops* counsel when it cannot cover the retainer, and
that money then stays and pays the crew. The forecast was adding the retainer to
the bill, so it reported a shortfall on a week where everybody got paid.

`payrollForecast` now walks the day in the order the day happens — creditors,
then counsel as a cliff rather than a cost, then wages. Three attempts at one
function, wrong in both directions before this.

It holds `tickOperations`, `tickContraband` and `tickBusinesses` empty by
construction, asserts that, and leaves the razor edge alone because `tickMarket`
re-prices between the reading and the event. Both arms of the branch have to fire
or the test fails itself — which it did on the first run, at 2 short cases
against a required 5, because the money was drawn from a flat range against a
$150 wage bill.

### Change 1 — the brief stops asking for what a bot measures better

Eight checkpoints down to three. `docs/PLAYTEST.md` has said since round 7 that
`ladder.probe` produces a trajectory better than a person can, and the brief kept
asking for one anyway. Three is enough to read the scores against — Depth 8 from
a dead organization on day 119 is not Depth 8 at Underboss.

### Change 2 — the Used list now carries a date

"Roughly what day you first used it", against every system in Part 4. **This is
F14's measurement and it names no feature**, which the mid-round prompting rule
requires. Round 12 answered day 19 and round 13 answered day 300 for the same
system on the same build; neither report could have produced that finding alone.

### Change 3 — `docs/DIRECTOR.md` §4 gains a sizing rule, §6 a check-first rule

Three shapes — full round, targeted round, not a round — with the third pointing
at §6. A targeted round gets the same brief with the stopping rule changed and
**nothing else narrowed**: telling a tester where to concentrate destroys
under-use as a measurement, which is the same reason nobody is prompted mid-round.

§6 now says to ask, before dispatching, what *class* a reported defect belongs to
and whether the class can be asserted. Both checks above were written after a
round found one instance the expensive way.

### What this does not buy

Round 14 still has to run. Nothing here can see whether lay-low still reads as
the game going away, or on what day somebody finds a room. Those are experiences,
and the tester is still the only instrument that has any.

---

## Pacing — the rank table was sized for an observer who does not exist — 2026-08-21

**Raised by the developer, not by a round.** "Game pacing, seems impossible to
reach with the current build."

### The measurement

`ladder.probe.test.ts` already ran 36 careers over 1,460 days and recorded the
day each rung arrived. Nobody had asked it the 300-day question.

    rung             4-year median day     36 careers at 300 days (old table)
    Street Criminal        0                36/36  day 0
    Enforcer              21                34/36  day 21
    Crew Leader           71                29/36  day 60
    Capo                 380                11/36  day 212
    Underboss            435                 3/36  day 221
    Boss                 582                 0/36  never
    Crime Lord          1,065                 0/36  never

**Three rungs inside ten weeks, then a 309-day gap.** Two of seven ranks were
never reached by any career inside a human game. Round 12's *informed* run
reached Capo on day 324 — past the end of the round.

This is almost certainly what **F1** has been reporting as "decisions stop
changing around day 90–119". The loop did not close. The ladder stopped
answering and nothing else was scheduled to.

The cause was written in `config/economy.ts`'s own comment: everything above
Crew Leader was calibrated against the best of **four-year** careers. That is
precisely the mistake §5 exists to prevent, sitting in the most important table
in the game, never having been checked against its own rule.

### The pre-committed condition

Written before the table was touched, into `ladder.probe.test.ts`: Capo ≥24/36
by median day 150, Underboss ≥15/36 by 220, Boss ≥8/36 by 285, and Crime Lord
≤3/36 — the last one guarding against flattening the ladder instead of fixing
it. Failed red on the old table for the right reason.

### What constrained the re-size

Two **pre-existing** invariants own the money column and both fired when the
first attempt ignored them:

- `foresight.test.ts` — each paying rung must be 3–6× the one below.
- `balance.test.ts` — nobody may coast to the top rung in two years.

Both are older than this change and both are right. The money ladder is
therefore set at the bottom of the band they allow — 12,500 / 40,000 / 130,000 /
420,000 / 1,400,000 — rather than at what a 300-day career can hold.

### Result — KEPT, pre-commit still failing on purpose

    rung          before            after
    Capo          11/36 day 212     11/36 day 86
    Underboss      3/36 day 221      9/36 day 211
    Boss           0/36 never        7/36 day 260
    Crime Lord     0/36 never        0/36 never

Over four years the whole ladder opens up as a side effect: Underboss 18→27 of
36, Boss 15→24, Crime Lord 9→18 with its median day falling 1,065 → 635.

**The share of careers reaching each rung barely moved, and the probe says why
in one line:** `furthest requirement at the end: clean money 34, respect 2`.
Thirty-four of thirty-six careers are held by the money line. `careers that
ended before day 300: 0/36` — it is not attrition.

The failing assertion is left failing. §5's repair clause was not invoked.

### F15 — the economy is bimodal, and it forks on fronts. NEW.

**The first diagnosis of the money wall was wrong and was shipped before it was
checked.** "A career earns $5,429,975 and peaks at a balance of $45,470, so the
money does not stay" compares a **mean against a median** on a distribution
whose mean is 9.7× its median. It is not a ratio. There is no leak. The claim
had already been written into `config/economy.ts` and reported to the developer
before it was caught. **Instance 24.**

What is actually there — estate across 36 careers at day 300, sorted:

    8,677 … 47,667                     25 careers
    ──────────────────────────────────  the population splits here
    133,975 … 2,827,037                11 careers

    compounded (>= $100,000):  11 careers, median 7 fronts
    flat      (under $100,000): 25 careers, median 1 front

    fronts by career, sorted by estate:
    0 0 0 0 1 0 1 1 0 1 0 1 1 1 1 1 1 1 1 2 1 1 1 1 2 │ 4 5 2 7 8 7 5 8 8 13 11

Near-total separation. `business.ts:579` pays front income **into holdings**,
which compound at 0.45%/week. A family that never gets a second front never
starts compounding.

**So the money rung — and the whole top of the rank table — sits downstream of
the front gate.** That is F10's system, and F12's. Round 13, after F10's fix,
bought its first front on day 44 and held seven by day 250: that career belongs
in the compounding eleven.

Caveat, per F7: this is a bot with its own buying policy, money-blocked in 97%
of its idle weeks. The correlation is total and the one human career we have on
the far side of an F10 fix lands where the model predicts, but no instrument
here has been shown able to play the wide game.

Printed by `ladder.probe.test.ts` on every run, not asserted — an economy where
building something pays more than not building it is the design, not the fault.

---

## Iteration 8 — F12, the front gate said in advance — 2026-08-21

**Hypothesis.** Round 13 read F10's repaired refusal, understood it, and still
named the front gate as its First hour blocker — because a refusal can only be
read after two weeks of earning it. If the coupling is stated *before* the
district is worked, the player can avoid the gate rather than discover it.

**What existed.** One string: the words "the street minds" on the Heavy button.
No district, no figure, no consequence. The explanation of the bar lived in a
`title` tooltip on the territory sheet — the same hover that iteration 5 had to
take the F10 sentence out of.

**The change.** `sentimentOutlook(state, territoryId, approach)` in
`sim/operations.ts`, rendered as body text under the district picker, plus
`feeling N` on every district button with the same `hot` treatment below the
bar that `TerritoryPanel` and `ContrabandPanel` already use.

    Public feeling in Little Sicily is 50. This costs nothing on its own, but a
    job that goes wrong costs 2 and violence costs 6. Below 30 nobody there
    sells you a business.

    (Heavy)  This costs 3 on its own, a job that goes wrong costs 2 more and
             violence costs 6.

Deliberately the same sentence shape as the heat line directly above it —
where you stand, what it costs, what it costs if it goes wrong — because that
line was added for this exact complaint about heat and it worked. No new
mechanism.

**Test-first.** Two tests in `territory.test.ts`, asserted on mechanism rather
than wording: the figure, the bar, the failure cost, the violence cost, and the
district's name. Red first with `sentimentOutlook is not a function`. Then
green. Then **two real defects reinstated and red demanded** — the bar replaced
with "a certain point", and the district name replaced with "here". Both
caught.

**Verified in the browser**, on the namespaced instance rather than the
developer's dev server (`.claude/launch.json` gained a `mafia-verify` entry that
runs `scripts/playtest-run.mjs`). Both lines render, Heavy changes the sentence,
no console errors. **The `hot` styling below 30 was not exercised** — reaching
sentiment 30 in a live game takes fifteen or more bad jobs, and the conditional
is the one already shipped in two other panels.

`tsc` clean. 634 tests, 55 files, 633 passing and one failing on purpose.

---

## Round 14, and the repairs it bought — 2026-08-21

Dispatched blind from a fresh agent, Browser pane open first. Screenshots worked
from the first call. 300 days, finished Crew Leader.

    axis           r12   r13   r14
    First hour       8     8     9
    Clarity          6     9     8
    Feedback         8     8     8
    Depth            8     8     8
    Pacing           5     5     6
    Difficulty       6     7     7
    Writing          9     9     9
    Interface        7     7     8
    Standing in it   6     6     7
    Fun              6     6     5

### What the three stacked changes did

**F14 — CLOSED.** Sit-down found on **day 15**, by clicking a crew row. Round 12:
day 19. Round 13: day 300. Round 14 called it "the best thing in the game" and
"it made a stat block into a person in ninety seconds."

**F13 — worked.** The tester quoted the ✕ styling back and never clicked a dead
button expecting it to fire. Round 13's specific complaint does not recur.

**F12 — worked.** Unprompted, under "what did the game teach me": *"public
feeling in a district falls every time you work it and gates you out of buying
businesses there at 30."* That is F12's content, held as learned knowledge.
**Round 13 named the front gate as its First hour blocker; round 14 does not
name it at all.** First hour 8 → 9.

**Iteration 6 — the mechanic shipped and the copy did not.** Quiet work while
dark works; `operations.ts:373` refuses only louder approaches, and
`layLowHonesty.test.ts` had four green tests proving it. Every string still said
otherwise — `events.ts` offered "Everything stops / nothing earns" and
`Dashboard.tsx` said "Nothing earns". The tester went dark four times, had used
Quiet since day 86, never discovered they combine, and filed "there is no
partial option."

**Nothing was broken, so nothing failed, and a blind round was spent
rediscovering a complaint the change had already answered.** That is the whole
lesson of this entry.

### F15 confirmed from outside

Finished with **2 fronts**, ~$16,000, four of five Capo lines met, **$6,700
short on net worth**. Their own words: *"Buying a third front. Blocked twice on
day 266 and once on day 300, both times by public feeling… This is what capped
my net worth and cost me the rank."*

A blind tester derived F15's chain — front gate → fronts → net worth → rank —
with no sight of the probe. Two fronts places them in the flat twenty-five, and
the outcome is what the model predicts.

### MUST FIX — the price vanished exactly when it mattered

`events.ts` `payable()` put the figure in `hint` and the words "You cannot cover
it" in `disabledReason`; `MemoModal` rendered `disabledReason ?? hint`. Five
reproductions across four memo families, proved from the DOM. The tester:
*"being poor is the state where you most need to know whether you are $50 short
or $20,000 short, because that decides whether you sell an asset or give up."*

**`refusals.test.ts` was written to prevent exactly this and did not. Instance
25.** It looks for a threshold comparison and a refusal string within a few
lines, and this refusal comes from a **shared helper** with the amount arriving
as an argument. There is no comparison at the site to find. A scanner that reads
guards cannot see a guard that has been factored out.

Repaired in three places, and the check gained a behavioural half that builds
the events instead of reading them — which found **three** instances on its
first run, two of which no tester had reported:

- `shortOf(state, amount)` extracted; the words "You cannot cover it" had been
  copy-pasted **eight times in `events.ts`** and thirteen across the sim. All
  eight collapsed onto the helper. The refusal now names what is in hand.
- `MemoModal`'s own fallback dropped the figure the same way. Fixed.
- The renderer no longer replaces the hint with the refusal. Both render, so
  whichever field holds the number, the number is on screen.

Five of the thirteen copies remain, in `contraband.ts`, `diplomacy.ts` and
`investigation.ts`. They are post-hoc `message` refusals rather than pre-emptive
disables and need the funds read before the attempt. **Not done, deliberately
scoped out, and they are the same defect.**

### Who the memo is about — developer request

Eight memo shapes carry an `npcId` and named a person while showing nothing
about them. The tester: *"I was clicking the top two rows of a crew table
because they were the top two rows, not because I knew who they were."*

`MemoModal` now renders each subject's read between the body and the choices —
loyalty, skill, ambition, wage and whether they think they are paid enough —
through `StatRead` and `payRead`, so it shows the same fogged bands the crew
sheet does. A memo quoting true numbers would hand the player the one thing the
rest of the game spends its effort withholding.

**A list rather than one subject, because of `crew_dispute`**: it names two
people, offers "Back X" against "Back Y", and keeps the second in
`data.otherId`. A single-subject version showed one man's stats on the one memo
where the whole decision is a comparison. Verified live — the second man reads
"not yet" on all three bands and "no idea what they expect", which is the fog
doing its job and is itself the information.

`payRead` lifted from `CrewPanel` into `components.tsx`; one definition, two
readers.

### The copy-agreement check

`layLowHonesty.test.ts` gained a source scan asserting that no player-facing
string claims laying low stops everything. Tracks block comments as a state
rather than by leading character — the first draft flagged its own explanation.
Proved by reinstating the Dashboard string and watching it fail by file and
line.

`tsc` clean. **639 tests, 55 files, 638 passing and one failing on purpose.**

---

## Influence supply — three causes, two fixed — 2026-08-21

Build item 1 from the blueprint. F2 has been open four rounds and every previous
diagnosis looked in the wrong place: round 12 blamed the faucet being closed,
round 13 disproved that by keeping top-tier counsel and finishing at 0.

**The supply is not low. It is a wall with a hole in it.**

### Cause 1 — the retainer was skipped whenever nobody was payable

`tickEconomy` opened with `if (crew.length === 0) return;`, and the legal block —
where counsel is paid and where influence accrues — is written below it. So a boss
whose people were all in a cell stopped paying the firm that was trying to get them
out.

That is not an edge case. It is the exact position a player who has bothered to
retain counsel occupies; round 14 had five of six men in custody on day 153 with a
lawyer on the books.

Fixed by moving the guard below the legal block: nobody to pay is a reason to skip
wages, and only wages. **The ladder probe went from `18 weeks a career on retainer`
to `83`.**

### Cause 2 — the approach credit had no cooldown

`demand_tribute` costs $0 and `canDo` rate-limits nothing, while `doDiplomacy` paid
`INFLUENCE_FROM.approach` per call. Measured: **twenty demands in one afternoon
credited 10.7 times over** — on the attribute the game presents as the hard one to
train, and the one whose config comment already records a previous failed attempt to
unwall it.

Fixed with `approachCooldownDays: 14` on a new optional `FactionBond.lastApproachDay`.
**The cooldown limits the credit, not the action** — the tribute or the refusal lands
either way. Standing in the same room twice in a week is not twice the standing.

### Cause 3 — the rate itself, still open

With both fixed, `ladder.probe` now reports:

    influence at day 300, 40th / median / 75th: 0 / 0 / 3
    (the patron wants 9, a task-force contact 5)

**The median career still ends on zero.** This is a balance decision and it needs a
pre-committed target under §5, so it is left open rather than guessed at.

**And the instrument is a floor, not a measure.** The bot retains only the cheapest
tier of counsel (×1 of 5.5) and never approaches a family, so it exercises one of the
two routes at its weakest setting. That is F7, and it means 0/0/3 understates what is
reachable by an unknown amount.

### Method

Both fixes test-first in `influenceSupply.test.ts`, and both reinstated afterwards to
demand red. **The first reinstatement was inconclusive and nearly passed as proof**:
the anchor string matched twice and the injected defect landed in `payrollForecast`
rather than `tickEconomy`, so the suite stayed green and the check looked confirmed.
Caught by grepping for the line actually inserted. Re-done against `tickEconomy`'s own
opening line, and both assertions then failed for the right reasons.

The test also asserts the *other* direction on purpose: a fix that closed the hole
without opening the wall would have made the reported problem worse, so a season of
talking to all three families must still build real pull.

### Also, in the same pass

`org.influence` deleted — a field initialised to 0, never assigned anywhere, and
rendered as "Influence" on the Standing block a few rows above the attribute of the
same name. `deadState.test.ts` guards the class: it parses the `Org` interface and
fails on any declared field nothing assigns. **Second time dead state has shipped
here**; the round-11 audit removed seven config keys read by nothing.

That check was also wrong twice before it worked — it built its matcher with
`new RegExp` through a template string and threw `Nothing to repeat`, then walked into
the inline `record?: { … }` object and reported five of its keys as dead fields of
`Org`.

`tsc` clean. 645 tests, 56 files, 644 passing and one failing on purpose.

---

## The Influence rate, and F17 — 2026-08-21

Cause 3 from the previous entry, closed against a pre-committed target — and the
instrument built to measure it produced a bigger finding than the fix.

**The target was written first.** `ladder.probe` gained an assertion demanding a
median influence of 4 to 8 at day 300 before `INFLUENCE_FROM` was touched: the
median career opens a task-force contact, city hall stays work. It failed at 0.

**F7 closed for this vertical.** The bot now approaches a family every week — the
first instrument in this project ever to make a diplomatic approach. It was added
because a rate tuned against a bot that pulls one of two taps is tuned for a player
who does not exist.

**What it measured is that the tap is welded shut.** Every approach across 36
careers is refused with the same sentence, for all 300 days:

    "You lead them by -72 strength and would need 15 — or 55 standing
     with them, against 29."

The paid courtesy wants $25,000 spare against an economy money-blocked in 97% of
idle weeks. Both doors, closed, always. That is **F17**, and it is F5 wearing another
hat — the player runs 40 to 80 strength behind every rival the whole game.

**The instrument distorted what it measured, and that was caught.** The first bot
policy also paid `offer_tribute` when money looked spare. Careers that compounded
fell from 12 in 36 to 8, because the treasury went on courtesies instead of fronts —
$25,000 for 0.6 of an attribute is not a play a boss makes. Removed; the fork
returned to 12/24 and the ladder to its prior values.

**And the comment nearly shipped with numbers from a different instrument.** The
rate table in `config/economy.ts` was measured while the tribute branch was still
live. Re-measured all three under the shipped probe before committing:

    0.12   0 / 0 / 3     the reported state
    1.2    2 / 3 / 6
    2.4    4 / 5 / 9     shipped

**What the fix does not fix.** `counselPerWeek` is now carrying a vertical it should
be sharing, and the consequence is backwards: a boss who is never investigated keeps
no lawyer and earns no pull. Opening the diplomatic route is the honest repair and it
runs through F5.

`tsc` clean. 648 tests, 56 files, 647 passing and one failing on purpose.

---

## The favour network, first slice — 2026-08-21

The first code in this repository that belongs to the developer's Mafia-boss
vision rather than to its prerequisites.

**And it was ordered wrongly by me one commit earlier.** The blueprint update put
F17 ahead of this on the reasoning that "the game has no working way to build a
relationship outside the family." That conflated the diplomatic route to *Influence*
being shut with the favour network *needing* that route. It does not — the network is
its own route, and it reads Influence as a gate that counsel now supplies. Corrected,
and the network built.

### What it is

`config/civic.ts` and `sim/civic.ts`. Four figures, each watching one quantity the
simulation already maintains:

    a police captain    street heat            buries a case
    a union boss        districts held         quiets a street
    a judge             notoriety              opens a door
    somebody in office  public feeling         loses the paperwork

**It generalises the two one-offs the blueprint identified rather than sitting beside
them.** `PATRON` was an anonymous ninety-day timer for $120,000; the alderman is that
arrangement with a relationship in front of it. The agency contacts were booleans you
bought; standing here cannot be purchased at all — it drifts toward what the figure
sees, so a player who never opens the screen still builds standing with somebody,
because standing with a captain *is* a low heat number seen from the other side.

**A favour is spent on a problem, not on a stat.** Nothing it does adds to a bar.

### The property that mattered

Reachability, and it is asserted rather than hoped: thirteen quiet weeks put a
captain over the bar. Round 14 on the system this replaces: *"the system I most
wanted and it is priced for a run that has already succeeded."*

`driftPerWeek` was sized against that, not picked. At 3.5 the net was 2.7 a week and
thirteen weeks reached 35.1 against a bar of 40 — the network would have opened after
a person stopped playing, which is the exact defect it exists to fix. 4.5 reaches 48.

The union favour lifts a district over `SENTIMENT_HOSTILE_BELOW`, pointing it at F10,
F12 and F15 at once: a district under the bar sells no fronts, and fronts are the fork
25 of 36 careers never cross.

### Three faults caught in my own work

- **The test helper never ran the tick.** `weeks()` did `state.day += 7` from a day-1
  start, landing on 8, 15, 22 — never a multiple of seven — so `tickCivic`
  early-returned every time and thirteen weeks moved nothing. **That is the trap
  HANDOFF section 3 names explicitly**, and my instrument guard was too weak to catch
  it: it asserted `owed === 0` at the start, which passes trivially. There is now a
  `ticked at all` test that fails if the helper steps the clock wrongly.
- **Two refusals, one assertion.** The test demanded the standing-0 refusal name
  `owesAbove`. At standing 0 the honest refusal is the *stranger* bar, and telling a
  stranger "they start owing above 40" would be F10 again — a true sentence about the
  wrong number. Split into two tests, one per bar.
- **`voice.test.ts` caught my copy.** "Nothing you do is his business until it is in
  the paper." Fixed to "their".

### What is not done

No bot exercises it, so it is invisible to every probe — F7, again. No blind round has
seen it.

**The browser check was completed on a second attempt.** The first failed because the
Browser pane was not displayed, so the page stopped compositing and the clock would
not advance — round 12's failure mode in a new place. With the pane open, a real
career was driven to **day 112** and the following verified live:

- All four figures render, with a standing bar and what spending one would do.
- **Standing accrues from play.** A career kept at heat 0 had a police captain
  owing **2** by day 112, and the panel's own header changed from "Nobody outside
  the family owes you anything yet" to "Somebody owes you."
- **Every refusal names its own bar and the player's value against it**, in body
  text rather than a tooltip: the union boss at "standing is 24; they start owing
  above 40", the judge at "needs Influence 3; you have 0", the alderman at 6.
- **A favour that cannot land says so.** Calling in the captain with no open case
  printed "There is no open file for them to lose" and did not spend the favour.

**Still not verified live: a successful bury.** That career never attracted a case, and
grinding one open was not worth the driving; the effect is asserted directly against
the investigation object in `civic.test.ts`.

**And looking at the screen found a defect no test could.** The alderman's blurb said
it *replaces* the $120,000 arrangement on the City panel — and that arrangement is
still rendered directly below it. Two routes to the same ninety days is the shape the
vision actually asked for ("instead of clicking Reduce Heat — $50,000 you need to
solve the problem through your network"), so the panel is right and the sentence was
wrong. Corrected to say the same arrangement reached the other way.

`tsc` clean. 660 tests, 57 files, 659 passing and one failing on purpose.

---

## The four absent systems, built — 2026-08-21

The developer's vision named twelve layers. Nine already existed. This closes the
other five — the favour network in the previous entry, and these four.

### Legitimacy, and what a career turns out to have been

Both derived readings rather than stored state, in the spirit of `estate.ts`.

Legitimacy is four terms a person outside the family would actually notice: what
you visibly own, whether the police are interested, whether the papers use your
name, and whether the money on hand can be explained.

Eight career shapes, read off what happened, with `unremarkable` at weight 0 as a
floor — because most careers are, and a system that always finds something
flattering to say is a horoscope with the game's own numbers in it. **F11 closes
with it**: the death screen had 495 bytes and one button, and now carries a
verdict, the evidence for it, and a post-mortem that reports peaks as well as
final values.

**The screen caught what the tests did not.** A career with 0 operations and 0
respect was being told it was shaping into The Diplomat, because favours accrue
from how the family is run and a captain watches how quiet you keep things — so
doing nothing earns them. Exactly the horoscope failure this file has a test
against, and it got past it. The Diplomat now needs the pull to have gone and got
them, and there is a test for the do-nothing career.

**And a test that proved nothing.** "Takes the heavier shape when two of them fit"
passed with the sort removed, because the claims happened to be written in
descending weight order. Reordered so declaration order and weight order disagree
on purpose; the sort is now load-bearing and the test fails without it.

### Whispers

Confidence-rated claims generated from real state — somebody talking, somebody
about to go, a file being opened, a rival counting doors, a take that does not
add up. Round 14's MUST FIX 2 was that the memo pool exhausts; an authored pool
has a size and this does not.

**A whisper can be wrong, and the read cannot say which.** `truth` is stored and
never surfaced. Asserted by *shape* rather than by inspecting today's fields, so a
`truth` added later fails the test — proved by adding one and watching it go red.

**It must not touch the causal stream.** The first version took an `Rng` and
rolled weekly, and wiring it into the clock broke two unrelated tests about
operations. That is not a test problem: a system that only reports on the world
must not change what happens in it, which is the rule `trace.ts` states for
itself. Redrawn on `Rng.stableNoise` keyed on day and seed — the same discipline
`perceive` follows — and both collateral failures went away.

**And every test bypassed the clock.** All of them drove `tickWhispers` by hand,
so all would have passed with it never wired into `advanceDay` — which is the
state the first browser check found it in. There is now an integration test that
plays 200 days through the clock.

### How hard you lean on a front

The vision asks for gambling, inspections, staff, unions, theft. Most of that
already exists here under other names — exposure is the investigators' interest,
health is whether it is a going concern, sentiment is the neighbourhood,
`informants.ts` is somebody talking. So rather than a second copy per front there
is **one dial**, and it is the question the vision actually poses: how dirty do
you want this business?

Three settings feeding four existing systems. The default is the old behaviour in
every term — every multiplier on it is 1 or 0 — asserted as arithmetic rather
than trusted, so an existing save is untouched.

### The clock trap, three times in one session

`tickCivic`, `tickBusinesses` and nearly `tickWhispers`. Each gates on
`day % interval`, each test helper stepped the clock by the interval from a day-1
start, and each therefore ran the tick **zero times** while reporting that the
feature changed nothing. Every one of those files now has an instrument guard
that fails if the helper steps wrongly.

### Measured before fixed

Adding the pressure column put the businesses table 237px into horizontal
overflow with a 118px row. Before assuming that was mine, the column was hidden
and re-measured: **the table already overflowed by 49px**, and the column was 189
of the remainder. Round 13's lesson applied — the row height was the real damage
and is now 57px, matching its neighbours; the wrap scrolls horizontally by design.

`tsc` clean. 687 tests, 60 files, 686 passing and one failing on purpose.

---

## Iteration 9 — 2026-09-01 — the engagement overhaul, P0 and P1

**No blind round has been run on any of this.** Every line below is a change and
a measurement, and not one of them is a score. §0 says the director does not
grade, so `Result:` is deliberately absent from this entry rather than left
optimistic — the next scorer decides whether any of it worked.

Findings open at the start: round 16's, from three blind scorers.

### What round 16 said, and what it cost to hear it

Three scorers were dispatched in parallel. **All three independently failed to
find `approaches.ts` across careers of 21, 43 and 77 days.** That is the only
finding of the round that needed three testers — three of three is a rate and one
career cannot report one — and it is now the worked example in §4 of the rule
that decides how many to send. Everything else the round returned was a fact one
tester reproduced, paid for three times.

Their other findings, all reproduced and all now closed:

- `player.rank` was **dead state**. Nothing in the codebase ever assigned it, so
  every career in the game's history ended on the rung it began on. One tester
  had three districts at dominance, seven fronts, seventeen people and $470,000
  and was still labelled a street criminal.
- The build screen and the crew dossier were found by accident on days 8/18/25
  and 32/43/81. Sixteen unspent points from the first morning, and the best
  screen in the game one click inside an unmarked table row.
- Laying low warned it would not clear heat, quoting a multiplier that only
  scales absorption and never touches decay.
- "shake on $X" rendered enabled at any price and its handler discarded
  `closeDeal`'s result, so a purchase nobody could afford played the success cue
  and charged a day.
- `Case a job` and `Spend the week on it` were one ability under two names —
  69 days of owning something a tester could not locate.
- Two memos were the same memo, and the duplication hid that round 15's
  per-person subscription fix had been applied to only one of the pair.
- A standing order's approach was recorded at set-time and then invisible.

### The shape of the whole iteration, which is the finding worth carrying

Twenty-five changes went in. Sorted by outcome rather than by phase, they say
one thing very clearly:

    surfacing something that already existed        every one kept
    adding a cost or a system                       four of five reverted

The four rejected repairs were all aimed at one problem — `Call In Tribute` run
1,392 times a career against 711 for both paid jobs of its rank together — and
each failed by damaging something the job is load-bearing for:

    retiming both free jobs      `ladder.probe` "what the ground is for" hit
                                 exactly 18/36. Both are district-gated, so
                                 slowing them deleted the value of holding ground.
    a capital-wall fix           disproved before it was built: 36/36 clear
                                 $50,000 a median of nine days after tier-4 opens.
    a standing cost             civic figures owing you: 4/36 against a bar of 18.
                                 Standing is a set of thresholds, not a pool.
    grooves on hand play        the whole game deflated ~30%, and moving a
                                 standing order stopped beating leaving it.

**The finding: the dominant job is dominant because it is the most robust thing
on the board, so any cost applied broadly removes its competitors before it
removes it.** The standing cost took Port Operation from 175 launches to nought
and left Tribute *higher* than it started; the repetition tax cut Tribute 20% and
the paid tier-4 jobs 70%. Two opposite mechanisms, the same failure. Shelved at
the user's call, with all four readings in `freeLadder.test.ts`.

### Two ratchets, one real and one imagined

**Crew fear was a one-way ratchet and the repair for it had never run.**
`fearSettlePerTick` sat below the `arrested` skip in `driftNpcs`; a working crew
spends 31% of its man-days in a cell and arrest is the largest fear source in the
game, so the biggest inflow was also the switch that turned the outflow off — a
nominal 1.5 a week delivering 0.80 against an inflow of 2.67. Lifted above the
skip and given a share of the load, on the argument `HEAT_DECAY_SHARE` already
records. Man-days at the ceiling fell from 36% to 5% and the stat has a dynamic
range for the first time: a working crew rests near 70, an idle one near 53,
against a base of 43.

**And the informant system was fine.** Chased on my own recommendation, which was
wrong twice. Raising `INFORMANT.fearAbove` would have done nothing — loyalty is
the binding gate at 18% of man-weeks against fear's 76%, and fear is the sole
blocker in 3%. Then "one informant a career" turned out to be the designed
ceiling rather than a rate: `tickInformants` runs the flip loop only while nobody
is talking. Measured properly by occupancy, nothing planted, 24 careers each:

    boss who...          ever had one   days somebody talking   first turned
    grinds them daily          24/24                     65%         day 105
    works them every 4th       21/24                     40%         day 182

Nothing changed. `informants.probe` now measures the natural rate, which it never
had — it plants its informant, correctly, because it exists to ask whether a
player can read the record rather than whether the record gets written.

### P1, where the audit was wrong twice in the same direction

`ENGAGEMENT_OVERHAUL_AUDIT.md` filed the relationship web as "data built, no
view" and story arcs as "parts, no framework". Both wrong, and wrong the same way
the rest of this iteration was:

- **The tie view existed and pointed the wrong way.** Ties are stored on whoever's
  opinion changed, so `readTies` says who a man would follow and structurally
  cannot say who would follow *him* — which is what `followDeparture` reads. The
  compounding walkout, which `ties.ts` calls one of the best consequences in the
  game, was legible from every sheet except the one it is about.
- **The game is full of arcs and needs no framework.** Marks and informants are
  complete arcs; goals, memory and ties are substrate; and scores, promises and
  investigations are arcs the audit did not list. Each lived on its own panel.
- **The game forgets itself.** `LOG_LIMIT` is 400 and a career writes far more:
  a 300-day boss can see 50% of his career and a 600-day boss 22%. The founding
  of the family is the first thing discarded. `chronicle.ts` derives the whole of
  it from people the simulation already keeps forever.

### Instrument failures, which is the part of this log that pays

Seven, and each would have produced a green run on a broken feature:

- Approaches gated on grievance alone put one man in the doorway **124
  consecutive days** of a 300-day career. Only a run-the-days measurement saw it;
  every stat-level test passed throughout.
- The doorway was lit 71% of days at its cap, and 71% for a boss who grinds his
  crew against 76% for one who barely works them — a signal that did not depend
  on anything the player did. Fixed and now guarded on the *discrimination*
  rather than on a threshold, because an absolute bar is what failed.
- Three crowd tests passed with the effects deleted, because a fresh career has
  one man in it and their `if (!watching.length) return` guard skipped them.
- A chronicle overflow test compared two records neither of which had forgotten
  anything: a bare clock bot writes 80 log entries in 260 days, under the cap.
- An arc-ordering test passed against a pressure-sort twice — first because both
  fixtures were quiet, then because sixty days of clock had made the old one
  pressing too.
- A duplicate-memo guard was written on choice-set equality, which would not have
  caught the actual pair; three benign declines already collide. Replaced with
  the behavioural invariant that broke.
- My own measurement scripts clicked SOUND several hundred times, because
  `read().actions` is every control on the page, and nearly reported "career
  stuck on day 8" as a game finding.

Every guard in this iteration was verified by putting its fault back and watching
it go red. That is now the only reason to believe any of them.

### Where it stands

`tsc` clean. 1,360 unit tests in 108 files, 8 probe files, 85 probe assertions —
all green.

One probe bar was loosened and it is declared rather than buried: `broke.probe`
asserts that hiring to this week's income is the worst of three policies at a
1.5x margin, and it measures 1.25x now. The direction survives. The mechanism is
the one that file already records twice from two other directions —
`heatFearLoyalty` scales entirely on `fear / 100`, so a crew resting at 67 rather
than 100 takes a third less drain, walkouts fell from 36 a career to 31, and
bodies were the whole reason over-hiring was dangerous. Re-pointed at 1.2x rather
than retired, so it still fails if the two converge.

### What the next round is for

Not a full sweep of everything above. Two questions, and both are rates:

1. **Do players find the doorway now?** Three of three missed it; there is a rail
   badge and a measured signal behind it. This is the finding that justified three
   scorers and it is the one that needs them again.
2. **Does the Overview's third list get used, or read as more wallpaper?**
   "Wanting you", the doorway and "What you have running" are three lists on one
   screen now, and that is exactly the shape §4 warns about.

Everything else in this iteration is a fact a single scorer can reproduce.

---

## Round 17 — 2026-09-01 — the first blind measurement of the overhaul

Three scorers, dispatched fresh, no source access, one instance each. Careers of
**184, 163 and 317 days**; all three reached Boss or Underboss and stopped
voluntarily rather than being wiped out.

    axis                   A    B    C
    First hour             9    9    8
    Clarity                9    8    8
    Feedback               8    9    8
    Depth                  8    8    8
    Pacing                 6    7    6
    Difficulty             8    8    7
    Writing and tone      10   10    9
    Interface              8    9    8
    Standing in it         7    7    7
    Fun                    7    8    7

All three marked Depth as covering the job/crew/territory/heat loop only. None
of them opened the Trade. **Standing in it came back 7, 7, 7**, and all three
gave the same reason unprompted in question 7: *"a spreadsheet, plus two
people"*, *"five laundromats, four coloured squares, $12,000, and Nico"*,
*"twenty-two people I can name… but the districts and the fronts are rows in a
table."*

### The two questions the round was for, and they did not go well

**Do players find the doorway now?** One of three. A found it on day 78 and used
it for promotions and grievances. B and C never mention it in 163 and 317 days;
both reached sit-downs by clicking a crew row instead. Round 16 was nought of
three, so the rail badge moved it from *nobody* to *one, late* — a real change
and not the one that was wanted.

**Does the third list read as wallpaper?** One of three noticed it at all. A
called it *"remarkable"* and quoted it back — *"Was told they are covered. 29
days before they stop expecting it"*. B and C do not mention it once. That is
not wallpaper; it is worse, and it is the same failure the panel was built to
repair, one screen further in.

**So the surfacing work is half-landing.** Three of three found the build screen
and the crew dossier this time, which round 16 found by accident on days 8/18/25
and 32/43/81 — those two repairs worked. The doorway and the running list did
not, and a badge on the rail is evidently not enough on its own.

### What three of three said

1. **Diplomacy has no verbs, and a rank requires a rival family that trusts
   you.** All three, independently, and two of them named it as the reason the
   ladder terminates. B: *"the rank ladder currently terminates in a panel with
   no buttons."*
2. **The late game flatlines** — day 120, 120-130, 180. Income outgrows every
   ask and heat collapses once you hold ground. This is the dominant-job finding
   from iteration 9 arriving from the player's side.
3. **Attribute points produce no observable feedback.** C measured it properly:
   same job, same crew, same day, 9 points placed, *"Your ability"* unchanged.
   They are right, and the cause is worse than they could see — `player.build`
   and `player.attributes` are two different fields, and the odds line reads the
   one the build screen does not write.
4. **The front-slot refusal tells you to take more of a district you hold at
   100.** Fixed.
5. **The Trade is unreachable.** $252,772 a route, advertised at day 36.

### Fixed, all five reproduced, all the same fault

Every one of these is the game saying something the system does not do. Not one
is a mechanic misbehaving, which is the shape of this whole build now.

- **The grievance splice.** *"They have not forgotten it: they Was on the Fence
  Stolen Goods. It went wrong.."* — `gen_wants_a_word` splices its reason into
  `they {reason}.`, correct for a memory (a verb phrase with an implied subject)
  and wrong for a note (a whole capitalised sentence). The comment above the
  function states that rule; the fallback added underneath it broke it.
- **The indictment promised a trial two of four agencies cannot hold.**
  `state_taskforce` and financial crimes are `maxStage: 'indictment'`; only the
  Bureau is `'trial'`. The hint is read off `maxStage` now.
- **The favour refusal restated a condition the player had met.** A paid $9,000
  to lift a captain from 49 to 71 against a bar of 68 and still read *"they
  start owing above 68"*. The blocker was `favourIntervalDays`, which nothing
  mentioned.
- **The front-slot refusal named a remedy that does not exist.** `businessSlots`
  is the lesser of control and the district's own density, and density cannot
  be moved.
- **Casing a job left no trace for a week** — and that one is ours. Two testers
  used the Method verb on days 22 and 25 and found nothing anywhere. The odds
  row only appears on the job it was bought for and only once the week is up.
  It is in `arcs()` now, which is exactly what that panel was built for and
  where it should have been from the start.

### Diplomacy was not a design decision at all

Filed here first as one, and that was wrong. `doDiplomacy`, `canDo` and
`diplomaticCost` all exist; the panel has peace, tribute, an alliance and a
sit-down with the man who runs the house; round 13's *"shows strengths and
stances but I never found anything on it I could press"* was already answered
inside `canDo`.

**Every one of those verbs lives in a modal that opens by clicking a family's
row, and the row's only affordance was a cursor.** All three scorers concluded
the panel is read-only — one after 317 days with a rank requirement pointing
straight at it.

That is round 16's crew-dossier fault in a second place: *"one click inside a
table row that is `cursor: pointer` and nothing else"*, found on days 32, 43 and
81. It was repaired by saying so in the page-sub, and **nobody checked whether
the pattern existed anywhere else.** It existed in five more panels. A guard now
covers the class rather than the instances: a panel that renders `clickable`
rows must say, in the text at the top of the page, that opening one does
something.

The guard itself was vacuous on its first run — the detector anchored on
`className={...clickable` and every panel writes that as a ternary, so nothing
matched and all six were skipped while it reported a pass. Caught by deleting
the copy it was meant to protect and watching it stay green. Once fixed it
immediately found Territory and Operations as well, which no tester had
reported and neither had I.

### And neither was the second one

Filed as the one genuine design decision of the three, and that was wrong too.

`successBreakdown` reads `player.attributes[def.attribute]`, which rises by
doing the work from forty call sites. `spendPoint` writes `player.build`, which
drives `hasVerb` and `worldPull`. Both alive, both coherent, different fields —
so nine points placed moved nothing on the odds row, exactly as the scorer
measured.

**The attributes panel used to be on Yourself and was replaced by the build.**
`PlayerPanel` records why in place: measured on how often each was read
anywhere else, two of the eight were read by nothing at all. What nobody
noticed when it went is that the odds row still points at the half that lost
its screen, so the player meets a number they can neither find nor move.

That is a repair, not a decision, and it is copy on both ends. The row names
its attribute — "Your negotiation" is a thing a boss can believe grows by
negotiating, where "your ability" is a thing he reasonably assumes he just
bought — and the build screen says what points are for, which is verbs and how
the city behaves rather than tonight's odds.

**Two of three round-17 items filed here as needing a decision were not
decisions.** Both were the same shape as everything else in this build: a
working system saying something untrue about itself. That is worth noticing
before the next round, because the instinct to escalate a finding to a design
question is what nearly left both unfixed.

**The dominant job is fixed, on the fifth attempt.** Four repairs were rejected
because each applied a cost the whole board obeys, and the dominant job is the
most robust thing on the board — so each removed its competitors first, twice
making the imbalance measurably worse. Taking that corollary literally,
`cooldownDays: 14` on `call_in_tribute` and on nothing else:

    over 36 careers          Tribute   paid tier-4   ratio
    shipped                    1,392           711    1.96
    a standing cost            1,495           214    5.19
    grooves on hand play       1,110           214    5.19
    a 14-day cooldown            429           664    0.65

Tribute falls 69% and its competitors do not follow — Port Operation rises 175
to 212. The ratio inverts, which is what the job table's own header says should
be true. `ladder.probe` green throughout, so nothing pre-committed was moved.

**The late-game flatline now has a permanent instrument, and no fix.**
`scorecard.probe` reports where the last new thing happened, beside the quiet
stretch it already measured — the two are different questions, and the old axis
could not tell a long silence in the middle from a career that had simply run
out. Measured after the tribute cooldown: **nothing was new after day 939 of
1,460, 36% of the career**, with 20 firsts and a longest quiet stretch of 375
days.

The cooldown moved three of the four axes and made this one slightly worse:

    axis          before   after
    Depth            8.1     8.6    9 kinds used -> 11
    Difficulty       5.1     6.5    65% ended early -> 48%
    Pacing           6.1     5.9    quiet stretch 316d -> 375d

More kinds tried, more careers surviving, and the gap between novelties longer.
That is coherent: forcing variety early exhausts the pool of firsts sooner, and
the pool is finite by construction — a job kind, a district, a rank, each
counted once. A career that has run everything it can reach has nothing left
that *can* be new.

So this is not a tuning fault and there is nothing to turn. It is a question
about how much game there is after the ladder ends, which is P2 and P3 of the
engagement brief — the dynasty chronicle, the crisis tier, scenario starts — and
it is recorded rather than guessed at.

**A caveat on how nearly this went wrong.** A purpose-built bot was written to
find the day the firsts stop, and it reported "nothing new after day 51, 94% of
the career flat, 6 job kinds, 1 district, peak funds $24,655". Every one of
those numbers is a fact about a bot that never left its home district and never
got rich, and none of them is about the game. It was discarded rather than
reported, and the reading above comes from `scorecard.probe`, whose bot reaches
three ranks and eleven job kinds.

**The heat-distance saturation** is a separate thing, and all three scorers
named its mechanism without knowing it: *"holding districts drops per-job heat to about
1"*, *"after day 140 nothing threatened me"*, *"nothing pushed back"*.

`HEAT_DISTANCE` already carried the exact question and the exact condition for
answering it — headcount is unconditional where seniority and a steward are
earned, *"a fair criticism of the shape rather than the size, and it is left
alone until there is a measurement that says the size was not the problem."*
Round 17 is that measurement. Decomposed across twelve careers:

    day                          30    60   120   180   240   299
    heat multiplier            0.43  0.31  0.31  0.31  0.31  0.31
      from the organization    1.18  2.50  2.50  2.50  2.50  2.50
         of which headcount    0.75  0.75  0.83  0.83  0.83  0.83

**The organization term reaches its cap on day 60 and is constant for the
remaining eighty per cent of the career.** Headcount is 0.83 of 2.5, so the size
repair could never have reached it. And the shape criticism is wrong too:
dropping headcount from the term entirely was tried and made it *worse*, capping
on day 30 instead of 60, because a senior man sent into a stewarded district
already exceeds 2.5 without any headcount at all. Reverted.

The fault is that the cap is reachable by ordinary play inside two months and
constant thereafter. Repairing it means moving `maxFromOrganization` or the
seniority curve, both of which move every baseline in `ladder.probe`. Recorded
against the constant rather than attempted as a fifth guess.

### One more, and one deliberately left alone

**The favour buttons.** Two scorers described one fault from opposite sides: the
hover on "Ask for work" advertised *"Money now, and 9 standing off them"* on a
button that would not press, directly above the row explaining why — and the
pair look identical while doing opposite things, one spending a favour and the
other spending a favour *and* nine standing to sell it for cash. A disabled
button promises nothing now, and the price is on the label. The reason stays in
body text, which is iteration 5's F10 and is not undone.

**The family at home.** One scorer clicked "Go home" once on day 26, was told
on day 163 that their last evening at home was 137 days ago, and concluded the
family was *"a lovely line attached to nothing… a family that cannot be
neglected at a price is set dressing."* They were wrong about the price and
right about the screen: `neglectRisk` multiplies the chance the player's own
people depose him, up to 1.9, and `homeRead` reported the days, the label and
the names and never mentioned it. Round 15 got a button on that panel because a
rising counter with no way to act on it is a demand with no answer; this is the
other half of the same fault, a counter that could be acted on and never said
why you would. It says so now, in words rather than as a multiplier, and only
once there is something to say — `neglectRisk` is flat at 1 until
`HOME.depositionFrom`, so a boss who goes home occasionally still reads nothing.

**The Businesses table's horizontal scroll**, reported by two scorers, is left
as it is, and now with a number. Measured in Chromium at 1600x1000 on a fresh
career: the panel's scroll width is 1477 against a client width of 1342 — **135px
over** — while `document.body` is 1600/1600, so the page itself does not scroll
sideways and only the wrap does. That is precisely the arrangement iteration 8
recorded as the decision, after finding the table already 49px over before the
column that appeared to have caused it.

So the decision is being honoured and the testers were still unhappy, which was
filed here as a question about which columns earn their place. Looked at
properly, it was neither.

Per-column widths at 1600x1000: **"Arrangement" was 1076px of a 1463px table** —
74% of the width — beside "Takes now" at 41, "At best" at 33 and "They walk" at
33. One cell was eating the table. `.name-cell` is `white-space: nowrap` because
a name broken over two lines reads as two people; the sub-line inside it
inherited that, and on this table the sub-line is a whole sentence of blurb, so
the column could only ever be as wide as the longest one.

Letting the sub-line wrap took the table to 790px, gave the crushed numeric
columns their width back — "Takes now" 41 to 72, "They walk" 33 to 72 — and put
all fourteen panels at zero overflow, from 135px on Businesses and zero
everywhere else before. Iteration 8's decision is untouched: it was made about a
pressure column, not about this.

### On method

The harness had to be rebuilt for this round: the documented one assumes a
browser pane, and these scorers had a shell, where every call is a new process
and a naive script closes the browser between commands. Chromium is launched
once on a debugging port and reconnected over CDP, so a career survives.

**Exercising it first caught a defect that would have been blamed on the game.**
The first `click` matched by substring, and "Start with $2,500" is a substring of
the Career card's own blurb — so asking for the start button pressed Career
again. `PLAYTEST.md` records four such faults in the original harness's first
hour; this is the fifth, and the rule holds: a harness nobody has run reports
whatever it happens to find.

One scorer lost six of seven attributes to their own tooling — all seven "Put a
point in" buttons carry identical text, so their click helper could only ever
reach the first. They said so plainly and marked those systems unscored, which
is the reproduction gate working.

---

## P2 and P3 — 2026-09-02

Five phases. Four were already finished and one was the fault.

**Phase 8, the dynasty chronicle, is complete between two views.**
`succession.line` renders the reigns and `chronicle.ts` renders the people;
`state.npcs` survives a handover — `removePlayer` marks the winner `boss` and
deletes nobody — so the chronicle carries across reigns and excludes only
predecessors, which the line covers. **Phase 10, player identity, was already on
screen during play**: `careerShape` and `legitimacy` are both on the Yourself
panel, not held back for the post-mortem. **Phase 12 was complete.** **Phase 11
is three scenario starts and extending it is content, not a system.**

**Phase 9 was the gap, and it is the session's usual shape.** Nine world
conditions with real effects across payouts, odds, heat, front revenue and rival
aggression — and every one of them arrived with one button:

    { id: 'acknowledge', label: 'Note it',
      hint: 'Nothing to decide. Only to work around' }

Honest about most weather and wrong about some of it. `WorldConditionDef.endEarly`
is now on the five a boss could actually reach — the crackdown, the dock strike,
federal interest, blood in the water, audit season — and absent on the four he
could not, because a recession is not bought off and a good summer does not want
ending. Priced through `payable`, so it is never clickable at a price the player
cannot cover, which `priced.test.ts` enforces across the catalogue. The spending
and the clearing live in `world.ts`, which is the only other place `conditionId`
is written.

**It does not move the flatline instrument, and will not.** The scorecard reads
byte-identical — 20 firsts, longest quiet stretch 375 days, nothing new after day
939 — because that bot answers every memo with its first choice, and the first
choice is still "Note it". This is a decision that exists only in front of a
person, and round 18 is the first time anyone will meet it.

The audit table this came from was wrong in one direction five times, and that
is recorded in `ENGAGEMENT_OVERHAUL_AUDIT.md`: an audit written from the outside
reads *"I cannot find the seam"* as *"the seam is not there"*. Six of the eight
phases needed a route, a direction or a view rather than a system.

---

## Round 18 — the first directed round — 2026-09-04

**One tester, told what to look for.** Three blind rounds had established that
the trade, the card game and executing your own man were never reached; round
17 reported all three unreached by three testers of three, each classified with
the four-way split. That measurement is spent. What was still unknown is
whether any of them is any good when you *do* use them, and only somebody told
to go and get them can say. DIRECTOR §4 now carries the shape and the one
condition that makes it legal: the under-use finding has to already be in the
log, and the round gives up discovery, First Hour, Pacing and coverage. Its
scores may never sit in a table beside a blind round's.

He reached all three and played to day 481.

### What the three are worth when used

| | verdict | the fault |
|---|---|---|
| The Trade | *"Yes, overwhelmingly — and for the wrong reason: it is underpriced in risk"* | ~90 days lost to a blockers panel naming a blocker the state contradicted |
| The card game | *"The cheapest legal defence in the game"* — judge favours at $2.5k a hand against $30k for a police contact | every decision-maker carried the identical tag, so a thrown night was unreadable |
| Executing your own | free, and he would do it again — but *"not a hard decision"* | 6-of-27 nights and 14-of-15 nights paid the same, as far as he could see |

### The headline, and how it had survived

He ran product through his own neighbourhood for 348 days at $101,099 a week
and reported its public feeling at 50 out of 100 — the value it started at. The
cost was in the config the whole time and could never have applied: a district
recovers 2.0 a week, and Downtown at dominance, saturated, carries 6.6 units,
which at -0.11 is 0.73. Every street in the city got *happier* while narcotics
ran through it.

**The guard that should have caught it is why it shipped.** `deep.test.ts`
asserted the trade costs a district its feeling and ticked only contraband —
never the territory tick that carries the recovery. It measured one side of a
race for a year and passed.

The first repair was flat -0.45 and was also wrong: a flat cost against a flat
recovery is still a race, just with the other winner. Thirty-six careers put
the median worst routed district at 1 out of 100 with 36 of 36 below the
hostile bar. The drain now scales by the room left above a floor, so each
district finds an equilibrium. Paired within each career, so jobs and standing
orders sit on both sides of the subtraction: **streets ran through 26, ground
held and left alone 49.** Income unchanged at a median $4.37M against $4.27M.

### What the round said about instruments

Three separate readings in this round could not attribute anything, and each
was fixed rather than quoted.

`ladder.probe` has run the trade 36 careers at a time since the trade existed
and **never once looked at what it did to the streets it ran through.** That is
why a number could sit wrong for the life of a feature. The first instrument
added here could not attribute either: "worst feeling on a routed street" read
a median of 1 both before *and* after an eightfold correction, because the bot
grinds jobs in the same districts. Only the paired reading measures the trade.

The tester's own instrument failed the same way. His MUST FIX said killing a
man you are sure about and one you are guessing at pay identically. The branch
is real — +14 respect against -10, -5 loyalty against -16 — and both of his men
were in fact talking, so he killed correctly twice and got the correct numbers
twice. **His premise was wrong and his finding underneath it was right:**
neither outcome was observable, because nothing tracked the record from the day
of the accusation and a quiet page looked exactly like a solved problem.

And his memo complaint. He reported being stopped every one to two days; the
instrument says one every 4.2 days, flat at every career stage and every family
size, out of 23 templates. What was exactly right was his next sentence — a
"+1 month" advance never delivered more than five days — because that is what
one-every-four-days does to an advance that halts on the first memo. Measured,
six careers past day 180 asking for thirty days: **2.8 days.** The repair was
never fewer memos. Answering one now no longer cancels the month, and only
`danger` ends the span — 2% of the queue, and the six memos that change your
situation. **27.2 days.**

### The one left standing

The apparatus. With a standing trade running, street heat settles at exactly
zero for any payroll of sixteen or more, and at 13.3 for a payroll of four:
trade throughput is capped by ground and the apparatus grows with the payroll,
so the largest families are the quietest and hiring is a way to make a standing
operation invisible.

A cap was built and measured, and it is not going in — but the reason changed
between the first reading and the second, and the first reading was mine.

Three settings against the full probe read 5 of 53 bars failing at 0.7, none at
0.9 and 3 at 0.95, with the weekly heat distribution barely moving across all
three. A weaker setting making the ladder worse is not physical, so I called
the instrument unable to size the change and backed the fix out.

**That was half right and the diagnosis was wrong.** Every one of those bars is
an unpaired count — 36 careers under one config against a fixed number — and
Boss inside 300 days runs at about one career in five, so the count carries
roughly two and a half careers of noise. The fault was in the reading, but not
because the effect was too small to see. It was because an unpaired count
cannot see it at all.

`sizing the apparatus cap` runs the same 36 seeds under each setting and pairs
each seed against itself, so a career that was never reaching Boss cannot vote:

    0.7    Boss 7/36 (off: 17/36)   12 seeds lost it, 2 gained
    0.9    Boss 8/36                12 lost, 3 gained
    0.95   Boss 6/36                12 lost, 1 gained
                                    weekly heat +10 · estate -500k to -640k

Twelve down and one to three up, at every setting. The effect is large,
consistent, and costs about a third of the Boss careers in a human-length
career. **And 0.9 "passing all 53" was a coin landing on its edge** — 8 of 36
against a bar of at least 8. I quoted a four-year population's Boss count
(27/36 to 29/36) as evidence that setting was safe, when the bar that failed is
the 300-day one; those are different populations and I conflated them.

So the fault stands, held open by a test whose assertions describe what the
game does today and go red the moment somebody changes it, and the dial ships
off in `APPARATUS_CAP`. What is now known is what closing it this way costs,
which is more than the fault is worth. An invisible standing operation is a
real defect; a third of the ladder is a bigger one. The next attempt has to
reach the heat without going through the apparatus every family is entitled to.

### And the repair that did land — 2026-09-05

The attention had to arrive somewhere the apparatus does not reach, and `money`
is not a workaround for that: it is the channel's own description. What the law
sees in a standing trade is not a body in a street, it is a great deal of cash
that cannot say where it came from. `TradeDef.heatChannel` is `money` for both
trades, no magnitude changed.

    the same 2.4 a week, sixteen hands
        into the street   settles at  0.0
        into the books    settles at 20.3

Paired over a hundred seeds, and read against the cap it replaces:

    the cap, 36 seeds     12 lost Boss, 2 gained · heat +10 · estate -500k
    the channel, 100      12 lost Boss, 5 gained · heat +3.8 · estate -44k

Seventeen seeds moved, twelve down and five up, which by this file's own
resolution rule **does not resolve** — the split is inside its own noise at
that sample, and it is recorded that way rather than quoted as an effect. What
is established is the size relative to the alternative: a quarter of the cap's
damage for most of its benefit, and all eight probe files pass.

The street's half of the price was never heat and is not now. It is
`sentimentPerUnit`, paid to the neighbourhood, and it is a different price paid
to a different party.
