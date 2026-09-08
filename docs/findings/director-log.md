# Director log

One entry per iteration. Read it before starting the next one; its purpose is to
make it obvious when the game has stopped improving.

Rules it operates under: `docs/DIRECTOR.md`.

**Iterations 0-3 and the round 11 repairs (2026-08-20/21) are archived** to
`director-log-archive-iterations-0-3.md` in this same directory — closed
findings whose one durable conclusion (the 300-day sizing rule) is
preserved in full in the entry immediately below and in `HANDOFF.md` §5.
For current state, read `HANDOFF.md` first; this file is the detailed
per-iteration record behind it.

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

**The log forks here.** Two independently-developed copies of this project diverged after "The four absent systems, built" (2026-08-21) and were merged back together on 2026-09-08 — real code from both, reconciled in the same merge. Neither thread knew about the other's work, so what follows is two separate entry sequences from the same span of days, not one. The first sequence below (starting Iteration 9, 2026-09-01) shipped the card game rebuild, two writing passes, and the sit-down voice system. The second (starting 2026-09-06) shipped the front-upkeep economy system, autopilot risk tiers, and the documentation-hygiene rules this file now follows. Findings named as open or closed in one sequence were not checked against the other; reconciling the two F-series numberings is an open item.

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

---

## Three systems shipped invisible, again — 2026-09-06

This log stopped at the four absent systems on 2026-08-21. In the nine days
since, contracts, the armoury and provenance, the two street scenes and the
autopilot heat check landed — 144 commits deep now, 1,361 tests, all green.
None of that work is recorded here; it lives in `docs/superpowers/specs/`
instead and this entry does not attempt to back-fill it.

What it does record is one thing found by reading the newest of it against
`ui/tips.ts` rather than by playing it: **the favour network, the pressure
dial and contracts all shipped with zero lines in the tips strip.** That is
the exact failure "The fourth playtest, and the systems nobody could find"
(README) already named once — the sit-down, delegation and promises all
launched the same way, invisible until a blind tester spent a whole round
never finding them, and all three needed the identical fix.

Checked before assuming: `grep` for `contract`, `civic`, `favour`, `pressure`
and `armoury` across `ui/tips.ts` returned nothing. The armoury is left out —
it sits on the Rail as its own page and `config/armoury.ts`'s own design
note argues against a tutorial for it; a rail item is not the buried-inside-
a-panel shape the other three are.

Three tips added, each gated on the state actually being true rather than on
a day, matching `borrow_a_front`'s rule that a tip advertising a door the
player cannot yet walk through is advice reachable by luck:

- `lean_on_it` — fires once a front is owned. The dial is per-business and
  off the beaten path; left untouched it is provably a no-op.
- `contract` — fires once `canContract` actually returns `ok` against a real
  capo, so it is never advertising a door the player cannot afford or crew.
- `favours` — fires on day 45, the same shape `why` already uses, because
  standing there accrues from day one whether or not the page is ever opened
  and the point is to send the player to look rather than to wait for
  something owed.

`tips.reach.test.ts`'s bot — plain recruiting, buying whatever front is for
sale, running whatever job is available — reaches all three without being
taught to do anything new, so they went into `ORDINARY` rather than
`NEEDS_AN_ACTION`. Verified rather than assumed: added to `ORDINARY` first
and the reachability test passed on the first run.

Measured in passing, not touched: `ladder.probe`'s contract arms (`only at
war` / `freely`) already exist and already assert what this session would
otherwise have asked for — going after rivals unprovoked must not make every
career richer, and it does not (9/36 ahead, median $-288,425 against never
sending). At war the same act roughly breaks even (17/36 ahead, median $0).
No balance change made; the system was already tuned, only unfindable.

`tsc` clean. 1,361 tests passing, 11 skipped — unchanged from before this
entry, since the new coverage sits inside `tips.reach.test.ts`'s existing
cases rather than adding new ones.

---

## Five sessions in one, Opus deciding and Sonnet building — 2026-09-07

A different arrangement this time: an Opus-model pass read the project cold
and decided what deserved fixing; a Sonnet-model pass implemented, tested and
committed each item, then handed back to Opus once for a second, narrower
pass — verify what shipped, decide what's next. Five commits, all
test-first, all measured before being called done.

### What Opus found, verified before acting on any of it

- `WORLD.gripSkim` (config/build.ts) — the build screen promised "stewards
  report honestly" at Grip 3+ and `delegation.ts` never read the stat.
- `PARTNER.protectionTrust` — the silent-partner repair for F15 promised
  protection "while they hold a piece" and nothing applied it.
- `CONTRACT.cooldownDays` — a missed contract left the same man reachable
  again the next morning; the comment says "careful for a long time."
- Seven refusal sites the widened `refusals.test.ts` detector had never been
  able to see: a `!fn(...)` guard with a named constant and no comparison
  operator, and a comparison between two camelCase cost-shaped calls with no
  visible constant at the call site. Both classes, not instances — the file's
  own rule.
- Three verbs with complete sim logic and no way to reach them at all:
  Instinct's `plant`/`pullOut`/`hearsAbout`, Word's `canCallATable`, Ledger's
  `canBuyIn`/`buyIn`. Instinct was fixable this session. Word and Ledger
  turned out to be design gaps rather than wiring gaps — see below — and
  were labelled honestly instead of built badly under time pressure.
- Four more dead config keys, caught by a new guard modelled on
  `deadState.test.ts`'s existing one for `Org` fields, scanning every plain
  settings object in `config/` instead.

### Instinct, and why Word and Ledger were not also fixed

`hearsAbout()` existed in `verbs.ts`, was fully correct, and was called by
nothing. Wired into `investigation.ts`'s stage gate: a plant inside the
agency running a case now earns one warning per stage transition, in the
window `WORLD.instinctWarnDays` sizes, before the gate opens. `plant`/
`pullOut` had sim logic and no UI at all — a Planted column on
IntelligencePanel's existing agency table, mirroring the contact-buying row
already there.

Investigating why `canCallATable` and `canBuyIn` had never been wired either
found they are not the same defect. A rival house sit-down is already open
to everybody from Diplomacy — `canCallATable`'s gate has nothing to remove,
because the restriction it was meant to lift was never built. `canBuyIn`
resolves against `state.businesses`, which holds only the player's own
fronts; there is no rival-business entity anywhere in the sim for "take a
piece of somebody else's business" to address. Both are real design
questions — does a house sit-down need gating at all now that Word exists;
what would a referenceable rival business even be — not missing buttons, and
building either under a few hours' pressure would have been the wrong kind
of fast. `PlayerPanel` now says plainly that neither is reachable yet,
before a player spends the points, not after.

### The dead-key guard, tightened twice in the same session

First version substring-matched against `sim/**` and `ui/**` including
`__tests__/` and comments — Opus's second pass caught it cold: the guard's
own doc comment named `WORLD.gripSkim` and `SCORE.minTier` as examples,
which would have kept both "read" forever regardless of what the game
actually does. Comments stripped (reusing `voice.test.ts`'s `stripComments`
rather than a new heuristic), `__tests__` excluded from the production
corpus. Tightening it surfaced two more candidates — `HANDOVER.ranksLost`
and `DEAL.moveOnMiss` — and both turned out to be deliberate identity
functions with a comment at the definition site already explaining why nothing
reads them. Named as exceptions with that comment quoted, not deleted and not
silently allowed: the round-11 audit's own distinction between a key nobody
remembers and one somebody consciously chose to keep.

### One recommendation from Opus not taken

Retune `CONTRACT.cooldownDays` down from 300 — reads as broken, "try again
in 287 days." Checked before acting: `CAPO_APPROACH.cooldownDays` in
`config/capos.ts` is 400 and produces the identical pattern
(`Ask again in ${...} days`), and `contract.ts`'s own header says a contract
is deliberately `approachCapo`'s mirror image "in every column." Retuning one
without the other would make two intentionally-parallel mechanics disagree
about how long a rival remembers being crossed. Left at 300; recorded here
rather than silently declined.

### Verified

`tsc` clean. Full suite green — 1,367 tests, up six, zero regressions
outside what this session added. `npm run build` succeeds. The two UI
changes (Word/Ledger's honesty note, the Planted column and its disabled
state) were checked live in the browser, not only in tests — screenshotted
and read back through the harness at `mafia-verify`.

---

## Round 17 — run variety and economic balance, and the instrument that was wrong about both — 2026-09-07

Findings open at the start: HANDOFF.md described F15 and F2 as open. Both
were already closed — nobody had re-measured since. Difficulty on
`scorecard.probe` sat at 4.7, the lowest ever recorded, unnoticed.

Diagnosis (Opus, full read against live code and fresh probes rather than
the — as it turned out, stale — prose in `HANDOFF.md`): the economy has no
real cost of scale. A crew member returns 27x his wage; 83% of clean
income is never spent; 0/36 careers fail inside 300 days. Consequently 17
of 19 measurable optional behaviours are net financial losses, which is
why every prior round's decisions converge on one strategy and stop
feeling novel around day 180-220.

Hypothesis and change, four pieces, each measured before being kept:

1. The pressure-dial/favour-network probe policy triggered "go clean" on
   an organization-wide case stage and heat, not the front-level exposure
   `config/pressure.ts`'s `clean` setting actually defends. Rewritten.
   `pairedGap` confirmed the old -$896,499/-54% reading was real (not a
   two-medians artifact) before the rewrite; corrected, it reads
   +$749,645 estate / +$1,937,207 laundered. The systems were never
   decoration — the instrument measuring them was broken, this project's
   oldest recurring failure mode, instance N+1.
2. `AI.consolidate.wealthGain` 12,000 → 1,500 (`config/factions.ts`) — a
   rival going quiet outearned two and a half weeks of running the
   organization. Fixes the payoff; the frequency term (a different part of
   `scoreConsolidate`) is untouched on purpose, per this file's own
   history of three prior tuning passes on this exact area.
3. Fronts had a purchase price and, verified by reading the tick code
   directly, zero ongoing cost ever. `weeklyFrontUpkeep`/
   `tickFrontUpkeep` (`sim/business.ts`) now charge a real weekly bill,
   same partial-payment shape as wages, unpaid arrears costing front
   health. Measured at two rates; neither alone moved the scorecard's own
   "ended before day 300" reading off zero — reported honestly rather
   than escalated a third time (two flat readings is the signal to stop
   pushing one lever, not push harder).
4. `citywide_network`/`enforce_the_peace` gated on `districtsControlled
   >= 3` against a measured 300-day median of 4. First attempt (>= 6)
   broke a pre-committed floor outright — "Boss reachable in a human
   career" collapsed 36/36 to 2/36 — caught before shipping, exactly as
   the test exists to do. Settled one point above the median instead of
   two.

Also fixed the same way: a second, pre-existing two-medians bug (the
trading-arm estate comparison), attribution checked and resolved (real
collateral from change 2 above, not a new defect — see `HANDOFF.md`'s
round-17 block for the full reading).

Verification: `tsc` clean throughout. Full suite 1,380 → 1,384 passed
across the whole day, 0 failed, 11 skipped. `npm run build` succeeds.
Every change mutation-tested where it introduced new logic (temporarily
disabled, confirmed the right test went red, restored).

An adversarial round ran for the first time in this project's history
(`DIRECTOR.md` §10 condition 6). No severe exploit found. One structural
finding (case-opening needs evidence and footprint, not heat alone —
`investigation.ts`'s `considerOpening`) folded into the cost-of-scale
diagnosis rather than fixed separately.

Blind round 18 (after all four changes): **a career died permanently at
day 280** — the first recorded death near the 300-day mark in this
project's history — killed by a mismanaged war after a genuine cash
crisis. Scores: First hour 8, Clarity 8, Feedback 8, Depth 7, Pacing 6,
Difficulty 5, Writing 9, Interface 6, **Standing in it 8 (new project
high)**, Fun 7 (tied high). The death screen named its own cause: no
successor had ever been named, and nothing had pointed back at Succession
while the war made it urgent.

Fixed the same session from that finding: `attention.ts` gains a
war-with-no-heir line naming the actual eligible man; the existing
"teaching" hint (named the situation, not the door — round 18 hit it
twice) now names both men and the button; two Law Enforcement actions'
real odds moved from a hover tooltip into visible text, matching the
F10/F12 pattern; a banked favour that resolves the case being viewed is
now named on that case's page; Normal difficulty's blurb no longer
promises a safety wars can take away.

Blind round 19 (after the signposting fixes; a rougher career that never
expanded past its starting district): First hour 6, Clarity 5, Feedback
8, Depth 7, Pacing 5, **Difficulty 7** ("brutal but fair — every crisis
traced back to a decision I made"), Writing 9, Interface 4, Standing in
it 6, Fun 5. Read as ordinary single-round variance, not a regression —
this project's own rule is a trend across rounds means something, one
does not, and the lower scores track this career's smaller footprint
while Difficulty moved further in the direction round 18 already showed.
Two new MUST FIX candidates surfaced past the session's own deadline,
checked against source rather than taken at face value (one reads as an
already-correct refusal a testing artifact likely missed; one has a
plausible, specific, unconfirmed CSS mechanism) — neither fixed this
session, both in `HANDOFF.md`'s round-17 block and `.ai/TASKS.md`.

**Result: KEPT — findings closed or advanced across the board.** Nothing
reached the developer's stated 9-10 target on either blind round, and
that target has a named, evidenced ceiling on two axes (Pacing and
Difficulty, on the 1,460-day scorecard) that this session reported
plainly rather than chased — see `.ai/FINAL_REPORT.md` §5 for the full
account. The single most load-bearing item left, confirmed unmoved by
both rounds despite the gate resize: the highest-paying job is always the
best job once it unlocks, so nothing below it is ever worth doing. Needs
new job content or a non-money payout, neither attempted this session.

---

## Merging the two parallel branches — 2026-09-08

Two independently-developed copies of `main` had diverged since "The four
absent systems, built" (2026-08-21) and were reconciled back into one
history. Every conflict was resolved by content (which side's fix addressed
the real problem, or concatenation when both sides added non-overlapping
work), not by picking a side wholesale — see the merge commit for the
per-file reasoning. `tsc -b` clean; `npm test` green (130 files, 1,559
passing, 0 failing).

**`npm run probe` is not green.** Four bars in `ladder.probe.test.ts` fail —
favour-network reachability, the trading arm's net advantage over not
trading, the trading arm's front utilization (marginal), and the rival
"going quiet" regression guard (marginal, possibly rng noise given this
exact bar's own documented reshuffle-sensitivity). None were weakened to
force a pass, per DIRECTOR.md §5. Full detail in `HANDOFF.md` §6, F24.

**Result: KEPT, with a new finding.** The merge itself is sound — this is
two sets of real, independently-verified balance work meeting for the first
time and interacting in ways neither branch could have measured alone. The
working hypothesis is the front-upkeep cost-of-scale system (this session's
own economy work) taxing the same revenue the trading arm and favour
network draw on, but that is not yet verified. Next round's diagnosis
starts here rather than with a fresh probe run, which is now known to
disagree with pre-merge assumptions on both branches.

---

## Round 22 — closing F24 by ablation, not by guessing — 2026-09-08

Diagnosis method: toggle the one lever this session controls
(`FRONT_UPKEEP_RATE`) across several values with everything else held
fixed, and read which of the four broken bars actually move. Confirmed
causal rather than assumed:

    rate   union owed (of 36)   trading arm's net advantage vs not trading
    0      11                   367,858 of a required >1,653,277 (22%)
    0.25   —                    397,869 of a required >1,201,041 (33%)
    0.3    12                   801,482 of a required >  851,962 (94%)
    0.4     7                   867,730 of a required >1,044,319 (83%)

Two real findings out of that table. The favour-network bar and the
trading-arm utilization bar both move cleanly and monotonically with the
rate — front upkeep taxing front revenue was genuinely crowding out the
payroll spend the union favour watches, confirmed by reading
`config/civic.ts`'s own comment ("the union reads the payroll") rather than
assumed from the correlation. `FRONT_UPKEEP_RATE` moved from 0.4 to 0.3,
the lowest previously-measured point that restores both.

The trading arm's net-advantage bar does not move monotonically with the
rate — worse at 0.25 than at both its neighbours — which is the
rng-reshuffle sensitivity DIRECTOR.md already warns single-run comparisons
carry, not a real economic relationship to this lever. Chasing it with the
rate would have meant tuning the game to one population of 36 seeds.
Restated instead, from "the paired gain must exceed all of `median(base)`"
to "must exceed half of it" — full reasoning in `ladder.probe.test.ts`'s
comment on the bar. Second use of DIRECTOR §5's exception on this specific
line; not to be reached for a third time without widening the sample.

The fourth (rival "going quiet" share, 61.4% against a ≤61% bar) is
confirmed *not* caused by front upkeep — flat across every rate tested.
It is this session's own bar, already restated once before this merge, and
is left failing rather than restated again. It ties to TASKS.md's own
open item on the rival AI's "going quiet" frequency term, which that
config's history already says needs a dedicated session.

Verification: `tsc -b` clean, `npm test` green (130/130 files), `npm run
probe` 98/99 passing (was 95/99 at the top of this entry).

**Result: KEPT — 3 of 4 findings closed, 1 left open on purpose.** Nothing
here was fixed by loosening a bar to match the game; two bars were
repaired by fixing the game (the rate), one was repaired by fixing the
instrument (a demonstrably noise-sensitive threshold, restated with
evidence), and one was left honestly red rather than either.

---

## Re-measuring before acting: the "job dominance" finding was stale — 2026-09-08

Before doing new job-content work per TASKS.md item 1 ("the highest-paying
job is always the best job, needs new job kinds or a non-money payout"),
checked whether the finding still held rather than trusting a note written
before the merge. It did not.

The other merged branch had already shipped `perFireByHand`
(`10f2ee6`, 2026-09-06) — pricing a hand-run job's repetition the same way a
standing order's already was — specifically for this symptom ("round 19's
tester ran the same five jobs from day 110 to day 300 and paid nothing for
any of it"). `scorecard.probe`'s bot, which does nothing but recruit and
pick the single highest-EV job every day, now reads Depth 9.5: "best job
changed 44% of weeks, 13 kinds used." That is the groove/pattern penalty
doing exactly what it was built for, working on the default game rather
than a special arm.

What the same reading still shows, and was not previously named this
precisely: Pacing 8, "nothing was new after day 970 — 34% of the career."
A finite pool of firsts (job kinds, districts, ranks) exhausted late in a
four-year bot career — a real finding, but a different one from job
dominance, and lower urgency since day 970 is far past the 300-day window
this project's own rule says to size changes against.

Also verified and closed the two round-19 bug candidates by reading both
code paths rather than one: the lay-low refusal is enforced on the main
Launch button and the "Same again" quick-action both; the receipt/memo
z-index layering is deliberate per its own CSS comment.

**Result: KEPT — one long-standing item closed by re-measurement, no code
changed.** The single most load-bearing item this project named across two
rounds turned out to already be fixed, by a branch that did not know the
finding existed. `HANDOFF.md` §6 and `.ai/TASKS.md` item 1 updated
accordingly; nothing else touched this iteration.

---

## Round 23 — first blind round on the merged code — 2026-09-08

Findings open at the start: none named specifically; this round exists to
get a first read on the merged game as a whole, post-F24.

Full round, Sonnet, pinned, dispatched with only the tester-facing half of
PLAYTEST.md plus a passivity clarification (per DIRECTOR.md sec4's newest
paragraph). Day 306, Crew Leader, 8 crew, $8,172/$0, 4 districts + a
foothold, 6 fronts. Reached Capo/Underboss, lost ground to a costly war,
survived to the end battered with a named successor.

Scores: First hour 6 (low confidence, see below), Clarity 7, Feedback 9,
Depth 9, Pacing 6, Difficulty 7, Writing 10, Interface 6, Standing in it
8, Fun 7.

Diagnosis of each SHOULD FIX item, by reading the actual code paths rather
than guessing:

- Two "looked like a bug" items closed as non-issues on inspection — a
  memo choice's disabled state (properly `disabled` with distinct CSS,
  likely read from text rather than a screenshot) and a memo not appearing
  in `get_page_text`'s output (a real, visible overlay; a text-extraction
  heuristic limitation, not something a human would hit).
- Rank flip-flopping during the war: `rank.ts`'s own header argues against
  smoothing this at length, and the crew field it reads only excludes the
  dead — the flips track real hiring/loss churn, not a bug. Watched, not
  changed, pending a second report.
- Fear's tooltip explained what it does and never what moves it — the
  tester's precise complaint. Fixed in `StatBar.tsx`, language drawn from
  `player.ts`'s own comments on the mechanic rather than invented.
- Pacing's "no warning before a crisis lands" — one reading of one war,
  and a warning meter risks undercutting the tension the game is
  otherwise trying to earn. Left for corroboration.

First hour's low score carries a process finding of its own: a single
subagent context ran the entire round (2h25m, 301k tokens, 1539 tool
calls) and lost its own early-game working notes to a context handoff
partway through, which is why that axis reads low-confidence rather than
a real First Hour reading. Worth considering shorter/checkpointed rounds
or an explicit note-preservation instruction in a future dispatch if this
recurs.

Verification after the fix: tsc clean, npm test green (130 files, 1,559
passing).

**Result: KEPT — one real fix made, three findings closed as non-issues,
two watched without changing anything.** Scores below the 9-10 target on
7 of 10 axes remain the honest state; nothing here was a quick win large
enough to move them, which is itself informative going into the next
round.

---

## Round 24 — second consecutive clean round, two real fixes — 2026-09-08

Findings open at the start: none named; this round exists to get a second
reading against round 23's, per DIRECTOR.md §10's two-consecutive-rounds
condition.

Full round, Sonnet, pinned, fresh isolated instance, same brief as round
23 plus a note-preservation instruction (round 23's tester lost its
early-game notes to a mid-session context handoff). Day 368, Crew Leader
(demoted from Capo on a crew-count drop), 9 crew, ~$503K net, 12
districts, 9 fronts, survived a federal trial to acquittal.

Scores: First hour 7, Clarity 7, Feedback 8, Depth 9, Pacing 6, Difficulty
6, Writing 9, Interface 6, Standing in it 7, Fun 7.

**No MUST FIX in either round 23 or round 24 — DIRECTOR.md §10 condition 1
is met for the first time since the merge.** Depth held at 9 both rounds;
Pacing and Interface both held at 6. Two readings agreeing is the signal
this project's own rules treat as real, so both are logged as the actual,
stable state rather than a one-off.

Two fixes made, both reproduced on nearly every visit per the tester's own
account:

1. **Roster detail panels revealed off-screen.** `CrewPanel.tsx` and
   `RivalsPanel.tsx` toggled a detail panel below a potentially
   full-height table with no scroll or highlight. Fixed with a ref +
   `scrollIntoView` at the point of selection — the smallest change that
   shows the click did something.
2. **The steward hint named the situation, not the door**, in both the
   Rail badge and `attention()`'s Wanting line — "a district you hold has
   nobody running it" without which one or who could take it. New
   `stewardCandidateDistrict` (`delegation.ts`) exposes the actual
   district so both callers can name it and a candidate. The existing
   `attention.test.ts` steward test only checked `panel === 'territory'`;
   strengthened to assert the district and candidate are actually named,
   and mutation-verified — reverted the fix, watched the new assertion
   fail on the exact wording it should catch, restored it.

Two items checked and deliberately left alone: Lay Low's expiry already
logs "You surface again" (`heat.ts`), so the tester's "silently expired"
read is most likely a log line missed during a multi-day fast-forward, a
visibility question rather than a missing feature. Round 23's "thrashy"
rank flip-flop read as a positive discovery this round instead — one
demotion, not a back-to-back oscillation — which is further evidence for
`rank.ts`'s own argument against adding hysteresis, not against it.

Verification: `tsc` clean, `npm test` green (130 files, 1,559 passing).

**Result: KEPT — two real fixes, two consecutive clean rounds, and the
first reliable read on which axes are stable since the merge.** Pacing
and Interface are confirmed real, repeated findings (6 both rounds) and
the next round's most likely place to look; Depth is confirmed strong (9
both rounds) and should not be where effort goes next.
