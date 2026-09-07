# Audit — 2026-09-06

This repo already runs its own audit process, and it is more rigorous than a
fresh read-through would be: [`DIRECTOR.md`](../DIRECTOR.md) (the blind-scorer
loop, findings not scores, "never score your own work"), the open-findings
ledger in [`HANDOFF.md`](../HANDOFF.md) (F1 through F23), the iteration log at
[`docs/superpowers/findings/director-log.md`](../docs/superpowers/findings/director-log.md),
and design specs under `docs/superpowers/specs/`. This file does not repeat
that work. It records what this session found by reading the newest layer of
it against the rest, and what it changed as a result.

## Baseline, verified 2026-09-06

- `git status` clean, `main`, last commit `275c27b` (2026-08-30).
- `npx tsc -b` clean.
- `npx vitest run`: **1,361 tests passing, 11 skipped, 0 failing**, 108 test
  files (1 skipped). `HANDOFF.md` §7a describes 4 pre-committed tests as
  "failing on purpose" as of 2026-08-23 — all four now pass, meaning the work
  between 2026-08-24 and 2026-08-30 (money sinks, evidence, heat ratchet,
  manufacture and orders, scores and setups, the middle game, two street
  scenes, contracts, guns-as-provenance, autopilot heat-awareness) closed them.
  **`HANDOFF.md` and `director-log.md` are stale relative to `main` by about
  nine days and 60-odd commits.** Backfilling that record was judged out of
  scope for this session — it is documentation debt, not a gameplay defect,
  and the specs under `docs/superpowers/specs/` already carry the reasoning
  for each of those changes.

## What this session actually found

**Contracts, the armoury/provenance system, the pressure dial and the favour
network — four of the newest and most consequential systems in the game — had
zero lines in `ui/tips.ts`.** This is the exact, already-diagnosed failure
mode: `README.md`'s "The fourth playtest, and the systems nobody could find"
records that the sit-down, delegation and promises all shipped the same way
and all needed the same fix, discovered only because a blind tester spent 168
days never finding any of them.

Checked before acting, per `DIRECTOR.md` §6 ("ask whether the question is one
a check could answer" before reaching for a round): `grep` across `ui/tips.ts`
for `contract`, `civic`, `favour`, `pressure` and `armoury` returned nothing.
That is a greppable property, not a hunch, and it did not need a blind round
to confirm.

This is squarely a **P0 longevity** finding in the terms of the brief this
session was given: contracts and the favour network are the two newest
levers a player has for the back half of a career (removing a rival capo or
boss; a standing relationship with the city that cannot be bought). A lever
nobody can find might as well not exist, and `HANDOFF.md`'s own F1 — "decisions
stop changing around day 90-119" — is exactly the symptom of a game whose
newest decisions are invisible.

The armoury was deliberately left out of this fix. It has its own Rail page,
and `config/armoury.ts`'s own design note argues against a tutorial for it —
adding one would go against a documented design decision rather than closing
a gap.

## What was done

Three tips added to `ui/tips.ts` (`lean_on_it`, `contract`, `favours`), each
gated on the state actually being true rather than on a day where that could
be checked, matching the existing `borrow_a_front` rule. See the director-log
entry "Three systems shipped invisible, again" for the full account and the
measured reachability. `tips.reach.test.ts` was updated in the same commit —
test-first, per this project's standing instruction: the classification test
was watched failing before the tips were classified, and reachability was
verified against the bot rather than assumed.

No balance numbers were touched. `ladder.probe`'s existing contract arms
already show the system is tuned (going after rivals unprovoked does not make
every career richer; at war it roughly breaks even) — the defect was
discoverability, not the numbers underneath it, and the fix matches that.

## Owed, from `HANDOFF.md` §7, still open

Recorded here rather than re-derived, because re-deriving it would be
redundant with work already done and dated:

- **The rival-heat probe for F5** (rivals go inert after ~day 76 across three
  rounds; behaviour confirmed, mechanism not). Contracts now give the player
  a lever *against* rival capos, which does not by itself fix rival AI
  passivity — a different mechanism.
- **An adversarial round** (`DIRECTOR.md` §10 condition 6), never attempted.
- **A blind round on the four Mafia-boss systems**, now five with contracts —
  none has ever been seen by a human tester. The tip work in this session
  makes that round more likely to actually exercise them, which is the most
  it can do without spending a round.
- **F1 itself** — "decisions stop changing around day 90-119" — is a
  three-round-confirmed finding this session did not close. It is downstream
  of several of the above and a single session's worth of work was not going
  to close it outright; the tips fix is the highest-confidence, lowest-risk
  piece of it available without a redesign.

---

## Addendum — 2026-09-07, the 5-hour round

Continuation session. An Opus-model pass re-audited the codebase against
this file plus the areas nobody had verified line-by-line yet (the
2026-08-24 through 08-30 specs, `authority.ts`, `personal.ts`,
`delegation.ts`, `civic.ts`, `capos.ts`, `pressure.ts`, `contract.ts`,
`pieces.ts`, `autopilot.ts`) and confirmed most of the previous session's
"already fine" claims while producing a fresh, evidence-backed priority
list. Five fixes shipped from it — see `docs/superpowers/findings/
director-log.md`'s "Five sessions in one" entry and `.ai/TASKS.md` for the
full account.

**The pattern repeats.** Last session found three systems (contracts, the
favour network, the pressure dial) with real, complete logic and no way to
discover them. This session found the same shape one layer down: config
keys with real balance intent and no reader (`gripSkim`, `protectionTrust`,
`cooldownDays`, `evidenceStrength`), and one verb — Instinct, the single
most expensive one in the build table — with complete sim logic
(`plant`/`pullOut`/`hearsAbout`) and no UI anywhere at all. Between the two
sessions, "a real system nobody can reach" is now the single most common
defect class found in this codebase, ahead of any balance question.

**A genuine limit found, not just fixed.** Auditing Instinct's neighbours
(Word, Ledger) for the same defect found something different: both verbs'
underlying mechanism is not merely unwired, it does not have anywhere to
attach. Word's gate protects a restriction that was never built; Ledger's
buy-in function can only ever address the player's own businesses, because
no rival-business entity exists in the sim to be the "somebody else" in
"buy into somebody else's business." Building either is a design decision,
not a fix, and both are recorded honestly on the build screen and in the
next-steps list rather than built badly under a deadline.

**One recommendation checked and declined.** Retuning `CONTRACT.
cooldownDays` down from 300 was recommended and found, on inspection, to
match an already-shipped sibling mechanic (`CAPO_APPROACH.cooldownDays` at
400) that `contract.ts`'s own header says is deliberately mirrored. Left
alone; reasoning recorded in the director log rather than silently applied
or silently dropped.

A blind playtest round (`round16`) was dispatched after the five fixes
landed, to give a human-shaped read to changes across two sessions that no
round has ever seen. Its results are in `.ai/FINAL_REPORT.md`.
