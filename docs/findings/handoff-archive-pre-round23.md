# HANDOFF archive — everything before round 23 (the merge)

Cut from `docs/HANDOFF.md` §6 on 2026-09-08 evening, in the same
reconcile-and-trim pass that added rounds 23-26. This is the full build
history of the Mafia-boss systems (favour network, legitimacy, career
shapes, whispers, pressure dial, authority, personal life), the F1-F23
finding numbers as they stood through 2026-08-23, and the two 2026-08-23
repair write-ups (F22 the washing machine, F23 the wash cut) — all of it
pre-dating the 2026-09-08 branch merge and superseded by later work or
folded into `HANDOFF.md`'s current §6. Kept verbatim for anyone tracing a
specific old finding by name; `HANDOFF.md` itself carries forward only the
handful of threads from this material that are still genuinely open (see
its §6 intro paragraph above the round-23 entry).

By the time this was cut: §7a's four deliberately-failing tests
(`grok.probe`'s "actually played" bar, the back-half-supply bar, the
alderman-reachability bar, the scorecard axis-collapse guard) had all gone
green over the intervening two weeks of work — confirmed by the current
`npm run probe` reading of 96 passed / 3 skipped / 0 failed, where the 3
skips are unrelated pre-existing project-config skips. None of them needed
carrying forward as open findings.

---

### Reconciled 2026-09-07, round 17 (afternoon) — read this before the block below it

A full-day round, developer-commissioned to attack run variety and economic
balance specifically. Opus diagnosed against live code and fresh probe runs
rather than this file's own prose — which was the right call, because this
file was **materially wrong about the economy** by the time it was read.
Everything below is what changed; the block under this one (this morning's
reconciliation) is superseded wherever the two disagree.

**F15 and F2 are CLOSED, not "improved."** Verified by a fresh `ladder.probe`
run rather than assumed: 36/36 careers compound, median 10 fronts, first
front bought day 14, no career finishes flat. Somewhere in the last ~70
commits the front-gate fork this file spent a full section on stopped
existing. **Do not plan a session around F15 without re-measuring first** —
this is now the second time in two sessions this file described a game that
had already changed.

**HANDOFF §7a's four "deliberately failing" tests: three are green.** The
back-half-supply bar (0.3311 → now hovers at the bar, statistically
inconclusive either way — see below), the alderman-reachability bar
(35/36 → 15/36, passes), and the scorecard axis-collapse guard all resolve
now. Only the Pacing/`grok.probe` bar (59 vs ≥60) is still definitively red.
Nobody had re-run these and noticed.

**F13 (a refused memo option doesn't look refused) and F11 (the death
screen has no post-mortem) are BOTH ALREADY FIXED**, contradicting their
listing below and in this morning's reconciliation. Verified by reading the
actual components: `MemoModal.tsx` renders a blocked choice in
`.memo-choice-blocked` (red, ✕ prefix, `theme.css:1216`) with its own
explanatory comment describing exactly this fix; `App.tsx`'s game-over
screen renders `careerShape`, `postMortem()` and the full succession line
(`App.tsx:173-229`), also with a comment naming F11 as what it closed.
Neither fix was ever crossed off this file's list. **This is the pattern to
take away, not the two instances**: findings get fixed and this file does
not get told.

**F5 — improved again, honestly only a little.** `AI.consolidate.wealthGain`
12,000 → 1,500 (was already 12,000, down from an original 40,000).
Consolidate's share of rival-weeks moved 61% → 59%. Root cause found by
reading `scoreConsolidate`, not guessed: wealthGain never appears in the
score formula at all (`caution*heatPressure + alarmed + broke`), so it only
ever moved the *payoff* for going quiet, not the *frequency* of choosing it.
Frequency is the heat term, untouched this session on purpose — see
`config/factions.ts`'s own comment on `wealthGain` for the full reasoning
and TASKS.md for why a fourth pass on this file needs its own session.

**F20/F21 — the favour network and pressure dial were never decoration.
The instrument measuring them was broken, and once fixed they are the best
lever this session found.** `ladder.probe.test.ts`'s `active` bot policy
triggered "go clean" on an organization-wide case stage and heat, which is
not what `config/pressure.ts`'s `clean` setting defends (a front's own
exposure). Rewritten to react to `exposure > EXPOSURE_ALARMING_ABOVE`, per
front. Corrected `pairedGap` reading: **+$749,645 estate, +$1,937,207
laundered**, against the old (verified-real, not an artifact)
**-$896,499 / -$1,047,987** the broken policy produced. F20's "hard" gating
was not touched — the corrected policy simply uses the state the dial
actually protects against, and that alone was the whole fix.

**A new structural gap in the economy, found and partly closed: fronts had
a purchase price and no ongoing cost.** No weekly tick anywhere deducted
anything for owning a business — verified by reading `tickEconomy` and
`tickBusinesses` line by line, not inferred from a symptom. Rivals have had
the equivalent (`upkeepPerBusiness`, `upkeepPerDistrict`) since early in
the project; the player never did. `weeklyFrontUpkeep`/`tickFrontUpkeep`
(`sim/business.ts`) now charges 40% of a front's actual weekly revenue on
payday, same partial-payment shape as wages, unpaid arrears costing front
health. **Only a first slice**: at either rate tested (0.25, 0.4) the
scorecard's own "careers ended before day 300" reading stayed at 0/36 — the
standard measuring bot simply has enough buffer that front upkeep alone
does not threaten it that early. The 1,460-day Difficulty axis (see below)
moved the wrong way from this change and was partly offset by the job-gate
change that followed it. `ROLE_WAGE` (crew wages) and a player-side
district-holding cost — the two other halves of Opus's "cost of scale"
diagnosis — are untouched.

**The job table's two top-tier gates were resized, carefully, after the
first attempt broke a hard floor.** `citywide_network` and
`enforce_the_peace` both gated on `districtsControlled >= 3` against a
measured 300-day median of 4 — cleared with over a hundred days still on
the clock. Raising both to `>= 6` (citywide) / `>= 5` (enforce) collapsed
`ladder.probe`'s "Boss is out of reach in a human career" from 36/36 to
2/36 — `citywide_network`'s payout turned out to be load-bearing for
reaching that rank inside 300 days at all, a coupling the gate-only
diagnosis had not accounted for. **Caught by the pre-committed test exactly
as it exists to do.** Settled one point above the median (`>= 4` for both)
instead of two. Depth ~flat (8.2→8.1), Pacing 6.4→6.5, Difficulty 4.7→5.1 on
the 1,460-day scorecard axes.

**Difficulty is a release-blocking regression nobody had noticed, and this
session's own changes cut both ways on it.** `scorecard.probe`'s Difficulty
axis reads **4.7 at the start of this session** — the lowest ever measured,
and DIRECTOR.md §10 condition 4 ("no measured axis below 6") is failing
right now. Root arithmetic: 0/36 careers end inside 300 days, and 69-75% end
early over the full 1,460-day arc the axis is actually measured on — two
facts that look contradictory until you notice they describe different
windows. The `fairness` term wants `endedEarly` near 33%; the population was
already at 69% (too much attrition, on the *long* horizon) before this
session touched anything, so front upkeep's extra attrition made it worse
(69%→75% across two rate tests) while the job-gate resize's extra
rank-holding partly offset it back (75%→65%, axis 4.2→5.1 combined). **The
thing actually killing two careers in three over four years is still
unfound** — it long predates this session and is a separate, real,
longer-horizon finding, not something either of today's changes was aimed
at. Whether the 1,460-day axis is even the right instrument for a game
whose own §5 sizing rule says to size against the first 300 days is a
question for the developer, not a bar to keep chasing with more attrition.

**A second, unrelated two-medians bug found the same way as F20/F21's**:
"running both trades... leaves a family no better off" compared
`median(RUNS_TRADING)` against `median(RUNS_300)` directly — HANDOFF §3
rule 1's exact error. Converted to `pairedGap`; the corrected reading is a
per-seed gap of **-$12,651, indistinguishable from zero**, not the
"trading helps" the raw-medians comparison implied. **Attribution checked
and resolved**: reran the same paired assertion against factions.ts as it
stood before this session (`wealthGain: 12,000`) and it read **+219,304,
comfortably positive**. So the trade's own effect was genuinely positive
before today and the consolidate/wealthGain change reshuffled the shared
rng stream enough to flip a near-zero paired reading across the sign line —
real collateral from a kept, independently-justified change, not a new
defect in the trade economy and not evidence the wealthGain change was
wrong. **Left failing rather than restated a second time** (`pairedGap`
was this test's one allowed exception, per DIRECTOR.md §5) — the honest
fact is that this specific comparison is noise-dominated at 36 seeds
regardless of which side of zero it lands on, and the fix, if the developer
wants one, is the `resolves()` significance helper this file already
uses elsewhere for exactly this shape of claim, not another threshold
guess.

**An adversarial round ran for the first time in this project's history**
(`DIRECTOR.md` §10 condition 6). No severe, cleanly-reproducible exploit
found — double-submission, race conditions, save-scumming and
forced-payment bypass all held. One real structural finding, not acted on
this session: `considerOpening()` in `investigation.ts` gates a case on
heat **and** accumulated evidence **and** footprint — heat alone never
opens one, so a sufficiently successful (low-failure-rate) player can sit
at very high heat indefinitely with zero real law-enforcement consequence.
Plausibly by design (skill should reduce legal risk) but it is one more
contributor to the 0%-ended-early-by-day-300 reading above, and worth a
probe check (does `casesOpened` correlate with job failure rate rather than
heat?) once the cost-of-scale work continues.

**Not touched, not chased, deliberately:** the favour-network effects
remain pure negation (`bury_a_case`, `open_the_door`, `quiet_the_street`,
`lose_the_paperwork`) — this was on the table as an H2 follow-up before the
corrected dial-policy measurement showed the systems already earning
+$749,645; `config/civic.ts`'s own header states "a favour is spent on a
problem, not on a stat" as a deliberate design rule, so adding a
money-earning favour would reverse a documented decision for a problem the
corrected measurement no longer shows exists. `propose_alliance` (F17
remainder) is still open in 0/36 careers — the gate (`minRelationship: 20`)
was already lowered once from 40 and the quantity it watches has since
drifted *further* below it (peak standing now 3/3/14 at 40th/median/75th,
against 9/9/21 when the gate was set) — repeating "lower the bar again"
would be the third time on this exact quantity; HANDOFF's own F17 entry
already says the quantity needs fixing, not the bar, and that is still
correct and still undone.

### Round 17's two blind rounds, and what they closed

Two clean rounds ran after the changes above (a third, `round17` itself,
opened with a MUST FIX that turned out to be this session's own source
edits triggering the shared dev-server's hot-reload on the tester's tab —
not a game defect, see the git log's `4d7581f`/`4ae06b8` commit messages
for the timestamped proof; its First hour/Clarity/Interface scores were
discarded as contaminated and the rest were kept).

**Round 18: a career died permanently at day 280** — the first recorded
death near the 300-day mark in this project's blind-round history — killed
by a mismanaged war, after a genuine cash crisis. Scores: First hour 8,
Clarity 8, Feedback 8, Depth 7, Pacing 6, Difficulty 5, Writing 9,
Interface 6, **Standing in it 8 (a new project high)**, Fun 7 (tied
high). The death screen named its own cause — no successor had ever been
named, and nothing had ever pointed the tester back at Succession once the
war made it urgent.

**Fixed the same session, from that finding, test-first and
mutation-verified:**
- `attention.ts` gains a line: at war, with no heir named, naming the most
  senior eligible man by name and pointing at Succession.
- The existing "teaching" (crew-pairing/mentorship) hint named the
  situation ("your best man is free") and not the door — round 18 hit it
  twice and never found the button. Now names both men and the button.
- `LawPanel.tsx`: two actions (`destroyEvidence`, `pressureWitness`) had
  real, computable failure odds stated only in a hover tooltip. Now shown
  as visible text — the same F10/F12-shaped repair this project has made
  before. A banked favour that directly buries the case being viewed is
  now named on that case's own page (it previously sat unused for months
  in round 18's own career, found only by accident on the last day).
- Normal difficulty's blurb ("mistakes cost, but they do not end you")
  overpromised against a mechanic (war) none of the difficulty numbers
  touch. Rewritten to promise only what the numbers soften.

**Round 19 (a rougher career — never expanded past its starting district,
one expansion attempt crushed by rival pressure):** First hour 6, Clarity
5, Feedback 8, Depth 7, Pacing 5, **Difficulty 7** ("brutal but fair —
every crisis traced back to a decision I made"), Writing 9, Interface 4,
Standing in it 6, Fun 5. Read as ordinary single-round variance per
DIRECTOR.md's own rule (a trend across rounds means something, one round
does not) rather than a regression — the lower scores track this
particular career's smaller footprint, and Difficulty's rise is a
genuinely good, uncontaminated reading in the opposite direction from
round 18's.

**Two round-19 MUST FIX candidates — CLOSED 2026-09-08, both non-issues.**
- *"Lay low silently blocks a loud launch"* — confirmed correct on both
  launch paths, not just the one first checked: the main Launch button
  disables on `!check.ok` (`OperationsPanel.tsx:955`) and the "Same again"
  quick-action returns `null` entirely when the same check fails
  (`OperationsPanel.tsx:1098`), so there is no path a real click could take.
  Testing-harness artifact, not a defect.
- *"Event dialogs render visually overlapped"* — the receipt sitting above
  the memo backdrop (`theme.css:2517` vs `:1009`) is deliberate, per the
  CSS's own comment: it stays legible while a new memo can open behind it,
  and takes itself away on its own timer. The receipt is also the smallest
  surface in the game by design (no header, no buttons) and pinned to the
  top of the viewport while memos render centered, which limits how much
  real overlap is even geometrically possible. Not pursued further; revisit
  only if a future blind round reproduces actual illegible overlap.

**The "highest-paying job is always best" framing — CLOSED, stale.** True
against the pre-merge code; the *other* merged branch's `perFireByHand` fix
(`10f2ee6`, 2026-09-06, "make repetition cost something for a player who
never automates") already repaired exactly this, and re-measuring rather
than trusting the old note found it: `scorecard.probe`'s bot — which does
nothing but pick the highest-EV job every day — now reads **Depth 9.5,
"best job changed 44% of weeks, 13 kinds used."** Full reasoning moved to
`.ai/TASKS.md` item 1, which also names what's still actually open: a
late-game content flatline (nothing new after day 970 of a 1,460-day
career) that is a different, lower-urgency finding than the one this
paragraph used to describe.

### Reconciled 2026-09-07 — read this before trusting a status below

The two sessions logged in `director-log.md`'s last two entries touched
several of the findings below without this section being updated at the
time. Rather than silently edit forty scattered bullets under a time budget
and risk losing the nuance in each, here is what changed, and everything not
named here should still be read as this section states it.

**Closed or materially advanced:**

- **F1 — the loop closes.** Not closed, but round 16 (2026-09-07, to day
  305) is the first time this finding has moved: decisions held novel to
  roughly day 220-230, against three prior rounds all landing on day
  90-119. Cause not isolated — the round's own account names running out of
  new districts (~day 240) and finding the favour network only in its last
  moves, and both of those specific gaps were fixed the same session (the
  favour-network tip's queue priority, district-tier thresholds shown as
  numbers). Whether either alone accounts for the shift, or whether it is
  the accumulated 2026-08-21 through 09-07 work generally, is untested —
  the next blind round is the way to find out, and it is the standing
  recommendation in `.ai/FINAL_REPORT.md`.
- **F7 — every instrument plays the same narrow game.** Largely closed as a
  general complaint. `ladder.probe.test.ts` gained roughly thirty arms across
  the 2026-08-21 to 08-30 work (scores, training, autopilot, cuts, pieces,
  contracts, ground, books, leaning) that did not exist when F7 was written.
  What remains uninstrumented as of 2026-09-07: the rival-heat mechanism
  behind F5 specifically, and no arm exercises `askForWork` (civic.ts) even
  though `spendFavour` has one.
- **F16, F11, F22, F23** — already marked CLOSED / REPAIRED below and
  confirmed still true; no regression found.
- **Four dead config keys resolved 2026-09-07**, found by a new automated
  guard (`deadState.test.ts`'s config-object scan) rather than by manual
  audit: `WORLD.gripSkim` (wired — Grip's steward-honesty promise did
  nothing), `PARTNER.protectionTrust` (wired — F15's silent-partner repair
  promised protection nothing applied), `POACH.evidenceStrength` (wired to
  an existing hardcoded duplicate), `CONTRACT.cooldownDays` (wired — a
  missed contract had no cooldown at all). `AI.weights.
  declareWarMaxRelationship`, `SCORE.minTier`, `AGENDA.heatDecayPerWeek`/
  `heatAlarmAbove` deleted as superseded or duplicate. See
  `director-log.md`'s "Five sessions in one" entry for the reasoning on
  each.
- **Instinct, the single most expensive verb in the build table, did
  nothing at all below or above its threshold.** Not a numbered finding
  before 2026-09-07 because nobody had checked; `WORLD.instinctWarnDays`
  was the dead key that led to it. Now wired end-to-end — see the entry
  below, filed as a new finding rather than folded into the F-numbering
  since nothing above named it.

**New findings, 2026-09-07:**

- **Word and Ledger are not wiring gaps.** `canCallATable`'s gate protects a
  restriction that does not exist — a rival house sit-down is already open
  to everybody from Diplomacy regardless of the Word stat, so there is
  nothing for the verb to unlock. `canBuyIn`/`buyIn` resolve only against
  `state.businesses`, which holds the player's own fronts; there is no
  rival-business entity anywhere in the sim for "take a piece of somebody
  else's business" to address. Both need a developer decision — should a
  house sit-down actually be gated behind Word now that it exists; what
  would a referenceable rival business even be, and is it worth the state
  it would add — not a wiring fix. `PlayerPanel` says plainly that neither
  verb is reachable yet, so a player at least is not misled about it.
  Recorded here rather than assigned a number because the two questions are
  genuinely open, not diagnosed to a specific repair the way an F-number
  usually implies.

**Explicitly not touched, still exactly as stated below:** F2's remaining
open half (F17), F5, F6, F9, F12's blind-round confirmation, F13, F14, F15,
F18-F21 (civic/whispers), the informants.probe 29/30 guard. An adversarial
round (`DIRECTOR.md` §10 condition 6) has still never been run.

- **F10 — CLOSED by iteration 5, round 13.** Kept. See §4.

- **F14 — the back room is behind a door that does not look like a door. NEW,
  and the strongest candidate for iteration 6.** Round 12 found the sit-down on
  day 19 and called it the best-designed thing in the game. Round 13 did not find
  it until **day 300** and called it probably the best-designed system in the
  game. Same build, same system, 281 days apart in discovery, because the entry
  point is four plain buttons that *"look like a list of flavour buttons"* rather
  than the door to a three-exchange scene. This is F10's exact shape — a good
  thing nobody can see is there — and F10 is the one finding this project has
  actually closed.
- **F16 — `org.influence` was a stat the game showed and could not change.
  FIXED.** Initialised from `STARTING_INFLUENCE` (0) and never assigned
  anywhere else, while `PlayerPanel` rendered it as "Influence" on the Standing
  block — a few rows above the *attribute* of the same name, which is what every
  gate actually reads. Two numbers, one label, one screen, and the prominent one
  was a constant zero. Deleted along with `STARTING_INFLUENCE` and the row.
  `deadState.test.ts` now fails if any field on `Org` is declared and never
  assigned. **Second time dead state has shipped here** — see §8.

### The Mafia-boss systems — ALL FOUR BUILT, none measured by a round

The developer's vision named twelve layers. Nine already existed. All five that
did not now do, and none has been seen by a blind tester.

- **The favour network** — `config/civic.ts`, `sim/civic.ts`, a panel on The
  City. Four figures whose standing accrues from how the family is run and
  cannot be bought. See the entry below.
- **Legitimacy** — `sim/legacy.ts`. A derived reading like `estate`, not stored
  state: what you visibly own, whether the police are interested, whether the
  papers use your name, and whether the money on hand can be explained.
- **Career shapes** — eight endings read off what actually happened, with
  `unremarkable` at weight 0 as the floor that stops it being a horoscope. On
  the Player screen while alive and on the death screen at the end, **which
  closes F11.**
- **Whispers** — `config/whispers.ts`, `sim/whispers.ts`, a feed at the top of
  Intelligence. Confidence-rated claims generated from real state, **some of
  them false, and the read cannot say which.** Attacks round 14's MUST FIX 2:
  the supply is the simulation rather than an authored list.
- **How hard you lean on a front** — `config/pressure.ts`. One dial per
  business, three settings, feeding four systems that already existed. The
  default is the old behaviour in every term, so an existing save is untouched.

**All four verified in the live game**, not only in tests. ~~**None has a bot
that exercises it**, so every one is invisible to the probes — F7, four times
over~~ — **the probe now plays them; see F18 to F21 below.** Round 15 is still
what is owed: a probe can say whether a career meets a system, and only a
person can say whether meeting it was worth anything.

### Task 1 — the memos the simulation writes for itself

`src/config/eventgen.ts`, `src/sim/eventgen.ts`, `src/sim/memo.ts`, and a second
draw inside `tickEvents`. Six shapes — a man wants a word, two of your people
are not speaking, a front is going under, a street has turned, somebody outside
wants something, a file is moving — each instantiated against a real subject out
of the state. Verified live: *"A judge has a problem ... Standing with them is
22; they start owing you above 55"*, with the refusal reading **"You have
$1,750"** beside a hint still naming the $9,000.

**They do not share the authored pool's slot.** They were appended to
`EVENT_DEFS` first, which is tidy and was wrong: there is one memo a day, so
every generated memo cost an authored one, and `scorecard.probe` measured Pacing
falling from 3.8 to 2.4. Lowering their weights protected pacing and left the
generator supplying 15% of a career's late novelty. They now draw on a second,
smaller roll that only runs when the authored pool had nothing — which is
precisely the hole round 14 fell into.

**Four things this broke, all of them real and all now fixed:**

- **`plea_offer` and five other priced choices had a `disabledReason` and no
  `cost`.** The field exists so `MemoModal` can re-check at the moment of
  rendering; without it the memo quoted $30,000 to a boss holding $29,747 and
  stayed clickable. Pre-existing, surfaced by the extra spending pressure.
- **The grievance tip had become unreachable.** The memo fired at grievance 45
  and took the edge off, so nobody reached the tip's bar of 55. The memo now
  sits at 50 and hearing somebody out no longer moves grievance at all — and
  the tip came down to 45, because `tips.reach` measures the ceiling an active
  man actually reaches at 47 to 54 depending on nothing but the seed. **The bar
  was above what the game produces; the advice was reachable by luck.**
- **`approach.test` was committing the `advanceDays` trap** that `helpers.ts`
  documents in its own header, and comparing two worlds on heat that had decayed
  to zero in both. It now advances properly and compares the high-water mark.
- **A free answer that quietly ran a front at a quarter capacity forever.**
  "Run it clean for a while" wrote `b.pressure = 'clean'` and never wrote it
  back. The dial belongs to the player.

**Two things it cost, and neither was worth reverting for:**

- **`informants.probe` is one world short of its guard** — 29 of 30 rather than
  30 of 30. Confirmed caused by the generator: with `GEN_CHANCE_PER_DAY` at 0 it
  passes. The likely mechanism is `gen_paper_moving`, which gives a boss with no
  representation a way to retain counsel they never had, so in one world in
  thirty the case never advances and nobody is ever seen to talk. The guard
  asserts every world leaks. **Left failing rather than weakened** — it is
  somebody else's instrument and the developer should decide.
- **The generated half supplies about 30% of the new situations in a career's
  back half, against a pre-committed third.** Raising the rate from 0.07 to 0.11
  moved it by one point: the authored pool keeps producing new situations too,
  because the same memo about a different man counts for them exactly as it
  counts for these. **The bar stays where it was written.**

**And one scare that was not real.** At 36 seeds, careers reaching Capo fell
from 16 to 10 with the generator on, which reads as serious damage. At 96 seeds
it is 34/96 against 29/96 — inside one standard deviation, with the median Capo
arriving *sooner* (day 99 against 127). Determinism reshuffles everything after
the first divergent call; 36 careers was not enough sample to tell a five-point
shift from noise, and two hours went into chasing it.

### Tasks 2 to 5 of the Mafia-boss roadmap

**Task 2 — the front fork (F15) is a teaching problem, not an economy one.**
The probe reports the gate on a career's first front as **money in 98% of the
weeks it owns nothing**, and 27 of 36 careers finish flat holding one front.
What nobody had checked is that the game already answers it: `LENDERS[0]` is a
man at the back of a restaurant with a $40,000 ceiling, `minRespect: 0`,
`minBusinesses: 0`, reachable on the first morning. A probe arm that borrows to
reach a front moves careers past $100,000 from **9/36 to 14/36**, median fronts
from one to two, and **kills nobody** — careers ending early stayed at zero.
Seventeen loans across thirty-six careers was all it took, and the bot had to
be told to do it.

So the repair is visibility, not balance: a new `borrow_a_front` tip, and the
front-purchase refusal now names the figures. **It used to say "You cannot
cover the purchase." and stop** — no price, no balance, on the refusal that
gates the only tap between the dirty economy and the clean one.
`refusals.test.ts` walked past it because its detector wants a comparison
against a *named constant* and this one compares against a local.

**Task 3 — F17, measured and mostly opened.** Nothing had ever counted what a
player can actually press. The answer was: `declare_war`, 99% of weeks, and
almost nothing else.

      before                                     after
      sue_for_peace      0/36 careers            9/36
      offer_tribute     22/36                   22/36
      demand_tribute     2/36                   12/36
      propose_alliance   0/36                    3/36

Three separate causes, all of them bars set against distributions nobody had
plotted. The alliance wanted relationship 40 and $100,000 against a measured
9 / 20 / 22 and a median best estate of $28,870 — two walls stacked, both sized
for a career that has already succeeded. Rival respect for the player was
nearly a constant (29 / 29 / 31) because its target read only strength and
districts, both the war player's axis and both whole numbers; it now also reads
cases beaten and street standing, which widened it to 27 / 35 / 54. And the
settle rate of 1.4 a week meant twenty-one weeks to cross the bar, so a career
that took its fifth district on day 200 never arrived.

**F5 — improved, and the cause is arithmetic.** The families spent **69% of
all rival-weeks on `consolidate`** — going quiet — against 7% pressuring
anybody. Two repairs measured nothing and were reverted: the action weight
1 → 0.6 moved it to 68%, and `consolidate.heatReduction` 6 → 14 moved it to
69%. Neither was the term.

The term was money, and the mechanism is a hard gate rather than a score:
**`scoreExpand` and `scorePressure` both return zero outright when a family
cannot afford the action**, so a broke family has exactly one option. The
probe measured them short of the $25,000 a push costs in **49% of all
rival-weeks**, and `collectIncome` leaves them netting about $4,700 a week once
upkeep is paid — five weeks of saving per shove.

Two changes. The flat 0.45 "broke" bonus in `scoreConsolidate` is now
proportional to the shortfall, so a family a dollar short is no longer treated
as destitute. And `pressure.cost` came down from 25,000 to 20,000 — the price
of the one action the player actually feels, and the only figure in that
balance sheet that was safe to move: the upkeep was tuned against a measured
$137M-after-thirty-years problem and its own comment records what happens when
a family is left with nothing.

    consolidate  69% → 61%      pressure  7% → 9%      diplomacy  2% → 9%
    broke weeks  49% → 27%      careers where a family leaves Neutral  25 → 31

**It is improved, not closed.** 12,000 works better on the families —
consolidate 42%, pressure 18% — and `broke.probe` fails on it, because rivals
leaning on the player that hard compresses its three hiring policies into each
other. The four values measured are in the comment on `pressure.cost`. The next
hypothesis is the balance sheet itself, and it needs the developer, because the
last person to tune it left a comment saying why.

**And the rival fix costs the ladder.** `scorecard.probe`'s Pacing axis went
from 3.7 to 2.7 as pressure rose, for a plain reason: a world with active
rivals is harder to climb in, the bot's rank stalls earlier, and "firsts" in
that probe are ranks and first-time job kinds. That is the same finding as the
Capo pre-commit, measured from the other end. **Whether rival activity is worth
ladder speed is a question for a round, not for a probe.**

**Task 4 — Authority.** `config/authority.ts`, `sim/authority.ts`. A derived
reading like `estate` and `legitimacy`, never stored, over four terms: what the
crew think of you, whether they are afraid to test it, what they are carrying
against you, and whether your word has held. **One mechanical consumer**, and
it replaces the missing half of a term that already existed — a steward
deciding whether to skim asked what he was paid and what he was carrying, and
never asked whether anybody was counting. Measured: six worlds, forty weeks,
three districts each — **$0 skimmed under a boss who is obeyed against $3,554
under one who is not.**

**Task 5 — the Boss's personal life.** `config/personal.ts`,
`sim/personal.ts`. A home district, three people, and one number: neglect. Its
only consequence is that a boss who is never home is easier to depose, which is
`succession.ts`'s own description of the one way out of the chair that is
entirely the player's doing. The pull toward home arrives as a memo with a name
in it rather than as a bar to top up.

Three things it cost, all found and fixed:

- **The household is not made of `Npc`s**, and that was deliberate — an `Npc`
  gets assigned to jobs, paid a wage, and listed on the crew sheet, so reusing
  the type would have put the whole family on the payroll.
- **The memo was permanently eligible.** Every other generated shape needs a
  state that comes and goes; the house is always there. At the same weight as
  the rest it made the generated draw stop ever coming up empty and
  `scorecard.probe` put Pacing back under its floor at 2.2. Weight 2, cooldown
  30 days, and gated at the neglect where the penalty starts: 3.3.
- **"Carla, your son."** The name pool is deliberately mixed and the relation
  labels were not. `voice.test.ts` hunts gendered *pronouns* and these were
  nouns, so it walked past. The labels now say the relation rather than the
  person — "the one you married", "your youngest" — which is both correct and
  better writing, and `personal.test.ts` guards it.

### Round 15 — the first blind round since the Mafia-boss build

245 days, stopped deliberately at heat 100 under indictment. Scores: First hour
9, Clarity 8, Feedback 9, Depth 8, Pacing 7, Difficulty 8, **Writing 10**,
Interface 9, Fun 7 (their own split: 8 for the first ninety days, 4 after).

**Writing took a 10 for the first time.** So did the causal legibility: *"The
Why page is remarkable — a full decision ledger for the three AI families with
the utility scores of the options they rejected. I have not seen another
management game show its opponents' working."*

**Both MUST FIX items were confirmed in the code, and both are fixed.**

- **"Go dark" promised quiet work would continue and two screens said it would
  not.** The sim was right all along — `canLaunch` blocks only non-quiet
  approaches. The Overview said "No operations can be launched" and the
  Operations page said "Nothing can be launched until day N. That is the point
  of it." The tester chose it believing the option text, lost fourteen days of
  income, missed payroll, lost counsel, and never recovered. A third instance
  was then found in the heat tip: *"Laying low drops it fast and earns
  nothing."* All three fixed; the guard rewritten and proved red first.

- **Paying somebody off said "the matter is closed" and it was not.** The shape
  fires on grievance **or** low loyalty, and paying moved loyalty by seven — so
  a man at "looking for the door" was still there afterwards and the loyalty
  branch re-armed immediately. *"It turned the whole crew-management layer into
  a subscription. I stopped believing that anything I did for my people
  mattered."* Now: a sixty-day cooldown per person set before the branches, a
  payment large enough to clear the bar that raised the memo, and the memo no
  longer cites a grievance from another year — the tester was shown the same
  day-9 injury on days 45, 101, 174 and 226.

**The severest SHOULD FIX was the personal life, and it was mine.** *"For 230
days the game showed me a rising counter I had no way to act on. I assumed for
most of the run that I was missing a screen."* The only way home was a memo on
a weighted draw and it arrived on **day 233**. `config/personal.ts` had argued
against a button on the grounds that it would become a bar to top up; the round
showed that the alternative was a tax with a name on it. There is now a control
on Yourself with a seven-day cooldown that names its own bar.

**Also fixed, all verified in the code first:** the favour panel rendered above
The City's own page heading, so the page began mid-thought — mine, from PR #5.
And the Influence blurb now says how Influence is earned, which is the fourth
round to circle that.

**Could not reproduce: the succession rank mismatch.** *"With Enzo Adderly
named and clearly listed as Soldier, the handover box read 'They start as
Enforcer'."* `inheritRank` reads the **player's** rank, not the heir's crew
role — Crew Leader minus `HANDOVER.ranksLost` is Enforcer, and the player was
Crew Leader at both observations. The number was right both times. The label is
what is wrong, and it is a copy fix rather than a defect.

**And the finding the round was run to settle is not settled.** The tester's
decisions stopped changing around **day 100**, which is the same place F1 has
reported since round 7 — the rival work did not move it. They never noticed the
families doing anything, because they shared ground with nobody. They found the
lender only in desperation on day 139, after the tip's own condition had been
true for weeks. **An active city did not buy a better middle game**, and the
slower ladder was not the reason: they reached Crew Leader on day 52 and then
stalled on capital, not on rank.

### Task 6 — the day has a shape

`ui/report.ts`, `ui/Bulletin.tsx`. **No simulation change**, which was the whole
design: the clock already runs in this order and always has — the night
resolves, the desk fills, and what is left is the part of a boss's life that is
not the business. What was missing was anywhere the player could feel it.

The briefing was one undifferentiated list in which a man dying overnight, a
memo still waiting for an answer, and your family asking after you were the
same kind of line. It now groups into three parts, and prints a heading only
where there is something under it — most mornings have one part, and a heading
over the only thing on the page is furniture.

    WHILE YOU WERE NOT LOOKING   Down $150 over 4 days.
    WAITING ON YOU               Something is waiting for an answer.
    THIS EVENING                 Nobody at home has said anything. It has been 23 days.

**This is why the roadmap put day-parts after the personal life rather than
before it.** An evening with nothing in it is worse than no evening, and the
house is the only thing that goes there.

Its own test caught the obvious failure mode on the first run: a boss who had a
completely uneventful week was handed a briefing whose single line was that
nobody at home had seen him. That is a nag with a heading on it. The quiet
version now only ever rides along with real news; the loud one — once being
away is actually costing him — is allowed to stand alone.

### The two Mafia-boss pre-commits, and how they were met

Both were written during the build, both failed, and neither was moved.

**The generated half now supplies 35% of a career's late situations**, against
a pre-committed third. It got there by doing more of the thing the bar
measures rather than by lowering it: three more shapes, each needing a state
that comes and goes — somebody of yours in a cell, a steward whose district is
earning more than it hands over, and a name the whisper feed has now brought
you twice. That last one is the only place in the game that reads a
corroborated whisper and asks the player to decide about it, and it still does
not say whether the whisper is true.

Ten shapes rather than seven also **improved Pacing** in the four-year probe
rather than costing it — 3.1 to 3.7 — because the generated half only draws on
days the authored pool has nothing, and more shapes means fewer of those days
come up empty.

**A door is open to a career that is not at war in 19 careers of 36**, against
a pre-committed half. `demandRespect` came to the median of the measured
distribution rather than the 75th, for the reason the police captain's bar did:
it is the only door a peaceful career has. The alliance price came down twice
more, because the measurement kept saying the money was still the binding gate
— standing is bought by paying tribute, and tribute cost almost exactly what
the alliance did, so the two conditions were being bought out of the same pot
and never held at once.

### F18 to F21 — the first measurement of the Mafia-boss systems

`ladder.probe.test.ts` gained two things: a weekly read of all five systems
against the population that already existed, and a second population of 36
careers on the same seeds whose bot actually spends favours and turns the dial.
The read is derivation-only — `readWhispers`, `civicRead`, `legitimacy` and
`careerShape` never touch `rng`, which is now asserted by its own test and was
confirmed by running the probe either side of the change: **every ladder number
is identical.**

- **Whispers work.** 36/36 careers hear something, median 13 distinct claims
  over 300 days, something on the desk in 98% of weeks, mean stated confidence
  63%. The one system of the five that measured healthy on its first contact
  with an instrument.

- **F18 — two of the four civic figures were misconfigured against quantities
  nobody had measured. FIXED.**

      before                                    after
      captain   owed in 30/36                   30/36
      union     owed in 14/36                   14/36
      judge     owed in 36/36  ← a fixture      15/36
      alderman  owed in  0/36  ← dead content   21/36

  The judge watched `100 - notoriety`, and **peak notoriety across a 300-day
  career is 3** — so the reading was 97 every week of every game and the figure
  owed the entire population regardless of play. It now also reads the strongest
  live case against you, weighted by `CIVIC.discretionCaseWeight`, which is a
  number that actually moves.

  The alderman's bar was 60 against a mean public feeling of **38**, best week
  46. Not demanding — outside the range of the quantity it was set against.
  Now 45.

- **F19 — "The Legitimate Boss" was the verdict on 61% of careers. FIXED.**
  `legitimateAbove` was 55; measured legitimacy runs 63 / 66 / 73 across the
  population, so the bar sat *below the median career*. Raised to 72, just under
  the 75th. Shapes went from five names with 22/36 on one, to six names with
  13/36 on the largest. **This is the horoscope failure `config/legacy.ts` has a
  test against, arriving at a level no single-career test could see.**

- **F20 — the pressure dial's two off-centre settings are close to mutually
  exclusive.** Across 1,498 career-weeks the active bot asked for `clean` 915
  times, `normal` 554, and `hard` **29**. Wanting to wash hard requires dirty
  money backing up, and having dirty money means heat — so the setting that
  moves the most money is gated behind a state the game rarely lets you be in.
  Not yet fixed; it is a balance question and it needs the round.

- **F21 — using the two operable systems is close to free, and close to
  worthless.** Same seeds, same bot, plus favours and the dial:

      estate       32,978 → 33,017
      heat-weeks    2,571 →  2,337   (-9%)
      laundered    37,557 → 22,235   (-41%)
      legitimacy       66 →     61

  296 favours spent and 235 dial turns bought a 9% reduction in heat for 41% of
  the laundering and no change in the estate. **A system a competent player can
  use all game for no net result is decoration**, and this is the first number
  anybody has had on it.

- **Instance 26 of §3, self-caught before it was reported.** The first version
  of the civic readout printed the *maximum* standing over the four figures and
  reported 99 for every career, which reads as "the network saturates". It
  established only that one of the four got there — and the four were in
  opposite states, one unreachable and one universal. A max over a population is
  not a measurement of that population.

- **The favour network — FIRST SLICE BUILT, unmeasured.** `config/civic.ts`,
  `sim/civic.ts`, and a panel at the top of The City. Four figures — a police
  captain, a union boss, a judge, somebody in office — each watching one
  quantity the simulation already keeps, each owing favours you spend on a
  problem rather than on a stat.

  **It generalises two existing one-offs rather than sitting beside them.**
  `PATRON` was an anonymous 90-day timer for $120,000; the alderman is that
  arrangement with a relationship in front of it. The `contactCost` agencies
  were booleans you bought; standing here accumulates from how the family is
  run and cannot be purchased at all.

  **The reachability property is the point and it is asserted:** thirteen quiet
  weeks put a police captain over the bar, so the network opens inside the 300
  days a person plays. Round 14 on the old system: *"the system I most wanted
  and it is priced for a run that has already succeeded."*

  The union favour lifts a district's public feeling over
  `SENTIMENT_HOSTILE_BELOW`, which points it straight at F10, F12 and F15 — a
  district under the bar sells no fronts, and fronts are the fork the whole
  economy turns on.

  **Verified live to day 112:** standing accrues from play (a quiet career had a
  captain owing 2), every refusal names its own bar in body text, and a favour
  that cannot land says why instead of doing nothing. A successful bury is
  asserted in `civic.test.ts` rather than watched — that career never drew a
  case.

  **Not yet done:** no bot exercises it, so it is invisible to every probe
  (F7). No blind round has seen it.

- **F15 — the economy is bimodal and it forks on fronts. NEW, and it now
  outranks the rest of this list.** At day 300, twenty-five careers of thirty-six
  end under $48,000 and eleven end between $134,000 and $2,827,000, with almost
  nothing in between. The flat twenty-five hold a **median of one front**; the
  compounding eleven hold **seven**. Front income is paid into holdings
  (`business.ts:579`), which compound at 0.45%/week, so a family that never gets
  a second front never starts. **The money rung, and therefore the whole top of
  the rank table, is downstream of the front gate.** Printed by
  `ladder.probe.test.ts`, not asserted.
- **F12 — nothing teaches the public-feeling coupling before you hit it.
  ADDRESSED by iteration 8, unmeasured.** The refusal explains itself now; the game still never says
  in advance that working a district burns its feeling and that feeling gates
  fronts there. Round 13's named blocker on First hour.
- **F13 — a refused memo option does not look refused. NEW.** The reason renders
  as the option's hint line, reading as description rather than refusal; round 13
  clicked a disabled "Buy it" and nothing happened. SHOULD FIX.
- **F1 — the loop closes.** Decisions stop changing around day 90–119. Round 12
  suggests F1 is downstream of F10: the loop did not close, it never opened.
- **F2 — Influence never reaches a player in 300 days. Three separate causes
  now found; two fixed, the rate itself still open.** The supply is not merely
  low, it is a wall with a hole in it, and neither half was where the earlier
  diagnoses looked.

  1. **`tickEconomy` skipped the retainer entirely when nobody was payable.**
     The function opened with a payroll guard and the legal block sat below it,
     so a boss whose crew were all in a cell stopped paying the firm and
     stopped accruing the one route the game advertises. That is the exact
     position a player who has bothered to retain counsel is in — round 14 had
     five of six men in custody on day 153 with a lawyer on the books. **Fixed**;
     the ladder probe went from *18 weeks a career on retainer* to **83**.
  2. **The approach credit had no cooldown.** `demand_tribute` costs nothing and
     `doDiplomacy` paid `INFLUENCE_FROM.approach` per call. Twenty demands in one
     afternoon were credited **10.7 times over**, on the attribute the game
     presents as the hard one to train. **Fixed** with a 14-day per-family
     cooldown on the credit, not on the action.
  3. **The rate. FIXED, against a pre-committed target.** `counselPerWeek`
     0.12 → **2.4**, sized on the 300-day window per §5. Measured over 36
     careers, influence at day 300 as 40th / median / 75th:

         0.12   0 / 0 / 3     the reported state
         1.2    2 / 3 / 6
         2.4    4 / 5 / 9     shipped

     The target was written into `ladder.probe` *before* the number was
     touched: a median of 4 to 8, so the median career opens a task-force
     contact and city hall stays something to work for. The top quartile does
     reach 9, which is a distribution rather than a guarantee.

  **F7 is closed for this vertical, and what it found is worse than a gap.**
  The probe's bot now approaches a family every week — the first instrument in
  this project ever to do so. **Every approach is refused, all 300 days, in the
  same sentence**: *"you lead them by -72 strength and would need 15 — or 55
  standing with them, against 29."* The paid courtesy wants $25,000 spare in an
  economy money-blocked in 97% of idle weeks.

  **So both diplomatic doors are shut and `counselPerWeek` is carrying a
  vertical it should be sharing.** The consequence is backwards: a boss who is
  never investigated keeps no lawyer and earns no political pull at all. That
  is **F17**, and it is downstream of F5 — the player runs 40 to 80 strength
  behind every rival for the whole game.

- **F2 (historical) — the round 12 diagnosis was wrong.** That entry blamed the faucet: accrual comes from a
  *paid* counsel retainer, and round 12 cancelled counsel on day 84. **Round 13
  kept counsel, including the top tier at $5,863/wk, and still finished at
  Influence 0.** So the rate is the defect, not the closed tap. It costs the
  player the entire city-hall vertical and the two better informants — round 13:
  *"a whole vertical of the game was invisible to me for 300 days because of one
  attribute I had no idea how to train."* **Four rounds, never above 2.**
- **F11 — the death screen has no post-mortem.** 495 bytes and one button. No
  rank, no net worth, no roster, no week it turned. The moment the player most
  needs to be shown what he missed shows him the least.
- **F6 — the Pacing axis measures the probe, not the game.** It counts firsts
  against longest quiet stretch, so a longer career scores worse for the same
  amount of new happening. **It penalises survival.**
- **F7 — every instrument in this project plays the same narrow game.** No bot
  lays low, buys a contact, retains counsel deliberately, or approaches a
  family. **Round 12 confirmed the consequence from the outside**: the tester
  understood police contacts, priced them against a front, and correctly
  declined five times. That is a finding about the price, not about
  discoverability.
- **F9 — fear held near the ceiling quietly strangles the crew.** Downstream of
  F8. Never exercised by any instrument.

**F5 — CONFIRMED, no longer unresolved.** Round 13: *"the rival families never
attacked me after day 76 — three houses with strength 84, 100 and 100 against my
~20 stayed Neutral for 224 days."* Three rounds deep now. The rival-heat probe is
still owed before anything is changed, but the inertness itself is not in doubt.

**F8 is fixed but unmeasured, three rounds running.** Round 13 had three cases
open and two dropped, and was never convicted. **F11 is also untested — round 13
never died, so nobody has yet seen the death screen since it was reported.**

### New MUST FIX from round 13 — neither is about fronts

1. **Lay low removes the game.** ~60 of 300 days across four stretches whose only
   available input was "+1 week". *"The punishment for heat is not danger, it is
   14 days of pressing +1 week."* Same complaint F6 keeps mis-measuring as Pacing.
2. **The memo pool exhausts, and after Capo it is the only source of new
   content.** One memo fired six times with identical text and options; between
   day 180 and day 300 the tester met exactly one memo it had not seen before.

### Confirmed defects — CLEARED 2026-08-21, after round 13

Seven cleared in one pass once round 13 was banked. tsc clean, 621 tests green,
scorecard identical. Full account in the director log; the two worth knowing:

- **`Covered? Yes`** now subtracts what the loan book will *actually* take.
  `market.ts` gained `repaymentAgainst`, because `tickLoans` settles each loan
  all-or-nothing — the obvious fix, adding the nominal repayment to the bill,
  passed the first test and was wrong, and would have cried wolf on every week a
  repayment was about to bounce. Three tests; the shortfall one was re-run
  against the reverted code and failed for the right reason.
- **The roster "overflow" was not an overflow.** Measured: the page never
  overflowed and `.table-wrap` was scrolling as designed. The damage was row
  height — the Pay column shredded to one word per line, making every row 113px.
  Fixed in two shared classes, `.name-cell` and `.read-band`. Rows now 54px.
  **The tester's symptom was right and their diagnosis was wrong**, which is the
  fourth time measuring first changed what got changed.

Also cleared: the payroll advice now names selling the put-away pile; "Close" is
"Sell up" and armed before it fires, quoting the 35% return; the Why panel reads
rival state through `readFaction` instead of raw fields; `theirs`; the Vasari
string.

**Still open, deliberately.** The `OPPORTUNITY` memo offers a front the gate
refuses. It explains itself now, sharing the F10 string, but **F13** is that the
reason does not *look* like a refusal — it renders as the option's hint line.
Styling, and it belongs with iteration 6.

## F22 — the washing machine was what stopped trade income becoming standing — REPAIRED 2026-08-23

**Measured 2026-08-23** on `ladder.probe`, two populations of 36 careers over
300 days, same seeds, one difference: whether the bot runs the two trades.

    no trade  laundered $336,274 of $958,716 offered (35% used)
              paydays: no fronts 11%, nothing to wash 47%, dirty ran out 15%,
                       capacity ran out 27%
              best estate $541,253

    trading   laundered $748,631 of $1,060,958 offered (71% used)
              paydays: no fronts 10%, nothing to wash 29%, dirty ran out 13%,
                       capacity ran out 47%
              trade income $1,632,268 · best estate $576,661

    trading, counting only the paydays where a source was actually open:
              no fronts 0%, nothing to wash 14%, dirty ran out 13%,
              **capacity ran out 74%**

**Once a trade is running, the fronts are saturated three paydays in four.**
The whole-career figure of 47% badly understates it, because the median
arrangement opens on day 91 of 300 and a third of every trading career predates
the trade — splitting the counters by "was a source open" is what made the
constraint visible, and the unsplit number would have supported the wrong
conclusion.

This unifies two findings that were open separately:

- the trade earns a median **$1,632,268** and moves what the family is worth by
  **6.5%**
- the estate accumulates at **0.18x** annual income against a real-world 1-2x

They are the same finding. `estate` counts clean cash, holdings and fronts and
**never counts dirty money**, so every dollar the trade earns has to pass
through a front to become standing — and the front is a per-week flow with no
buffer. Unused capacity in a quiet week cannot be carried into a loud one, and
the trade delivers in weekly spikes. Adding a trade to a career put an extra
$412,357 through the machine, of which $83,215 went to the cut, and raised the
estate by $35,408.

### The repair, and the version of it that was thrown away

**Direction taken: capacity is a risk dial, not a wall.** Laundering past what
the premises comfortably hold is allowed, and what it costs you is exposure —
which already runs to heat above 50, to `finance` evidence above 70, to the
health pressure that erodes a front, and to whose books a financial
investigation subpoenas first. Nothing new had to be built for the consequence.
It was all there, behind a ceiling that stopped anybody reaching it.

**The first attempt took the wall off for everybody, and it was wrong.**
Measured over the same 36 careers:

    median peak estate   $541,253 -> $383,622   (-29%)
    trade income         $1,632,268 -> $242,896 (-85%)
    cases opened, careers ended, fronts lost:   identical

So it did not deliver the risk and it did cost the player. Two reasons, neither
of them the raid:

- the family paid the 22% cut on money it was going to spend as dirty anyway.
  Wages are held back; stock, retainers and job costs are not, and `pay` spends
  dirty first. Washing the lot every week is a straight leak.
- every front sat permanently over the exposure decay threshold, so health —
  and with it front revenue and front *value*, which is most of the estate —
  ground down everywhere at once.

**Shipped instead: the ceiling lifts only on `hard`.** The pressure dial in
`config/pressure.ts` already asks "how dirty do I want this business", already
multiplies capacity, and already carries exposure, wear and an inspection
chance. It now also means there is no ceiling. A front nobody has touched
behaves *exactly* as it did — every baseline population in `ladder.probe` is
bit-identical after the change, which is the property that made it safe to
ship.

### What leaning is worth, measured

`RUNS_LEANING` is the trading bot plus one behaviour: everything goes to `hard`
on a week with more dirty money than the premises will take, and back to
`normal` when the backlog clears.

    laundered            $748,631 -> $1,165,545  (+56%)
    capacity used        71% -> 106%
    clean money in       $381,718 -> $595,303    (+56%)
    front value at end   $294,697 -> $263,300    (-11%)
    peak estate          $576,661 -> $586,738    (+1.7%)

The door opens and the bot walks through it. The price is real and it is front
value, through exposure and health. **At the median the two roughly cancel** —
1.7% on 36 careers is inside this file's noise, and it is printed rather than
asserted for that reason.

Two things that are asserted, both large and directional: leaning puts at least
20% more through the fronts, and it costs measurable front value.

### Still open on F22

The estate decomposition is the finding underneath the finding:

    estate at the end   no trade  $532,031 = cash 648 + put away 228,961 + fronts 303,949
                        trading   $573,177 = cash 4,803 + put away 320,437 + fronts 294,697
                        leaning   $586,738 = cash 2,570 + put away 312,332 + fronts 263,300

**Clean cash on hand is a rounding error in every arm.** What the estate is
made of is holdings and front value, and the trade reaches it only through
holdings — which is why a 56% rise in clean income buys 1.7% of estate. Whether
leaning should pay better than break-even is a tuning question with a plotted
answer, not a bar, and it has not been taken.

## F23 — the wash cut was a tax that bought nothing — REPAIRED 2026-08-23

The complaint that started it: *"how are we adding ways to create more cash
flow and we lose 85% of our profits?"* Answered with a ledger nobody in this
project had ever built, because `lifetime` is gross sales revenue and the trade
buys before it sells out of the same pocket:

    trading arm, 36 careers, 300 days

      sold            $1,632,268
      - stock            694,777   (43% of revenue)
      - payroll          105,821
      - the wash cut     156,255   (~21%, and it buys nothing)
      = net              675,415

      estate against the same careers not trading:  +$41,146

Every other cost in this game buys something. Stock buys units, wages buy
people, upkeep buys premises. `LAUNDER_CUT_BASE` at 0.24 evaporated, and it was
the largest single charge a family ever paid.

### What shipped

**24% is what a stranger charges.** `config/launderers.ts` is the alternative —
three people who will keep your books, charge less than a stranger, charge less
again the longer you keep them, and can stop taking your calls. The shape is
`SUPPLIERS` and `SUPPLY_TRUST` from the contraband economy, deliberately,
because it is the same idea: a flat number is not a relationship.

| | opens at | at best | retainer | a week |
|---|---|---|---|---|
| a bookkeeper with several clients | 16% | 10% | $45,000 | $250 |
| an accountant of your own | 13% | 7% | $140,000 | $700 |
| a firm downtown | 10% | 4% | $260,000 | $1,400 |

Retainers off a plotted distribution — peak funds by day 100 (median $39,310,
p75 $156,053) for the cheapest, by day 200 (median $125,927, p75 $232,915) for
the rest. `launderCut` floors a retained arrangement at that person's own
`bestCut` rather than at `LAUNDER_CUT_MIN`, which is why the firm is worth
$260,000: a relationship is allowed to beat the stranger floor.

### Measured, on a fourth probe arm

`RUNS_BOOKS` is the trading bot which takes the best terms it can afford while
keeping a reserve, and never drops them.

    somebody on the books    27/36, median day 133
    the cut those careers paid   17.2%   against 21.7% with nobody
    lost in the wash         $156,255 -> $84,986   (-$71,269 a career)
    estate at the end        $573,177 -> $594,871
    trade income             $1,632,268 -> $1,272,998

### Two things the measurement changed about the design

**Trust as a target was unreachable, and copying `SUPPLY_TRUST` was the bug.**
That function drifts toward `100 * kept * quiet`, which collapses to zero on
any week over the heat ceiling. Weekly heat across 36 careers is **p10 37, p25
62, median 81, p75 100** — so the target was zero four weeks in five and trust
drifted down 10 for every 10 it gained. The first version reported a best
standing of **0/100 across the entire population**. Heat now gates the *gain*
(`driftPerWeek` on a quiet week, `hotDecayPerWeek` of 1.5 on a loud one) and
`quiet` is a band between 40 and 80 rather than a ratio to 60, both ends off
that distribution. `SUPPLY_TRUST` has the identical defect and was deliberately
left alone — fixing it would reshuffle every seeded population in the project
on a measurement about a different system.

**The opening rate had to carry most of the value.** Even repaired, this bot's
best standing among careers that hired is a median of **4 out of 100** — it
hires on day 133 and never lays low. The relationship is real and a careful
player will have it; pricing the feature on a curve nobody in the sample
reaches is the PATRON shape in an accountant's suit. So the money is in signing
(24% to 16%) and the relationship is upside on top.

### Still open

`RUNS_BOOKS` still shows the deeper F22 finding unchanged: estate is holdings
plus front value, clean cash is a rounding error in every arm, and $71,269 a
career saved from the cut moves peak estate by 3.8%. The wash is no longer the
biggest leak. **Stock at 43% of revenue now is**, and nothing has looked at it.

## What comes next (2026-08-23 through -30 framing) — fully superseded, see HANDOFF.md §0

This section owed round 14. Rounds 14 through 26 have since run; see
`HANDOFF.md` §0, §4 and §6 for the current state. Kept only because two of
its "owed regardless" items were carried in the archive intro above:
`informants.probe`'s 29/30 guard, and the 1,460-day Difficulty regression
whose cause is still unfound.

## The failing tests that were deliberate as of 2026-08-23 — now all green

Four assertions were red on purpose as of 2026-08-23: `grok.probe`'s
"actually played" bar (59 vs ≥60), `ladder.probe`'s back-half-supply bar
(0.3311 vs ≥0.3333), `ladder.probe`'s favour-network reachability bar
(alderman owed in 35/36 vs ≤33), and `scorecard.probe`'s axis-collapse
guard. All four had gone green by 2026-09-08 (see the archive intro at the
top of this file) — none needed carrying forward.

### The rank ladder's remains — cleared 2026-08-23

The ladder came out of the sim earlier in the cycle and three screens went on
reading the old table. The **Overview told a boss holding three districts and
twelve people that they were "12 of 3"**, because `RANK_BY_ID[player.rank]
.maxCrew` is 3 for every career that will ever be played. Cleared:

- `Dashboard.tsx` — crew cap reads `maxCrew(state)`; the "Toward <rank>: n/m
  met" line is gone, having counted toward a promotion that cannot arrive.
- `PlayerPanel.tsx` — the Advancement panel, the rank name and blurb in the
  page head, the "You have been offered…" line, and "Highest rank you can
  appoint" (there is no appointment ceiling any more) are gone. "People you can
  command" reads `maxCrew`.
- `player.ts` — `nextRank`, `rankRequirements` and `RankRequirement` deleted.
  Zero callers in `src` after the above. `tickRecord` **stays**: the family's
  high-water marks are read by the front-health floor in `business.ts` and by
  `legacy.ts`, and the table was never their only customer.
- `report.ts` — `rank` and `pendingRank` off the playtest snapshot, with the
  "offered a step up" line that could not fire.
- Tests: `rankRows.test.ts` deleted with the screen it guarded; `dynasty`,
  `estate` and `holdings` were reading `rankRequirements` rows as a proxy for
  `org.record`, `controlledTerritories` and `estate`, and now read those
  directly — which is the better assertion regardless.

What is left of `RankId` is `player.rank` on the save, so a game written before
the ladder came out still loads, and the succession line, which records what a
predecessor was called. Neither is read as a gate.

### And a rule that came out of the orders build

**A new weekly roll does not go on `state.rng`.** The shared stream is ordered
and load-bearing: every probe plays fixed seeds, and several bars sit within a
point of their thresholds by design. Adding one `rng.chance` a week to the
shared stream reshuffled all 144 careers, turned four failing assertions into
five, and moved `config/civic.ts`'s captain bar off its floor — none of which
was a fact about the feature. The generator is stateless given (seed, calls),
so derive a stream (`offerStream` in `sim/orders.ts` is the pattern) from the
seed and the day: identically deterministic, identically save-safe, and it
leaves every existing measurement bit-identical. Reach for it whenever a new
system rolls on a schedule and nothing downstream needs to react to *that
particular* draw.

## Repo audit — 2026-08-21, after round 11

A repo-wide dead-code pass ran after the round 11 repairs and **-117 lines** were
cut (53,670 → 53,553). `tsc` clean, 616 tests, 54 files, still green. Nothing
behavioural changed — every symbol removed had zero callers anywhere in `src`,
tests included.

Removed: `spendDirty`, `GROUND_WEEKS`, `tradeIsRunning`, `capoIn`,
`relationshipState`, `lastSatDown`, `tracesFor`, `tieBetween`, `pluralize`,
`CYCLE_ORDER`, the `--brass-bright` custom property, and eleven redundant
`export` keywords on symbols used only inside their own file. `median` was
copy-pasted identically into four probe files and now lives once in
`src/sim/__tests__/helpers.ts`.

**The part that is not housekeeping.** Seven config keys were defined, commented,
and read by nothing. One was harmless — `INFORMANTS.onlyOneAtATime` duplicated a
rule that `tickInformants` genuinely enforces at
[informants.ts:202](src/sim/informants.ts), with the same rationale already
written at the call site.

The other six each named a mechanic with **no implementation anywhere**:

    CAPO_DRIFT.perStrengthLost        a capo noticing his family lost ground
    CAPO_APPROACH.onFailureEvidence   a refused approach adding evidence
    DECAY.respectDecayPerWeek         respect fading (its two siblings are wired)
    DEBT.loyaltyPerMiss               a missed payment costing crew loyalty
    CITY_INTEL.storiesAlways          a visibility flag nobody reads
    TIE_SUCCESSION.loserResentment    resentment written into the losers of a
                                      contested handover

They are deleted, so the tree no longer asserts behaviour the sim does not have.
**Whether any of the six should exist is an open design question, not a
regression.** Two of them — a capo reacting to lost ground, and resentment
surviving a contested handover — sit directly under **F5** and **F9**, which is
worth knowing before either finding is attacked again.

Also clean, and worth not re-checking: 153 CSS classes with one unused, 34
custom properties with one unused, no duplicated `clamp`, no single-implementation
factory, and no dependency doing work the platform ships. `src/dev/harness.ts`
(505 lines) looks like dead weight and is not — it sits behind
`import.meta.env.DEV` and is tree-shaken out of the production bundle.
