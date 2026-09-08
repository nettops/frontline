# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. Job-table breadth / the Pacing wall

The single most load-bearing open item. Confirmed unmoved across two blind
rounds (2026-09-07) despite a real gate resize: the highest-paying job is
always the best job once it unlocks, so nothing below it is ever worth
doing. Root of "decisions stop changing around day 180-200," unchanged
across every round this project has ever measured. Needs new job kinds or
a job that pays in something other than money — content work, not a
config change. Do not attempt as a same-day rider on another change; size
and measure it on its own.

## 2. Two unconfirmed bug candidates from round 19 (2026-09-07)

Found past that session's deadline, checked against source, not yet
verified live:
- *"Lay low silently blocks a loud launch"* — the code already looks
  correct (`operations.ts:535`'s refusal matches the tester's quote
  exactly, rendered as visible text under a disabled button). Likely a
  testing-harness artifact. Confirm with a live screenshot before touching
  anything.
- *"Event dialogs render visually overlapped"* — a specific mechanism was
  found (`.receipt` at z-index 60 can float over `.memo-backdrop` at
  z-index 50 when memos queue inside the receipt's 6-second window,
  `theme.css:2517` vs `:993`) but not reproduced live. Confirm before
  deciding whether the fix is a lower z-index, a shorter window, or
  standing the receipt down when a new event arrives.

## 3. A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
just closed for businesses (2026-09-07). Natural next step if a future
session wants more 300-day economic bite than front upkeep alone
provided — see `HANDOFF.md`'s round-17 block for what front upkeep did
and didn't move.

## 4. The rival "going quiet" frequency term

`AI.consolidate.wealthGain` was fixed (the *payoff*, 2026-09-07); the
*frequency* of going quiet is set by a different term in
`scoreConsolidate` (`caution * heatPressure + alarmed + broke`) that
session deliberately left alone. `config/factions.ts`'s own history —
three prior measured passes on `pressure.cost`, each with a developer
comment — argues this needs its own careful session, not a rider.

## 5. `propose_alliance`, unreachable in every measured career

Diagnosed, not attempted: the relationship quantity it gates on has no
passive growth, only explicit tribute actions feed it, and the gate has
already been lowered twice on the same quantity. Needs a real design
call (should peace passively build trust?), not a third bar-lowering.

## Smaller, lower-priority

- F9 (fear near its ceiling) — Opus's 2026-09-07 diagnosis: fixing the
  *display* moves nothing; the real lever is the same "dominated
  strategies" shape already partly addressed for the favour/dial pair.
- Opus's feature ideas (a) a payroll shortfall with a name attached, (d) a
  reachable deposition threat — neither attempted, both still just ideas.
