# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first.

**Trimmed to current-only 2026-09-17.** Everything that stood here as a
CLOSED narrative (the NOT NEGOTITABLE pass and its five phases, round 28's
findings, the Not Used table pattern, the four-axis plan, loyalty-pressures
UI, late-game job-type variety, `payRead` and the three `ladder.probe`
failures, trades profitability) is folded into `HANDOFF.md` §0/§6 and its
archives. The NOT NEGOTITABLE pass is **complete** —
`docs/findings/not-negotiable-report.md` has the per-section table.

## Open

1. **NPC loyalty's weekly drift terms have zero UI surface** (NN §8's one
   real gap, deliberately not built that pass). Stagnation, under/overpay
   and heat-fear move loyalty every week and nothing on screen says so.
   A numeric breakdown would break the "never a number" rule, so this
   needs a banded "current pressures" list, not a percentage.

2. **`distinctEnds` — final-rank diversity over four years reads 2 of a
   possible 5.** Surfaced by the Difficulty re-measurement (the axis
   itself is healthy at 6.07); now that axis's actual soft spot. Not
   chased.

3. **A district-holding cost for the player.** Rivals already pay
   `upkeepPerDistrict`/`upkeepDistrictScale` (`config/factions.ts`); the
   player never did — the same gap front upkeep closed for businesses.
   Deliberately still not attempted: no tester across seven post-merge
   rounds has named it as a felt problem, and a second economy tax risks
   repeating F24's cross-system interaction. Size and measure on its own
   if attempted, and re-check favour-network reachability first.

4. **Favor-calls attributable to the wrong family** (boss-fantasy overhaul
   item 6) — blocked. Every favor action that exists only benefits the
   player; none hurts a rival, so there is nothing to make blamable via
   `attribute()`. Needs a real rival-hurting favor action built first
   (own scope/tests/probe).

## Smaller, lower-priority

- **`informants.probe`'s 29/30 guard** and **the pressure dial's
  unreachable `hard` setting** (29 of 1,498 career-weeks) — both carried
  in `HANDOFF.md` §6's archive, both untouched since 2026-08-23.
- F9 (fear near its ceiling) — the display is not the lever; the real fix
  is the "dominated strategies" shape already partly addressed for the
  favour/dial pair.
- Opus's feature ideas: (a) a payroll shortfall with a name attached,
  (d) a reachable deposition threat — neither attempted, both still ideas.
- Promotion silently fixing loyalty problems the game's own text says
  money can't touch (r25) — possibly a working "aha", possibly a missed
  hint. Not diagnosed.
- Confronting a skimming steward being a one-way trust cliff (r25) — a
  design question, not a bug.
- Flavour-text repetition over a long run (r26: "It was loud. It did not
  need to be loud." by day 200+) — not measured against
  `prose.test.ts`'s thresholds.
- The intermittent page-width collapse r27 saw — possibly a harness
  artifact per the tester's own caveat. Not chased without a cleaner
  second report.
