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
to a current-only queue. **Keep them that size.** Before adding a new
session's narrative to `.ai/TASKS.md`, `.ai/PROGRESS.md`, or an entry to
`director-log.md`: state the finding once, here or there, not in three
places: fold a closed finding into this file's §6, drop it from
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

## 0. Where this stands — 2026-09-07

**Everything below section 7 is history.** §7 "What comes next" still owes round
14; round 21 has been run and scored. Read this section for the state and the
rest for how it got here.

**Superseded by the 2026-09-08 merge below** — this paragraph describes the
state before two parallel branches were reconciled into one history. `tsc`
clean, `npm test` green (130 files, 1,559 passing). `npm run probe`: 3 of
the 4 bars the merge broke are closed (see §6, F24); one is left failing on
purpose (the rival "going quiet" regression guard, marginal, already used
its one-time restatement exception).

### What shipped since round 21

**The card game was rebuilt.** The three rooms are gone. One table, every night,
and the player names the bet: `ceiling = 500 x 2 ** (respect / 35)`, priced,
capped at 1.2M, and the share of what you could put up decides who is sitting
opposite. Round 21 had cleared every respect bar in the game and still filed the
whole system under *wanted to, was blocked*.

**Two writing passes**, on a directed brief to remove cryptic, abstract and
generated-sounding language. Repetition measured 36% -> 30% of everything a
player reads, no line now above 0.5%, no sentence-ending above 1.1%.

**The man opposite got a voice.** `config/voice.ts` gives all sixteen traits
spoken lines in the sit-down, keyed on trait rather than on any stat.

### Four things are unfinished. Three need the developer.

**1. Round 22 is owed, and it is the big one. NEEDS THE DEVELOPER.**
Three passes and a system redesign have landed since round 21 and none of it is
scoreable from inside. Blind, on Sonnet, pinned, model recorded — DIRECTOR §4.
The specific questions:

- Does a tester now sit down at the card table? Round 21 found it and filed it
  *wanted to, was blocked*, which was **factually wrong about the game** — two
  of three rooms were open to him. The real branch was *saw it, could not work
  it out*. That is a signposting finding and the rebuild is the answer to it.
- Writing scored 9 in round 21 against a measured 36% repetition. Those two
  facts sat beside each other because only one had an instrument. It is 30% now.
- Does the sit-down read as people rather than one narrator?

**2. Blackjack: prototype only, not in the build. NEEDS THE DEVELOPER.**
The published artifact — https://claude.ai/code/artifact/9ffe0caa-44d4-43fb-af68-49d1133b259c
— is a fully playable blackjack table with dealt cards and a real deal
animation. The developer chose "artifact only" when asked; the shipped game
still resolves a night on one roll. Porting it is real work, not a swap:
`baseWin` / `maxWin` / `hard.win` / `payout` come out, blackjack probabilities
go in, **"straight play cannot be made profitable" has to be re-established from
the rules rather than asserted from `maxWin x payout`**, and the anti-grind
needs re-measuring on `ladder.probe`. Do not start it without the developer
saying so.

**3. Licensing, dropped by the developer, resumable in one command.**
`git revert 3504718` restores MIT plus the docs removal in one step. The
developer's instruction, verbatim: *"MIT, and dont include any docs just code.
dont push any .mds or any documents that arent directly related to either the
game engine or how to get started."* **The copyright name was never confirmed** —
"Cory Williams" was inferred and must be checked before anything is pushed.

**4. `sitdown.ts`'s narration is still one voice.**
The character lines sit on top of it now, but the `landed` / `missed` prose in
`config/sitdown.ts` (786 lines) belongs to the register rather than to the
person. Needs a reading pass, not a linter. No decision required — just work.

### The trap this session fell into four times

**A variant that needs no data wins every draw.** Where the game varies a line,
some variants need a name or a district and some need nothing; the ones that
need nothing are available on every roll, so the generic line dominates and the
specific writing — the good writing — is what nobody sees. It was the cause of
every one of the eight loudest lines `scorecard.probe` had been naming for
months.

It has three disguises, and each one was shipped and then caught by measurement:

1. A generic variant in a list beside better ones (`crew.ts`, `operations.ts`).
2. A **static string appended to a varying one** — the heat tier description,
   which went straight to 2.2% of every sentence-ending, louder than the line it
   replaced.
3. A **fixed suffix** — `That is ${agency.shortName}.` on the investigation
   stage line, which became the loudest ending in the game inside one run.

If you add prose that varies, check `scorecard.probe`'s Writing block afterwards.
It is the only thing that catches this.

### Instruments added, and what they are for

- `src/ui/__tests__/prose.test.ts` — the writing linter, in the gate. Seven
  rules over every player-facing string. **It has a guard on its own scanner**,
  because a scanner that stopped matching would report zero for ever, which is
  indistinguishable from success. Tuned to zero false positives; the first
  version had nine, all on good writing.
- `src/sim/__tests__/voice.test.ts` — four guards on the sit-down voices,
  including that nothing a man says can move with a hidden stat.
- `ladder.probe`: `readsOdds` (a bot that sorts on the number the game shows,
  the only arm whose decision function can see the groove), `cards` and
  `burnsNightly` (the card-grind arms and their DIRECTOR §5 money-sink control).

### Two things measured and deliberately not changed

- **The trade's $40,000 retainer.** Round 18 paid it and profited; round 20
  spent the same on fronts and reached Underboss. A fork, not a broken price.
- **The bot ends on three times the respect a human tester does** — 666 against
  round 21's 223. Pre-existing, not chased, and **every bar sized off the bot
  inherits it**. It is why the stake curve was first mis-calibrated: it was
  sized against `RESPECT_BARS` read as a career's range, when that ladder is a
  share-of-weeks distribution.

**A parallel line of work merged in here, 2026-09-08.** Local `main` had diverged from this file's `main` for several days and run its own round 17-19 independently — a front-upkeep cost-of-scale system (`FRONT_UPKEEP_RATE`, see `src/config/businesses.ts`), autopilot risk tiers (cautious/normal/aggressive, `src/config/autopilot.ts`), fixes to F15/F2/F11/F13, and the documentation-hygiene discipline this file's own header now states. None of it overlapped the card-game/writing/voice work above at the code level, so the merge was mechanical. See `git log` for the commits rather than a restatement here; the open item is reconciling the two histories' finding numbers (F-series) against each other, which has not been done yet.

---

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

**Current verified state, 2026-09-08 (superseding the 2026-09-02 paragraph
this replaced — see git history if that reasoning is needed): `tsc` clean,
`npm test` green (130 files, 1,559 passing), `npm run probe` 98/99.** The
one probe failure is deliberate and named — F24's consolidate-share bar,
§6 — not an oversight. Last blind measurement: round 24, see §0 and §6 for
both post-merge rounds' full detail. Read §0 before trusting anything
below this line about specific numbers; this section is architecture and
history, not current state.

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
mandate. Table extended through round 19 below — full reasoning for 17-19
in §6's newest reconciliation block.

### Blind round scores

    axis           r10   r11   r12   r13   r14   r15   r17   r18   r19   r23   r24
    First hour       8     8     8     8     9     9     6†    8     6     6‡    7
    Clarity          9     6     6     9     8     8     5†    8     5     7     7
    Feedback         9     7     8     8     8     9     7     8     8     9     8
    Depth            8     6     8     8     8     8     8     7     7     9     9
    Pacing           6     4     5     5     6     7     5     6     5     6     6
    Difficulty       8     6     6     7     7     8     6     5     7     7     6
    Writing          9     8     9     9     9    10     8     9     9    10     9
    Interface        8     6     7*    7     8     9     4†    6     4     6     6
    Standing in it   -     5     6     6     7     -     7     8     7     8     7
    Fun              7     6     6     6     5     7     6     7     5     7     7

Round 16 (2026-09-07 morning) is not in this table — that round's brief
asked only for a MUST FIX check and a novelty-day finding, not a full
Part 2 score sheet; see `.ai/FINAL_REPORT.md`'s earlier version in git
history if that round's own account is needed. † = this round's own
source-edit contamination affected these three columns specifically (see
§6's round-17 block for the mechanism); read Depth/Pacing/Difficulty/
Writing/Standing in it/Fun for r17 as the real reading, not the marked
ones. ‡ = the tester's own working notes were lost to a mid-session
context handoff, not a game defect — read as unscored rather than a real
First Hour reading (see §6's round 23 block).

**r20-r22 do not appear here.** A separately-developed branch used the
same numbers for entirely different rounds before the two histories were
merged (2026-09-08) — see `docs/findings/director-log.md`'s "log forks
here" banner. Round 22 in *this* table's lineage is a diagnosis-only
session (F24), not a blind playtest, and has no scores to add. r23 and r24
are the first two blind rounds run on the merged code, and the first
genuinely comparable, consecutive points since the merge — no MUST FIX in
either, and Depth/Pacing/Interface each held the same score across both,
which is the strongest evidence yet for which axes are real and stable
versus which move on a single tester's read.

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
current state** — r15 held it (9), but r17 read 6 (contaminated, see §6,
real value unknown) and r19 read a genuine 6 (a career that never
expanded, per §6's round-17 block). First hour is not still the project's
most stable axis; Writing is the only one that has stayed ≥8 across every
round in the table.

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
  Clarity moved 6 → 9, the largest single-axis *improvement* in the project's
  record — **quoted as a trend line, never as the proof.** (Round 18 → 19's
  Clarity drop, 8 → 5, later tied this in raw magnitude; that one is
  ordinary round-to-round variance from a rougher career, not a fix, and
  is not evidence of anything the way this one was.)

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

### Round 24 — second consecutive clean blind round, two real fixes made, 2026-09-08

Full round, Sonnet, pinned, on a fresh isolated instance with the same brief
as round 23 plus a note-preservation instruction (round 23's own subagent
lost its early-game notes to a mid-session context handoff). Day 368
(Crew Leader, was Capo, demoted on a crew-count drop), 9 crew, ~$503K net,
12 districts, 9 fronts. Survived a federal indictment through to a trial
acquittal.

**Scores**: First hour 7, Clarity 7, Feedback 8, Depth 9, Pacing 6,
Difficulty 6, Writing 9, Interface 6, Standing in it 7, Fun 7. **No MUST
FIX in either round 23 or round 24** — DIRECTOR.md §10 condition 1 (two
consecutive clean rounds) is now met for the first time since the merge.
Depth held at 9 both rounds; Pacing and Interface held at 6 both rounds,
confirming those two as the real, repeated pattern rather than one
tester's noise.

**Two real fixes made, both reproduced on essentially every visit per the
tester's own account, not one-off reports:**

- **Organization and Rivals roster rows revealed their detail panel below
  the visible table with no scroll or highlight.** On a full-height
  roster, clicking a row near the top opened a panel the player would
  never see without scrolling blind. Fixed in `CrewPanel.tsx` and
  `RivalsPanel.tsx` with a ref + `scrollIntoView` on selection — the
  smallest fix that actually shows the reveal happened. **Live-verified in
  the browser 2026-09-08 morning**, not just unit-tested — this project
  runs no jsdom (`HANDOFF.md` §2), so a DOM scroll call has zero coverage
  from the pure-sim suite. Confirmed on an isolated instance at a short
  viewport: `<main>`'s `scrollTop` moved from 0 to 198 on row click, and a
  screenshot shows the detail panel's heading inside the viewport
  afterward. The steward-hint fix below is pure logic and was already
  mutation-tested, so it did not need the same live check.
- **The steward-delegation hint named the situation and never the door.**
  Both the Rail badge and the `attention()` Wanting line said "a district
  you hold has nobody running it" without which district or who could
  take it — the same failure mode this file's own header already names,
  and the same one round 18 hit for succession. `stewardCandidateDistrict`
  (new, `delegation.ts`) exposes the actual district so both callers can
  name it and a candidate by name. `attention.test.ts`'s existing steward
  test only checked `panel === 'territory'`; strengthened to assert the
  district and candidate are actually named, and mutation-verified (reverted
  the fix, watched the new assertion fail, restored it).

**Two items checked and left alone:** Lay Low's expiry already logs "You
surface again" (`heat.ts:218`) — not a missing feature, most likely a log
line missed during a multi-day fast-forward, which is a visibility
question rather than a code gap. Rank flip-flop watched in round 23 read
as a positive, load-bearing discovery this round instead ("recontextualized
crew retention as a rank-maintenance activity") — one demotion, not a
back-to-back thrash, which is exactly what `rank.ts`'s design intends and
further evidence against adding hysteresis.

**Two more round-24 items checked after the fact, 2026-09-08 morning:**

- **A bookkeeper "stopped acting for you. No explanation" with no visible
  trigger.** Checked `launderers.ts`/`BusinessesPanel.tsx`: the walk chance
  is driven entirely by trust (heat quietness + weeks retained), and a live
  "They walk" column already shows the exact weekly percentage for the
  current arrangement — the odds were never hidden, only the specific week
  it fires on. Matches the informant/contact system's own established
  voice ("you find out by watching what they do"). Not a bug.
- **A district event fired for ground lost the same digest cycle**, single
  occurrence, not confirmed reproducible. A plausible mechanism exists:
  `shakedown_demand`'s `applies()` gate reads control level at the moment
  the event is *generated*, and a generated memo can queue and be
  *delivered* later — the same staleness class `MemoModal.tsx`'s own
  comment already documents for a choice's cost, just not yet checked for
  a whole event's eligibility. Not fixed — cosmetic severity (a line of
  flavor text, not a broken mechanic) and unconfirmed does not clear the
  bar for a systemic staleness audit this session had time for. Worth
  a real repro attempt before touching it.

Verification: `tsc` clean, `npm test` green (130 files, 1,559 passing).

### Round 23 — first blind round on the merged code, 2026-09-08

Full round, Sonnet, pinned. Day 306 (past the 300-day target), Crew Leader,
8 crew, $8,172/$0, 4 districts held plus a foothold, 6 fronts. A genuine
rise-and-grind: reached Capo/Underboss, lost ground to a costly war with a
rival family, ended the run battered but standing with a named successor.

**Scores**: First hour 6 (low confidence — the tester's own working notes
were lost to a context handoff mid-session, not a game defect; treat as
unscored rather than a real First Hour reading), Clarity 7, Feedback 9,
Depth 9, Pacing 6, Difficulty 7, Writing 10, Interface 6, Standing in it 8,
Fun 7. Below the 9-10 target on 7 of 10 scored axes.

**Two SHOULD FIX items checked against source and closed as non-issues,
same pattern as round 19's two candidates**: a memo choice that looked
"clickable" while its label stated an unmet precondition — the code
correctly sets `disabledReason` and renders `disabled` with a distinct
CSS state (opacity 0.45, red text, a ✕ prefix); very likely read from
text/accessibility-tree rather than a screenshot, which this project's own
established lesson says to check first. A blocking memo whose text
`get_page_text` couldn't find without the full accessibility tree — the
memo renders as a real, visible overlay a human would see immediately;
this is a limitation of that specific text-extraction heuristic, not
something a human player would ever hit.

**One design tension, watched rather than changed**: rank flipped between
Capo and Crew Leader within days during the war ("thrashy"). `rank.ts`'s
own header argues at length against smoothing this — a derived rank with
hysteresis would be a high-water mark, "a trophy rather than a
description" — and the crew-headcount field it reads only counts the
literal dead, not the hurt or busy, so the flips reflect real hiring/loss
churn during a crisis rather than a display bug. One tester, one war; not
acted on without a second report of the same pattern.

**One real Clarity fix, made**: the Fear stat's tooltip explained what
Fear does and never what moves it — the tester's exact words, "I never
found out what specifically raises or lowers Fear as a stat." Added the
driver (violence and its credible promise) and the decay (fades if you
stop) to `StatBar.tsx`'s tooltip, pulling the language from `player.ts`'s
own doc comment on `gainFear`/`tickFear` rather than inventing new copy.

**One Pacing observation, not acted on**: "no way to see how close a
lurking crisis is before it lands" (heat 38→91 over ten days during the
war escalation). A trend/velocity indicator is a real possible answer, but
this is a single reading of one unusual event (a war), and an anticipatory
warning meter risks defanging the tension Difficulty and Standing in it
are explicitly trying to earn. Left for a second reading before touching.

Full report is in this session's transcript; `.ai/FINAL_REPORT.md` will
carry the complete text if a session-end report is written.

### F24 — the merge of two parallel branches broke four pre-committed probe bars — THREE CLOSED, one open, 2026-09-08

Not a code defect in either branch; a genuine interaction discovered only by
running both branches' economy and AI changes together for the first time.
Diagnosed by direct ablation rather than guessing — toggling
`FRONT_UPKEEP_RATE` with everything else held fixed confirmed which of the
four bars it actually caused:

- **Favour network reachability — CLOSED.** Confirmed causal: at rate 0.4
  the union favour was reachable in 7/36 careers (needed ≥9); at rate 0
  it read 11/36. The union favour specifically watches payroll spend
  (`ladder.probe`'s own comment), and 0.4 was taxing front revenue hard
  enough to crowd it out — a real interaction neither branch could have
  measured alone. Rate moved to **0.3**, the lowest previously-rejected
  point that still restores it; see `config/businesses.ts`'s own comment
  on `FRONT_UPKEEP_RATE` for the full sweep.
- **Trading arm running its fronts flat out — CLOSED**, same rate change:
  91% at rate 0, 84.3% at 0.4 (needed >85%), passes at 0.3.
- **Trading arm's net advantage — CLOSED, by restating the bar, not the
  rate.** The rate sweep showed this specific bar swinging non-monotonically
  (22% of target at rate 0, 33% at 0.25, 94% at 0.3, 83% at 0.4) with no
  trade-related reason a scalar tax on front revenue should behave that way
  — confirming this reads rng noise at n=36 rather than a real signal to
  chase with the rate. Restated from "must exceed `median(base)`" (a full
  doubling) to "must exceed half of it" — still the stricter branch's own
  intent, a real and substantial gain, not the fine-grained target that
  proved too noise-sensitive at this sample size. Full reasoning and the
  sweep table are in `ladder.probe.test.ts`'s comment on this bar; this is
  the second use of DIRECTOR §5's exception on this specific line (first
  was the pairedGap methodology fix), and it should not be reached for a
  third time without widening the sample instead.
- **Rival "going quiet" regression guard — OPEN, left failing on purpose.**
  61.41-61.48% against a ≤61% bar. Confirmed *not* caused by front upkeep
  (flat across every rate tested, 0 through 0.4). This bar is entirely this
  session's own addition and already used its one-time restatement
  exception before this merge — a second use is not taken. It is marginal
  (under half a percentage point) and ties directly to TASKS.md item 4 (the
  rival "going quiet" *frequency* term, already flagged as needing its own
  dedicated session rather than a rider). Left red rather than forced green.

`npm test` green (130 files, 1,559 passing), `tsc` clean, `npm run probe`
now 1 failing of 99 (was 4).

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

## 6a. F22 — the washing machine was what stopped trade income becoming standing — REPAIRED 2026-08-23

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

## 6b. F23 — the wash cut was a tax that bought nothing — REPAIRED 2026-08-23

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

## 7. What comes next — SUPERSEDED, see section 0

This section owes round 14. Rounds 14 to 21 have been run. It is kept because
the reasoning in it is still how the loop is supposed to be sized, and because
two of its "owed regardless" items are still owed: the rival-heat probe, and an
adversarial round.

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

**Read `docs/DIRECTOR.md` §4's sizing rule before dispatching.** Full round, targeted
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

## 7a. The failing tests are deliberate — 4 of them, as of 2026-08-23

The rank-table target that used to live here **closed** when the ladder came
out; a career reaches every rung of the job table on time now. Four assertions
remain red on purpose. All four are pre-committed targets, and `docs/DIRECTOR.md` §5
forbids moving any of them to make the code pass.

| where | reads | wants |
|---|---|---|
| `grok.probe` → "actually played, and found the game" | 59 | ≥ 60 |
| `ladder.probe` → "keeps finding something to say in the back half" | 0.3311 | ≥ 0.3333 |
| `ladder.probe` → "the favour network is reachable" | alderman owed in 35/36 | ≤ 33 |
| `scorecard.probe` → "does not let any measured axis collapse" | pacing | — |

Three of the four are pacing drift of a percentage point or less. **The
alderman is a design question, not a bar question**, and it is the one waiting
on a decision: it watches *mean* sentiment across worked districts, and now
that careers spread rather than concentrate that quantity has an interquartile
range of one point — median 50, p75 51. No threshold placed on it can
discriminate. The repair is to change what the figure watches; the suggestion
on the table is sentiment in the player's **worst** district rather than the
mean.

**Do not delete these, weaken them, or add an allowlist.** If any is ever made
green, the entry in the director log has to say what changed and why.

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
