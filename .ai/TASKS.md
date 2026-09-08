# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. Pacing 6, held across two consecutive blind rounds (r23, r24)

**Confirmed, not a one-off.** Both post-merge blind rounds independently
scored Pacing 6 and named the same shape: a mid-late-game stretch (r23:
day ~180+; r24: day ~220-330) of "dismiss digest → handle one recurring
crew conversation → advance time" that reads as maintenance rather than
new decisions, even though Depth scored 9 both times — the systems
underneath are rich, but the *moment-to-moment loop* on top of them
repeats. This is the answer to the question the old version of this item
asked (was the bot's 44% weekly churn number matched by a human's felt
experience?): not quite — churn in *which job* does not read as new
*content* to a human the way a new system or a new kind of situation does.

**Partially diagnosed, 2026-09-08 — the "dominant register" hypothesis is
ruled out; a harder one is left standing.** Checked `config/sitdown.ts`'s
four crew registers (Press/Offer/Listen/Level) directly rather than
guessing: they read four different stats (fear/greed/grievance/respect),
at different thresholds, different costs, and reward different training —
there is no single register that is simply best regardless of who you are
talking to. `npc.ts`'s `perceive()` also genuinely varies the signal shown
before a choice, banded and noisy in a way that sharpens with familiarity.
This system is not shallow, and Depth 9 across both rounds agrees with
that reading.

What's left standing, unconfirmed: the repetition may be about **format**
rather than **content** — the same modal shape appearing over and over
reads as "here we go again" even when the decision underneath genuinely
varies, purely from how often the interaction type recurs. That is a
harder, more fundamental question (reduce sit-down frequency? vary the
UI presentation? accept it as a property of a working mechanic used
often?) that needs a developer call on the trade-off, not a code fix
picked unilaterally. Do not attempt a fix here without that call; the
next useful step is confirming the format-fatigue hypothesis specifically
(does Pacing move if sit-down frequency is throttled, holding everything
else fixed?) before deciding what if anything to change.

## 1a. Interface 6, held across two consecutive blind rounds — partially addressed 2026-09-08

Two concrete, reproduced-every-visit sub-causes fixed this session:
roster detail panels revealing off-screen (`CrewPanel.tsx`,
`RivalsPanel.tsx`), and the steward-delegation hint naming the situation
instead of the door (`attention.ts`, `Rail.tsx`, `delegation.ts`). Neither
fix has been validated by a fresh blind round yet — do that before
assuming Interface has moved. The Rail's badge system itself is already
extensive and well-designed (checked this session); if Interface stays at
6 after the two fixes above are validated, the remaining gap is more
likely the multi-panel information-architecture complexity both testers
described (checking Overview, Operations, Diplomacy and Intelligence
separately) than a missing badge, and that is a bigger design question,
not a quick fix.

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
