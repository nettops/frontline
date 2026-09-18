# Director log

One entry per iteration. Read it before starting the next one; its purpose is to
make it obvious when the game has stopped improving.

Rules it operates under: `docs/DIRECTOR.md`.

**Two stretches are archived, in this same directory.** Iterations 0-3 and
the round 11 repairs (2026-08-20/21) are in
`director-log-archive-iterations-0-3.md` — closed findings whose one
durable conclusion (the 300-day sizing rule) is preserved in full in the
entry immediately below and in `HANDOFF.md` §5. A separately-developed
branch's own Iteration 9 through round 21 (2026-09-01 to 2026-09-07,
merged into this history 2026-09-08) is in
`director-log-archive-branch-iteration9-round21.md` — its durable state is
in `HANDOFF.md` §0. For current state, read `HANDOFF.md` first; this file
is the detailed per-iteration record behind it.

---



**Entries 2026-08-21 → 2026-09-10 (blind rounds 12–28, iterations 5–8,
the influence/favour work, the parallel-branch merge) are archived in
`docs/findings/director-log-archive-rounds12-28.md`.** Earlier archives:
`director-log-archive-iterations-0-3.md`,
`director-log-archive-branch-iteration9-round21.md`.

## NOT NEGOTITABLE.txt, phase 1: signposting, accessibility, a real career history — 2026-09-10

The director handed over a 39-section acceptance spec (`NOT NEGOTITABLE.txt`)
with instructions to audit, implement, test, and re-verify without asking
for permission between phases. Four scope forks were genuinely ambiguous
enough to put to the director rather than guess — comprehensive vs. cosmetic
event tiering, whether to build a standalone Career History panel at all,
whether new late-game systems could reopen a design already rejected once
(the "connected jobs" rank-unlock in `config/operations.ts`), and whether
Word/Ledger's dead verbs get real mechanics or stay honestly labeled
unreachable. All four came back at the most ambitious option.

**Accessibility.** `OperationsPanel`'s crew-picker table let a player click
a row past the job's crew cap and nothing happened — no cursor change, no
message, just a click that did nothing. Rule four of this project exists
for exactly this. Fixed by computing `full` per row and disabling the click
with a title explaining why, mutation-verified.

**Ambiguous language.** `informants.ts`'s `Presence.gone` flag collapsed
"dead" and "defected" into one boolean, so `IntelligencePanel` called a
defector "no longer with you" — the same sentence for a corpse and a man
who could surface as a witness against you. Split into `fate: 'dead' |
'defected' | null`, kept `gone` for its existing sort use.

**Family weight.** `EventContext.atHome` had exactly one consumer
(`gen_asked_for_you`) and no event that made home and business actually
compete for the same night. Added `gen_home_or_business`: refuse it and
take the retainer, or go home and lose the money but keep respect and
avoid neglect. Two pre-existing test regexes needed honest extension for
this to land clean rather than be worked around — `variation.test.ts`
(a new body variant had dropped `${relation}`) and `priced.test.ts`'s
narrow "receiving" allowlist (a new payout-shaped hint, `Pays $X tonight`,
needed recognizing as money coming in, not a cost).

**Career History (sections 11/12/21).** No cross-system browsable timeline
existed — `state.log` rotates at 400 entries (a 300-day career has already
lost half of it), and `chronicle.ts` is crew-roster-only and explicitly
argues against building a second recorded list, citing four prior bugs from
exactly that pattern. Built `sim/career.ts` as primarily a snapshot-diff
(`recordCareerMilestones`, called once a day in `clock.ts`) — automatic,
can't be missed the way a write-at-every-call-site hook can — and kept
direct writes (`recordCareerEvent`) to the three genuinely undiffable cases:
two contract-kill call sites in `contract.ts` (a rival capo/boss dying moves
nothing in the player's own state a snapshot could see) and the new
home-vs-business escalation. An indictment hook was drafted as a direct
write and then converted into a snapshot-diffable one (`indicted: string[]`
on `CareerSnapshot`) specifically to shrink that surface further. 11 tests,
one per diff branch plus the `CAREER_LIMIT` safety valve; mutation-verified
two of them (the capo-promotion threshold, the limit constant).

New standalone `CareerPanel.tsx`, mirroring `SuccessionPanel`'s existing
chronicle convention (oldest-first, tone-colored paragraphs, short-day
marker) rather than inventing a new one. Wired into the rail's Records
group, gated off in Simulation/watching mode (a career belongs to a
player, and watching mode has none). Source-scan tests for the panel body
and its rail/App wiring; mutation-verified the watching-gate.

`tsc -b` clean. `npm test`: 138 files, 1,601 passing (up from 136/1,581).

Live-verified in a fresh isolated `mafia-verify` instance (a new one, not
reused from earlier diagnosis work — same standing rule as the succession
fix above). Confirmed: the Career panel's empty state renders correctly
before anything has happened; the panel continues rendering correctly
underneath an active memo/bulletin overlay without throwing; the rail
button, its tooltip, and the Records-group placement all match what was
built; advancing multiple in-game weeks and resolving several memos (a
docks introduction opportunity, a Word approach) produced no console
errors and no broken layout.

Still open, in priority order: the event-severity/digest-batching rework
(sections 4/5/20), new late-game systems (13/25), Word/Ledger real
mechanics (27), and the long-run/edge-case testing plus final section
38/39 checklist. None of these were started this pass — see `.ai/TASKS.md`.

---

## NOT NEGOTITABLE.txt, phase 2: measuring before building, and two real late-game systems — 2026-09-10

**Sections 4/5/20 — measured, not built.** The brief's literal ask was a
3-tier severity model and a "DAILY BRIEFING" digest to stop informational
events becoming administration. Audited the whole pipeline first
(`sim/pace.ts`, `sim/clock.ts`'s `advanceDays`, `MemoModal.tsx`,
`report.ts`/`Bulletin.tsx`) and found the actual architecture already
separates the two things the brief was asking to separate: `MemoModal` is
real decisions, one at a time, deliberately unskippable by design (a memo
nobody can answer stops time forever, on purpose — see
`systems-in-depth.md`); `Bulletin`/`report.ts` is a completely different,
already-batched, already-capped-at-3-lines digest of everything else. The
question worth asking before building a third thing was whether the two
existing channels actually collide often enough to feel like administration.
A temporary diagnostic (40 seeded careers, `newGame` + `advanceDay`, deleted
after the reading, per this project's own convention for this class of
measurement) found same-day multi-event pushes on 7 of 2,203 event-raising
days — 0.3% — and an `info`+`info` collision exactly once in 24,000 days.
Danger-severity interrupts, the only kind that stop a multi-day span's
auto-resume and demand a manual "Carry on", land roughly once every 200
days at the measured rate. The design doc's own account of the felt
problem — "clicking through five of them is the slowest part of playing
this" — already has a shipped fix: `MemoModal`'s number-key hotkeys, built
for exactly that complaint. Building a new digest UI would touch a
deliberately-protected piece of identity (the memo's own header calls it
"a typed page on the desk," not a dialog) to fix a collision that
essentially does not occur. Filed as measured and verified rather than
built, the same shape as the round-18 heat repair.

**Sections 13/25 — a real late-game system, not the parked one.** The
"connected jobs" (Fix a Case, Union Walkout, Police Escort, Joint Venture)
were flagged by the director as worth reopening despite their own
postmortem. Reading that postmortem closely first paid off: the four jobs
would have gated on `favoursOwed[figure] >= 1`, and `civic.ts` already runs
a fully-built, carefully-tuned favour network (captain, union, judge,
alderman) with the identical currency and the identical defect already
diagnosed and half-fixed once (`askForWork` was added specifically because
the first spend, `spendFavour`, was measured never being used). Reviving
the parked jobs as originally scoped would have built a second, weaker
copy of a system that already exists. What that system genuinely could not
do — everything `apply()`'s four grants do is self-directed, protecting the
player's own case, own man, own district, own pressure — is reach outward.
So the new content is narrow and real: "Call a Walkout," the union boss's
favour spent against a named rival instead of on a problem of the player's
own, for the first time. Mechanically: `canCallWalkout`/`callWalkout` in
`sim/civic.ts`, a lazy `Faction.walkoutUntilDay?`, and a suppressed
business-income term in `faction.ts`'s `collectIncome` (exported specifically
so the effect could be measured in isolation from a rival's own weekly AI
decision, which shares the same `rng` stream and would otherwise contaminate
a before/after diff). Deliberately does not touch the rival's own `wealth`
directly — `AI.invest.incomePerBusiness` is tuned against measured
populations, and a vig skimmed off one front among several is not the kind
of dent that number was sized to absorb; the player's stake income
(`tickStakes`, see below) is paid from nowhere rather than levered against
it. Wired into `CityPanel.tsx` beside the existing two favour buttons, one
per rival, each carrying its own real refusal reason on the button itself
rather than only in a tooltip.

**Section 27 — Word.** `canCallATable`'s own doc comment described removing
"the invitation" for a rival sit-down; `canSitDownWith`, the function
actually called by both `DiplomacyPanel` and `CrewPanel`, never checked the
stat at all — houses were reachable regardless, which `PlayerPanel.tsx`'s
own "design gap" comment already said plainly. Considered and rejected the
literal original design (gate every proactive rival approach behind Word)
because it would have broken the generosity several existing tests and the
diplomacy screen's own design rely on, and would have made a war forced
onto the player by an aggressor potentially unnegotiable for a build that
never invested in Word. Landed on the narrower, real restriction: a house
**actively at war** will not sit down with a boss whose word carries
nothing yet; peace and crew stay open to everybody. Not a hard lock — the
family's own `peace_offer` event still reaches a Word-less player, and
`faction.ts`'s war-weariness still wears both sides down regardless; this
only gates the player's own initiative to *ask*. `canCallATable`'s own
comment was rewritten to point at the real restriction rather than describe
one that never existed.

**Section 27 — Ledger.** `canBuyIn`/`buyIn` could only ever resolve against
`state.businesses`, which holds nothing but the player's own fronts — there
was no rival business to name, confirmed by grep: `acquireBusiness` is the
only write site. Built the minimum model that fixes this without turning a
rival's economy into a second simulation: `RivalBusiness` (id, faction,
`defId` for a name, `territoryId` or null, optional `stake`), materialized
one at a time at the one place a rival's front actually comes into being —
`faction.ts`'s `executeInvest`, already incrementing `businessCount` — not
backfilled for a count a family was already carrying, so an old save
simply has fewer of a rival's fronts on record than it has counted, which
is honest rather than fabricated. The business's type and street are pure
flavour a player can look at and nothing reads back, so they are drawn from
`Rng.stableNoise` through the same `say()` helper the investment's own log
line already uses two lines above — never the causal `rng` this function
was never even passed, per this project's determinism rule. `canBuyIn`/
`buyIn` retargeted at this new collection; `Business.stake` (dead — nothing
but these two functions ever read or wrote it, confirmed by grep) removed
from the player's own front type rather than left stale. A weekly
`tickStakes` pays the stake share of `AI.invest.incomePerBusiness` as dirty
cash, gated the same way `tickCard` gates itself. A new "What they have
bought in the neighbourhood" section on `RivalsPanel.tsx`'s per-house page,
gated on the same `FACTION_INTEL_ROUGH_ABOVE` line that already decides
whether the investment itself is visible in the log — knowing about a
business the game never told you existed would be a second, inconsistent
route to the same fact.

Both verbs' entries came off `PlayerPanel.tsx`'s `VERB_NOT_YET_REACHABLE`
map, which the map's own updated comment now says plainly is empty rather
than silently dropping to `{}` with no explanation.

Test-first throughout: `civic.test.ts` (4 new tests on the walkout, one
isolating `collectIncome` from a rival's own weekly decision to avoid
measuring the wrong thing), `sitdown.test.ts` (4 new tests on the war
restriction), `faction.test.ts` (4 new tests on materialization, one a
determinism check against two identical seeds), `verbs.test.ts` (6 new
tests on buy-in/stake payout), and a source-scan test each for the
`CityPanel.tsx` and `RivalsPanel.tsx` wiring, matching this project's
no-jsdom convention. Mutation-verified the load-bearing branches in each
sim-level file (the walkout's active-window guard, the income suppression
condition, the stake-already-held guard, the weekly-gate condition, the
at-war refusal condition) — every one failed correctly with the fix
reverted, then was restored.

`tsc -b` clean throughout. `npm test`: 138 files, 1,619 passing (up from
1,601 at the start of this phase). Live-verified all three UI surfaces in
fresh isolated `mafia-verify` instances: the walkout buttons render
correctly disabled with their real refusal reason on the City panel; the
rival-businesses section correctly renders nothing at all (not even an
empty state) below the intel threshold on the Rivals panel, matching the
project's own rule that a hidden fact stays hidden rather than merely
having its detail fogged.

Still open: sections 7/8/9/10/14/15/16/29/30/33 (message clarity against
the itemized-odds philosophy, remaining discoverability cues, causal
feedback, long-run and edge-case testing, performance) and the final
section 38/39 acceptance checklist and report.

---

## NOT NEGOTITABLE.txt, phase 3: auditing the rest, and two real fixes — 2026-09-10

Ran `npm run probe` (the full ~11-minute suite, not run since before this
session's changes) to check the balance-adjacent work in phase 2. Three
failures came back: a job-variety reading sitting exactly within its own
stated sampling error (the test's own message says so), a union-favour
reachability count off by one career (8 of a needed 9), and a
trades-profitability bar. Checked `git diff --stat` against the last commit
for every file these three measure (`config/civic.ts`, `config/factions.ts`,
`config/eventgen.ts`, `config/market.ts`, `sim/contraband.ts`) — only
`config/civic.ts` (+10 lines, the walkout duration constant), `config/
eventgen.ts` (+32, the home-or-business event), and `sim/civic.ts` (+50, the
walkout functions) diverge from `main`, and none of the three failing tests'
mechanisms touch anything in that diff: the union test's `everOwed` flag is
set the moment `owed` is ever observed positive during simulation, monotonic
and unaffected by later spending; the probe bot that measures it calls the
pre-existing `spendFavour`, never the new `callWalkout`; `Rng.stableNoise`
(used for the new rival-business flavour) is a pure static hash with no
access to `this.state`, confirmed by reading `rng.ts`, so it cannot have
perturbed the causal stream any other test depends on. Filed as pre-existing
findings rather than regressions, flagged for a separate pass rather than
chased here.

Then audited sections 7, 8, 9, 10, 14, 15, 16 and 33 against the actual
codebase rather than the brief's assumptions, the same discipline the
event-tiering measurement used in phase 1. Three read genuinely satisfied
already and needed nothing: 7 (event messages) — sampled bodies across
`events.ts`/`eventgen.ts` and found the what/why/action shape already
present, with no instance anywhere of the brief's own bad example; 14
(repetition escalates) — `standingOrders.ts`'s `PATTERN` mechanic already
prices repeated play with a measured, documented history, and tiered jobs
already reframe the same activity as a career climbs; 33 (performance) —
`clock.ts`'s tick functions are already disciplined about `% N` gating, and
the one daily-unconditional function checked (`recordCareerMilestones`,
shipped this session) is bounded, cheap, and was already reasoned about at
the call site.

Two real, previously-unknown gaps did turn up, both closed:

**Discoverability (9/10).** The Armoury had no tip, no rail badge, and no
event pointing at it — confirmed by grep, zero hits in both `tips.ts` and
`attention.ts` — the one system in the whole rail that could plausibly go
an entire career unnoticed, the exact failure mode this section's own
preamble describes. Fixed with a new `armoury` tip gated on the screen's
one real decision (`setCarry`) still sitting at its untouched default with
a crew large enough for it to matter. The session's own new `CareerPanel`
had the identical problem — a rail entry with no organic pointer — fixed
the same way, gated on a chapter actually existing. Both added to
`tips.reach.test.ts`'s `ORDINARY` list and confirmed reachable by the
existing straightforward-career bot without needing a new one.

**Causal transparency (15/16).** `tickInvestigations` already computes
three named, causal terms every week for a case's growth — evidence
absorbed, the agency's own work, ambient visibility from heat — and its own
comments even quote the measured weekly magnitudes each contributes. None
of it ever reached a screen: `LawPanel.tsx` showed only the current
stage and strength, with no way to trace a case's growth to a decision
(evidence left behind), neglect (staying loud), or the agency's own
unavoidable work. Fixed by adding `Investigation.lastGrowth`, overwritten
each week rather than appended to the case's existing `history` array —
appending would have filled `history`'s 40-entry cap with nothing but a
routine weekly number inside a year, pushing out the headline moments
(informant flips, evidence-tamper backfires) that already live there and
are already rendered via `CaseRead.known`. Threaded through as
`CaseRead.growth`, gated behind the same `CASE_INTEL_STRENGTH_ABOVE` bar
the exact strength percentage already needs — a breakdown of a number you
cannot precisely see would hand over more than the fog is for. Rendered in
`LawPanel.tsx` beside "Case strength", following the same pattern
`OperationsPanel.tsx` already uses for `successBreakdown`.

One further real gap was found and deliberately left unbuilt: NPC loyalty's
weekly drift terms (stagnation, under/overpay, heat-fear, grievance) have
no UI surface at all, not even qualitative, unlike Heat's three-channel
breakdown or business health's worst-cause label. Building a numeric
version would violate `perceive()`'s explicit "never a number" rule for
hidden NPC stats, so the right fix is a banded qualitative list rather than
a breakdown widget, and that is a different, smaller design task than what
this pass had scope for — recorded rather than built.

Test-first throughout: 2 new tests each for the `armoury`/`career` tips
(shown/hidden transitions), mutation-verified; 4 new tests for
`lastGrowth`/`CaseRead.growth` (the split into three terms, and the intel
gate matching `strength`'s own), 2 mutation-verified; a source-scan test
for the `LawPanel.tsx` wiring. `tsc -b` clean throughout. `npm test`: 139
files, 1,633 passing (up from 1,619 at the start of this phase).

Still open: sections 29/30 (long-run and edge-case testing) and the final
section 38/39 acceptance checklist and report.

---

## NOT NEGOTITABLE.txt, phase 4: edge cases and the final report — 2026-09-10

Closed sections 29 and 30. Long-run testing (29) needed no new work: the
existing `npm run probe` suite already runs 300-day and multi-year
populations across dozens of seeds, and had just been re-run in phase 3.
Duplicating that machinery for this section specifically would have been
exactly the kind of unrequested scaffolding this project's own conventions
warn against.

Edge cases (30) got two additions, both aimed at the brief's own literal
examples rather than invented ones. First: `sim.test.ts`'s existing
save/load round-trip test calls `advanceDays(state, 60)`, which — because
`advanceDays` halts on any pending event — has *sometimes*, by seed luck,
saved a state mid-memo. That was never deliberate. Added an explicit
version: loop `advanceDay` until a memo actually raises (bounded, on a
fixed seed, so it is deterministic rather than lucky), open a sit-down on
top of it directly, and confirm the save round-trips exactly. The UI
cannot reach this combination through normal play — a memo's backdrop
blocks every click including one that would open a room, and a sit-down
blocks the day from advancing at all, which is the only way a new memo can
be raised — but a state written to disk with both present, from an older
build or a future regression, still has to load back rather than throw.

Second: made the "cannot reach it through normal play" claim itself into
an asserted, protected fact rather than an argument in a comment. A source
scan confirms `App.tsx`'s `step()` still contains `if (s.sitdown) return;`,
and a CSS-file read confirms `.memo-backdrop` is still `position: fixed;
inset: 0` with no `pointer-events: none`. Together these are the two
guards that make modal-on-modal structurally impossible; neither was
previously tested as a *pair*, so a future edit to either could have
silently reopened the gap this section asks to verify closed.

Wrote the final report at `docs/findings/not-negotiable-report.md`, in the
brief's own required §39 format (Changes Made, Systems Preserved, Bugs
Fixed, Discoverability/Pacing/Accessibility Improvements, Testing,
Remaining Issues, Recommended Next Pass), plus a full per-section 1-39
status table the preamble's "no silently skipped requirements" rule
requires. Three items are recorded as genuinely open rather than
papered over: NPC loyalty's weekly drift terms have no UI surface at all
(found in phase 3, correctly left unbuilt because a numeric version would
break the deliberate "never a number" rule); late-game job-type variety
remains the single most-quoted unresolved finding across four independent
rounds, and this pass's new content (the walkout) does not resolve it,
which the report says plainly rather than implying otherwise; and the
three `ladder.probe` failures from phase 3 are flagged for a dedicated
investigation rather than guessed at.

Final numbers for the whole pass: 141 test files, 1,636 tests passing (up
from 136 files / 1,581 at the start), 8 skipped throughout, `tsc -b` clean
at every step. `npm run probe`: 93 of 96 passing, the 3 failures confirmed
pre-existing and unrelated. No `SAVE_VERSION` change across the entire
pass. Nothing committed — per standing instruction, commits happen only
when asked.

---

## NOT NEGOTITABLE.txt, phase 5: the loyalty pressures UI — 2026-09-10

Director-requested follow-up to the final report's one recorded, not-yet-built
gap. `driftNpcs` (`sim/npc.ts`) computes five real weekly terms for loyalty —
Grip, pay against expectation, stagnation, heat-fear, and an unresolved
grievance — and none of them had any UI surface before this, not even
qualitative.

Built `loyaltyPressures(state, npc)`, deliberately modelled on `perceivedGoal`
rather than on `successBreakdown`: the doc comment explains why a numeric
breakdown (the pattern `successBreakdown` and the case-strength growth
reading both use) was the wrong template here specifically — every one of
loyalty's terms reads a stat `perceive()` exists to fog, and a breakdown
would hand over the raw numbers that fog exists to withhold. Instead each
candidate line checks its own `perceive()` call independently rather than
gating the whole feature behind one familiarity threshold, which turned out
to matter in practice: pay status needs only `greed` known, and greed
resolves at low familiarity, so a fresh associate already shows a pay
reading on day one (confirmed live) while stagnation/heat-fear/grievance
stay blank until the player has actually gotten to know him.

Grip was deliberately left out, and the doc comment says why: it is the
same number for every person in the family, it belongs to the player's own
build rather than to anything hidden about the NPC, and it is already
visible on the Yourself screen. Repeating an org-wide constant on every
row would be noise dressed as a reading, not a fifth pressure.

One correctness note left unfixed on purpose: `components.tsx`'s existing
`payRead` (used elsewhere for a pay-status chip) approximates wage
expectation with its own formula rather than calling the real
`wageExpectation`, and the two have drifted — no price indexation, no
trait effect, a different curve. `loyaltyPressures` calls the real
function instead, so the new reading is correct where the old chip's was
already an approximation nobody had revisited. Left `payRead` itself
untouched since fixing it was not what was asked and touches two other
call sites outside this feature's scope; worth a small, separate pass.

Rendered on `CrewPanel.tsx`'s per-person detail sheet, in the same
tone-colored-paragraph block the sheet's ties/goal/memories sections
already use, positioned right after "Who is behind them" and before "What
they have not forgotten" — after the social reads, before the record of
what has already happened to him.

Test-first: 6 new tests in `deep.test.ts`'s existing "people want things"
neighbourhood (a stranger shows nothing; pay flips between the two
readings; stagnation requires both high ambition and no recent good thing,
tested against both failing independently; heat-fear requires both a hot
street and a fearful man, same independent-failure structure; grievance
has a real threshold). Mutation-verified all four active gate conditions
one at a time — the pay comparison, both sub-conditions of the stagnation
guard, the heat-fear guard, the grievance threshold — each failed
correctly with the condition weakened, then was restored.

`tsc -b` clean. `npm test`: 141 files, 1,641 passing (up from 1,636).
Live-verified in a fresh isolated `mafia-verify` instance: opened a
starting associate's detail sheet on day one and confirmed "Paid enough
that money is not the question" rendered correctly, in the right place,
with the right tone.

This closes the only concretely-scoped gap the final report's audit had
found and not built. The report itself
(`docs/findings/not-negotiable-report.md`) and `HANDOFF.md`/`.ai/TASKS.md`
were updated to reflect the closure. Remaining open items, unchanged from
the report: late-game job-type variety (four independently-confirmed
rounds) and the three pre-existing `ladder.probe` failures from phase 3.

---

## NOT NEGOTITABLE.txt, phase 6: late-game job-type variety, honestly partial — 2026-09-10

Director-requested follow-up to the second item in the final report. Read
the actual claim precisely before building anything: rounds 23, 24 and 27
all named the same thing — the operations board keeps handing back the same
handful of job types from day 30 to day 300 — and this project's own
`config/operations.ts` already carries a structural admission of the same
problem in a different guise: `OperationDef`'s `cooldownDays` field's doc
comment records three separate, measured, failed attempts to fix
`call_in_tribute` dominance by adding a second currency inside this exact
table, each one moving the wrong job's numbers instead of the intended one.
Reading `OperationDef` itself settles the literal question without needing
a probe: it is six fields (crew, district, approach, investment, payout,
duration, odds) for every tier from 0 to 5, and tier only changes the
numbers on those same six fields. There is no mechanism anywhere in the
data model for a late-tier job to be a *different kind of thing* — which is
exactly what section 13 asks for and exactly what "just add more jobs"
cannot fix, since more entries of the same shape is the thing already tried
and already measured not to work.

**Attempted a proper measurement before designing anything**, matching how
the event-tiering question was handled in phase 1: built a temporary
diagnostic (30 seeds, 300 days, a defId histogram bucketed early/mid/late)
to get the actual current numbers rather than trust four-round-old
testimony, which this session had already found stale once (the 1,460-day
difficulty regression, closed earlier this session on re-measurement). The
diagnostic's own bot turned out to be the problem: crew never grew past 3-5
people across the whole 300-day run because its recruit/territory logic was
copied from a lighter-weight existing bot without the care a real reading
needs, so the resulting histogram (2 defIds, `work_it_yourself`/
`freelance_muscle` dominating every bucket) was a fact about the harness,
not about the game — the exact "an instrument returning a believable
number while measuring nothing" failure mode this project's own culture
names directly. Deleted rather than reported. A real reading needs the
same care `ladder.probe`'s populations already get (its `WIDE` set and the
`keeps finding something to say in the back half of a career` test are the
closest existing scaffold, measuring a related but distinct claim about
memo variety), not a same-session quick loop.

**Built what could be built responsibly without that measurement**: a
second instance of the "spend a civic favour outward" pattern the walkout
established in an earlier phase. `apply()`'s four grants are all
self-directed (bury the player's own case, spring the player's own man,
calm the player's own street, hold off pressure on the player). The
walkout already found one honest exception — the union boss can also empty
a rival's street. Reconsidered the other three against the same test
(`canCallWalkout`'s own doc comment previously argued none of them had an
honest outward reading, and that comment needed updating rather than just
extending, since it's the record of a judgment call this phase revisited):
the alderman's grant is about the player's own city-hall file, which does
not exist for a rival, so still no honest reading there. The judge springs
a *specific man* from a *specific cell*; a rival's own crew are `Capo[]`
and a count, not individuals the sim can name one of, so still no honest
reading there either. The captain is different: `bury_a_case` cools a live
file of the player's own, and `Faction.heat` is a real, already-simulated
number a rival's own weekly decision-making already reads — it scores
every option more cautiously as heat rises and specifically scores the
"go quiet" option higher past `AGENDA.quietAbove` — so a captain's
division taking an interest in somebody else is a lever with genuine,
already-wired behavioral consequences, not a cosmetic number. Built
`canCallTheLaw`/`callTheLaw` (`sim/civic.ts`), a straight mirror of
`canCallWalkout`/`callWalkout`'s shape, raising `target.heat` by
`FAVOUR_EFFECT.heatOnRival` (20 — sized to clear `quietAbove` for a
rival at the population mean and to cross `heatAlarmAbove` for one already
running hot, so the favour buys a real change in posture rather than a
number `heatDecayPerWeek` erases before it would be noticed). No duration
field needed, unlike the walkout — heat already decays on its own via the
mechanism the game already has. Wired into `CityPanel.tsx` beside the
walkout buttons, same one-button-per-rival layout, same honest-refusal-on-
the-button convention.

Said plainly, because this project's own rules require it rather than
letting two real, tested additions read as a solved finding: **this does
not fix rounds 23/24/27's complaint.** It gives the civic network real
reach in both directions it can honestly go (economic via the union, legal
via the captain), which is genuine "manage a problem, not pick a job"
content and a second data point that the walkout's pattern generalizes —
but it is still an addition beside the operations board, not a change to
it, and the operations board is what the finding is actually about. A real
fix needs new content shaped differently from a job entirely (a standing
commitment, a multi-week campaign — something that plays out over time
through periodic decisions rather than a crew-and-launch action resolved
in days), built against a properly-measured baseline, as its own dedicated
pass rather than a session's addition to an existing table. This is
recorded as the report's top remaining item rather than implied solved.

Test-first: 4 new tests in `civic.test.ts`'s existing "helping somebody
outside the family" neighbourhood (refuses with nothing owed; spends the
favour and raises heat by exactly the configured amount, clamped; refuses
against a house already finished). Both real gates (the strength-zero
refusal, the heat-application line) mutation-verified and restored.

`tsc -b` clean. `npm test`: 141 files, 1,644 passing (up from 1,641).
Live-verified in a fresh isolated `mafia-verify` instance: the "Have them
looked at" buttons render correctly under the captain's row, correctly
disabled at day one with the real `canSpendFavour` refusal reason on every
button, matching the walkout's own established honest-refusal pattern.

Report at `docs/findings/not-negotiable-report.md` updated: the Remaining
Issues entry now states plainly that the core finding is open and why, and
Recommended Next Pass carries the concrete shape a real fix needs — not
another `OperationDef`, measured before designed, scoped as its own pass.

## Phase 7 — late-game job-type variety, measured (2026-09-10)

Phase 6 built `callTheLaw` but explicitly did not resolve rounds 23/24/27's
actual complaint: the operations board repeating job types late-game. That
phase's report closed with a plan to measure it properly before designing
anything, using `ladder.probe`'s own trusted bot rather than a same-session
diagnostic. This phase did that.

Extended the `Climb` record in `ladder.probe.test.ts` with `launchedByEra`
— a job-type census split into the same three eras `launchEra` already
buckets by (day<90/<180/else). Added it at both existing `launchedBy[def.id]`
increment sites, additively, with no change to any existing behavior.
Verified it against the pre-existing career-total `launchedBy` numbers from
the "wall at tier four" test before trusting it: the three eras summed
exactly to the known totals (e.g. `work_it_yourself` 6305 = 2012+1839+2454).

Added a reporting-only test, `late-game job-type variety`, and read 36
careers (`RUNS_300`). Result:

    early (day <90):  4690 jobs, 16 distinct ids, top "work_it_yourself" 43%
    mid (90-180):     4441 jobs, 22 distinct ids, top 41%
    late (180-300):   5907 jobs, 23 distinct ids, top 42%

**Distinct job-type diversity rises across a career, and the dominant job's
share of launches barely moves.** Rounds 23/24/27's literal claim does not
survive a properly-instrumented measurement — the same shape of finding as
the 1,460-day difficulty regression and the event-tiering question earlier
in this session: testimony that read as fact until someone actually built
the instrument.

Before this, I'd built and then deleted a from-scratch diagnostic bot: a
30-seed/300-day simulation that recruited and launched jobs on its own. Its
crew never grew past 3-5 people across a full run, a bug in its own thin
hiring/territory logic, and it reported "only 2 distinct job types ever
fire" — a believable number measuring nothing. Recognized it as exactly the
failure mode this project has a name for, and deleted it rather than
report it, in favor of extending the real bot instead.

With the premise overturned mid-task, the "operations board redesign" the
director had authorized no longer had a target that the evidence supported.
Rather than either force a redesign the numbers didn't ask for, or
unilaterally declare the instruction moot, put the finding to the director
directly: four options, from "redesign `OperationDef` anyway" to "stop
here". Chose **"different verb, not different job"** — keep building
outward-facing content that doesn't touch the mechanically uniform
`OperationDef` table, rather than touching a structure three prior sessions
had already tried and failed to fix from the inside (per `cooldownDays`'s
own doc comment).

Built the third and last outward civic favour under that direction:
`canPullPermit`/`pullPermit`, the alderman. Mirrors the walkout's mechanism
at the scale of one specific asset rather than a whole family — sets
`RivalBusiness.permitPulledUntilDay`, and `collectIncome` excludes that one
business from the `businessCount` term rather than zeroing a family's whole
take. This concept was explicitly ruled out earlier in the session for lack
of an honest target; `RivalBusiness` (built earlier the same day, for the
Ledger work) changed that by giving a rival's fronts real, named identity.
Updated `canCallWalkout`'s own doc comment a third time to keep its account
of the pattern's history accurate. Wired into `RivalsPanel.tsx` beside "Buy
in".

One test bug caught by the project's own mutation-verify discipline: the
first version of "refuses a second pull on the same business" passed even
with the real guard deleted, because the alderman's favour balance had
already hit zero after the first spend and an earlier, unrelated check
produced the same false result. Fixed by forcing a spare favour before the
second attempt and asserting the specific refusal text, then re-mutated to
confirm it now genuinely depends on the guard under test.

This closes the set of three outward favours (union/captain/alderman) and
closes the late-game job-type variety finding — not with the fix originally
assumed, but with the fix the evidence actually supports. The judge remains
the one figure with no honest outward reading, now confirmed a third time
rather than assumed.

`docs/findings/not-negotiable-report.md`, `.ai/TASKS.md`, and
`docs/HANDOFF.md` all updated to reflect the closed finding. 141 files /
1,647 tests passing, `tsc -b` clean. The three pre-existing `ladder.probe`
failures (job-variety-of-memos, union reachability, trades profitability)
remain unaddressed and unrelated to any change in this pass, confirmed
across two full-suite runs with identical numbers both times.

## Phase 8 — `payRead` fixed, and the three `ladder.probe` failures resolved (2026-09-10)

Director asked directly for the two items closing out this pass: the
queued `payRead` background suggestion, and the three pre-existing
`ladder.probe` failures this pass had carried and reported unchanged
across every full-suite run so far.

**`payRead`.** Confirmed the drift by reading it against `wageExpectation`
directly: `payRead` re-derived an approximation from the perceived greed
band, anchored to the nominal role wage — no price indexation
(`DRIFT.wageIndexation`), no trait effects. Wrote the failing test first,
targeting the API `payRead` should have (`state`, `npc`) rather than the
one it had; the extra argument was silently accepted and ignored by JS
(no arity check at runtime), so two of the three tests passed for the
wrong reason on the first run — caught only because the mutation-verify
step, run out of habit rather than suspicion, came back green when it
should have been red. Fixed by making `payRead` take `state` and call the
real `wageExpectation(state, npc)`, matching the exact pattern
`loyaltyPressures` already established this session: the fog gates whether
a reading exists at all, not how accurate the reading is once granted.
Re-ran mutation-verify with the real fix in place and confirmed all three
tests now fail correctly when the old formula is restored.

**The three `ladder.probe` failures**, taken one at a time rather than as
a batch, because each turned out to need a different kind of fix:

1. **Memo-generation share (34.4% vs 33.3%).** The easy one. `helpers.
   resolves` already said exactly what was needed — about 8,024
   observations, and `WIDE` (288 careers) was only supplying 6,017. Raised
   to 400. Reads 35% now and certifies. Checked the other two bars that
   read off `WIDE` (career-shape verdicts, the prepared-job bar) against
   the larger population before trusting the change — both still hold.

2. **Union reachability (8/36 vs a floor of 9).** Not a sample problem —
   `config/civic.ts`'s own extensive history on this exact figure already
   shows two prior re-sizes, both because "the quantity underneath it
   moved." It had moved a third time: pulled the actual sorted peak-score
   distribution across `RUNS_300` (median 73, 75th 77) and found the bar
   (78) sitting above both, past the top of the population's own upper
   quarter. Re-sized to 76 — inside "between the median and the 75th," the
   same placement method used for all three of the other figures — and
   documented the drift and the fresh numbers in the same doc comment that
   already carries the figure's history. Reads 12/36.

3. **Trades profitability (498,407 vs 515,046) — the one that didn't go
   the way the first two suggested it would.** This line's own comment
   forbids moving the number a third time without first widening the
   sample to check for noise, so that was the plan — expected it to
   resolve the same way the memo-generation bar just had. Built a matching
   400-seed trading and non-trading population (reusing `WIDE`'s exact
   seed scheme so the pairing stays valid) and got $547,363 against
   $634,904: 86% of target, not the 97% the small sample showed. The gap
   got worse at scale, which is the opposite of what sampling noise does
   as a sample grows — this is confirmed as a real content shortfall.
   Did not keep the widened populations (a one-off check, not an ongoing
   fixture — their only job was answering "is this real," and it is, so
   paying their cost on every future run would buy nothing) and did not
   move the bar a third time. Wrote up the confirmed finding in the same
   comment, including that a real fix needs an income breakdown (trade
   income against routed-district sentiment damage and front upkeep) that
   has not been done, rather than a constant to nudge on the strength of
   one paired-gap reading — `FRONT_UPKEEP_RATE`'s own comment already
   records three tuning attempts against this exact bar with no
   consistent direction. Left failing, honestly, the same way this file
   already leaves the memo-generation-rate bar failing where a real
   shortfall was confirmed rather than argued away.

`docs/HANDOFF.md` and `.ai/TASKS.md` updated. 141 files / 1,650 tests
passing, `tsc -b` clean, `npm run probe` 96 of 97 non-skipped tests
passing (was 94 of 97) — the one remaining failure is the trades finding
above, now measured at 400 seeds rather than assumed at 36.

## Phase 9 — trades profitability decomposed, same day follow-up (2026-09-10)

Director picked up the "needs a dedicated pass" line from phase 8's trades
finding directly. The prior comment's working theory was that routed-
district sentiment damage was where the trade's gross income went — plausible,
since every route in the population did leave its street hostile, but never
actually checked against the numbers already sitting in the `Climb` record.

Checked it first, since `estateParts` already splits a family's worth into
cash, the capitalised value of ground held, and the value of fronts owned,
and holdings is exactly where sentiment damage would show up if it were
the mechanism. Paired `RUNS_TRADING` against `RUNS_300` seed for seed:
holdings moved *up* $556,637 for the trading arm, not down. The theory
does not survive contact with the number it would have to move.

Went to the real ledger instead — `trade.book`, already recorded lifetime
by category, just never read paired against a non-trading arm before.
That gave a category-by-category account of where roughly $3.7M of gross
trade income actually goes: $1.57M back into stock (expected — the trade
buys before it sells), then $285K more into job stakes, $369K more in
legal costs from the heat trading brings, $142K more to the wash's own cut
on the extra dirty cash it has to move, and $137K more in front upkeep.
None of it reads as a leak or a bug — it is the ordinary cost of running a
bigger, hotter operation, and every one of those five categories already
has a constant tuned for its own purpose elsewhere in the game
(`FRONT_UPKEEP_RATE`, the wash's cut curve, heat's legal-cost scaling, job
stake sizing). What survives all of it is a real net gain, somewhere
around $478K-500K depending on which day of the career it's read on — just
short of the `median(base) * 0.5` bar, not because something is broken but
because that is genuinely what the trade nets once everything downstream
of the extra cash and heat is paid for.

Did not pick a fix. The comment above already carries the reason: this
exact bar has already gone through two rewrites for the same kind of
reason (a stricter target proving too fine-grained for a 36-career sample,
then a bar that read fine alone and broke under an unrelated change), and
`FRONT_UPKEEP_RATE`'s own three-tries history against this specific bar —
22%, 33%, 94%, no consistent direction — is a standing warning against
nudging a shared economy constant on the strength of one paired-gap
reading. Wrote the finding up as a genuine fork for the director: which of
five already-tuned costs, if any, is worth reopening for this bar, or
whether the bar itself is wrong and "a real but modest gain" is what this
content was always going to be. Left both the bar and every constant
untouched pending that call.

Added the diagnostic itself as a permanent, reporting-only test
("says where the trade income goes once it is earned") right next to the
bar it explains, reusing `RUNS_TRADING`/`RUNS_300` — no new populations,
no added runtime cost to the suite.

`tsc -b` clean, `npm test` unaffected (1,650 passing, the new test carries
no assertion beyond confirming it runs), `npm run probe` still 96/97 —
this pass explains the remaining failure precisely; it does not close it.
`docs/HANDOFF.md` and `.ai/TASKS.md` both updated with the decision left
open for the director.

## Phase 10 — trades profitability closed, director's call (2026-09-10)

Put the five-cost breakdown from phase 9 to the director directly. The
answer: cut `stock` — the only one of the five specific to the trade
itself, and the one choice that doesn't touch a shared economy constant
(job stakes, heat's legal-cost curve, the wash's cut, front upkeep) this
project has already burned tuning attempts on for weaker reasons.

`config/contraband.ts`: `TRADES.product.unitCost` 2,600 → 2,340 and
`TRADES.arms.unitCost` 5,200 → 4,680 — both -10%, moved together rather
than picking one, honoring the arms figure's own comment that the ratio
between the two trades is deliberate ("raised with product and by the
same factor, so the 5.5x contrast... is the thing that survives"). Sized
against the actual finding from phase 9 rather than picked by feel:
$1.57M of the trade's gross income went to stock, and the paired-gap
shortfall against the bar was small (474,176 vs 514,131 needed) relative
to that, so a modest cut was the hypothesis.

Measured, not assumed: reran the exact failing assertion first. It
cleared — 474,176 became a comfortable pass against the same 514,131 bar.
Then ran the full `npm run probe` suite specifically because
`FRONT_UPKEEP_RATE`'s own history against this exact bar produced
non-monotonic swings (22%/33%/94%) from a single constant, and a stock
cost cut touches every trade-adjacent reading in the file the same way —
income percentiles, the plant/order arms built on top of the trade, the
1,460-day scorecard's own economy assumptions. **All 8 probe files came
back green: 98 of 101 tests passing, the same 3 pre-existing unrelated
skips, zero failures anywhere.** No ripple.

This closes all three `ladder.probe` failures this pass inherited and
carried across every full-suite run: memo-generation share (widened the
sample), union reachability (re-measured and re-sized the bar), trades
profitability (found the real mechanism, then cut the one lever that was
actually the trade's own). `npm run probe` is fully green — the first time
in this pass's own record.

`docs/HANDOFF.md` and `.ai/TASKS.md` updated. `npm test`: 141 files /
1,650 passing. `tsc -b`: clean.

## Phase 11 — alderman reachability measured, not broken (2026-09-11)

The `pullPermit` live-verify from the previous session ended on a
plausible-sounding but unverified claim: the alderman looked structurally
unreachable for a 3-district family, since standing was converging on 60
against a bar of 85 with all available front slots in three
foothold/control-level districts already spent. Reported it as a "needs a
decision" item. Director said measure it before deciding anything.

The measurement was almost free — `ladder.probe`'s existing "is the favour
network reachable" bar already carries the alderman at 17/36, inside its
own 9-33 acceptable range, so the config was never failing its own test.
The open question was whether that 47% reflected an ordinary career or
was itself surprising given how the live session went. Added a
reporting-only diagnostic reading `RUNS_300` split by whether the alderman
was ever owed: front count at day 300 read 10 for the careers that reached
it against 9 for the ones that did not — a one-front gap, not the wall the
live session implied — and districts at dominance read identically, 3 vs
3, ruling out "needs a fourth district" entirely.

The honest read: the live-verify session bought two modest fronts per
district and stopped, which is restraint from a player's chair and
under-investment from `respectableFronts`'s chair. An ordinary career in
the same shape pushes a front or two further in the districts it already
holds rather than needing new ground. No config change — `owesAbove` and
`respectableFronts` are both correctly placed against the population as it
actually plays; the earlier finding was a property of one conservative
session, not the game.

`docs/HANDOFF.md` updated. `tsc -b` clean, `npm test` 1,650 passing, `npm
run probe` unaffected — the new test is reporting-only.

---
## Director decision — boss-fantasy overhaul, 2026-09-13

Director handed over a 20-section brief ("Boss Fantasy & Organizational
Depth Overhaul"). A background gap-analysis agent found most of it already
built: multi-dimensional relationships (`NpcStats`, `Tie.trust/resentment/debt`),
NPC memory (`memory.ts`, 14 kinds), unsolicited events (`events.ts`),
favor economies (`civic.ts`), multiple power currencies, no wealth win-state,
and divergent per-career narratives (`legacy.ts`) all already exist.

**One real fork needed a call:** brief item 14 wants authored "boss moment"
set-pieces. CLAUDE.md says no cutscenes, no dialogue trees, no narrative
rails. **Resolved by precedent, not exception**: build the general
mechanism (any capo can defect, any promotion can be contested), never a
scripted one-off scene. No rule change. If a future item cannot be built
as a general mechanism, it does not ship as a special case — it comes back
here first.

Director signed off on an autonomous implementation run of the six ranked
gaps the audit found (smallest-diff-first): mid-game `careerShape()` read,
a reusable `seedFollowup()` cascade helper, a lawyer favor figure in
`civic.ts`, an optional capo→soldier `reportsTo` field, a real time cost on
`personal.ts`'s `goHome()`, and routing civic favor-calls through
`faction.ts`'s blame mechanism. Full treatment per item (failing test
first, fault put back and confirmed caught, probe run where balance moves)
minus the interactive playtest step — director's call, not a rule change.

---
## Operations loop redesign + organizational politics pass — 2026-09-13/14

Same session, three more director-approved runs on top of the above,
same treatment throughout (autonomous, failing-test-first, fault put
back, playtest step skipped by standing director call).

**Operations redesign, 3 phases:** the player was still personally
browsing a ~20-job board and hand-checking crew every launch, regardless
of org size — the actual "feels like a soldier, not a boss" complaint.
Phase 1 retires five street-tier jobs off the board once a district has a
steward or the player reaches Crew Leader. Phase 2 replaces the static
board above Tier 1 with 2-4 live "capo pitches" (Approve/Reject/Reassign,
reassign costs the passed-over capo real loyalty) refreshed weekly,
expiring in two. Phase 3 adds one-click squad dispatch via `reportsTo`
for crews with a real hierarchy, additive to the old checkbox path.

**Associate → made-guy pipeline, 4 phases + 2 follow-ups:** new associates
now get attributed to a real capo instead of a flat pay-to-hire list;
capos vouch for a ready associate (Make/Wait/Deny, reusing existing
trust/loyalty, no new stats); capos have a real capacity cap on made guys;
a bad vouch costs the vouching capo, tracked as a running net (bad minus
good, recoverable, not a one-way ratchet) and wired into all 8 real
defect/arrest/betrayal transitions this codebase has, sized against each
transition's own existing penalty rather than one flat number. Item 6 of
the original 6-item run (rival-blamable favor calls) stayed blocked — the
named actions don't exist and building them is new rival-AI logic, out of
scope — backlogged in `.ai/TASKS.md`.

**Organizational Problems & Power Dynamics, 19 phases:** built a full
politics layer on top of all of the above — capo power standing
(headcount/leadership/ground/earnings → a plain-language tier), power
gaps landing as real tie tension between capos, ambition biasing which
pitches a capo brings, favoritism costing the ignored capo (and,
extended later, costing him pitch quality too — a distinct consequence,
not a bigger version of the same one), reassignment reactions scaled by
who the passed-over man actually is and readable with familiarity, a real
Underboss/Consigliere (opinions biased by their own ties, a standing read
with a genuine "dangerous, the org runs through him now" top tier off a
real handled-problem count), one real event (`capo_political_tension`)
tying all of it together — officer opinions attached and allowed to
disagree, escalation on repeated neglect, addressing it resets the clock,
natural resolution via ordinary tie decay confirmed to already work, and
a real stale-flag fairness bug caught and fixed along the way.

Discipline held for 19 phases straight: several phases (3, 12, 14, 16,
17, 18) were audit-first and some closed with **no code change**, evidenced
rather than assumed — Phase 17 measured actual firing rate (40 careers ×
600 days, throwaway, deleted after) rather than guessing at a weight.
Two items were caught mid-run and fixed on the spot rather than shipped
broken: a merge-conflict resolution in the base session, and a real
rng-position regression in a pre-existing test (`scores.test.ts`, DIRECTOR
§5 repair, disclosed with both numbers). Explicitly declined across
phases, named as findings rather than built to check a box: other capos
growing wary of a favored one, a favored capo's own entitlement, Boss
shielding a capo from consequences, Boss denying territory, and four of
the brief's own suggested tension-resolution levers (favor-one-side,
compensate, promote/demote, move-territory) that would each need a new
mechanism this pass didn't build.

Test count across the whole session: 1650 → 1840 (161 files), `tsc -b`
clean throughout. Merged into `soprano-ue5-prototype`.

## Round 29 — first blind round on the merged Soprano build — 2026-09-17

Instance `mafia:run-round29` (port 5329), one tester, blind, brief verbatim.
Full report: `docs/findings/round29-report.md`. Day 301, Capo never reached
— Crew Leader twice, demoted twice, ended Street Criminal with one man.
Writing 10, Standing-in-it 9, Feedback 9, Fun 7. Two MUST FIX filed, both
verified against the source before anything is acted on:

**MUST FIX 1 confirmed — the delegation buttons lie.**
`delegatePitchAutonomous` (`sim/capoPitches.ts:250`) returns `null`
whenever `launchOperation`/`canLaunch` refuses — capo busy, bodies short,
stake unaffordable — and `OperationsPanel.tsx:652` discards that null. An
enabled button, a real click, no launch, no log line, no refusal. The
tester's three repros (two district runners, then a free associate at
$2,344 against the stake) all fit the same hole: every refusal reason
`canLaunch` can give is swallowed. Third instance of the rule-4 class
(round 18's blocker panel, round 28's crew-picker no-op).

**MUST FIX 2 confirmed structurally — the famine has no floor, two gears.**
(a) `OperationsPanel.tsx:129` renders `manualBoard(state).filter(op =>
op.tier === 0)`: the manual table can only ever show street work, so all
tier>0 income is pitch-only by design and an empty table at Crew Leader is
structural (the tester's SHOULD FIX 3 is the same finding).
(b) `outgrewStreetWork` (`sim/operations.ts`) hides tier 0 while any
non-street op is open **and affordable** — it checks money and never
bodies. All four crew in custody: a 3-man op stays open and affordable,
street work stays hidden, pitches cannot staff, the board is empty, and
`work_it_yourself` — the job whose own header promises the answer to
"what can I do this week" is never nothing, at any rank, in any state —
is invisible in exactly the state it exists for. The five-week dead
stretch (days 141–187) is this, not balance.

Also verified: laundering's decimal cents (`business.ts:983` logs
`laundered` unrounded through `toLocaleString`); the Finances/Businesses
put-away contradiction (behaviour intentional per `canAcquire`'s round-8
design — holdings buy fronts directly — the Finances copy omits the one
exception, so it is a copy fix, not a behaviour fix).

Not yet verified: "Hear them out" resolving invisibly, the extortion
Refuse caption, the nav badge counts, log lines naming people who never
materialize, `__frontline.run()`'s unsettled promise. Each gets checked
before it is acted on.

**Round 29 Part 2, verified and closed — 2026-09-17.** All eight
game-facing SHOULD FIX items checked against live source, not just the
test that guards them:

- "Hear them out" now logs (`eventgen.ts:1580`, "You heard them out").
- Extortion's Refuse caption fixed (`events.ts:1359`, no longer describes
  paying).
- Put-away-money contradiction fixed by copy order, not behaviour
  (`FinancesPanel.tsx:207` — the exception moved to the front of the
  sentence; the behaviour itself was already correct per round-8 design).
- The rank-up empty table now names where the work went
  (`OperationsPanel.tsx:763`).
- "Above your standing" now names what qualified into the pitch rotation
  (`OperationsPanel.tsx:1267`) — same finding as the tester's SF3, same fix.
- The recruit-list log lines now name a face off the real `state.recruits`
  pool (`crew.ts:150`) — Angelo Falcone could not recur, because every
  variant now needs a real recruit to name.
- Laundering line rounds (`business.ts:1001`).
- Nav badges all carry a `title` (`Rail.tsx:195`) — but this predates the
  round-29 build and the tester's own harness (`dev/harness.ts`) does not
  read `title` attributes, only element text. The finding is real for that
  tooling and not demonstrated against a human, mouse-driving player. Left
  open as a tooling caveat rather than closed as a game fix — see
  `HANDOFF.md` §0.

Not a game fix: `__frontline.run()`'s promise not settling in the tester's
own automation bridge, while the DOM steps it drives execute correctly.
`run()`/`settle()`/`stillness()` read correctly in isolation; nothing in
`dev/harness.ts` reproduces the symptom on inspection. Flagged for the
harness owner, not chased without a reproducible repro.

The two MUST FIX items and the `outgrewStreetWork` bodies-not-money defect
were fixed in the same push (`ffa33a5`) — see that commit and `HANDOFF.md`
§0's Round 29 entry for the fix detail.

## District holding cost — 2026-09-18

`.ai/TASKS.md`'s old item 2, built and measured both ways with
`ladder.probe` per its own instruction to size and re-check reachability
before shipping. Full detail in `HANDOFF.md` §0 and
`DISTRICT_HOLDING_UPKEEP_PER_WEEK`'s comment (`config/territories.ts`).

The one thing worth recording here rather than there: the first number
tried ($200/week, roughly one associate's wage) was not a guess that
happened to be wrong, it was reasoned from the existing wage scale and it
still cost the trades-profitability probe its margin. The mechanism
generalizes past this one feature — a **flat** per-unit bill is regressive
against a career that has scaled up, in a way a **share-of-value** bill
(what `weeklyFrontUpkeep` already charges) is not, because the flat bill
takes the same dollar from a struggling holding and a thriving one while
the share-of-value bill only ever asks for a cut of what actually came in.
`ladder.probe`'s trades test is built to catch exactly that shape of tax
landing on the strategy that is supposed to be winning, and it did its
job. Worth remembering before pricing anything else in this game as a flat
number per something the player can hold a lot of.

## The last two `.ai/TASKS.md` items — 2026-09-18

Both stale in the same specific way: written against a state of the code
that had already moved on by the time they were read. Full detail in
`HANDOFF.md` §0.

**`distinctEnds`.** The note said 2 of 5 tiers reached; the probe's own
bot currently reaches 4. Diagnosed the one real gap (tier 3 needs fronts
or favours, the bot buys neither) and tried the honest fix — a bot that
buys fronts. It made the number worse, not better, because a more capable
bot converges harder onto the ceiling rank rather than spreading out. That
is itself the finding: this axis is measuring population homogeneity
under skilled play, and skilled play reliably succeeding is not a bug.
Did not ship the stronger bot — it would have been tuning the instrument
to a target number, and this project's culture is explicit that a
pre-committed reading gets reported, not adjusted until it's flattering.

**Favor-calls attributable to the wrong family.** The note said the
rival-hurting favor action needed to exist first, and it already did —
three of them, `callWalkout`/`callTheLaw`/`pullPermit`, shipped and live
in the UI. Nobody had gone back to point `attribute()` at them once they
existed. That was the actual remaining work, and it took one shared
helper and three call sites.

Same lesson both times: before treating a queue item as a problem to
solve, check whether the premise it was written on is still true. Two of
the last three items this session (this pair, plus round 29's nav-badge
finding) turned out to be about a stale reading of the code rather than a
real gap in it.
