# Handoff — Frontline

Read this, then read `DIRECTOR.md` and `PLAYTEST.md`. This file is the state;
those two are the rules.

Project root: `C:\Users\cory\Desktop\mafia`. Not a git repo. Windows 11,
PowerShell 5.1 (no `&&`, no `||`, no ternary — use `;` or `if ($?) { }`).

---

## 1. What the project is

Frontline is a crime-family management simulator. React 18 + TypeScript 5.7 +
Vite 6, Vitest 2. The player starts broke and grows an organization through
operations, crew, territory, rival families, and law enforcement.

    npm run dev        # play it
    npm test           # vitest run
    npx tsc -b         # types
    npm run playtest   # namespaced instance for blind testers

**Current verified state: `tsc` clean, 660 tests, 57 files — 659 passing and one
failing on purpose.** `ladder.probe.test.ts` carries a pre-committed pacing
target the rank table does not meet; see §9. 53,553 lines
across 160 source files, after the audit in §8.

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
  condition is the finding. `DIRECTOR.md` §5 has a narrow repair clause; it
  needs the developer's call, with the evidence attached, every time.
- **Write the test first. Watch it fail for the expected reason. Then
  implement.** Standing instruction, in memory.
- ASD-STE100 Simplified Technical English applies to **chat responses only** —
  never to code comments. The comments in this codebase explain why each
  decision was made. Keep that voice. Source is the global `~/.claude/CLAUDE.md`.

---

## 3. The recurring failure mode

**Instruments that return believable numbers while measuring nothing.** This
project has produced **23 instances** of it. Recent examples:

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
  what the print helper actually divided by. The real shape is F15 in §6.
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
  payroll was covered on a week nobody got paid. HANDOFF §6 has the lines.
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

`docs/superpowers/findings/director-log.md` is the full record. 1,044 lines.
Read at least Iteration 3, the Round 11 repairs section and the Blind round 12
entry before acting.

**8 of a possible 8 iterations run.** §10's "two consecutive reverts, stop and
come back to the developer" condition has been reached and reported.

### Blind round scores

    axis           r10   r11   r12   r13   r14
    First hour       8     8     8     8     9
    Clarity          9     6     6     9     8
    Feedback         9     7     8     8     8
    Depth            8     6     8     8     8
    Pacing           6     4     5     5     6
    Difficulty       8     6     6     7     7
    Writing          9     8     9     9     9
    Interface        8     6     7*    7     8
    Standing in it   -     5     6     6     7
    Fun              7     6     6     6     5

**Round 14 is the high-water mark on seven axes and the low on Fun.** The tester
was explicit about why: *"The first sixty days were gripping. The last hundred
and eighty were grinding a position I could not win, with the same four jobs."*
First hour has now been 8 or better in five consecutive rounds and is the most
stable thing in this record.

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
  reverted; reverting restores a strictly worse state. **Round 12 finished at 0
  and named the reason — see F2.**
- **Iteration 2 — rival pressure (grievance ledger).** FAILED. Moved pressure
  against the player from 65 to 111 across twelve 1,460-day careers. About
  **1.8 actions in a 303-day run**. Real, measurable, invisible to a human. Not
  reverted, same reasoning.
- **Iteration 3 — F8, the conviction heat discount.** `heatKeptWhenConvicted: 1`
  in `src/config/succession.ts`. **STILL UNTESTED after two rounds** — neither
  round 11's tester nor either of round 12's careers was ever convicted.
- **Round 11 repairs — 4 MUST FIX and 12 SHOULD FIX, all done.** Round 12 held
  them: every axis they touched moved up or held, Clarity excepted, and Clarity
  has a single named cause (F10). **The earlier claim that nothing from round 11
  remained open was wrong** — round 11 reported the front gate in nearly the
  words round 12 used, and repair #12 moved the banner rather than the sentence.
- **Iteration 5 — F10, the front gate refusal. KEPT. The finding closed.**
  `business.ts:291` names the figure, the bar and the remedy, and
  `BusinessesPanel.tsx` moved that sentence out of a hover tooltip into visible
  body text. Test-first; the naming test failed for the right reason before the
  change. tsc clean, 618 tests green.

  **The evidence is the tester's own words, not the score.** Round 13, blind:
  *"the option was disabled because public feeling was 26 and 'nobody there sells
  below 30'."* Round 12 spent 200 days on the same gate and never learned the
  cause; round 13 was blocked from about day 15, knew the stat and the bar while
  it was happening, bought its first front on day 44 and held seven by day 250.
  Clarity moved 6 → 9, the largest single-axis move in the project's record —
  **quoted as a trend line, never as the proof.**

- **Iteration 6 — lay-low, plus F14 and F13. AWAITING ROUND 14.** Quiet-approach
  work is permitted while laying low; everything louder is refused with a reason
  naming the exception. **The heat maths is untouched** — a job still resets
  `quietDays` and still costs that day's decay, so working through the fortnight
  means paying 4 respect to cool nothing. That is the decision. Bundled with
  F14 (the sit-down buttons now say they open a conversation) and F13 (a blocked
  memo option renders in danger red with a ✕), neither of which can confound the
  lay-low question. Test-first, tsc clean, 625 tests, **ladder byte-identical**.

  **The identical ladder is not a safety result.** `floor.probe.test.ts:51`
  offers no operations while laying low, so no bot can ever take the new option —
  the instrument is structurally blind here (F7). It proves only that nothing
  else moved.

- **Iteration 7 — the rank table re-sized to 300 days. KEPT.** Everything above
  Crew Leader had been calibrated against four-year careers. Measured at 300
  days on the old table: three rungs inside ten weeks, then a **309-day gap**,
  and **Boss and Crime Lord reached by no career at all**. After: Capo day 212 →
  86, Underboss 3/36 → 9/36, Boss 0/36 → 7/36. Over four years the whole ladder
  opens up. **The pre-committed target is not met and is left failing** — 34 of
  36 careers are held by the money line, which is F15. Two pre-existing
  invariants (`foresight.test.ts` 3–6× steps, `balance.test.ts` no coasting)
  constrain the money column and both fired on the first attempt.
- **Iteration 8 — F12, the front gate said in advance. AWAITING A ROUND.**
  `sentimentOutlook()` in `sim/operations.ts`, rendered as body text under the
  district picker, plus `feeling N` on every district button. Test-first, two
  defects reinstated and red demanded, verified in the browser.

**That is 8 of 8 iterations. §10 condition 6 has still never been attempted.**

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

Ranked. F10 outranks everything else in this list.

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

  **Not yet done:** no bot exercises it, so it is invisible to every probe
  (F7). No blind round has seen it. The live-game half of the browser check
  could not run — see below.

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

## 7. What comes next

**Two unmeasured iterations are now stacked.** Iteration 6 (lay-low, F14, F13)
was never scored, and iterations 7 and 8 landed on top of it. **A round now
measures three changes at once, which is a confound the loop warns about.** It
is the developer's call whether to split it.

**Round 14 is what is owed**, and it now has four questions rather than one:

1. Does lay-low still read as the game going away? (iteration 6)
2. On what day does the tester find the back room? (F14 — Part 4's Used list
   already asks for a first-used day without naming the feature)
3. Does a refused memo option now look refused? (F13)
4. **Does the tester ever hit the front gate?** Iteration 8 is meant to make it
   avoidable rather than legible. F10's fix made the refusal readable; if
   iteration 8 works, a blind round stops reporting the gate at all.

**Read `DIRECTOR.md` §4's sizing rule before dispatching.** Full round, targeted
round, or not a round.

**Owed regardless:**

- **The rival-heat probe.** F5 is confirmed as behaviour, mechanism unverified.
- **An adversarial round.** §10 condition 6, never attempted, and now the only
  iteration budget left.
- **F15 needs a probe that can play the wide game.** The front fork is measured
  through a bot that is money-blocked in 97% of its idle weeks (F7). The
  correlation is total, but no instrument here has been shown able to buy fronts
  deliberately, so F15's *mechanism* stands on the same footing F5's does.

**This session cannot score round 14.** It re-sized the ladder, wrote the
pacing probe, and made every change since. Dispatch from a fresh agent, with the
Browser pane open before dispatch — a proven prerequisite, not a precaution.

## 7a. The failing test is deliberate

`ladder.probe.test.ts` → "gives a 300-day career more than three rungs" fails
at `Capo 18/36, expected >= 24`. It is a **pre-committed design target for the
rank table**, written before the table was touched, and `DIRECTOR.md` §5 forbids
moving it to make the table pass. It closes when a career can reach Capo without
first winning the front lottery — that is F15, not the ladder.

**Do not delete it, weaken it, or add an allowlist.** If it is ever made green,
the entry in the director log has to say what changed and why.

## 8. Repo audit — 2026-08-21, after round 11

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
