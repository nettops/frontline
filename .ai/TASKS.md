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

**1. First hour (7) — not yet investigated at all.** "Nothing taught me
the payroll-timing danger before my first cash crisis" was a single,
un-reproduced complaint nobody has checked against source yet. **Next
step, cheap, no round needed:** read `attention.ts`/`tips.ts` for a
payroll-danger hint — does one exist, and does it fire before or after
the first shortfall? If missing or late, add one test-first. Confirms
when a future round's day-30 notes stop naming payroll as a surprise.

**2. Pacing (6) — diagnosed three times, never attempted.** r23/r24/r27
all name the same shape: a mid-game grind (day ~30-200) before The Trade
and six-figure jobs open it back up. **Next step: try one cheap,
reversible signpost before spending another round on it** — a hint naming
what unlocks soon and roughly when, no balance change. Measure its effect
on `scorecard.probe`'s Pacing axis first, the way any balance-adjacent
change gets measured, *before* dispatching a round to confirm the felt
experience — if the probe shows no movement, the idea is ruled out for
free instead of on a round's dime.

**3. Clarity (7) — the memo/digest bug, real per the tester, unreproduced
three times by direct retest.** `MemoModal` reads `pendingEvents`
unconditionally and sits at `z-index: 50` against the digest's `20` —
nothing in source supports the tester's account of it rendering hidden
underneath. **Next step:** ride along on whichever round runs next (full
or targeted) with an explicit ask — "if you see this, screenshot before
clicking anything else." Three more clean passes without it is itself a
result (fair to call it unreproducible and drop it); a screenshot at the
actual moment is the only thing likely to find a real mechanism if there
is one.

**4. Interface (6) — five rounds, four real fixes, no movement, and this
round's three "concrete" answers didn't survive checking.** **Decided
2026-09-09: the developer plays it directly**, rather than another AI
round or a targeted AI pass — the one method not yet tried, and the one
that can tell whether the ceiling is the game or the testing method
itself. No formal blind-score rubric for this pass (the developer isn't
blind to the design, so a Part-2-style number wouldn't mean the same
thing) — just play normally and log friction as it happens: where you
had to think about *how* to do something rather than *what* to do.
Confirms when either something concrete turns up that five AI rounds
missed, or the developer's own read agrees Interface is fine and the
score has been measuring the AI-tester method the whole time.

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
