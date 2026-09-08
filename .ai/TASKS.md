# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. The late-game flatline, day 970+ of a 1,460-day career (was: job-table breadth)

**Re-measured 2026-09-08, and the framing this item carried since round 17
is stale — closed by a fix from the other merged branch neither round knew
about.** "The highest-paying job is always the best job once it unlocks" was
true against the pre-merge code; `perFireByHand` (commit `10f2ee6`,
2026-09-06) now prices repeating a job by hand the same way a standing order
already was, and `scorecard.probe`'s own bot — which does nothing but pick
the best-EV job every day — now reads **Depth 9.5, "best job changed 44% of
weeks, 13 kinds used."** That is not a bot that grinds one job for 100 days.

What the same reading still shows, and is a different, longer-horizon
finding: **Pacing 8, "nothing was new after day 970 — 34% of the career."**
Content runs out late, not because one job dominates but because the pool of
firsts (job kinds, districts, ranks) is finite and a four-year bot exhausts
it. Lower urgency than the old framing — day 970 is far past the 300-day
window a human blind round ever reaches (see `FRONT_UPKEEP_RATE`'s own
comment on why this project sizes changes against 300 days, not 1,460) — but
real, and the next blind round should be asked directly whether decisions
still feel like they stop changing, since a bot's 44% weekly churn number
and a human's felt experience are not guaranteed to agree.

## 2. A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
just closed for businesses (2026-09-07). Natural next step if a future
session wants more 300-day economic bite than front upkeep alone
provided — see `HANDOFF.md`'s round-17 block for what front upkeep did
and didn't move.

## 3. The rival "going quiet" frequency term

`AI.consolidate.wealthGain` was fixed (the *payoff*, 2026-09-07); the
*frequency* of going quiet is set by a different term in
`scoreConsolidate` (`caution * heatPressure + alarmed + broke`) that
session deliberately left alone. `config/factions.ts`'s own history —
three prior measured passes on `pressure.cost`, each with a developer
comment — argues this needs its own careful session, not a rider. Now has
a concrete, currently-red regression guard attached to it: F24's fourth
bar (`ladder.probe.test.ts`, "does not pay a family more to do nothing
than to work"), consolidate share at 61.4% against a ≤61% bar, confirmed
not caused by front upkeep and already past its one-time restatement
exception. Whoever picks this up should make that bar the acceptance test.

## 4. `propose_alliance`, unreachable in every measured career

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
