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

**Current verified state: `tsc` clean, 740 tests, 63 files — 739 passing and
one failing on purpose** — `ladder.probe`'s pre-committed pacing target, which
the rank table has never met. Both pre-commits written during the Mafia-boss
build are met, and `scorecard.probe`'s Pacing axis is back above its floor. Both are the same finding seen from two angles: the rank ladder
is slow. `ladder.probe`'s pre-committed pacing target reads Capo in 13 careers
of 36 against a target of 24, and `scorecard.probe`'s Pacing axis reads 2.7
against a floor of 3 because a bot that has run every job kind, worked every
district and stopped gaining rank has no firsts left. **The two pre-commits
written during the Mafia-boss build are now met** — see section 6. `ladder.probe.test.ts` carries a pre-committed pacing
target the rank table does not meet; see §9. 62,453 lines
across 183 source files, counted 2026-08-22.

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
project has produced **29 instances** of it, and round 15 found the newest one.
Recent examples:

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
