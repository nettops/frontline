# Handoff — Frontline

Read this, then read `docs/DIRECTOR.md` and `docs/PLAYTEST.md`. This file is the state;
those two are the rules.

**Standing rule, added 2026-09-07: reconcile this file before a session
ends, not just when somebody notices it is wrong.** Every diagnosis pass
this project has run reads this file first, and a stale entry here is not
neutral — it is a wrong instruction to the next reader, and three separate
sessions now have spent real time re-discovering a finding this file had
already listed as open when it was actually closed. If a session's own
report (`.ai/FINAL_REPORT.md`, `.ai/TASKS.md`) says something closed,
found, or fixed, that has to land here too before the session is over, in
the same pass — not deferred to "whenever this next comes up stale."

**And this cuts both ways — reconciling means trimming, not only adding.**
A 2026-09-07 audit found `.ai/TASKS.md` at 520 lines and
`director-log.md` at 2,275, both mostly session narrative that had already
been folded into this file and was now a second, aging copy of the same
facts — the exact thing a diagnosis pass has to read past to find what's
actually current. The fix that day was archiving the closed 90% (see
`director-log-archive-iterations-0-3.md`) and cutting `.ai/TASKS.md` down
to a current-only queue. **A 2026-09-08 evening pass did the same to this
file**: §6 had grown to hold the entire F1-F23 build history verbatim
alongside the current post-merge rounds, so everything before the merge
moved to `docs/findings/handoff-archive-pre-round23.md`, cutting this file
from 2,166 lines to about a third of that. **Keep them that size.** Before
adding a new session's narrative to `.ai/TASKS.md`, `.ai/PROGRESS.md`, or
an entry to `director-log.md`: state the finding once, here or there, not
in three places: fold a closed finding into this file's §6, drop it from
`.ai/TASKS.md`'s queue, and let `director-log.md` hold only the entry's
own reasoning, not a restatement of what §6 already says plainly. If a
document is accumulating without anything ever leaving it, that is the
bloat coming back, not a thorough record.

Project root: `C:\Users\cory\Desktop\mafia`. A git repo now — `main`, remote
`nettops/frontline` — which the section below this paragraph did not know
when it was written. Windows 11, PowerShell 5.1 (no `&&`, no `||`, no
ternary — use `;` or `if ($?) { }`).

A git repository, `nettops/frontline`. This line used to say the project lived
at `C:\Users\cory\Desktop\mafia` and was not under version control, and was
still saying it long after both had stopped being true.

---

## 0. Where this stands — 2026-09-17

**Where this stands, one screen — 2026-09-17.** Everything below this
paragraph block is either stable reference (§1–§5, the rules) or the
findings ledger (§6). The session-by-session narrative that used to sit
here (2026-09-13 → 09-17: the NOT NEGOTITABLE.txt pass, the boss-fantasy
overhaul, the capo-pitch operations redesign, the 19-phase
organizational-politics layer, family-conflict milestones 2–7, and the
Soprano phase-5 screens) is in
`docs/findings/handoff-archive-2026-09-milestones.md`, verbatim.

- **Merged to `main` and pushed, 2026-09-17** (`91befa4`, via
  `soprano-ue5-prototype`; that branch and four absorbed milestone
  branches deleted). Gates at merge: `tsc -b` 0 errors, `npm test`
  **171 files / 2,133 passing**.
- The NOT NEGOTITABLE.txt pass is **complete** — per-section status table
  in `docs/findings/not-negotiable-report.md`.
- Milestones landed: family dilemmas (1), Family Horizon (2), Stress &
  Panic (3), household age/life-stage (4), Public Standing (5), the
  Confidant (6), Dynasty/Aging/Final Succession (7), and the phase-5
  screens that read what phases 1–4 built.
- All three `ladder.probe` failures the 09-10 pass carried are closed
  (trades profitability closed by the director's stock cut, −10% unit
  cost both trades).
- The open queue lives in `.ai/TASKS.md`, current-only.

**Phase 6, 2026-09-17 — the last two unreachable systems.** `tsc -b` 0
errors, `npm test` **172 files / 2,150 passing**, 0 failures.

- **The tradecraft selector is on both screens that send somebody.**
  `TradecraftToggle` in `ui/components.tsx`, rendered by `RivalsPanel`'s
  `ContractButton` and by `LawPanel`'s witness-contract row, with the
  chosen method passed as `openContract`'s fourth argument. `method` had
  existed on that signature since tradecraft shipped and no caller ever
  passed one.
- **`SPECIAL_VENTURES` is buyable.** `canAcquireSpecialVenture` /
  `acquireSpecialVenture` in `sim/tribute.ts`, gated on rank Capo and on
  clean cash only, both refusals printed under the button. `BUSINESSES`
  is untouched, `SAVE_VERSION` stays 13, and `catalogue.test.ts` is green
  — a bought venture is an ordinary `Business` row that `businessDef`
  synthesises a def for at the single funnel every tick reads. It sits in
  `HOME_TERRITORY` and takes a business slot there, which is a second
  price the brief did not quote.
- **Both perks are implemented at the one funnel each belongs to.** The
  transfer station takes 30% off `violence` and `disposal` traces inside
  `addEvidence`; the pork store adds +2 to `HOME_TERRITORY`'s weekly
  sentiment recovery and multiplies the poach chance by 0.65.
  `hasHealthInsurance`'s `waste_management` branch, dead code since it was
  written, is now reachable and asserted with the other two routes removed.
- **Closed by director decision, 2026-09-18** — defaulted contract transmission
  to `walk_and_talk` across both `RivalsPanel` and `LawPanel`. Protects players from
  unintended federal wiretaps (+2.5 case evidence) and misfires (+12 street heat)
  by default, at the honest tradecraft price of spending the Boss's evening
  (`went_home_day`). Explicitly opted to phone euphemisms only when the boss
  chooses the speed/convenience over safety. See `.ai/LIVE_OVERSEER.log`, Phase 6 FINDING 1.


**Round 29 Part 2 fixes, 2026-09-17.** `tsc -b` 0 errors, `npm test`
**173 files / 2,163 passing**, 0 failures. Round 29's blind report is
`docs/findings/round29-report.md`; peak rank Crew Leader, ended a Street
Criminal, Clarity 8, Interface 8, First hour 9.

- **Rule 4, the delegation buttons.** `canDelegatePitchAutonomous` in
  `sim/capoPitches.ts` returns `LaunchCheck` — for every blocker but the
  headcount it *is* `canLaunch`'s answer — and `delegatePitchAutonomous`
  asks it first, both sharing `delegationCrew()`. `PitchCard` disables the
  button and prints the reason under the row. No behaviour moved: each case
  that now refuses early already returned null, and `canLaunch` draws no rng.
- **Being broke is named where it matters.** The hands-on poverty exemption
  (`launchOperation` has waived the respect penalty below
  `TRIBUTE.handsOnPovertyExemptionFunds` since it shipped, silently) now
  prints above the board at Capo and above. A payroll warning at the top of
  Finances names the three recovery levers; the Outgoings paragraph is
  untouched.
- **An empty board at Crew Leader reads as a promotion, not a broken
  screen.** `open.length === 0` says where the work went and, when there are
  pitches, scrolls to them through a ref rather than a `querySelector`.
- **Four copy repairs.** The extortion "Refuse" hint said the player was
  paying somebody off; "Hear them out" logged nothing at all; the put-away
  paragraph buried the one exception (a front) under three sentences saying
  nothing can reach the money; the laundering line printed cents.
  `PlayerPanel` announces unspent attribute points at the top.
- **Guards:** `ui/__tests__/statesShown.test.ts` (new, 9), plus 3 in
  `sim/__tests__/tribute.test.ts` and 1 in `ui/__tests__/refusalShown.test.ts`
  — the fifth instance that file has caught of the same defect. Every one was
  seen red with the fault in place.
- **The rest of Part 2's SHOULD FIX list closed the same push** (in
  `ffa33a5`, alongside Phase 6): `outgrewStreetWork` now checks free bodies
  against `crewNeeded`, not only money against `totalFunds`, so the manual
  board does not go empty for a crew-rich, cash-poor boss; "Above your
  standing" now names which jobs qualified into the pitch rotation instead
  of silently vanishing; `crew.ts`'s recruit-list lines now name a face off
  the real `state.recruits` pool instead of a decorative name that never
  appears in the pool (the Angelo Falcone finding). Guarded in
  `ui/__tests__/statesShown.test.ts`.
- **Nav badge counts, re-examined.** Every rail badge (`ui/Rail.tsx`) has
  carried a `title` explaining its count since before this build — a real
  player hovering it sees the answer. Round 29's tester drove the game
  through the DOM harness (`src/dev/harness.ts`), which reads element text
  and does not surface `title` attributes, so "Yourself 14" read as
  unexplained to that tooling even though a human player would not hit
  this. Same caveat class as the harness's `run()` finding — not
  re-verified against a mouse-driven human tester.
- **Closed 2026-09-18** — the two mid-game famines (days ~60–78 and ~141–187
  where no memo option was affordable) and the last-60-days memo repetition
  closed by the famine and repetition pass below.

**District holding cost, 2026-09-18.** `tsc -b` 0 errors, `npm test`
**175 files / 2,181 passing**, 0 failures. `.ai/TASKS.md`'s old item 2 —
a district was the one thing the player held for free forever, the same
gap `weeklyFrontUpkeep` closed for businesses and rivals already pay via
`AI.upkeepPerDistrict`.

- **`tickDistrictUpkeep`, `sim/territory.ts`.** Flat weekly bill per
  district at `control` or `dominance`, charged at payday alongside wages
  and front upkeep, same dirty-then-clean shape as `frontUpkeepOwed`.
  Unpaid, it costs the district's own influence rather than a hard loss —
  enough neglect drops it out of `controlledTerritories` on its own,
  which shrinks next week's bill instead of a hidden repossession rule.
- **Favour-network reachability, re-checked before shipping** (the note
  the old task item carried): none of `civic.ts`'s four figures read
  district influence or count — `payroll` was moved to crew headcount and
  `respectability` reads front sentiment, both for the same
  `districtsHeld`-saturates-at-3-4 reason. This does not feed it.
- **Sized by measurement, not guess** — the actual "second economy tax"
  risk the old task item named. At $200/week (roughly one associate's
  wage) the unit gate passed but `ladder.probe` cost two findings their
  margin: a standing-order-moving tie flipped (18 vs. 18) and the trades'
  measured advantage over a non-trading career fell below its floor
  (746,761 against an 883,944 bar) — a flat bill is regressive against a
  scaled-up career the same way front upkeep's revenue-share bill is not,
  and the trades probe is built to catch exactly that. At $75/week both
  cleared, and a full re-run matched `ladder.probe`'s own pre-existing
  failure set on `main` (8 failures, none of them this feature's doing)
  minus one — the favour-network-reachable failure passed. See
  `DISTRICT_HOLDING_UPKEEP_PER_WEEK`'s own comment (`config/territories.ts`)
  for the full numbers.
- **Guard:** `sim/__tests__/districtUpkeep.test.ts` (new, 5), seen red
  with the fault put back. `deposition.test.ts`'s long-seeded career test
  reshuffled again (its own history's ninth entry — the bot's decisions
  read the same cash and influence this tick moves) and was reseeded to
  4068, reachability re-confirmed (25 of 100 seeds).

**`distinctEnds`, diagnosed and closed with a finding, 2026-09-18.**
`.ai/TASKS.md`'s other old item — "reads 2 of a possible 5" — was itself
stale: `scorecard.probe.test.ts`'s own bot (48 worlds, seeds 1-48, no
code changed) currently reads `{1:1, 2:2, 4:21, 5:24}`, four distinct
tiers, not two. Root cause of the one still-missing tier found: every
tier-3 job in `OPERATIONS` needs fronts or people who owe you, and this
probe's bot only ever recruits and expands ground — it never buys a
front or earns a favour, so tier 3's own gate never opens and the
population jumps straight from whatever it had to tier 4's
crew-and-district path, which asks for neither.

Given a bot that buys fronts weekly (built, measured, then backed out —
not shipped): tier 3 did open, but the count got *worse*, not better —
`{3:4, 4:5, 5:39}`, three distinct tiers. A stronger bot does not spread
the population, it converges it harder onto the ceiling rank, because
recruiting, expanding and buying fronts is simply how a career climbs —
give a bot all three and nearly all of them (39 of 48) reach the top
before day 1460. `distinctEnds` is measuring how homogeneous outcomes are
under capable play, and capable play reliably succeeding is not a defect
to fix; tuning the bot further to chase a specific count would be shaping
the instrument to the target, the thing this file's own committed-before-
measurement culture exists to refuse. Closed as a finding: the axis reads
better than the stale note claimed, its one real gap has a known and
non-fixable cause, and nothing here is a bug. `.ai/TASKS.md` trimmed.

**Favor-calls attributable to the wrong family, built, 2026-09-18.**
`tsc -b` 0 errors, `npm test` **175 files / 2,184 passing**, 0 failures.
`.ai/TASKS.md`'s last open item, also stale — its own premise ("every
favor action that exists only benefits the player; none hurts a rival")
was already false: `callWalkout` (union boss), `callTheLaw` (captain) and
`pullPermit` (alderman) all shipped in `civic.ts` well before this pass,
each hurting a named rival faction, each wired into the UI. What was
missing was the other half — none of the three ever called `attribute()`
(`beliefs.ts`), so a family that lost a payroll, took heat, or had a
front's permit pulled had nothing to suspect and nobody to blame, right
or wrong.

- **`attributeToRival`, `civic.ts`.** One shared helper, called from all
  three grants: `attribute(state, rng, target, 'player', territoryId,
  'pressure', FAVOUR_EFFECT.outwardCare)`, then a relationship hit on
  whoever gets believed, scaled by `damageShare(confidence)` — the same
  pattern `faction.ts`'s own street-pressure call already uses.
  `territoryId` is null for the walkout and the law (no single place to
  read presence in); `pullPermit` passes the business's own district.
- **`FAVOUR_EFFECT.outwardCare` (new, 0.6)** — a favour called in through
  a city office reads as quieter than a crew leaning on a corner
  (`faction.ts`'s own call passes `care` 0, the default), not immune:
  `clarityFor` still reads presence, so a family standing on its own
  front can still work it out.
- **`FAVOUR_EFFECT.rivalGrudgeHit` (new, `[10, 20]`)** — reused from
  `AI.pressure.relationshipHit` rather than invented: an empty payroll, a
  hot rival, and a dead storefront are the same order of hostile act as a
  street shove, not a lesser one.
- **Guard:** 3 new tests in `sim/__tests__/civic.test.ts` (50 total),
  each checking the action reaches the belief system and moves the
  believed party's relationship — not re-proving `attribute()` itself,
  which `deep.test.ts` already owns. Seen red with the fault put back
  (`pullPermit`'s case, representative of all three).
- **No probe re-run needed** — none of `scorecard.probe`, `ladder.probe`
  or `broke.probe`'s bots call any of the three favours, so nothing in
  this change touches an existing rng-consuming sequence.

**Four reading repairs, 2026-09-18.** `tsc -b` 0 errors, `npm test`
**176 files / 2,201 passing**, 0 failures. All four answer complaints in
round 29's report about *finding* things rather than about what the
systems do. Presentation only: nothing writes to the save, no sim
function changed, `SAVE_VERSION` stays 13, and no probe baseline can
move because no rng-consuming sequence is touched.

- **A jump bar on Operations** (`JumpBar`, `panels/OperationsPanel.tsx`).
  Round 29 measured about fifteen hundred pixels of running jobs,
  automation and work above the player's standing between the top of the
  page and the street job they had come to start. Four sticky pills with
  live counts — Active, Pitches, Street Work, Standing — scrolling to
  `#ops-active`, `#ops-pitches`, `#ops-street`, `#ops-standing`. `Panel`
  takes an optional `id` now, which beat wrapping four sections in divs
  that exist only to be scrolled to. A pill is drawn only when its
  section exists, and the bar itself only above two live sections — a
  control that scrolls to nothing is rule 4 in its quietest form.
- **Hold to peek on the memo** (`ui/MemoModal.tsx`). Half of these
  questions are about money, heat or who is free, and the page that asks
  covers the only place those figures are printed. Held rather than
  toggled: mouse, touch, or P. While peeking the memo drops to 9% opacity
  and stops taking clicks, so the release is listened for on the window
  rather than on the button, which by then cannot receive it. The number
  keys are untouched, and a new memo arrives with the page up.
- **The docket** (`Docket`, `ui/StatBar.tsx`, under the masthead on every
  screen). Payroll days and cost, heat once past 60, and how many people
  are carrying a grievance — the three things that ruin a career while
  the player is on another tab. Each chip jumps to the panel that owns
  it, through the `goto` App already had. The payroll figure comes from
  `payrollForecast`, the same function the payday runs, so it cannot
  disagree with the event; a second copy of that arithmetic is exactly
  the round-12 defect the forecast was written to fix. The payroll line
  draws in the quiet tone when the money is there, because a strip that
  appears only on bad news teaches the player to read its absence as
  nothing coming.
- **Row accents on the roster and the fronts** (`rowAccent`,
  `panels/CrewPanel.tsx`; inline in `panels/BusinessesPanel.tsx`). The
  same inset gutter `tr.selected` already uses, declared above it so the
  picked row still wins. Crimson on the grievance threshold `StatusTag`
  already prints "Grudge" from; amber through `perceive(npc, 'loyalty')`
  rather than the raw stat, with a "Defection risk" chip beside the
  status — a colour is something the player reads about a person, and
  rule 1 has no exception for colours. Fronts take amber on `hard` or
  past the alarming exposure line, green on `clean`.
- **Guard:** `ui/__tests__/uiEvolution.test.ts` (new, 17), in
  `sopranoControls.test.ts`'s idiom — source with commentary stripped,
  plus the stylesheet — seen red (14 of 17) before any of it was built.
  `discoverable.test.ts` caught the crew row's className rewrite; it
  pins the literal `'clickable selected' : 'clickable'`, so the accent
  appends to that ternary rather than replacing it.

**Mid-game cash famines and late-career memo repetition, 2026-09-18.** `tsc -b` 0 errors, `npm test` **177 files / 2,215 passing**, 0 failures. Sized against the two Pacing 7 / Difficulty 7 blockers from round 29's report. Zero `SAVE_VERSION` bump.

- **Family bedside dilemma (`sick_relative`).** In `config/personal.ts`, `attendCost` changed from $600 to 0 (matching `school_event`, `quiet_evening`, `teen_trouble`), with `sendCost` 450 untouched. Attending in person spends presence and an evening; a broke boss with $451 is never locked out by $2 from sitting by a sick relative's bedside.
- **Loan shark emergency micro-loans.** In `sim/market.ts`, `dueOn` scales repayment for small balances: `minRepay = Math.min(REPAYMENT_MINIMUM, Math.max(50, Math.round(loan.owed * 0.1)))`. A $500 loan owes ~$60/week instead of forcing a crushing $350/week bill, while large loans ($40K+) retain their $350 floor. Slider in `FinancesPanel.tsx` starts at $500 with step $250.
- **Actionable payroll shortfall exits.** The coach banner at the top of Finances now dynamically lists available exits: selling fronts in Businesses (recovering 35% capital and shedding upkeep), emergency credit from Delacroix ($500+), pawning personal luxuries from Yourself, or street corners.
- **Memo pacing & repetition decay.** Cooldowns on the 5 over-frequent generated shapes extended: `somebody_inside` (8→18d), `paper_moving` (10→20d), `a_name_came_up` (9→18d), `wants_a_word` (9→16d), `the_take_is_short` (10→18d). Narrative variant pools grown across all four, and `somebody_inside` adds an affordable middle choice (sending commissary grease/word for $150) when broke (`totalFunds < 1_000`).
- **Guard:** `sim/__tests__/famineRepetition.test.ts` (new, 14), seen red before implementation.

**Contract tradecraft default: walk and talk, 2026-09-18.** `tsc -b` 0 errors. Sized per director decision.
- **`RivalsPanel.tsx` & `LawPanel.tsx`.** Both default contract transmission method to `'walk_and_talk'` instead of `'phone_euphemism'`. Players are protected from unintended wiretaps (+2.5 case evidence) and misfire heat (+12 street heat) by default; opting for the phone is an explicit, conscious trade-off to save the evening.
- **Guard:** `src/ui/__tests__/sopranoControls.test.ts` updated to assert `useState<TransmissionMethod>('walk_and_talk')` on both sending panels.


**Round 30 repairs, 2026-09-20.** `tsc -b` 0 errors, `npm test` **181 files /
2,241 passing**, `npm run build` clean. Round 30's blind report is
`docs/findings/round30-report.md` (Capo on day 96, stopped day 100). Every
guard below was seen red with its fault put back. No `SAVE_VERSION` move:
everything here is derived on read, transient UI state, or config.

- **A pitch is spent by the job it was for and nothing else (MUST FIX 1).**
  Approve used to call `approvePitch` on the click, so Cancel, another tab, or
  a second Approve threw the offer away silently. `launchPitched`
  (`sim/capoPitches.ts`) now settles it at the launch, only for the same job in
  the same district; the panel keeps `assemblingPitchId` as transient state.
  A casing shows as "Casing in progress (Nd left)" on the card and in plain
  text on the assemble screen. Live-checked in the browser on the round-30
  save: approve two pitches and cancel, all three stay; launch spends only
  its own. Guards: `sim/__tests__/pitchLaunch.test.ts`,
  `ui/__tests__/pitchPreservation.test.ts`.
- **Street work stays until a pitch he could take today (MUST FIX 3).**
  `outgrewStreetWork` scanned every open job, but a Crew Leader reaches
  tier 1+ only as capo pitches, weekly — so a newly promoted or broke boss
  had the corners taken away against jobs he could not reach. It now needs a
  live pitch that is affordable and staffable (`sim/operations.ts`, read off
  `state.capoPitches` to avoid the import cycle). The gate tests' setups now
  include a live pitch, which is the rule's precondition, not a weakened
  assertion; four new cases pin the blackout. The retirement line is said
  once per career (the gate can now rise and fall weekly). **Two parts of the
  order not built:** keeping `work_it_yourself` whenever nothing is running is
  already implied (there is a pitch to take) and applied literally would keep
  the corners on every idle Crew Leader's board, undoing the retirement; the
  fallback banner for "no open jobs and no pitches" cannot be reached now.
- **Smaller repairs.** The Docket has a case chip built from `arrestRisk`
  (the fogged posture the Overview already prints), **not** the ordered
  "N% evidence": an exact figure on that strip would lift the fog `caseIntel`
  keeps. Peek is fully transparent. A greyed-out district handover names
  its reason on the page. The shark slider opens on $500, not half the ceiling.
  The trade row prints whole loads or one decimal ("3.9u", was
  "3.9172573331756046u"). Guard: `ui/__tests__/roundThirty.test.ts`,
  `ui/__tests__/board.test.ts`. Not live-checked: the handover refusal (the
  save had no refused state) and the peek visual.
- **The trade (MUST FIX 2): measured, and the ordered numbers not shipped.**
  Two of the order's three parts were already true or inert: the product trade
  already needs two fronts (`minFronts: 2`), and the runner's `ceiling` (14) is
  not binding for one route (~3.9 loads). The ordered runner change (`ceiling`
  5, price ×1.85) fails `ladder.probe`'s "running both trades for 300 days"
  bar: paired gap **717,717 against 869,209 at 400 seeds** (83%) and 581,717
  against 817,661 at 36, where unmodified code reads 1,097,336 (126%) and
  1,011,275. A failed pre-committed condition is the finding (`DIRECTOR.md`
  §5), so the runner is left as it was, with the readings in a comment on it.
  The 36-seed ceiling grid is not monotonic (5, 8, 10, 12 read 955,720,
  1,028,510, 1,064,697, 856,281; ×1.5 at 10 reads 758,252, a fail), the
  turbulence the `product` comment already records; the 400-seed lay-low
  curve below is monotone. Open for the director: `.ai/TASKS.md` item 1.
- **What did ship for the trade: lay-low costs it something.**
  `LAY_LOW_TRADE_SHARE` (`config/contraband.ts`) scales `throughput`, so the
  sale, the weekly buy, order sizing and the board row agree; a dark week logs
  "The routes ran at 80% this week. You are laying low." The ordered half
  fails the bar (0.5: 834,955, 96%); the curve at 400 seeds is 1.00 → 1,097,336
  (126%), 0.85 → 1,024,954 (118%), **0.80 → 983,313 (113%, shipped)**, 0.75 →
  930,346 (107%). 0.8 clears the ~111% the trade's history calls real
  headroom. The probe's bot has heat near 100 and lays low far more than any
  human tester, so these overstate what a real career pays. Guard:
  `sim/__tests__/contrabandLayLow.test.ts`.
- **What the instruments cannot see.** No probe reads the pitch flow or the
  street-work gate, so MUST FIX 1 and 3 have no probe reading. Full
  `ladder.probe` and `broke.probe` results against a clean checkout of the
  same base: see `docs/findings/director-log.md`, Round 30 repairs.

**Round 30 follow-up, 2026-09-20 — the director's calls.** No `SAVE_VERSION`
move. Every guard below was seen red before its fix.

- **The ladder is the family's standing (Option A).** The player is the boss
  of a family from the first morning, so `RANKS` (`config/economy.ts`) names
  how much of the city the outfit is: *Nobody knows the name · A couple of
  corners · A crew that works · A seat at the table · One of the families ·
  The city's business · Other cities know the name*. **Ids unchanged** — the
  street-work gate, the capo-pitch gate, the venture gate and every old save's
  `player.rank` key off them. The Overview and Yourself panels label it "Family
  standing"; `announce.ts`, `tribute.ts`, `operations.ts` and the Broke coach
  say it as the family's, lowercased mid-sentence and read off the rung's own
  name so message and gate cannot drift. Guards: `rank.test.ts` (names and ids
  pinned), `announce.test.ts`, `specialVentures.test.ts`, `tribute.test.ts`,
  `ui/__tests__/familyStanding.test.ts`. `crime_lord` had no name in the
  director's six; "Other cities know the name" was chosen and approved.
- **Dead rank branch out of `career.ts`.** `careerSnapshot` read the pinned
  `player.rank`, so "Reached Capo." could never fire; the old test passed only
  because it assigned the field by hand. The chronicle keeps no ladder
  chapter; `announce.ts` still logs standing changes.
- **Succession no longer prints the stored rank** (`App.tsx` game-over roll,
  `SuccessionPanel.tsx` starting-rank row and "Reached" column). The field is
  pinned at the first rung, so every predecessor read the same word. Still
  reading it: `art/playerLook.ts` and `PlayerPanel`'s kit note pick the
  portrait kit from `player.rank` — unlooked at.
- **First-route ramp (`ROUTE_RAMP_START` 0.25, `ROUTE_RAMP_WEEKS` 4) is built
  and NOT shipped.** A trade's first route opens at 25% and reaches full over
  four weeks (`routeSince`, optional, a missing entry reads as settled;
  `districtCapacity` applies it). Only the first route ramps: ramping every
  route was a standing tax, since the probe bot opens a route in every
  district it takes. `ladder.probe` "running both trades for 300 days", paired
  gap, same instrument: **400 seeds — 983,313 unramped, 917,044 ramped, against
  a bar of 869,209 (clears, 105%)**. **36 seeds, the sample `npm run probe`
  runs — 960,574 unramped, 587,919 ramped, against 817,661 (fails).** The
  36-seed reading is turbulence, not a size: ramping every route read 707,768,
  and 0.5/4 read 1,051,599, above no ramp at all. But the bar has already been
  restated twice and its own comment warns against a third (`DIRECTOR.md` §5),
  so it is left as it is and the ramp is held back for the director. The code
  is uncommitted in the working tree; `.ai/TASKS.md` item 1.


## 1. What the project is

Frontline is a crime-family management simulator. React 18 + TypeScript 5.7 +
Vite 6, Vitest 2. The player starts broke and grows an organization through
operations, crew, territory, rival families, and law enforcement.

    npm run dev        # play it
    npm test           # the gate — run it for the current count, it drifts every session
    npm run probe      # the measuring files in sim/probes/, ~10min
    npm run test:all   # both
    npx tsc -b         # types
    npm run playtest   # namespaced instance for blind testers

**Current verified state, 2026-09-10: `tsc` clean, `npm test` green
(136 files, 1,581 passing).** Last blind measurement: round 28. Read §0
before trusting anything below this line about specific numbers; this
section is architecture and history, not current state.

The suite is split into two vitest projects. `npm test` is the gate and runs the
unit project only, in about sixteen seconds; `npm run probe` runs the
measuring files in `src/sim/probes/` and takes about ten minutes.

**The rank ladder is derived, not stored, and can go down.** `ladder.probe`'s
pre-committed rank condition — *"gives a 300-day career more than three
rungs"* — passes because the table was re-gated rather than the target
moved: rank runs off `OpsBoard` (districts, fronts, crew, favours, rival
trust) on the reasoning that *"rank is a clean-money threshold wearing a
title."* DIRECTOR §5 forbids moving a pre-commit to unblock a change and
it was not moved.

`sim/rank.ts` derives what the player is *called* from that same board, so what
you are called and what you are allowed to do cannot come apart.

One probe bar was deliberately loosened in iteration 9 and is recorded there
rather than here: `broke.probe`'s hiring-policy margin, from 1.5x to 1.2x, after
the fear repair made crews easier to keep.

---

## 2. Hard constraints — do not violate these

- **No jsdom. No `@types/node`.** Tests are pure sim.
- **Config must not import sim.** Balance numbers live in `src/config/`.
- **New state fields are optional (`foo?: T`).** Never bump `SAVE_VERSION`.
- **Determinism.** Seeded `mulberry32`; the seed and call count are saved state.
  **Any change reshuffles every later `rng` call.** Single-run comparisons of
  small changes are unreliable. Measure over a population.
- **Ring buffers.** `state.log`, `state.operationHistory`, `faction.history`,
  `state.trace` all wrap. Read them by day or date, never by
  `slice(previousLength)`.
- `src/config/contraband.ts` header stands: nothing in this project describes
  how anything is made, moved, or concealed in the real world.
- cool-retro-term is GPL2/3. **Do not port its GLSL shaders into this project.**
- The CRT curved-tube prototype in `prototypes/` stays parked until the
  developer raises it.
- **Never playtest against the developer's saves.** Use `npm run playtest`.
- **Never tell a blind tester mid-round to use a specific feature.**
- **Never adjust a probe threshold to make it pass.** A failing pre-committed
  condition is the finding. `docs/DIRECTOR.md` §5 has a narrow repair clause; it
  needs the developer's call, with the evidence attached, every time.
- **Write the test first. Watch it fail for the expected reason. Then
  implement.** Standing instruction, in memory.
- ASD-STE100 Simplified Technical English applies to **chat responses only** —
  never to code comments. The comments in this codebase explain why each
  decision was made. Keep that voice. Source is the global `~/.claude/CLAUDE.md`.

---

## 3. The recurring failure mode

**Instruments that return believable numbers while measuring nothing.** This
project has produced **39 instances** of it.

## Three rules, added 2026-08-23, that would have caught four of them

A single session produced four measurement errors — a price plotted off a bot
weaker than the standard one, a median that could not see a seven-career
effect, a per-career mean subtracted from a median inside one ledger line, and
a comparison across two arms that are not the same worlds. None was a coding
mistake. All four were a statistic pointed at the wrong population. These are
mechanical and are enforced by helpers rather than by remembering.

**1. Comparing two probe arms means `pairedGap`, never two medians.** Arms are
separate simulations that diverge at the first decision a policy changes, so
their populations are different worlds. `RUNS_BOOKS` read $359,270 lower sales
than `RUNS_TRADING` on the medians while stock spend was flat — a difference
neither arm's policy can produce. Paired, it is $5,483.
`helpers.pairedGap(arm, against, pick, participated)` takes the median of the
per-seed difference. Both arms must be built from the same seed list in the
same order.

**2. No bar reads a population containing non-participants.** Mixing adoption
into an effect size measures neither. Three bars in `ladder.probe` were placed
that way in one afternoon: the plant's take-up read 7 of 36 built when the game
had *offered* one to 16 and the gap was the bot's own reserve rule; the plant's
volume bar was a median over an arm where seven careers in thirty-six hold a
plant, so a mutation adding forty units a week of throughput left it green; the
launderer's rate read 18.4% against 17.4% needed because nine careers that
never hired anybody sat in the average at 22.8%. All three were repaired by
changing what the bar watched. **In none of them did the number move** — that
is the test of whether a repair is honest. `pairedGap` takes a `participated`
predicate for exactly this and it is not optional in practice.

**3. `median` and `mean` never appear in the same expression.** `helpers.mean`
exists so no probe writes `total / RUNS.length` inline, which is how a mean
ends up in a line of medians without anybody noticing what changed. A washing
readout subtracted a per-career mean of the wash cut from a median of sales and
printed the result as a ledger; the cut line was overstated by $30,577 and it
was invisible because both figures were dollars. Default to the median — these
careers have a long right tail (F15) and the mean describes a family nobody
plays. Where a line genuinely needs both, print them separately and mark the
mean, as the `— means` suffix in `ladder.probe` does.

**And the standing one these three sit under: measure a new feature with the
standard bot, or the measurement is about the bot.** A probe written alongside
a feature reported a median peak of $176,843 and orders reaching 13 careers in
36; on `ladder.probe`'s bot the same figures are $236,014 and 102 of 144. It
opened a supply in 14 careers of 36 where the standard one reaches two fronts
in 132 of 144.

Recent examples:

- **Three bars in one file pointed at populations containing people who never
  used the thing being measured.** The plant's take-up bar read 7 of 36 built
  and failed, when the game had *offered* one to 16 and the gap was the bot's
  own reserve rule. The plant's volume bar was a median over an arm where seven
  careers in thirty-six hold a plant, so a mutation adding forty units a week
  of throughput left it green. The launderer's rate bar read 18.4% against
  17.4% needed, dragged up by the nine careers in thirty-six that never hired
  anybody, sitting in the average at 22.8%. **Mixing adoption into an effect
  size measures neither.** All three were repaired by changing what the bar
  watches; in none of them did the number move.

- **A net measure asked to answer a gross question, and it inverted the
  answer.** `wash.dirtyIn` is the sum of the *daily rise* in dirty cash, and it
  was reached for to ask how much dirty money a trading career earns. The
  trading arm reported **less** dirty income than the arm that does not trade —
  $750k against $866k — while laundering more than twice as much, because
  `tickContraband` buys next week's stock out of the same pocket the sale just
  filled and most of the flow cancels inside one day. The first draft of the
  laundering comparison had it as the denominator and printed "laundered 100%
  of dirty income", which is the arithmetic of a cancelled denominator wearing
  the clothes of a finding. The accumulator is still correct for the bot that
  does not trade; it is simply not a gross figure and must not be read as one.

- **A population statistic cannot see a minority effect, and one was asked
  to.** `ladder.probe` gained an assertion that a plant must not raise volume,
  written as a bound on the median trade income of the owning arm against the
  buying arm. Mutation check: **making a plant add forty units a week of
  throughput left it green.** Seven careers in thirty-six build a plant, so the
  median career in the owning arm does not have one and nothing a minority does
  can move the statistic. The bound was also measuring revenue rather than
  volume, so a plant-holder filling orders looked like throughput leaking. Both
  faults were in one line. The claim is a claim about one function and is now
  tested on that function — `plant.test.ts` asserts `throughput` is identical
  either side of `buildPlant`, and the same mutation turns it red. **Before
  writing a population assertion, ask what share of the population the effect
  is in.**

- **A pre-committed bar pointed at the wrong quantity, and failing is how it
  was found.** The same probe pre-committed "a quarter of careers build a
  plant, or it is the PATRON shape again" before anything was plotted, which is
  the right order. It read 7 of 36 and went red. The diagnostic beside it: the
  game *offered* a plant to 16 of 36, and the gap was entirely the bot's own
  rule against spending below one and a half times the price. The bar now reads
  reachability and take-up stays in the log unasserted. **The number did not
  move.** This is the alderman's fault in a different costume — a bar reading a
  quantity that answers a different question — and the repair is the same one:
  change what it watches, not where it sits.

- **A bot written alongside a feature flattered the feature, twice in one
  afternoon.** The product plant was priced at $185,000 off a probe written for
  it, which reported peak funds after the trade opens with a median of
  $176,843. The same probe said orders reached 13 careers in 36 with a median
  of *zero* offers — the PATRON shape, and grounds for redesigning the whole
  feature. Both numbers were the bot. It opened a supply in 14 careers of 36
  where `ladder.probe`'s bot reaches two fronts in **132 of 144**; re-measured
  there, the median peak is $236,014 and 102 careers of 144 are offered
  something. The price moved to $250,000 and the redesign was not needed.
  **A new feature is measured with the standard bot, or the measurement is
  about the bot.** The weak bot did earn its keep once — it found a real fault
  the strong one would have hidden, because the weekly roll picks one name from
  the candidate list and families who cannot buy were crowding out the gang who
  could.

- **The reservation that holds order stock back from the street was untested,
  and seventeen tests said otherwise.** `orders.test.ts` asserted
  `reservedUnits` returned the right number, which is the *quantity* and not
  the *behaviour*. Deleting `- reservedUnits(state, trade)` from the
  distribution loop in `contraband.ts` left every one of them green — the
  commitment the whole feature turns on could be silently sold on the street
  and nothing would notice. Caught by mutating rather than by reading. The
  replacement puts a shelf holding exactly what is owed, no money to buy more,
  and streets with room, and asserts nothing moves. **Asserting on the number a
  system computes is not asserting on what the system does with it.**

- **A test that claimed to prove the card tiers meant something was measuring
  the price.** It asserted the top room opens in fewer weeks than the bottom
  room, which is true — and stayed true with the top room's respect bar set to
  **zero**, because $12,000 is more than $400 and that was the entire content
  of the claim. Caught by mutating the bar rather than by reading the test. The
  fix separated the two gates and immediately found a real defect behind the
  fake one: the bar had gone in at 55 on intuition and was cleared in **77% of
  weeks**, so the "invitation you cannot ask for" was an invitation almost
  everybody already had. The probe now prints the whole weekly respect
  distribution against a ladder of bars, so the next person sizing a threshold
  on respect reads it off the log. That is three bars this project has put in
  the wrong place for want of plotting first.

- **The clock trap, met again, and it would have passed.** `cards.test.ts`
  built its fixture on day 40 and stepped by 7, so `tickCards` — gated on
  `day % 7 === 0` — never ran once. It was caught only because the assertion
  happened to be `toBe(0)` rather than `toBeLessThan(before)`; the weaker
  assertion would have gone green against a decay that never executed. **When a
  tick is gated on an interval, the fixture has to sit on the boundary**, and
  the assertion should name the endpoint rather than the direction.

- **The possessions layer went green on its first run, all sixteen tests.**
  Which is how instance 27 happened, so every claim was re-checked by
  reinstating the defect it names — clean-money-only replaced with `spend`, the
  estate term dropped, the resale share set to 1, the visible share dropped,
  the newspaper item cut, the seizure left unmarked. Nine of ten went red.
  **The tenth did not: `warrant-takes-it`.** The test called
  `seizeOnePossession` directly, so deleting the call from the warrants stage
  changed nothing it could see — the unit worked and nothing reached it. Two
  more turned up the same way afterwards, both on the new tip's predicate,
  which could be replaced with `true` because the bot that exercises tips is
  handed a million dollars every morning. **A unit test and a wiring test are
  different tests, and this project keeps writing the first and reporting the
  second.**

- **The scorecard's Pacing axis has a noise band wider than its own bar.**
  Building the second half of the middle game moved Pacing from 3.8 to 2.6, and
  the axis reported itself collapsed. It had not. Re-measured at 48 careers
  instead of 12, the two builds read **3.4 against 3.4** — longest quiet stretch
  406 days against 403 — so the entire drop was the random stream reshuffling,
  which *every* change to this project does. `longestGap` is a mean of
  **per-career maxima**, and at twelve samples that statistic moves further on
  noise than most deliberate changes move it on purpose. The sample is now 48.
  Note what the fix was not: the bar stayed at 3. A bar being read off an
  instrument that cannot resolve it is an instrument problem, and the two hours
  lost to a Capo shift of 16 → 10 that turned out to be 34 → 29 at 96 seeds were
  the same lesson arriving in a different costume.

- **`layLowHonesty` had a blind spot shaped like the bug it hunts.** It was
  written to stop any screen claiming that going dark stops everything, and it
  hunted three specific sentences — `nothing earns`, `Nothing earns`,
  `Everything stops`. Round 15 read *"No operations can be launched"* on the
  Overview and *"Nothing can be launched until day N. That is the point of
  it."* on the Operations page, believed them, and lost the run. **Neither
  matched.** The replacement was two regular expressions and it went green with
  the defect reinstated — five rounds of instrumenting later, `totalStop.test`
  was still returning false inside the test on a line it matched everywhere
  else. It is now plain lowercase string matching, and it was proved red
  against the reinstated defect before being fixed.

- **A diplomatic bar set below the value every game starts at.** Sizing
  `demandRespect` against the measured distribution of rival respect gave 28,
  which looked reasonable until `diplomacy.test.ts` refused a demand from a
  boss on day one — `STARTING_RESPECT_FOR` is **30**. The distribution had been
  read without reading what it starts at, so a bar "between the median and the
  75th" was in fact below the floor. Any threshold on a quantity needs its
  starting value as well as its spread.

- **A supply test that passed before the thing it tested was built.** The
  generative-events work pre-committed that a career must meet at least eight
  new memos after day 180, counted by distinct memo **body**. It passed at
  fifteen — with the generator switched off. Every authored event carries two
  to four `oneOf` variants, so the same memo about the same man reads as new
  content three times, and the instrument was measuring the prose rather than
  the game. Round 14 was not fooled by that and the probe should not have been.
  Now counted as *situations*: the shape plus who it is about.

- **`refusals.test.ts` missed the whole memo-pricing class, and round 14 paid
  for it.** Every priced memo option put its figure in `hint` and its refusal in
  `disabledReason`, and the panel rendered one *instead of* the other — so the
  price vanished exactly when the player could not pay it. The check looks for a
  threshold comparison beside a refusal string; this refusal comes from a
  **shared helper** with the amount passed in, so there is no comparison at the
  site to find. **A scanner that reads guards cannot see a guard that has been
  factored out.** The check now has a behavioural half that builds the events,
  and it found three instances on its first run.
- **"The economy leaks", reported to the developer and written into
  `config/economy.ts` before it was checked.** "A career earns $5,429,975 and
  peaks at a balance of $45,470, so the money is made and does not stay"
  compares a **mean against a median** on a distribution whose mean is 9.7
  times its median. It is not a ratio, and there is no leak. Caught by asking
  what the print helper actually divided by. The real shape is F15, archived.
- **`refusals.test.ts` itself, twice, on the day it was written.** Built to catch
  exactly the F10 defect, it went green with F10's broken string reinstated. It
  counted any `${...}` as naming a number — the broken string interpolates a
  district name — and its detection window started at the `reason:` line, while
  `ok: false` is written *above* the reason in every multi-line return here, so
  no multi-line refusal was ever recognised as one. **An instrument built to
  prevent §3 was §3.** Caught only by reinstating a real defect and demanding red.
- `Covered? Yes` on the payroll line, shipped in the UI. The forecast omits
  loan repayments; the day tick takes them before wages. Its own doc comment
  claims it "deliberately mirrors `tickEconomy`". It does not. Round 12 was told
  payroll was covered on a week nobody got paid.
- A probe read `state.investigations` instead of `state.law.investigations`.
  `?? {}` turned the miss into an empty object, and it reported that no agency
  ever opened a case in 2,183 weeks at mean heat 95. Caught only because
  zero-of-everything was implausible.
- `priced.test.ts` passed with the bug present. Its bot advanced the clock and
  answered memos but never ran a job, so the event under test never fired.
  Found only by reverting the fix to watch the test fail.
- A fade test called `tickFactions` 20 times on the same day. The function
  returns early unless `day % FACTION_DECISION_INTERVAL_DAYS === 0`, so it ran
  zero times.

**Rule that follows: a green test proves nothing until you have seen it fail
for the right reason.** When a number is suspiciously clean, assume the
instrument first.

---

## 4. Where the director loop stands

`docs/findings/director-log.md` is the full record — trimmed 2026-09-07 to
just the still-load-bearing entries; the closed iterations before that are
archived to `director-log-archive-iterations-0-3.md` in the same directory
and rarely worth opening. Read its newest entries and, if the question is
about an older, specific finding, search for that finding's name rather
than reading start to finish.

**8 of a possible 8 iterations run, as of round 14 — that cycle's own
closing account, not a ceiling on the project.** §10's "two consecutive
reverts" condition was reached and reported at the time; the developer
brought the project back for further rounds since, each with its own
mandate. Table extended through round 26 below.

### Blind round scores

    axis           r10   r11   r12   r13   r14   r15   r17   r18   r19   r23   r24   r26   r27   r28
    First hour       8     8     8     8     9     9     6†    8     6     6‡    7     6     7    6‡
    Clarity          9     6     6     9     8     8     5†    8     5     7     7     5     7     6
    Feedback         9     7     8     8     8     9     7     8     8     9     8     7     9     8
    Depth            8     6     8     8     8     8     8     7     7     9     9     7§    9    8§
    Pacing           6     4     5     5     6     7     5     6     5     6     6     7     6     6
    Difficulty       8     6     6     7     7     8     6     5     7     7     6     6     8     7
    Writing          9     8     9     9     9    10     8     9     9    10     9     9     9     8
    Interface        8     6     7*    7     8     9     4†    6     4     6     6     6     6     6
    Standing in it   -     5     6     6     7     -     7     8     7     8     7     6     8¶     7
    Fun              7     6     6     6     5     7     6     7     5     7     7     7     8¶     7

Round 16 (2026-09-07 morning) is not in this table — that round's brief
asked only for a MUST FIX check and a novelty-day finding, not a full
Part 2 score sheet; see `.ai/FINAL_REPORT.md`'s earlier version in git
history if that round's own account is needed. † = this round's own
source-edit contamination affected these three columns specifically (see
`handoff-archive-pre-round23.md`'s round-17 block for the mechanism); read
Depth/Pacing/Difficulty/Writing/Standing in it/Fun for r17 as the real
reading, not the marked ones. ‡ = the tester's own working notes were lost
to a mid-session context handoff, not a game defect — read as unscored
rather than a real First Hour reading (see §6's round 23 block, and r28's
own account below — the same failure mode, a background agent's context
compaction mid-run, hit twice now). § = the
tester's own caveat: r26 never touched Diplomacy's aggressive options,
Rivals, Succession, Contracts, or the Arms Trade this run, and r28 never
touched The Trade, Succession, the Task Force favour, deep Armoury play,
or two of three attribute paths — both are partial-coverage scores, not a
reading that Depth itself declined. ¶ = r27's
tester gave one number for both Standing in it and Fun — PLAYTEST.md's own
instruction to check that this was intentional when the two match was not
visibly followed. Not chased further; both read as plausible on the run
described.

**r20-r22 and r25 do not appear here.** r20-r22: a separately-developed
branch used the same numbers for entirely different rounds before the two
histories were merged (2026-09-08) — see `docs/findings/director-log.md`'s
"log forks here" banner; round 22 in *this* table's lineage is a
diagnosis-only session (F24), not a blind playtest. r25: that round's own
tester used its own 8-axis grouping instead of the ten named axes, so its
numbers are not comparable column-for-column — its qualitative findings
are still in §6's round-25 block and were acted on. r23, r24 and r26 are
the three genuinely comparable points since the merge — no MUST FIX in any
of the three (r25's one MUST FIX is the exception, fixed the same day),
and Pacing and Interface between them show the clearest repeated pattern:
Interface has now read 6 in five rounds running (r19 aside) across five
different rounds, r27 included. **Interface has still not resolved after
four rounds of landed fixes and, as of r27, a direct, unleading ask to be
concrete about where the friction actually is.** r27 named a memo/digest
interaction and unlabelled icon buttons — real, narrow, checkable things —
not the "multi-panel information architecture" theory the prior session
closed on, which traced to a misread of an old `Dashboard.tsx` comment
about a problem from round 15 already fixed and has been retracted (see
`docs/findings/director-log.md`'s round-27 entry). Pacing has gone
6/6/7/6 — still inconsistent, not confirmed either way.

**Interface's five-AI-round plateau ended with a different method, not
another AI round.** The developer played it directly on 2026-09-09 and
found a real, fixable gap (the sit-down's low-familiarity reads, see
below) that none of the five AI rounds — including r27's own direct,
unleading ask — ever named. Worth reading as real evidence the axis was
partly measuring the testing method rather than only the game, though
Interface itself has no new number from this pass by design (it wasn't a
blind score).

**Round 28, 2026-09-10, run after five fixes landed (contract-charge
choice, rail grouping, the Operations focus/scroll fix, the sit-down
familiarity tier, the Bulletin staleness repair) — and every one of the
four sub-8 axes those fixes targeted came back flat or lower, not
higher.** Said plainly rather than filed quietly: Interface stayed
exactly at 6 for a sixth reading, Pacing stayed at 6, Clarity fell from 7
to 6, First hour fell from 7 to 6 (though see the ‡ caveat — this one in
particular rests on notes the tester lost mid-run). None of this round's
concrete, checkable complaints named any of the five things that were
actually fixed since r27; two of its findings (§6 below) instead turned
out to be existing, already-repaired features that the tester's own
tooling could not see (a modal-content blind spot, fixed this same
session once found) rather than the game regressing. That is a real,
useful result on its own — it means this round is not good evidence that
the r27 fixes failed, because the round was not built to see them — but
it is equally not evidence that they worked, and four still-flat or
falling numbers after five landed fixes is worth naming rather than
explaining away. The next round should look at whether these specific
repairs (the two-button contract choice, the grouped rail, Operations'
scroll-to-assemble) get noticed unprompted, not just whether new bugs
turn up.

**Round 14 was the high-water mark on seven axes against r10-r13 — it no
longer is, against the full table.** The tester was explicit about why:
*"The first sixty days were gripping. The last hundred and eighty were
grinding a position I could not win, with the same four jobs."* Round 15
now reads higher than r14 on six of those axes (Feedback, Pacing,
Difficulty, Writing, Interface, Fun) and is the actual high-water round on
most of the table; round 18 holds the high on Standing in it (8). Keep
this sentence's original claim as a record of what was true when r14 was
the newest data — it is not a current ranking.
First hour has now been 8 or better in five consecutive rounds and is the most
stable thing in this record. **That streak is a round-14 snapshot, not the
current state** — r15 held it (9), but r17 read 6 (contaminated, real value
unknown) and r19 read a genuine 6 (a career that never expanded). First
hour is not still the project's most stable axis; Writing is the only one
that has stayed ≥8 across every round in the table.

Round 13 is fully scored — screenshots worked from the first call, so **Interface
covers the visual half again for the first time since round 11**.

\* Round 12's Interface score covers information architecture only. **Every
screenshot in that round failed** — `computer{action:"screenshot"}` returned "the
Browser pane is not displayed" for 324 in-game days, so the tester read the whole
run through the DOM and correctly refused to score how anything looks. **The
visual half of Interface has not been scored since round 11.**

**The cause is now known and it is not backgrounding.** A backgrounded subagent
was tested against a live instance with the pane open and returned a normal
800x704 image. What round 12 lacked was an *open Browser pane* — the earlier note
in this file blaming background dispatch was wrong. **Open the pane before
dispatching a round, and have the tester screenshot once in the first five
minutes rather than discovering it at write-up.**

Round 12 played **two labelled careers**: run 1 blind, wiped out day 119; run 2
informed, Capo on day 324. Round 11 and round 12 are the only rounds ever to see
the late game.

### Iterations

- **Iteration 1 — Influence.** FAILED. Accrual was correct at a rate needing a
  year of unbroken counsel for one point. Tester finished at 2/20. Not
  reverted; reverting restores a strictly worse state.
- **Iteration 2 — rival pressure (grievance ledger).** FAILED. Moved pressure
  against the player from 65 to 111 across twelve 1,460-day careers. About
  **1.8 actions in a 303-day run**. Real, measurable, invisible to a human. Not
  reverted, same reasoning.
- **Iteration 3 — F8, the conviction heat discount.** `heatKeptWhenConvicted: 1`
  in `src/config/succession.ts`. Fixed but never seen convicted in a round.
- **Round 11 repairs — 4 MUST FIX and 12 SHOULD FIX, all done.**
- **Iteration 5 — F10, the front gate refusal. KEPT. The finding closed.**
  `business.ts:291` names the figure, the bar and the remedy, and
  `BusinessesPanel.tsx` moved that sentence out of a hover tooltip into visible
  body text.

  **The evidence is the tester's own words, not the score.** Round 13, blind:
  *"the option was disabled because public feeling was 26 and 'nobody there sells
  below 30'."* Round 12 spent 200 days on the same gate and never learned the
  cause; round 13 was blocked from about day 15, knew the stat and the bar while
  it was happening, bought its first front on day 44 and held seven by day 250.
  Clarity moved 6 → 9, the largest single-axis *improvement* in the project's
  record.

- **Iteration 6 — lay-low, plus F14 and F13.** Quiet-approach
  work is permitted while laying low; everything louder is refused with a reason
  naming the exception. **The heat maths is untouched** — a job still resets
  `quietDays` and still costs that day's decay, so working through the fortnight
  means paying 4 respect to cool nothing. That is the decision.
- **Iteration 7 — the rank table re-sized to 300 days. KEPT.** Everything above
  Crew Leader had been calibrated against four-year careers. After: Capo day 212 →
  86, Underboss 3/36 → 9/36, Boss 0/36 → 7/36. Over four years the whole ladder
  opens up. **The pre-committed target is not met and is left failing** — 34 of
  36 careers are held by the money line.
- **Iteration 8 — F12, the front gate said in advance.**
  `sentimentOutlook()` in `sim/operations.ts`, rendered as body text under the
  district picker, plus `feeling N` on every district button.

**That is 8 of 8 iterations. §10 condition 6 (an adversarial round) has since
been run once — see the archive's round-17 reconciliation block.**

## 5. The sizing rule — resolved 2026-08-21

**The instruments measure four-year careers. Every blind round is a one-year
one.**

Iterations 1 and 2 both failed for exactly this reason. Both were sized against
1,460-day bot statistics. Both are invisible in the ~300 days a person actually
plays.

**Any future change has to be sized against what happens in the first 300 days,
or it is being tuned for an observer that does not exist.**

This was put to the developer and **answered: adopt the 300-day rule.**
Iteration 4's attribute-training fix (`BUSINESS_FROM.launderingPerWeek`, sized
for 38 weeks → Business 4) is confirmed as the pattern to follow. See the
director log entry "Developer decision — 2026-08-21".

---

## 6. Open findings

Newest first. Everything before the 2026-09-08 merge (the F1-F23 finding
numbers, the Mafia-boss systems build, F22/F23's washing-machine and
wash-cut repairs, the 2026-08-21 repo audit) is archived in
`docs/findings/handoff-archive-pre-round23.md` — read that file if tracing
a specific old finding by name. A handful of threads from that era are
still genuinely open and not yet tracked in `.ai/TASKS.md`; they are
restated here rather than only in the archive:

- **2026-09-10: a full-scope polish/accessibility/retention pass is underway
  against a 39-section director brief (`NOT NEGOTITABLE.txt`), authorized to
  run without per-phase check-ins.** Four scope forks were resolved by the
  director up front: comprehensive event-tiering (not cosmetic), a real
  standalone Career History panel, new late-game systems even at the risk of
  reopening the previously-rejected "connected jobs" rank-unlock design, and
  real mechanics for Word/Ledger's dead verbs rather than leaving them
  labeled unreachable. **Closed so far:** the Trade's retainer cost and
  Succession's weak-claim gate are now signposted (two round-28 "Not Used
  table" findings); the Operations crew-picker's silent-no-op button when a
  crew is full; `informants.ts`'s `gone` flag split into `fate: 'dead' |
  'defected' | null` so Intelligence stops calling a defector "no longer with
  you"; a real business-vs-family conflict event (`gen_home_or_business`);
  and a full Career History system — `sim/career.ts` (snapshot-diff engine,
  minimized direct-write surface, 11 tests) plus a new `CareerPanel.tsx`
  reachable from the rail's Records group, live-verified in an isolated
  `mafia-verify` instance.
  **The event-tiering rework (sections 4/5/20) was audited and measured,
  then deliberately not built** — a 40-career/24,000-day diagnostic found
  same-day multi-event collisions on 0.3% of event-raising days, and
  danger-tier interrupts (the only kind that break a multi-day span's
  auto-resume) land roughly once per 200 days. A "DAILY BRIEFING" digest
  would touch `MemoModal`'s deliberately-designed identity to fix a
  collision that essentially does not happen; the felt problem the design
  doc actually quotes ("clicking through five of them") already has its
  shipped fix in the number-key hotkeys. Same call as the round-18 heat
  repair: measured, and not shipped, because no target existed.
  **Late-game systems (13/25) closed**, not with the parked "connected
  jobs" (their own postmortem says the flaw was the favour gate never
  being a cost, and the civic favour network they'd have duplicated
  already exists and is already tuned) but with one genuinely new thing:
  "Call a Walkout" — the union boss's favour spent outward for the first
  time, shutting down a named rival's payroll income for three weeks,
  costing nothing off the rival's own tuned wealth curve. **Word/Ledger
  real mechanics (27) closed.** Word: `canSitDownWith` now refuses a
  house you are actively at war with unless your word carries something
  (built), not a hard lock — the AI can still offer peace unprompted.
  Ledger: `RivalBusiness` gives a rival's front an actual identity,
  materialized as they invest, with a weekly stake payout and a "Buy in"
  button on each rival's own page — `PlayerPanel.tsx`'s
  `VERB_NOT_YET_REACHABLE` map is now empty. All of it test-first,
  mutation-verified, and live-verified in isolated instances.
  138 files / 1,619 tests passing, `tsc -b` clean.
  **Sections 7/8/9/10/14/15/16/33 audited and mostly closed.** 7
  (message clarity), 14 (repetition escalates) and 33 (performance) were
  found already satisfied by existing mechanisms and left alone. Two real
  gaps found and fixed: the Armoury had zero discoverability signal (no
  tip, no badge, no event pointer — the one system that could go a whole
  career unnoticed), closed with a new `armoury` tip; and case-strength
  growth was computed weekly with three named causal terms that never
  reached the player, closed with `Investigation.lastGrowth` surfaced in
  `LawPanel.tsx` next to the strength number, behind the same intel gate.
  One real but not-yet-built gap recorded for later: NPC loyalty's weekly
  drift terms have no UI surface at all, not even qualitative — needs a
  banded list, not a numeric breakdown, to respect the "never a number"
  rule. `npm run probe` also run: 3 pre-existing failures, none in files
  this session touched, not chased further. 139 files / 1,633 tests
  passing, `tsc -b` clean.
  **Long-run/edge-case testing and the final report are also done.**
  Long-run (§29) was already covered by the existing `npm run probe`
  suite; edge cases (§30) got two new explicit tests — a save/load
  round-trip with an open memo and an open sit-down together, and a
  structural proof a memo and a sit-down can never both be on screen at
  once. **The pass is complete.** Full per-section (1-39) status table and
  the brief's own required report format at
  `docs/findings/not-negotiable-report.md`. Two real, honestly-recorded
  gaps remained for a future pass at that point: NPC loyalty's drift
  terms had no UI surface, and late-game job-type variety is still open
  across four rounds of independent confirmation (three pre-existing
  `ladder.probe` failures, confirmed unrelated via `git diff --stat`,
  also need investigation). 141 files / 1,636 tests passing, `tsc -b`
  clean at that point.
  **Loyalty pressures UI closed same day, director-requested as the
  follow-up.** `sim/npc.ts`'s `loyaltyPressures` surfaces the five weekly
  loyalty-drift terms (pay, stagnation, heat-fear, grievance — Grip
  excluded as an already-visible, org-wide build stat, not a per-person
  hidden one) through `perceive()`'s existing fog, each line gated on its
  own `perceive()` call rather than one blanket threshold. Rendered on
  `CrewPanel.tsx`'s per-person sheet as "What is working on their
  loyalty." 6 new tests, all 4 active gates mutation-verified
  independently, live-verified (a fresh associate's pay status showed
  correctly on day one). 141 files / 1,641 tests passing, `tsc -b` clean.
  **Late-game job-type variety picked up next, CLOSED — the premise did
  not survive measurement.** `callTheLaw` (`sim/civic.ts`) gave the
  captain's favour the same outward reach the union's walkout has, but
  that alone didn't touch the actual rounds 23/24/27 complaint (the
  operations board repeating job types late-game), so the claim got
  measured directly. Extended `ladder.probe`'s own trusted bot with
  `launchedByEra` (era-bucketed job-type census on the `Climb` record) and
  read 36 careers: distinct job types launched **rise** late-game (16 → 22
  → 23, early to late) and the top job's share of launches stays flat at
  41-43% throughout. Rounds 23/24/27's literal claim does not hold. Put it
  to the director with the new evidence; chose "different verb, not
  different job" over an `OperationDef` redesign. Built the third outward
  civic favour, `pullPermit` (the alderman) — shuts down one named
  `RivalBusiness` rather than a whole family — completing a set of three
  (union/captain/alderman); the judge remains the one figure with no
  honest outward reading. 141 files / 1,647 tests passing, `tsc -b` clean.
  The three pre-existing probe failures remain the only open items. See
  `docs/findings/director-log.md` for the full per-decision reasoning
  across all seven phases of this pass.
- **`informants.probe`'s 29/30 guard is still deliberately left failing.**
  One world in thirty never has anybody seen to talk, traced to
  `gen_paper_moving` letting a boss with no representation retain counsel
  they never had. The developer's call, not touched since 2026-08-23.
- **The 1,460-day Difficulty regression — CLOSED, stale, 2026-09-09.**
  The 69-75%-ended-early figure this bullet used to carry was from
  2026-08-21-era code and was never re-measured before this session, the
  same mistake round-17's "job dominance" finding had already made once.
  Re-run with a one-off diagnostic on `scorecard.probe`'s own 48-world,
  1,460-day population: **endedEarly is now 39.6% (19/48)**, close to the
  33% target, and the Difficulty axis itself reads **6.07**, up from the
  4.7 "lowest ever measured" reading this bullet was written against.
  Traced the mechanism while at it, since nobody had: `removePlayer` in
  `succession.ts` is the *only* place `state.gameOver` is ever set, and it
  is called from exactly one site (`investigation.ts`'s trial verdict) — a
  career can only end here by a conviction with no eligible, serious
  successor at that exact moment. Across the 48-world run: 131 removals
  total (2.73 per career, 119 convictions and 12 killed), of which only 19
  had zero eligible contenders — and 19 is exactly the ended-early count,
  confirming the mechanism. Diagnostic was temporary (a `globalThis` push
  in `removePlayer` plus one throwaway `it()` in `scorecard.probe.test.ts`)
  and fully reverted; nothing was kept in source. **A smaller, different
  question surfaced in the same run and is not this one**: `distinctEnds`
  (how many different final ranks 48 four-year careers reach) was only 2,
  which is now the axis's actual soft spot rather than survival — not
  investigated further this session.
- **Word and Ledger (two Diplomacy verbs) are unwired, and it is a design
  question, not a bug.** `canCallATable`'s gate protects a restriction that
  does not exist; `canBuyIn`/`buyIn` need a referenceable rival-business
  entity the sim does not have. `PlayerPanel` already says both are
  unreachable, so no player is misled.
- **The pressure dial's `hard` setting is close to unreachable** (29 of
  1,498 career-weeks in the population that first measured it) — a balance
  question, not touched since 2026-08-23.
- **Stock at 43% of trade revenue is the biggest leak left in the trading
  economy**, per F23's own closing note, and nothing has looked at it since.


**Status 2026-09-17: this pass is complete.** Every section of the brief
is accounted for in `docs/findings/not-negotiable-report.md`. The entry
above is kept as the record of its opening scope; the phase-by-phase
account is in `docs/findings/director-log.md` (phases 1–11) and the
archive named below.


**Round and milestone narratives, 2026-09-08 → 09-16 (rounds 23–28, the
Not Used table, trades profitability, deposition, family milestones 2–3,
the eventgen RNG isolation), are archived verbatim in
`docs/findings/handoff-archive-2026-09-milestones.md`.** Read that file
when tracing a specific finding; nothing was deleted.
