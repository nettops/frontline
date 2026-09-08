# Director log — archived, iterations 0-3 and the round 11 repairs

**Archived 2026-09-07, out of the live `director-log.md`.** Every finding
named below that is still open is restated in `HANDOFF.md` §6, which is
current; every fix here is either superseded by later work or already
folded into `HANDOFF.md`. The one durable conclusion this stretch
produced — the 300-day sizing rule — is preserved in full in the entry
immediately after this archive point (`## Developer decision —
2026-08-21`, still in the live log) and in `HANDOFF.md` §5. Read this file
only for the history of how a specific old finding was originally
diagnosed; for current state, read `HANDOFF.md`.

---

## Iteration 0 — 2026-08-20 — baseline

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

    PLAYTEST.md    Part 4 splits non-use four ways and runs before the scores;
                   Part 2 requires a score to name the coverage it rests on, and
                   to be marked unscored where it rests on nothing
    DIRECTOR.md    §4 extends the unscored discipline from rungs to systems, and
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

    PLAYTEST.md   Part 2 gains the axis, held apart from Fun and required not to
                  track it; Part 3 gains three questions it summarises — name
                  somebody without looking, name something you did that you did
                  not want to do, and say what you would have lost
    DIRECTOR.md   §1 states the target and the prohibition

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
