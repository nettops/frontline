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

## The blind round, and three more fixes from what it found

`round16` (port 5316) played day 1 to day 305. Result: no MUST FIX items;
decisions held novel to ~day 220-230, against F1's three-round-confirmed
~day 90-119. Full report in `.ai/FINAL_REPORT.md`.

Three SHOULD FIX items fixed the same session, each verified test-first
(reverted and re-run to confirm red) and live in the browser:

7. **`fad73ac`** The card mechanic explains itself — `cardPerDistrict` split
   out of `cardTake`, previewing what a district would pay before commit.
8. **`e6e8d10`** The favour-network tip moved from 29th to 9th in queue
   priority — it existed but was never shown in a 305-day career.
9. **`ce77107`** District-tier thresholds shown as numbers for the first
   time — `nextControlThreshold()` in `territory.ts`, naming the next tier,
   the influence number, and whether the top two tiers' lead requirement is
   already met.

Final state: `tsc -b` clean, 1,368 tests passing (+7 across the whole
round), 0 failed, `npm run build` succeeds. Ten commits total this session,
none pushed.

---

# Progress — 2026-09-07, round 17 (full-day round, Opus deciding / Sonnet building)

Developer commissioned this round explicitly to attack the two things every
prior session deferred — **run variety** and **economic balance** (F1/F5/F7/
F15/F20/F21) — with a stated goal of every blind-playtest score and every
QA/probe axis at 9 or 10. Budget: until 9pm EST (~9.5 hours from start,
11:36am EDT). Developer is checking in periodically; free to add features
that enhance the experience, not just fix findings.

## Baseline

- `git status` clean, HEAD `baedfce` (autopilot risk-tolerance, this
  morning's prior session).
- `tsc -b` clean; last known full suite 1,374 passed / 11 skipped (from the
  autopilot session's run).
- Three background agents dispatched immediately, all running against fresh
  namespaced `npm run playtest` instances (never the developer's save):
  1. **Opus diagnosis** — full HANDOFF/DIRECTOR read plus live grep/probe
     verification, tasked with root-causing the run-variety and
     economic-balance clusters and producing ranked, falsifiable hypotheses.
     Not implementing anything.
  2. **Blind playtest, round17** (port from `npm run playtest --id round17`)
     — baseline read of the *current* state (after the risk-tolerance/
     HANDOFF fixes from this morning), same brief as every prior round.
  3. **Adversarial round** (port from `npm run playtest --id round17adv`) —
     `DIRECTOR.md` §10 condition 6, never once run in this project's
     history. Told to break the game rather than play it.
- Re-running `ladder.probe.test.ts` + `scorecard.probe.test.ts` myself in
  parallel for fresh numbers to work from once the diagnosis lands.

## In progress

Waiting on the three background agents. Next: read the Opus diagnosis,
cross-check its claims against source before acting (per HANDOFF §3's
standing rule), rank the implementation queue, and start fixing — test
first, verify each change, then decide whether it needs a probe or a
targeted/full blind round per `DIRECTOR.md` §4's sizing rule.

See `.ai/TASKS.md` for the ranked queue as it fills in.
