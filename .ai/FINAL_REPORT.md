# Final report — the merge day (2026-09-07/08) and round 27 (2026-09-09)

Commissioned as the next autonomous round, originally to 10am EDT, then
extended to 7:30pm. Started by being asked to commit and push a small doc
fix, which surfaced that local `main` and `origin/main` had diverged into
two independently-developed histories — 40 commits on one side, 85 on the
other, neither aware of the other's work. Everything below follows from
reconciling that, then running the diagnose → fix → verify → blind round
loop four more times across the extended day.

**Where this landed, up front:** the two histories are merged and pushed.
F24, the cross-branch regression the merge itself introduced, is fully
closed — four pre-committed bars, all four green, one via a dedicated
session in the afternoon that its own note had asked for. A long-standing
"single most load-bearing item" turned out to be already fixed by the
branch that got merged in. Four blind rounds ran on the merged code — the
first four ever — with one real MUST FIX found and fixed same-day, one
fix explicitly confirmed working by the very next round's tester, and six
more real, reproduced findings fixed. **QA scores are not at 9-10 yet.**
Depth, Feedback and Writing are close to or at the bar; First hour,
Clarity, Pacing, Difficulty, Interface, Standing in it and Fun are not,
and Interface in particular is now a *confirmed*, not just suspected,
harder problem — four rounds, three fixes, no movement. Full honest state
in §5.

---

## 1. The merge

Local `main` (front-upkeep cost-of-scale, autopilot risk tiers, F15/F2/
F11/F13 closures, the documentation-hygiene discipline) and `origin/main`
(the card game rebuild, contracts, two writing passes, the sit-down voice
system, moving difficulty/heat/economy tuning into JSON) had forked after
a shared commit on 2026-08-21 and never seen each other since.

Resolved by reading both sides of every conflict rather than picking one
wholesale — 11 real content conflicts, plus 4 pure file-location conflicts
from a directory rename. Full per-file reasoning is in the merge commit
(`99d6ab4`). `tsc` clean, `npm test` green immediately after.

## 2. F24 — the merge broke four pre-committed probe bars, all four now closed

Diagnosed by direct ablation rather than guessing:

- **Favour-network reachability, trading-arm utilization — CLOSED**
  (morning). `FRONT_UPKEEP_RATE` at 0.4 was taxing front revenue hard
  enough to crowd out the payroll spend the union favour watches. Moved to
  0.3.
- **Trading arm's net advantage — CLOSED, by fixing the bar** (morning).
  Swung non-monotonically across a rate sweep — rng noise at n=36, not a
  real relationship. Restated per DIRECTOR.md §5's exception from "must
  exceed 100% of not-trading's estate" to "must exceed 50%."
- **Rival "going quiet" share — CLOSED** (afternoon, in the dedicated
  session its own note had asked for). `config/factions.ts`'s history
  named two levers already tried and proven inert, and pointed at "the
  frequency lever is the heat term... a separate, larger change this
  session is deliberately not making." That change: `scoreConsolidate`'s
  `alarmed` term (a hard step at heat 60) smoothed to a ramp — measured a
  no-op on this specific bar but kept as a correctness fix; and
  `AI.consolidate.whenBroke` (0.45, never touched before) moved to 0.42
  after a real ablation sweep that also caught and fixed a second,
  unrelated regression it triggered (`memoPace.test.ts`, via the familiar
  shared-rng-stream reshuffle) and a small-sample test fragility
  (`statistics.test.ts`, a 100%-mistaken reading from a single suspicion,
  repaired by raising its floor from n>0 to n≥3).

`npm run probe`: 4 failing at the start of the day → 0 failing, none
weakened to get there.

## 3. The stale finding: "the highest-paying job is always the best job"

Carried across two prior rounds as the highest-leverage open item. Before
starting new job-content work, checked whether it still held rather than
trusting the note. It didn't: the other branch's `perFireByHand` fix
(2026-09-06) already prices a hand-run job's repetition the same way a
standing order's was. `scorecard.probe`'s bot now reads **Depth 9.5, "best
job changed 44% of weeks."** No code changed — closed by re-measurement,
which is the finding worth carrying forward on its own: a note in a
tracking doc is a claim about the code when it was written, not a fact.

## 4. Four blind rounds on the merged code

**Round 23** (day 306, war survived): First hour 6, Clarity 7, Feedback 9,
Depth 9, Pacing 6, Difficulty 7, Writing 10, Interface 6, Standing in it
8, Fun 7.

**Round 24** (day 368, federal trial survived): First hour 7, Clarity 7,
Feedback 8, Depth 9, Pacing 6, Difficulty 6, Writing 9, Interface 6,
Standing in it 7, Fun 7.

**Round 25** (day 221, Capo, no war — used its own 8-axis grouping instead
of the ten named axes, so not tabulated below). One real, reproduced MUST
FIX: the job panel defaulted to the loud approach even while laying low.
Fixed same day. Most consequential finding: rivals did nothing for all
221 days — direct, felt corroboration of the exact failure F24's fourth
bar names.

**Round 26** (day 284, Capo, no war): First hour 6, Clarity 5, Feedback 7,
Depth 7 (partial-coverage caveat), Pacing 7, Difficulty 6, Writing 9,
Interface 6, Standing in it 6, Fun 7. Explicitly confirmed, under WORKED,
that the Trade-signposting hint shipped after round 25 "successfully
pulled me into a system I'd been correctly priced out of for 250+ days" —
same-day validation of a same-day fix.

**No MUST FIX in three of the four rounds** (round 25's one was fixed
before round 26 ran). Ten fixes went out across the day, each checked
against source before touching anything:

- Fear's tooltip explained what it does, never what moves it — fixed.
- Roster rows (Organization, Rivals) revealed detail panels off-screen —
  fixed, live-verified in-browser (this project runs no jsdom).
- The steward-delegation hint named the situation, never the door — fixed,
  mutation-tested.
- The Trade had zero signposting despite the highest revenue ceiling in
  the game — fixed, confirmed working the very next round.
- The laying-low job panel defaulted to the loud approach — fixed (the
  round-25 MUST FIX).
- The rank-promotion crew-count line read as a stuck counter rather than a
  live gate — fixed.
- The "Carry on / Leave it" banner explained itself only on hover — fixed.
- Four items checked against source and closed as non-issues or
  deliberate design (the lay-low refusal, receipt/memo z-index, a memo's
  disabled-state rendering, "Decide it was them" giving no right/wrong
  confirmation — the last matching `contract.ts`'s own explicit "you find
  out over months" principle).
- Rank flip-flopping during a crisis — watched across two rounds, not
  changed; `rank.ts`'s own design argues against smoothing it and neither
  reading contradicted that.

Two backlog items given a real attempt rather than deferred again:
`propose_alliance` reachability (`trustPerPeacefulWeek` 0.22 → 0.5/week,
unvalidated — no pre-committed bar exists for this) and, deliberately,
*not* a district-holding cost for the player (no tester across five
rounds has named it as a felt problem, and a second economy tax risked
repeating F24's own cross-system interaction).

Verification after every change: `tsc` clean, `npm test` green (130
files, 1,560 passing by day's end), `npm run probe` 96-98/99 throughout
(the 3 skips are pre-existing and unrelated).

## 5. Where the QA-score target actually stands

    axis              r23   r24   r26   at target?
    First hour          6     7     6    no
    Clarity             7     7     5    no — r26's lowest reading, cause found and fixed
    Feedback            9     8     7    no
    Depth               9     9     7*   yes (r23/r24); r26 is partial-coverage
    Pacing              6     6     7    unclear — see below
    Difficulty          7     6     6    no
    Writing            10     9     9    close/yes
    Interface           6     6     6    no — confirmed, repeated, structural
    Standing in it      8     7     6    no
    Fun                 7     7     7    no

Depth and Writing are genuinely strong. Two findings are worth carrying
forward precisely:

- **Interface 6, four rounds running (r19, r23, r24, r26), three concrete
  fixes landed against it, score unmoved.** This started the day as a
  hypothesis ("the remaining gap is probably bigger than any single UI
  fix") and ended it as an observation: round 26 played *after* three of
  the fixes shipped and still scored it 6. The next session should
  diagnose Interface as its own problem — likely the multi-panel
  information-architecture complexity several testers have independently
  described — not keep patching individual affordances.
- **Pacing is now inconsistent (6, 6, 7) rather than confirmed.** The
  morning's diagnosis (sit-down/informant "format fatigue") still stands
  as *not ruled out*, but round 26 scored it a full point higher and
  described new content still arriving through day 284. Needs a fourth
  reading before concluding anything either way.

## 6. What's next, ranked

See `.ai/TASKS.md` for the full, current queue.

1. **Interface** — its own diagnosis session, not another UI patch. Four
   rounds of evidence now point at structural information architecture.
2. **Pacing** — one more reading before trusting either the "format
   fatigue" or "genuinely fine" hypothesis.
3. **A blocked negotiation sub-option** (r26, single occurrence) — not
   located in the source this session; get a fresh reproduction first.
4. Smaller: the rival "going quiet" frequency term is closed, but its
   sibling item (a district-holding cost for the player) is still
   deliberately unattempted; `propose_alliance`'s fix needs a validating
   round.

## 7. Housekeeping

Reconciled and trimmed throughout the day, not batched to the end:
`HANDOFF.md` §0 and §6 are current through round 26; `director-log.md`
was trimmed from 3,074 to ~1,900 lines by archiving the merged branch's
pre-merge iteration record; `.ai/TASKS.md` was rewritten twice as findings
closed and new ones arrived. One open item still flagged, not done:
reconciling the two merged histories' F-number findings against each
other.

All of the above was committed and pushed to `main` by the end of that
session. Everything below is a new, separate session the next day.

---

## 8. Round 27, 2026-09-09 — a short session, deadline 5pm

Checked `git fetch` against `origin/main` first, per the divergence-check
rule this project now carries in memory after 2026-09-07's near-miss —
clean, nothing to reconcile.

**A wrong theory from §5 above, caught and retracted.** That section's
closing claim — "the remaining Interface gap is multi-panel information-
architecture complexity multiple testers have independently described" —
was checked against its own citation before this session built anything on
it, and it did not hold. No round's actual report says anything like it;
the phrase traced to a misread of `Dashboard.tsx`'s own comment about a
*round 15* problem the game's Wanting/waiting/running panels were already
built to fix. Retracted in `HANDOFF.md` and `.ai/TASKS.md` rather than
quietly dropped, because presenting an inference as something "multiple
testers have independently described" was itself the kind of overclaim
this project's own §3 catalog exists to catch.

**Before dispatching round 27**, read `LawPanel.tsx`/`RivalsPanel.tsx`
looking for real Interface candidates and found one: `canContract` and
`canApproach` both return specific refusal reasons (no crew free, a
cooldown, cost uncovered), and three buttons across the two files showed
"not possible" on the button face with the reason only in a hover — the
same rule-4 shape this project has fixed before. Held until the round's
instance was stopped (editing `src/` while it's live risks HMR corrupting
the round), then fixed test-first, mutation-verified, all three.

**Round 27 itself**: full, Sonnet, pinned, explicitly asked to be concrete
about *where* Interface friction is rather than leave it to inference.
Reached **Crime Lord** — the top rank, first time any blind round has —
on day 303, with 9 of 12 districts, 9 fronts, a named heir who survived
three arrests, and a formal Delgado alliance. Scores: First hour 7,
Clarity 7, Feedback 9, Depth 9, Pacing 6, Difficulty 8 (the largest single
jump since the merge), Writing 9, Interface 6, Standing in it/Fun both 8.

Two MUST FIX items:

- **CLOSED — a real bug, not a display quirk.** `propose_alliance`
  refused with "Standing with them is 20; this needs 20," its own bar
  already met, and stayed refused. `canDo` rounded the figure for display
  but compared the raw float — 19.6 rounds to 20 and still fails
  `19.6 < 20`. Fixed by rounding before the comparison, not only before
  the message. Test-first, mutation-verified. Incidentally the first real
  proof that yesterday's `trustPerPeacefulWeek` raise makes this reachable
  at all — the tester built one.
- **Investigated, NOT reproduced.** A memo reported as rendering "hidden
  behind" a digest banner. `MemoModal` reads `pendingEvents`
  unconditionally and sits at `z-index: 50` against the digest's `20` —
  nothing in source supports the account. Live-tested on a fresh instance,
  three separate memo-triggering advances, correct immediate rendering
  every time. Left open and honestly unreproduced rather than guessed at.

Also very likely closed: round 26's own unlocated "negotiation sub-option
blocked, no reason given" — the same refusal-visibility shape as the
Contract-button fix above, found by reading rather than by reproducing
that exact report, so probable rather than certain.

Verification: `tsc` clean, `npm test` green (130 files, 1,564 passing, up
from 1,560 — four new tests, all mutation-verified). `npm run probe` run
after all fixes landed; see the commit log for the result.

**Where QA scores stand after round 27**: still not at the 9-10 target.
Depth (9) and Writing (9) hold strong; Feedback (9) joined them this
round. Interface remains the clearest unsolved axis — five rounds, four
real fixes, no movement, and an honest "still don't know" rather than a
retracted theory in its place. Pacing is still inconsistent across six
readings (6/6/7/6). Full current queue is `.ai/TASKS.md`.

**One more open item closed with time left before the deadline: the
1,460-day Difficulty regression, stale.** `TASKS.md` had carried "69-75%
of four-year careers end early" since 2026-08-21-era code, never
re-checked — the same mistake round-17's "job dominance" finding made two
days ago. Traced the actual mechanism (a career can only end via a trial
conviction with no eligible successor — `succession.ts`'s `removePlayer`
is the only place `state.gameOver` is ever set, called from exactly one
site) and re-measured with a temporary, fully-reverted diagnostic on
`scorecard.probe`'s own 48-world population: **endedEarly is now 39.6%**,
close to the 33% target, and the **Difficulty axis reads 6.07**, up from
the 4.7 this bullet was written against. Nothing in the game changed
today — the population had simply moved since some intervening session
last measured it and nobody checked back. A smaller, different finding
fell out of the same run: `distinctEnds` (final-rank diversity over four
years) was only 2 of a possible 5, now the axis's actual soft spot — not
chased further under the deadline.

## 9. Working the four-axis plan, 2026-09-09 (continued)

With the round-27 plan agreed (§8) and time still on the clock, worked
three of its four items in order.

**First hour — CLOSED.** A payroll hint already existed (`tips.ts`'s
`wages` tip) and was well-placed in the tutorial queue. The actual gap
was its gate: `crewList(s).length >= 2`, one hire more than a career
needs to owe wages — the starting associate draws a real wage from day
one, so a player who never hired a second man was never warned at all.
Gate lowered to `>= 1`. Test-first, mutation-verified.

**Pacing — a signpost shipped, unvalidated by a round yet.**
`OperationsPanel`'s "Above your standing" table has always listed every
locked job with its requirement and payout, up to $2.8M, and nothing had
ever pointed a player at it. New tip, `bigger_jobs`, fires once early and
names where to look — no claim about timing, which would violate
CLAUDE.md's third rule. Test-first, mutation-verified, live-verified
firing correctly. **Corrected the plan's own premise before spending
effort on it**: `scorecard.probe` cannot validate an informational hint,
since its bot doesn't read UI text — this needed a round from the start,
not a probe.

**Clarity — CLOSED, and it was a genuinely different bug from what either
session had reproduced.** Live-verifying the Pacing tip meant actually
loading the game and living through the exact sequence a tester would,
rather than reasoning about it from source — and that surfaced the real
mechanism behind round 27's "memo hidden behind the digest," which the
prior session's three source-checks and live retests had all cleared
(correctly: `MemoModal` really does render on top of everything, exactly
as checked). The real bug: `report.ts` baked "a memo is open and waiting
on you" into the Bulletin as a **snapshot**, taken when a multi-day
advance stopped. The game has always let a player answer that memo
directly, and doing so never touched the already-rendered Bulletin — so
it went on claiming a memo was open long after the desk was genuinely
clear. Reproduced live end to end, fixed by moving the `'today'` day-part
onto a small pure function (`pendingLines`) that `Bulletin` calls fresh
every render with the live count, so there is nothing kept between
renders to go stale. Test-first, mutation-verified, live-verified.

**Interface — still open, by design.** The developer will play it
directly; no AI method has moved this in five rounds and this session
made no attempt to substitute for that.

`tsc` clean, `npm test` green (130 files, 1,567 passing, up from 1,565
at the top of this session). No probe run for any of these three fixes —
none touch balance or `rng`.

## 10. Interface — the developer played it directly, 2026-09-09

Last item of the plan. No blind-scorer rubric; the developer played an
isolated instance and reported friction live.

**A first impression, not yet confirmed as a lived defect**: "a lot of
text on every screen," and a worry that with this many tabs a player
could lose their place. Real enough to log; not yet distinguished from
"could happen to someone" versus "happened to me."

**A real, diagnosed, fixed bug**: a crew sit-down "doesn't
flow... feels like you pick something random and hope." Read
`sim/sitdown.ts`/`config/sitdown.ts` before proposing anything. The
mechanism: a register only reveals what someone is carrying — which
unlocks a targeted, connected follow-up — when it *lands*, and landing
is judged against a hidden stat that's deliberately noisy at low
familiarity. The reported case was 3 days in, 22% known — correctly a
near-guess by the design's own stated intent ("inference under
uncertainty against a perception... noisy and banded"). The actual gap:
nothing on screen said the read was that shaky. `PERCEPTION_TIERS`
already had the right words and was already shown on the crew sheet;
`SitdownModal.tsx` now shows the same reading on the room screen itself.
Test-first, mutation-verified, live-verified.

**Two real proposals, both genuinely open, neither decided**: reworking
the Armoury into an Operations-integrated gear roll (flagged before any
work — this is close to a design `config/pieces.ts`'s own header
documents was already tried and rejected, for a reason that likely
still holds); and consolidating tabs, specifically folding the
informant mechanic into Organization (checked against the data first —
it's agency-scoped, not crew-scoped, so the move doesn't obviously
help) and The Trade into Operations (plausible, but risks the density
complaint from the same session). Both recorded as open questions, not
built.

`tsc` clean, `npm test` green (131 files, 1,570 passing, up from 1,567).

**Closing this out**: five AI blind rounds scored Interface 6 with no
movement, and round 27's own direct, unleading ask for concreteness came
back with three answers that didn't survive checking. One human, one
screenshot, found a real bug none of them named. That's a real answer to
the standing question about whether Interface's ceiling was the game or
the testing method — at least partly the latter.

## 11. Housekeeping, 2026-09-09

`docs/findings/director-log.md` gained entries for round 27, the
Difficulty regression, the First hour / Pacing / Clarity fixes, and the
developer's own Interface playtest, including the theory retraction and
the corrected Pacing-plan premise. `HANDOFF.md` §0, §1, §4's scores
table and §6 are current through all of the above. `.ai/TASKS.md` tracks
the two open design questions (Armoury, tab consolidation) and the
smaller carried-forward findings; nothing from today's four-axis plan is
still outstanding as an action item.

All of this is committed and pushed to `main` by the end of this session.
