# The Boss Simulation — audit and architecture

**Status: proposal. No code changes accompany this document.**

This is the full audit and redesign asked for before implementation: every system in
the project, what it does, what depends on it, what to keep, what to change, what to
remove, and what is genuinely missing. Then an architecture, a dependency graph, and a
roadmap.

Three things have to be said before the audit, because they change what the rest of
this document is for.

### 1. An earlier version of this brief has already been acted on

`docs/superpowers/specs/2026-08-21-mafia-boss-blueprint.md` was written against the same
vision, merged as PR #1, and then — on an explicit instruction to build it — five
systems were implemented across PRs #2 to #6. Those are: Influence supply, the civic
favour network, whispers, legitimacy with career shapes, and the per-front pressure
dial. PR #6 is open; #1 to #5 are on `main`.

So this audit is being taken **after** part of the work, not before it. That is stated
plainly rather than papered over, and §1.4 lists exactly what those five systems now do
so nothing here re-proposes them.

### 2. Nothing built in those five PRs has been measured

Every one of them is invisible to every automated probe in the project, and no blind
tester has seen any of them. This is finding **F7** — *"every instrument in this project
plays the same narrow game"* — five times over. Their tests prove the code does what the
code says. They prove nothing about whether the game is better.

Any roadmap that stacks a sixth system on top of five unmeasured ones is building on an
unread instrument, which is this project's documented failure mode (`HANDOFF.md` §3,
**25 recorded instances**). §5 therefore ranks measurement first, and says so in the
roadmap rather than in a footnote.

### 3. The central premise of the vision contradicts the project's own record

The vision says the player should already be the boss rather than climb to become one.
Four blind rounds disagree about where the problem is:

    axis           r11   r12   r13   r14
    First hour       8     8     8     9
    Fun              6     6     6     5

**First hour is the strongest, most stable axis in the record.** It is the broke
opening. Round 14, unprompted: *"The first sixty days were gripping. The last hundred
and eighty were grinding a position I could not win."*

The boss fantasy is not missing from the start of the game. It is missing from **day 60
onward**, which is exactly where F1 says decisions stop changing. Everything proposed
below targets that window. This is not a rejection of the vision — it is the same
fantasy, delivered at the point where the player has something to lose, which is the
only condition under which any of it means anything.

---

# PHASE 1 — THE AUDIT

57,833 lines across 173 source files, counted in this pass — `HANDOFF.md` still says
53,553 across 160 and is stale. 41 simulation modules, 32 config modules, 31 UI modules,
60 test files carrying 687 tests.

## 1.1 How to read this section

Every system gets the same nine questions. To keep it readable, only the answers that
are **not empty** are printed. If a system has no "redundant" line, nothing in it is
redundant. Silence is an answer, not an omission.

Status values:

- **Solid** — works, tested, keep as is.
- **Solid / unmeasured** — works and is tested, but no blind round or probe has ever
  exercised it.
- **Partial** — real, but does less than the vision needs.
- **Thin** — exists as a number or a list, with little behaviour behind it.
- **Absent** — not in the codebase.

## 1.2 The map, in one table

| # | System | File | Status |
|---|---|---|---|
| 1 | Time / day pipeline | `sim/clock.ts` | Solid |
| 2 | Boss attributes and rank | `sim/player.ts`, `config/economy.ts` | Partial |
| 3 | Org state — money, respect, fear, heat | `sim/types.ts:60` | Solid |
| 4 | NPCs — generation, drift, perception | `sim/npc.ts`, `config/npcs.ts` | Solid |
| 5 | Memory | `sim/memory.ts` | Solid |
| 6 | NPC-to-NPC ties | `sim/ties.ts` | Solid |
| 7 | Goals | `sim/goals.ts` | Solid |
| 8 | Promises | `sim/promises.ts` | Solid |
| 9 | Standing / shares | `sim/standing.ts` | Solid |
| 10 | Crew management | `sim/crew.ts` | Solid |
| 11 | Delegation | `sim/delegation.ts` | Solid |
| 12 | Succession, deposition, aging | `sim/succession.ts`, `sim/aging.ts` | Solid |
| 13 | Operations | `sim/operations.ts` | Solid |
| 14 | Contraband | `sim/contraband.ts` | Solid |
| 15 | Businesses + pressure dial | `sim/business.ts`, `config/pressure.ts` | Partial / unmeasured |
| 16 | Economy — cash, dirty, holdings, wages | `sim/economy.ts` | Solid |
| 17 | Estate | `sim/estate.ts` | Solid |
| 18 | Market and loans | `sim/market.ts` | Solid |
| 19 | Territory | `sim/territory.ts` | Solid |
| 20 | City perception, city hall, patron | `sim/perception.ts` | Partial |
| 21 | World conditions | `sim/world.ts` | Solid |
| 22 | Heat channels | `sim/heat.ts` | Solid |
| 23 | Investigations, agencies, courts | `sim/investigation.ts` | Solid |
| 24 | Informants | `sim/informants.ts` | Solid |
| 25 | Evidence | `sim/util.ts:25`, `types.ts:513` | Solid |
| 26 | Rival families, capos, leaders | `sim/faction.ts`, `capos.ts`, `leaders.ts` | Partial |
| 27 | Diplomacy, wars, sit-downs | `sim/diplomacy.ts`, `sitdown.ts` | Partial |
| 28 | Rival beliefs / suspicion | `sim/beliefs.ts` | Solid |
| 29 | Whispers | `sim/whispers.ts` | Solid / unmeasured |
| 30 | Civic favour network | `sim/civic.ts` | Solid / unmeasured |
| 31 | Legitimacy and career shapes | `sim/legacy.ts` | Solid / unmeasured |
| 32 | Events | `sim/events.ts` | Partial |
| 33 | Decision trace — the Why panel | `sim/trace.ts` | Solid |
| 34 | UI shell, panels, memos | `src/ui/` | Partial |
| 35 | Audio, skin, motion | `src/ui/audio.ts` etc. | Thin |
| 36 | Save / load | `sim/save.ts` | Partial |
| 37 | Config layer | `src/config/` | Solid |
| 38 | Test and probe harness | `src/sim/__tests__/` | Partial |
| — | **The Boss's personal life** | — | **Absent** |
| — | **Day-part structure (morning/day/evening)** | — | **Absent** |
| — | **Business employees and management** | — | **Absent** |
| — | **Expense categories** | — | **Absent** |

The last four rows are the genuinely missing pieces of the vision. The previous
blueprint did not list them; they came out of this audit. §1.5 covers them.

## 1.3 System by system

### 1. Time — the day pipeline

**Does:** `advanceDay` runs a strictly ordered 15-stage pipeline, and the ordering is
load-bearing and commented at every step: market before anything quoted in money,
operations before everything that reacts to them, loans before wages because lenders are
*"the only creditors in the game who do something about it"*, informants before agencies
because what was said this week is part of what the agencies read.

**Depended on by:** everything. This is the spine.

**Works well:** the ordering rationale is written down, so a new tick has a defensible
place to go. `advanceDays` stops early when a memo lands, which is what makes "+1 week"
safe.

**Preserve:** all of it, including the comments.

**Missing:** the vision's morning / day / evening / night structure. Currently one day
is one atomic step; the player acts, then the whole world resolves at once. See §1.5.

**Trap to record:** ticks gated on `day % INTERVAL !== 0` run **zero times** if a test
helper steps the clock by the interval from a day-1 start. This has been walked into
four times, three of them in a single session. Every new gated tick needs an instrument
test that proves it fired.

### 2. Boss attributes and rank

**Does:** eight attributes — leadership, intimidation, negotiation, intelligence,
streetSmarts, business, strategy, influence — each trained by doing the matching thing,
with per-attribute progress. Seven ranks with five-term requirements (respect, crew,
clean cash, ops, territories), read against the organization's **high-water record**
rather than today's balance, so a rung once earned survives a handover.

**Depended on by:** crew ceiling, operation unlocks, diplomacy gates, contact prices,
sit-down registers, favour access.

**Works well:** attributes are earned by the activity they describe, never bought.

**Redesign:** the vision's list of boss qualities is thirteen items; the code has eight
attributes plus org-level respect, fear and heat. Of the missing ones, **legitimacy now
exists as a derived reading** (`sim/legacy.ts:34`) and should stay derived — it is an
opinion about the world, not a fact in it. **Authority is the real gap**: nothing in the
game measures whether the family still does what it is told. §2 proposes it, and it is
the one new number this document argues for.

**Missing:** lifestyle, public identity, personal needs — all part of the absent
personal-life layer.

### 3. Org state

**Does:** wages owed, cash, dirty cash, holdings, respect, fear, heat plus per-channel
heat, quiet days, lay-low window, and the high-water record.

**Works well:** respect and fear are deliberately separate and earned by different
actions, with a comment explaining that collapsing them makes violence always optimal.
`heatBy` means heat already is not one magic number — it is three channels (street,
money, inside) with different decay and different remedies. The vision's "heat should not be a single number" is
already satisfied; what is missing is that the **player-facing** presentation still
leads with the total.

**Preserve:** the split, the channels, the record.

### 4. NPCs

**Does:** eleven stats (loyalty, greed, ambition, fear, courage, intelligence,
discipline, skill, leadership, respectForBoss, grievance), traits with mechanical
effects, a secret, a goal re-picked weekly, familiarity, a wage, notes, memories, ties,
a fear baseline they settle back toward, skim flags, and a hidden `informingSince`.

Weekly `driftNpcs` re-evaluates everybody. Independent behaviour already implemented:
becoming loyal or resentful, skimming, hiding information, informing, defecting to a
rival, being poached, taking the blame, dying, being arrested, promotion, demotion,
retirement.

**Perception is real fog:** `perceive()` never returns the truth. It returns a band
whose width shrinks with familiarity, derived through `Rng.stableNoise` so reading a
stat does not advance the random stream.

**Depended on by:** operations, crew, delegation, succession, informants, events, ties,
sit-downs.

**Works well:** this is the strongest system in the project and it already satisfies
most of the vision's NPC section. The `fearBase` comment is a model of the house style —
it names the measurement that forced the change (median crew fear 76 by day 91, 90
forever after) and what the fix costs.

**Preserve:** all of it. **Do not** add an "autonomy" layer beside it; extend the drift.

**Missing against the vision:** personal history beyond notes and memories (no
backstory), and opinions of the Boss exist (`respectForBoss`) but no opinion of the
Boss's *decisions* as a category.

### 5–9. Memory, ties, goals, promises, standing

**Do:** `memory.ts` stores dated incidents with decay-weighted recall, and specific
recall drives poaching, informing and claim strength. `ties.ts` holds sparse NPC-to-NPC
edges with three independent dimensions (trust, resentment, debt) and a cause traceable
to an incident. `goals.ts` gives each NPC something they are currently after.
`promises.ts` gives obligations a deadline, and keeping or breaking one writes a memory
rather than moving a stat. `standing.ts` tracks who has been carrying the work.

**Works well:** these five together are the vision's relationship network, already
built, and built the right way round — incidents create edges, edges are not decoration.

**Preserve:** all. The favour network in §1.4 deliberately copies the sparse-edge shape
from `ties.ts` and the obligation lifecycle from `promises.ts`.

### 10–12. Crew, delegation, succession

**Do:** recruit, promote, dismiss, set wages against a ceiling and an expectation.
Stewards run districts and keep the player's name alive in them, with a ledger of what
they have been seen to do. Succession names an heir, computes claim strength, handles
conviction, death and deposition, and lets the family continue with the player as the
successor.

**Works well:** succession is the vision's legacy pillar, already complete, including
`inheritRank` and the record that survives the handover.

**Partial:** the vision asks for retirement as a player choice. `aging.ts` retires NPCs;
the player cannot retire.

### 13–14. Operations and contraband

**Do:** jobs with crew assignment, a success breakdown the player can read before
committing, heat scaling, district and sentiment modifiers. Contraband is two trades
with supply, routes, workshops, stock that physically exists and can be seized.

**Works well:** `successBreakdown` and `sentimentOutlook` show the player the arithmetic
rather than a single percentage.

**Poorly structured:** `config/operations.ts` is 853 lines and `sim/operations.ts` 815.
Not urgent, not blocking anything.

**Redundant:** nothing — but note that operations are the *only* activity with a
reliable payout curve, which is why the middle game becomes a job-clicking loop. That is
F1, and it is a design problem, not a code problem.

### 15. Businesses

**Does:** fronts with revenue, health, exposure, laundering capacity, a district slot
cost, sentiment coupling, and since PR #6 a three-position pressure dial (clean / usual
/ lean) that multiplies laundering, revenue, exposure and wear and gates an inspection
roll.

**Works well:** the dial reuses four existing systems instead of building a second copy
of the economy per front; `normal` is neutral in every term, so old saves play
identically.

**The gap, and it is the biggest one in the economy:** **F15 — the economy is bimodal
and forks on fronts.** At day 300, 25 of 36 careers hold one front and under $48k; 11
hold seven and run from $134k to $2.8M. Front income compounds into holdings; a family
that never gets a second front never starts. Nothing in the pressure dial addresses
this, and the dial is invisible to any career stuck on the wrong side of the fork.

**Missing:** employees, a manager, and the vision's "businesses create situations". A
business currently cannot produce an event.

### 16–18. Economy, estate, market

**Do:** clean cash, dirty cash, protected holdings, an estate reading across wallet,
holdings, fronts and ground; a price cycle, lenders with rates and ceilings, loans that
collect before wages and take a street when they cannot collect money.

**Works well:** the layered money the vision asks for is already here, and the holdings
comment explains why protecting the clean pool outright was the wrong answer — *"money
nobody ever spends is not a decision."*

**Missing:** the vision's expense categories — political spending, personal spending,
family expenses. There is one wage bill, one legal retainer and one loan repayment.
Adding categories is only worth doing if a category changes a decision; see §5.

### 19–21. Territory, city, world

**Do:** districts with character, prosperity, population, per-faction influence,
sentiment, business slots, stewards and a fog flag. City-level notoriety and city-hall
pressure, with a `PATRON` who holds pressure off for 90 days. World conditions with
timed effects.

**Works well:** neighbourhoods already differ, and sentiment is coupled to operations in
both directions.

**Partial:** the city is a set of per-district numbers with no life of its own. There is
no city-level actor — no mayor, no newspaper, no election. `PATRON` is the closest thing
and it is a 90-day purchase, not a relationship.

### 22–25. Heat, investigations, informants, evidence

**Do:** six heat channels with separate decay. Four agencies (city police, state
taskforce, treasury, federal bureau) with different appetites, running cases through
nine stages from suspicion to trial, gathering evidence traces that name people and
incidents, producing surveillance, sweeps, arrests, indictments and pleas. Informants
turn frightened crew into leaks the player can sometimes detect and accuse. Lawyers can
be retained; agency contacts can be bought.

**Works well:** this is the second strongest system in the project and it already
satisfies the vision's law-enforcement section almost completely — agencies do behave
differently, cases do investigate specific people and businesses, and the player
genuinely does not always know.

**Preserve:** all of it.

**Missing:** the vision asks for prosecutors and courts as distinct actors. They exist
as stages, not as people you can have a relationship with. The favour network is where
that would connect.

### 26–28. Rivals, diplomacy, beliefs

**Do:** three rival houses drawn fresh per seed into fixed slots, each with a leader,
capos, wealth, strength, heat, an agenda, a weekly decision turn, bonds carrying trust,
grudge and debt, wars with weariness, sit-downs with registers, and their own fog —
`beliefs.ts` gives rivals mistaken beliefs about the player.

**Works well:** rivals do act without waiting for the player, and `trace.ts` records why
so the Why panel can explain it.

**The gap, and it blocks the whole conquest fantasy: F5.** Rivals at strength 84, 100
and 100 stayed Neutral for 224 days. And **F17**: both diplomatic doors are shut for
every career, all 300 days — *"You lead them by −72 strength and would need 15 — or 55
standing, against 29."* A takeover fantasy built on rivals who never move and cannot be
negotiated with is unopposed by construction.

### 29–31. Whispers, civic favours, legacy

Built in PRs #5 and #6. Covered in §1.4.

### 32. Events

**Does:** 22 authored event definitions with priced options, refusals that name their
own bar, and subject stat readouts on the memo so the player can decide without relying
on memory.

**The gap:** round 14's second MUST FIX — *"the memo pool exhausts, and after Capo it is
the only source of new content. Between day 180 and day 300 the tester met exactly one
memo it had not seen before."* 22 authored events cannot carry a 300-day game.

**Redesign:** the vision's "flexible event architecture generating from simulation
state" is the right answer, and whispers are the first instance of it — generated from
state, so the supply cannot run out. The event system should grow the same generative
half rather than more authored entries. This is the highest-value structural change in
the document after measurement.

### 33–35. Trace, UI, presentation

**Trace:** records rival decisions with their inputs so the Why panel can explain them.
An observational system that must never change outcomes — the rule whispers had to be
rewritten to obey.

**UI:** a rail of 17 panels, a bulletin that summarises a skipped week, memos as modals,
a stat bar. **Partial:** 17 panels is a lot of surface, and the vision's complaint about
"a spreadsheet manager" is mostly about this. The panels are honest and dense; they are
not a desk.

**Audio / skin / motion:** 386 lines total. Cues, a skin, a few transitions. **Thin**,
deliberately, and nothing here is blocking.

### 36. Save / load

**Does:** three slots plus autosave, a version gate at `SAVE_VERSION = 13`, and a shape
check.

**Partial, and this is a real constraint:** there is **no migration framework**. Any
save whose version differs is rejected outright. Every new state field must therefore be
optional with a lazy initialiser, and must **not** be added to `validate()`. Nine
existing optional fields follow this idiom. Everything proposed below obeys it.

### 37. Config

**Does:** 32 files, every balance number with a comment explaining what measurement set
it. Config must not import sim.

**Preserve, strictly.** This is why the game is tunable at all.

### 38. Tests and probes

**Does:** 60 test files, 687 tests, one failing on purpose — a pre-committed pacing
target in `ladder.probe.test.ts` that the rank table does not meet. It must not be
weakened.

**The gap: F7.** Every probe plays the same narrow game. No bot lays low, buys a
contact, retains counsel, uses a favour, reads a whisper, or turns a pressure dial. Five
systems shipped in this cycle are invisible to all of them.

**F6:** the Pacing axis measures the probe, not the game.

## 1.4 What the five shipped systems actually do

So nothing below re-proposes them.

**Influence supply** (`config/economy.ts`) — the counsel rate went from 0.12 to 2.4 per
week, the skipped-retainer bug was fixed, and the diplomatic approach credit was
rate-limited to once per 14 days per faction. `org.influence`, a displayed stat nothing
could change, was deleted. This unblocked the political vertical, which was walled.

**Civic favour network** (`sim/civic.ts`, `config/civic.ts`) — four figures (police
captain, union boss, judge, alderman). Each watches a quantity the game already keeps —
how quiet you are, how much ground you hold, your standing, your discretion — and their
regard accrues from how you run the family rather than from a purchase. Above a
threshold they owe you, and a favour can be spent on burying a case, quieting a street,
opening a door, or losing paperwork. Refusals name their own bar.

**Whispers** (`sim/whispers.ts`) — five kinds of claim, generated from state on a weekly
roll, each with a confidence band and a source. **Some are false, and nothing ever tells
the player which.** Corroboration hardens a claim, which makes waiting a strategy. The
stored record knows the truth; the read deliberately does not expose it, and the test
asserts that by shape so a field added later would fail.

**Legitimacy and career shapes** (`sim/legacy.ts`) — legitimacy is a derived 0–100
reading over four terms: visible holdings, police quiet, staying out of the papers, and
whether the money can be explained. Eight career shapes are read off the record at the
end, weighted so the loudest verdict wins ties, with `unremarkable` at weight 0 as the
floor that stops the system being a horoscope.

**Pressure dial** (`config/pressure.ts`) — covered in §1.3.15.

## 1.5 What is genuinely absent

After the five above, four things in the vision have no code at all.

**1. The Boss's personal life.** A search for wife, spouse, daughter, marriage, dinner,
home, or personal life returns **zero hits across the entire source tree**. There is no
home, no family, no social life, no lifestyle, no public appearances. This is the single
largest untouched pillar in the vision and the one most responsible for the game reading
as a management spreadsheet rather than a person's life.

**2. Day-part structure.** One day is one atomic step. There is no morning briefing / day
/ evening / night rhythm. The bulletin is close to a briefing but it fires on skipped
time, not every morning.

**3. Business employees and management.** A business is six numbers and a dial. Nobody
works there, nobody manages it, and it cannot produce an event about itself.

**4. Expense categories.** One wage bill, one retainer, one repayment. No political,
personal or family spending.

---

# PHASE 2 — THE IDENTITY

Ten pillars, each mapped to what already carries it and what is needed.

| Pillar | Carried by | Needed |
|---|---|---|
| The Boss | 8 attributes, rank, respect, fear | **Authority** — the one new number |
| The Family | roles, drift, ties, memories, promises, delegation | Authority coupling |
| The Empire | fronts, pressure dial, contraband, holdings | Fix F15; make a front able to speak |
| The Network | civic favours, agency contacts, `PATRON` | Measure it; connect it to courts |
| The Underworld | 3 houses, capos, leaders, bonds, wars, sit-downs | Fix F5 and F17 |
| Law enforcement | 4 agencies, 9 stages, evidence, informants | Nothing structural |
| The City | districts, sentiment, notoriety, city hall, conditions | A city-level actor |
| The Simulation | 15-stage day pipeline | Nothing |
| Personal life | — | **Everything** |
| Legacy | succession, heirs, career shapes, post-mortem | Player-chosen retirement |

## 2.1 Authority — the one new attribute this document argues for

The vision asks for authority, and it is the only missing quality that is not either
already present under another name or a presentation problem.

**What it is:** whether the family still does what it is told. Not whether they like you
(respect), not whether they are afraid of you (fear) — whether an instruction survives
contact with the man receiving it.

**Why it is worth a new number when nothing else is:** it is the only quantity that
makes the vision's stated interactions true. *"High fear increases obedience but
decreases loyalty"* is currently unrepresentable, because there is nothing obedience is
a number of. *"Low authority causes capos to become increasingly independent"* has no
term on either side.

**Derived, not stored.** Like `estate` and `legitimacy`, and for the same reason: it is
an opinion about the world, so a stored copy is a second thing to keep true. Read from
quantities that already exist:

    respectForBoss across the crew   — do they rate you
    org.fear                         — are they afraid to test it
    grievance and unpaid wages       — do they have a reason to
    steward ledgers                  — do the men holding ground do as told
    promises kept vs broken          — is your word worth anything

**What it changes:** stewards skim more or less; delegated districts drift; a capo's
claim strength rises; sit-down registers open or close. Every one of those consumers
already exists and already reads *something* — authority replaces an ad-hoc term in each,
so this is a rewiring, not a new subsystem.

**The risk, named up front:** an eleventh number that changes nothing the player can see
is exactly the "meaningless statistic" the brief prohibits. The test for shipping it is
behavioural — a low-authority family must visibly stop obeying — not that the number
exists on a panel.

---

# PHASE 3 — ARCHITECTURE

Each proposal in the required form. **Nothing here is a rewrite of a working system.**

## 3.1 Events → generative events

    CURRENT   22 authored EventDefs in a 2,456-line file. The pool exhausts.
    NEW       Keep all 22. Add a generative half: composers that read state and
              build an event, the way whispers already build a claim.
    WHY       Round 14 MUST FIX 2 — one new memo between day 180 and day 300.
              This is the direct cause of the middle-game deadness (F1).
    DEPENDS   NPCs, ties, businesses, civic, whispers. All exist.
    PRIORITY  1 after measurement.

The shape is already proven in `whispers.ts`: a `feed()` that gathers subjects from
state, a `compose()` that turns one into text. An event needs the same plus options and
effects. The authored events stay as the high-quality set; the generative ones fill the
180-to-300-day hole.

## 3.2 The front fork (F15)

    CURRENT   Front income compounds into holdings. 25 of 36 careers never get a
              second front; 11 get seven and run away.
    NEW       A financing route to the second front that does not require having
              already won. Existing candidates: lenders (`market.ts`) already
              price risk; a civic favour could open a licence.
    WHY       F15. The money rung of the ladder sits downstream of this, and so
              does every system that costs money — including the favour network.
    DEPENDS   business.ts, market.ts, civic.ts.
    PRIORITY  2.

## 3.3 Rivals that move (F5) and doors that open (F17)

    CURRENT   Rivals at strength 84/100/100 stayed Neutral 224 days. Both
              diplomatic routes are shut for every career, all 300 days.
    NEW       Rebalance the decision thresholds in faction.ts and the gates in
              diplomacy.ts. No new machinery.
    WHY       Every conquest or negotiation fantasy is unopposed by construction
              until this moves. F17 is F5 wearing another hat.
    DEPENDS   faction.ts, diplomacy.ts, capos.ts.
    PRIORITY  3.

## 3.4 Authority

    CURRENT   Nothing measures obedience.
    NEW       Derived reading in a new sim/authority.ts, consumed by delegation,
              capos, sitdown.
    WHY       Makes the vision's stated attribute interactions expressible.
    DEPENDS   npc.ts, promises.ts, delegation.ts, economy.ts.
    PRIORITY  4.

## 3.5 The Boss's personal life

    CURRENT   Absent. Zero references in 57,833 lines.
    NEW       The smallest version that is not decoration: a home district, a
              small number of people who are yours rather than the family's, and
              a standing tension between time spent on them and time spent on the
              business. Their state feeds existing systems — a boss with nothing
              outside the work is easier to depose, and a family that has met your
              people is harder to turn.
    WHY       The largest untouched pillar, and the main reason the game reads as
              a spreadsheet.
    DEPENDS   NPCs (reuse the Npc type, do not invent a second person type),
              events, the day pipeline.
    RISK      Highest in the document. This is the one item with no measurement
              behind it — no round has ever asked for it. It is proposed because
              the brief asks for it, not because the record demands it.
    PRIORITY  5.

## 3.6 Day parts

    CURRENT   One atomic day.
    NEW       Morning briefing (the bulletin, promoted to fire every day), a day
              phase (what the player already does), an evening slot for the
              personal and social material, then the night tick as it is now.
    WHY       Pacing and the vision's daily loop. It gives the personal-life
              layer somewhere to live and costs no simulation change — the
              pipeline stays exactly as it is, and the UI gains a rhythm.
    DEPENDS   3.5. Do not build this first; an evening with nothing in it is worse
              than no evening.
    PRIORITY  6.

## 3.7 Explicitly rejected

- **A second person type for civic figures or family.** `Npc` already carries
  everything needed. A parallel type is the duplicate-system failure the brief bans.
- **City hall as a faction.** `FactionId` is a closed four-member union that doubles as
  a save-format slot key. Not extensible.
- **Bumping `SAVE_VERSION`.** No migration framework exists; a bump invalidates every
  save. All new state is optional.
- **A stored authority or legitimacy stat.** Derived, per §2.1.
- **More authored events.** Treats the symptom of 3.1, not the cause.
- **Business employees as full NPCs.** Reuse the front's health and the district's
  sentiment; a fourth roster is not worth its weight.

---

# PHASE 4 — DEPENDENCY GRAPH

Derived from the actual call order in `sim/clock.ts`, not invented.

```
                        RNG ── seeded, deterministic, save-critical
                         │
                      CONFIG ── 32 files, imports no sim
                         │
      ┌──────────────────┴──────────────────┐
      │                                     │
    NPCs ── memory, ties, goals,          TERRITORY ── prosperity, people,
            promises, standing                        sentiment, influence
      │                                     │
      ├── crew ── delegation ── succession  ├── businesses ── pressure
      │                                     │       │
      └───────────────┬─────────────────────┘       │
                      │                             │
                  OPERATIONS ── contraband ─────────┤
                      │                             │
                   ECONOMY ── estate, market, loans ┘
                      │
                    HEAT ── three channels
                      │
      ┌───────────────┼────────────────┬──────────────┐
      │               │                │              │
  INVESTIGATION   INFORMANTS       FACTIONS        CIVIC
  agencies,       leaks, the       capos,          four figures
  9 stages,       hidden flag      leaders,        favours owed
  evidence                         bonds, wars
      │               │                │              │
      └───────────────┴────────┬───────┴──────────────┘
                               │
              PERCEPTION ── city notoriety, city hall
                               │
                     ┌─────────┴─────────┐
                 WHISPERS             BELIEFS
                 (player fog)         (rival fog)
                     │                   │
                     └─────────┬─────────┘
                               │
                            EVENTS ── the only system that asks the player
                               │
                     ┌─────────┴─────────┐
                  PLAYER              LEGACY
                  rank, record        legitimacy, shapes
                               │
                        PLAYER EXPERIENCE
```

**The true foundations, in order:** RNG, config, NPCs, territory. Everything else is
downstream of those four.

**Reading the graph for the roadmap:**

- Whispers and legacy are **leaves**. They read the whole world and write almost
  nothing. Cheap to add, cheap to change, and they cannot break anything upstream —
  which is why they were safe to build first.
- Civic sits **beside** the agencies rather than under them, deliberately: it reads
  state and writes only its own roster.
- **Events are the only system in the graph with an arrow into the player.** That is why
  an exhausted event pool reads as a dead game even while forty systems are running
  correctly underneath. It is the single highest-leverage node.
- The personal-life layer would attach under NPCs and feed events — not a new trunk.

---

# PHASE 5 — ROADMAP

Ordered by evidence. Every task carries the seven required fields.

## Task 0 — Measure what already shipped

- **Purpose:** five systems have shipped with zero measurement. Until a round sees them,
  every ranking below is a guess.
- **Dependencies:** none. This is the precondition for everything else.
- **Files:** `scripts/playtest-run.mjs`, `src/sim/__tests__/ladder.probe.test.ts`,
  `PLAYTEST.md` brief.
- **Difficulty:** low. **Risk:** low — no source change.
- **Impact:** decides the order of tasks 1 to 6. May invalidate several.
- **Testing:** blind round 15 plus probe bots that actually spend a favour, read a
  whisper and turn a pressure dial (closes F7 for the new systems). **Do not tell the
  tester which features to use.**

## Task 1 — Generative events

- **Purpose:** close round 14's MUST FIX 2 and the middle-game hole (F1).
- **Dependencies:** Task 0. Reuses the `feed`/`compose` shape from `whispers.ts`.
- **Files:** new `src/sim/eventgen.ts` and `src/config/eventgen.ts`;
  `sim/events.ts` for the hook; `sim/clock.ts` unchanged.
- **Difficulty:** high — this is the largest item.
- **Risk:** medium-high. Generated text can be flat, and the game's voice is
  load-bearing. `voice.test.ts` has already caught two lapses this cycle.
- **Impact:** the largest available. Events are the only node with an arrow into the
  player.
- **Testing:** supply test (new content across 300 days), voice test, refusal test, and
  a blind round that reports whether day 180–300 has new material.

## Task 2 — The front fork (F15)

- **Purpose:** 25 of 36 careers never reach the compounding half of the economy.
- **Dependencies:** Task 0.
- **Files:** `sim/business.ts`, `config/businesses.ts`, `sim/market.ts`, possibly
  `sim/civic.ts`.
- **Difficulty:** medium. **Risk:** high — this is the economy's main curve, and a
  balance change here moves everything downstream. Population measurement over 36
  careers, never a single run.
- **Impact:** high. Unblocks the money rung and everything priced in money.
- **Testing:** `ladder.probe` distribution before and after; the fork must narrow
  without the top of the distribution running further away.

## Task 3 — Rivals that move (F5, F17)

- **Purpose:** rivals stayed Neutral 224 days; both diplomatic doors are shut for every
  career.
- **Dependencies:** Task 0.
- **Files:** `config/factions.ts`, `sim/faction.ts`, `config/diplomacy.ts`,
  `sim/diplomacy.ts`.
- **Difficulty:** medium. **Risk:** medium — an over-correction turns a quiet game into
  an unsurvivable one.
- **Impact:** high. Every conquest and negotiation system is inert until this moves.
- **Testing:** a probe counting rival actions and open diplomatic options per career;
  the pre-committed condition is that at least one door is reachable by day 300.

## Task 4 — Authority

- **Purpose:** make the vision's attribute interactions expressible.
- **Dependencies:** Task 0; benefits from Task 1 (events are where it would be felt).
- **Files:** new `sim/authority.ts`, `config/authority.ts`; consumers in
  `delegation.ts`, `capos.ts`, `sitdown.ts`, `PlayerPanel.tsx`.
- **Difficulty:** medium. **Risk:** medium — the failure mode is an eleventh number
  nobody feels.
- **Impact:** medium. Makes fear a real trade rather than a strictly better respect.
- **Testing:** behavioural — a low-authority family must measurably stop obeying
  (steward skim rate, capo claim strength). A test that only reads the number back is
  the failure mode this project has recorded 25 times.

## Task 5 — The Boss's personal life

- **Purpose:** the largest untouched pillar of the vision.
- **Dependencies:** Tasks 0 and 1. Without generative events it has nowhere to surface.
- **Files:** new `sim/personal.ts`, `config/personal.ts`; `types.ts` (optional field);
  `clock.ts`; a new panel.
- **Difficulty:** high. **Risk:** highest in the document — **no measurement supports
  it.** No round has ever asked for it. It is here because the brief asks for it.
- **Impact:** unknown, and that is the honest answer. Potentially the biggest change to
  how the game feels; potentially a panel nobody opens.
- **Testing:** a blind round is the only instrument that can judge this. Ship it behind
  the round rather than ahead of it.

## Task 6 — Day parts

- **Purpose:** the vision's daily rhythm.
- **Dependencies:** Task 5. An evening with nothing in it is worse than no evening.
- **Files:** `ui/App.tsx`, `ui/Bulletin.tsx`, `ui/Rail.tsx`. **No simulation change.**
- **Difficulty:** medium. **Risk:** low — presentation only, revertible.
- **Impact:** medium, on pacing.
- **Testing:** blind round pacing axis.

## Not scheduled

Business employees, expense categories, a city-level actor, player-chosen retirement.
All are real gaps. None has evidence behind it, and the brief's own rule — *do not add
features because they sound cool* — applies to this document as much as to the code.

---

# CONSTRAINTS EVERY TASK MUST SATISFY

From `HANDOFF.md` §2, unchanged:

- No jsdom. No `@types/node`. Tests are pure sim.
- Config must not import sim.
- New state fields are optional. **Never bump `SAVE_VERSION`.** Never add to
  `validate()`.
- Determinism. Any change reshuffles every later `rng` call — measure over a population,
  never a single run.
- Ring buffers wrap. Read them by day, never by `slice(previousLength)`.
- The `config/contraband.ts` header stands.
- Never playtest against the developer's saves.
- Never tell a blind tester mid-round to use a specific feature.
- **Never adjust a probe threshold to make it pass.** The pacing pre-commit in
  `ladder.probe.test.ts` stays failing.
- Write the test first. Watch it fail for the expected reason. Then implement.
- The game's voice is load-bearing. Do not sand it off.

---

# WHAT THIS DOCUMENT DOES NOT CLAIM

It does not claim the five shipped systems improved the game. They are untested by any
instrument that measures fun, and Task 0 exists because of that.

It does not claim the personal-life layer will work. It is the one proposal in here with
no evidence behind it, and it is labelled as such rather than ranked as though it had
some.

It does not claim the audit is exhaustive at the line level. Every status above was
checked against the source in this pass, but 57,833 lines contain more than any one
reading finds.
