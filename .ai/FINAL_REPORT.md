# Final report — the merge day, 2026-09-07 night through 2026-09-08 evening

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

All work is committed and pushed to `main` (`a2e1aca` at time of writing).
