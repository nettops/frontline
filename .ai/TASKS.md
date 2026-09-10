# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## The four-axis plan, decided 2026-09-09

r27 read below 8 on four axes. Ranked by what's cheapest to act on first,
not by score — each says what to do and what "worked" looks like on the
next reading.

**1. First hour (7) — CLOSED, a real gap, fixed 2026-09-09.** A payroll
hint already existed (`tips.ts`'s `wages` tip) and was well-placed in
the queue — the actual gap was its gate: `crewList(s).length >= 2`, one
hire more than a career needs to owe wages. The one associate a career
starts with draws a real wage from day one (`npc.ts`'s `wage` field has
no first-hire exception), so a player who never brought in a second man
was never warned at all — exactly round 27's account. Gate lowered to
`>= 1`. Test-first (`tips.reach.test.ts`), mutation-verified. Confirms
when a future round's day-30 notes stop naming payroll as a surprise —
or, worth watching for, whether staying solo long enough to need the
warning is itself rare, in which case this closes a real gap that
happens to be low-traffic.

**2. Pacing (6) — a signpost shipped 2026-09-09, unvalidated.** r23/r24/r27
all named the same shape: a mid-game grind (day ~30-200) before The Trade
and six-figure jobs open it back up. Added a one-time tip (`bigger_jobs`
in `tips.ts`) pointing at `OperationsPanel`'s "Above your standing" table
— which already lists every locked job's requirement and payout, up to
$2.8M, and nothing had ever pointed a player at it. Test-first
(`tips.reach.test.ts`), mutation-verified, live-verified firing correctly
in browser. **Correction to this item's own earlier plan**: a probe
cannot validate this. `scorecard.probe`'s bot doesn't read UI text, so a
pure informational hint cannot move any probe metric — this is an
experience change, and per `DIRECTOR.md`'s own rule, those get a round,
not a probe. Watch the next round's Pacing score and Part 4 "Used" notes
for whether "Above your standing" gets mentioned as newly found.

**3. Clarity (7) — CLOSED, and it turned out to be a real, different bug
than either of us had reproduced. 2026-09-09.** While live-verifying item
2's tip, caught the actual mechanism behind round 27's "memo hidden
behind the digest": the Bulletin's "a memo is open and waiting on you"
line was baked into `report.lines` as a snapshot the moment a multi-day
advance stopped — and a player can answer that memo directly (it renders
on top of everything, same as always) without dismissing the Bulletin
behind it. The banner then goes on saying a memo is open long after the
desk is genuinely clear, which is what actually happened: not a modal
hidden underneath anything, a **stale claim the game kept making about
itself** after the fact stopped being true — confirmed live, reproduced
in the browser, and confirmed fixed the same way. Moved the 'today' part
off the frozen snapshot onto a small pure function (`pendingLines` in
`report.ts`) that `Bulletin` now calls with the live count every render,
so it structurally cannot go stale again. Test-first
(`report.test.ts`), mutation-verified, live-verified.

**4. Interface (6) — the developer played it directly, 2026-09-09. Real
findings came back, none of them the shape anyone guessed.** No formal
blind-score rubric — this pass was about naming friction as it happened,
not producing a number. What came back:

- **The sit-down's reads feeling random at low familiarity — CLOSED, a
  real gap, fixed.** See below.
- **Text density and tab count** — flagged as a first impression ("seems
  like a lot of text," "a lot of tabs, someone could get lost"), not yet
  confirmed as something that actually happened to the developer during
  play rather than a structural worry. Still open; see "Open design
  questions" below for what came of trying to act on it directly.
- **The Armoury and a UI-consolidation idea** — both real proposals, both
  genuinely open design questions, not yet decided. See below.

This closes the item as *worked* — a live human reading did what five AI
rounds could not, which answers the standing question ("is the ceiling
the game or the testing method") with "the testing method, at least in
part": the AI rounds' specific Interface complaints (icon labels, a
digest bug that turned out to be Clarity, a width-collapse artifact)
never named the sit-down issue, and a direct human read found it inside
one screenshot.

### The sit-down's low-familiarity reads — CLOSED, fixed 2026-09-09

Live-diagnosed from the developer's own play: a crew sit-down "doesn't
flow... feels like you pick something random and hope." Traced to a real
mechanism, not a bug in the negotiation logic itself — `sim/sitdown.ts`'s
registers only reveal what a person is carrying (which unlocks a
targeted, connected follow-up line) when the register *lands*, and
landing is judged against a hidden stat read through `perceive()`, which
is deliberately noisy at low familiarity. Early sit-downs (the reported
case: 3 days in, 22% known) are correctly a near-guess by design — the
gap was that nothing on the room screen said so. The only number shown
was a bare familiarity percentage with no context for what it meant.

Fix: `PERCEPTION_TIERS` (`config/npcs.ts`) already has the right words
for this ("First impressions only," "You barely know them") and is
already shown on the crew sheet (`CrewPanel.tsx`) — this was the same
reading, missing from the one screen where the player is about to spend
a choice against it. `SitdownModal.tsx` now computes and prints the tier
label beside the familiarity percentage. Test-first
(`sitdownFamiliarity.test.ts`, a source-scan test matching this
codebase's no-jsdom convention), mutation-verified, live-verified.

### Open design questions from the same session, not decided

- **Armoury rework**, proposed: fold into Operations setup, roll for
  what gear a mission gets. Flagged before building anything: this is
  close to a design `config/pieces.ts`'s own header says was already
  tried on paper (a loot table with cost/heat/odds columns) and rejected
  by name — "one of which dominates each situation, and the choice
  collapses after the first career." The current system is deliberately
  a no-balance-figures readout for exactly that reason. Real diagnosis
  (testers do skip it), proposed mechanism reopens a settled tradeoff —
  needs a developer decision, not a build.
- **UI consolidation**, proposed: fold The Trade into Operations, fold
  the informant "Turn somebody"/"Plant somebody" mechanic into
  Organization. The informant move doesn't fit the data — that table is
  scoped per-agency (which police body, contact cost, upkeep, burned
  status), not per-crew-member, so relocating it would separate it from
  the context it depends on without solving discoverability. Trade →
  Operations is more plausible but risks trading "too many tabs" for
  "too much on one screen," which is the same density complaint from
  the same session. Neither has a decided direction.

## A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
closed for businesses (2026-09-07). Deliberately still not attempted —
no tester across six post-merge rounds has named "districts cost nothing
to hold" as a felt problem, and a second economy tax carries real risk of
repeating F24's own cross-system interaction. Size and measure on its own
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
