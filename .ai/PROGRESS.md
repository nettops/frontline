# Progress — 2026-09-06

## Baseline

- `git status` clean, branch `main`, HEAD `275c27b` (2026-08-30).
- `tsc -b` clean; `npx vitest run` — 1,361 passed, 11 skipped, 0 failed.
- Repo already runs its own director-loop process (`DIRECTOR.md`), a
  findings ledger (`HANDOFF.md`, F1–F23) and a design-spec archive
  (`docs/superpowers/specs/`). See `AUDIT.md` for what reading those turned up.

## Completed

1. **Three tips for three undiscoverable systems.**
   - Files: `src/ui/tips.ts`, `src/ui/__tests__/tips.reach.test.ts`.
   - Added `lean_on_it` (the per-business pressure dial), `contract` (sending
     people after a rival capo or boss), `favours` (the civic favour network)
     — all three shipped with no tip-strip entry, the exact "systems nobody
     could find" failure this project has fixed three times before.
   - Test-first: added the tips, ran `tips.reach.test.ts`, watched
     `accounts for every tip in the list` fail naming exactly the three new
     ids, then classified them (all in `ORDINARY`, reachability re-verified
     by running the test in isolation before touching anything else).
   - Verification: `tsc -b` clean, full `vitest run` unchanged at 1,361
     passing / 11 skipped, `npm run build` succeeds.
   - Logged: `docs/superpowers/findings/director-log.md` (new entry, in the
     project's own format and voice), `.ai/AUDIT.md`, `.ai/TASKS.md`.
   - Committed: see `git log` — one commit, `src/ui` and the log/spec docs
     only. Not pushed.

## In progress / owed (as of the end of that session)

See `.ai/TASKS.md` for the ranked list. Nothing else was implemented that
session — see `.ai/FINAL_REPORT.md` for why the audit's other findings were
left as findings rather than turned into further changes.

---

# Progress — 2026-09-07 (5-hour round, Opus deciding / Sonnet building)

Continuation session, same project, explicit two-model split: an Opus pass
decided what deserved fixing, a Sonnet pass (this one) implemented, tested
and committed each item, with one Opus check-in partway through.

## Baseline

- `git status` clean, HEAD `d3bb6c3` (the previous session's report commit).
- `tsc -b` clean; `npx vitest run` — 1,361 passed, 11 skipped, 0 failed.

## Completed — five commits

1. **`6a70f7d` Grip actually does what the build screen says.**
   `WORLD.gripSkim` wired into `delegation.ts`'s skim-opportunity scoring.
2. **`eaf0d07` A silent partner's protection, actually applied.**
   `PARTNER.protectionTrust` floors the partner faction's `trust` in
   `relationship()`, non-mutating; deliberately does not touch the raw-grudge
   war-declaration gate, and the commit message says so.
3. **`fa4b0df` A contract remembers a miss.** `CONTRACT.cooldownDays` wired
   into `canContract`, missed-only, landed-excluded.
4. **`9f02daa` Refusals name their figure, and Instinct finally does
   something.** The largest commit: `refusals.test.ts`'s detector widened
   (test-first) and seven silent-money refusals fixed across contraband.ts,
   investigation.ts, operations.ts, scores.ts; Instinct's warning system
   wired end-to-end (a new `Investigation.warnedStage` field, a hook in the
   stage-gate, a Planted column shipped in IntelligencePanel); Word and
   Ledger found to be design gaps rather than wiring gaps and labelled
   honestly on the build screen instead; four more dead config keys resolved
   (one wired, three deleted); the dead-key guard from last session tightened
   twice after it proved leaky.
5. **`a7c8148` The autopilot switch gets a tip.** Same tips.ts pattern as
   last session's three, reachability-verified.
6. **`a64fb34`** — this round logged in `docs/superpowers/findings/director-log.md`.

## Verification

`tsc -b` clean throughout. Full `vitest run`: 1,367 passed (+6), 11 skipped,
0 failed — no regressions outside what this round added. `npm run build`
succeeds. The two UI-visible changes (Word/Ledger's honesty note, the
Planted column) were checked live in the browser via the `mafia-verify`
launch config, not only in tests.

## In progress

A blind playtest round (round16, port 5316, via
`node scripts/playtest-run.mjs --id round16 --port 5316`) was dispatched to
a fresh subagent to validate the accumulated
changes from both sessions — the first human-shaped look at contracts, the
armoury, the favour network, the pressure dial, and now Instinct and the
refusal fixes, none of which any blind round has ever seen. See
`.ai/FINAL_REPORT.md` for its results once it lands.
