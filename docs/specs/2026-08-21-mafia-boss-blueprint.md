# The Mafia Boss blueprint

**Status: proposal. No code changes accompany this document.**

A restructure of Frontline around a single fantasy: you are the boss of a criminal
family, you give orders you cannot personally execute, and the simulation answers.

This document exists to be argued with. It is organised so that every proposal
carries the evidence for it, and every claim about the current code carries the
file that makes it true.

---

## 0. The two things that shape everything below

### Most of this is already built

The vision behind this document names roughly twelve subsystems. Nine of them
exist. Not as sketches — as tested, shipped systems with their own config files
and their own design comments explaining why each number is what it is.

A blueprint that re-proposed them would send us rebuilding working code. So the
inventory in §2 comes before the proposals in §3, and every section says plainly
whether the thing already exists.

### The reframe costs the best-measured part of the game

The vision opens by saying the player should not climb to become a boss — they
should already be one.

Against that, four blind rounds:

    axis           r11   r12   r13   r14
    First hour       8     8     8     9
    ...
    Fun              6     6     6     5

**First hour is the strongest and most stable axis in the project's record.** It
is the broke opening. Round 14, unprompted:

> The first sixty days were gripping. The last hundred and eighty were grinding a
> position I could not win, with the same four jobs, and roughly thirty seconds of
> real time per in-game week.

And on what they would have lost if it had all gone:

> That is a damning answer and I want to be precise about why it is damning: **it
> was not always true.** Around day 60 I would have said I had a working
> organization. What I would have lost then was real.

The boss fantasy is not missing from the start of the game. It is missing from the
middle. F1 has been reporting this since round 7 as "decisions stop changing around
day 90–119", and this document treats **day 60 to day 300 as the target**, not day
one.

That is the same fantasy. It arrives when the player has something to lose, which
is the only condition under which any of it means anything.

---

## 1. What the game is measured to be, right now

Everything in this section is a measurement, not an opinion. It is here because
the proposals in §3 are ranked against it.

**The ladder.** 36 careers, 300 days each — the span a person actually plays:

    Street Criminal  36/36 day 0     Capo         11/36 day 86
    Enforcer         34/36 day 21    Underboss     9/36 day 211
    Crew Leader      29/36 day 60    Boss          7/36 day 260
                                     Crime Lord    0/36 never

**The economy is bimodal and forks on fronts.** Estate at day 300, sorted:

    8,677 … 47,667                   25 careers, median 1 front
    ─────────────────────────────
    133,975 … 2,827,037              11 careers, median 7 fronts

Front income is paid into holdings ([`business.ts:579`](../../../src/sim/business.ts)),
which compound. A family that never gets a second front never starts. This is F15.

**What actually blocks a career**: `furthest requirement at the end: clean money
34, respect 2`, with `careers that ended before day 300: 0/36`. It is not
attrition. It is money, and money is downstream of fronts.

---

## 2. Layer-by-layer inventory

Every layer gets four lines: what state it is in, what is actually there, what the
vision asks for that is missing, and what evidence supports closing that gap.

**A gap with no evidence is allowed to appear here. It is not allowed to be
ranked in §4.**

### Boss

**Status: EXISTS. One field of it was broken; that half is now fixed — see the
note under The defect.**

Eight attributes at [`types.ts:33`](../../../src/sim/types.ts) — leadership,
intimidation, negotiation, intelligence, streetSmarts, business, strategy,
influence — with labels, blurbs, a ceiling of 20 and a progress curve of
`3 + current * 1.6` ([`economy.ts:457`](../../../src/config/economy.ts)). Org-level
respect, fear, heat and `heatBy` per channel. Presented on `PlayerPanel.tsx` in
four blocks and on the always-visible `StatBar.tsx`.

The vision's list maps almost cleanly onto this: Authority ≈ leadership, Diplomacy
≈ negotiation, Street Intelligence ≈ streetSmarts. Respect, Fear and Heat already
exist at org level. **Legitimacy is the only genuinely new one.**

**The defect.** `state.org.influence` and `state.player.attributes.influence` are
two different fields with the same label on the same screen.

- `org.influence` is initialised from `STARTING_INFLUENCE`, which is `0`
  ([`economy.ts:80`](../../../src/config/economy.ts)), at
  [`state.ts:261`](../../../src/sim/state.ts) and **is never assigned anywhere
  else in the codebase**. Its only appearance is `PlayerPanel.tsx:151`, which
  renders it as "Influence" on the Standing block. *(An earlier draft of this
  document cited `state.ts:205` — that line is the player-attribute
  initialiser, not the org's. The claim is unchanged; the citation was wrong.)*
- `player.attributes.influence` is what every gate reads —
  `investigation.ts:1080` and `:1090`, `perception.ts:237` and `:264`.

So the number the player is shown under "Influence" on their own boss screen is a
constant zero that nothing can move, sitting a few rows above a *different*
Influence in the attributes block that governs the entire political vertical.

Round 13: *"a whole vertical of the game was invisible to me for 300 days because
of one attribute I had no idea how to train."*

**Fixed after this document was first written.** `org.influence` is deleted along
with `STARTING_INFLUENCE`, the Standing row is removed, and the attribute below it
already carries the progress bar that says how to move it.
`src/sim/__tests__/deadState.test.ts` now fails if any field on `Org` is declared
and never assigned. Only the *supply* half of item 1 remains.

### Family

**Status: EXISTS.**

The hierarchy the vision draws is `ROLE_ORDER` in
[`economy.ts`](../../../src/config/economy.ts) — associate, soldier, enforcer,
lieutenant, capo, consigliere, underboss — with each rank's `maxRole` capping who
you may appoint. Capos hold districts through
[`delegation.ts`](../../../src/sim/delegation.ts). Every person carries loyalty,
greed, ambition, courage, discipline, skill, grievance and respectForBoss
([`types.ts:168`](../../../src/sim/types.ts)), a secret
([`npcs.ts:224`](../../../src/config/npcs.ts)) and a personal goal
([`goals.ts`](../../../src/config/goals.ts)) that is hidden until you know them.

**"You give orders, your capos interpret them" already happens.** So does "a capo
might skim" and "a soldier might become too ambitious" — those are the
`skim_discovered` and `promotion_demand` memos.

**Gap: none worth building.** This layer is the most complete in the game.

### NPC relationships

**Status: EXISTS.**

[`ties.ts`](../../../src/config/ties.ts) — sparse edges, not an all-pairs matrix.
Each edge carries `trust`, `resentment`, `debt`, a `TieCause` and a `since` day,
capped at `MAX_TIES = 8` per person, decayed weekly and forgotten below a
threshold. The causes are `worked_together`, `passed_over`, `dispute`,
`took_the_blame`, `owes_money`, `lost_the_room`, `saved_him`.

The design note is worth quoting because it is exactly the vision's ask:

> The story the design document asks for — A wants a promotion, B blocks him, A
> resents B, a rival offers A protection, A defects and takes a district with him —
> was not representable before this file existed.

**Gap: the player has no node.** `recordTie` takes two `Npc` objects and every
reader resolves `state.npcs[tie.id]`. The player is a separate `Player` type. So
a tie cannot run between the player and anybody. This matters for §3.1.

### Obligations

**Status: EXISTS, in one direction only.**

[`promises.ts`](../../../src/sim/promises.ts) — you tell somebody "you have the
next one" or "you are covered", it gets a deadline, and it is kept by doing the
thing you would have done if you meant it. Breaking one writes a *memory*, not a
stat, so it feeds the informant gate through the same channel a missed payday
does.

**Gap: nothing is ever owed *to* the player.** That is the favour network, §3.1.

### Businesses

**Status: PARTIAL.**

[`business.ts`](../../../src/sim/business.ts) — fronts have health, laundering
capacity, an acquisition price indexed to the year and the district's wealth, and
a coupling to public feeling that gates whether anybody will sell to you at all.
They wear down from a hostile neighbourhood, from being leaned on as a laundry,
from rivals and from city mood.

**Gap:** the vision's operational texture — health inspections, employee
informants, union relationships, "how dirty do I want this business". None of it
exists.

**Evidence: weak.** No round has asked for it. Round 14 owned two fronts and
never mentioned wanting more depth in them; they wanted *more of them*, which is
F15.

### Economy

**Status: EXISTS.**

Clean cash, dirty cash, holdings that compound at 0.45%/week, an estate that
values wallet + holdings + fronts + ground, loans with an all-or-nothing
repayment rule, and an inflation index. That is seven of the vision's eight
money layers.

**Gap:** "family expenses" — lifestyle spending — has no representation.

**Evidence: none.** No round has asked for it.

### City and Politics

**Status: PARTIAL, and this is where the work is.**

[`perception.ts`](../../../src/sim/perception.ts) is the city-as-audience system:
mood, notoriety, political pressure, and a newspaper that writes about you with a
prominence score. Round 14 on seeing their own collapse in print:

> Seeing my own collapse written up by somebody else, with a prominence score, did
> more for the fiction than any status bar.

`PATRON` at [`perception.ts:213`](../../../src/config/perception.ts) — $120,000,
Influence 9, 90 days, holds political pressure to 45% of where it would be, 2%
chance a week of becoming a story.

**Gap: there are no people.** No mayor, no judge, no union boss, no police
captain as a named figure you have a relationship with. `PATRON` is an anonymous
90-day timer.

### Law enforcement

**Status: EXISTS.**

Four agencies with escalating reach, cases with stages and an evidence ledger,
counsel at four tiers, indictment, conviction, and an informant system where you
work out who is talking from what the other side turns out to know.

Round 14 called the indictment memo *"the best-written failure state I have read
in a management game"*, and named the case-reconstruction table — a list of dated
nights with the crew who were on each — as one of the best panels in the game.

### Rivals

**Status: EXISTS mechanically, INERT in play.**

Three families with wealth, strength, an agenda set by a named leader, bonds
carrying grudge/respect/trust/warSince, and a belief system in which they
attribute incidents to whoever they find plausible — **and can be wrong about it**,
with a confidence that decays and hardens on corroboration.

The Why panel records every decision with the options it beat and the score of
each. Round 14 found it on day 286 and the detail they liked most:

> Their scoring lines read "WEALTH UNKNOWN, STRENGTH UNKNOWN, HEAT UNKNOWN" about
> *me* — the AI is playing with fog of war too.

**Gap: F5. They do not act.** Round 13: three houses at strength 84, 100 and 100
against a player at ~20 stayed Neutral for 224 days. Round 14 the same.

**This is a precondition, not a feature.** Any conquest or territorial layer
built on top of rivals in this state is unopposed by construction.

### Intelligence

**Status: PARTIAL — the substrate exists, the surface does not.**

The fog is thorough. `perceive()` in [`npc.ts:179`](../../../src/sim/npc.ts)
returns a *phrase*, never a number, blurred by a deterministic noise term keyed to
how well you know the person. At 34% known a man reads "very good"; at 100% the
same man reads "learning" — nothing changed except that you stopped flattering
yourself. Round 14 called this the second-best thing in the game:

> I cannot think of another management game that has made me feel actively lied to
> by my own roster in a way I earned.

And a numeric confidence already exists, on the rivals' side:
`Suspicion.confidence` in [`beliefs.ts`](../../../src/sim/beliefs.ts), drawn from
one range when they saw it and a lower range when they are guessing, hardened by
corroboration, decayed weekly, expiring below 0.05.

**Gap: no claim is ever presented to the player with a stated confidence.**
Everything is banded into a phrase — "They are certain", "They have a theory". The
vision's Whispers, with a percentage and a named source, is the one presentation
in the game that would show a number where the game currently shows a word.

### Events

**Status: EXISTS, and is exhausted.**

Memos with weights, cooldowns, applicability predicates and consequence branches.

**Gap — round 14 MUST FIX:**

> The memo pool exhausts, and after Capo it is the only source of new content. One
> memo fired six times with identical text and options; between day 180 and day 300
> the tester met exactly one memo it had not seen before.

### Legacy

**Status: EXISTS.**

[`succession.ts`](../../../src/sim/succession.ts) — heirs, claim strength,
contested handovers, what a successor keeps of the money and the standing, and
what the agencies keep of their file on the man who is gone.

**Gap: the game has one ending.** You die or you are convicted. The vision's
Kingpin / Ghost / Legitimate Boss / Tragic Boss do not exist as outcomes the game
recognises or names.

---

## 3. The five things that are genuinely absent

### 3.1 The favour network — and it is not a new system

**It exists twice already, as two one-off special cases.**

`PATRON` is a mayor node with the relationship removed: a man in the building,
priced, Influence-gated, timed, who holds off a specific consequence and can be
exposed as a story.

The four agency contacts
([`lawEnforcement.ts:165`](../../../src/config/lawEnforcement.ts)) are named
institutions, priced 30k / 85k / 110k / 150k, gated at Influence 0 / 5 / 7 / 11,
carrying weekly upkeep, a 1.2%/week exposure chance, an evidence multiplier of
0.78, and sight into a case file.

Everything the vision asks for — a named figure, a relationship, a thing they can
do for you, a way it can go wrong — is present. **What is missing is that each is
one boolean instead of a stock of favours, and that all five are law or city
hall.** There is no judge, no union boss, no newspaper editor.

**What it should reuse.** The sparse-edge shape from `ties.ts` — a few dimensions,
a cause, a `since` day, weekly decay, forgotten below a threshold. The obligation
lifecycle from `promises.ts` — a deadline, a way of being kept, and a consequence
written as a memory rather than a stat.

**What it must not do.** It must not thread through `Tie` (NPC↔NPC by
construction, every consumer resolves `state.npcs`) and it must not become a
faction — `FactionId` is a closed four-member union that doubles as a save-format
slot key, and a judge has no capos, strength, wealth or weekly AI turn.

**Evidence: the strongest in this document.** Round 14, on what they most wanted
and never touched:

> **People on the inside.** $30,240 for City Police, and two memos offered cheaper
> back doors at $15,281 and $62,107. Never affordable at the moment of asking.
> **This is the system I most wanted and it is priced for a run that has already
> succeeded.**

### 3.2 Whispers

Intelligence as confidence-rated claims from named sources, replacing a screen of
statistics with a feed of things somebody told you.

**Substrate exists** (§2, Intelligence): a persisted numeric confidence, a
corroboration-and-decay tick, and a band-to-phrase read gated on an intel score.

**Risk to state plainly:** this is a content pipeline. Without new *sources* of
claims it becomes eight memo shapes wearing a hat, which is round 14's MUST FIX 2
with extra steps.

### 3.3 Legitimacy

The one attribute on the vision's list with no equivalent. It would be the axis
the "Legitimate Boss" ending is measured on, and the thing per-business decisions
trade against.

**Evidence: none yet.** No round has asked for it. It is here because it is cheap
and because §3.4 needs an axis to measure.

### 3.4 Win conditions

Kingpin, Legitimate Boss, Street King, Diplomat, Financial Boss, Old-School Don,
Ghost, Tragic Boss.

**Evidence: strong, and it is Fun 5.** Round 14 finished at day 300 having met
four of five Capo conditions and stopped because the brief said to, not because
anything concluded. The game has a ladder and no destination.

The cheap version is not eight endings. It is **naming the shape a career took**,
using numbers the game already has: districts held, estate composition, Influence,
respect versus fear, whether you were ever named in the papers. A career that ends
with seven fronts and no violence is a different story from one that ends at heat
99 with two men left, and the game currently tells both of them the same way.

### 3.5 Business texture

Inspections, employee informants, union relationships, the clean-or-dirty dial.

**Evidence: none.** Largest surface in this document, least support. Ranked last
deliberately.

---

## 4. The precondition that outranks all of it

**Influence has no supply, and a favour network gated on Influence inherits the
same wall and fails the same way.**

It is spent or gated in six places and earned in four:

    counsel on retainer      0.12 per week, scaled by the firm's tier
    a diplomatic approach    0.6, made or refused
    two one-off memo choices 1.5 and 2.0

Against a cost curve of `3 + current * 1.6`. Reaching Influence 9 — the patron's
bar — costs 80 points of progress. At 0.12 a week that is thirteen years.

[`economy.ts:420`](../../../src/config/economy.ts) already documents that this
attribute used to be circular, earnable only by buying the contacts that required
it, and that two earn sites were added to unwall it. **They did not unwall it.**
Four blind rounds have never seen a player exceed Influence 2. Round 14 finished
at 0 after 300 days while deliberately keeping counsel on retainer.

And the tester's $30,240 police contact was never a pricing bug.
[`investigation.ts:1080`](../../../src/sim/investigation.ts) discounts the price by
`influence * 0.02` up to 30%. They were at zero, so they paid full. **The price is
correct and the supply is broken.**

---

## 5. Build order

Ranked by the evidence in §1 and §2, not by the order this document presents them.

| # | What | Closes | Size | State |
|---|---|---|---|---|
| 1 | ~~Influence supply~~ | F2 | Small | **DONE** |
| 2 | **F17 — open a diplomatic door** | F17, and it runs through F5 | Medium | **new, and now first** |
| 3 | **Generalise `PATRON` + contacts into a favour network** | Round 14's most-wanted system | Medium | blocked on 2 |
| 4 | **F15 — the front fork** | 25 of 36 careers never compound | Medium | |
| 5 | **Whispers** | MUST FIX 2, the memo pool exhausting | Large | |
| 6 | **Win conditions** | Fun 5, a ladder with no destination | Small | |
| 7 | **Boss profile + Legitimacy** | Presentation | Small | |
| 8 | **Business texture** | Nothing measured | Large | |

### Item 1 is done, and it changed the order

`org.influence` is deleted, the skipped retainer and the uncapped approach are
fixed, and `counselPerWeek` went 0.12 → 2.4 against a pre-committed target. The
median career now ends its 300 days on Influence 5 rather than 0, which opens a
task-force contact.

**But the instrument built to measure it produced F17, and F17 goes in front of
the favour network.**

The probe's bot now approaches a family every week — the first instrument in this
project ever to do so. **Every approach is refused, all 300 days, in the same
sentence:** *"you lead them by -72 strength and would need 15 — or 55 standing
with them, against 29."* The paid courtesy wants $25,000 spare in an economy
money-blocked in 97% of its idle weeks.

Both diplomatic doors are shut, always. So `counselPerWeek` is carrying a vertical
it should be sharing, and the consequence is backwards: **a boss who is never
investigated keeps no lawyer and earns no political pull at all.**

**That is why item 2 changed.** A favour network is a system of relationships with
people outside the family, and this game currently has no working way to build one
— the only route it has is refused every time it is tried. Building the network
first would produce exactly what item 1 was moved ahead of it to prevent: a system
nobody can reach.

And F17 is F5 wearing another hat. The player runs 40 to 80 strength behind every
rival for the whole game, which is the same inertness round 13 measured as three
houses at 84, 100 and 100 sitting Neutral for 224 days.

---

## 6. Constraints any proposal here must satisfy

From `docs/HANDOFF.md` §2, and non-negotiable:

- **No jsdom. No `@types/node`.** Tests are pure sim.
- **Config must not import sim.** Balance numbers live in `src/config/`.
- **New state is optional** — `favours?: Favour[]` with a lazy initialiser, exactly
  as `promises?: Promised[]` does. **Never bump `SAVE_VERSION`**, and never add the
  new field to `validate()` in `save.ts`.
- **`FactionId` is closed.** City hall cannot be a faction.
- **Write the test first, watch it fail for the right reason, then implement.**
- `src/config/contraband.ts`'s header stands.
- **You may not sand off the game's voice.** `voice.test.ts` scans every string in
  the project: no gendered pronouns, and "they" takes plural verbs.
- Any refusal must satisfy `refusals.test.ts` — name the threshold it enforces, and
  for a priced choice, name both the price and what the player is holding.

And two the instruments impose:

- **F5 blocks any conquest layer.** Rivals do not act.
- **F7 blocks trusting any probe on this.** No instrument in the project lays low,
  buys a contact, retains counsel deliberately, or approaches a family. Every
  number about the political vertical in this document comes from a blind human
  round, not from a bot, because no bot here has been shown able to play that game.

---

## 7. What this document does not claim

It does not claim the reframe is wrong. It claims the reframe is aimed at the
wrong part of the game, and that the same fantasy is available in the middle where
the measurements say the game currently stops.

It does not claim the seven items in §5 are the right seven. It claims that five
of them have evidence attached and two do not, and that the two without evidence
are ranked last for that reason and no other.

The one failing test in this repository — `ladder.probe.test.ts`, the pre-committed
pacing target — is deliberate and stays failing. It closes when a career can reach
Capo without first winning the front lottery, which is item 3.
