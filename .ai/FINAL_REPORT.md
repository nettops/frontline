# Final report — the merge session, 2026-09-07 night through 2026-09-08 morning

Commissioned as the next autonomous round, running until 10am EDT
2026-09-08. Started by being asked to commit and push a small doc fix, which
surfaced that local `main` and `origin/main` had diverged into two
independently-developed histories — 40 commits on one side, 85 on the
other, neither aware of the other's work. Everything below follows from
reconciling that, then running the normal diagnose → fix → verify → blind
round loop on the result.

**Where this landed, up front:** the two histories are merged and pushed.
A genuine cross-branch economic regression (F24) was found and mostly
closed. A long-standing "single most load-bearing item" turned out to be
already fixed by the branch that got merged in, and was closed by
re-measurement rather than new work. Two full blind rounds ran on the
merged code — the first two ever, since the merge only happened this
session — with no MUST FIX in either, and two real, reproduced UI fixes
went out from what they found. **QA scores are not at 9-10 yet.** Depth
and Feedback and Writing are (9, 8-9, 9-10). First hour, Clarity, Pacing,
Difficulty, Interface, Standing in it and Fun are not. That's the honest
state, with what's known about why, below.

---

## 1. The merge

Local `main` (this session's prior work: front-upkeep cost-of-scale,
autopilot risk tiers, F15/F2/F11/F13 closures, the documentation-hygiene
discipline) and `origin/main` (a separately-developed line: the card game
rebuild, contracts, two writing passes, the sit-down voice system, moving
difficulty/heat/economy tuning into JSON) had forked after a shared commit
on 2026-08-21 and never seen each other since.

Resolved by reading both sides of every conflict rather than picking one
wholesale — 11 real content conflicts across docs, config, and sim/UI
code, plus 4 pure file-location conflicts from a directory rename. Full
per-file reasoning is in the merge commit (`99d6ab4`). `tsc` clean,
`npm test` green (130 files, 1,559 passing) immediately after.

## 2. F24 — the merge broke four pre-committed probe bars

`npm run probe` was not green after the merge — two branches' independent
balance work interacting for the first time. Diagnosed by direct ablation
(toggling the one lever this session controls, `FRONT_UPKEEP_RATE`, with
everything else fixed) rather than guessing:

- **Favour-network reachability and trading-arm utilization — CLOSED.**
  Front upkeep at 0.4 was genuinely taxing front revenue hard enough to
  crowd out the payroll spend the union favour watches. Moved to 0.3, the
  lowest previously-measured point that restores both.
- **Trading arm's net advantage — CLOSED, by fixing the bar, not the
  rate.** This one swung non-monotonically across the same rate sweep
  (22%/33%/94%/83% of its target), which is rng noise at n=36, not a real
  relationship. Restated per DIRECTOR.md §5's exception, from "must exceed
  100% of not-trading's estate" to "must exceed 50%" — still the stricter
  branch's own intent, at a resolution this sample size can actually
  support.
- **Rival "going quiet" share — LEFT OPEN, on purpose.** 61.4% against a
  ≤61% bar, confirmed not caused by front upkeep, and this specific bar
  had already used its one-time restatement exception before the merge. A
  second use was not taken. It's marginal and now the concrete acceptance
  test for `.ai/TASKS.md`'s rival-AI frequency item.

`npm run probe`: 4 failing → 1 failing (the one left open on purpose).

## 3. The stale finding: "the highest-paying job is always the best job"

Carried across two prior rounds as *the* highest-leverage open item,
needing new job content or a non-money payout. Before starting that work,
checked whether it still held against the merged code rather than trusting
the note. It didn't: the other branch's `perFireByHand` fix (2026-09-06)
already prices a hand-run job's repetition the same way a standing order's
was, built for exactly this symptom. `scorecard.probe`'s bot — which does
nothing but recruit and pick the highest-EV job every day — now reads
**Depth 9.5, "best job changed 44% of weeks, 13 kinds used."**

What the same reading still shows, and is a different, lower-urgency
finding: Pacing 8, "nothing was new after day 970" of a 1,460-day bot
career. A finite content pool exhausted late, not one job dominating —
and day 970 is far past the 300-day window a human blind round ever
reaches.

No code changed for this item. It was closed by re-measurement, which is
itself the finding worth carrying forward: a note in a tracking doc is a
claim about the code at the time it was written, not a fact.

## 4. Two blind rounds on the merged code — the first ever run against it

**Round 23** (day 306, Crew Leader, survived a costly war): First hour 6,
Clarity 7, Feedback 9, Depth 9, Pacing 6, Difficulty 7, Writing 10,
Interface 6, Standing in it 8, Fun 7.

**Round 24** (day 368, Crew Leader after a demotion from Capo, survived a
federal trial to acquittal): First hour 7, Clarity 7, Feedback 8, Depth 9,
Pacing 6, Difficulty 6, Writing 9, Interface 6, Standing in it 7, Fun 7.

**No MUST FIX in either round** — DIRECTOR.md §10's two-consecutive-clean-
rounds condition is met for the first time since the merge. Depth held at
9 both times (strong, confirmed). Pacing and Interface both held at 6
(real, repeated findings, not one tester's noise — two independent
readings agreeing is what this project's own rules treat as signal).

Each SHOULD FIX candidate was checked against source, not assumed:

- **Fixed**: the Fear stat's tooltip explained what it does and never what
  moves it (round 23's exact words). Added the driver (violence and its
  credible promise) and the decay, pulled from the sim's own comments.
- **Fixed**: roster rows (Organization, Rivals) revealed their detail
  panel below a potentially full-height table with no scroll cue —
  reproduced on nearly every visit in round 24. Added a scroll-into-view
  on selection.
- **Fixed**: the steward-delegation hint (Rail badge and the "what wants
  you today" system) named the situation and never the door — "a district
  you hold has nobody running it" without which district or who could
  take it. Both now name the actual district and a candidate by name. The
  existing test only checked which panel the hint pointed at; strengthened
  to assert the actual wording, and mutation-verified (the fix was
  reverted, the new assertion was watched to fail on the exact case it
  should catch, then restored).
- **Closed as non-issues, checked against both code paths**: two round-19
  candidates (the lay-low refusal, the receipt/memo z-index layering) and
  two round-23/24 candidates (a memo choice's disabled state, a memo not
  appearing in a text-extraction heuristic). All four are correctly
  implemented in the game; none would ever be hit by a human clicking with
  their eyes.
- **Watched, not changed**: rank flip-flopping during a crisis (round 23
  read it as "thrashy"; round 24's own single demotion read as a positive,
  load-bearing discovery instead). `rank.ts`'s own design argues at length
  against smoothing this, and a second reading didn't contradict it.
- **Left alone**: Lay Low's expiry already logs "You surface again" — the
  "silently expired" report is most likely a missed log line during a
  fast-forward, not a missing feature. Pacing's "no warning before a
  crisis" is one reading of one war and risks undercutting the tension the
  game is otherwise trying to earn — left for a second reading before
  touching.

Verification after both rounds' fixes: `tsc` clean, `npm test` green (130
files, 1,559 passing), `npm run probe` 98/99 (unaffected by the UI-only
changes).

## 5. Where the QA-score target actually stands

The developer's stated target is every score at 9 or 10. Against the two
post-merge rounds:

    axis              r23   r24   at target?
    First hour          6     7    no
    Clarity             7     7    no
    Feedback            9     8    r23 yes, r24 no
    Depth               9     9    yes
    Pacing              6     6    no — confirmed, repeated
    Difficulty          7     6    no
    Writing            10     9    yes both / close
    Interface           6     6    no — confirmed, repeated
    Standing in it      8     7    no
    Fun                 7     7    no

Depth, Feedback and Writing are genuinely strong. Everything else is not
yet at the bar, and the two axes with the clearest, most-repeated evidence
(Pacing, Interface) are named specifically rather than guessed at:

- **Pacing 6, both rounds.** Both testers independently described the same
  shape — a mid-late-game stretch that becomes "dismiss digest → handle
  one recurring crew conversation → advance time," reading as maintenance
  rather than new decisions, even with Depth scoring 9. Not yet diagnosed
  to a specific mechanism; the sit-down/informant-suspicion trees
  "becoming mechanically identical" once a player learns the pattern
  (round 24's words) is the leading candidate, and a smaller, more
  tractable target than "add new content" if it holds up. Needs its own
  diagnosis session — this is `.ai/TASKS.md` item 1 now.
- **Interface 6, both rounds, partially addressed.** The two concrete,
  every-visit sub-causes found this session are fixed (above). Not yet
  validated by a fresh blind round. The Rail's badge system itself is
  already extensive and well-designed — checked this session rather than
  assumed — so if Interface stays at 6 after those fixes are confirmed,
  the remaining gap is the multi-panel information architecture both
  testers described (checking several separate pages to know what needs
  attention), which is a bigger design question than a quick patch.

## 6. What's next, ranked

See `.ai/TASKS.md` for the full, current queue. In order:

1. **Pacing** — diagnose the mid-game repetition specifically, likely
   starting with the crew sit-down/informant trees, before assuming new
   content is needed.
2. **A validating blind round** — to confirm the Interface fixes actually
   moved that score, and to get a third data point on Pacing/Difficulty/
   Fun/Standing in it now that two agree.
3. **The rival "going quiet" frequency term** — has a concrete, currently-
   red acceptance test (F24's fourth bar) and its own history arguing it
   needs a dedicated session, not a rider.
4. Smaller items: `propose_alliance` reachability (needs a design call,
   not a third bar-lowering), a district-holding cost for the player
   (deliberately not attempted this session — see reasoning in
   `docs/findings/director-log.md`'s round-22 entry on why a second
   economy tax right after F24 risked repeating the same interaction
   rather than adding real depth).

## 7. Housekeeping

Per the standing reconcile-and-trim rule: `HANDOFF.md` §0 and §6 are
current through round 24; `docs/findings/director-log.md` was trimmed from
3,074 to 1,710 lines by archiving the merged branch's own pre-merge
iteration record (its durable conclusions are already in `HANDOFF.md`
§0); two stale `HANDOFF.md` lines from 2026-09-02 were corrected. One open
item flagged but not done: reconciling the two merged histories' F-number
findings against each other, so a number isn't reused for two different
things by accident.

All work is committed and pushed to `main` (`6656249` at time of writing).
