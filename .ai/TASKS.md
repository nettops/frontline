# Tasks — the current queue

This file tracks what's still to do. It does not repeat the history of how
things got here — that's `HANDOFF.md` (the reconciled state, read that
first) and `git log` (what actually changed and why, one commit at a time).
When an item here gets done, it moves to `HANDOFF.md` and drops off this
list rather than staying here as a second, aging copy of the same fact.

Ranked, highest-leverage first. See `HANDOFF.md` §6 for the full findings
ledger (F-numbers) these reference.

## 1. Interface 6, five rounds running (r19, r23, r24, r26, r27) — cause still genuinely unknown

Four sub-causes found and fixed across r24/r25/r26 (roster detail panels
off-screen, the steward-delegation hint naming the situation not the door,
the laying-low job panel's loud default, the "Carry on / Leave it" banner)
— none moved the score. r27 was explicitly asked to be concrete about
*where* the friction is (a screen, a control, how something looks, or
moving between screens) and answered with a memo/digest interaction (see
item 4 below) and unlabelled icon-only top-bar buttons — not "checking
multiple panels."

**The previous entry here — "the remaining gap is multi-panel information-
architecture complexity multiple testers have independently described" —
was checked against its own citation on 2026-09-09 and retracted.** No
round's actual write-up said anything like it; the phrase traced to a
misread of `Dashboard.tsx`'s own header comment about a *round 15* problem
the Wanting/waiting/running panels were already built to fix. Presenting
an inference as something "multiple testers have independently described"
overclaimed the evidence, and it's recorded here rather than quietly fixed
so the same mistake doesn't get repeated with more confidence next time.

**Where this actually leaves Interface: genuinely open.** Five rounds, four
real fixes, no score movement, and the one round asked to be specific named
narrow, checkable things rather than a structural complaint. The honest
next step is not a diagnosis session built on a theory — it's another
direct, concrete ask (as r27's) after the icon-label and memo/digest items
below are looked at, to see whether narrow fixes plus one more reading
finally move it, before concluding it's something bigger.

## 2. Pacing — inconsistent across six rounds, still unresolved

r23/r24 scored 6 (a mid-late-game maintenance loop), r26 scored 7 (new
content still arriving through day 284), r27 scored 6 again. Three sixes
and a seven is not a trend either way. `config/sitdown.ts`'s registers are
confirmed not shallow (prior diagnosis, still holds). Needs a reading that
specifically probes *why* rather than just recording the number — the
format-fatigue hypothesis was never confirmed and shouldn't be assumed
again without one.

## 3. Two SHOULD FIX items from round 27, not yet acted on

- **Icon-only top-bar buttons with no visible label** (sound, hints,
  possibly others) — discoverable only via hover or accessibility
  inspection. Real first-time-clarity gap, cheap to check: does the icon
  have an `aria-label`/`title`, and would visible text fit without
  crowding the bar (which has its own history — see the bar's own comment
  on a controls-overflow incident at narrow widths).
- **The "Why" transparency log's raw numbers still have no per-term
  gloss** (`CONSOLIDATE 0.39 · DIPLOMACY 0.04`). A tonal complaint about
  this page was already fixed once (an introductory paragraph). This is a
  narrower, second-order ask — glossing every term is real new content,
  not a quick fix — and is lower priority than the two items above it.

## 4. A memo rendering "hidden behind" the digest — investigated, not reproduced

r26 and r27 both reported a version of a blocked/confusing negotiation or
memo interaction; r27's specific account: advancing time surfaces a
digest whose "a memo is open and waiting on you" line is plain text, and
the actual memo dialog doesn't appear until the digest is dismissed.
Checked against source (`MemoModal` reads `pendingEvents` unconditionally;
`.memo-backdrop` is `z-index: 50` against the Bulletin's `20`) and live-
tested on a fresh instance — three separate memo-triggering advances, and
in every case the memo rendered correctly on top, immediately. **Could not
reproduce.** Left open rather than guessed at. If it recurs, get a
screenshot at the moment it happens before touching anything — neither the
CSS nor a direct retest explains the tester's account, so the next
reproduction is more likely to find the real mechanism than more reading.

## 5. A district-holding cost for the player

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

## Smaller, lower-priority

- **`informants.probe`'s 29/30 guard, the 1,460-day Difficulty regression,
  Word/Ledger's unwired verbs, the pressure dial's unreachable `hard`
  setting, and trade-economy stock cost** — all still open, all carried in
  `HANDOFF.md` §6 rather than duplicated here.
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
