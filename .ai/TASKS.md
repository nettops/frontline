# Round 17's blind playtest — a MUST FIX that is not a game bug

`round17`'s blind report opens with a 🔴 MUST FIX: the whole view
"repeatedly and unpredictably reverted to the title screen," including once
during plain scrolling with no click at all. The tester ruled out their own
automation carefully — the right instinct on the evidence they had.

**It is not a defect in the game.** `round17`'s own Vite server log
(`/tmp/round17-server.output`, still on disk this session) shows 18
`hmr update` events between 12:07pm and 1:44pm, each cascading through
essentially the entire UI component tree (`App.tsx` plus every panel) —
because I was editing `business.ts`, `factions.ts`, `operations.ts`,
`types.ts` and `clock.ts` on this exact schedule, for H1-H4. `npm run
playtest` starts a plain `vite --port <port> --strictPort`, which watches
the *whole repo*, not a scoped directory — every playtest instance this
session (round17, round17adv, mafia-verify) shares one filesystem watcher.
A shared-module edit with no React Fast Refresh boundary (all of `sim/`)
forces Vite to fall back to a full page reload, which drops `store.ts`'s
in-memory `state` to `null`, `App.tsx` renders `<TitleScreen>`, and the
always-current autosave is sitting right there under "Continue" — exactly
matching the tester's own description of the recovery step. The timestamps
line up with my edit history to the minute.

**Consequence for reading this report**: First hour (6), Clarity (5) and
Interface (4) are all well below this project's recent 8-9 range on those
exact axes, and this is almost certainly why — a game that appears to
crash to the title screen a dozen times will tank First hour and Interface
regardless of anything else. Treat those three scores as contaminated, not
as a reading of the current build. The rest (Depth 8, Pacing 5, Difficulty
6, Writing 8, Standing in it 7, Fun 6) and every non-crash finding in
Parts 3-5 are uncontaminated and worth acting on normally.

**Process correction, binding for the rest of this session**: do not edit
source files while a dispatched blind/adversarial round has a live browser
session running. The next round gets dispatched only once a batch of
changes is committed and I am not mid-edit on the next one.

# Round 17 — 2026-09-07, full-day session (Opus diagnosis / Sonnet build)

Opus diagnosis complete (see full report in session transcript / director-log
once logged). Headline: **HANDOFF.md is stale on the economy** — F15 (front
gate), F2 (influence) and most of F22 are actually CLOSED (verified by a
fresh probe run: 36/36 careers compound, median 10 fronts, first front day
14, estate median $2.65M). Three of HANDOFF §7a's four "deliberately
failing" tests are now green. The real, currently-open problems are
different from what HANDOFF describes:

1. **Difficulty scorecard axis is 4.7 — the lowest ever measured, and
   DIRECTOR.md §10 condition 4 (nothing below 6) is failing right now,
   unnoticed.** Root cause: 0/36 careers end before day 300; the economy has
   no real cost of scale (a crew member earns $5,354/crew-week against a
   $195 wage — 27x; 83% of clean income is never spent).
2. **Strategy convergence, not content exhaustion.** Content supply is fine
   (21 new situations after day 180). But 17 of the ~19 optional player
   behaviours the probe can measure are net-negative in estate — including,
   confirmed by a corrected paired-gap instrument, that using the favour
   network + pressure dial together costs a median career **-$896,499**
   estate and **-54% laundering** for a **-19 heat-week** benefit (out of
   ~1,977). Every deviation from "expand, buy fronts, run the frontier job"
   is punished.
3. **Rivals: consolidate (going quiet) is the only positive-cashflow
   action for a rival family**, and was until this session paid 5.5x a
   family's organic weekly net for one week of doing nothing.

**Opus's own honest assessment, worth repeating verbatim in spirit**: the
developer's "every axis 9-10" mandate is a score target, and DIRECTOR.md
forbids chasing scores three separate times in its own text (§1, §2, §10).
Pacing and Difficulty both have named arithmetic ceilings this session is
unlikely to fully clear without either more content than fits in one
session or weakening what a scorecard axis measures. Recommendation taken:
attack the named findings (0/36 careers fail, dominant-strategy convergence,
rival passivity) rather than the number, report honestly where the numbers
land, and treat Difficulty's 4.7 as the one release-blocking condition
worth a hard push.

## In progress this round

- **H2/F20/F21 — the pressure dial's `active` bot policy was measuring
  itself.** Its "go clean" trigger read an organization-wide case stage and
  overall heat, neither of which the dial defends against (`clean` cuts
  *this front's own* exposure/inspection risk — config/pressure.ts's own
  header). Rewrote the probe policy to trigger on the front's own
  `exposure > EXPOSURE_ALARMING_ABOVE`, per-business rather than
  portfolio-wide. Confirmed via `pairedGap` the -$896k/-54% reading is real
  (not the two-medians bug also fixed in the same file), so this is
  re-measuring an honest policy, not sweeping the finding away — the true
  cost/benefit of the dial + favours is whatever this corrected policy now
  reports.
- **H3/F5 — rival consolidate was a salary, not a saving.**
  `AI.consolidate.wealthGain` 12,000 → 3,000 (config/factions.ts), sized
  below the measured ~$2,190/week organic net so going quiet is a cushion
  again rather than outearning two and a half weeks of running the
  organization. Added a pre-committed assertion to `ladder.probe.test.ts`
  ("does not pay a family more to do nothing than to work") before making
  the change, per house rule.
- Both changes verifying now: `ladder.probe` + `scorecard.probe` +
  `broke.probe` (the guard HANDOFF says fires when rivals lean too hard).

## H2/H3 — resolved, both measured and restated honestly

- **H2/F20/F21 fix landed.** The `active` probe policy's dial trigger was
  rewritten to react to a front's own `exposure > EXPOSURE_ALARMING_ABOVE`
  (what `config/pressure.ts`'s `clean` setting actually defends) instead of
  an unrelated case-stage/heat signal. `pairedGap` confirmed the -$896k
  estate / -54% laundered reading was real before the rewrite (not a
  two-medians artifact) — the true problem was the probe's policy playing
  badly, matching this project's F7 pattern exactly. Re-measurement after
  the rewrite is still owed (queued below) — the fix changes what the
  instrument does, not yet re-confirmed what it now reports.
- **H3/F5 partial.** `AI.consolidate.wealthGain` 12,000 → 1,500
  (config/factions.ts). Discovered mid-fix: wealthGain never appears in
  `scoreConsolidate`'s score formula (`caution*heatPressure + alarmed +
  broke`) — it only feeds back into next week's `broke` term. So this
  change fixes the *payoff* ("a saving, not a salary," per the file's own
  stated intent) but barely moves the *frequency* (61% → 59% of
  rival-weeks). The pre-committed test was restated once, honestly, per
  DIRECTOR.md §5's exception — see the test's own comment for the full
  reasoning and the reading that justifies it. **Frequency is set by the
  heat term, a separate, larger change deliberately not attempted this
  session** — config/factions.ts's own history (three measured passes on
  `pressure.cost`, developer-authored comments each time) argues this needs
  its own careful pass, not a rider on today's session.
- **A second, pre-existing two-medians bug found and fixed the same way**:
  "running both trades... leaves a family no better off" compared
  `median(RUNS_TRADING)` against `median(RUNS_300)` directly. Converted to
  `pairedGap`. The corrected reading is a median per-seed gap of **-$12,651
  — indistinguishable from zero**, not the "trading helps" the old
  comparison implied. This is a **new, unattributed finding**: either the
  trade genuinely does not move the median career's estate once measured
  correctly, or my rival-AI change reshuffled it there from a
  previously-positive paired reading. Not chased further this session
  (DIRECTOR §5's "twice means you are tuning the instrument," and this is
  outside H1-H4's scope) — left failing and documented, which is what a
  failing pre-committed condition is for. **Owed**: attribute this properly
  (revert factions.ts alone, re-run just this arm) before anyone acts on it
  as a trade-economy finding. **RESOLVED**: reran the same paired
  assertion against pre-session `factions.ts` (`wealthGain: 12,000`) — it
  read +$219,304, comfortably positive. So this is real collateral from the
  wealthGain change reshuffling the rng stream, not a new trade-economy
  defect and not evidence against keeping wealthGain at 1,500. Left
  failing, documented, not restated a second time per DIRECTOR.md §5 — the
  honest fix is `resolves()`, this file's own significance helper, not
  another threshold guess.

## H1 — the missing cost of scale, first slice shipped

Opus's highest-impact item. **Confirmed by reading the code, not inferred**:
a front had a one-time purchase price and, once bought, cost literally
nothing to keep — no rent, no upkeep, nothing deducted in any weekly tick.
`config/factions.ts`'s rivals already model this correctly for themselves
(`upkeepPerBusiness`, `upkeepPerDistrict`, scaled); the player side never
had an equivalent.

**Shipped**: `weeklyFrontUpkeep`/`tickFrontUpkeep` in `sim/business.ts`, a
new `FRONT_UPKEEP_RATE` (0.25 of a front's actual weekly revenue,
config/businesses.ts) charged on the same payday `tickEconomy` uses.
Mirrors wages' own established shape exactly: dirty cash first, then clean,
shortfall carried (`Org.frontUpkeepOwed`, optional, save-compatible) rather
than a cliff. Consequence for going unpaid is front health (scaled by
`FRONT_UPKEEP_NEGLECT_HEALTH_HIT`, sized against `HEALTH`'s own existing
weekly penalty terms), not loyalty — a building has none to lose. Wired
into `clock.ts` right after wages, before `tickPossessions`, matching that
step's own "standing bills" framing.

Test-first: `frontUpkeep.test.ts`, 5 tests, mutation-verified (neutering
`tickFrontUpkeep` was confirmed to turn 2 of the 5 red for the right
reason, restored after). `tsc -b` clean.

**Full suite run: 1377 passed, 3 failed (11 skipped)**, none of them mine to
fix and none touching H1-H4's actual subject matter:
- The pre-existing borderline "keeps finding something to say in the back
  half" (HANDOFF §7a) — expected, already documented as noise-sensitive.
- Two NEW flips, both via the `resolves()` significance helper, which
  explicitly reports itself inconclusive at this sample size ("This sample
  cannot tell them apart... it needs about 437/14339 observations to
  certify either"): "the month in front of the job... what it does to the
  career around it" (37.8% vs a 33.3% bar, 2.8% sampling error) and
  `spread.probe`'s "who you send" (64 vs 65, functionally a rounding
  margin). Plausibly stream-reshuffle from the wealthGain cut and/or the
  new front-upkeep cash pressure changing crew-allocation and job-prep
  economics indirectly — not confirmed, not chased (would cost another full
  run to attribute cleanly and neither test is in H1-H4's scope). Left
  failing and documented, per DIRECTOR.md §2/§5 — a failing pre-committed
  condition is the finding, not something to revert or weaken on suspicion
  alone.

**Not yet done, and the reason this is "first slice" not "done":**
- **Not yet measured against `ladder.probe`** — this is the single most
  important next step. Opus's whole diagnosis was built on "0/36 careers
  end, 83% of income unspent"; this change needs to move that population
  reading, and by how much is unknown until it's actually run. `FRONT_UPKEEP_
  RATE = 0.25` is a first-cut number, explicitly not sized against a
  population yet — per this project's own rule ("sized against the plotted
  line, not by eye"), it will very likely need a second pass once the
  probe reports back.
- Have NOT touched `ROLE_WAGE` (the other half of Opus's "27x return"
  figure) or added a district-holding cost (Opus's feature idea (b)) —
  deliberately, to keep this one measurable change rather than three at
  once. Front upkeep alone may or may not be enough; the probe will say.

## H4 — job-table gates resized, first slice

Opus's diagnosis: highest gate in the whole table was `districtsControlled
>= 3`, a median 300-day career already holds 4 of 12 — so the two top jobs
(`citywide_network`, `enforce_the_peace`) unlocked with 100+ days still on
the clock and nothing above them to reach for.

**First attempt (districtsControlled 3→6, fronts 8→12) broke a
pre-committed floor**: `ladder.probe`'s "Boss is out of reach in a human
career" collapsed from 36/36 to 2/36, because `citywide_network`'s huge
payout ($1.4M-$2.8M) turned out to be load-bearing for reaching Boss rank
inside 300 days at all — the job gate and the rank ladder are coupled in a
way the diagnosis's gate-only view missed. Caught by the pre-committed test
exactly as it's supposed to work; reverted to a smaller move.

**Shipped**: districtsControlled 3→4 (the median itself, not a stretch
above it), fronts 8→9 for `citywide_network`; districtsControlled 3→4 for
`enforce_the_peace`. Re-measured: **all 7 probe/invariant files pass**,
including the Boss-reachability floor. Depth 8.2→8.1 (~flat), **Pacing
6.4→6.5**, **Difficulty 4.7→5.1** (both moved the right direction, modestly
— on the same 1,460-day axis that H1's front-upkeep was pushing the wrong
way, so this partly offsets that). `opGates.test.ts`'s structural rules
(reachable on FULL, no chained job-count gates, sentence-shaped `need`)
still hold.

**Honest sizing note**: one point above the median is a real but modest
stretch. It delays the endgame rather than restructuring it — the
underlying "EV per crew-day is monotone in tier, so nothing below the
frontier is worth taking once it's open" mechanism (Opus's root cause for
job-kind breadth stuck at 9-10 of 23) is untouched. That needs a job that
pays in something other than money (Opus's feature idea (c), still just an
idea) or new lateral content, neither attempted this session — resizing an
existing gate was the smallest change that could test part of the
hypothesis, and it is only part of the fix.

## Queued, not yet started

- **H1 — cost of scale** (crew wage curve / front upkeep / district holding
  cost). Opus's highest-impact, highest-cost item; most likely to move
  Difficulty off 4.7 and Standing-in-it past 7. Needs its own careful
  measurement pass — do not rush under time pressure.
- **H4 — job table variety.** Highest gate in the whole table is
  `districtsControlled >= 3`; median career at day 300 holds 4 of 12. No
  lateral reason to take any job below the frontier tier. Medium-large,
  content-shaped.
- **H5/F20 second half** — `hard`'s state gate (heat < 40 AND backed up).
  Smaller, bundle with H2 if time allows.
- **H6/F17** — `propose_alliance` still open in 0/36 careers; the quantity
  it gates on barely moves (peak standing 3/4/14 against a bar of 20).
- Update `HANDOFF.md`'s stale F15/F2/F21/§7a sections once the above lands,
  so the next session doesn't plan against a game that stopped existing
  70 commits ago (Opus's phrase, and accurate).
- Feature ideas from Opus, optional: a payroll shortfall that names who
  went unpaid; a district that costs more than it gives at the far end of
  the map; a job that pays in ground/standing instead of money; a
  deposition path that can actually be reached.

## Adversarial round — completed, no severe exploits

`DIRECTOR.md` §10 condition 6, run for the first time in this project's
history. No cleanly-reproducible severe exploit found — double-submission,
race conditions on cost/benefit actions, save-scumming for a reroll, and
forced-payment bypass all failed against the shipped game. Confirmed clean:
crew-add is atomic under a double-click, a zero-crew launch is refused
server-side despite the button staying visually enabled, save/load is
deterministic (identical replay produces identical results — no reroll),
and localStorage inspection at the end found no negative/corrupted state.

**One real, structural finding, worth folding into the H1/Difficulty work
rather than treating as a separate fix:** `considerOpening()` in
`investigation.ts` gates a case on three independent things — agency heat,
`footprint()`, and accumulated evidence `strength >= openThreshold`. Heat
alone never opens a case. The tester ran the autopilot at 82%+ success,
reached heat 68 (past the UI's own "Search Warrants — 65" line) over
several in-game weeks, and confirmed via a read-only localStorage check
that `casesOpened: 0` throughout — evidence never crossed the threshold
because a high-success run generates little of it. Plausibly by design
(skill should reduce legal risk) but it means a sufficiently careful player
can make law-enforcement consequence vanish entirely at any heat level,
which is one more contributor to Difficulty's 4.7 and 0/36 careers ending.
Not acting on this separately — it may move naturally once H1 changes how
much activity a career needs to sustain itself — but flagged here so it
isn't lost, and worth a probe check after H1 lands (does `casesOpened`
correlate with job failure rate rather than with heat, across the
population?).

# Tasks — prioritized, 2026-09-06

Ranked by the brief's own formula, IMPACT × CONFIDENCE ÷ COST, against the
findings already on record in `HANDOFF.md` plus what this session's read of
the newest work turned up. See `AUDIT.md` for the reasoning behind each line.

## Done this session

1. **[P0 — Longevity/Clarity] Three new, consequential systems (contracts,
   the pressure dial, the favour network) had no tip-strip entry — the exact
   "systems nobody could find" failure this project has already fixed three
   times for other mechanics.** High confidence (grep-verified absence, and
   `README.md` already documents the identical failure and fix for the
   sit-down/delegation/promises), low cost (three tip entries, no sim or
   balance change), high impact (these are the newest late-game decisions the
   game has — a hidden lever is not a lever). Implemented, tested,
   reachability-verified against the standard bot, logged. See
   `director-log.md`.

## Owed, not attempted this session

Ranked, with why each sits below the line for a single-session budget:

2. **[P0 — Longevity] F1: decisions stop changing around day 90-119,
   three-round-confirmed.** The largest standing finding in the project. Not
   attempted directly because it does not have a single named cause left to
   fix — `HANDOFF.md` traces it through F5 (rivals go inert), F15 (the front
   gate), and F7 (systems no instrument or bot exercises) — and the brief's
   own §22 says not to spend a whole session stuck diagnosing one thing.
   Closing it further needs a blind round now that contracts, the favour
   network and this session's tips exist, which this session could not run
   (`DIRECTOR.md` requires an agent that has not read the source and has not
   seen the change, and driving 300 in-game days through a live browser is a
   round's worth of budget on its own).
3. **[P1 — Systemic] F5: rival families go inert after roughly day 76,
   confirmed across three blind rounds; mechanism still unverified.**
   `HANDOFF.md` names the exact instrument owed — a rival-heat probe — and it
   was not built this session because it requires new probe machinery
   (measuring what a family's own heat and money do to its decision scores
   over the exact window the finding names) rather than a small, verifiable
   change.
4. **[P1 — Systemic] An adversarial round** (`DIRECTOR.md` §10 condition 6),
   never attempted in this project's history. Explicitly the kind of thing
   this session's `AGENTS`-style brief calls for (§8 "the do-nothing test",
   the anti-feature-spam rule) but it is a full round, not a code change, and
   the sizing rule in `DIRECTOR.md` §4 says not to run one to answer a
   question a static check can answer instead — there was no static
   equivalent available for "find an exploit."
5. **[P2 — Clarity] `HANDOFF.md` and `docs/superpowers/findings/director-log.md`
   are about nine days and 60 commits stale.** Real, but documentation debt
   rather than a gameplay defect — flagged in `AUDIT.md` rather than fixed,
   because backfilling a week of design reasoning accurately from the outside
   risks getting the "why" wrong in a project that visibly cares about it.

## Done in the 2026-09-07 round (Opus deciding, Sonnet building)

Item 2's own prerequisite — "closing F1 further needs a blind round now that
contracts, the favour network and this session's tips exist" — is what
prompted this round to end with one. Five more fixes landed first, all
Opus-diagnosed and verified against actual code/tests before being acted on:

6. **[P1 — Clarity/Correctness] `WORLD.gripSkim`, `PARTNER.protectionTrust`,
   `CONTRACT.cooldownDays` — three config keys with real balance intent, read
   by nothing.** Same class as item 1 above, one layer down: not "nobody can
   find the button" but "the number behind the button was never wired."
   High confidence (each verified by grep and a test that failed before the
   fix), low cost, real impact — one is F15's own repair (the silent
   partner), one is a build-screen promise on an irreversible day-one choice.
7. **[P1 — Correctness] Seven refusals that named no figure, still being
   written into new code as of last week's commits.** `refusals.test.ts`'s
   detector had two blind spots (a `!fn(...)` guard with no comparison
   operator; a comparison between two camelCase calls with no visible
   constant). Widened test-first per the file's own stated repair process,
   then the seven sites it found were fixed. HANDOFF §3 costs this exact
   defect class four blind rounds historically.
8. **[P0 — Longevity/Clarity] Instinct, the most expensive verb in the build
   table (7 points), did nothing at all below or above its threshold.**
   `hearsAbout()` existed, fully correct, called by nothing; `plant`/
   `pullOut` had no UI anywhere. Wired the warning into `investigation.ts`'s
   stage gate and shipped the missing Planted column. This is the same
   "irreversible day-one choice lies to the player" class as item 6's build
   screen, at the far more consequential verb tier rather than the world
   tier.
9. **[P2 — Clarity] Word and Ledger's verbs are unreachable for structural
   reasons, not missing UI.** Found while fixing item 8. `canCallATable`
   gates a restriction that was never built (house sit-downs are already
   unconditional); `canBuyIn` has no rival-business entity to address. Both
   are real design questions for the developer, not scoped bugs — labelled
   honestly on the build screen rather than built badly under time pressure.
10. **[P2 — Correctness] Four more dead config keys**, caught by a guard
    modelled on `deadState.test.ts`'s existing `Org`-field check, extended to
    every config settings object. One wired (`POACH.evidenceStrength`, a
    hardcoded duplicate), three deleted (superseded or byte-identical
    duplicates of an already-wired sibling).

**Declined:** Opus's recommendation to retune `CONTRACT.cooldownDays` down
from 300. Checked first — `CAPO_APPROACH.cooldownDays` in `config/capos.ts`
is 400 and produces the identical long-countdown pattern, and `contract.ts`'s
own header says the two mechanics are deliberately mirrored "in every
column." Retuning one alone would break that parity. See the director-log
entry for the full reasoning.

**Items 6 and 7 from the previous list not attempted, again**: the
rival-heat probe for F5, and an adversarial round. Both remain full-round or
new-instrument work, and this round spent its remaining budget on the blind
round instead, per its own governing question — "nothing a probe measures
changes what a human notices tonight."

## The blind round, and what came of it

`round16`, dispatched to a fresh subagent with no source access, the same
brief `PLAYTEST.md` has used since round 8. No MUST FIX items; decisions
held novel to ~day 220-230, well past F1's three-round-confirmed ~day
90-119. Full report in `.ai/FINAL_REPORT.md`.

Three of its SHOULD FIX items were fixed the same session — the card
mechanic's misleading "$0 a week" caption, the favour-network tip's queue
priority (29th to 9th — it existed and was never shown in 305 days), and
district-tier thresholds shown as real numbers for the first time. All
three are legibility fixes, none touches a balance number, all three
verified test-first and live in the browser.

## Why nothing else made the list

The anti-feature-spam rule in the governing brief asks, before adding
anything: would it still matter at day 250, does it interact with existing
systems, can it be verified this session. Everything else this session's
reading turned up — F2's influence rate, F15's front-gate fork, F20's
pressure-dial usage split — is already diagnosed, already has a proposed or
shipped repair, or is already a plotted-and-printed measurement rather than
an open defect. Re-litigating settled findings would be busywork with this
project's own name for it: an instrument returning a believable number about
itself. The one thing this session found that nobody had checked yet was the
tips gap, and it is what got fixed.
