# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. Interface 6, four rounds running (r19, r23, r24, r26) — three fixes made, score unmoved

Four sub-causes found and fixed across r24/r25/r26, all reproduced on
nearly every visit: roster detail panels revealing off-screen
(`CrewPanel.tsx`, `RivalsPanel.tsx`, live-verified in-browser), the
steward-delegation hint naming the situation instead of the door
(`attention.ts`, `Rail.tsx`, `delegation.ts`, mutation-tested), the
laying-low job panel defaulting to the loud approach instead of the only
legal one (`OperationsPanel.tsx`, logic-verified, no jsdom in this
project), and the "Carry on / Leave it" banner explaining itself only on
hover (`App.tsx`). **r26, the first round to play after three of the four
fixes landed, still scored Interface 6.** That is now real evidence, not
just a prediction: the remaining gap is the multi-panel information-
architecture complexity multiple testers have independently described
(checking Overview, Operations, Diplomacy and Intelligence separately to
know what needs attention), not a missing affordance. This is a bigger
design question — do not keep chasing it with one-off UI patches; the
next session should treat it as its own diagnosis, not a rider.

## 2. Pacing — inconsistent across rounds, format-fatigue hypothesis unconfirmed

r23 and r24 both scored Pacing 6 and named the same shape (a mid-late-game
maintenance loop). r26 scored it 7 and named new content still arriving
through day 284. Not yet resolved which reading is more representative —
possibly both are correct for different play styles, possibly it's
genuinely improved (nothing was changed that should affect it), possibly
it's tester variance. `config/sitdown.ts`'s registers are confirmed not
shallow (see prior diagnosis, still holds). Needs a fourth reading before
concluding anything; do not chase the format-fatigue hypothesis further
without one.

## 3. A district-holding cost for the player

Rivals already pay `upkeepPerDistrict`/`upkeepDistrictScale`
(`config/factions.ts`); the player never did, the same gap front upkeep
closed for businesses (2026-09-07). Deliberately still not attempted —
no tester across five post-merge rounds has named "districts cost nothing
to hold" as a felt problem, and a second economy tax carries real risk of
repeating F24's own cross-system interaction. Size and measure on its own
if attempted, and re-check favour-network reachability specifically
before committing to a rate.

## 4. A negotiation/case sub-option shown blocked for every candidate, no reason given

r26, single occurrence, not reproduced: a "send somebody, 2 of your people
for 5 days" option showed disabled for all four named crew in a
case-detail panel with no stated reason. Not located in the source in the
time available this session — the exact string didn't match anything in
`LawPanel.tsx`, `events.ts`'s `SHORT_NOTICE` memo, or an obvious contract-
crew-assignment path. Whoever picks this up next: get the exact panel and
context from a fresh reproduction first, since guessing at the file wasted
real time this session.

All items closed 2026-09-08 (F24's fourth bar, `propose_alliance`, the
Trade signposting hint, the round-25 MUST FIX, the rank-promotion crew-
count line, the "Carry on / Leave it" banner) have been folded into
`docs/HANDOFF.md` §6 and dropped from here — see that file for the full
write-up of each, not a second copy of it in this queue.

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
- "Decide it was them" giving no visible right/wrong confirmation (r26) —
  checked and left alone: by design, the same "you find out over months"
  principle `contract.ts` states explicitly. Real effects land (crew
  loyalty/fear/respect) but aren't narrated as attributable either way.
- Flavour-text repetition surfacing over a long run (r26) — a specific
  line ("It was loud. It did not need to be loud.") recurred often enough
  by day 200+ to be noticed. Not measured against `prose.test.ts`'s
  thresholds this session.
