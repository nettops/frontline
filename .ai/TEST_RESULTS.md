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

## Not run this session, and why

- **A blind playtest round.** `DIRECTOR.md` requires a fresh agent that has
  not read the source, playing a live instance to Capo or day 300 — a
  90-minute-class cost on its own, and the governing brief's time budget for
  this session did not leave room for one alongside the audit and the fix.
  The tips change makes a future round more likely to actually exercise
  contracts, the favour network and the pressure dial, which is the most this
  session could do toward one without spending it.
