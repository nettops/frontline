<!--
Archived 2026-09-08. This is the full per-iteration record of the branch
that was merged into this project's main line on 2026-09-08 -- its own
independent continuation after "The four absent systems, built"
(2026-08-21), covering the engagement overhaul, the card game rebuild,
contracts, two writing passes, and the sit-down voice system.

The durable state this sequence produced is already captured, current,
in HANDOFF.md §0 ("Where this stands") and §6's F-numbered findings --
read there first. This file is the detailed per-iteration reasoning
behind those conclusions, kept for when a specific decision's "why"
is needed and not before.
-->

# Director log archive -- the merged branch's iterations 9 through round 21

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

**Tester model: Opus 5** — inherited from the dispatching session rather than
chosen, and recorded here after the fact. Rounds up to 16 are believed to have
run on Sonnet and none of them recorded it, so this is where the seam is. §4
pins the tester to Sonnet from round 19; these numbers are not comparable
across it in either direction.

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

**Tester model: Opus 5** — inherited, not chosen; see the note on round 17.

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

---

## Round 19 — 2026-09-05 — the first round on a pinned tester

**Tester model: Sonnet**, pinned per §4, one scorer, full round from nothing.
Not seeded: two of the five unmeasured changes were memo pacing and the trade's
blockers panel, which are pacing and signposting questions, and a seeded start
invalidates exactly those axes.

    day 31    Enforcer    · 4 crew  · $3.8K · 1 district  · 1 front
    day 130   Boss        · 22 crew · $106K · 4 districts · ~10 fronts
    day 300   Crime Lord  · 24 crew · $1.5M · 5 districts · 12 fronts

    First hour 8 · Clarity 8 · Feedback 9 · Depth 7 · Pacing 7
    Difficulty 7 · Writing 9 · Interface 8 · Standing in it 6 · Fun 7

Not comparable to rounds 17 or 18, which ran Opus 5 inherited rather than
chosen. This is the first entry on the far side of that seam.

### The instrument was wrong about the top of its own ladder

He reached Capo on day 72, Boss on 114 and **Crime Lord on day 147**, and named
the alliance he built through Diplomacy as the last unlock.

`ladder.probe` has reported `Crime Lord: 0/36` over four-year careers for the
life of the rung. `crime_lord` is the only rung whose `needs` include
`bestRivalTrust`, and the file's own note on `pull` says the bot *"never
approaches a family"* — so the bot was structurally incapable of it, and the
guard asserting the rung stays under 3 careers of 36 could not fail. It was
asserting that water is wet.

Every ladder figure in this log understates the top of the game by an unknown
amount and none of them said so. §5 already carried the rule that produced
this — *know what each instrument does not touch, and quote it accordingly* —
and it was not applied to the one reading that most looked like a design fact.
The bar stays, because it would bite if the rung were ever re-gated off rival
trust; it is now printed with what it cannot see.

### The round did not measure four of the five things it was run for

The honest result. Shipped unseen and still unseen: the trade's street price,
its attention channel, the card table's per-seat odds, and the blockers panel.

The trade he classified **wanted to, was blocked — then simply forgot**. He met
it on day 114 two fronts short, bought fronts over the following weeks for
unrelated reasons, and *"nothing on screen reminded me it had opened, so I never
went back."* So the blockers panel was never reached either, and the card game
he does not mention at all. Memo pacing he does not raise, which is weak
evidence that it stopped hurting and not a measurement of it.

One real negative result: the war log's start/stop churn, six dated occurrences
in round 18, is absent from a 300-day career.

### What it did find

**A rank that falls silently.** Two arrests took his crew from 24 to 22, the
Overview quietly read *Boss · Crime Lord wants 2 more bodies on the books*, and
nothing logged it — *"the log has no entry for the demotion at all, while it
logs everything else down to a single failed job."* Confirmed in code: `rankNow`
is derived from the same board the job table gates on, which is right and is why
it cannot drift out of step with what the player may do, and is also why it has
no moment of change to hang a message on. `announce.ts` is that moment, both
directions, and it carries the trade gate with it for the same reason.

Two more, unfixed and recorded: the *mystery opportunity* memos ask for money
against no description of the job — the one place a shown-odds number arrives
with no picture behind it — and dense purchase lists repeat "Go and see" across
ten rows distinguishable only by a narrow district column.

And the thing he was told rather than shown: decisions stopped changing at day
110–115, and days 150–300 were the same five-job rotation at bigger numbers.
The game itself agreed with his Standing-in-it 6 at the end — **Obeyed 43/100,
weakest of the four** — which is the score and the diagnosis arriving from two
directions at once.

---

## Round 20 — 2026-09-06 — the second pinned round

**Tester model: Sonnet**, one scorer, full round from nothing. Comparable to
round 19 and to nothing before it.

    day 30    Crew Leader · 6 crew  · $6.3K · 1 district  · 2 fronts
    day 154   Crew Leader · 7 crew  · $15.4K · 1 district · 2 fronts
    day 309   Underboss   · 17 crew · $43K   · 8 of 12    · 7 fronts

    First hour 8 · Clarity 9 · Feedback 8 · Depth 8 · Pacing 7
    Difficulty 8 · Writing 9 · Interface 8 · Standing in it 7 · Fun 7

### The announcement fix landed, in his words

`announce.ts` shipped between rounds 19 and 20 because 19's tester lost Crime
Lord to two arrests and was never told. Round 20, unprompted, on the same
mechanic:

> "Losing Capo rank when my crew count dropped below the maintenance threshold,
> then regaining it, was the single best feedback moment in the run — it proved
> ranks are a live state, not a one-time unlock."

It is also his WORKED #2. A fault reported in one round and named as the best
moment in the next is the cleanest result this loop has produced.

### The trade changed classification, which is the finding

Round 19 filed it **wanted to, was blocked — then forgot**. Round 20 files it
**understood it, judged it not worth the money**: *"retainer starts at $40,000
and I had $7K at the time; would have spent that instead on fronts, which I
did."* Which is what he did, and he reached Underboss.

§4 says a system understood and correctly ignored is not an oversight to be
surfaced better — the fix is the price or the system. So the price was measured
rather than argued. `ladder.probe` now reports both days:

    the trade appeared (2 fronts): median day 49
    opened a product arrangement:  median day 84
    the cheapest way in:           $40,000

**And the price is not changing, on the evidence.** Round 18's directed tester
paid the $40,000 and reported it repaid in three weeks and was *"worth it,
overwhelmingly"*. Round 20 spent the same money on fronts and reached Underboss.
Both lines work, which makes this a fork rather than a broken price, and tuning
it toward the tester who declined would be ignoring the one who paid and
profited.

What was actually wrong is already fixed and still unseen: until the blockers
work, the panel never named the retainer at all, so a player met the door 35 to
90 days before he could open it and was never told what it would cost. He now
learns the figure on the day it appears.

### What it found

**A button doing something and showing nothing.** "Call everybody in" clears
grievance, raises regard, writes a note on every man who spoke, and returns a
`Meeting` — who was heard, what each was carrying, and who did not come. The
panel called it for its side effects and discarded the return, so the whole
payload reached the player as one log line of counts. He pressed it twice,
found no cash change, no modal and nothing he recognised in the log, and filed
it as a no-op. It names who spoke and who stayed away now, and quantifies
nothing, because grievance is a hidden stat.

**And a heat reading he got backwards, which was still a fault.** He reported
Call In Tribute as an outlier at "+26 to +34 versus +2 to +12 for every other
job at similar crew size". Every job on the board fails at about twice what it
succeeds at and the figure scales with tier; tribute at 20/36 sits between
`financial_scheme` at 18/34 and `port_operation` at 22/40. He had compared a
tier-4 job against tier-0 and tier-1 jobs — *by crew size*, because the Heat
column gave him one number and the tier is not in it. The column showed only
what a success costs, on the screen where jobs are compared against each other.
It shows both now. The claim he got wrong is pinned in `heatShown.test.ts` so
nobody re-derives it from the report.

Unreproduced and recorded: the game returned to the title screen twice, both
times immediately after a batched answer-then-advance, never on demand
afterwards, and he could not rule out his own scripted input.

**Not reproduced, and the cause is still unknown.** What could be established
is the surface. `state` is one module-level variable, `setGame(null)` is the
only thing that clears it, and it has two callers: "Start again" on the
game-over screen, and "Back to title" on the saves panel. Anything that puts a
live family back on the title screen came through that button, and it went on
one click — the only mechanism in reach of a batched or mis-landed input. It
asks now.

The button also carried a false sentence: *"Anything not written to a slot is
lost."* Every advance autosaves and the title screen lists that slot under
Continue with the boss's name and the day on it, so a player who lost a career
to a stray click was told by the screen they had thrown it away while Continue
sat one click below. Third rule of the project. `abandon.test.ts` holds both,
and the whole-surface claim — if a third caller of `setGame(null)` ever
appears, the reasoning above stops covering it and that test is where it gets
noticed.

### Still unseen after three rounds

The card game. Round 18 was directed to it; 19 and 20 never reached it — the
better rooms want Respect 180 and round 20 finished on 110. Its per-seat odds
have shipped without a blind tester ever sitting down.

**That explanation was wrong, and it had been carried for two rounds.** The
gate was never the reason. The back room is `respectAbove: 0` at a $400 stake,
open on the first morning; the club is 85 and round 20 finished on 110, so two
of the three rooms were open to him. `ladder.probe` now reads the invitation
directly: 36 of 36 careers are ever shown the game, median first on **day 7**,
and the condition holds for a median of **234 days of 300**. Nobody was
blocked. The test above had been saying so for months, about the top room, and
was read as a fact about the top room.

What was actually broken is the queue. Six ordinary 300-day careers driving
`nextTip`/`markShown` exactly as `Coach` does: **five tips of twenty-eight ever
reached the screen**, THE LAW and the case tip alternating at the head from day
19 to the end, and eleven predicates true on the last day that had never been
shown once — `the_game`, `sitdown`, `trade`, `delegate`, `heir`, `rivals`,
`wages`, `leaks`, `why` among them.

That is round 11's "5 OF 25 SAID" verbatim, four rounds after `TIP_LINGER_DAYS`
was added to fix it. The linger did fix one tip starving the rest. It sat below
`if (tip.urgent) return tip`, so it never applied to the five that jump the
queue — and two of those five are `heat >= 35` and "a case is open", which are
the steady state of a working family rather than emergencies. Urgency jumps the
queue now; it does not own it. Same twelve days for everything, so a war still
takes the strip the day it breaks out and is not still doing it in six months.

After the change the same six careers show fourteen tips instead of five, and
every one of them is told about the card game between days 59 and 98.
`tips.starve.test.ts` holds both numbers, and holds the predicate-held count
beside them — without that second reading a career that simply never qualified
would pass as a career that was told.

**Which leaves the question the round has to answer.** Three testers were shown
the game — or would have been, from this week — and none sat down. Never knew
is now fixed and no longer the explanation for the next round. Whether the
remaining answer is *saw it and could not work it out* or *understood it and
judged it not worth the week* is not measurable from here, and the second one
is a design finding rather than a defect.

And his decisions stopped changing at day 245, against round 19's day 110.
Between the two rounds nothing was done about it; the groove change that prices
repetition landed after this round was dispatched, so both figures are from
before it and neither measures it.

**Now measured, on an instrument that had to be built first.** Every reading
the groove had was an estate or a rank — what repetition *cost*, never whether
anybody stopped repeating — and no bot in the file could have said, because
`ev` sorts on `baseSuccess`, a constant on the definition, and every arm works
whichever district the expansion loop settled on that morning. A decision
function that cannot see heat, a district or the groove cannot report on a
mechanic made of all three. That is the same blindness recorded under
`PATTERN.weight`, where a whole sweep came back identical to the digit.

So `readsOdds` sorts on the number the game puts on the screen and stands where
that number is best. Sixty paired seeds, groove against no groove, over each
career's last ninety days: distinct job-and-district pairs 21 to 42 (54 seeds
wider, 6 narrower), share of nights on its three busiest pairs 0.49 to 0.40 (45
down, 15 up). A career works twice as much of the board and leans nine points
less on its habits.

The day it *stops* finding anything new — the closest quantity to the sentence
both testers wrote — came back 286 against 294 out of 300 and is not a reading:
that arm re-picks a district every morning, so it never settles either way. It
is printed because somebody will otherwise go and measure it again.

And the size is an upper bound, not a forecast. It is what a player who reads
every number on every job gets. Round 19's tester was not that player, and
whether the price is legible enough to change a human's mind is the question a
blind round answers, not this file.


---

## Round 21 — dispatched 2026-09-06

Instance `round21`, storage `mafia:run-round21:*`, url `http://localhost:38987`.
Full round, one tester, from nothing, career on Normal, to Capo or day 300.
**Tester model: Sonnet, pinned.** Pre-flight: `tsc` clean, 1459 tests green
across 122 files, `npm run probe` running at dispatch.

Full rather than targeted, and from nothing rather than seeded, because two of
the three things being measured live in the climb: a seeded start voids First
hour, Pacing, signposting and every question of the form *would a player find
this*, and that is exactly what the tip-queue change moves.

### The hypotheses, written before the dispatch

Three changes have shipped since round 20 and each one names a finding that
should close. Recorded here so that keeping any of them afterwards is a
decision against a prediction rather than a reading of the report.

**H1 — the tips.** *If the queue stops being owned by two urgent tips, then the
finding "the card game was never reached" will not appear, because the game's
one unprompted mention of it now reaches the strip on day 59–98 of six careers
in six rather than never.* Closes if the tester sits down at a card table, or
reports the game as **understood it and judged it not worth the week** — that
third answer closes H1 as firmly as playing does, and opens a different
finding. Does not close if the report says **never knew it was there** again.

**H2 — the groove.** *If repetition on a job-and-district pair costs something,
then the finding "my decisions stopped changing at day 110 / day 245" will move
later or change shape, because a career that stands on the same corner is now
told it is being watched and is worth 19 points of odds to move.* Sixty paired
seeds say a bot that reads its odds works twice as much of the board. The bot
is not a player, and this is the hypothesis that reading cannot settle.

**H3 — the tips again, on their own terms.** *If the queue drains, then the
round will name systems it met through the strip rather than by accident.*
Fourteen tips of twenty-eight reach the screen in a 300-day career now, against
five. Round 11 reported "5 OF 25 SAID" and it was still true last week.

### What this round cannot answer

Whether the card game is *found* is a rate, and one career cannot report a rate.
A single tester missing it again tells us nothing about whether it is badly
signposted or invisible — that separation needs three, and three is an
escalation the developer signs off. Flagged before the result rather than after
it.

### The result

Day 311, Enforcer, 4 crew, $22,005 all in, one district, two fronts. Reached
Crew Leader twice and was demoted twice, both times to crew loyalty collapsing.
Never reached Capo. Scores: First hour 8, Clarity 8, Feedback 8, Depth 8,
Pacing 6, Difficulty 7, Writing 9, Interface 7, Standing in it 6, Fun 6.

**H1 — closed on its own terms, and it opened a better question.** He found the
card game. It is under **Not used → wanted to, was blocked**, which is the
fourth branch rather than the first: *never knew it was there* is gone after
three rounds of it. His stated reason is *"the card-game stakes I could afford
came with a standing requirement I never hit either"*, and that is wrong about
the game. Reproduced at his own end position — Respect 223, $1,500 clean and
$2,000 dirty:

    The back room on Prospect    stake    400   OPEN
    The Amaranth Club            stake  2,500   OPEN
    The room upstairs            stake 12,000   shut: $12,000 to sit, and you have $3,500

Two of the three rooms were open at the end and the back room was open on every
day of his run. So the true branch is the second — **saw it, could not work out
what it did** — and the mechanism is legible on the screen. On day one, the two
rooms that look worth an evening refuse with a respect bar, and the one room he
could always sit in advertises itself as *"Nobody here is anybody"* and *"Nobody
who decides anything"*. Both sentences are true and in voice. Together they tell
a player scanning the table that the open door has nothing behind it, and the
shut ones are what he came for. He generalised the bar he could see onto the
row he could use.

That is a design finding, not a defect, and it is left alone deliberately: the
fix is the price or the system, never a signpost, and choosing between them is
not a call to make off one career.

**H2 — did not close.** Decisions stopped changing at **day 190–200**, against
round 20's 245 and round 19's 110, and *"I was running the same three job types
from day 100 to day 300"* is the finding restated almost word for word. The
groove never appears anywhere in his report. Sixty paired seeds say it works on
a bot that reads its odds; this career says it did not reach a player who does
not. Not reverted, because the reading is real and the confound is large — he
finished at Enforcer with four men, half of round 20's career, and a family that
small rotates through fewer pairs whatever the price is. But it is not evidence
for the change, and the hypothesis is recorded as failed rather than as
inconclusive.

**H3 — held.** He credits the strip repeatedly and by day: the opening tip put
him at Operations on day 1, and *"Attention / Lay Low — day 24, pointed at by a
tutorial hint the moment heat first spiked"*. Systems met through the strip
rather than by accident, which is what the queue was fixed to do.

### The two he was right about

**The buy row's refusal was in a tooltip, for the fourth time.** Rounds 7, 11
and 12 each repaired this and each put the sentence somewhere other than the
row: a tooltip on Territory, then the panel header, then a paragraph in the
body gated on `!options.some((o) => o.check.ok)` — every row blocked. He held
one district that would not sell while two rows elsewhere on the map were live,
so that guard was false and nothing on the page said why. He found it by reading
the DOM. Confirmed in source: `check.reason` appeared exactly twice in the file,
once in that paragraph and once in a `title`. It is on the row now, the way
`CityPanel` has always done it, and the paragraph is gone because one sentence
twice on a screen reads as a bug.

**And going dark on money he did not have.** His diagnosis was that the lay-low
preview prices one week when the commitment spans two. It prices two — 
`perPayday * paydays + wagesOwed`, a repair an earlier round already paid for
and which the test now pins. What it never did was the subtraction. He read the
bill, went quiet, and came out on day 182 having missed $1,063 of payroll: two
soldiers quit that morning and Crew Leader went with them. The confirmation says
how short you are now. A fortnight of doing nothing is the one commitment in
this game where you cannot earn your way out of the gap you just agreed to.

Both in `refusalShown.test.ts`, both seen to fail with the fault put back.

### What he was wrong about, recorded so nobody re-derives it

The standing requirement on the card tables, above. And the lay-low preview
pricing a single week — the number was right and had been right since the round
that fixed it; the gap was that it never compared the number to his wallet.

### Not acted on

The proactive wage lever he asks for on the crew roster — grievance is a hidden
stat and a roster-side control that reads it would put a number on it. That is
rule 1, and the answer is probably the meeting, which he never used.


---

## The card game becomes a game — 2026-09-06

Director's call, after round 21 filed the whole system under *wanted to, was
blocked* while two of its three rooms were open to him. **The rooms are gone.
One table, every night, and you name the bet.**

The three tiers were doing two jobs badly. They gated on Respect, which round
21 had 223 of against a top room asking 180, and the one room open on the first
morning advertised itself as *"Nobody here is anybody"* and *"Nobody who
decides anything"*. A ladder whose bottom rung says there is nothing on it is a
ladder nobody climbs.

What replaces it: `ceiling(respect) = 500 x 2 ** (respect / 35)`, priced for
the year, so what the room will take off you grows with your name — $500 at
nothing, $2,300 at 85, $17,000 at 180, $42,000 at round 21's finishing respect
of 223. And **the share of what you could have put up decides who is sitting
opposite**: pocket money is a card game, and money that would hurt puts the
people who decide things at the table. The favour route is priced accordingly —
losing to a judge on purpose was $2,500 at a fixed table and is now most of
what you could lose.

### What the weekly clock had been holding up

It ran once every seven days and that cap was doing more work than anything
else in the file: 52 hands a year. Nightly is 365, so every per-hand constant
went up sevenfold on the same afternoon, and three of them mattered.

**The training was an outright exploit before it shipped.** `trainAttribute`
took a flat 1.2 street smarts a hand whatever was on the table, so 365 nights
at the two-hundred-dollar minimum was a free attribute. It scales with the
share of what you could have put up now — a night where nothing was at risk
teaches nothing.

**Suspicion was re-clocked rather than left.** `decayPerWeek: 4` is 0.57 a day,
which under a nightly game would have meant a nineteen-week lockout from one
bad fortnight — a punishment that takes the game away, which is round 13's
lay-low finding. `decayPerDay: 1.5` against `perHardHand: 8` balances at a
sharp hand every 5.3 days, so about one a week is sustainable for ever and
twice a week runs away to the cap. The cadence the old clock imposed is now the
cadence the player picks, which is the whole point.

**And the one that had to be measured to be found.** `CARDS.straight` gave 2
civic standing and 1 rival trust for sitting down at all, and straight play
loses about 1% of the stake — near enough free. Three hundred nights of that is
six hundred points of civic standing, which walks into `owedTotal: 2` on the
Boss gate. Paired over 36 seeds it took **Boss from 15 careers in 36 to 25**,
while holding *less* respect, *fewer* favour-weeks and $925,260 less estate.

An arm that burnt the same money every night and never sat down reached Boss in
**0 of 36**, so it was not the bot playing a smaller, safer career for want of
cash — DIRECTOR §5, and the reason that control exists. Re-clocked to 0.3 and
0.15 the arm reads 3/36. Putting just those two back to their weekly values,
with everything else corrected, reads **29/36** — which is how the note in
`config/cards.ts` is entitled to be as specific as it is.

    36 paired seeds, against the same careers not playing
    (control)                                              Boss 15/36
    hard       298 hands, 215 caught · estate   -712,747 · Boss  0/36
    straight   236 hands,   0 caught · estate   -837,847 · Boss  3/36
    burnt      191 hands,   0 caught · estate -1,270,220 · Boss  0/36

**The estate bar alone would have shipped it.** Both arms were hundreds of
thousands down while one of them was buying ten extra Boss careers. A money bar
cannot see a strategy that buys a rank with something other than money, and a
rank is what this game is played for. The condition now covers both.

### Two faults of my own, found by reading the instrument

**The curve was calibrated against the wrong axis of the right distribution.**
I sized it against `RESPECT_BARS` — 25 to 260 — read as the range a career
covers. That ladder is *the share of weeks spent at or above each bar*. Real
respect at the end of a four-year career runs 565 / 666 / 807, and at 666 an
uncapped curve offers a table of **$262,000,000**; the median 300-day career
was measured able to bet $1,049,203. That is precisely the trap recorded when
the three rooms were sized, repeated on the curve replacing them.
`ceilingCap: 1_200_000` sits just above the top of the approved table and clips
nothing inside it. Worth recording separately: the bot ends on three times the
respect a human tester does — 666 against round 21's 223 — and every figure
read off it should be read knowing that.

**And the bands inverted the design at the top of the game.** Dividing the bet
by the ceiling alone meant a boss whose name bought him a million-dollar table
and who held fifty thousand could never reach the serious band — the better he
did, the less anybody worth an evening would play him. The denominator is what
he could actually put up, which is what the room is reading anyway.

    what stopped a career betting more: its name 44% of weeks, its wallet 56%
    the biggest bet it could have made:      2,754 / 18,668 / 87,584
    somebody worth an evening opposite it:   90% of weeks
    could have sat down at all:              100% (the back room used to be 100%)

### The two pre-committed bars, restated

They were *the bottom room has to be open most of the time* and *the top room
has to be mostly shut*, and both passed on the build before this one. Neither
was about rooms. The first is **anybody can sit down**, which is now a question
about the floor and reads 100%. The second is **the good company has to be
earned**, which is now whether the ceiling actually moves across a career — a
curve whose end looks like its beginning is decoration in exactly the way three
identical rooms would have been. It ends at 2,098x the base, and 35 careers in
36 at least quadruple it.

Restated rather than dropped, with what they used to read printed beside what
they read now. The rooms went by decision, not because a bar failed.


---

## The writing pass — 2026-09-07

A full player-facing language audit, directed rather than found: the brief was
to remove cryptic, vague and generated-sounding language without sanding off the
voice. **What the audit actually found is that this game does not have the
problem it was asked to look for, and does have a structural one nobody had
named.**

### What was looked for and was not there

The brief listed the usual generated-prose tells — *"something has shifted"*,
*"tensions are rising"*, *"the streets are talking"*, *"only time will tell"*.
A rule per pattern, run over every player-facing string in 172 files:
**nine hits, and all nine were false positives** — *"The city is building
again. Cranes on the north side and nobody counting closely"*, *"Nobody in the
room is dressed better"*. Good concrete sentences that happened to contain the
word *city* or *room*. The rules were tightened until they had none, which is
the only state a prose linter is worth keeping in.

### What was there instead

**One structural fault, in five places, and it is not about sentences.** Where
the game varies a line, it picks from a list where some variants need data — a
name, a district — and some do not. The ones that need nothing are available on
every draw. The ones that name somebody are not. So the generic variant wins
almost every time and the specific writing, which is the good writing, is the
part the player never sees.

`scorecard.probe` had been measuring the consequence for months: 36% of
everything read across 48 careers was a line already read, with eight named
offenders. Every one of them turned out to be a data-free fallback in a list
that also contained better lines:

    crew.ts        3 of 6 recruit variants needed no name  -> all 6 name somebody
    operations.ts  3 of 8 job-outcome variants needed none -> street and crew named
    perception.ts  3 of 5 war headlines had no {where}     -> 11 headlines, 8 standalone
    faction.ts     1 fixed sentence per rival action       -> 4-5, naming a district
    possessions.ts 1 fixed sentence for every item ever    -> 5, naming the thing

**And the loudest line in the game was a status report.** `Attention on the
organization has risen: Major Investigation. (Enforce the Peace went wrong)` —
measured as the single loudest sentence-ending at 1.2% of everything read. It
named a meter, wrote like a department, and parked its one piece of real
information in brackets at the end. The tier descriptions in `tuning/heat.json`
were already the writing it needed — *"Someone has been assigned to you"* — and
had never been shown to anybody at the moment they became true.

    before  Attention on the organization has risen: Major Investigation.
            (Enforce the Peace went wrong)
    after   The truck hijacking went wrong. Somebody wrote your name down.
            A body turned up. Two of your men have been stopped and searched
            this week for nothing.

The first repair appended the static description to the cause, which was better
and introduced a smaller version of the same fault — seven fixed strings.
`scorecard.probe` measured *"Nothing more."* at **2.2%**, the loudest in the
game, within one run of shipping it. Each tier carries three observations now.

### Measured

    scorecard.probe, 48 careers        before   after
    lines already read                   36%      31%
    loudest single sentence               2%       1%
    days saying nothing new              16%      13%
    lines above 0.5% of everything    4 (0.9)  none

The distribution is the finding rather than the total. Some repetition in a
four-year daily log is correct — a payday should look like a payday. What was
wrong was one sentence dominating, and no sentence now clears 0.5%.

### What was deliberately not changed

**Public feeling and heat stay numbers where they gate something.**
`refusals.test.ts` requires every gate to name the figure it enforces, and
"Public feeling in Dockside is 27; nobody there sells below 30" is that rule
working. What was removed is the same number appearing in an *event body* with
a paragraph explaining what the number does — the panel has the bar, and an
event is for the thing that happened.

**The perception system is untouched.** Nothing about what the game hides
moved. `perceive()` has the same eleven call sites and fogs the same stats.

**No simulation, balance or probability changed.** Every edit is a string, with
two exceptions that are both text plumbing: `addHeat` composes its reason into
a sentence instead of a bracket, and the briefing reads `heatTier` to say which
tier was crossed.

### The instrument

`src/ui/__tests__/prose.test.ts` — the linter, in the gate, because the failure
mode of a prose rule is silence. The strings still render, the types still
check, and the game slowly goes back to sounding like a report. It carries a
guard on itself as well: a scanner that stopped matching would report zero
findings for ever, which is indistinguishable from success and is the mistake
this project calls an instrument reporting a fact about itself.

Seen to fail with an AI-slop line put back, on both the vague and portent rules.

### The one the guard caught on me

The gendered-pronoun test failed four times during this work. Every player-facing
line I wrote reached for *he* — *"He said he did not know"*, *"a name he had
never heard"*. The game deliberately never decides anybody's gender and has a
pre-committed test for it; without that test all four would have shipped.


### Character voice — the second half of the writing pass

The one objective the first pass did not deliver, and it needed reading rather
than rules: *a capo should not sound like a narrator, a nervous associate
should not sound like a philosopher.*

**The sit-down had no dialogue in it.** It is the system the design calls the
second verb — the one place where somebody is in the room with you — and the
man opposite never spoke. `says` is your line, `asks` is a question he puts to
you, and everything else came back as narration: *"They do not count it in
front of you, which is manners, and they do not put it away either, which is an
answer."* That is good writing and it belongs to the **register**, not to the
person, so a hot-headed enforcer and a calculating bookkeeper produced the same
sentence in the same cadence. One writer doing every part.

`config/voice.ts` gives all sixteen traits a voice, split by whether the move
landed, and `inHisVoice` puts his words over the narration. Same register, same
beat, three different men:

    Matteo Rizzo   loyalist   "I am not going anywhere, if that is what this
                              is about."
    Paolo Amato    brutal     "Talk is what got it this far."
    Rocco Falcone  greedy     "Everybody wants something from me for free
                              this month."

**Keyed on traits and not on stats, and that is the load-bearing choice.** The
obvious thing was to write the angry line off `loyalty` — he snaps because
loyalty is 22 — which is the hidden number leaking out dressed as character and
worse than printing it, because it looks like writing. A trait is *manner*: how
somebody talks is the most observable thing about them, you hear it the moment
they open their mouth, and it says nothing about where any figure sits.

Unread traits are preferred on purpose. A man whose sheet says nothing while he
talks like a gambler is the inference the whole system exists to sell.

Several of the lines are deliberately worse writing than the narration beside
them, because people are: they repeat themselves, start again, answer a
different question, say more than they meant to. *"Yeah, no, definitely.
Definitely. What was the first bit again?"* is a sloppy man and could not be
moved to any other trait, which is the test each line was written against.

**Two faults found by testing rather than by reading.** A loyalist said the
same sentence twice in one conversation, two beats apart, because keying on the
man and the register was not enough on its own — what he has already said is in
`beats` and is now checked rather than hoped for. And the first version of the
rule-1 guard asserted his words do not move when a hidden stat moves, put one
man at 5 and another at 95, and **failed correctly**: stats decide whether the
move lands, landing decides which half of the voice is drawn, and the player
watched the landing happen. The line following the outcome is not a leak, it is
the outcome. The guard now holds the real invariant — whatever he says belongs
to one of his own traits, in the half matching what the player just saw.

Four guards in `voice.test.ts`, three seen to fail with the fault put back: one
voice for everybody, a man repeating himself, and a trait shipping mute.


### The second sweep — 2026-09-07

Directed as an execution pass. What it found is the same structural fault as
the first, three more times, plus one class of writing the first pass had not
looked at.

**The event hints were where the simulation nouns had all gone.** The bodies in
`events.ts` are the strongest writing in the game — *"A car outside their place
two nights running. A conversation at their sister's restaurant that they did
not mention"* — and the choice hints under them, which is what a player reads
*before committing*, were the model's own vocabulary: `Buys real loyalty — and
gives them standing`, `Respect and fear. Attention comes with them`, `Ends it.
Attention, and the street remembers`. Thirty-one rewritten into what actually
happens.

    before  Costs you standing in the district
    after   The neighbourhood watches you pay somebody off

    before  Ends it. Attention, and the street remembers
    after   It ends tonight. Police come asking, and nobody on that street forgets

**A grammar bug had been shipping since the pronoun work**: *"Their
brother-in-law does not work for the city and has started saying they does."*

**And three fixed sentences that a real career showed within twelve log lines.**
The debt line fired *"They were very understanding about it"* four times in a
row while saying nothing about how close the player was to somebody being sent;
`loan.missed` and `graceMissed` were both in scope and neither was used. It
escalates now — pleasant, then *"said it was the last time they would be"*,
then *"Somebody will be sent."*

The wage line said *"Every one of them is further from you than they were"*,
which is `loyalty` going down, described. It names the man who stopped speaking
to you. And a case moving up a stage printed `City Police: Surveillance.` — a
file's own header, aimed at a person.

**I introduced the same fault twice more while fixing it.** Appending `That is
${agency.shortName}.` to the stage line put *"That is City Police."* at 1.5%
and *"That is Task Force."* at 1.2% — the two loudest sentence-endings in the
game — inside one run. A fixed tail is a fallback that wins every draw, the
same shape as a data-free variant, and it is now the third time this pass has
produced it. The agency went to the front, as the subject, where a different
agency makes a different sentence.

    scorecard.probe                    r21    pass 1   pass 2
    lines already read                 36%      31%      30%
    loudest single sentence             2%       1%       1%
    days saying nothing new            16%      13%      12%
    lines above 0.5% of everything   4 (0.9)    none     none
    loudest tail                      1.2%     1.1%     1.1%

Two rules added to `prose.test.ts` from patterns the first pass did not think
to look for: `unnamed`, a sentence whose subject is *something* — twelve of
them, most with a referent sitting unused — and `tic`, the one rhetorical move
this game reaches for with nothing after it. Both seen to fail with a line put
back. The deliberate cases are matched around: a bribe that goes unspoken is
supposed to say *"Nothing was said. Something was understood."*

One pre-existing test was updated rather than worked around: `report.test.ts`
matched `/waiting for an answer/` to identify which line it was checking. Its
condition — that a memo files under *today* — is untouched; the regex now
matches the new wording, and the change is noted in the test.
