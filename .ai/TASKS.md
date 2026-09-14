# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## The NOT NEGOTITABLE.txt pass, 2026-09-10 — IN PROGRESS

Full-scope 39-section director brief, authorized to run without
per-phase check-ins. Four scope forks resolved up front by the director:
comprehensive event tiering, a real standalone Career History panel, new
late-game systems (risking a previously-rejected design), and real
Word/Ledger mechanics rather than leaving them labeled unreachable.

**Closed:** Trade retainer + Succession weak-claim signposting (see round
28's Not Used table entry above — same session, folded in there rather
than duplicated here); the Operations crew-picker's silent-no-op button
on a full crew; `informants.ts`'s `fate` split (dead vs. defected, was
one undifferentiated `gone`); a real business-vs-family conflict event
(`gen_home_or_business`); and the Career History system —
`sim/career.ts` (snapshot-diff, 11 tests) plus `CareerPanel.tsx`, wired
into the rail's Records group, live-verified. 138 files / 1,601 tests,
`tsc -b` clean. Full account in `HANDOFF.md` §6.

**Next, in order:**
1. ~~Event severity/digest-batching rework (sections 4/5/20)~~ —
   **VERIFIED, no rework built, 2026-09-10.** Audited the full pipeline
   (`sim/pace.ts`, `sim/clock.ts`'s `advanceDays` halt, `MemoModal.tsx`,
   `report.ts`/`Bulletin.tsx`) then measured rather than assumed: a
   40-career/24,000-day diagnostic (`Rng`-seeded, `newGame`+`advanceDay`,
   temporary and fully reverted per this project's own convention) found
   same-day multi-event collisions in 7 of 2,203 event-raising days
   (0.3%), and an `info`+`info` collision exactly once in the whole run.
   `danger`-severity events (the only ones that stop a multi-day span's
   auto-resume and demand an explicit "Carry on") are ~2% of raisings at
   a ~1-per-4-day rate — roughly one every 200 days, so a requested month
   rarely sees even one manual stop, let alone several. The design doc's
   own account of the felt problem ("clicking through five of them is
   the slowest part of playing this") already has its shipped fix: the
   number-key hotkeys in `MemoModal.tsx`. Building a "DAILY BRIEFING"
   digest UI would touch a deliberately-designed piece of identity (the
   memo's own header: "an event does not pop up as a dialog, it arrives
   as a typed page on the desk") to solve a collision that occurs on
   0.3% of days — the same call CLAUDE.md's heat-repair precedent
   describes: measured, and backed out because no real target existed.
   Nothing built; nothing reverted. Full numbers in `director-log.md`.
2. ~~New late-game systems (13/25)~~ — **CLOSED, 2026-09-10.** Did not
   revive the parked "connected jobs" as written — their own postmortem
   (`config/operations.ts`) says the flaw was `favoursOwed >= 1` as a
   *gate* rather than a *cost* ("a delayed rank unlock wearing a
   relationship as a costume"), and the civic favour network those jobs
   would have duplicated already exists, is already tuned, and already
   has two spend paths (`spendFavour`, `askForWork`) — reviving them as
   written would have re-solved a solved problem. Built the one genuinely
   new thing the existing favour currency could not already do: "Call a
   Walkout" — the union boss's favour spent *outward*, shutting down a
   named rival's payroll income for `FAVOUR_EFFECT.walkoutDays` (21) days.
   `sim/civic.ts` (`canCallWalkout`/`callWalkout`), a lazy `walkoutUntilDay?`
   on `Faction`, suppressed in `faction.ts`'s `collectIncome` (exported for
   isolated testing) without touching the rival's own tuned upkeep — the
   cut comes from nowhere, not off the rival's wealth curve, on purpose.
   Wired into `CityPanel.tsx` beside the existing favour buttons, one per
   rival. 4 tests, 2 mutation-verified, live-verified (renders correctly
   disabled with the real refusal reason).
3. ~~Word/Ledger real mechanics (27)~~ — **CLOSED, 2026-09-10.**
   **Word:** `canCallATable` never actually gated anything — sit-downs
   were open to everybody regardless of the stat. Gave it one real,
   narrowly-scoped restriction in `sim/sitdown.ts`'s `canSitDownWith`: a
   house you are actively **at war** with will not sit down with a boss
   whose word carries nothing yet; a house at peace, and every crew
   member, stays open to everybody exactly as before. Not a hard lock —
   the AI's own `peace_offer` still reaches a Word-less player, and
   war-weariness still wears both sides down regardless; this only gates
   the player's own *initiative*. 4 new tests, mutation-verified.
   **Ledger:** `canBuyIn`/`buyIn` only ever resolved against
   `state.businesses`, which holds the player's own fronts and nothing a
   rival owns — there was no business to name. Built the minimum real
   model: `RivalBusiness` (`sim/types.ts`, lazy `state.rivalBusinesses?`),
   materialized one at a time exactly where a rival's `businessCount`
   already increments (`faction.ts`'s `executeInvest`), naming and typing
   flavour drawn from `Rng.stableNoise` per this project's determinism
   rule (never the causal stream for a fact nothing reads back). `buyIn`
   now targets these; a weekly `tickStakes` pays the stake share of
   `AI.invest.incomePerBusiness` as dirty cash, deliberately *not* docked
   from the rival's own tuned wealth curve — a vig skimmed off one front
   among several isn't the kind of dent that number was sized for. New
   "What they have bought in the neighbourhood" section on each rival's
   own `RivalsPanel.tsx` page, gated on the same intel line their
   investment itself becomes visible behind. 11 new tests across
   `faction.test.ts`/`verbs.test.ts`, 2 mutation-verified, live-verified.
   Both verbs' entries came off `PlayerPanel.tsx`'s
   `VERB_NOT_YET_REACHABLE` map, which is now empty (left wired for the
   next verb that ships ahead of its screen).
4. Sections 7/8/9/10/14/15/16/33 — audited, mostly already satisfied,
   two real gaps found and closed, 2026-09-10:
   - **7 (event messages), 14 (repetition escalates), 33 (performance):
     SATISFIED, no changes.** Audited against the brief's own literal
     examples and found the existing mechanisms already do the job —
     `PATTERN`'s worn-groove repetition pricing, tiered jobs, and
     disciplined `% N`-gated ticks throughout `clock.ts`. No event body
     anywhere reproduces the brief's bad example ("The investigation
     continues.").
   - **8 (itemized odds everywhere): mostly SATISFIED.** Heat (3 named
     channels + causal log lines), business health (worst-cause label),
     and the card game already follow the philosophy. One real, precisely
     scoped gap found and left for later: NPC loyalty's weekly drift terms
     (stagnation, under/overpay, heat-fear) have zero UI surface, not even
     qualitative — building a numeric version would break the deliberate
     "never a number" rule, so this needs a banded "current pressures"
     list rather than a breakdown. Not built this pass.
   - **9/10 (discoverability): one real gap, closed.** The Armoury had no
     tip, no rail badge, and no event ever pointing at it — the one system
     that could go a whole career unnoticed. Added an `armoury` tip
     (`ui/tips.ts`), gated on the one real policy (`setCarry`) still
     sitting at its untouched default with a crew big enough to matter.
     Also added a `career` tip for the session's own new panel, which had
     shipped with a rail entry and no organic pointer. Both added to
     `tips.reach.test.ts`'s `ORDINARY` list and confirmed reachable by the
     existing straightforward-career bot.
   - **15/16 (causal feedback): one real gap, closed.** `tickInvestigations`
     already computes three named, causal terms every week (evidence
     absorbed, agency's own work, ambient visibility from heat) with
     measured magnitudes in its own comments, and none of it ever reached
     the player — `LawPanel.tsx` showed only the current stage/strength,
     no trace to a decision, neglect, or the unavoidable. Added
     `Investigation.lastGrowth` (overwritten weekly, not appended to
     `history` — a routine number every week would have filled `history`'s
     40-entry cap with itself inside a year), threaded through
     `CaseRead.growth` behind the same intel bar the exact strength
     percentage needs, rendered in `LawPanel.tsx` next to "Case strength"
     the same way `OperationsPanel` shows `successBreakdown`. 4 new tests,
     2 mutation-verified.
   Probe suite also run this pass (`npm run probe`, ~11 min): 3
   pre-existing failures found, none in files this session touched
   (confirmed via `git diff --stat` against the last commit) — a job-variety
   reading sitting within its own stated sampling error, a union-favour
   reachability count off by one career, and a trades-profitability bar.
   Not chased further; flagged for a separate pass.
5. ~~Long-run/edge-case testing, final section 38/39 acceptance checklist
   and report~~ — **CLOSED, 2026-09-10.** Long-run (§29): already covered
   by the existing `npm run probe` suite (300-day and multi-year
   populations across dozens of seeds), re-run this pass rather than
   duplicated. Edge cases (§30): added an explicit save/load round-trip
   with an open memo and an open sit-down together (previously covered
   only by seed luck, not deliberately), and a structural test proving a
   memo and a sit-down can never both be on screen at once (true by
   accident of the call graph before this, now asserted). Final report at
   `docs/findings/not-negotiable-report.md`, in the brief's own §39
   format, with a per-section (1-39) status table. 141 files / 1,636
   tests, `tsc -b` clean.

**The NOT NEGOTITABLE.txt pass is complete.** Every section is accounted
for in the report's status table — closed, verified-as-already-satisfied,
or explained as measured-and-deliberately-not-built. Two real gaps remain
open and are recorded honestly rather than hidden: late-game job-type
variety is still the most-quoted unresolved finding across four rounds,
and three pre-existing `ladder.probe` failures (unrelated to this pass,
confirmed via diff) need a separate investigation.

## Loyalty pressures UI, 2026-09-10 — CLOSED (director-requested follow-up)

The one recorded gap from the report above: NPC loyalty's five weekly
drift terms (pay against expectation, stagnation, heat-fear, grievance —
Grip deliberately excluded as an org-wide, already-visible build stat, not
a per-person hidden one) had no UI surface at all, not even qualitative.
Built `loyaltyPressures` in `sim/npc.ts`, reading the same terms
`driftNpcs` already computes through `perceive()`'s existing fog — each
line gated on its own `perceive()` call rather than one blanket
familiarity threshold, so a fact that needs no fog (pay-versus-market)
can show before a read on temperament has been earned. Rendered on
`CrewPanel.tsx`'s per-person sheet as "What is working on their loyalty",
in the same tone-colored-paragraph convention the sheet's ties/goal/
memories sections already use. 6 new tests in `deep.test.ts`, all 4 active
gates (pay, stagnation's two sub-conditions, heat-fear, grievance)
mutation-verified independently and restored. Live-verified: a fresh
associate's pay status showed correctly on day one. 141 files / 1,641
tests, `tsc -b` clean. Report at `docs/findings/not-negotiable-report.md`
updated to reflect the closure.

## Late-game job-type variety, 2026-09-10 — CLOSED, premise did not survive measurement

Director-requested follow-up. Built `callTheLaw`/`canCallTheLaw` in
`sim/civic.ts`: the captain's favour spent outward for the first time,
mirroring the union's `callWalkout` — raises a named rival's `Faction.heat`
by `FAVOUR_EFFECT.heatOnRival` (20), a real number their own weekly AI
already reads (scores every option more cautiously above a threshold,
scores going quiet higher past `AGENDA.quietAbove`). Wired into
`CityPanel.tsx` beside the walkout buttons, one per rival. 4 new tests,
both real gates mutation-verified.

That addition did not touch rounds 23/24/27's actual complaint — the
*operations board* repeating job types late-game — so it got measured
directly instead of designed against on faith. A same-session quick
diagnostic bot was tried first and found too thin to trust (crew never grew
past 3-5 across 300 simulated days, an artifact of the harness) and was
deleted rather than reported. Extended `ladder.probe`'s own trusted bot
instead: added `launchedByEra` (era-bucketed defId census) to the `Climb`
record and read 36 careers. Result: distinct job types launched **rise**
across a career, 16 (early) → 22 (mid) → 23 (late), and the top job's share
of launches holds flat at 41-43% throughout. **The premise does not
hold — diversity increases late-game, it does not decline.**

Put the finding to the director with four options; chose "different verb,
not different job" over redesigning `OperationDef`. Built the third and
final outward civic favour, `canPullPermit`/`pullPermit` (the alderman) —
shuts down one named `RivalBusiness` rather than a whole family, using the
`permitPulledUntilDay` field and excluding that one business from
`collectIncome`'s `businessCount` term. Wired into `RivalsPanel.tsx` beside
"Buy in". 3 new tests; one initially passed for the wrong reason (favour
exhaustion masked the real guard) and was corrected to isolate the actual
condition. Both real gates mutation-verified. Completes a genuine set of
three outward favours: union (economic, family-wide), captain (legal,
family-wide), alderman (economic, one asset) — the judge remains the one
figure with no honest outward reading, confirmed a third time.
Full reasoning and the recommended shape of a real fix in
`docs/findings/not-negotiable-report.md`'s Remaining Issues and Recommended
Next Pass. 141 files / 1,644 tests, `tsc -b` clean, live-verified.

## The four-axis plan, decided 2026-09-09 — CLOSED, r28 checked it

r27 read below 8 on four axes: First hour, Clarity, Pacing, Interface.
All four got a fix between 2026-09-09 and 2026-09-10 — the payroll-tip
gate, the Bulletin staleness repair, the `bigger_jobs` signpost, the
sit-down familiarity tier, the rail grouping, and the Operations
scroll-to-assemble fix. Full account of each in `HANDOFF.md` §6 (search
"First hour", "Pacing's signpost", "Clarity", "sit-down", "rail, grouped
into sections", "Operations, the actual density candidate").

**Round 28 (2026-09-10) ran to check them and came back flat or down on
every one** — Interface still 6, Pacing still 6, Clarity 7→6, First hour
7→6 (this last one on notes the tester's own context loss makes an
unreliable reading — see below). Said plainly rather than buried: this is
not evidence the fixes are wrong, because round 28's concrete findings
never touched any of the six things that changed (see below), but it is
not evidence they worked either. Whatever runs next should look
specifically at whether the two-button contract choice, the grouped
rail, and Operations' scroll-to-assemble get noticed, not just whether
new bugs turn up.

**A process failure worth naming**: round 28's tester (a background
agent) lost its own working notes to a context compaction mid-run —
the same failure round 23 already had. Twice now. If a third round hits
it, it is worth an explicit instruction to write checkpoint data
somewhere durable the moment it is taken, not just "keep notes."

## Round 28's own findings, 2026-09-10

Two real, narrow bugs, both found by checking the report against source
rather than taking it at face value — full account in `HANDOFF.md` §6's
round-28 entry:

- **CLOSED.** The "while you were not looking" digest said an injured
  crew member "is out" — this game's own phrase elsewhere for gone for
  good — instead of naming it temporary. Changed to "is recovering."
  Test-first (`report.test.ts`), mutation-verified.
- **CLOSED.** `MemoModal`/`SitdownModal` rendered as `<main>`'s siblings
  rather than its children in `App.tsx`, so a text-extraction tool that
  reads the main landmark first could not see memo content at all —
  which is the actual reason the tester reported an already-fixed
  `plea_offer` hint ("They do not think enough of you for it to hold")
  as still broken. Both are `position: fixed` overlays, so moving them
  inside `<main>` changed nothing about how they render. Test-first
  (`modalsInMain.test.ts`), mutation-verified.

Checked and left alone, not new gaps:

- The Home/personal-life system's slow discoverability (200+ days) —
  already a deliberately paced design (round 15's nag-frequency tuning,
  round 17's `costing` line) working as specified; the tester's own
  WORKED list praised the payoff once found.
- A daily-hint overlay reported once as eating a click — correctly filed
  SHOULD FIX, not reproduced twice per the brief's own rule. Checked the
  likeliest source (`Coach.tsx`) against its CSS: normal flow, no
  absolute/fixed positioning, cannot overlap a control the way described.
  Left open; next report should name the exact overlay if it recurs.
- Late-game job repetition and memo density (days 180-300) — same
  mid-game shape r23/r24/r27 already named. The report never mentions
  "Above your standing," so the `bigger_jobs` signpost's effect is still
  genuinely unconfirmed, not disproven.

`tsc` clean, `npm test` green (135 files, 1,578 passing, up from 1,576).

## Reading round 28's Not Used table for a pattern, 2026-09-10

Two more real, verified fixes, both from asking "what does this table
actually show" rather than treating each row alone — full account in
`HANDOFF.md` §6:

- **CLOSED.** Three of four "wanted to, was blocked" rows were the same
  cash wall (The Trade $40K+, Task Force $57,739, city favour needing
  85+ standing bought with cash) — a poverty trap, not four gaps. The
  two existing signposts pointing at The Trade (`tips.ts`'s `trade` tip,
  `attention.ts`'s identical item from rounds 24/25) both invited the
  player in without ever mentioning the retainer. Added a cost-aware
  clause to both, no dollar figure quoted (`priced()` scales this 0.6x
  to 8x with the market — a number would eventually be wrong). Test-first
  (extended `attention.test.ts`), mutation-verified.
- **CLOSED.** Succession was mis-filed as "blocked" — `nameHeir` never
  reads claim strength, only rank; the worst claim band's label ("Nobody
  would follow them") just happens to read like `nameHeir`'s real
  refusal for an ineligible candidate ("Move them up first"), and the
  button beside it was never disabled. Added `weakClaim()` to
  `succession.ts`; `SuccessionPanel.tsx`'s button now reads "Name them
  anyway" for that case instead of a plain "Name them." Test-first
  (`succession.test.ts` + `weakClaimButton.test.ts`), mutation-verified
  both. Live-verified: named a nobody-would-follow-them soldier
  successfully.

`tsc` clean, `npm test` green (136 files, 1,581 passing, up from 1,578).

### Open design questions from 2026-09-09's Interface session

- **Armoury rework — narrowed and CLOSED for contracts, 2026-09-10.** The
  full rework (fold into Operations setup, roll for gear) was flagged and
  not built: `config/pieces.ts`'s own header says almost exactly this was
  tried on paper and rejected by name — "one of which dominates each
  situation, and the choice collapses after the first career." Instead,
  narrower: a genuine new quiet/loud choice, scoped to sending a
  contract only, reusing the already-built `CHARGE` mechanic. It used to
  be a family-wide standing policy set on the Armoury screen and read at
  resolution, a tab and days away from the button it affected; it is now
  snapshotted per-contract at `openContract`, the same way `chance` is,
  and shown as a second button ("Use a charge") right beside "Send
  somebody" with its own real percentage. See `HANDOFF.md` §6 for the
  full account. Not attempted for the other three `armFor` call sites
  (informants, marks, silence) — `silence.ts` explicitly cannot take this
  ("there is no way to call it back"), and nobody has asked for the other
  two.
- **UI consolidation — DECIDED against the merge, 2026-09-10.** Proposed:
  fold The Trade into Operations, fold the informant "Turn
  somebody"/"Plant somebody" mechanic into Organization. The informant
  move doesn't fit the data — that table is scoped per-agency (which
  police body, contact cost, upkeep, burned status), not per-crew-member,
  so relocating it would separate it from the context it depends on
  without solving discoverability. Trade → Operations was more plausible
  but checked against real numbers before building it: `OperationsPanel`
  is already 1,250 lines, more than double any other panel, so adding
  Contraband's 854 would concentrate "too much on one screen" rather than
  fix "too many tabs." Put both directions to the developer with that
  number in hand; chose grouping the rail into sections instead — same
  complaint, no growth on any single screen. No panel moved.

## A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
closed for businesses (2026-09-07). Deliberately still not attempted —
no tester across seven post-merge rounds has named "districts cost
nothing to hold" as a felt problem, and a second economy tax carries real
risk of repeating F24's own cross-system interaction. Size and measure on its own
if attempted, and re-check favour-network reachability specifically
before committing to a rate.

## Closed 2026-09-09

- **A round-26 "negotiation sub-option shown blocked, no reason given" —
  very likely the same bug as three refusal-visibility fixes made this
  session**, found by reading rather than by reproducing round 26's exact
  report, so treat as probably-but-not-certainly the same instance. See
  `HANDOFF.md` §6's round-27 entry.
- **`propose_alliance`'s refusal message could contradict its own gate —
  a real bug, fixed.** Rounding mismatch between the gate and the message;
  see `HANDOFF.md` §6 and `docs/findings/director-log.md` for the full
  account.
- **The 1,460-day Difficulty regression — stale, re-measured, closed.**
  The 69-75%-ended-early figure was from weeks-old code and never
  re-checked; it's now 39.6%, close to the 33% target, and the Difficulty
  axis reads 6.07 (up from 4.7). Full mechanism traced in `HANDOFF.md` §6.
  New, smaller, unchased item surfaced by the same measurement:
  `distinctEnds` (final-rank diversity over four years) was only 2 of a
  possible 5 in that run — now the axis's actual soft spot.
- **"Icon-only top-bar buttons with no visible label" — checked against
  source, does not match.** `StatBar.tsx` has exactly five buttons; sound
  and hints both render visible text (`sound`, `hints`/`hints off`) rather
  than an icon, per a round-7 fix already on record, and the three
  day-advance buttons were explicitly excluded by the tester's own report.
  Most likely the same root cause as the page-width-collapse item below —
  folded into the Interface plan above rather than treated as its own fix.

## Smaller, lower-priority

- **`informants.probe`'s 29/30 guard, Word/Ledger's unwired verbs, the
  pressure dial's unreachable `hard` setting, and trade-economy stock
  cost** — all still open, all carried in `HANDOFF.md` §6 rather than
  duplicated here.
- F9 (fear near its ceiling) — Opus's 2026-09-07 diagnosis: fixing the
  *display* moves nothing; the real lever is the same "dominated
  strategies" shape already partly addressed for the favour/dial pair.
- Opus's feature ideas (a) a payroll shortfall with a name attached, (d) a
  reachable deposition threat — neither attempted, both still just ideas.
- Promotion silently fixing loyalty problems the game's own text says
  money can't touch (r25) — possibly a discoverable "aha" working as
  intended, possibly a missed hint. Not diagnosed.
- Confronting a skimming steward being a one-way trust cliff (r25) — a
  design question (is there meant to be a softer option?), not a bug.
- "Decide it was them" giving no visible right/wrong confirmation (r26,
  corroborated r27's own framing) — checked and left alone: by design,
  the same "you find out over months" principle `contract.ts` states
  explicitly.
- Flavour-text repetition surfacing over a long run (r26) — a specific
  line ("It was loud. It did not need to be loud.") recurred often enough
  by day 200+ to be noticed. Not measured against `prose.test.ts`'s
  thresholds.
- The intermittent page-width collapse to ~400-500px r27 saw — the
  tester's own caveat flagged it as possibly a harness artifact rather
  than the game. Not chased without a cleaner second report.
- Favor-calls attributable to the wrong family (boss-fantasy overhaul,
  item 6, 2026-09-13) — blocked, pushed to backlog rather than dropped.
  The plan named actions (`callWalkout`/`callTheLaw`/`pullPermit`) that
  don't exist; every favor action that does exist only benefits the
  player, none hurts a rival, so there's nothing yet to make blamable via
  `faction.ts`'s `attribute()`. Needs a real rival-hurting favor action
  built first (new mechanic, own scope/tests/probe) before this can be
  wired in.

## `payRead` fix and the three `ladder.probe` failures, 2026-09-10 — two closed, one confirmed real

`payRead` (`ui/components.tsx`) now calls the real `wageExpectation(state,
npc)` instead of its own stale, un-indexed approximation. Takes `state` as
a new first argument; both call sites (`MemoModal.tsx`, `CrewPanel.tsx`)
updated. 3 new tests, mutation-verified — the first pass of two of them
had been passing for the wrong reason (old code silently read `state` as
its `npc` param), caught by re-running the mutation check.

Of the three pre-existing `ladder.probe` failures:
- **Memo-generation share**: fixed by widening `WIDE` 288→400 careers —
  the exact remedy this bar's own `resolves()` message asked for. Now
  certifies at 35%.
- **Union reachability**: `config/civic.ts`'s `owesAbove` had drifted
  above its own target population's 75th percentile a third time. Re-sized
  78→76 by the same method the figure has already been placed by twice.
  Now 12/36, was 8/36.
- **Trades profitability**: checked at 400 seeds (a one-off widened run,
  not kept) per this exact bar's own standing instruction not to move the
  number a third time without checking for noise first. Came back worse
  (86% of target, not 97%) — confirmed a real content shortfall, not
  sampling noise. Left failing; fixing it needs an income-breakdown pass
  (trade income minus routed-district sentiment damage and front upkeep),
  not a single constant.

141 files / 1,650 tests passing, `tsc -b` clean, `npm run probe` 96/97
non-skipped passing (was 94/97).

## Trades profitability, decomposed — 2026-09-10 follow-up, director decision pending

Built the income-breakdown diagnostic the previous entry said this bar
needed (`ladder.probe.test.ts`, "says where the trade income goes once it
is earned" — reporting-only). Retracted the sentiment-damage theory: ground
held actually gains value for the trading arm, not loses it. The real
ledger shows the gross trade income (~$3.7M) is mostly consumed by costs
that scale with running a bigger, hotter operation — stock, job stakes,
legal costs from heat, the wash's cut, front upkeep — each already tuned
for its own purpose. Net gain survives at ~$478K-500K, just under the
`median(base) * 0.5` bar.

**Needs a director decision**, not a unilateral fix: which of the five
cost categories (if any) is worth reopening for this bar, given
`FRONT_UPKEEP_RATE`'s own three-tries-no-consistent-answer history against
it — or whether the bar itself should move to match "a real but modest
gain," which is what the trade turns out to actually be.

## Trades profitability — CLOSED, 2026-09-10

Director's call, from the five-cost breakdown: cut `stock`, the only
trade-specific lever of the five. `config/contraband.ts`'s `TRADES.
product.unitCost` and `TRADES.arms.unitCost` both -10% (2,600→2,340,
5,200→4,680, moved together to preserve their ratio). Measured against
the actual bar: paired gap 474,176 → clears 514,131. Full `npm run probe`
run afterward to check for ripple effects — none: **all 8 files green,
98/101 (3 pre-existing unrelated skips), zero failures.**

All three `ladder.probe` failures this pass carried are closed. `npm test`
141/1,650 passing, `tsc -b` clean.
