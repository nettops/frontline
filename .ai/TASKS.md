# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. Pacing 6, held across three consecutive blind rounds (r23, r24, r25*)

**Confirmed, not a one-off.** r23 and r24 independently scored Pacing 6 and
named the same shape: a mid-late-game stretch of "dismiss digest → handle
one recurring crew conversation → advance time" that reads as maintenance
rather than new decisions, even though Depth scored 9 both times — the
systems underneath are rich, but the *moment-to-moment loop* on top of them
repeats. (*r25 didn't score this axis under its own name — see its entry in
`HANDOFF.md` §6 — so it isn't a clean third data point, but its own account
of a quiet, uneventful 221 days is at least consistent with the pattern.)

**Partially diagnosed, 2026-09-08 — the "dominant register" hypothesis is
ruled out; a harder one is left standing.** Checked `config/sitdown.ts`'s
four crew registers (Press/Offer/Listen/Level) directly: they read four
different stats at different thresholds, costs, and training rewards —
no single register is simply best regardless of who you are talking to.
`npc.ts`'s `perceive()` genuinely varies the pre-choice signal, sharpening
with familiarity. This system is not shallow, and Depth 9 across every
round agrees.

What's left standing, unconfirmed: the repetition may be about **format**
(the same modal shape recurring often) rather than **content**. That is a
developer-level trade-off (reduce sit-down frequency? vary presentation?
accept it?), not a code fix to pick unilaterally. Next useful step: confirm
the format-fatigue hypothesis specifically before changing anything.

## 2. Interface 6 across three rounds — two concrete causes fixed, unvalidated

Three sub-causes found and fixed across r24/r25, all reproduced on nearly
every visit: roster detail panels revealing off-screen (`CrewPanel.tsx`,
`RivalsPanel.tsx`, live-verified in-browser), the steward-delegation hint
naming the situation instead of the door (`attention.ts`, `Rail.tsx`,
`delegation.ts`, mutation-tested), and the laying-low job panel defaulting
to the loud approach instead of the only legal one (`OperationsPanel.tsx`,
logic-verified, not live-browser-checked — no jsdom in this project).
**None of the three validated by a fresh blind round yet.** The Rail's
badge system itself is already extensive and well-designed (checked
2026-09-08); if Interface stays at 6 after these are confirmed, the
remaining gap is more likely the multi-panel information-architecture
complexity multiple testers have described than a missing badge — a
bigger design question, not a quick fix.

## 3. A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
closed for businesses (2026-09-07). Deliberately not attempted alongside
today's F24 work — a second new economy tax risked repeating the exact
cross-system interaction (favour-network reachability) F24 spent hours
untangling, without a tester-validated need for it yet. Size and measure
on its own, and re-check favour-network reachability specifically before
committing to a rate.

## Closed today, 2026-09-08

- **F24's fourth bar (rival "going quiet" frequency) — CLOSED.** See
  `HANDOFF.md` §6. `scoreConsolidate`'s `alarmed` step smoothed;
  `AI.consolidate.whenBroke` moved 0.45 → 0.42. Real player corroboration
  arrived the same day: round 25's tester played 221 days with zero rival
  activity of any kind.
- **`propose_alliance` reachability — a real fix attempted, not a third
  bar-lowering.** Confirmed `tickBonds` already builds trust passively
  (`trustPerPeacefulWeek`) but at 0.22/week, reaching the alliance gate
  (relationship ≥20) from a clean slate took ~91 weeks — past any career
  this project has measured one played. Raised to 0.5/week: ~40 weeks
  (280 days) from zero trust and no grudge, inside a human blind round's
  actual window; full alliance status (`allianceTrust`, 40) stays roughly
  double that, so it isn't also handed out early. Unvalidated by a blind
  round — there is no pre-committed bar for this (the relevant
  `ladder.probe` test is diagnostic-only), so watch `peakStanding` in the
  next round's report rather than assuming this worked.
- **The Trade's zero signposting — fixed.** Corroborated independently by
  r24 and r25. New `attention()` hint fires once `tradeUnlocked(state,
  'product')` and no supplier has ever been retained; mutation-tested.
- **A round-25 MUST FIX — fixed.** Laying-low job panel defaulted to the
  loud approach; now lazily initializes to quiet when laying low at mount.

## Smaller, lower-priority

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
