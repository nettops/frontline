# Engagement overhaul — repository audit

Phase 0 of the engagement and retention brief. Written before any code changed.

The short version: **most of the twelve proposed phases already exist in this
repository, several of them more completely than the brief assumes**, and the
one thing that would defeat all of them if unaddressed is a rate limit in
`events.ts` that this project has already been bitten by once and documented at
the scene.

---

## 1. What the simulation is

One plain `GameState` object, JSON-serialisable by construction. Systems are
functions that mutate it. React reads it through a version-counter store. No
Redux, no ECS, no event bus. 28,272 lines of simulation across 60 modules in
`src/sim/`, 14,598 lines of tuning data in `src/config/`, 15,462 lines of UI.

Three properties govern every change made below.

**Determinism is load-bearing.** `rng.ts` is stateless given `(seed, calls)` —
the value for call *N* is a pure hash. Seed and call count live in saved state,
so a load resumes the identical stream. Ironman, reproducible bug reports and
the 24-world statistical harness all depend on it. Any new system that draws
from the causal stream reorders every later draw in the simulation.

`whispers.ts` states the rule this creates and follows it: a system that only
*reports* on the world must not be able to change what happens in it. It draws
from `Rng.stableNoise`, keyed on day and world seed — deterministic,
reproducible, invisible downstream. Its docblock records that the first version
took an `Rng`, rolled weekly, and broke two unrelated operations tests the
moment it was wired in. `trace.ts` and `authority.ts` state the same rule.

**The tick pipeline is ordered, and the order is balance.** `clock.ts`
sequences ~40 `tick*` calls in one visible place. This is the extension point
for anything that needs to happen per day.

**Leaf modules are a deliberate discipline.** `attention.ts`, `standing.ts`,
`memory.ts`, `goals.ts`, `ties.ts`, `beliefs.ts`, `holdings.ts`, `houses.ts`,
`market.ts` and `capos.ts` read state directly and import only config, so
consumers cannot create a cycle. Where a leaf needs to reach *up*, it takes a
hooks object from `clock.ts` (`AgingHooks`, `LoanHooks`). New derived systems
belong in this shape.

**Save compatibility is by optional field.** `SAVE_VERSION` is 12 and has not
moved in a long time because everything added since went in as an optional
field — `sitdown?`, `wagesOwed?`, `ledger?`, `promises?`, `whispers?`,
`informingSince?`. Absent reads as the truth for a save written before the
system existed. `whispers.ts` and `promises.ts` both lazily create their array
on first read for exactly this reason. Every new field below follows it.

---

## 2. The blocker, and it is the important part of this document

**The memo channel is a single shared slot of roughly a quarter of a day, and
adding drama sources to it is zero-sum.**

`events.ts:1673`:

```ts
export function tickEvents(state, rng) {
  if (state.pendingEvents.length >= MAX_PENDING) return;   // MAX_PENDING = 3
  if (rng.chance(EVENT_CHANCE_PER_DAY * diff.eventPressure)) {   // 0.16
    if (raise(state, rng, eligible(state, rng, AUTHORED_DEFS))) return;
  }
  if (!rng.chance(GEN_CHANCE_PER_DAY * diff.eventPressure)) return;  // 0.11
  raise(state, rng, eligible(state, rng, GEN_DEFS));
}
```

An authored event firing `return`s, so the generated half never gets a look
that day. The ceiling is `0.16 + 0.84 × 0.11 ≈ 0.25` memos per day, before
`applies()` gates reject candidates.

**Measured actual rate: 31, 34 and 44 memos across 300 days for seeds 11, 22
and 33 — 0.10 to 0.15 per day, interrupting 10–15% of days.** Counted directly
through `advanceDay`, not inferred.

The project has already paid for this once and left the receipt. `events.ts:825`
carries a block headed `PARKED: the partner offer is built and not wired` —
`sim/partner.ts`, `config/partner.ts` and fourteen green tests, a working
mechanism, withdrawn because it pushed a pre-committed Pacing axis under its
bar. Four separate tunings produced four readings inside 0.3 of each other, and
the note's own diagnosis is: *"`dailyMemo` fills one slot a day and a new
definition costs an authored one."*

**Consequence for this brief.** If the Living Agenda, NPC-initiated
interactions and rumour follow-ups are built as new `EventDef` entries, they
will not add drama. They will redistribute the same quarter-memo per day across
more definitions, make each existing memo rarer, and produce exactly the
inconclusive 0.3-drift measurement the partner offer produced.

**Therefore the engagement layer must be a derived read, not an event source.**
`attention.ts` is already this shape: nothing in it is state, every line is
computed on read, it costs no event slot and has no rate limit. That is the
foundation. Events stay the *interrupt* channel — rare, blocking, one thing at
a time — and the agenda becomes the *ambient* channel, always available, never
forced. Two channels with different jobs, rather than one channel with more
things competing for it.

---

## 3. What already exists, phase by phase

| Brief phase | Exists as | State |
| --- | --- | --- |
| **1. Living Agenda** | `sim/attention.ts` — *"What wants you today"* | **Built, but logistics-only** |
| **2. Rumour / information** | `sim/whispers.ts` + `config/whispers.ts` | **Built almost to spec** |
| **3. NPC-initiated interactions** | `sim/sitdown.ts` | **Built, but never NPC-initiated** |
| **4. Promises** | `sim/promises.ts` + `config/promises.ts` | **Built, two words of vocabulary** |
| **5. Story arcs** | `goals.ts`, `memory.ts`, `ties.ts`, `marks.ts`, `informants.ts` | Parts, no framework |
| **6. Relationship web** | `sim/ties.ts` + `perceive()` in `npc.ts` | Data built, no view |
| **7. Family history** | `addLog`, `memory.ts`, `ledger.ts`, `trace.ts` | Parts, no chronicle |
| **8. Dynasty chronicle** | `sim/succession.ts`, `sim/legacy.ts` | Succession built; no cross-reign record |
| **9. Major crisis** | `world.ts`, `diplomacy.ts`, `investigation.ts`, `leaders.ts` | Ingredients, no crisis tier |
| **10. Player identity** | `sim/legacy.ts` — *"what a career turns out to have been"* | Partly built |
| **11. Scenario starts** | `config/modes.ts` `SANDBOX_STARTS` | **Three built** |
| **12. Challenge seeds** | `sim/rng.ts` | **Determinism already complete** |

### The four P0 systems in detail

**Phase 1 — `attention.ts` is the Living Agenda, and it has five sources.**
Idle crew with affordable work; score setups running down; a district needing a
steward; a standing order that has developed a rhythm; a training pairing
available. All five are logistics. **None** of the brief's examples are
present: no deteriorating loyalty, no rival approaching a crew member, no
skimming, no rival offer, no political contact, no developing investigation, no
promotion demand. The machine is right and the inputs are thin.

One conflict to settle before building. `attention.ts` states its own rule:
*"Deliberately not a to-do list and deliberately not scored. It says what is
waiting; it does not say what is worth doing, because that is the game."* The
brief asks for CRITICAL / DEVELOPING / OPPORTUNITY / INFORMATION severities,
which is scoring. See §5.

**Phase 2 — `whispers.ts` already implements the brief's spec.** Subject,
confidence (0..1, independent of correctness), age, a `truth` field that is
stored and never exposed, corroboration by a second whisper as the only honest
verification, and generation from real state. `readWhispers()` is shape-tested
so that adding a field cannot quietly become adding `truth`. It is surfaced in
`IntelligencePanel.tsx` and read by `eventgen.ts:606`.

What is missing is the brief's *decision*: investigate / ignore / act / verify
through contacts. Today a whisper is read and nothing can be done about it
except wait for corroboration.

**Phase 3 — this is the largest genuine hole.** `openSitdown` is called from
exactly two places, `CrewPanel.tsx:655` and `DiplomacyPanel.tsx:265`. Both are
buttons. **Nothing in the simulation ever opens a sitdown.** The game's second
verb exists, is well built, and is only ever reachable by the player walking to
someone's door. Nobody comes to yours.

**Phase 4 — the promise machine is complete and its vocabulary is two words.**
`makePromise` / `keepPromise` / `tickPromises`, memory-backed, deliberately
owning no consequence of its own so that breaking a promise reaches the
informant gate, the poaching gate and the succession claim through
`memory.ts` without this module knowing they exist. That is good architecture.

But `config/promises.ts` defines exactly two kinds — `next_job` and `covered` —
`makePromise` is called from one site (`sitdown.ts:333`), and `keepPromise` from
one site (`operations.ts:656`). The brief asks for promotion, territory,
succession and problem-handling. None exist.

---

## 4. What must not be rewritten

- **`rng.ts` and the stable-noise convention.** Any reporting system draws from
  `stableNoise`, never the causal stream.
- **`events.ts` resolution.** Every branch changes state; there are no choices
  that only print text. Preserve that.
- **`perceive()` and `PERCEPTION_TIERS`.** The player never sees raw stats. The
  relationship web (Phase 6) must render through this, not around it.
- **`whispers.ts` truth hiding.** `readWhispers` must never gain a truth field.
- **`promises.ts` consequence-free design.** Add kinds; do not add effects here.
- **`clock.ts` call order.** Insert, do not reorder.
- **`attention.ts` leaf shape.** Derived on read, no state, no imports back.
- **`trace.ts`.** Diagnostic only, never read back into the simulation.

---

## 5. Two conflicts in the brief, and what I propose

**Severity scoring vs. `attention.ts`'s stated rule.** The brief wants four
priority tiers; the module says it deliberately does not say what is worth
doing. These can be reconciled but not ignored: I propose severity describe
**how fast a thing is moving**, not how important it is. CRITICAL means *this
resolves itself against you soon*; DEVELOPING means *this is getting worse*;
OPPORTUNITY means *this window closes*; INFORMATION means *nothing will happen
if you ignore this*. That is a statement about the clock, which the simulation
knows, rather than about worth, which is the player's. I will record the
reasoning at the site.

**"Always several things demanding attention" vs. the six-item cap.**
`attention.ts` caps at six and says a list that is always full is wallpaper. The
brief's "the player should always have several meaningful things" risks exactly
that. I propose keeping the cap and keeping absence possible: a quiet week
should still be able to show two items, or none.

---

## 6. Proposed implementation order

Following the brief's P0 → P3, with the ordering inside P0 changed for one
reason: promises and NPC-initiated contact are what make agenda items *matter*,
so they come before the agenda widens.

**P0**
1. **Promise vocabulary** — add `promoted`, `territory`, `next_in_line`,
   `handled`; wire keeping paths in `crew.ts` (promotion), `delegation.ts`
   (territory), `succession.ts` (heir named). Smallest change, highest leverage,
   feeds everything after it.
2. **NPC-initiated contact** — a `tickApproaches` leaf that lets a man with a
   goal, a grievance, an unkept promise or an ambition ask for the meeting.
   Routed through the existing `sitdown` and gated so it does not spend the
   memo slot.
3. **Whisper follow-up** — the four decisions on a rumour, using `civic.ts`
   contacts and `informants.ts` for verification.
4. **Agenda widening** — new sources in `attention.ts` reading loyalty drift,
   grievance, open cases, poaching, skimming, front health, promises outstanding.

**P1** Story-arc framework, relationship web view, family history.
**P2** Dynasty chronicle, crisis tier, player identity.
**P3** Scenario starts (extend `SANDBOX_STARTS`), challenge seeds.

---

## 7. Risks

1. **Memo starvation** (§2). Mitigated by building the agenda as a derived read.
2. **Determinism breakage.** Any new causal draw reorders the stream and will
   fail the balance probes. Mitigated by `stableNoise` for anything reporting.
3. **Pacing regression.** The partner offer was parked for pushing Pacing under
   its bar. Every P0 addition must be measured on `scorecard.probe` before it is
   called done, not after.
4. **Perception leakage.** The agenda names things the player may not know.
   Every new source must be gated on what the organization actually knows.
5. **Save compatibility.** New state as optional fields only.
6. **Scale.** This is twelve systems. Delivering P0 well beats delivering all of
   it badly, and the brief says so.

---

## 8. Testing strategy

The suite is the balance guard, not a regression net. `npm test` is 1,211 tests
in ~31s; `npm run probe` is 79 tests in ~9 min across eight measuring files.

Per new system: unit tests for the logic; an integration test through
`advanceDay`; a determinism test asserting the same seed produces the same
stream (and, for reporting systems, that the system's presence does not change
any other system's output); a save/load round-trip where state persists; and a
regression run of the full suite.

For pacing, the instrument is `scorecard.probe` and `ladder.probe` — measure
before the change, not only after, and report both.

---

## 9. Where this leaves the brief

Four of twelve phases are substantially built (2, 4, 11, 12), two more have the
machine but no inputs (1, 3), and one has complete data with no view (6). The
work is smaller than the brief assumes and differently shaped: less building,
more **connecting things that were built and never wired to each other** — which
is also the single defect this audit found most of, from the parked partner
offer to a second verb that no NPC can invoke.
