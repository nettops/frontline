# Test results — 2026-09-06

## Before any change

    npx tsc -b        clean
    git status        clean, main, HEAD 275c27b (2026-08-30)
    npx vitest run    1,361 passed, 11 skipped, 0 failed, 108 files (1 skipped)

## After the tips fix (`ui/tips.ts` + `ui/__tests__/tips.reach.test.ts`)

    npx tsc -b        clean
    npx vitest run    1,361 passed, 11 skipped, 0 failed, 108 files (1 skipped)

Identical counts — the new coverage lives inside `tips.reach.test.ts`'s
existing cases (the `ORDINARY` list and the "accounts for every tip"
assertion), not in new `it()` blocks.

## What was specifically verified, not just run

- **Test-first, per the project's own standing instruction.** Adding the three
  tips without classifying them in `tips.reach.test.ts` was run first and
  failed for the expected reason: `accounts for every tip in the list` listed
  exactly `['lean_on_it', 'contract', 'favours']` as unaccounted for.
- **Reachability, not assumed.** All three were provisionally placed in
  `ORDINARY` and `tips.reach.test.ts` was re-run on its own
  (`npx vitest run src/ui/__tests__/tips.reach.test.ts`) before touching
  anything else — it passed, meaning the plain recruit-and-run bot the test
  already drives reaches all three without needing new bot behaviour. That is
  the same discipline `borrow_a_front`'s own test comment insists on: a claim
  that a tip is reachable is only worth as much as the run that checked it.
- **No balance claim taken on faith.** `src/sim/__tests__/ladder.probe.test.ts
  > sending people after somebody else's people` was run directly
  (`-t "sending people"`) to read what the contracts system actually does
  before writing anything about it in the audit or the log: going after
  rivals unprovoked is ahead in 9 of 36 careers (median $-288,425 against
  never sending), and doing it only at war roughly breaks even (17 of 36,
  median $0). Quoted in `AUDIT.md` and the director log rather than assumed
  from the design doc's stated intent.

## Also run

    npm run build     succeeds — `dist/` built in 1.95s. The one warning
                       (a 888 kB main chunk) predates this session and is
                       unrelated to a three-tip addition.

## Not run in that session, and why

- **A blind playtest round.** `DIRECTOR.md` requires a fresh agent that has
  not read the source, playing a live instance to Capo or day 300 — a
  90-minute-class cost on its own, and the governing brief's time budget for
  that session did not leave room for one alongside the audit and the fix.
  The tips change makes a future round more likely to actually exercise
  contracts, the favour network and the pressure dial, which is the most that
  session could do toward one without spending it. Run in the next session —
  see below.

---

# Test results — 2026-09-07 (the 5-hour round)

## Before any change

    git status        clean, HEAD d3bb6c3
    npx tsc -b         clean
    npx vitest run     1,361 passed, 11 skipped, 0 failed

## After each of the five commits

Every commit was verified individually before moving to the next:
`npx tsc -b` clean, the specific test file(s) touched run in isolation, and
— for the four fixes with a clear "before" state — the fix was temporarily
reverted and the new test re-run to confirm it actually fails without the
fix, then restored:

- `delegation.test.ts` "backs up what the build screen promises Grip does" —
  confirmed red without the `gripSkim` line, green with it.
- `partner.test.ts` "reads as real protection..." — confirmed red without
  the floor in `relationship()`, green with it.
- `contract.test.ts` "keeps a hand off a man who just lived through one" —
  confirmed red without the cooldown check, green with it.
- `investigation.test.ts` "warns of the next stage through a plant..." —
  confirmed red without the warning hook in `advanceStage`, green with it.
- `refusals.test.ts` and `deadState.test.ts` were run to failure first by
  construction — each was widened/written before the corresponding fix
  existed, per the project's own test-first instruction, so their initial
  red run (naming the exact sites) is the verification rather than a
  separate revert-and-check step.

## After all five commits

    npx tsc -b         clean
    npx vitest run     1,367 passed (+6), 11 skipped, 0 failed, no test files
                       newly failing
    npm run build      succeeds, 1.73s, same pre-existing chunk-size warning

## Verified live in the browser, not only in tests

Using the `mafia-verify` launch config (port 5310) and the page's own
`window.__frontline` harness plus direct DOM queries:

- A fresh career's build screen shows "NOWHERE ON ANY SCREEN DOES THIS YET"
  for Word and Ledger's verb line, before either threshold is reached —
  confirming the fix fires at the level the player actually sees it, not
  only in the `StatDef` data.
- The Intelligence panel's new Planted column renders a "Plant somebody"
  button per agency, correctly `disabled` with title "You are not the kind
  of boss who has people in other people's houses." at Instinct 1 — the
  verb-gate message renders exactly as `verbs.ts`'s `gate()` helper writes
  it, not a placeholder.

## Run after the five commits

A full blind playtest round (`round16`, isolated instance on port 5316, a
fresh subagent with no source access) was dispatched to validate the
accumulated changes from both sessions against an actual human-shaped read.
Its full report is in `.ai/FINAL_REPORT.md`.

## Not run this round, and why

- **The rival-heat probe for F5**, and **an adversarial round**
  (`DIRECTOR.md` §10 condition 6) — both remain full-instrument or
  full-round costs, and the round's remaining budget went to the blind round
  instead, on the reasoning that a probe result changes nothing a human
  notices tonight.
