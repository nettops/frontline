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

1. **The trade is too rich at day 55, and the bar says it must be.**
   **Needs the director.** Round 30's tester reached the $5,000 runner door
   on day 55 and cleared about $23.6K a week from one route against $3–7K
   from pitched jobs. The ordered fix (runner `ceiling` 14→5, price ×1.85)
   fails `ladder.probe`'s "running both trades for 300 days" bar — 717,717
   against 869,209 at 400 seeds, 581,717 against 817,661 at 36 — and would
   not touch the symptom anyway (one route carries ~3.9 loads; the ceiling
   is 14). The bar is the project's own statement that the trade must be
   worth running, so this is a decision about the bar, not a value to tune
   around it. It also pulls against the day 27–55 cash famine: the trade is
   the thing that ends it. Full numbers in the `SUPPLIERS` comment in
   `config/contraband.ts` and `HANDOFF.md` §0. Options, none built: move the
   bar with evidence (`DIRECTOR.md` §5), reshape the early ramp rather than
   the ceiling, or leave it as the design intends.

2. **Round 30 SHOULD FIX items outside the repair order**, checked or not:
   the heat band text ("Your people are being watched") against Law's
   "Nobody has a file open on you" — two sentences that cannot both be read
   as true (`config/tuning/heat.json`, `sim/investigation.ts:1206`); the
   Businesses list repeating one refusal ten times (`sim/business.ts:472`,
   panel not read); "Little Sicily has gone quiet on you" as a fixed title
   (`sim/eventgen.ts:397`); the Docket heat chip needing heat above 60
   while `config/heat.ts` calls 41 the `hot` edge; autopilot's missing odds
   floor (disclosed in its own button copy). Unverified and not acted on:
   skill labels changing between screens, the Yourself banner wording, and
   the tester's failure streaks against shown odds.

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
